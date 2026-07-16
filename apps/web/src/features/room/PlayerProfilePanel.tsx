import { DICE_COLORS } from '@rollycast/shared';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { updatePlayerProfile } from '../../network/roomCommands';
import { useRoomStore } from '../../state/roomStore';

/**
 * Click your name in the top bar to change your display name and dice color. The server confirms the
 * values (a taken color may shift) and broadcasts them, so future rolls — and their history — pick up
 * the new name and color.
 */
export function PlayerProfilePanel() {
  const self = useRoomStore((state) => state.self);
  const details = useRef<HTMLDetailsElement>(null);
  const [name, setName] = useState(self?.displayName ?? '');
  const [colorId, setColorId] = useState(self?.colorId ?? '');

  // Reset the draft to the confirmed profile whenever it changes while the panel is closed.
  useEffect(() => {
    if (!details.current?.open) {
      setName(self?.displayName ?? '');
      setColorId(self?.colorId ?? '');
    }
  }, [self?.displayName, self?.colorId]);

  if (!self) return null;

  const save = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    updatePlayerProfile({
      displayName: trimmed.length ? trimmed : undefined,
      colorId,
    });
    if (details.current) details.current.open = false;
  };

  return (
    <details className="room-profile" ref={details}>
      <summary className="room-profile-summary" aria-label="Edit your name and dice color">
        Player: <strong>{self.displayName}</strong>
      </summary>
      <form className="room-profile-panel" onSubmit={save}>
        <label className="room-profile-field">
          <span>Display name</span>
          <input
            className="input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={24}
            placeholder="Player name"
            autoComplete="nickname"
          />
        </label>

        <fieldset className="room-profile-colors">
          <legend>Dice color</legend>
          <div className="join-color-grid">
            {DICE_COLORS.map((color) => (
              <label key={color.id} className="join-color" title={color.name}>
                <input
                  type="radio"
                  name="profile-color"
                  value={color.id}
                  checked={colorId === color.id}
                  onChange={() => setColorId(color.id)}
                />
                <span style={{ backgroundColor: color.hex }} aria-hidden="true" />
                <span className="visually-hidden">{color.name}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <button type="submit" className="btn btn-primary room-profile-save">
          Save
        </button>
      </form>
    </details>
  );
}
