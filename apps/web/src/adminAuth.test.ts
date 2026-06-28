// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { beginAdminLogin } from './adminAuth.js';

describe('admin auth', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...window.location,
        assign: vi.fn(),
        origin: 'https://wedding.example.com',
      },
    });
  });

  it('starts login with PKCE verifier and state values from the allowed alphabet', async () => {
    await beginAdminLogin({
      clientId: 'admin-client',
      userPoolDomain: 'https://auth.example.com',
      scopes: ['openid', 'email'],
    });

    const codeVerifier = window.sessionStorage.getItem(
      'adminAuth.codeVerifier',
    );
    const state = window.sessionStorage.getItem('adminAuth.state');
    expect(codeVerifier).toMatch(/^[A-Za-z0-9._~-]{64}$/);
    expect(state).toMatch(/^[A-Za-z0-9._~-]{32}$/);

    const [redirect] = vi.mocked(window.location.assign).mock.calls[0];
    const url = new URL(redirect);
    expect(url.origin).toBe('https://auth.example.com');
    expect(url.pathname).toBe('/oauth2/authorize');
    expect(url.searchParams.get('state')).toBe(state);
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('code_challenge')).toBeTruthy();
  });
});
