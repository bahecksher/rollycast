import {
  DEFAULT_ROOM_APPEARANCE,
  type DiceHandlingMode,
  type RoomAppearance,
} from '@rollycast/shared';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import {
  clearAllRoomDice,
  updateDiceHandlingMode,
  updateRoomAppearance,
} from '../../network/roomCommands';
import { loadIdentity } from '../../state/identity';
import { useRoomStore } from '../../state/roomStore';
import { prepareBackgroundImage } from './prepareBackgroundImage';

interface TableAppearancePanelProps {
  roomCode: string;
}

export function TableAppearancePanel({ roomCode }: TableAppearancePanelProps) {
  const appearance = useRoomStore((state) => state.settings.appearance);
  const diceHandlingMode = useRoomStore((state) => state.settings.diceHandlingMode);
  const [draft, setDraft] = useState<RoomAppearance>(() => ({ ...appearance }));
  const [message, setMessage] = useState('');
  const [processingImage, setProcessingImage] = useState(false);
  const submittedAppearance = useRef<string | null>(null);
  const submittedHandling = useRef<DiceHandlingMode | null>(null);
  const id = useId();

  useEffect(() => {
    setDraft({ ...appearance });
    if (submittedAppearance.current === JSON.stringify(appearance)) {
      submittedAppearance.current = null;
      setMessage('Table appearance saved.');
    }
  }, [appearance]);

  useEffect(() => {
    if (submittedHandling.current !== diceHandlingMode) return;
    submittedHandling.current = null;
    setMessage('Dice handling updated.');
  }, [diceHandlingMode]);

  const setColor = (field: 'surfaceColor' | 'rimColor' | 'backgroundColor', value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setMessage('');
  };

  const handleImage = async (file?: File) => {
    if (!file) return;
    setProcessingImage(true);
    setMessage('Preparing image…');
    try {
      const backgroundImage = await prepareBackgroundImage(file, draft.surfaceColor);
      setDraft((current) => ({ ...current, backgroundImage }));
      setMessage('Image ready. Save to share it with the room.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to prepare that image.');
    } finally {
      setProcessingImage(false);
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const hostToken = loadIdentity(roomCode)?.hostToken;
    if (!hostToken) {
      setMessage('The host token is missing on this device.');
      return;
    }
    if (!updateRoomAppearance(hostToken, draft)) {
      setMessage('Reconnect to the room before saving.');
      return;
    }
    submittedAppearance.current = JSON.stringify(draft);
    setMessage('Applying appearance…');
  };

  return (
    <details className="room-appearance">
      <summary aria-label="Host controls">Host Controls</summary>
      <form className="room-appearance-panel" onSubmit={handleSubmit}>
        <div className="room-appearance-heading">
          <div>
            <p className="room-appearance-eyebrow">Host controls</p>
            <h2>Table appearance</h2>
          </div>
          <button
            type="button"
            className="room-appearance-reset"
            onClick={() => {
              setDraft({ ...DEFAULT_ROOM_APPEARANCE });
              setMessage('Defaults ready. Save to apply them.');
            }}
          >
            Reset
          </button>
        </div>

        <div className="room-appearance-colors">
          <ColorField
            id={`${id}-surface`}
            label="Surface"
            value={draft.surfaceColor}
            onChange={(value) => setColor('surfaceColor', value)}
          />
          <ColorField
            id={`${id}-rim`}
            label="Rim"
            value={draft.rimColor}
            onChange={(value) => setColor('rimColor', value)}
          />
          <ColorField
            id={`${id}-background`}
            label="Backdrop"
            value={draft.backgroundColor}
            onChange={(value) => setColor('backgroundColor', value)}
          />
        </div>

        <label className="room-handling-setting">
          <span>
            <strong>Dice handling</strong>
            <small>Choose who may pick up unkept dice for a reroll.</small>
          </span>
          <select
            value={diceHandlingMode}
            onChange={(event) => {
              const hostToken = loadIdentity(roomCode)?.hostToken;
              if (!hostToken) {
                setMessage('The host token is missing on this device.');
                return;
              }
              if (
                updateDiceHandlingMode(hostToken, event.currentTarget.value as DiceHandlingMode)
              ) {
                submittedHandling.current = event.currentTarget.value as DiceHandlingMode;
                setMessage('Updating dice handling…');
              } else {
                submittedHandling.current = null;
                setMessage('Reconnect before changing dice handling.');
              }
            }}
          >
            <option value="owner_only">Owner only</option>
            <option value="shared_rerolls">Shared rerolls</option>
          </select>
        </label>
        <button
          type="button"
          className="room-clear-all"
          onClick={() => {
            if (
              !window.confirm('Clear every visible die from the table? Roll history will remain.')
            ) {
              return;
            }
            const hostToken = loadIdentity(roomCode)?.hostToken;
            if (!hostToken || !clearAllRoomDice(hostToken)) {
              setMessage('Reconnect as the host before clearing all dice.');
            } else {
              setMessage('Clearing the table…');
            }
          }}
        >
          Clear all visible dice
        </button>

        <div className="room-appearance-image">
          <div
            className="room-appearance-preview"
            style={{
              backgroundColor: draft.surfaceColor,
              ...(draft.backgroundImage
                ? { backgroundImage: `url(${JSON.stringify(draft.backgroundImage)})` }
                : {}),
            }}
            aria-hidden="true"
          />
          <div className="room-appearance-image-actions">
            <label className="btn btn-ghost room-appearance-upload">
              {processingImage
                ? 'Preparing…'
                : draft.backgroundImage
                  ? 'Replace image'
                  : 'Choose image'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={processingImage}
                onChange={(event) => {
                  void handleImage(event.currentTarget.files?.[0]);
                  event.currentTarget.value = '';
                }}
              />
            </label>
            {draft.backgroundImage && (
              <button
                type="button"
                className="room-appearance-remove"
                onClick={() => {
                  setDraft((current) => ({ ...current, backgroundImage: null }));
                  setMessage('Image removed. Save to apply the surface color.');
                }}
              >
                Remove
              </button>
            )}
            <span>PNG, JPEG, or WebP · 10 MB max</span>
          </div>
        </div>

        <div className="room-appearance-footer">
          <span className="room-appearance-message" role="status" aria-live="polite">
            {message}
          </span>
          <button type="submit" className="btn btn-primary" disabled={processingImage}>
            Save
          </button>
        </div>
      </form>
    </details>
  );
}

interface ColorFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}

function ColorField({ id, label, value, onChange }: ColorFieldProps) {
  return (
    <label className="room-appearance-color" htmlFor={id}>
      <input
        id={id}
        type="color"
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
      <span>{label}</span>
      <output>{value.toUpperCase()}</output>
    </label>
  );
}
