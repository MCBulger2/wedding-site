import { afterEach, describe, expect, it, vi } from 'vitest';
import { describeError, logStructured } from './logger.js';

describe('structured logger', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('writes valid JSON and redacts sensitive string values', () => {
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    const inviteCodeHash =
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

    logStructured({
      level: 'info',
      event: 'test.redaction',
      message:
        `Email guest@example.com phone +14805550100 url https://wedding.example.com/rsvp/ABCDEF234567 hash ${inviteCodeHash}`,
      routeName: 'GET /rsvp/{inviteCode}',
      householdId: 'household-1',
      outcome: 'success',
    });

    expect(consoleLog).toHaveBeenCalledTimes(1);
    const line = consoleLog.mock.calls[0][0] as string;
    const parsed = JSON.parse(line);
    expect(parsed).toMatchObject({
      level: 'info',
      event: 'test.redaction',
      routeName: 'GET /rsvp/{inviteCode}',
      householdId: 'household-1',
      outcome: 'success',
    });
    expect(line).not.toContain('guest@example.com');
    expect(line).not.toContain('+14805550100');
    expect(line).not.toContain('https://wedding.example.com/rsvp/ABCDEF234567');
    expect(line).not.toContain(inviteCodeHash);
  });

  it('describes errors with redacted message and stack', () => {
    const error = new Error(
      'Failed for guest@example.com at https://wedding.example.com/rsvp/ABCDEF234567',
    );

    const described = describeError(error);

    expect(described.errorName).toBe('Error');
    expect(described.errorMessage).not.toContain('guest@example.com');
    expect(described.errorMessage).not.toContain('/rsvp/ABCDEF234567');
    expect(described.errorStack).toContain('Error: Failed for');
    expect(described.errorStack).not.toContain('guest@example.com');
    expect(described.errorStack).not.toContain('/rsvp/ABCDEF234567');
  });

  it('redacts RSVP URLs without a backtracking-prone URL regex', () => {
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    const repeatedUrlPrefix = 'http://'.repeat(200);

    logStructured({
      level: 'info',
      event: 'test.rsvpUrlRedaction',
      message: `${repeatedUrlPrefix} HTTPS://wedding.example.com/RSVP/A2B3C4D5E6 next`,
    });

    const line = consoleLog.mock.calls[0][0] as string;
    expect(line).toContain('[redacted-rsvp-url]');
    expect(line).not.toContain('HTTPS://wedding.example.com/RSVP/A2B3C4D5E6');
  });
});
