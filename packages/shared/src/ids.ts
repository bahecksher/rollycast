/**
 * Secure identifiers: room codes, entity ids, and session/host tokens (spec §20.1, §34).
 * All randomness is injectable so the logic is unit-testable; production callers pass a
 * Web Crypto source (available in both the Workers runtime and the browser).
 */

export type RandomBytes = (length: number) => Uint8Array;

// Minimal Web Crypto shape so this module type-checks without the DOM lib (it runs in the
// browser, the Workers runtime, and Node 20+, all of which provide `crypto` globally).
interface WebCryptoLike {
  getRandomValues<T extends ArrayBufferView>(array: T): T;
}

/** Default randomness source backed by Web Crypto (`crypto.getRandomValues`). */
export const webCryptoRandomBytes: RandomBytes = (length) => {
  const array = new Uint8Array(length);
  (globalThis as unknown as { crypto: WebCryptoLike }).crypto.getRandomValues(array);
  return array;
};

/** Room-code alphabet: uppercase, no easily confused characters (excludes 0 O 1 I). */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_LENGTH = 6;

// 256 is an exact multiple of 32, so `byte % 32` is unbiased — no rejection sampling needed.
const HEX = '0123456789abcdef';

export function generateRoomCode(random: RandomBytes = webCryptoRandomBytes): string {
  const bytes = random(ROOM_CODE_LENGTH);
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i += 1) {
    const value = bytes[i] ?? 0;
    code += ROOM_CODE_ALPHABET.charAt(value % ROOM_CODE_ALPHABET.length);
  }
  return code;
}

/** Uppercase and strip surrounding whitespace so room-code entry is case-insensitive. */
export function normalizeRoomCode(input: string): string {
  return input.trim().toUpperCase();
}

export function isValidRoomCode(input: string): boolean {
  const code = normalizeRoomCode(input);
  if (code.length !== ROOM_CODE_LENGTH) return false;
  for (const char of code) {
    if (!ROOM_CODE_ALPHABET.includes(char)) return false;
  }
  return true;
}

function toHex(bytes: Uint8Array): string {
  let out = '';
  for (const byte of bytes) {
    out += HEX.charAt((byte >> 4) & 0xf);
    out += HEX.charAt(byte & 0xf);
  }
  return out;
}

/** A short random id, optionally namespaced (e.g. `die_1a2b3c4d`). */
export function generateId(
  prefix = '',
  byteLength = 8,
  random: RandomBytes = webCryptoRandomBytes,
): string {
  const hex = toHex(random(byteLength));
  return prefix ? `${prefix}_${hex}` : hex;
}

/** A long random secret for player-session and host tokens (32 bytes → 256 bits). */
export function generateToken(random: RandomBytes = webCryptoRandomBytes): string {
  return toHex(random(32));
}
