/**
 * Local, per-room identity for reconnection (spec §20.3). Persisted to localStorage so a reload
 * reclaims the same player rather than creating a duplicate. The session/host tokens are secrets
 * held only on this device.
 */
export interface StoredIdentity {
  playerId: string;
  sessionToken: string;
  displayName: string;
  colorId: string;
  hostToken?: string;
}

const keyFor = (roomCode: string) => `rollycast:room:${roomCode.toUpperCase()}`;

export function loadIdentity(roomCode: string): StoredIdentity | null {
  try {
    const raw = localStorage.getItem(keyFor(roomCode));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredIdentity;
    if (parsed && typeof parsed.playerId === 'string' && typeof parsed.sessionToken === 'string') {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveIdentity(roomCode: string, identity: StoredIdentity): void {
  try {
    localStorage.setItem(keyFor(roomCode), JSON.stringify(identity));
  } catch {
    // Ignore storage failures (private mode, quota) — reconnection just won't persist.
  }
}

export function clearIdentity(roomCode: string): void {
  try {
    localStorage.removeItem(keyFor(roomCode));
  } catch {
    // no-op
  }
}
