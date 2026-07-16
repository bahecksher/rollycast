import {
  ClientMessageType,
  ErrorCode,
  ServerMessageType,
  buildMessage,
  generateId,
  getColor,
  parseServerMessage,
  type JoinedPayload,
} from '@rollycast/shared';
import PartySocket from 'partysocket';
import { useEffect } from 'react';
import { loadIdentity, saveIdentity } from '../state/identity';
import { useLocalRoller } from '../state/localRoller';
import { useInspectionStore } from '../state/inspectionStore';
import { useRoomStore } from '../state/roomStore';
import { setActiveRoomSocket } from './roomCommands';

export interface JoinProfile {
  displayName: string;
  colorId: string;
}

function applyJoined(roomCode: string, payload: JoinedPayload): void {
  const previous = loadIdentity(roomCode);
  saveIdentity(roomCode, {
    playerId: payload.playerId,
    sessionToken: payload.sessionToken,
    displayName: payload.displayName,
    colorId: payload.colorId,
    hostToken: payload.hostToken ?? previous?.hostToken,
  });

  useRoomStore.getState().setSelf({
    playerId: payload.playerId,
    displayName: payload.displayName,
    colorId: payload.colorId,
    isHost: payload.isHost,
  });
  useRoomStore.getState().setStatus('connected');

  const color = getColor(payload.colorId);
  if (color) useLocalRoller.getState().setColor({ hex: color.hex, text: color.text });
}

/** When our own player is updated (name/color), mirror it into self, local identity, and dice color. */
function applySelfUpdate(
  roomCode: string,
  player: { id: string; displayName: string; colorId: string },
): void {
  const self = useRoomStore.getState().self;
  if (!self || self.playerId !== player.id) return;
  useRoomStore
    .getState()
    .setSelf({ ...self, displayName: player.displayName, colorId: player.colorId });
  const identity = loadIdentity(roomCode);
  if (identity) {
    saveIdentity(roomCode, {
      ...identity,
      displayName: player.displayName,
      colorId: player.colorId,
    });
  }
  const color = getColor(player.colorId);
  if (color) useLocalRoller.getState().setColor({ hex: color.hex, text: color.text });
}

/** Owns the reconnecting PartySocket and projects validated room events into the Zustand store. */
export function useRoomConnection(roomCode: string, profile: JoinProfile | null): void {
  useEffect(() => {
    useRoomStore.getState().reset();
    useLocalRoller.getState().resetRoom();
    useInspectionStore.getState().reset();
    if (!profile) return;

    let active = true;
    const socket = new PartySocket({
      host: window.location.host,
      party: 'room',
      room: roomCode,
    });
    const store = useRoomStore.getState;
    setActiveRoomSocket(socket);
    store().setStatus('connecting');

    const onOpen = () => {
      if (!active) return;
      const identity = loadIdentity(roomCode);
      store().setStatus('connecting');
      store().setError(null);
      socket.send(
        JSON.stringify(
          buildMessage(
            ClientMessageType.JOIN_ROOM,
            {
              roomCode,
              displayName: identity?.displayName ?? profile.displayName,
              colorId: identity?.colorId ?? profile.colorId,
              ...(identity
                ? { playerId: identity.playerId, sessionToken: identity.sessionToken }
                : {}),
            },
            generateId('req'),
          ),
        ),
      );
    };

    const onClose = () => {
      if (active && store().status !== 'error') store().setStatus('reconnecting');
    };

    const onMessage = (event: MessageEvent) => {
      if (!active || typeof event.data !== 'string') return;
      let raw: unknown;
      try {
        raw = JSON.parse(event.data);
      } catch {
        return;
      }
      const parsed = parseServerMessage(raw);
      if (!parsed.ok) return;
      const message = parsed.message;

      switch (message.type) {
        case ServerMessageType.JOINED:
          applyJoined(roomCode, message.payload);
          break;
        case ServerMessageType.ROOM_STATE:
          store().setPlayers(message.payload.snapshot.players);
          store().setSettings(message.payload.snapshot.settings);
          useLocalRoller.getState().hydrateSnapshot(message.payload.snapshot);
          break;
        case ServerMessageType.PLAYER_JOINED:
          store().upsertPlayer(message.payload.player);
          break;
        case ServerMessageType.PLAYER_UPDATED: {
          const updated = message.payload.player;
          const previous = store().players.find((player) => player.id === updated.id);
          store().upsertPlayer(updated);
          applySelfUpdate(roomCode, updated);
          if (previous) {
            const colorHex = getColor(updated.colorId)?.hex ?? '#8a8f98';
            if (previous.displayName !== updated.displayName) {
              useLocalRoller
                .getState()
                .logEvent(
                  `Name change: ${previous.displayName} → ${updated.displayName}`,
                  colorHex,
                );
            }
            if (previous.colorId !== updated.colorId) {
              useLocalRoller.getState().logEvent(`Color switch: ${updated.displayName}`, colorHex);
            }
          }
          break;
        }
        case ServerMessageType.PLAYER_DISCONNECTED:
          store().setPlayerConnected(message.payload.playerId, false);
          break;
        case ServerMessageType.PLAYER_LEFT:
          store().removePlayer(message.payload.playerId);
          break;
        case ServerMessageType.ROOM_SETTINGS_UPDATED:
          store().setSettings(message.payload.settings);
          break;
        case ServerMessageType.ROLL_CREATED:
          useLocalRoller
            .getState()
            .receiveRollCreated(
              message.payload,
              store().self?.playerId,
              store().players.find((player) => player.id === message.payload.ownerPlayerId)
                ?.displayName,
            );
          break;
        case ServerMessageType.ROLL_TRANSFORMS:
          useLocalRoller.getState().receiveTransforms(message.payload);
          break;
        case ServerMessageType.ROLL_FINALIZED:
          useLocalRoller.getState().receiveFinalized(message.payload);
          break;
        case ServerMessageType.GRAB_DICE_GRANTED:
          useLocalRoller.getState().receiveGrabGranted(message.payload, store().self?.playerId);
          break;
        case ServerMessageType.GRAB_DICE_DENIED:
          useLocalRoller.getState().receiveGrabDenied(message.payload.reason);
          break;
        case ServerMessageType.DICE_GRABBED:
          useLocalRoller
            .getState()
            .receiveDiceGrabbed(message.payload.grabLock, store().self?.playerId);
          break;
        case ServerMessageType.HELD_DICE_TRANSFORMS:
          useLocalRoller.getState().receiveHeldTransforms(message.payload);
          break;
        case ServerMessageType.GRAB_CANCELED:
          useLocalRoller.getState().receiveGrabCanceled(message.payload);
          break;
        case ServerMessageType.REROLL_CREATED:
          useLocalRoller
            .getState()
            .receiveRerollCreated(
              message.payload,
              store().self?.playerId,
              store().players.find((player) => player.id === message.payload.ownerPlayerId)
                ?.displayName,
            );
          break;
        case ServerMessageType.DICE_MOVED:
          useLocalRoller.getState().receiveDiceMoved(message.payload);
          break;
        case ServerMessageType.DIE_KEPT_UPDATED:
          useLocalRoller.getState().receiveKeptUpdated(message.payload);
          break;
        case ServerMessageType.ROLL_CLEARED:
          useLocalRoller.getState().receiveRollCleared(message.payload);
          if (useInspectionStore.getState().selectedRollId === message.payload.rollId) {
            useInspectionStore.getState().clearInspection();
          }
          break;
        case ServerMessageType.ALL_DICE_CLEARED:
          useLocalRoller.getState().receiveDiceCleared(message.payload);
          if (
            useInspectionStore.getState().selectedDieId &&
            message.payload.dieIds.includes(useInspectionStore.getState().selectedDieId!)
          ) {
            useInspectionStore.getState().clearInspection();
          }
          break;
        case ServerMessageType.ROLL_REACTION:
          useLocalRoller.getState().receiveReaction(message.payload);
          break;
        case ServerMessageType.ROOM_CLOSED:
          store().setError('This room has expired.');
          store().setStatus('error');
          socket.close(1000, 'Room closed');
          break;
        case ServerMessageType.ERROR:
          store().setError(message.payload.message);
          if (
            message.payload.code === ErrorCode.ROOM_NOT_FOUND ||
            message.payload.code === ErrorCode.ROOM_EXPIRED ||
            message.payload.code === ErrorCode.ROOM_FULL ||
            message.payload.code === ErrorCode.JOINING_LOCKED
          ) {
            store().setStatus('error');
            socket.close(1000, message.payload.code);
          }
          break;
        default:
          // Roll and interaction events are connected in their respective milestones.
          break;
      }
    };

    socket.addEventListener('open', onOpen);
    socket.addEventListener('close', onClose);
    socket.addEventListener('message', onMessage);

    return () => {
      active = false;
      socket.removeEventListener('open', onOpen);
      socket.removeEventListener('close', onClose);
      socket.removeEventListener('message', onMessage);
      socket.close(1000, 'Leaving room');
      setActiveRoomSocket(null);
      useLocalRoller.getState().resetRoom();
      useInspectionStore.getState().reset();
      store().reset();
    };
  }, [profile, roomCode]);
}
