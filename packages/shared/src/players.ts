import { LIMITS } from './dice';

// Control characters — C0 (0x00–0x1F), DEL (0x7F), and C1 (0x80–0x9F) — are never valid in a
// display name. Matching them is the whole point here, so no-control-regex is intentional.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = new RegExp('[\\u0000-\\u001F\\u007F-\\u009F]', 'g');

/**
 * Sanitize a requested display name (spec §18.1): strip control characters, trim, clamp to
 * 1..24 characters (by code point, so emoji/surrogate pairs aren't split). Falls back to
 * `Player <n>` when the result is empty. Escaping for display is handled by the UI layer
 * (React escapes text by default) — this only guarantees safe, bounded stored values.
 */
export function sanitizeDisplayName(input: unknown, fallbackDiscriminator?: string): string {
  const raw = typeof input === 'string' ? input : '';
  const stripped = raw.replace(CONTROL_CHARS, '').trim();
  const clamped = Array.from(stripped).slice(0, LIMITS.displayNameMax).join('');
  if (clamped.length >= LIMITS.displayNameMin) {
    return clamped;
  }
  const suffix = fallbackDiscriminator ?? String(Math.floor(1000 + Math.random() * 9000));
  return `Player ${suffix}`;
}

/** True when a raw name would survive sanitization unchanged (useful for input hints). */
export function isCleanDisplayName(input: string): boolean {
  return sanitizeDisplayName(input) === input && input.length >= LIMITS.displayNameMin;
}
