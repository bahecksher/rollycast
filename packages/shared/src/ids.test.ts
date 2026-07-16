import { describe, expect, it } from 'vitest';
import {
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  generateId,
  generateRoomCode,
  generateToken,
  isValidRoomCode,
  normalizeRoomCode,
  type RandomBytes,
} from './ids';

const seq =
  (...values: number[]): RandomBytes =>
  (length) => {
    const out = new Uint8Array(length);
    for (let i = 0; i < length; i += 1) out[i] = values[i] ?? 0;
    return out;
  };

describe('generateRoomCode', () => {
  it('maps bytes onto the safe alphabet', () => {
    expect(generateRoomCode(seq(0, 1, 2, 3, 4, 5))).toBe('ABCDEF');
  });

  it('wraps byte values modulo the alphabet length', () => {
    const code = generateRoomCode(seq(32, 33, 0, 0, 0, 0));
    expect(code[0]).toBe(ROOM_CODE_ALPHABET.charAt(0));
    expect(code[1]).toBe(ROOM_CODE_ALPHABET.charAt(1));
  });

  it('produces codes of the required length', () => {
    expect(generateRoomCode(seq(10, 11, 12, 13, 14, 15))).toHaveLength(ROOM_CODE_LENGTH);
  });
});

describe('room code validation', () => {
  it('normalizes case and whitespace', () => {
    expect(normalizeRoomCode('  k7m4px  ')).toBe('K7M4PX');
  });

  it('accepts valid codes case-insensitively', () => {
    expect(isValidRoomCode('k7m4px')).toBe(true);
    expect(isValidRoomCode('ABCDEF')).toBe(true);
  });

  it('rejects wrong length and confusable characters', () => {
    expect(isValidRoomCode('ABC')).toBe(false);
    expect(isValidRoomCode('ABCDEFG')).toBe(false);
    expect(isValidRoomCode('ABCDE0')).toBe(false); // 0 excluded
    expect(isValidRoomCode('ABCDEO')).toBe(false); // O excluded
    expect(isValidRoomCode('ABCDE1')).toBe(false); // 1 excluded
    expect(isValidRoomCode('ABCDEI')).toBe(false); // I excluded
  });
});

describe('generateToken / generateId', () => {
  it('generates a 64-character hex token', () => {
    const token = generateToken(seq(...new Array(32).fill(0xab)));
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(token.startsWith('abab')).toBe(true);
  });

  it('namespaces ids with a prefix', () => {
    const id = generateId('die', 4, seq(0x01, 0x23, 0x45, 0x67));
    expect(id).toBe('die_01234567');
  });
});
