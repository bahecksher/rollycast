import { useState } from 'react';
import type { RollReaction } from '@rollycast/shared';
import { useLocalRoller, type LocalRollEntry } from '../../state/localRoller';
import { useInspectionStore } from '../../state/inspectionStore';
import { useRoomStore } from '../../state/roomStore';
import { REACTION_CATALOG, reactionPresentation } from '../inspection/reactionCatalog';
import './roll-log.css';

/**
 * Shared server-authoritative history. Collapsed by default; the newest roll is also announced
 * through an ARIA live region so results are available without seeing the dice (spec §32).
 *
 * Reactions live on the roll's own row. Reacting used to require finding a die on the table, which
 * became impossible once unkept dice expired — the history row is the one place a roll is always
 * reachable.
 */
export function RollLog() {
  const log = useLocalRoller((s) => s.log);
  const [open, setOpen] = useState(false);
  const latest = log.find((entry) => entry.kind !== 'event');
  const selectedRollId = useInspectionStore((s) => s.selectedRollId);
  const inspectRoll = useInspectionStore((s) => s.inspectRoll);

  return (
    <div className={`rolllog ${open ? 'is-open' : ''}`}>
      <button
        type="button"
        className="btn btn-ghost rolllog-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        History{log.length ? ` (${log.length})` : ''}
      </button>

      <div className="visually-hidden" role="status" aria-live="polite">
        {latest
          ? `${latest.expression} rolled ${latest.results.join(', ')}, total ${latest.total}`
          : ''}
      </div>

      {open && (
        <ul className="rolllog-list">
          {log.length === 0 && <li className="rolllog-empty">No rolls yet.</li>}
          {log.map((entry) =>
            entry.kind === 'event' ? (
              <li
                key={entry.id}
                className="rolllog-event"
                style={{ borderLeftColor: entry.colorHex }}
              >
                <span
                  className="rolllog-event-dot"
                  style={{ backgroundColor: entry.colorHex }}
                  aria-hidden="true"
                />
                <span className="rolllog-event-label">{entry.label}</span>
              </li>
            ) : (
              <li key={entry.id} className="rolllog-item">
                <div
                  className={`rolllog-row ${selectedRollId === entry.id ? 'is-selected' : ''}`}
                  style={{ borderLeftColor: entry.colorHex }}
                >
                  <button
                    type="button"
                    className="rolllog-entry"
                    onClick={() => inspectRoll(entry.id)}
                    aria-pressed={selectedRollId === entry.id}
                    aria-label={`Inspect ${entry.ownerName ? `${entry.ownerName}'s ` : ''}${entry.expression}, total ${entry.total}`}
                  >
                    {entry.ownerName && <span className="rolllog-owner">{entry.ownerName}</span>}
                    <span className="rolllog-expr">{entry.expression}</span>
                    <span className="rolllog-results">[{entry.results.join(', ')}]</span>
                    <span className="rolllog-total">{entry.total}</span>
                  </button>
                  <RowReactions entry={entry} />
                </div>
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}

/** The reaction chips and picker tucked into a roll's row. */
function RowReactions({ entry }: { entry: LocalRollEntry }) {
  const selfId = useRoomStore((s) => s.self?.playerId);
  const players = useRoomStore((s) => s.players);
  const reactToRoll = useLocalRoller((s) => s.reactToRoll);
  const [picking, setPicking] = useState(false);

  // Collapse the per-player entries into one chip per reaction, so ten applauses read as "👏 10"
  // rather than ten identical glyphs.
  const grouped = new Map<RollReaction, string[]>();
  for (const item of entry.reactions) {
    grouped.set(item.reaction, [...(grouped.get(item.reaction) ?? []), item.playerId]);
  }

  const nameOf = (playerId: string) =>
    players.find((player) => player.id === playerId)?.displayName ?? 'Someone';

  return (
    <div className="rolllog-reactions">
      {[...grouped].map(([reaction, playerIds]) => {
        const { symbol, label } = reactionPresentation(reaction);
        const mine = selfId !== undefined && playerIds.includes(selfId);
        return (
          <button
            key={reaction}
            type="button"
            className={`rolllog-chip ${mine ? 'is-mine' : ''}`}
            onClick={() => reactToRoll(entry.id, reaction)}
            aria-pressed={mine}
            title={`${label} — ${playerIds.map(nameOf).join(', ')}${mine ? ' (click to remove)' : ''}`}
            aria-label={`${label}, ${playerIds.length} ${playerIds.length === 1 ? 'reaction' : 'reactions'}${mine ? ', including yours' : ''}`}
          >
            <span aria-hidden="true">{symbol}</span>
            <span className="rolllog-chip-count">{playerIds.length}</span>
          </button>
        );
      })}

      <button
        type="button"
        className="rolllog-chip rolllog-chip-add"
        onClick={() => setPicking((value) => !value)}
        aria-expanded={picking}
        aria-label="React to this roll"
        title="React to this roll"
      >
        <span aria-hidden="true">+</span>
      </button>

      {picking && (
        <div className="rolllog-picker" role="group" aria-label="Pick a reaction">
          {REACTION_CATALOG.map((item) => (
            <button
              key={item.reaction}
              type="button"
              onClick={() => {
                reactToRoll(entry.id, item.reaction);
                setPicking(false);
              }}
              aria-label={item.label}
              title={item.label}
            >
              <span aria-hidden="true">{item.symbol}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
