import { z } from 'zod';

/** Bump only on a breaking wire change. All messages carry this (spec §24). */
export const PROTOCOL_VERSION = 1;

/** Max accepted WebSocket message size in bytes (spec §34). */
export const MAX_MESSAGE_BYTES = 64 * 1024;

// --- Geometry primitives ---------------------------------------------------

export const vec3Schema = z.tuple([z.number(), z.number(), z.number()]);
export type Vec3 = z.infer<typeof vec3Schema>;

export const quatSchema = z.tuple([z.number(), z.number(), z.number(), z.number()]);
export type Quat = z.infer<typeof quatSchema>;

export const dieTransformSchema = z.object({
  dieId: z.string(),
  position: vec3Schema,
  rotation: quatSchema,
});
export type DieTransform = z.infer<typeof dieTransformSchema>;

/** A throw gesture captured on release and approved by the server (spec §25.3). */
export const throwGestureSchema = z.object({
  startPosition: vec3Schema,
  releasePosition: vec3Schema,
  velocity: vec3Schema,
  durationMs: z.number().nonnegative(),
});
export type ThrowGesture = z.infer<typeof throwGestureSchema>;

// --- Message type names ----------------------------------------------------

export const ClientMessageType = {
  JOIN_ROOM: 'JOIN_ROOM',
  UPDATE_PLAYER: 'UPDATE_PLAYER',
  ROLL_REQUEST: 'ROLL_REQUEST',
  ROLL_TRANSFORMS: 'ROLL_TRANSFORMS',
  ROLL_SETTLED: 'ROLL_SETTLED',
  GRAB_DICE_REQUEST: 'GRAB_DICE_REQUEST',
  HELD_DICE_TRANSFORMS: 'HELD_DICE_TRANSFORMS',
  RELEASE_DICE_AS_REROLL: 'RELEASE_DICE_AS_REROLL',
  RELEASE_MOVED_DICE: 'RELEASE_MOVED_DICE',
  CANCEL_DICE_GRAB: 'CANCEL_DICE_GRAB',
  SET_DIE_KEPT: 'SET_DIE_KEPT',
  CLEAR_ROLL: 'CLEAR_ROLL',
  CLEAR_OWN_UNKEPT_DICE: 'CLEAR_OWN_UNKEPT_DICE',
  REACT_TO_ROLL: 'REACT_TO_ROLL',
  DIE_EMOTE: 'DIE_EMOTE',
  KEEP_ROLL_ALIVE: 'KEEP_ROLL_ALIVE',
  UPDATE_ROOM_SETTINGS: 'UPDATE_ROOM_SETTINGS',
  CLEAR_ALL_DICE: 'CLEAR_ALL_DICE',
  PING: 'PING',
} as const;
export type ClientMessageType = (typeof ClientMessageType)[keyof typeof ClientMessageType];

export const ServerMessageType = {
  JOINED: 'JOINED',
  ROOM_STATE: 'ROOM_STATE',
  PLAYER_JOINED: 'PLAYER_JOINED',
  PLAYER_UPDATED: 'PLAYER_UPDATED',
  PLAYER_DISCONNECTED: 'PLAYER_DISCONNECTED',
  PLAYER_LEFT: 'PLAYER_LEFT',
  ROOM_SETTINGS_UPDATED: 'ROOM_SETTINGS_UPDATED',
  ROLL_CREATED: 'ROLL_CREATED',
  ROLL_TRANSFORMS: 'ROLL_TRANSFORMS',
  ROLL_FINALIZED: 'ROLL_FINALIZED',
  GRAB_DICE_GRANTED: 'GRAB_DICE_GRANTED',
  GRAB_DICE_DENIED: 'GRAB_DICE_DENIED',
  DICE_GRABBED: 'DICE_GRABBED',
  HELD_DICE_TRANSFORMS: 'HELD_DICE_TRANSFORMS',
  DICE_MOVED: 'DICE_MOVED',
  REROLL_CREATED: 'REROLL_CREATED',
  GRAB_CANCELED: 'GRAB_CANCELED',
  DIE_KEPT_UPDATED: 'DIE_KEPT_UPDATED',
  ROLL_CLEARED: 'ROLL_CLEARED',
  ALL_DICE_CLEARED: 'ALL_DICE_CLEARED',
  ROLL_REACTION: 'ROLL_REACTION',
  DIE_EMOTE: 'DIE_EMOTE',
  ROLL_EXPIRY_EXTENDED: 'ROLL_EXPIRY_EXTENDED',
  ROOM_CLOSED: 'ROOM_CLOSED',
  PONG: 'PONG',
  ERROR: 'ERROR',
} as const;
export type ServerMessageType = (typeof ServerMessageType)[keyof typeof ServerMessageType];

/** Machine-readable error codes for the ERROR message (spec §39). */
export const ErrorCode = {
  ROOM_NOT_FOUND: 'ROOM_NOT_FOUND',
  ROOM_EXPIRED: 'ROOM_EXPIRED',
  ROOM_FULL: 'ROOM_FULL',
  JOINING_LOCKED: 'JOINING_LOCKED',
  INVALID_DISPLAY_NAME: 'INVALID_DISPLAY_NAME',
  INVALID_DICE_SELECTION: 'INVALID_DICE_SELECTION',
  RATE_LIMITED: 'RATE_LIMITED',
  DIE_UNAVAILABLE: 'DIE_UNAVAILABLE',
  DIE_ALREADY_HELD: 'DIE_ALREADY_HELD',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  SHARED_REROLLS_DISABLED: 'SHARED_REROLLS_DISABLED',
  KEPT_DIE_LOCKED: 'KEPT_DIE_LOCKED',
  GRAB_LOCK_EXPIRED: 'GRAB_LOCK_EXPIRED',
  VISIBLE_DICE_LIMIT: 'VISIBLE_DICE_LIMIT',
  KEPT_DICE_LIMIT: 'KEPT_DICE_LIMIT',
  NOT_HOST: 'NOT_HOST',
  BAD_MESSAGE: 'BAD_MESSAGE',
  MESSAGE_TOO_LARGE: 'MESSAGE_TOO_LARGE',
  INTERNAL: 'INTERNAL',
} as const;
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/**
 * Wrap a payload schema in the standard message envelope. Used to build the client and
 * server message unions in `messages.ts`.
 */
export function envelope<T extends string, P extends z.ZodTypeAny>(type: T, payload: P) {
  return z.object({
    version: z.literal(PROTOCOL_VERSION),
    type: z.literal(type),
    requestId: z.string().optional(),
    timestamp: z.number(),
    payload,
  });
}
