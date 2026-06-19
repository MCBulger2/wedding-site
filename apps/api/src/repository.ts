import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import type { Household, StoredRsvp } from '@matt-alison-wedding/shared';

export interface InviteCodeLookup {
  inviteCodeHash: string;
  householdId: string;
  createdAt: string;
}

export interface WeddingRepository {
  getHousehold(householdId: string): Promise<Household | undefined>;
  getHouseholdByInviteHash(inviteCodeHash: string): Promise<Household | undefined>;
  getRsvp(householdId: string): Promise<StoredRsvp | undefined>;
  listHouseholds(): Promise<Household[]>;
  saveHousehold(household: Household): Promise<void>;
  saveInviteCodeLookup(lookup: InviteCodeLookup): Promise<void>;
  saveRsvp(householdId: string, rsvp: StoredRsvp): Promise<void>;
}

interface StoredHouseholdItem extends Household {
  pk: string;
  sk: string;
  entityType: 'Household';
  rsvp?: StoredRsvp;
}

interface StoredInviteLookupItem extends InviteCodeLookup {
  pk: string;
  sk: string;
  entityType: 'InviteCodeLookup';
}

export class DynamoWeddingRepository implements WeddingRepository {
  private readonly client: DynamoDBDocumentClient;

  constructor(private readonly tableName: string, dynamoClient = new DynamoDBClient({})) {
    this.client = DynamoDBDocumentClient.from(dynamoClient);
  }

  async getHousehold(householdId: string): Promise<Household | undefined> {
    const result = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: householdKey(householdId),
      }),
    );

    return result.Item ? fromHouseholdItem(result.Item as StoredHouseholdItem) : undefined;
  }

  async getHouseholdByInviteHash(inviteCodeHash: string): Promise<Household | undefined> {
    const lookup = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: inviteLookupKey(inviteCodeHash),
      }),
    );

    if (!lookup.Item) {
      return undefined;
    }

    return this.getHousehold((lookup.Item as StoredInviteLookupItem).householdId);
  }

  async getRsvp(householdId: string): Promise<StoredRsvp | undefined> {
    const result = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: householdKey(householdId),
      }),
    );

    return (result.Item as StoredHouseholdItem | undefined)?.rsvp;
  }

  async listHouseholds(): Promise<Household[]> {
    const result = await this.client.send(
      new ScanCommand({
        TableName: this.tableName,
        FilterExpression: 'entityType = :entityType',
        ExpressionAttributeValues: {
          ':entityType': 'Household',
        },
      }),
    );

    return (result.Items ?? []).map((item) => fromHouseholdItem(item as StoredHouseholdItem));
  }

  async saveHousehold(household: Household): Promise<void> {
    const existingRsvp = await this.getRsvp(household.householdId);
    const item: StoredHouseholdItem = {
      ...household,
      rsvp: existingRsvp,
      rsvpStatus: existingRsvp ? deriveRsvpStatus(existingRsvp) : household.rsvpStatus,
      ...householdKey(household.householdId),
      entityType: 'Household',
    };

    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: item,
      }),
    );
  }

  async saveInviteCodeLookup(lookup: InviteCodeLookup): Promise<void> {
    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          ...lookup,
          ...inviteLookupKey(lookup.inviteCodeHash),
          entityType: 'InviteCodeLookup',
        },
      }),
    );
  }

  async saveRsvp(householdId: string, rsvp: StoredRsvp): Promise<void> {
    const household = await this.getHousehold(householdId);
    if (!household) {
      throw new Error('Household not found');
    }

    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          ...household,
          rsvp,
          rsvpStatus: deriveRsvpStatus(rsvp),
          updatedAt: rsvp.updatedAt,
          ...householdKey(householdId),
          entityType: 'Household',
        } satisfies StoredHouseholdItem,
      }),
    );
  }
}

export class InMemoryWeddingRepository implements WeddingRepository {
  readonly households = new Map<string, Household>();
  readonly inviteLookups = new Map<string, InviteCodeLookup>();
  readonly rsvps = new Map<string, StoredRsvp>();

  async getHousehold(householdId: string): Promise<Household | undefined> {
    const household = this.households.get(householdId);
    const rsvp = this.rsvps.get(householdId);
    return household && rsvp ? { ...household, rsvpStatus: deriveRsvpStatus(rsvp) } : household;
  }

  async getHouseholdByInviteHash(inviteCodeHash: string): Promise<Household | undefined> {
    const lookup = this.inviteLookups.get(inviteCodeHash);
    return lookup ? this.getHousehold(lookup.householdId) : undefined;
  }

  async getRsvp(householdId: string): Promise<StoredRsvp | undefined> {
    return this.rsvps.get(householdId);
  }

  async listHouseholds(): Promise<Household[]> {
    return [...this.households.values()];
  }

  async saveHousehold(household: Household): Promise<void> {
    const existingRsvp = this.rsvps.get(household.householdId);
    this.households.set(household.householdId, {
      ...household,
      rsvpStatus: existingRsvp ? deriveRsvpStatus(existingRsvp) : household.rsvpStatus,
    });
  }

  async saveInviteCodeLookup(lookup: InviteCodeLookup): Promise<void> {
    this.inviteLookups.set(lookup.inviteCodeHash, lookup);
  }

  async saveRsvp(householdId: string, rsvp: StoredRsvp): Promise<void> {
    const household = this.households.get(householdId);
    if (!household) {
      throw new Error('Household not found');
    }
    this.rsvps.set(householdId, rsvp);
    this.households.set(householdId, {
      ...household,
      rsvpStatus: deriveRsvpStatus(rsvp),
      updatedAt: rsvp.updatedAt,
    });
  }
}

export function deriveRsvpStatus(rsvp: Pick<StoredRsvp, 'members'>): Household['rsvpStatus'] {
  const attendingCount = rsvp.members.filter((member) => member.attending).length;
  if (attendingCount === 0) {
    return 'declined';
  }
  if (attendingCount === rsvp.members.length) {
    return 'attending';
  }
  return 'partial';
}

function householdKey(householdId: string) {
  return { pk: `HOUSEHOLD#${householdId}`, sk: 'METADATA' };
}

function inviteLookupKey(inviteCodeHash: string) {
  return { pk: `INVITE#${inviteCodeHash}`, sk: 'LOOKUP' };
}

function fromHouseholdItem(item: StoredHouseholdItem): Household {
  return {
    householdId: item.householdId,
    displayName: item.displayName,
    email: item.email,
    mailingAddress: item.mailingAddress,
    members: item.members,
    maxPlusOnes: item.maxPlusOnes,
    rsvpStatus: item.rsvpStatus,
    inviteLifecycleStatus: item.inviteLifecycleStatus ?? (item.inviteCodeHash ? 'generated' : 'not_generated'),
    inviteCodeHash: item.inviteCodeHash,
    inviteCodeGeneratedAt: item.inviteCodeGeneratedAt,
    inviteExportedAt: item.inviteExportedAt,
    inviteSentAt: item.inviteSentAt,
    inviteCodeLastRotatedAt: item.inviteCodeLastRotatedAt,
    archivedAt: item.archivedAt,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}
