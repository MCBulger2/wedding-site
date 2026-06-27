const sessionStorageKeys = {
  codeVerifier: 'adminAuth.codeVerifier',
  state: 'adminAuth.state',
};

const localStorageKey = 'adminAuth.session';

export interface AdminAuthConfig {
  clientId: string;
  userPoolDomain: string;
  scopes: string[];
}

export interface AdminSession {
  accessToken: string;
  idToken: string;
  expiresAt: number;
}

interface TokenResponse {
  access_token: string;
  id_token: string;
  expires_in: number;
  token_type: string;
}

export function loadAdminSession(): AdminSession | undefined {
  const raw = window.localStorage.getItem(localStorageKey);
  if (!raw) {
    return undefined;
  }

  try {
    const session = JSON.parse(raw) as unknown;
    if (!isAdminSession(session)) {
      clearAdminSession();
      return undefined;
    }

    if (session.expiresAt > Date.now()) {
      return session;
    }

    clearAdminSession();
    return undefined;
  } catch {
    clearAdminSession();
    return undefined;
  }
}

export function clearAdminSession(): void {
  window.localStorage.removeItem(localStorageKey);
}

export async function beginAdminLogin(config: AdminAuthConfig): Promise<void> {
  const codeVerifier = createPkceVerifier();
  const state = createRandomString(32);
  const codeChallenge = await createCodeChallenge(codeVerifier);

  window.sessionStorage.setItem(sessionStorageKeys.codeVerifier, codeVerifier);
  window.sessionStorage.setItem(sessionStorageKeys.state, state);

  const redirectUri = getAdminRedirectUri();
  const authorizeUrl = new URL('/oauth2/authorize', config.userPoolDomain);
  authorizeUrl.searchParams.set('client_id', config.clientId);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('scope', config.scopes.join(' '));
  authorizeUrl.searchParams.set('redirect_uri', redirectUri);
  authorizeUrl.searchParams.set('state', state);
  authorizeUrl.searchParams.set('code_challenge_method', 'S256');
  authorizeUrl.searchParams.set('code_challenge', codeChallenge);

  window.location.assign(authorizeUrl.toString());
}

export async function completeAdminLogin(
  config: AdminAuthConfig,
  location: Location,
): Promise<AdminSession | undefined> {
  const url = new URL(location.href);
  const error = url.searchParams.get('error');
  if (error) {
    const description = url.searchParams.get('error_description') ?? error;
    cleanupCallbackParams(url);
    throw new Error(description.replaceAll('+', ' '));
  }

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code || !state) {
    return undefined;
  }

  const expectedState = window.sessionStorage.getItem(sessionStorageKeys.state);
  const codeVerifier = window.sessionStorage.getItem(
    sessionStorageKeys.codeVerifier,
  );
  if (!expectedState || !codeVerifier || expectedState !== state) {
    cleanupCallbackParams(url);
    throw new Error(
      'The admin sign-in session could not be verified. Please try again.',
    );
  }

  const tokenUrl = new URL('/oauth2/token', config.userPoolDomain);
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: config.clientId,
      code,
      redirect_uri: getAdminRedirectUri(),
      code_verifier: codeVerifier,
    }),
  });

  if (!response.ok) {
    throw new Error('Unable to complete admin sign-in.');
  }

  const tokens = (await response.json()) as TokenResponse;
  if (!tokens.access_token || !tokens.id_token || !tokens.expires_in) {
    throw new Error('Admin sign-in returned an incomplete token response.');
  }

  const session: AdminSession = {
    accessToken: tokens.access_token,
    idToken: tokens.id_token,
    expiresAt: Date.now() + tokens.expires_in * 1000,
  };

  window.localStorage.setItem(localStorageKey, JSON.stringify(session));
  window.sessionStorage.removeItem(sessionStorageKeys.state);
  window.sessionStorage.removeItem(sessionStorageKeys.codeVerifier);
  cleanupCallbackParams(url);
  return session;
}

export function beginAdminLogout(config: AdminAuthConfig): void {
  clearAdminSession();

  const logoutUrl = new URL('/logout', config.userPoolDomain);
  logoutUrl.searchParams.set('client_id', config.clientId);
  logoutUrl.searchParams.set('logout_uri', getAdminRedirectUri());

  window.location.assign(logoutUrl.toString());
}

export function getAdminProfileName(
  session: AdminSession | undefined,
): string | undefined {
  if (!session) {
    return undefined;
  }

  const payload = parseJwtPayload(session.idToken);
  if (!isRecord(payload)) {
    return undefined;
  }

  return (
    optionalString(payload.email) ??
    optionalString(payload.name) ??
    optionalString(payload['cognito:username'])
  );
}

function isAdminSession(value: unknown): value is AdminSession {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.accessToken === 'string' &&
    value.accessToken.length > 0 &&
    typeof value.idToken === 'string' &&
    value.idToken.length > 0 &&
    typeof value.expiresAt === 'number' &&
    Number.isFinite(value.expiresAt) &&
    isRecord(parseJwtPayload(value.idToken))
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function cleanupCallbackParams(url: URL): void {
  url.searchParams.delete('code');
  url.searchParams.delete('state');
  url.searchParams.delete('error');
  url.searchParams.delete('error_description');
  window.history.replaceState(
    {},
    document.title,
    `${url.pathname}${url.search}${url.hash}`,
  );
}

function getAdminRedirectUri(): string {
  return `${window.location.origin}/admin`;
}

function createPkceVerifier(): string {
  return createRandomString(64);
}

function createRandomString(length: number): string {
  const alphabet =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let value = '';

  while (value.length < length) {
    const remaining = length - value.length;
    const bytes = crypto.getRandomValues(
      new Uint8Array(Math.max(remaining * 4, 32)),
    );
    for (const byte of bytes) {
      if (byte >= alphabet.length) {
        continue;
      }

      value += alphabet[byte];
      if (value.length === length) {
        break;
      }
    }
  }

  return value;
}

async function createCodeChallenge(codeVerifier: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(codeVerifier),
  );
  return base64UrlEncode(new Uint8Array(digest));
}

function parseJwtPayload(token: string): unknown {
  const [, payload] = token.split('.');
  if (!payload) {
    return undefined;
  }

  try {
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    return JSON.parse(window.atob(padded));
  } catch {
    return undefined;
  }
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return window
    .btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}
