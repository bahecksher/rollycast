import { formatDicePool } from '@rollycast/shared';
import { SELECTABLE_DIE_TYPES, type SelectableDieType } from '../../scene/dice/dieTypes';
import { TABLE } from '../../scene/tableConfig';
import { useLocalRoller } from '../../state/localRoller';
import { clearOwnUnkeptDice } from '../../network/roomCommands';
import './dice-tray.css';

/** Standard dice tray with a fast single-die path plus an optional mixed-pool builder. */
export function DiceTray() {
  const selection = useLocalRoller((s) => s.selection);
  const pool = useLocalRoller((s) => s.pool);
  const setType = useLocalRoller((s) => s.setType);
  const setQuantity = useLocalRoller((s) => s.setQuantity);
  const addSelection = useLocalRoller((s) => s.addSelection);
  const removeSelection = useLocalRoller((s) => s.removeSelection);
  const clearPool = useLocalRoller((s) => s.clearPool);
  const throwSelection = useLocalRoller((s) => s.throwSelection);
  const effectiveDice = pool.length > 0 ? pool : [selection];
  const expression = formatDicePool({ dice: effectiveDice, modifier: 0 });

  const rollFromButton = () => {
    const center: [number, number, number] = [
      (Math.random() - 0.5) * 2,
      TABLE.throwHeight,
      TABLE.halfZ - 1,
    ];
    const velocity: [number, number, number] = [(Math.random() - 0.5) * 3, -1.5, -6.5];
    throwSelection(center, velocity);
  };

  return (
    <div className="tray" role="group" aria-label="Dice controls">
      <div className="tray-types" role="group" aria-label="Die type">
        {SELECTABLE_DIE_TYPES.map((type: SelectableDieType) => (
          <button
            key={type}
            type="button"
            className={`tray-type ${selection.type === type ? 'is-active' : ''}`}
            aria-pressed={selection.type === type}
            onClick={() => setType(type)}
          >
            {type}
          </button>
        ))}
      </div>

      <div className="tray-quantity" role="group" aria-label="Quantity">
        <button
          type="button"
          className="btn btn-ghost tray-step"
          onClick={() => setQuantity(selection.quantity - 1)}
          aria-label="Fewer dice"
          disabled={selection.quantity <= 1}
        >
          −
        </button>
        <span className="tray-quantity-value" aria-live="polite">
          {selection.quantity}
        </span>
        <button
          type="button"
          className="btn btn-ghost tray-step"
          onClick={() => setQuantity(selection.quantity + 1)}
          aria-label="More dice"
          disabled={selection.quantity >= 10}
        >
          +
        </button>
      </div>

      <button type="button" className="btn btn-ghost tray-add" onClick={addSelection}>
        Add
      </button>

      {pool.length > 0 && (
        <div className="tray-pool" aria-label="Dice pool">
          {pool.map((item) => (
            <button
              type="button"
              key={item.type}
              className="tray-chip"
              onClick={() => removeSelection(item.type)}
              aria-label={`Remove ${item.quantity}${item.type}`}
            >
              {item.quantity}
              {item.type} ×
            </button>
          ))}
          <button type="button" className="tray-chip tray-chip-clear" onClick={clearPool}>
            Reset
          </button>
        </div>
      )}

      <button type="button" className="btn btn-primary tray-roll" onClick={rollFromButton}>
        Roll {expression}
      </button>
      <button
        type="button"
        className="btn btn-ghost tray-clear"
        onClick={clearOwnUnkeptDice}
        title="Remove your unkept dice from the table"
      >
        Clear
      </button>
    </div>
  );
}
