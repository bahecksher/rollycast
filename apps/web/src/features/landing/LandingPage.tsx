import { isValidRoomCode, normalizeRoomCode } from '@rollycast/shared';
import { useState, type FormEvent } from 'react';
import { navigate } from '../../router';
import './landing.css';

export function LandingPage() {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleCreate = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/rooms', { method: 'POST' });
      if (!response.ok) throw new Error('create failed');
      const room = (await response.json()) as { roomUrl: string };
      navigate(room.roomUrl);
    } catch {
      setError('Could not create a table. Please try again.');
      setBusy(false);
    }
  };

  const handleJoin = async (event: FormEvent) => {
    event.preventDefault();
    const normalized = normalizeRoomCode(code);
    if (!isValidRoomCode(normalized)) {
      setError('That doesn’t look like a 6-character room code.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/parties/room/${normalized}`);
      const result = (await response.json()) as { exists?: boolean };
      if (!response.ok || !result.exists) {
        setError('No active table was found for that room code.');
        setBusy(false);
        return;
      }
      navigate(`/room/${normalized}`);
    } catch {
      setError('Could not reach the table service. Please try again.');
      setBusy(false);
    }
  };

  return (
    <main className="landing">
      <div className="landing-card">
        <div className="landing-hero">
          <span className="landing-die" aria-hidden="true">
            ⚄
          </span>
          <h1 className="landing-title">RollyCast</h1>
          <p className="landing-tagline">
            Roll real 3D dice together. Create a table, share the code, and everyone sees the same
            result — no account needed.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-primary landing-create"
          onClick={handleCreate}
          disabled={busy}
        >
          {busy ? 'Opening table…' : 'Create a table'}
        </button>

        <div className="landing-divider">
          <span>or join one</span>
        </div>

        <form className="landing-join" onSubmit={handleJoin} noValidate>
          <label htmlFor="room-code" className="landing-label">
            Room code
          </label>
          <div className="landing-join-row">
            <input
              id="room-code"
              className="input landing-code-input"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="K7M4PX"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={6}
              inputMode="text"
              aria-describedby={error ? 'room-code-error' : undefined}
            />
            <button type="submit" className="btn btn-ghost" disabled={busy}>
              Join
            </button>
          </div>
          <p id="room-code-error" className="landing-error" role="alert">
            {error ?? ''}
          </p>
        </form>
      </div>

      <footer className="landing-footer">
        <p>A private, playful dice tray for tabletop games.</p>
      </footer>
    </main>
  );
}
