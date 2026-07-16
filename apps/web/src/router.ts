import { useEffect, useState } from 'react';

/** Minimal path-based router — avoids pulling in a routing dependency (spec §16 principles). */
export function useLocationPath(): string {
  const [path, setPath] = useState(() => window.location.pathname);
  useEffect(() => {
    const onChange = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onChange);
    return () => window.removeEventListener('popstate', onChange);
  }, []);
  return path;
}

export function navigate(to: string): void {
  if (to === window.location.pathname) return;
  window.history.pushState({}, '', to);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

const ROOM_PATTERN = /^\/room\/([^/]+)$/;

export function matchRoomCode(path: string): string | null {
  const match = ROOM_PATTERN.exec(path);
  return match ? (match[1] ?? null) : null;
}
