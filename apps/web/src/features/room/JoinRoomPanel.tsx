import { DEFAULT_COLOR_ID, DICE_COLORS } from '@rollycast/shared';
import { useState, type FormEvent } from 'react';
import type { JoinProfile } from '../../network/useRoomConnection';

interface JoinRoomPanelProps {
  roomCode: string;
  onJoin: (profile: JoinProfile) => void;
}

export function JoinRoomPanel({ roomCode, onJoin }: JoinRoomPanelProps) {
  const [displayName, setDisplayName] = useState('');
  const [colorId, setColorId] = useState(DEFAULT_COLOR_ID);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onJoin({ displayName, colorId });
  };

  return (
    <div className="join-overlay">
      <form className="join-panel" onSubmit={submit}>
        <p className="join-eyebrow">Joining {roomCode}</p>
        <h1 className="join-title">Choose your seat</h1>

        <label className="join-label" htmlFor="display-name">
          Display name
        </label>
        <input
          id="display-name"
          className="input"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          placeholder="Player name"
          maxLength={24}
          autoComplete="nickname"
          autoFocus
        />

        <fieldset className="join-colors">
          <legend className="join-label">Dice color</legend>
          <div className="join-color-grid">
            {DICE_COLORS.map((color) => (
              <label key={color.id} className="join-color" title={color.name}>
                <input
                  type="radio"
                  name="dice-color"
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

        <button type="submit" className="btn btn-primary join-submit">
          Join table
        </button>
      </form>
    </div>
  );
}
