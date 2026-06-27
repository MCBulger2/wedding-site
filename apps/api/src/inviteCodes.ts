import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';

export const INVITE_CODE_LENGTH = 10;
export const INVITE_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateInviteCode(length = INVITE_CODE_LENGTH): string {
  let code = '';
  for (let index = 0; index < length; index += 1) {
    code += INVITE_CODE_ALPHABET[randomInt(INVITE_CODE_ALPHABET.length)];
  }

  return code;
}

export function normalizeInviteCode(inviteCode: string): string {
  return inviteCode.trim().toUpperCase();
}

export function hashInviteCode(inviteCode: string, pepper: string): string {
  return createInviteCodeHash(normalizeInviteCode(inviteCode), pepper);
}

export function hashLegacyInviteCode(
  inviteCode: string,
  pepper: string,
): string {
  return createInviteCodeHash(inviteCode.trim(), pepper);
}

export function getInviteCodeHashes(
  inviteCode: string,
  pepper: string,
): string[] {
  return uniqueHashes([
    hashInviteCode(inviteCode, pepper),
    hashLegacyInviteCode(inviteCode, pepper),
  ]);
}

export function inviteCodeMatchesHash(
  inviteCode: string,
  inviteCodeHash: string,
  pepper: string,
): boolean {
  return getInviteCodeHashes(inviteCode, pepper).some((candidate) =>
    inviteHashesMatch(candidate, inviteCodeHash),
  );
}

export function inviteHashesMatch(a: string, b: string): boolean {
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  return left.length === right.length && timingSafeEqual(left, right);
}

function createInviteCodeHash(inviteCode: string, pepper: string): string {
  return createHmac('sha256', pepper).update(inviteCode).digest('hex');
}

function uniqueHashes(hashes: string[]): string[] {
  return [...new Set(hashes)];
}
