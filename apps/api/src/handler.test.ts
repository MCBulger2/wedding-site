import { describe, expect, it, vi } from 'vitest';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { handleRequest } from './handler.js';
import { PublicError } from './service.js';

const acceptedRecoveryResponse = {
  accepted: true as const,
  message: "If that matches our guest list, we'll send your private RSVP link.",
};

describe('handleRequest', () => {
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

  it('passes phone recovery requests through with request context', async () => {
    const requestRsvpRecovery = vi.fn(async () => acceptedRecoveryResponse);
    const service = createServiceDouble({ requestRsvpRecovery });

    const response = await handleRequest(
      service,
      createEvent('/api/rsvp/recovery', 'POST', { contact: '(480) 555-0100' }),
    );

    const httpResponse = response as Exclude<typeof response, string>;
    expect(httpResponse.statusCode).toBe(202);
    expect(requestRsvpRecovery).toHaveBeenCalledOnce();
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
      origin: 'https://frontend.example.com',
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
