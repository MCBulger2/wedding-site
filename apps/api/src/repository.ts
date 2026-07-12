import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  ScanCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import type { Household, SmsConsent, StoredRsvp } from '@matt-alison-wedding/shared';

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

export interface SmsSubscription {
  subscriptionId: string;
  attemptId: string;
  consent: SmsConsent;
  createdAt: string;
  updatedAt: string;
}

export interface SmsPreferenceActivation {
  householdId: string;
  expectedPending: SmsConsent;
  activatedAt: string;
}

export interface SmsPreferencePendingStart {
  householdId: string;
  expectedUpdatedAt: string;
  expectedConsent?: SmsConsent;
  pendingConsent: SmsConsent;
}

export interface SmsPreferencePendingStartResult {
  started: boolean;
  household?: Household;
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
  beginSmsSubscription(input: SmsSubscription): Promise<void>;
  activateSmsSubscription(input: {
    subscriptionId: string;
    expectedAttemptId: string;
    expectedPending: SmsConsent;
    activatedAt: string;
  }): Promise<SmsSubscription | undefined>;
  beginSmsPreference(input: SmsPreferencePendingStart): Promise<SmsPreferencePendingStartResult>;
  activateSmsPreference(input: SmsPreferenceActivation): Promise<Household | undefined>;
  saveHousehold(household: Household): Promise<void>;
  saveRsvpUpdate(household: Household, rsvp: StoredRsvp): Promise<void>;
  saveInviteCodeLookup(lookup: InviteCodeLookup): Promise<void>;
  saveInviteCodeSecret(secret: InviteCodeSecret): Promise<void>;
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

interface StoredSmsSubscriptionItem extends SmsSubscription {
  pk: string;
  sk: string;
  entityType: 'SmsSubscription';
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
    return this.scanHouseholds({
      FilterExpression: 'entityType = :entityType AND email = :email',
      ExpressionAttributeValues: {
        ':entityType': 'Household',
        ':email': email,
      },
    });
  }

  async listHouseholdsByPhone(phone: string): Promise<Household[]> {
    return this.scanHouseholds({
      FilterExpression: 'entityType = :entityType AND phone = :phone',
      ExpressionAttributeValues: {
        ':entityType': 'Household',
        ':phone': phone,
      },
    });
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
    return this.scanHouseholds({
      FilterExpression: 'entityType = :entityType',
      ExpressionAttributeValues: {
        ':entityType': 'Household',
      },
    });
  }

  async saveHousehold(household: Household): Promise<void> {
    const existingRsvp = await this.getRsvp(household.householdId);
    await this.putHouseholdItem(household, existingRsvp);
  }

  async beginSmsSubscription(input: SmsSubscription): Promise<void> {
    await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: smsSubscriptionKey(input.subscriptionId),
        UpdateExpression:
          'SET entityType = :entityType, subscriptionId = :subscriptionId, attemptId = :attemptId, consent = :consent, createdAt = if_not_exists(createdAt, :createdAt), updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':entityType': 'SmsSubscription',
          ':subscriptionId': input.subscriptionId,
          ':attemptId': input.attemptId,
          ':consent': input.consent,
          ':createdAt': input.createdAt,
          ':updatedAt': input.updatedAt,
        },
      }),
    );
  }

  async activateSmsSubscription(input: {
    subscriptionId: string;
    expectedAttemptId: string;
    expectedPending: SmsConsent;
    activatedAt: string;
  }): Promise<SmsSubscription | undefined> {
    const activatedConsent: SmsConsent = {
      ...input.expectedPending,
      status: 'opted_in',
      consentedAt: input.activatedAt,
    };
    try {
      const result = await this.client.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: smsSubscriptionKey(input.subscriptionId),
          UpdateExpression: 'SET consent = :activatedConsent, updatedAt = :activatedAt',
          ConditionExpression:
            'attemptId = :expectedAttemptId AND consent.#status = :pendingStatus AND consent.phone = :phone AND consent.consentedAt = :pendingConsentedAt',
          ExpressionAttributeNames: {
            '#status': 'status',
          },
          ExpressionAttributeValues: {
            ':activatedConsent': activatedConsent,
            ':activatedAt': input.activatedAt,
            ':expectedAttemptId': input.expectedAttemptId,
            ':pendingStatus': 'pending_confirmation',
            ':phone': input.expectedPending.phone,
            ':pendingConsentedAt': input.expectedPending.consentedAt,
          },
          ReturnValues: 'ALL_NEW',
        }),
      );
      return result.Attributes
        ? fromSmsSubscriptionItem(result.Attributes as StoredSmsSubscriptionItem)
        : undefined;
    } catch (error) {
      if (!isConditionalCheckFailed(error)) {
        throw error;
      }
      return this.getSmsSubscription(input.subscriptionId);
    }
  }

  async activateSmsPreference(
    input: SmsPreferenceActivation,
  ): Promise<Household | undefined> {
    const activatedConsent: SmsConsent = {
      ...input.expectedPending,
      status: 'opted_in',
      consentedAt: input.activatedAt,
    };
    try {
      const result = await this.client.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: householdKey(input.householdId),
          UpdateExpression: 'SET smsConsent = :activatedConsent, updatedAt = :activatedAt',
          ConditionExpression:
            'smsConsent.#status = :pendingStatus AND smsConsent.phone = :phone AND smsConsent.consentedAt = :pendingConsentedAt',
          ExpressionAttributeNames: {
            '#status': 'status',
          },
          ExpressionAttributeValues: {
            ':activatedConsent': activatedConsent,
            ':activatedAt': input.activatedAt,
            ':pendingStatus': 'pending_confirmation',
            ':phone': input.expectedPending.phone,
            ':pendingConsentedAt': input.expectedPending.consentedAt,
          },
          ReturnValues: 'ALL_NEW',
        }),
      );
      return result.Attributes
        ? fromHouseholdItem(result.Attributes as StoredHouseholdItem)
        : undefined;
    } catch (error) {
      if (!isConditionalCheckFailed(error)) {
        throw error;
      }
      return this.getHousehold(input.householdId);
    }
  }

  async beginSmsPreference(
    input: SmsPreferencePendingStart,
  ): Promise<SmsPreferencePendingStartResult> {
    const hasExpectedConsent = Boolean(input.expectedConsent);
    const consentCondition = hasExpectedConsent
      ? 'smsConsent.#status = :expectedStatus AND smsConsent.phone = :expectedPhone AND smsConsent.consentedAt = :expectedConsentedAt'
      : 'attribute_not_exists(smsConsent)';
    const expectedConsentValues = input.expectedConsent
      ? {
          ':expectedStatus': input.expectedConsent.status,
          ':expectedPhone': input.expectedConsent.phone,
          ':expectedConsentedAt': input.expectedConsent.consentedAt,
        }
      : {};
    try {
      const result = await this.client.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: householdKey(input.householdId),
          UpdateExpression:
            'SET phone = :phone, smsConsent = :pendingConsent, updatedAt = :pendingAt',
          ConditionExpression: `updatedAt = :expectedUpdatedAt AND ${consentCondition}`,
          ExpressionAttributeNames: hasExpectedConsent
            ? { '#status': 'status' }
            : undefined,
          ExpressionAttributeValues: {
            ':phone': input.pendingConsent.phone,
            ':pendingConsent': input.pendingConsent,
            ':pendingAt': input.pendingConsent.consentedAt,
            ':expectedUpdatedAt': input.expectedUpdatedAt,
            ...expectedConsentValues,
          },
          ReturnValues: 'ALL_NEW',
        }),
      );
      return {
        started: true,
        household: result.Attributes
          ? fromHouseholdItem(result.Attributes as StoredHouseholdItem)
          : undefined,
      };
    } catch (error) {
      if (!isConditionalCheckFailed(error)) {
        throw error;
      }
      return {
        started: false,
        household: await this.getHousehold(input.householdId),
      };
    }
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

  async saveRsvpUpdate(household: Household, rsvp: StoredRsvp): Promise<void> {
    await this.putHouseholdItem(household, rsvp, 'attribute_exists(pk) AND attribute_exists(sk)');
  }

  private async putHouseholdItem(
    household: Household,
    rsvp?: StoredRsvp,
    conditionExpression?: string,
  ): Promise<void> {
    const putInput = {
      TableName: this.tableName,
      Item: {
        ...household,
        rsvp,
        rsvpStatus: rsvp ? deriveRsvpStatus(rsvp) : household.rsvpStatus,
        updatedAt: rsvp?.updatedAt ?? household.updatedAt,
        ...householdKey(household.householdId),
        entityType: 'Household',
      } satisfies StoredHouseholdItem,
      ...(conditionExpression
        ? { ConditionExpression: conditionExpression }
        : {}),
    };

    await this.client.send(
      new PutCommand(putInput),
    );
  }

  private async getSmsSubscription(
    subscriptionId: string,
  ): Promise<SmsSubscription | undefined> {
    const result = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: smsSubscriptionKey(subscriptionId),
      }),
    );
    return result.Item
      ? fromSmsSubscriptionItem(result.Item as StoredSmsSubscriptionItem)
      : undefined;
  }

  private async scanHouseholds(input: {
    FilterExpression: string;
    ExpressionAttributeValues: Record<string, unknown>;
  }): Promise<Household[]> {
    const items: StoredHouseholdItem[] = [];
    let exclusiveStartKey: Record<string, unknown> | undefined;

    do {
      const result = await this.client.send(
        new ScanCommand({
          TableName: this.tableName,
          ...input,
          ...(exclusiveStartKey ? { ExclusiveStartKey: exclusiveStartKey } : {}),
        }),
      );

      items.push(...((result.Items ?? []) as StoredHouseholdItem[]));
      exclusiveStartKey = result.LastEvaluatedKey;
    } while (exclusiveStartKey);

    return items.map(fromHouseholdItem);
  }
}

export class InMemoryWeddingRepository implements WeddingRepository {
  readonly households = new Map<string, Household>();
  readonly inviteLookups = new Map<string, InviteCodeLookup>();
  readonly inviteCodeSecrets = new Map<string, InviteCodeSecret>();
  readonly recoveryRateLimits = new Map<string, RecoveryRateLimitRecord>();
  readonly smsSubscriptions = new Map<string, SmsSubscription>();
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

  async beginSmsSubscription(input: SmsSubscription): Promise<void> {
    const existing = this.smsSubscriptions.get(input.subscriptionId);
    this.smsSubscriptions.set(input.subscriptionId, {
      ...input,
      createdAt: existing?.createdAt ?? input.createdAt,
    });
  }

  async activateSmsSubscription(input: {
    subscriptionId: string;
    expectedAttemptId: string;
    expectedPending: SmsConsent;
    activatedAt: string;
  }): Promise<SmsSubscription | undefined> {
    const current = this.smsSubscriptions.get(input.subscriptionId);
    if (!current) {
      return undefined;
    }
    if (
      current.attemptId !== input.expectedAttemptId ||
      current.consent.status !== 'pending_confirmation' ||
      current.consent.phone !== input.expectedPending.phone ||
      current.consent.consentedAt !== input.expectedPending.consentedAt
    ) {
      return current;
    }
    const activated: SmsSubscription = {
      ...current,
      consent: {
        ...input.expectedPending,
        status: 'opted_in',
        consentedAt: input.activatedAt,
      },
      updatedAt: input.activatedAt,
    };
    this.smsSubscriptions.set(input.subscriptionId, activated);
    return activated;
  }

  async activateSmsPreference(
    input: SmsPreferenceActivation,
  ): Promise<Household | undefined> {
    const current = this.households.get(input.householdId);
    if (!current) {
      return undefined;
    }
    if (
      current.smsConsent?.status !== 'pending_confirmation' ||
      current.smsConsent.phone !== input.expectedPending.phone ||
      current.smsConsent.consentedAt !== input.expectedPending.consentedAt
    ) {
      return this.getHousehold(input.householdId);
    }
    const activated: Household = {
      ...current,
      smsConsent: {
        ...input.expectedPending,
        status: 'opted_in',
        consentedAt: input.activatedAt,
      },
      updatedAt: input.activatedAt,
    };
    await this.saveHousehold(activated);
    return this.getHousehold(input.householdId);
  }

  async beginSmsPreference(
    input: SmsPreferencePendingStart,
  ): Promise<SmsPreferencePendingStartResult> {
    const current = this.households.get(input.householdId);
    if (!current) {
      return { started: false };
    }
    if (
      current.updatedAt !== input.expectedUpdatedAt ||
      !smsConsentMatches(current.smsConsent, input.expectedConsent)
    ) {
      return { started: false, household: current };
    }
    const pending: Household = {
      ...current,
      phone: input.pendingConsent.phone,
      smsConsent: input.pendingConsent,
      updatedAt: input.pendingConsent.consentedAt,
    };
    this.households.set(input.householdId, pending);
    return { started: true, household: pending };
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

  async saveRsvpUpdate(household: Household, rsvp: StoredRsvp): Promise<void> {
    if (!this.households.has(household.householdId)) {
      throw new Error('Household not found');
    }
    this.rsvps.set(household.householdId, rsvp);
    this.households.set(household.householdId, {
      ...household,
      rsvpStatus: deriveRsvpStatus(rsvp),
      updatedAt: rsvp.updatedAt,
    });
  }

  async saveInviteCodeLookup(lookup: InviteCodeLookup): Promise<void> {
    this.inviteLookups.set(lookup.inviteCodeHash, lookup);
  }

  async saveInviteCodeSecret(secret: InviteCodeSecret): Promise<void> {
    this.inviteCodeSecrets.set(secret.householdId, secret);
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

function smsSubscriptionKey(subscriptionId: string) {
  return { pk: `SMS_SUBSCRIPTION#${subscriptionId}`, sk: 'METADATA' };
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

function fromSmsSubscriptionItem(item: StoredSmsSubscriptionItem): SmsSubscription {
  return {
    subscriptionId: item.subscriptionId,
    attemptId: item.attemptId,
    consent: item.consent,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

function isConditionalCheckFailed(error: unknown): boolean {
  return error instanceof Error && error.name === 'ConditionalCheckFailedException';
}

function smsConsentMatches(
  current: SmsConsent | undefined,
  expected: SmsConsent | undefined,
): boolean {
  if (!current || !expected) {
    return current === expected;
  }
  return (
    current.status === expected.status &&
    current.phone === expected.phone &&
    current.consentedAt === expected.consentedAt
  );
}
