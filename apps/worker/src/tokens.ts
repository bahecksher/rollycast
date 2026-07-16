/**
 * Session and host tokens are stored only as SHA-256 hashes (spec §34 — hashed tokens in
 * persistent storage). The plaintext token lives on the client; the server keeps the hash and
 * compares on reconnect / host actions.
 */
export async function hashToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function tokenMatches(token: string, hash: string): Promise<boolean> {
  if (!token || !hash) return false;
  const computed = await hashToken(token);
  // Constant-time-ish compare (lengths are fixed hex digests).
  if (computed.length !== hash.length) return false;
  let diff = 0;
  for (let i = 0; i < computed.length; i += 1) {
    diff |= computed.charCodeAt(i) ^ hash.charCodeAt(i);
  }
  return diff === 0;
}
