import { describe, expect, it } from 'vitest';
import { isCleanDisplayName, sanitizeDisplayName } from './players';

const BELL = String.fromCharCode(0x07);
const NUL = String.fromCharCode(0x00);
const DEL = String.fromCharCode(0x7f);

describe('sanitizeDisplayName', () => {
  it('trims surrounding whitespace', () => {
    expect(sanitizeDisplayName('  Brett  ')).toBe('Brett');
  });

  it('strips control characters', () => {
    expect(sanitizeDisplayName(`Bre${BELL}tt`)).toBe('Brett');
    expect(sanitizeDisplayName(`${NUL}Line${DEL}Break`)).toBe('LineBreak');
  });

  it('clamps to 24 code points', () => {
    const long = 'X'.repeat(40);
    expect(sanitizeDisplayName(long)).toHaveLength(24);
  });

  it('does not split surrogate pairs when clamping', () => {
    const emoji = '😀'.repeat(30);
    const result = sanitizeDisplayName(emoji);
    // 24 code points of a 2-code-unit emoji => 48 UTF-16 units, all intact.
    expect(Array.from(result)).toHaveLength(24);
  });

  it('falls back to a Player name when empty or invalid', () => {
    expect(sanitizeDisplayName('   ', '7')).toBe('Player 7');
    expect(sanitizeDisplayName(`${BELL}${BELL}`, '9')).toBe('Player 9');
    expect(sanitizeDisplayName(undefined, '3')).toBe('Player 3');
    expect(sanitizeDisplayName(42, '3')).toBe('Player 3');
  });
});

describe('isCleanDisplayName', () => {
  it('is true for already-clean names', () => {
    expect(isCleanDisplayName('Kayleen')).toBe(true);
  });

  it('is false for names needing sanitization', () => {
    expect(isCleanDisplayName('  Kayleen  ')).toBe(false);
    expect(isCleanDisplayName('')).toBe(false);
  });
});
