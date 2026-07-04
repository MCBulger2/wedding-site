import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { handleRequest } from './handler.js';
import { PublicError } from './service.js';

const acceptedRecoveryResponse = {
  accepted: true as const,
  message: "If that matches our guest list, we'll send your private RSVP link.",
};

describe('handleRequest', () => {
  let consoleLog: ReturnType<typeof vi.spyOn>;
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.stubEnv('FRONTEND_BASE_URL', 'https://frontend.example.com');
    consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('returns 422 for invalid recovery contact input', async () => {
    const service = createServiceDouble({
      requestRsvpRecovery: vi.fn(async () => {
        throw new PublicError('Recovery contact is invalid', 422, [
          'contact: Enter a valid email address or mobile number.',
        ]);
      }),
    });

    const response = await handleRequest(
      service,
      createEvent('/api/rsvp/recovery', 'POST', { contact: 'bad' }),
    );

    const httpResponse = response as Exclude<typeof response, string>;
    expect(httpResponse.statusCode).toBe(422);
    expect(JSON.parse(httpResponse.body as string)).toMatchObject({
      message: 'Recovery contact is invalid',
    });
  });

  it('returns a generic accepted response when recovery is throttled', async () => {
    const service = createServiceDouble({
      requestRsvpRecovery: vi.fn(async () => acceptedRecoveryResponse),
    });

    const response = await handleRequest(
      service,
      createEvent('/api/rsvp/recovery', 'POST', { contact: 'sam@example.com' }),
    );

    const httpResponse = response as Exclude<typeof response, string>;
    expect(httpResponse.statusCode).toBe(202);
    expect(JSON.parse(httpResponse.body as string)).toEqual(
      acceptedRecoveryResponse,
    );
  });

  it('passes email recovery requests through with request context', async () => {
    const requestRsvpRecovery = vi.fn(async () => acceptedRecoveryResponse);
    const service = createServiceDouble({ requestRsvpRecovery });

    const response = await handleRequest(
      service,
      createEvent('/api/rsvp/recovery', 'POST', { contact: 'sam@example.com' }),
    );

    const httpResponse = response as Exclude<typeof response, string>;
    expect(httpResponse.statusCode).toBe(202);
    expect(requestRsvpRecovery).toHaveBeenCalledWith(
      { contact: 'sam@example.com' },
      {
        sourceIp: '203.0.113.10',
        baseUrl: 'https://frontend.example.com',
      },
    );
  });

  it('fails closed for recovery links when the canonical frontend URL is missing', async () => {
    vi.stubEnv('FRONTEND_BASE_URL', '');
    const requestRsvpRecovery = vi.fn(async () => acceptedRecoveryResponse);
    const service = createServiceDouble({ requestRsvpRecovery });

    const response = await handleRequest(
      service,
      createEvent('/api/rsvp/recovery', 'POST', { contact: 'sam@example.com' }),
    );

    const httpResponse = response as Exclude<typeof response, string>;
    expect(httpResponse.statusCode).toBe(503);
    expect(JSON.parse(httpResponse.body as string)).toMatchObject({
      message:
        'FRONTEND_BASE_URL must be configured before generating recovery or invitation links',
    });
    expect(requestRsvpRecovery).not.toHaveBeenCalled();
  });

  it('passes phone recovery requests through with request context', async () => {
    const requestRsvpRecovery = vi.fn(async () => acceptedRecoveryResponse);
    const service = createServiceDouble({ requestRsvpRecovery });

    const response = await handleRequest(
      service,
      createEvent('/api/rsvp/recovery', 'POST', {
        contact: '(480) 555-0100',
        smsConsentAccepted: true,
      }),
    );

    const httpResponse = response as Exclude<typeof response, string>;
    expect(httpResponse.statusCode).toBe(202);
    expect(requestRsvpRecovery).toHaveBeenCalledWith(
      {
        contact: '(480) 555-0100',
        smsConsentAccepted: true,
      },
      {
        sourceIp: '203.0.113.10',
        baseUrl: 'https://frontend.example.com',
      },
    );
  });

  it('passes RSVP SMS consent fields through on update requests', async () => {
    const updateRsvp = vi.fn(async () => ({
      household: {
        householdId: 'h1',
        displayName: 'Test Household',
        members: [
          {
            id: 'h1-1',
            firstName: 'Sam',
            lastName: 'Example',
            canBringPlusOne: false,
          },
        ],
        maxPlusOnes: 0,
        rsvpStatus: 'not_started' as const,
        inviteLifecycleStatus: 'generated' as const,
        createdAt: '2026-07-03T20:00:00.000Z',
        updatedAt: '2026-07-03T20:00:00.000Z',
      },
      rsvp: {
        members: [
          {
            memberId: 'h1-1',
            attending: true,
            mealChoice: 'buffet' as const,
            dietaryNotes: '',
          },
        ],
        plusOnes: [],
        notes: '',
        accessibilityNotes: '',
        updatedAt: '2026-07-03T20:00:00.000Z',
        submittedAt: '2026-07-03T20:00:00.000Z',
      },
    }));
    const service = createServiceDouble({ updateRsvp });

    const response = await handleRequest(
      service,
      createEvent('/api/rsvp/A2B3C4D5E6', 'PUT', {
        members: [
          { memberId: 'h1-1', attending: true, mealChoice: 'buffet' },
        ],
        plusOnes: [],
        smsPhone: '(480) 555-0100',
        smsConsentAccepted: true,
      }),
    );

    const httpResponse = response as Exclude<typeof response, string>;
    expect(httpResponse.statusCode).toBe(200);
    expect(updateRsvp).toHaveBeenCalledWith('A2B3C4D5E6', {
      members: [{ memberId: 'h1-1', attending: true, mealChoice: 'buffet' }],
      plusOnes: [],
      smsPhone: '(480) 555-0100',
      smsConsentAccepted: true,
    });
    const logs = parseConsoleJson(consoleLog);
    expect(logs).toContainEqual(
      expect.objectContaining({
        level: 'info',
        event: 'api.request.completed',
        routeName: 'PUT /rsvp/{inviteCode}',
        method: 'PUT',
        statusCode: 200,
        isAdminRoute: false,
      }),
    );
    expect(JSON.stringify(logs)).not.toContain('A2B3C4D5E6');
    expect(JSON.stringify(logs)).not.toContain('(480) 555-0100');
    expect(JSON.stringify(logs)).not.toContain('203.0.113.10');
  });

  it('logs public request errors without raw request details', async () => {
    vi.stubEnv('FRONTEND_BASE_URL', '');
    const requestRsvpRecovery = vi.fn(async () => acceptedRecoveryResponse);
    const service = createServiceDouble({ requestRsvpRecovery });

    const response = await handleRequest(
      service,
      createEvent('/api/rsvp/recovery', 'POST', {
        contact: 'guest@example.com',
      }),
    );

    const httpResponse = response as Exclude<typeof response, string>;
    expect(httpResponse.statusCode).toBe(503);
    const logs = parseConsoleJson(consoleLog);
    expect(logs).toContainEqual(
      expect.objectContaining({
        level: 'warn',
        event: 'api.request.publicError',
        routeName: 'POST /rsvp/recovery',
        statusCode: 503,
      }),
    );
    expect(JSON.stringify(logs)).not.toContain('guest@example.com');
    expect(JSON.stringify(logs)).not.toContain('203.0.113.10');
  });

  it('logs internal request errors with redacted error details', async () => {
    const getRsvp = vi.fn(async () => {
      throw new Error(
        'Database failed for guest@example.com and https://wedding.example.com/rsvp/A2B3C4D5E6',
      );
    });
    const service = createServiceDouble({ getRsvp });

    const response = await handleRequest(
      service,
      createEvent('/api/rsvp/A2B3C4D5E6', 'GET'),
    );

    const httpResponse = response as Exclude<typeof response, string>;
    expect(httpResponse.statusCode).toBe(500);
    const errorLogs = parseConsoleJson(consoleError);
    expect(errorLogs).toContainEqual(
      expect.objectContaining({
        level: 'error',
        event: 'api.request.failed',
        routeName: 'GET /rsvp/{inviteCode}',
        statusCode: 500,
        errorName: 'Error',
      }),
    );
    const serialized = JSON.stringify(errorLogs);
    expect(serialized).toContain('errorStack');
    expect(serialized).not.toContain('guest@example.com');
    expect(serialized).not.toContain('/rsvp/A2B3C4D5E6');
  });

  it('returns the same generic accepted shape for no-match recovery requests', async () => {
    const service = createServiceDouble({
      requestRsvpRecovery: vi.fn(async () => acceptedRecoveryResponse),
    });

    const response = await handleRequest(
      service,
      createEvent('/api/rsvp/recovery', 'POST', { contact: 'nomatch@example.com' }),
    );

    const httpResponse = response as Exclude<typeof response, string>;
    expect(httpResponse.statusCode).toBe(202);
    expect(JSON.parse(httpResponse.body as string)).toHaveProperty('accepted', true);
  });

  it('uses the configured frontend URL instead of the request origin for invitation exports', async () => {
    const exportInvitations = vi.fn(async () => 'csv-content');
    const service = createServiceDouble({ exportInvitations });

    const response = await handleRequest(
      service,
      createEvent('/api/admin/invitations/export', 'GET'),
    );

    const httpResponse = response as Exclude<typeof response, string>;
    expect(httpResponse.statusCode).toBe(200);
    expect(httpResponse.body).toBe('csv-content');
    expect(exportInvitations).toHaveBeenCalledWith('https://frontend.example.com');
  });

  it('fails closed for invitation exports when the canonical frontend URL is missing', async () => {
    vi.stubEnv('FRONTEND_BASE_URL', '');
    const exportInvitations = vi.fn(async () => 'csv-content');
    const service = createServiceDouble({ exportInvitations });

    const response = await handleRequest(
      service,
      createEvent('/api/admin/invitations/export', 'GET'),
    );

    const httpResponse = response as Exclude<typeof response, string>;
    expect(httpResponse.statusCode).toBe(503);
    expect(JSON.parse(httpResponse.body as string)).toMatchObject({
      message:
        'FRONTEND_BASE_URL must be configured before generating recovery or invitation links',
    });
    expect(exportInvitations).not.toHaveBeenCalled();
  });

  it('uses the configured frontend URL instead of the request origin for invitation emails', async () => {
    const sendInvitationEmail = vi.fn(async () => ({
      result: {
        householdId: 'household-1',
        displayName: 'Test Household',
        status: 'sent' as const,
        deliveredTo: 'sam@example.com',
        message: 'Sent',
      },
    }));
    const service = createServiceDouble({ sendInvitationEmail });

    const response = await handleRequest(
      service,
      createEvent('/api/admin/households/household-1/invitation-email', 'POST'),
    );

    const httpResponse = response as Exclude<typeof response, string>;
    expect(httpResponse.statusCode).toBe(200);
    expect(sendInvitationEmail).toHaveBeenCalledWith(
      'household-1',
      'https://frontend.example.com',
    );
  });

  it('fails closed for invitation emails when the canonical frontend URL is missing', async () => {
    vi.stubEnv('FRONTEND_BASE_URL', '');
    const sendInvitationEmail = vi.fn(async () => ({
      result: {
        householdId: 'household-1',
        displayName: 'Test Household',
        status: 'sent' as const,
        deliveredTo: 'sam@example.com',
        message: 'Sent',
      },
    }));
    const service = createServiceDouble({ sendInvitationEmail });

    const response = await handleRequest(
      service,
      createEvent('/api/admin/households/household-1/invitation-email', 'POST'),
    );

    const httpResponse = response as Exclude<typeof response, string>;
    expect(httpResponse.statusCode).toBe(503);
    expect(JSON.parse(httpResponse.body as string)).toMatchObject({
      message:
        'FRONTEND_BASE_URL must be configured before generating recovery or invitation links',
    });
    expect(sendInvitationEmail).not.toHaveBeenCalled();
  });

  it('returns invitation QR labels as a base64 PDF download', async () => {
    const exportInvitationLabels = vi.fn(async () => Buffer.from('%PDF-labels'));
    const service = createServiceDouble({ exportInvitationLabels });

    const response = await handleRequest(
      service,
      createEvent('/api/admin/invitations/labels', 'GET'),
    );

    const httpResponse = response as Exclude<typeof response, string>;
    expect(httpResponse.statusCode).toBe(200);
    expect(httpResponse.isBase64Encoded).toBe(true);
    expect(httpResponse.headers).toMatchObject({
      'content-type': 'application/pdf',
      'content-disposition': 'attachment; filename="invitation-qr-labels-avery-5160.pdf"',
      'cache-control': 'no-store',
    });
    expect(Buffer.from(httpResponse.body as string, 'base64').toString('utf8')).toBe('%PDF-labels');
    expect(exportInvitationLabels).toHaveBeenCalledWith('https://frontend.example.com');
  });
});

function createEvent(
  rawPath: string,
  method: string,
  body?: unknown,
): APIGatewayProxyEventV2 {
  return {
    version: '2.0',
    routeKey: '$default',
    rawPath,
    rawQueryString: '',
    headers: {
      origin: 'https://attacker.example.com',
    },
    requestContext: {
      accountId: '123456789012',
      apiId: 'api-id',
      domainName: 'example.com',
      domainPrefix: 'example',
      http: {
        method,
        path: rawPath,
        protocol: 'HTTP/1.1',
        sourceIp: '203.0.113.10',
        userAgent: 'vitest',
      },
      requestId: 'request-id',
      routeKey: '$default',
      stage: '$default',
      time: '27/Jun/2026:00:00:00 +0000',
      timeEpoch: 0,
    },
    isBase64Encoded: false,
    body: body ? JSON.stringify(body) : undefined,
  } as APIGatewayProxyEventV2;
}

function createServiceDouble(
  overrides: Partial<Parameters<typeof handleRequest>[0]> = {},
): Parameters<typeof handleRequest>[0] {
  const notUsed = vi.fn(async () => {
    throw new Error('Not implemented in this test');
  });

  return {
    archiveHousehold: notUsed,
    createHousehold: notUsed,
    exportInvitationLabels: notUsed,
    exportInvitations: notUsed,
    exportRsvps: notUsed,
    getRsvp: notUsed,
    importHouseholds: notUsed,
    listHouseholds: notUsed,
    requestRsvpRecovery: notUsed,
    revealInvitation: notUsed,
    rotateInviteCode: notUsed,
    sendHouseholdNotification: notUsed,
    sendInvitationEmail: notUsed,
    sendInvitationEmails: notUsed,
    updateHousehold: notUsed,
    updateHouseholdMember: notUsed,
    updateInviteLifecycle: notUsed,
    updateRsvp: notUsed,
    removeHouseholdMember: notUsed,
    ...overrides,
  };
}

function parseConsoleJson(spy: ReturnType<typeof vi.spyOn>): Array<Record<string, unknown>> {
  return spy.mock.calls.map((call: unknown[]) => JSON.parse(call[0] as string));
}
