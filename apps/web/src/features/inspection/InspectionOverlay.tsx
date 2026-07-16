import {
  canClearDie,
  canKeepDie,
  canMoveDie,
  canRerollDie,
  type RollCreatedPayload,
  type RollReaction,
  type RollRecord,
} from '@rollycast/shared';
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { useInspectionStore } from '../../state/inspectionStore';
import { useLocalRoller } from '../../state/localRoller';
import { useRoomStore } from '../../state/roomStore';
import './inspection.css';

type RollMeta = RollCreatedPayload | RollRecord;

export function InspectionOverlay() {
  const selectedRollId = useInspectionStore((s) => s.selectedRollId);
  const selectedDieId = useInspectionStore((s) => s.selectedDieId);
  const actionMenu = useInspectionStore((s) => s.actionMenu);
  const rerollDieIds = useInspectionStore((s) => s.rerollDieIds);
  const selectingMultiple = useInspectionStore((s) => s.selectingMultiple);
  const focusDie = useInspectionStore((s) => s.focusDie);
  const toggleRerollDie = useInspectionStore((s) => s.toggleRerollDie);
  const beginMultiSelect = useInspectionStore((s) => s.beginMultiSelect);
  const cancelMultiSelect = useInspectionStore((s) => s.cancelMultiSelect);
  const openActionMenu = useInspectionStore((s) => s.openActionMenu);
  const closeActionMenu = useInspectionStore((s) => s.closeActionMenu);
  const clearInspection = useInspectionStore((s) => s.clearInspection);
  const activeDice = useLocalRoller((s) => s.activeDice);
  const log = useLocalRoller((s) => s.log);
  const rollMeta = useLocalRoller((s) => s.rollMeta);
  const ownerNames = useLocalRoller((s) => s.ownerNames);
  const players = useRoomStore((s) => s.players);
  const requestReroll = useLocalRoller((s) => s.requestReroll);
  const requestMove = useLocalRoller((s) => s.requestMove);
  const setKept = useLocalRoller((s) => s.setKept);
  const clearRoll = useLocalRoller((s) => s.clearRoll);
  const reactToRoll = useLocalRoller((s) => s.reactToRoll);
  const cancelActiveGrab = useLocalRoller((s) => s.cancelActiveGrab);
  const activeGrab = useLocalRoller((s) => s.activeGrab);
  const grabMessage = useLocalRoller((s) => s.grabMessage);

  if (!selectedRollId) return null;

  const meta = rollMeta[selectedRollId];
  const entry = log.find((item) => item.id === selectedRollId);
  const dice = activeDice.filter((die) => die.rollId === selectedRollId);
  const selectedDie = dice.find((die) => die.id === selectedDieId) ?? dice[0];
  if (!meta || !entry || dice.length === 0) return null;

  const ownerName = ownerNameFor(meta, ownerNames[selectedRollId]);
  const actingName = actingNameFor(meta, players);

  const openMenuFromElement = (element: HTMLElement, dieId = selectedDie?.id) => {
    if (!dieId) return;
    const rect = element.getBoundingClientRect();
    openActionMenu(dieId, selectedRollId, {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height,
    });
  };

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

        <div className="inspection-results" aria-label="Individual dice results">
          {dice.map((die, index) => (
            <button
              type="button"
              key={die.id}
              className={
                selectedDieId === die.id || rerollDieIds.includes(die.id) ? 'is-selected' : ''
              }
              onClick={() =>
                selectingMultiple
                  ? toggleRerollDie(die.id, die.rollId)
                  : focusDie(die.id, die.rollId)
              }
              onContextMenu={(event) => {
                event.preventDefault();
                focusDie(die.id, die.rollId);
                openMenuFromElement(event.currentTarget, die.id);
              }}
              onKeyDown={(event) => {
                if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
                  event.preventDefault();
                  focusDie(die.id, die.rollId);
                  openMenuFromElement(event.currentTarget, die.id);
                }
              }}
              aria-pressed={
                selectingMultiple ? rerollDieIds.includes(die.id) : selectedDieId === die.id
              }
              aria-label={`${die.type} result ${displayDieResult(die)}, die ${index + 1}`}
            >
              <span>{die.type}</span>
              <strong>{displayDieResult(die)}</strong>
            </button>
          ))}
        </div>

        <dl className="inspection-details">
          <div>
            <dt>Modifier</dt>
            <dd>{meta.modifier >= 0 ? `+${meta.modifier}` : meta.modifier}</dd>
          </div>
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
          <button
            type="button"
            className="btn btn-primary inspection-actions"
            onClick={(event) => openMenuFromElement(event.currentTarget)}
            onKeyDown={(event) =>
              openMenuWithKeyboard(event, () => openMenuFromElement(event.currentTarget))
            }
          >
            Actions for selected die
          </button>
        )}
        {selectingMultiple && (
          <div className="inspection-multi-actions">
            <span>{rerollDieIds.length} selected</span>
            <button type="button" onClick={cancelMultiSelect}>
              Cancel selection
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={rerollDieIds.length === 0}
              onClick={() => requestReroll(rerollDieIds)}
            >
              Pick up selected
            </button>
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
          onSelectMore={(selectedId) => {
            beginMultiSelect(selectedId, actionMenu.rollId);
            closeActionMenu();
          }}
          onRequestMove={(selectedId) => {
            requestMove([selectedId]);
            closeActionMenu();
          }}
          onSetKept={(selectedId, kept) => {
            setKept(selectedId, kept);
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
  onSelectMore,
  onRequestMove,
  onSetKept,
  onClearRoll,
  onReact,
}: {
  dieId: string;
  rollId: string;
  x: number;
  y: number;
  onClose: () => void;
  onRequestReroll: (dieId: string) => void;
  onSelectMore: (dieId: string) => void;
  onRequestMove: (dieId: string) => void;
  onSetKept: (dieId: string, kept: boolean) => void;
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

  const permission = {
    requesterId: self.playerId,
    ownerPlayerId: die.ownerPlayerId,
    kept: die.kept,
    status: die.status,
    mode,
  } as const;
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
      {canRerollDie(permission) && (
        <>
          <button type="button" role="menuitem" onClick={() => onRequestReroll(dieId)}>
            Pick up and reroll
          </button>
          <button type="button" role="menuitem" onClick={() => onSelectMore(dieId)}>
            Select more dice
          </button>
        </>
      )}
      {canKeepDie(permission) && (
        <button type="button" role="menuitem" onClick={() => onSetKept(dieId, !die.kept)}>
          {die.kept ? 'Release die' : 'Keep die'}
        </button>
      )}
      {canMoveDie(permission) && (
        <button type="button" role="menuitem" onClick={() => onRequestMove(dieId)}>
          Move die
        </button>
      )}
      {canClearDie(permission) && (
        <button type="button" role="menuitem" onClick={onClearRoll}>
          Clear roll
        </button>
      )}
      <button type="button" role="menuitem" onClick={() => setShowReactions((value) => !value)}>
        React <span aria-hidden="true">›</span>
      </button>
      {showReactions && (
        <div className="dice-reaction-options" aria-label="Roll reactions">
          {REACTIONS.map((item) => (
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

const REACTIONS: Array<{ reaction: RollReaction; label: string; symbol: string }> = [
  { reaction: 'critical', label: 'Critical!', symbol: '★' },
  { reaction: 'success', label: 'Success', symbol: '✓' },
  { reaction: 'disaster', label: 'Disaster', symbol: '!' },
  { reaction: 'suspense', label: 'Suspense', symbol: '…' },
  { reaction: 'applause', label: 'Applause', symbol: '👏' },
  { reaction: 'question', label: 'Question', symbol: '?' },
];

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

function openMenuWithKeyboard(event: KeyboardEvent, open: () => void) {
  if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
    event.preventDefault();
    open();
  }
}
