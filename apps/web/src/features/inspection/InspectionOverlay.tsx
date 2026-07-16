import { type RollCreatedPayload, type RollReaction, type RollRecord } from '@rollycast/shared';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { keepRollAlive } from '../../network/roomCommands';
import { useInspectionStore } from '../../state/inspectionStore';
import { useLocalRoller } from '../../state/localRoller';
import { useRoomStore } from '../../state/roomStore';
import { dieActionsFor, type DieActionHandlers } from './dieActions';
import { REACTION_CATALOG } from './reactionCatalog';
import './inspection.css';

type RollMeta = RollCreatedPayload | RollRecord;

/** Comfortably inside the 30s unkept-die lifetime, so a dropped keep-alive isn't fatal. */
const KEEP_ALIVE_INTERVAL_MS = 10_000;

/**
 * Hold the inspected roll's dice on the table for as long as it stays inspected. Without this a die
 * you are looking at is swept after 30s and the panel vanishes mid-read.
 */
function useKeepInspectedRollAlive(rollId: string | null): void {
  useEffect(() => {
    if (!rollId) return;
    keepRollAlive(rollId);
    const timer = window.setInterval(() => keepRollAlive(rollId), KEEP_ALIVE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [rollId]);
}

export function InspectionOverlay() {
  const selectedRollId = useInspectionStore((s) => s.selectedRollId);
  const selectedDieId = useInspectionStore((s) => s.selectedDieId);
  const actionMenu = useInspectionStore((s) => s.actionMenu);
  const closeActionMenu = useInspectionStore((s) => s.closeActionMenu);
  const clearInspection = useInspectionStore((s) => s.clearInspection);
  const activeDice = useLocalRoller((s) => s.activeDice);
  const log = useLocalRoller((s) => s.log);
  const rollMeta = useLocalRoller((s) => s.rollMeta);
  const ownerNames = useLocalRoller((s) => s.ownerNames);
  const players = useRoomStore((s) => s.players);
  const requestReroll = useLocalRoller((s) => s.requestReroll);
  const clearRoll = useLocalRoller((s) => s.clearRoll);
  const reactToRoll = useLocalRoller((s) => s.reactToRoll);
  const cancelActiveGrab = useLocalRoller((s) => s.cancelActiveGrab);
  const activeGrab = useLocalRoller((s) => s.activeGrab);
  const grabMessage = useLocalRoller((s) => s.grabMessage);
  const self = useRoomStore((s) => s.self);
  const mode = useRoomStore((s) => s.settings.diceHandlingMode);

  // Before the early return: hooks must run on every render.
  useKeepInspectedRollAlive(selectedRollId);

  if (!selectedRollId) return null;

  const meta = rollMeta[selectedRollId];
  const entry = log.find((item) => item.id === selectedRollId);
  const dice = activeDice.filter((die) => die.rollId === selectedRollId);
  const selectedDie = dice.find((die) => die.id === selectedDieId) ?? dice[0];
  if (!meta || !entry || dice.length === 0) return null;

  const ownerName = ownerNameFor(meta, ownerNames[selectedRollId]);
  const actingName = actingNameFor(meta, players);

  const handlers: DieActionHandlers = {
    onRequestReroll: (id) => requestReroll([id]),
    onClearRoll: () => clearRoll(selectedRollId),
  };
  const panelActions =
    selectedDie && self ? dieActionsFor(selectedDie, self.playerId, mode, handlers) : [];

  return (
    <>
      <aside className="inspection-panel" aria-label={`Inspected roll by ${ownerName}`}>
        <div className="inspection-heading">
          <div>
            <p>{meta.sourceRollId ? 'Reroll' : 'Inspected roll'}</p>
            <h2>{ownerName} rolled</h2>
          </div>
          <button
            type="button"
            className="inspection-close"
            onClick={clearInspection}
            aria-label="Close inspection"
          >
            ×
          </button>
        </div>

        <div className="inspection-summary">
          <strong>{entry.expression}</strong>
          <span className="inspection-total">{entry.total}</span>
        </div>

        <dl className="inspection-details">
          <div>
            <dt>Rolled</dt>
            <dd>
              {new Date(meta.createdAt).toLocaleTimeString([], {
                hour: 'numeric',
                minute: '2-digit',
              })}
            </dd>
          </div>
          {actingName && actingName !== ownerName && (
            <div>
              <dt>Acting player</dt>
              <dd>{actingName}</dd>
            </div>
          )}
          {meta.sourceRollId && (
            <div>
              <dt>Source</dt>
              <dd>Linked reroll</dd>
            </div>
          )}
        </dl>

        {selectedDie && (
          <div className="inspection-die-actions">
            <p className="inspection-die-actions-label">
              {selectedDie.type} showing <strong>{displayDieResult(selectedDie)}</strong>
            </p>
            {panelActions.length > 0 ? (
              <div className="inspection-action-grid">
                {panelActions.map((action) => (
                  <button key={action.key} type="button" onClick={action.run}>
                    {action.label}
                  </button>
                ))}
              </div>
            ) : (
              <p className="inspection-action-empty">No actions available for this die.</p>
            )}
            <div className="inspection-react" role="group" aria-label="React to this roll">
              {REACTION_CATALOG.map((item) => (
                <button
                  key={item.reaction}
                  type="button"
                  onClick={() => reactToRoll(selectedRollId, item.reaction)}
                  aria-label={item.label}
                  title={item.label}
                >
                  <span aria-hidden="true">{item.symbol}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {grabMessage && (
          <div className="inspection-grab-status" role="status">
            <span>{grabMessage}</span>
            {activeGrab?.isController && (
              <button type="button" onClick={cancelActiveGrab}>
                Cancel
              </button>
            )}
          </div>
        )}
      </aside>

      {actionMenu && (
        <DiceActionMenu
          dieId={actionMenu.dieId}
          rollId={actionMenu.rollId}
          x={actionMenu.x}
          y={actionMenu.y}
          onClose={closeActionMenu}
          onRequestReroll={(selectedId) => {
            requestReroll([selectedId]);
            closeActionMenu();
          }}
          onClearRoll={() => {
            clearRoll(actionMenu.rollId);
            closeActionMenu();
          }}
          onReact={(reaction) => {
            reactToRoll(actionMenu.rollId, reaction);
            closeActionMenu();
          }}
        />
      )}
    </>
  );
}

function DiceActionMenu({
  dieId,
  rollId,
  x,
  y,
  onClose,
  onRequestReroll,
  onClearRoll,
  onReact,
}: {
  dieId: string;
  rollId: string;
  x: number;
  y: number;
  onClose: () => void;
  onRequestReroll: (dieId: string) => void;
  onClearRoll: () => void;
  onReact: (reaction: RollReaction) => void;
}) {
  const firstAction = useRef<HTMLButtonElement>(null);
  const die = useLocalRoller((s) => s.activeDice.find((candidate) => candidate.id === dieId));
  const self = useRoomStore((s) => s.self);
  const mode = useRoomStore((s) => s.settings.diceHandlingMode);
  const inspectRoll = useInspectionStore((s) => s.inspectRoll);
  const [showReactions, setShowReactions] = useState(false);

  useEffect(() => {
    firstAction.current?.focus();
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  if (!die || !self) return null;

  const actions = dieActionsFor(die, self.playerId, mode, { onRequestReroll, onClearRoll });
  const style = { '--menu-x': `${x}px`, '--menu-y': `${y}px` } as CSSProperties;

  return (
    <div
      className="dice-action-menu"
      role="menu"
      aria-label={`Actions for ${die.type} showing ${displayDieResult(die)}`}
      style={style}
    >
      <div className="dice-action-heading">
        <span>{die.type}</span>
        <strong>{displayDieResult(die)}</strong>
        <button type="button" onClick={onClose} aria-label="Close die actions">
          ×
        </button>
      </div>
      <button
        ref={firstAction}
        type="button"
        role="menuitem"
        onClick={() => {
          inspectRoll(rollId, dieId);
          onClose();
        }}
      >
        Inspect roll
      </button>
      {actions.map((action) => (
        <button key={action.key} type="button" role="menuitem" onClick={action.run}>
          {action.label}
        </button>
      ))}
      <button type="button" role="menuitem" onClick={() => setShowReactions((value) => !value)}>
        React <span aria-hidden="true">›</span>
      </button>
      {showReactions && (
        <div className="dice-reaction-options" aria-label="Roll reactions">
          {REACTION_CATALOG.map((item) => (
            <button
              key={item.reaction}
              type="button"
              onClick={() => onReact(item.reaction)}
              aria-label={item.label}
              title={item.label}
            >
              <span aria-hidden="true">{item.symbol}</span>
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ownerNameFor(meta: RollMeta, fallback?: string): string {
  return 'ownerNameAtRoll' in meta ? meta.ownerNameAtRoll : (fallback ?? 'A player');
}

function actingNameFor(
  meta: RollMeta,
  players: Array<{ id: string; displayName: string }>,
): string | undefined {
  return 'actingPlayerNameAtRoll' in meta
    ? meta.actingPlayerNameAtRoll
    : players.find((player) => player.id === meta.actingPlayerId)?.displayName;
}

function displayDieResult(die: {
  result: number;
  percentilePart?: 'tens' | 'ones';
}): number | string {
  if (die.percentilePart === 'tens') return `${(die.result - 1) * 10}`.padStart(2, '0');
  if (die.percentilePart === 'ones') return die.result - 1;
  return die.result;
}
