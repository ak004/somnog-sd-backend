import { randomBytes } from 'node:crypto';

// No 0/O/1/I - these codes get read aloud and typed at a registration desk.
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

/** e.g. SOMNOG-7K3F-QP92 */
export function generateTicketCode(prefix = 'SOMNOG'): string {
  const bytes = randomBytes(8);
  const chars = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]);
  return `${prefix}-${chars.slice(0, 4).join('')}-${chars.slice(4, 8).join('')}`;
}

/** Opaque, URL-safe token for email verification and password reset. */
export function generateOpaqueToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}
