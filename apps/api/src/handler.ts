import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import type { APIGatewayProxyHandlerV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { DynamoWeddingRepository } from './repository.js';
import {
  createHouseholdMessengerFromEnvironment,
  createNotifierFromEnvironment,
} from './notifications.js';
import { createInviteCodeProtectorFromEnvironment } from './inviteCodeProtector.js';
import { PublicError, WeddingService } from './service.js';
import { describeError, logStructured } from './logger.js';

const secrets = new SecretsManagerClient({});
let cachedPepper: string | undefined;

export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {
  const requestContext = buildRequestLogContext(event, context);
  const startedAt = Date.now();
  logStructured({
    level: 'info',
    event: 'api.request.started',
    message: 'API request started',
    ...requestContext,
  });

  try {
    const service = await createService();
    return await handleRequest(
      service,
      event,
      context,
      requestContext,
      startedAt,
      true,
    );
  } catch (error) {
    if (error instanceof PublicError) {
      const response = json({ message: error.message, details: error.details }, error.statusCode);
      logStructured({
        level: 'warn',
        event: 'api.request.publicError',
        message: 'API request rejected',
        statusCode: error.statusCode,
        latencyMs: Date.now() - startedAt,
        ...requestContext,
        ...describeError(error),
      });
      return response;
    }

    logStructured({
      level: 'error',
      event: 'api.request.failed',
      message: 'API request failed',
      statusCode: 500,
      latencyMs: Date.now() - startedAt,
      ...requestContext,
      ...describeError(error),
    });
    return json({ message: 'Something went wrong' }, 500);
  }
};

export async function handleRequest(
  service: Pick<
    WeddingService,
    | 'archiveHousehold'
    | 'createHousehold'
    | 'exportInvitations'
    | 'exportInvitationLabels'
    | 'exportRsvps'
    | 'getRsvp'
    | 'importHouseholds'
    | 'listHouseholds'
    | 'requestRsvpRecovery'
    | 'revealInvitation'
    | 'rotateInviteCode'
    | 'sendHouseholdNotification'
    | 'sendInvitationEmail'
    | 'sendInvitationEmails'
    | 'updateHousehold'
    | 'updateHouseholdMember'
    | 'updateInviteLifecycle'
    | 'updateRsvp'
    | 'updateSmsPreferences'
    | 'removeHouseholdMember'
  >,
  event: Parameters<APIGatewayProxyHandlerV2>[0],
  context?: Parameters<APIGatewayProxyHandlerV2>[1],
  requestLogContext = buildRequestLogContext(event, context),
  startedAt = Date.now(),
  requestStartedLogged = false,
): Promise<APIGatewayProxyResultV2> {
  if (!requestStartedLogged) {
    logStructured({
      level: 'info',
      event: 'api.request.started',
      message: 'API request started',
      ...requestLogContext,
    });
  }

  try {
    const method = event.requestContext.http.method;
    const path = normalizePath(event.rawPath);
    const body = parseBody(event.body);

    const smsPreferencesMatch = path.match(/^\/rsvp\/([^/]+)\/sms-preferences$/);
    if (method === 'PUT' && smsPreferencesMatch) {
      return completeRequest(
        json(
          await service.updateSmsPreferences(
            decodeURIComponent(smsPreferencesMatch[1]),
            body,
          ),
        ),
      );
    }

    if (method === 'GET' && path.startsWith('/rsvp/')) {
      const inviteCode = decodeURIComponent(path.slice('/rsvp/'.length));
      return completeRequest(json(await service.getRsvp(inviteCode)));
    }

    if (method === 'GET' && path === '/admin/auth/config') {
      const clientId = process.env.ADMIN_COGNITO_CLIENT_ID;
      const userPoolDomain = process.env.ADMIN_COGNITO_DOMAIN;
      if (!clientId || !userPoolDomain) {
        return completeRequest(
          json({ message: 'Admin authentication is not configured' }, 503),
        );
      }

      return completeRequest(json({
        clientId,
        userPoolDomain,
        scopes: ['openid', 'email', 'profile'],
      }));
    }

    if (method === 'PUT' && path.startsWith('/rsvp/')) {
      const inviteCode = decodeURIComponent(path.slice('/rsvp/'.length));
      return completeRequest(json(await service.updateRsvp(inviteCode, body)));
    }

    if (method === 'POST' && path === '/rsvp/recovery') {
      return completeRequest(
        json(
          await service.requestRsvpRecovery(body, {
            sourceIp: event.requestContext.http.sourceIp,
            baseUrl: frontendBaseUrl(),
          }),
          202,
        ),
      );
    }

    if (method === 'GET' && path === '/admin/households') {
      return completeRequest(json({ households: await service.listHouseholds() }));
    }

    if (method === 'POST' && path === '/admin/households') {
      return completeRequest(json({ household: await service.createHousehold(body) }, 201));
    }

    if (method === 'POST' && path === '/admin/households/import') {
      return completeRequest(json(await service.importHouseholds(String(body?.csv ?? ''))));
    }

    const householdMatch = path.match(/^\/admin\/households\/([^/]+)$/);
    if (method === 'PUT' && householdMatch) {
      return completeRequest(
        json({ household: await service.updateHousehold(decodeURIComponent(householdMatch[1]), body) }),
      );
    }

    if (method === 'DELETE' && householdMatch) {
      return completeRequest(
        json({ household: await service.archiveHousehold(decodeURIComponent(householdMatch[1])) }),
      );
    }

    const memberMatch = path.match(/^\/admin\/households\/([^/]+)\/members\/([^/]+)$/);
    if (method === 'PUT' && memberMatch) {
      return completeRequest(
        json({
          household: await service.updateHouseholdMember(
            decodeURIComponent(memberMatch[1]),
            decodeURIComponent(memberMatch[2]),
            body,
          ),
        }),
      );
    }

    if (method === 'DELETE' && memberMatch) {
      return completeRequest(
        json({
          household: await service.removeHouseholdMember(
            decodeURIComponent(memberMatch[1]),
            decodeURIComponent(memberMatch[2]),
          ),
        }),
      );
    }

    const inviteLifecycleMatch = path.match(/^\/admin\/households\/([^/]+)\/invite-lifecycle$/);
    if (method === 'PUT' && inviteLifecycleMatch) {
      return completeRequest(
        json({
          household: await service.updateInviteLifecycle(decodeURIComponent(inviteLifecycleMatch[1]), body),
        }),
      );
    }

    const inviteCodeMatch = path.match(/^\/admin\/households\/([^/]+)\/invite-code$/);
    if (method === 'POST' && inviteCodeMatch) {
      return completeRequest(
        json(
          await service.rotateInviteCode(decodeURIComponent(inviteCodeMatch[1]), {
            confirmRotation: body?.confirmRotation === true,
          }),
        ),
      );
    }

    const invitationMatch = path.match(/^\/admin\/households\/([^/]+)\/invitation$/);
    if (method === 'GET' && invitationMatch) {
      return completeRequest(
        json(
          await service.revealInvitation(
            decodeURIComponent(invitationMatch[1]),
            frontendBaseUrl(),
          ),
        ),
      );
    }

    const invitationEmailMatch = path.match(/^\/admin\/households\/([^/]+)\/invitation-email$/);
    if (method === 'POST' && invitationEmailMatch) {
      return completeRequest(
        json(
          await service.sendInvitationEmail(
            decodeURIComponent(invitationEmailMatch[1]),
            frontendBaseUrl(),
          ),
        ),
      );
    }

    const householdNotificationMatch = path.match(/^\/admin\/households\/([^/]+)\/notifications$/);
    if (method === 'POST' && householdNotificationMatch) {
      return completeRequest(
        json(
          await service.sendHouseholdNotification(
            decodeURIComponent(householdNotificationMatch[1]),
            body,
          ),
        ),
      );
    }

    if (method === 'POST' && path === '/admin/invitations/email') {
      return completeRequest(json(await service.sendInvitationEmails(frontendBaseUrl())));
    }

    if (method === 'GET' && path === '/admin/rsvps/export') {
      return completeRequest({
        statusCode: 200,
        headers: {
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition': 'attachment; filename="rsvps.csv"',
        },
        body: await service.exportRsvps(),
      });
    }

    if (method === 'GET' && path === '/admin/invitations/export') {
      return completeRequest({
        statusCode: 200,
        headers: {
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition': 'attachment; filename="invitations.csv"',
        },
        body: await service.exportInvitations(frontendBaseUrl()),
      });
    }

    if (method === 'GET' && path === '/admin/invitations/labels') {
      const pdf = await service.exportInvitationLabels(frontendBaseUrl());
      return completeRequest({
        statusCode: 200,
        headers: {
          'content-type': 'application/pdf',
          'content-disposition': 'attachment; filename="invitation-qr-labels-avery-5160.pdf"',
          'cache-control': 'no-store',
        },
        isBase64Encoded: true,
        body: pdf.toString('base64'),
      });
    }

    return completeRequest(json({ message: 'Not found' }, 404));
  } catch (error) {
    if (error instanceof PublicError) {
      const response = json({ message: error.message, details: error.details }, error.statusCode);
      logStructured({
        level: 'warn',
        event: 'api.request.publicError',
        message: 'API request rejected',
        statusCode: error.statusCode,
        latencyMs: Date.now() - startedAt,
        ...requestLogContext,
        ...describeError(error),
      });
      return response;
    }

    logStructured({
      level: 'error',
      event: 'api.request.failed',
      message: 'API request failed',
      statusCode: 500,
      latencyMs: Date.now() - startedAt,
      ...requestLogContext,
      ...describeError(error),
    });
    return json({ message: 'Something went wrong' }, 500);
  }

  function completeRequest(response: APIGatewayProxyResultV2): APIGatewayProxyResultV2 {
    const statusCode = typeof response === 'string' ? 200 : (response.statusCode ?? 200);
    logStructured({
      level: 'info',
      event: 'api.request.completed',
      message: 'API request completed',
      statusCode,
      latencyMs: Date.now() - startedAt,
      ...requestLogContext,
    });
    return response;
  }
}

function parseBody(body?: string): any {
  if (!body) {
    return undefined;
  }

  try {
    return JSON.parse(body);
  } catch {
    throw new PublicError('Request body must be valid JSON', 400);
  }
}

function json(body: unknown, statusCode = 200): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
    body: JSON.stringify(body),
  };
}

async function createService(): Promise<WeddingService> {
  const tableName = process.env.TABLE_NAME;
  if (!tableName) {
    throw new Error('TABLE_NAME is required');
  }

  const pepper = await getInviteCodePepper();
  return new WeddingService(
    new DynamoWeddingRepository(tableName),
    pepper,
    createNotifierFromEnvironment(),
    createHouseholdMessengerFromEnvironment(),
    createInviteCodeProtectorFromEnvironment(),
  );
}

async function getInviteCodePepper(): Promise<string> {
  if (cachedPepper) {
    return cachedPepper;
  }

  if (process.env.INVITE_CODE_PEPPER) {
    cachedPepper = process.env.INVITE_CODE_PEPPER;
    return cachedPepper;
  }

  const secretId = process.env.INVITE_CODE_PEPPER_SECRET_ARN;
  if (!secretId) {
    throw new Error('INVITE_CODE_PEPPER_SECRET_ARN is required');
  }

  const result = await secrets.send(new GetSecretValueCommand({ SecretId: secretId }));
  if (!result.SecretString) {
    throw new Error('Invite code pepper secret is empty');
  }

  cachedPepper = result.SecretString;
  return cachedPepper;
}

function normalizePath(rawPath: string): string {
  return rawPath.startsWith('/api/') ? rawPath.slice('/api'.length) : rawPath;
}

function firstPopulatedValue(...values: Array<string | undefined>): string | undefined {
  return values.map((value) => value?.trim()).find(Boolean);
}

function frontendBaseUrl(): string {
  const baseUrl = firstPopulatedValue(process.env.FRONTEND_BASE_URL);
  if (!baseUrl) {
    throw new PublicError(
      'FRONTEND_BASE_URL must be configured before generating recovery or invitation links',
      503,
    );
  }

  return baseUrl;
}

function buildRequestLogContext(
  event: Parameters<APIGatewayProxyHandlerV2>[0],
  context?: Parameters<APIGatewayProxyHandlerV2>[1],
): {
  requestId?: string;
  awsRequestId?: string;
  routeName: string;
  method: string;
  isAdminRoute: boolean;
} {
  const method = event.requestContext.http.method;
  const path = normalizePath(event.rawPath);
  return {
    requestId: event.requestContext.requestId,
    awsRequestId: context?.awsRequestId,
    routeName: resolveRouteName(method, path),
    method,
    isAdminRoute: path.startsWith('/admin/'),
  };
}

function resolveRouteName(method: string, path: string): string {
  if (method === 'PUT' && /^\/rsvp\/[^/]+\/sms-preferences$/.test(path)) {
    return 'PUT /rsvp/{inviteCode}/sms-preferences';
  }

  if (method === 'GET' && path.startsWith('/rsvp/')) {
    return 'GET /rsvp/{inviteCode}';
  }

  if (method === 'PUT' && path.startsWith('/rsvp/')) {
    return 'PUT /rsvp/{inviteCode}';
  }

  if (method === 'POST' && path === '/rsvp/recovery') {
    return 'POST /rsvp/recovery';
  }

  if (method === 'GET' && path === '/admin/auth/config') {
    return 'GET /admin/auth/config';
  }

  if (method === 'GET' && path === '/admin/households') {
    return 'GET /admin/households';
  }

  if (method === 'POST' && path === '/admin/households') {
    return 'POST /admin/households';
  }

  if (method === 'POST' && path === '/admin/households/import') {
    return 'POST /admin/households/import';
  }

  if (method === 'POST' && path === '/admin/invitations/email') {
    return 'POST /admin/invitations/email';
  }

  if (method === 'GET' && path === '/admin/rsvps/export') {
    return 'GET /admin/rsvps/export';
  }

  if (method === 'GET' && path === '/admin/invitations/export') {
    return 'GET /admin/invitations/export';
  }

  if (method === 'GET' && path === '/admin/invitations/labels') {
    return 'GET /admin/invitations/labels';
  }

  if (method === 'PUT' && /^\/admin\/households\/[^/]+$/.test(path)) {
    return 'PUT /admin/households/{householdId}';
  }

  if (method === 'DELETE' && /^\/admin\/households\/[^/]+$/.test(path)) {
    return 'DELETE /admin/households/{householdId}';
  }

  if (method === 'PUT' && /^\/admin\/households\/[^/]+\/members\/[^/]+$/.test(path)) {
    return 'PUT /admin/households/{householdId}/members/{memberId}';
  }

  if (method === 'DELETE' && /^\/admin\/households\/[^/]+\/members\/[^/]+$/.test(path)) {
    return 'DELETE /admin/households/{householdId}/members/{memberId}';
  }

  if (method === 'PUT' && /^\/admin\/households\/[^/]+\/invite-lifecycle$/.test(path)) {
    return 'PUT /admin/households/{householdId}/invite-lifecycle';
  }

  if (method === 'POST' && /^\/admin\/households\/[^/]+\/invite-code$/.test(path)) {
    return 'POST /admin/households/{householdId}/invite-code';
  }

  if (method === 'GET' && /^\/admin\/households\/[^/]+\/invitation$/.test(path)) {
    return 'GET /admin/households/{householdId}/invitation';
  }

  if (method === 'POST' && /^\/admin\/households\/[^/]+\/invitation-email$/.test(path)) {
    return 'POST /admin/households/{householdId}/invitation-email';
  }

  if (method === 'POST' && /^\/admin\/households\/[^/]+\/notifications$/.test(path)) {
    return 'POST /admin/households/{householdId}/notifications';
  }

  return `${method} unknown`;
}
