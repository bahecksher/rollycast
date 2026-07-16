import { useState } from 'react';
import { useLocalRoller } from '../../state/localRoller';
import { useInspectionStore } from '../../state/inspectionStore';
import './roll-log.css';

/**
 * Shared server-authoritative history. Collapsed by default; the newest roll is also announced
 * through an ARIA live region so results are available without seeing the dice (spec §32).
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
              <li key={entry.id}>
                <button
                  type="button"
                  className={`rolllog-entry ${selectedRollId === entry.id ? 'is-selected' : ''}`}
                  style={{ borderLeftColor: entry.colorHex }}
                  onClick={() => inspectRoll(entry.id)}
                  aria-pressed={selectedRollId === entry.id}
                  aria-label={`Inspect ${entry.ownerName ? `${entry.ownerName}'s ` : ''}${entry.expression}, total ${entry.total}`}
                >
                  {entry.ownerName && <span className="rolllog-owner">{entry.ownerName}</span>}
                  <span className="rolllog-expr">{entry.expression}</span>
                  <span className="rolllog-results">[{entry.results.join(', ')}]</span>
                  <span className="rolllog-total">{entry.total}</span>
                </button>
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}
