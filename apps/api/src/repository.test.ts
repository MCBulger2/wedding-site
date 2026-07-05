import { describe, expect, it, vi } from 'vitest';
import type { Household } from '@matt-alison-wedding/shared';
import { DynamoWeddingRepository, InMemoryWeddingRepository } from './repository.js';

interface CommandWithInput {
  input: Record<string, unknown>;
}

const cursor = { pk: 'HOUSEHOLD#cursor', sk: 'METADATA' };

function householdItem(householdId: string, overrides: Partial<Household> = {}) {
  return {
    householdId,
    displayName: `Household ${householdId}`,
    email: 'guest@example.com',
    phone: '+14805550111',
    members: [
      {
        id: `${householdId}-member`,
        firstName: 'Guest',
        lastName: householdId,
        canBringPlusOne: false,
      },
    ],
    maxPlusOnes: 0,
    rsvpStatus: 'not_started',
    inviteLifecycleStatus: 'not_generated',
    createdAt: '2026-07-04T12:00:00.000Z',
    updatedAt: '2026-07-04T12:00:00.000Z',
    pk: `HOUSEHOLD#${householdId}`,
    sk: 'METADATA',
    entityType: 'Household',
    ...overrides,
  };
}

function mockRepositorySend(repository: DynamoWeddingRepository) {
  return vi.spyOn(
    (repository as unknown as { client: { send: (...args: unknown[]) => Promise<unknown> } }).client,
    'send',
  );
}

describe('Dynamo household scan pagination', () => {
  it('returns households from every scan page when listing all households', async () => {
    const repository = new DynamoWeddingRepository('wedding-table');
    const send = mockRepositorySend(repository)
      .mockResolvedValueOnce({
        Items: [householdItem('h1')],
        LastEvaluatedKey: cursor,
      })
      .mockResolvedValueOnce({
        Items: [householdItem('h2')],
      });

    const households = await repository.listHouseholds();

    expect(households.map((household) => household.householdId)).toEqual(['h1', 'h2']);
    expect(send).toHaveBeenCalledTimes(2);
    expect((send.mock.calls[0][0] as CommandWithInput).input).toMatchObject({
      TableName: 'wedding-table',
      FilterExpression: 'entityType = :entityType',
      ExpressionAttributeValues: {
        ':entityType': 'Household',
      },
    });
    expect((send.mock.calls[1][0] as CommandWithInput).input).toMatchObject({
      FilterExpression: 'entityType = :entityType',
      ExpressionAttributeValues: {
        ':entityType': 'Household',
      },
      ExclusiveStartKey: cursor,
    });
  });

  it('returns households from every scan page when finding by email', async () => {
    const repository = new DynamoWeddingRepository('wedding-table');
    const send = mockRepositorySend(repository)
      .mockResolvedValueOnce({
        Items: [householdItem('h1')],
        LastEvaluatedKey: cursor,
      })
      .mockResolvedValueOnce({
        Items: [householdItem('h2')],
      });

    const households = await repository.listHouseholdsByEmail('guest@example.com');

    expect(households.map((household) => household.householdId)).toEqual(['h1', 'h2']);
    expect(send).toHaveBeenCalledTimes(2);
    expect((send.mock.calls[0][0] as CommandWithInput).input).toMatchObject({
      FilterExpression: 'entityType = :entityType AND email = :email',
      ExpressionAttributeValues: {
        ':entityType': 'Household',
        ':email': 'guest@example.com',
      },
    });
    expect((send.mock.calls[1][0] as CommandWithInput).input).toMatchObject({
      FilterExpression: 'entityType = :entityType AND email = :email',
      ExpressionAttributeValues: {
        ':entityType': 'Household',
        ':email': 'guest@example.com',
      },
      ExclusiveStartKey: cursor,
    });
  });

  it('returns households from every scan page when finding by phone', async () => {
    const repository = new DynamoWeddingRepository('wedding-table');
    const send = mockRepositorySend(repository)
      .mockResolvedValueOnce({
        Items: [householdItem('h1')],
        LastEvaluatedKey: cursor,
      })
      .mockResolvedValueOnce({
        Items: [householdItem('h2')],
      });

    const households = await repository.listHouseholdsByPhone('+14805550111');

    expect(households.map((household) => household.householdId)).toEqual(['h1', 'h2']);
    expect(send).toHaveBeenCalledTimes(2);
    expect((send.mock.calls[0][0] as CommandWithInput).input).toMatchObject({
      FilterExpression: 'entityType = :entityType AND phone = :phone',
      ExpressionAttributeValues: {
        ':entityType': 'Household',
        ':phone': '+14805550111',
      },
    });
    expect((send.mock.calls[1][0] as CommandWithInput).input).toMatchObject({
      FilterExpression: 'entityType = :entityType AND phone = :phone',
      ExpressionAttributeValues: {
        ':entityType': 'Household',
        ':phone': '+14805550111',
      },
      ExclusiveStartKey: cursor,
    });
  });
});

describe('Recovery rate limit persistence', () => {
  it('increments in-memory recovery attempts by fixed window key', async () => {
    const repository = new InMemoryWeddingRepository();

    const firstCount = await repository.recordRecoveryRateLimitAttempt({
      scope: 'contact',
      keyHash: 'hash',
      windowStartsAt: 1_720_094_400_000,
      attempts: 0,
      windowExpiresAt: 1_720_095_300_000,
      updatedAt: '2026-07-04T12:00:00.000Z',
    });
    const secondCount = await repository.recordRecoveryRateLimitAttempt({
      scope: 'contact',
      keyHash: 'hash',
      windowStartsAt: 1_720_094_400_000,
      attempts: 0,
      windowExpiresAt: 1_720_095_300_000,
      updatedAt: '2026-07-04T12:00:01.000Z',
    });
    const nextWindowCount = await repository.recordRecoveryRateLimitAttempt({
      scope: 'contact',
      keyHash: 'hash',
      windowStartsAt: 1_720_095_300_000,
      attempts: 0,
      windowExpiresAt: 1_720_096_200_000,
      updatedAt: '2026-07-04T12:15:00.000Z',
    });

    expect(firstCount).toBe(1);
    expect(secondCount).toBe(2);
    expect(nextWindowCount).toBe(1);
    expect(repository.recoveryRateLimits.get('contact:hash:1720094400000')).toMatchObject({
      attempts: 2,
      windowExpiresAt: 1_720_095_300_000,
    });
  });

  it('uses an atomic Dynamo update keyed by scope, hash, and window start', async () => {
    const repository = new DynamoWeddingRepository('wedding-table');
    const send = vi
      .spyOn((repository as unknown as { client: { send: (...args: unknown[]) => Promise<unknown> } }).client, 'send')
      .mockResolvedValue({
        Attributes: {
          attempts: 3,
        },
      });

    const attempts = await repository.recordRecoveryRateLimitAttempt({
      scope: 'ip',
      keyHash: 'hash',
      windowStartsAt: 1_720_094_400_000,
      attempts: 0,
      windowExpiresAt: 1_720_095_300_000,
      updatedAt: '2026-07-04T12:00:00.000Z',
    });

    expect(attempts).toBe(3);
    expect(send).toHaveBeenCalledTimes(1);
    const command = send.mock.calls[0][0] as CommandWithInput;
    expect(command.input).toMatchObject({
      TableName: 'wedding-table',
      Key: {
        pk: 'RECOVERY_RATE_LIMIT#ip#hash',
        sk: 'WINDOW#1720094400000',
      },
      UpdateExpression: expect.stringMatching(/^SET .+ ADD attempts :attemptIncrement$/),
      ExpressionAttributeValues: {
        ':attemptIncrement': 1,
        ':entityType': 'RecoveryRateLimit',
        ':ttl': 1720095300,
        ':scope': 'ip',
        ':keyHash': 'hash',
        ':windowStartsAt': 1_720_094_400_000,
        ':windowExpiresAt': 1_720_095_300_000,
        ':updatedAt': '2026-07-04T12:00:00.000Z',
      },
      ReturnValues: 'ALL_NEW',
    });
  });
});
