import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  ScanCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import type { Household, StoredRsvp } from '@matt-alison-wedding/shared';

export interface InviteCodeLookup {
  inviteCodeHash: string;
  householdId: string;
  createdAt: string;
}

export interface InviteCodeSecret {
  householdId: string;
  inviteCodeHash: string;
  inviteCodeCiphertext: string;
  updatedAt: string;
}

export interface RecoveryRateLimitRecord {
  scope: 'contact' | 'ip';
  keyHash: string;
  windowStartsAt: number;
  attempts: number;
  windowExpiresAt: number;
  updatedAt: string;
}

export interface WeddingRepository {
  getHousehold(householdId: string): Promise<Household | undefined>;
  getHouseholdByInviteHash(inviteCodeHash: string): Promise<Household | undefined>;
  listHouseholdsByEmail(email: string): Promise<Household[]>;
  listHouseholdsByPhone(phone: string): Promise<Household[]>;
  getInviteCodeSecret(householdId: string): Promise<InviteCodeSecret | undefined>;
  getRsvp(householdId: string): Promise<StoredRsvp | undefined>;
  listHouseholds(): Promise<Household[]>;
  recordRecoveryRateLimitAttempt(record: RecoveryRateLimitRecord): Promise<number>;
  saveHousehold(household: Household): Promise<void>;
  saveInviteCodeLookup(lookup: InviteCodeLookup): Promise<void>;
  saveInviteCodeSecret(secret: InviteCodeSecret): Promise<void>;
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

interface StoredInviteCodeSecretItem extends InviteCodeSecret {
  pk: string;
  sk: string;
  entityType: 'InviteCodeSecret';
}

interface StoredRecoveryRateLimitItem extends RecoveryRateLimitRecord {
  pk: string;
  sk: string;
  entityType: 'RecoveryRateLimit';
  ttl: number;
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

  async listHouseholdsByEmail(email: string): Promise<Household[]> {
    const result = await this.client.send(
      new ScanCommand({
        TableName: this.tableName,
        FilterExpression: 'entityType = :entityType AND email = :email',
        ExpressionAttributeValues: {
          ':entityType': 'Household',
          ':email': email,
        },
      }),
    );

    return (result.Items ?? []).map((item) => fromHouseholdItem(item as StoredHouseholdItem));
  }

  async listHouseholdsByPhone(phone: string): Promise<Household[]> {
    const result = await this.client.send(
      new ScanCommand({
        TableName: this.tableName,
        FilterExpression: 'entityType = :entityType AND phone = :phone',
        ExpressionAttributeValues: {
          ':entityType': 'Household',
          ':phone': phone,
        },
      }),
    );

    return (result.Items ?? []).map((item) => fromHouseholdItem(item as StoredHouseholdItem));
  }

  async getInviteCodeSecret(householdId: string): Promise<InviteCodeSecret | undefined> {
    const result = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: inviteCodeSecretKey(householdId),
      }),
    );

    if (!result.Item) {
      return undefined;
    }

    const item = result.Item as StoredInviteCodeSecretItem;
    return {
      householdId: item.householdId,
      inviteCodeHash: item.inviteCodeHash,
      inviteCodeCiphertext: item.inviteCodeCiphertext,
      updatedAt: item.updatedAt,
    };
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

  async recordRecoveryRateLimitAttempt(record: RecoveryRateLimitRecord): Promise<number> {
    const result = await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: recoveryRateLimitKey(
          record.scope,
          record.keyHash,
          record.windowStartsAt,
        ),
        UpdateExpression:
          'SET entityType = :entityType, ttl = :ttl, #scope = :scope, keyHash = :keyHash, windowStartsAt = :windowStartsAt, windowExpiresAt = :windowExpiresAt, updatedAt = :updatedAt ADD attempts :attemptIncrement',
        ExpressionAttributeNames: {
          '#scope': 'scope',
        },
        ExpressionAttributeValues: {
          ':attemptIncrement': 1,
          ':entityType': 'RecoveryRateLimit',
          ':ttl': Math.ceil(record.windowExpiresAt / 1000),
          ':scope': record.scope,
          ':keyHash': record.keyHash,
          ':windowStartsAt': record.windowStartsAt,
          ':windowExpiresAt': record.windowExpiresAt,
          ':updatedAt': record.updatedAt,
        },
        ReturnValues: 'ALL_NEW',
      }),
    );

    return (result.Attributes as StoredRecoveryRateLimitItem).attempts;
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

  async saveInviteCodeSecret(secret: InviteCodeSecret): Promise<void> {
    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          ...secret,
          ...inviteCodeSecretKey(secret.householdId),
          entityType: 'InviteCodeSecret',
        } satisfies StoredInviteCodeSecretItem,
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
  readonly inviteCodeSecrets = new Map<string, InviteCodeSecret>();
  readonly recoveryRateLimits = new Map<string, RecoveryRateLimitRecord>();
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

  async listHouseholdsByEmail(email: string): Promise<Household[]> {
    return [...this.households.values()].filter((household) => household.email === email);
  }

  async listHouseholdsByPhone(phone: string): Promise<Household[]> {
    return [...this.households.values()].filter((household) => household.phone === phone);
  }

  async getInviteCodeSecret(householdId: string): Promise<InviteCodeSecret | undefined> {
    return this.inviteCodeSecrets.get(householdId);
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

  async recordRecoveryRateLimitAttempt(record: RecoveryRateLimitRecord): Promise<number> {
    const mapKey = `${record.scope}:${record.keyHash}:${record.windowStartsAt}`;
    const nextAttempts = (this.recoveryRateLimits.get(mapKey)?.attempts ?? 0) + 1;
    this.recoveryRateLimits.set(mapKey, {
      ...record,
      attempts: nextAttempts,
    });
    return nextAttempts;
  }

  async saveInviteCodeLookup(lookup: InviteCodeLookup): Promise<void> {
    this.inviteLookups.set(lookup.inviteCodeHash, lookup);
  }

  async saveInviteCodeSecret(secret: InviteCodeSecret): Promise<void> {
    this.inviteCodeSecrets.set(secret.householdId, secret);
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

function inviteCodeSecretKey(householdId: string) {
  return { pk: `HOUSEHOLD#${householdId}`, sk: 'INVITE_CODE_SECRET' };
}

function recoveryRateLimitKey(
  scope: RecoveryRateLimitRecord['scope'],
  keyHash: string,
  windowStartsAt: number,
) {
  return {
    pk: `RECOVERY_RATE_LIMIT#${scope}#${keyHash}`,
    sk: `WINDOW#${windowStartsAt}`,
  };
}

function fromHouseholdItem(item: StoredHouseholdItem): Household {
  return {
    householdId: item.householdId,
    displayName: item.displayName,
    email: item.email,
    phone: item.phone,
    smsConsent: item.smsConsent,
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
