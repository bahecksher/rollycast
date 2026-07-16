import { z } from 'zod';
import { diceSelectionSchema } from './dice';
import {
  ClientMessageType,
  PROTOCOL_VERSION,
  ServerMessageType,
  dieTransformSchema,
  envelope,
  throwGestureSchema,
} from './protocol';
import {
  diceHandlingModeSchema,
  grabActionSchema,
  publicGrabLockSchema,
  publicPlayerSchema,
  rollReactionSchema,
  roomAppearanceUpdateSchema,
  roomSettingsSchema,
  roomSnapshotSchema,
  rolledDieSchema,
} from './state';

// ===========================================================================
// Client → Server payloads (spec §25)
// ===========================================================================

export const joinRoomPayloadSchema = z.object({
  roomCode: z.string(),
  playerId: z.string().optional(),
  sessionToken: z.string().optional(),
  displayName: z.string(),
  colorId: z.string(),
});
export type JoinRoomPayload = z.infer<typeof joinRoomPayloadSchema>;

export const updatePlayerPayloadSchema = z.object({
  displayName: z.string().optional(),
  colorId: z.string().optional(),
});
export type UpdatePlayerPayload = z.infer<typeof updatePlayerPayloadSchema>;

export const rollRequestPayloadSchema = z.object({
  clientRollId: z.string(),
  dice: z.array(diceSelectionSchema),
  modifier: z.number().int(),
  gesture: throwGestureSchema,
});
export type RollRequestPayload = z.infer<typeof rollRequestPayloadSchema>;

export const rollTransformsPayloadSchema = z.object({
  rollId: z.string(),
  sequence: z.number().int(),
  transforms: z.array(dieTransformSchema),
});
export type RollTransformsPayload = z.infer<typeof rollTransformsPayloadSchema>;

/** The face a physics-settled die actually landed on, as reported by the rolling client. */
export const dieResultSchema = z.object({
  dieId: z.string(),
  result: z.number().int(),
});
export type DieResult = z.infer<typeof dieResultSchema>;

export const rollSettledPayloadSchema = z.object({
  rollId: z.string(),
  transforms: z.array(dieTransformSchema),
  /** Landed faces from the visible physics. Absent only for server-fallback finalization. */
  results: z.array(dieResultSchema).optional(),
});
export type RollSettledPayload = z.infer<typeof rollSettledPayloadSchema>;

export const grabDiceRequestPayloadSchema = z.object({
  dieIds: z.array(z.string()).min(1),
  intendedAction: grabActionSchema,
});
export type GrabDiceRequestPayload = z.infer<typeof grabDiceRequestPayloadSchema>;

export const heldDiceTransformsPayloadSchema = z.object({
  grabLockId: z.string(),
  sequence: z.number().int(),
  transforms: z.array(dieTransformSchema),
});
export type HeldDiceTransformsPayload = z.infer<typeof heldDiceTransformsPayloadSchema>;

export const releaseDiceAsRerollPayloadSchema = z.object({
  grabLockId: z.string(),
  clientRollId: z.string(),
  gesture: throwGestureSchema,
});
export type ReleaseDiceAsRerollPayload = z.infer<typeof releaseDiceAsRerollPayloadSchema>;

export const releaseMovedDicePayloadSchema = z.object({
  grabLockId: z.string(),
  transforms: z.array(dieTransformSchema),
});
export type ReleaseMovedDicePayload = z.infer<typeof releaseMovedDicePayloadSchema>;

export const cancelDiceGrabPayloadSchema = z.object({
  grabLockId: z.string(),
});
export type CancelDiceGrabPayload = z.infer<typeof cancelDiceGrabPayloadSchema>;

export const setDieKeptPayloadSchema = z.object({
  dieId: z.string(),
  kept: z.boolean(),
});
export type SetDieKeptPayload = z.infer<typeof setDieKeptPayloadSchema>;

export const clearRollPayloadSchema = z.object({
  rollId: z.string(),
});
export type ClearRollPayload = z.infer<typeof clearRollPayloadSchema>;

export const reactToRollPayloadSchema = z.object({
  rollId: z.string(),
  reaction: rollReactionSchema,
});
export type ReactToRollPayload = z.infer<typeof reactToRollPayloadSchema>;

export const updateRoomSettingsPayloadSchema = z.object({
  hostToken: z.string(),
  diceHandlingMode: diceHandlingModeSchema.optional(),
  joiningLocked: z.boolean().optional(),
  appearance: roomAppearanceUpdateSchema.optional(),
});
export type UpdateRoomSettingsPayload = z.infer<typeof updateRoomSettingsPayloadSchema>;

export const clearAllDicePayloadSchema = z.object({
  hostToken: z.string(),
});
export type ClearAllDicePayload = z.infer<typeof clearAllDicePayloadSchema>;

export const pingPayloadSchema = z.object({
  clientTime: z.number().optional(),
});
export type PingPayload = z.infer<typeof pingPayloadSchema>;

const emptyPayloadSchema = z.object({}).strict();

/** Discriminated union of every valid client → server message. */
export const clientMessageSchema = z.discriminatedUnion('type', [
  envelope(ClientMessageType.JOIN_ROOM, joinRoomPayloadSchema),
  envelope(ClientMessageType.UPDATE_PLAYER, updatePlayerPayloadSchema),
  envelope(ClientMessageType.ROLL_REQUEST, rollRequestPayloadSchema),
  envelope(ClientMessageType.ROLL_TRANSFORMS, rollTransformsPayloadSchema),
  envelope(ClientMessageType.ROLL_SETTLED, rollSettledPayloadSchema),
  envelope(ClientMessageType.GRAB_DICE_REQUEST, grabDiceRequestPayloadSchema),
  envelope(ClientMessageType.HELD_DICE_TRANSFORMS, heldDiceTransformsPayloadSchema),
  envelope(ClientMessageType.RELEASE_DICE_AS_REROLL, releaseDiceAsRerollPayloadSchema),
  envelope(ClientMessageType.RELEASE_MOVED_DICE, releaseMovedDicePayloadSchema),
  envelope(ClientMessageType.CANCEL_DICE_GRAB, cancelDiceGrabPayloadSchema),
  envelope(ClientMessageType.SET_DIE_KEPT, setDieKeptPayloadSchema),
  envelope(ClientMessageType.CLEAR_ROLL, clearRollPayloadSchema),
  envelope(ClientMessageType.CLEAR_OWN_UNKEPT_DICE, emptyPayloadSchema),
  envelope(ClientMessageType.REACT_TO_ROLL, reactToRollPayloadSchema),
  envelope(ClientMessageType.UPDATE_ROOM_SETTINGS, updateRoomSettingsPayloadSchema),
  envelope(ClientMessageType.CLEAR_ALL_DICE, clearAllDicePayloadSchema),
  envelope(ClientMessageType.PING, pingPayloadSchema),
]);
export type ClientMessage = z.infer<typeof clientMessageSchema>;

// ===========================================================================
// Server → Client payloads (spec §26, §27)
// ===========================================================================

/** Private acknowledgement to the joining connection with its assigned identity + secrets. */
export const joinedPayloadSchema = z.object({
  roomCode: z.string(),
  playerId: z.string(),
  sessionToken: z.string(),
  hostToken: z.string().optional(),
  displayName: z.string(),
  colorId: z.string(),
  isHost: z.boolean(),
});
export type JoinedPayload = z.infer<typeof joinedPayloadSchema>;

export const roomStatePayloadSchema = z.object({
  snapshot: roomSnapshotSchema,
});
export type RoomStatePayload = z.infer<typeof roomStatePayloadSchema>;

export const playerEventPayloadSchema = z.object({
  player: publicPlayerSchema,
});
export type PlayerEventPayload = z.infer<typeof playerEventPayloadSchema>;

export const playerIdPayloadSchema = z.object({
  playerId: z.string(),
});
export type PlayerIdPayload = z.infer<typeof playerIdPayloadSchema>;

export const roomSettingsUpdatedPayloadSchema = z.object({
  settings: roomSettingsSchema,
});
export type RoomSettingsUpdatedPayload = z.infer<typeof roomSettingsUpdatedPayloadSchema>;

/** Server-authoritative roll creation (spec §27), used for original rolls. */
export const rollCreatedPayloadSchema = z.object({
  rollId: z.string(),
  clientRollId: z.string(),
  ownerPlayerId: z.string(),
  actingPlayerId: z.string(),
  colorId: z.string(),
  sourceRollId: z.string().optional(),
  dice: z.array(rolledDieSchema),
  modifier: z.number().int(),
  total: z.number().int(),
  launchSeed: z.string(),
  approvedGesture: throwGestureSchema,
  createdAt: z.number(),
});
export type RollCreatedPayload = z.infer<typeof rollCreatedPayloadSchema>;

/** A reroll: same as a roll creation, plus the ids of the source dice it replaces. */
export const rerollCreatedPayloadSchema = rollCreatedPayloadSchema.extend({
  replacedDieIds: z.array(z.string()),
});
export type RerollCreatedPayload = z.infer<typeof rerollCreatedPayloadSchema>;

export const rollFinalizedPayloadSchema = z.object({
  rollId: z.string(),
  transforms: z.array(dieTransformSchema),
  /** Final per-die faces so every client records the same physics-decided result. */
  results: z.array(dieResultSchema).optional(),
});
export type RollFinalizedPayload = z.infer<typeof rollFinalizedPayloadSchema>;

export const grabGrantedPayloadSchema = z.object({
  grabLockId: z.string(),
  dieIds: z.array(z.string()),
  action: grabActionSchema,
});
export type GrabGrantedPayload = z.infer<typeof grabGrantedPayloadSchema>;

export const grabDeniedPayloadSchema = z.object({
  dieIds: z.array(z.string()),
  reason: z.string(),
});
export type GrabDeniedPayload = z.infer<typeof grabDeniedPayloadSchema>;

export const diceGrabbedPayloadSchema = z.object({
  grabLock: publicGrabLockSchema,
});
export type DiceGrabbedPayload = z.infer<typeof diceGrabbedPayloadSchema>;

export const diceMovedPayloadSchema = z.object({
  grabLockId: z.string(),
  transforms: z.array(dieTransformSchema),
});
export type DiceMovedPayload = z.infer<typeof diceMovedPayloadSchema>;

export const grabCanceledPayloadSchema = z.object({
  grabLockId: z.string(),
  transforms: z.array(dieTransformSchema),
});
export type GrabCanceledPayload = z.infer<typeof grabCanceledPayloadSchema>;

export const dieKeptUpdatedPayloadSchema = z.object({
  dieId: z.string(),
  kept: z.boolean(),
});
export type DieKeptUpdatedPayload = z.infer<typeof dieKeptUpdatedPayloadSchema>;

export const rollClearedPayloadSchema = z.object({
  rollId: z.string(),
  dieIds: z.array(z.string()),
});
export type RollClearedPayload = z.infer<typeof rollClearedPayloadSchema>;

export const allDiceClearedPayloadSchema = z.object({
  dieIds: z.array(z.string()),
});
export type AllDiceClearedPayload = z.infer<typeof allDiceClearedPayloadSchema>;

export const rollReactionPayloadSchema = z.object({
  rollId: z.string(),
  reaction: rollReactionSchema,
  playerId: z.string(),
});
export type RollReactionPayload = z.infer<typeof rollReactionPayloadSchema>;

export const roomClosedPayloadSchema = z.object({
  reason: z.string().optional(),
});
export type RoomClosedPayload = z.infer<typeof roomClosedPayloadSchema>;

export const pongPayloadSchema = z.object({
  clientTime: z.number().optional(),
  serverTime: z.number(),
});
export type PongPayload = z.infer<typeof pongPayloadSchema>;

export const errorPayloadSchema = z.object({
  code: z.string(),
  message: z.string(),
  requestId: z.string().optional(),
});
export type ErrorPayload = z.infer<typeof errorPayloadSchema>;

/** Discriminated union of every valid server → client message. */
export const serverMessageSchema = z.discriminatedUnion('type', [
  envelope(ServerMessageType.JOINED, joinedPayloadSchema),
  envelope(ServerMessageType.ROOM_STATE, roomStatePayloadSchema),
  envelope(ServerMessageType.PLAYER_JOINED, playerEventPayloadSchema),
  envelope(ServerMessageType.PLAYER_UPDATED, playerEventPayloadSchema),
  envelope(ServerMessageType.PLAYER_DISCONNECTED, playerIdPayloadSchema),
  envelope(ServerMessageType.PLAYER_LEFT, playerIdPayloadSchema),
  envelope(ServerMessageType.ROOM_SETTINGS_UPDATED, roomSettingsUpdatedPayloadSchema),
  envelope(ServerMessageType.ROLL_CREATED, rollCreatedPayloadSchema),
  envelope(ServerMessageType.ROLL_TRANSFORMS, rollTransformsPayloadSchema),
  envelope(ServerMessageType.ROLL_FINALIZED, rollFinalizedPayloadSchema),
  envelope(ServerMessageType.GRAB_DICE_GRANTED, grabGrantedPayloadSchema),
  envelope(ServerMessageType.GRAB_DICE_DENIED, grabDeniedPayloadSchema),
  envelope(ServerMessageType.DICE_GRABBED, diceGrabbedPayloadSchema),
  envelope(ServerMessageType.HELD_DICE_TRANSFORMS, heldDiceTransformsPayloadSchema),
  envelope(ServerMessageType.DICE_MOVED, diceMovedPayloadSchema),
  envelope(ServerMessageType.REROLL_CREATED, rerollCreatedPayloadSchema),
  envelope(ServerMessageType.GRAB_CANCELED, grabCanceledPayloadSchema),
  envelope(ServerMessageType.DIE_KEPT_UPDATED, dieKeptUpdatedPayloadSchema),
  envelope(ServerMessageType.ROLL_CLEARED, rollClearedPayloadSchema),
  envelope(ServerMessageType.ALL_DICE_CLEARED, allDiceClearedPayloadSchema),
  envelope(ServerMessageType.ROLL_REACTION, rollReactionPayloadSchema),
  envelope(ServerMessageType.ROOM_CLOSED, roomClosedPayloadSchema),
  envelope(ServerMessageType.PONG, pongPayloadSchema),
  envelope(ServerMessageType.ERROR, errorPayloadSchema),
]);
export type ServerMessage = z.infer<typeof serverMessageSchema>;

// --- Parse + build helpers -------------------------------------------------

export type ParsedMessage<T> = { ok: true; message: T } | { ok: false; error: string };

export function parseClientMessage(raw: unknown): ParsedMessage<ClientMessage> {
  const result = clientMessageSchema.safeParse(raw);
  return result.success
    ? { ok: true, message: result.data }
    : { ok: false, error: result.error.message };
}

export function parseServerMessage(raw: unknown): ParsedMessage<ServerMessage> {
  const result = serverMessageSchema.safeParse(raw);
  return result.success
    ? { ok: true, message: result.data }
    : { ok: false, error: result.error.message };
}

export interface OutgoingMessage<T extends string, P> {
  version: typeof PROTOCOL_VERSION;
  type: T;
  requestId?: string;
  timestamp: number;
  payload: P;
}

/** Construct a well-formed message envelope for sending. */
export function buildMessage<T extends string, P>(
  type: T,
  payload: P,
  requestId?: string,
): OutgoingMessage<T, P> {
  return {
    version: PROTOCOL_VERSION,
    type,
    ...(requestId ? { requestId } : {}),
    timestamp: Date.now(),
    payload,
  };
}
