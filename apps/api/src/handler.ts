import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import type { APIGatewayProxyHandlerV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { DynamoWeddingRepository } from './repository.js';
import {
  createHouseholdMessengerFromEnvironment,
  createNotifierFromEnvironment,
} from './notifications.js';
import { createInviteCodeProtectorFromEnvironment } from './inviteCodeProtector.js';
import { PublicError, WeddingService } from './service.js';

const secrets = new SecretsManagerClient({});
let cachedPepper: string | undefined;

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const service = await createService();
    return handleRequest(service, event);
  } catch (error) {
    if (error instanceof PublicError) {
      return json({ message: error.message, details: error.details }, error.statusCode);
    }

    console.error(error);
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
    | 'removeHouseholdMember'
  >,
  event: Parameters<APIGatewayProxyHandlerV2>[0],
): Promise<APIGatewayProxyResultV2> {
  try {
    const method = event.requestContext.http.method;
    const path = normalizePath(event.rawPath);
    const body = parseBody(event.body);

    if (method === 'GET' && path.startsWith('/rsvp/')) {
      const inviteCode = decodeURIComponent(path.slice('/rsvp/'.length));
      return json(await service.getRsvp(inviteCode));
    }

    if (method === 'GET' && path === '/admin/auth/config') {
      const clientId = process.env.ADMIN_COGNITO_CLIENT_ID;
      const userPoolDomain = process.env.ADMIN_COGNITO_DOMAIN;
      if (!clientId || !userPoolDomain) {
        return json({ message: 'Admin authentication is not configured' }, 503);
      }

      return json({
        clientId,
        userPoolDomain,
        scopes: ['openid', 'email', 'profile'],
      });
    }

    if (method === 'PUT' && path.startsWith('/rsvp/')) {
      const inviteCode = decodeURIComponent(path.slice('/rsvp/'.length));
      return json(await service.updateRsvp(inviteCode, body));
    }

    if (method === 'POST' && path === '/rsvp/recovery') {
      return json(
        await service.requestRsvpRecovery(body, {
          sourceIp: event.requestContext.http.sourceIp,
          baseUrl: frontendBaseUrl(),
        }),
        202,
      );
    }

    if (method === 'GET' && path === '/admin/households') {
      return json({ households: await service.listHouseholds() });
    }

    if (method === 'POST' && path === '/admin/households') {
      return json({ household: await service.createHousehold(body) }, 201);
    }

    if (method === 'POST' && path === '/admin/households/import') {
      return json(await service.importHouseholds(String(body?.csv ?? '')));
    }

    const householdMatch = path.match(/^\/admin\/households\/([^/]+)$/);
    if (method === 'PUT' && householdMatch) {
      return json({ household: await service.updateHousehold(decodeURIComponent(householdMatch[1]), body) });
    }

    if (method === 'DELETE' && householdMatch) {
      return json({ household: await service.archiveHousehold(decodeURIComponent(householdMatch[1])) });
    }

    const memberMatch = path.match(/^\/admin\/households\/([^/]+)\/members\/([^/]+)$/);
    if (method === 'PUT' && memberMatch) {
      return json({
        household: await service.updateHouseholdMember(
          decodeURIComponent(memberMatch[1]),
          decodeURIComponent(memberMatch[2]),
          body,
        ),
      });
    }

    if (method === 'DELETE' && memberMatch) {
      return json({
        household: await service.removeHouseholdMember(
          decodeURIComponent(memberMatch[1]),
          decodeURIComponent(memberMatch[2]),
        ),
      });
    }

    const inviteLifecycleMatch = path.match(/^\/admin\/households\/([^/]+)\/invite-lifecycle$/);
    if (method === 'PUT' && inviteLifecycleMatch) {
      return json({
        household: await service.updateInviteLifecycle(decodeURIComponent(inviteLifecycleMatch[1]), body),
      });
    }

    const inviteCodeMatch = path.match(/^\/admin\/households\/([^/]+)\/invite-code$/);
    if (method === 'POST' && inviteCodeMatch) {
      return json(
        await service.rotateInviteCode(decodeURIComponent(inviteCodeMatch[1]), {
          confirmRotation: body?.confirmRotation === true,
        }),
      );
    }

    const invitationMatch = path.match(/^\/admin\/households\/([^/]+)\/invitation$/);
    if (method === 'GET' && invitationMatch) {
      return json(
        await service.revealInvitation(
          decodeURIComponent(invitationMatch[1]),
          frontendBaseUrl(),
        ),
      );
    }

    const invitationEmailMatch = path.match(/^\/admin\/households\/([^/]+)\/invitation-email$/);
    if (method === 'POST' && invitationEmailMatch) {
      return json(
        await service.sendInvitationEmail(
          decodeURIComponent(invitationEmailMatch[1]),
          frontendBaseUrl(),
        ),
      );
    }

    const householdNotificationMatch = path.match(/^\/admin\/households\/([^/]+)\/notifications$/);
    if (method === 'POST' && householdNotificationMatch) {
      return json(
        await service.sendHouseholdNotification(
          decodeURIComponent(householdNotificationMatch[1]),
          body,
        ),
      );
    }

    if (method === 'POST' && path === '/admin/invitations/email') {
      return json(await service.sendInvitationEmails(frontendBaseUrl()));
    }

    if (method === 'GET' && path === '/admin/rsvps/export') {
      return {
        statusCode: 200,
        headers: {
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition': 'attachment; filename="rsvps.csv"',
        },
        body: await service.exportRsvps(),
      };
    }

    if (method === 'GET' && path === '/admin/invitations/export') {
      return {
        statusCode: 200,
        headers: {
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition': 'attachment; filename="invitations.csv"',
        },
        body: await service.exportInvitations(frontendBaseUrl()),
      };
    }

    if (method === 'GET' && path === '/admin/invitations/labels') {
      const pdf = await service.exportInvitationLabels(frontendBaseUrl());
      return {
        statusCode: 200,
        headers: {
          'content-type': 'application/pdf',
          'content-disposition': 'attachment; filename="invitation-qr-labels-avery-5160.pdf"',
          'cache-control': 'no-store',
        },
        isBase64Encoded: true,
        body: pdf.toString('base64'),
      };
    }

    return json({ message: 'Not found' }, 404);
  } catch (error) {
    if (error instanceof PublicError) {
      return json({ message: error.message, details: error.details }, error.statusCode);
    }

    console.error(error);
    return json({ message: 'Something went wrong' }, 500);
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
