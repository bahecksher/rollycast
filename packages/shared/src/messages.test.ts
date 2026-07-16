import { describe, expect, it } from 'vitest';
import { buildMessage, parseClientMessage } from './messages';
import { ClientMessageType } from './protocol';

describe('client message validation', () => {
  it('accepts a well-formed JOIN_ROOM message', () => {
    const msg = buildMessage(ClientMessageType.JOIN_ROOM, {
      roomCode: 'K7M4PX',
      displayName: 'Brett',
      colorId: 'crimson',
    });
    const result = parseClientMessage(msg);
    expect(result.ok).toBe(true);
  });

  it('accepts a ROLL_REQUEST with a gesture', () => {
    const msg = buildMessage(ClientMessageType.ROLL_REQUEST, {
      clientRollId: 'cr_1',
      dice: [{ type: 'd20', quantity: 1 }],
      modifier: 2,
      gesture: {
        startPosition: [0, 1, 0],
        releasePosition: [1, 1, 1],
        velocity: [2, 0, -3],
        durationMs: 120,
      },
    });
    expect(parseClientMessage(msg).ok).toBe(true);
  });

  it('rejects an unknown message type', () => {
    expect(parseClientMessage({ version: 1, type: 'NONSENSE', timestamp: 1, payload: {} }).ok).toBe(
      false,
    );
  });

  it('rejects a wrong protocol version', () => {
    const msg = { ...buildMessage(ClientMessageType.PING, {}), version: 2 };
    expect(parseClientMessage(msg).ok).toBe(false);
  });

  it('rejects a malformed payload', () => {
    const msg = buildMessage(ClientMessageType.JOIN_ROOM, { roomCode: 'K7M4PX' });
    expect(parseClientMessage(msg).ok).toBe(false);
  });

  it('accepts validated host appearance settings', () => {
    const msg = buildMessage(ClientMessageType.UPDATE_ROOM_SETTINGS, {
      hostToken: 'secret',
      appearance: {
        surfaceColor: '#234567',
        backgroundImage: 'data:image/jpeg;base64,YWJjZA==',
      },
    });
    expect(parseClientMessage(msg).ok).toBe(true);
  });

  it('rejects unsafe or malformed host appearance settings', () => {
    const svg = buildMessage(ClientMessageType.UPDATE_ROOM_SETTINGS, {
      hostToken: 'secret',
      appearance: { backgroundImage: 'data:image/svg+xml;base64,PHN2Zz4=' },
    });
    const badColor = buildMessage(ClientMessageType.UPDATE_ROOM_SETTINGS, {
      hostToken: 'secret',
      appearance: { rimColor: 'red' },
    });
    expect(parseClientMessage(svg).ok).toBe(false);
    expect(parseClientMessage(badColor).ok).toBe(false);
  });

  it('rejects non-object input', () => {
    expect(parseClientMessage('not json').ok).toBe(false);
    expect(parseClientMessage(null).ok).toBe(false);
  });
});
