import { getColor } from '@rollycast/shared';
import { Suspense, lazy, useMemo, useState } from 'react';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import { useRoomConnection, type JoinProfile } from '../../network/useRoomConnection';
import { navigate } from '../../router';
import { loadIdentity } from '../../state/identity';
import { useRoomStore } from '../../state/roomStore';
import { isWebGLAvailable } from '../../utils/webgl';
import { DiceTray } from '../dice/DiceTray';
import { InspectionOverlay } from '../inspection/InspectionOverlay';
import { RollReactions } from '../inspection/RollReactions';
import { RollLog } from '../roll-log/RollLog';
import { JoinRoomPanel } from './JoinRoomPanel';
import { PlayerProfilePanel } from './PlayerProfilePanel';
import { TableAppearancePanel } from './TableAppearancePanel';
import { SceneErrorBoundary } from './SceneErrorBoundary';
import './room.css';

const DiceScene = lazy(() => import('../../scene/DiceScene'));

interface RoomPageProps {
  code: string;
}

/**
 * The shared table shell. Milestone 1 wires in the local 3D dice roller; the real-time
 * connection (M2) and shared rolls (M3) replace the local roller store next.
 */
export function RoomPage({ code }: RoomPageProps) {
  const [copied, setCopied] = useState(false);
  const [profile, setProfile] = useState<JoinProfile | null>(() => {
    const identity = loadIdentity(code);
    return identity ? { displayName: identity.displayName, colorId: identity.colorId } : null;
  });
  const reducedMotion = usePrefersReducedMotion();
  const webglAvailable = useMemo(() => isWebGLAvailable(), []);
  const status = useRoomStore((state) => state.status);
  const players = useRoomStore((state) => state.players);
  const errorMessage = useRoomStore((state) => state.errorMessage);
  const self = useRoomStore((state) => state.self);
  const playerName = self?.displayName ?? profile?.displayName ?? null;
  const connectedPlayers = players.filter((player) => player.connected);
  useRoomConnection(code, profile);

  const copyShareLink = async () => {
    const url = `${window.location.origin}/room/${code}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="room">
      <header className="room-topbar">
        <button
          type="button"
          className="btn btn-ghost room-back"
          onClick={() => navigate('/')}
          aria-label="Leave table"
        >
          ‹
        </button>
        <div className="room-code-block">
          <span className="room-code-label">Room</span>
          <span className="room-code">{code}</span>
          {self ? (
            <PlayerProfilePanel />
          ) : (
            playerName && (
              <span className="room-code-player">
                Player: <strong>{playerName}</strong>
              </span>
            )
          )}
        </div>
        <details className="room-presence">
          <summary
            aria-label={`${connectedPlayers.length} connected player${connectedPlayers.length === 1 ? '' : 's'}`}
          >
            <span className={`room-status-dot is-${status}`} aria-hidden="true" />
            {connectedPlayers.length}
          </summary>
          <div className="room-player-list">
            <p className="room-player-heading">At the table</p>
            {players.map((player) => {
              const color = getColor(player.colorId);
              return (
                <div className={`room-player ${player.connected ? '' : 'is-away'}`} key={player.id}>
                  <span
                    className="room-player-color"
                    style={{ backgroundColor: color?.hex ?? '#6b7684' }}
                    aria-hidden="true"
                  />
                  <span>{player.displayName}</span>
                  {player.isHost && <span className="room-player-host">Host</span>}
                </div>
              );
            })}
          </div>
        </details>
        {self?.isHost && <TableAppearancePanel roomCode={code} />}
        <button type="button" className="btn btn-ghost room-share" onClick={copyShareLink}>
          {copied ? 'Copied!' : 'Share'}
        </button>
      </header>

      <main className="room-table" aria-label="Dice table">
        {webglAvailable ? (
          <SceneErrorBoundary>
            <Suspense fallback={<SceneLoading />}>
              <DiceScene reducedMotion={reducedMotion} />
            </Suspense>
          </SceneErrorBoundary>
        ) : (
          <WebGLFallback />
        )}
        <RollLog />
        <InspectionOverlay />
        <RollReactions />
      </main>

      <footer className="room-dock">
        <details className="dock-menu">
          <summary className="dock-menu-toggle" aria-label="Dice controls">
            <span className="dock-menu-icon" aria-hidden="true" />
            <span className="dock-menu-text">Dice</span>
          </summary>
          <div className="dock-menu-panel">
            <DiceTray />
          </div>
        </details>
      </footer>

      {!profile && <JoinRoomPanel roomCode={code} onJoin={setProfile} />}
      {profile && status !== 'connected' && (
        <div className={`room-connection is-${status}`} role="status">
          {status === 'error'
            ? (errorMessage ?? 'Unable to join this room.')
            : status === 'reconnecting'
              ? 'Connection lost. Reconnecting…'
              : 'Connecting to room…'}
        </div>
      )}
      {profile && status === 'connected' && errorMessage && (
        <div className="room-notice" role="alert">
          <span>{errorMessage}</span>
          <button type="button" onClick={() => useRoomStore.getState().setError(null)}>
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}

function SceneLoading() {
  return (
    <div className="room-loading" role="status">
      <span className="room-loading-die" aria-hidden="true">
        🎲
      </span>
      <span>Preparing the table…</span>
    </div>
  );
}

function WebGLFallback() {
  return (
    <div className="room-placeholder">
      <p className="room-placeholder-title">3D isn’t available on this device</p>
      <p className="room-placeholder-text">
        Use the roll controls below. Official shared results and room history remain available
        without the 3D table.
      </p>
    </div>
  );
}
