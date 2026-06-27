import { describe, expect, it } from 'vitest';
import {
  generateInviteCode,
  hashInviteCode,
  INVITE_CODE_ALPHABET,
  INVITE_CODE_LENGTH,
} from './inviteCodes.js';

describe('invite code utilities', () => {
  it('generates short manual-entry invite codes from the allowed alphabet', () => {
    for (let index = 0; index < 100; index += 1) {
      const inviteCode = generateInviteCode();

      expect(inviteCode).toHaveLength(INVITE_CODE_LENGTH);
      expect(
        [...inviteCode].every((character) =>
          INVITE_CODE_ALPHABET.includes(character),
        ),
      ).toBe(true);
    }
  });

  it('hashes invite codes case-insensitively for new codes', () => {
    const pepper = 'unit-test-pepper';

    expect(hashInviteCode('A2B3C4D5E6', pepper)).toBe(
      hashInviteCode('a2b3c4d5e6', pepper),
    );
  });
});
