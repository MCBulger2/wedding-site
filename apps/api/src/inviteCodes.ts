import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export function generateInviteCode(byteLength = 24): string {
  return randomBytes(byteLength).toString('base64url');
}

export function hashInviteCode(inviteCode: string, pepper: string): string {
  return createHmac('sha256', pepper).update(inviteCode.trim()).digest('hex');
}

export function inviteHashesMatch(a: string, b: string): boolean {
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  return left.length === right.length && timingSafeEqual(left, right);
}
