import {
  DEFAULT_ROOM_APPEARANCE,
  type DiceHandlingMode,
  type PublicGrabLock,
  type PublicPlayer,
  type RollRecord,
  type RollCreatedPayload,
  type RoomSettings,
  type RoomSnapshot,
  type VisibleDie,
} from '@rollycast/shared';
/** Server-internal player record — includes the hashed session token (never broadcast). */
export interface ServerPlayer {
  id: string;
  sessionTokenHash: string;
  displayName: string;
  colorId: string;
  connected: boolean;
  isHost: boolean;
  joinedAt: number;
  lastSeenAt: number;
  /** When the player's last connection dropped; drives the 60s grace before removal. */
  disconnectedAt?: number;
}

/** Server-internal grab lock — includes original transforms for cancel/restore (spec §29.6). */
export interface ServerGrabLock {
  id: string;
  dieIds: string[];
  controllerPlayerId: string;
  action: 'move' | 'reroll';
  createdAt: number;
  lastActivityAt: number;
  lastSequence?: number;
  originalTransforms: Array<{
    dieId: string;
    position: [number, number, number];
    rotation: [number, number, number, number];
  }>;
}

/** Server-only control state for a roll whose official result already exists. */
export interface ServerActiveRoll {
  payload: RollCreatedPayload;
  lastSequence: number;
  settled: boolean;
}

/** The full authoritative room state persisted in Durable Object storage (spec §29.1). */
export interface RoomState {
  code: string;
  createdAt: number;
  lastActivityAt: number;
  hostTokenHash: string;
  settings: RoomSettings;
  players: Record<string, ServerPlayer>;
  rolls: RollRecord[];
  visibleDice: Record<string, VisibleDie>;
  grabLocks: Record<string, ServerGrabLock>;
  /** Idempotency guard: clientRollId → rollId already created (spec §27). */
  clientRollIds: Record<string, string>;
  activeRolls: Record<string, ServerActiveRoll>;
  roomVersion: number;
}

export function createRoomState(code: string, hostTokenHash: string, now: number): RoomState {
  return {
    code,
    createdAt: now,
    lastActivityAt: now,
    hostTokenHash,
    settings: {
      diceHandlingMode: 'owner_only',
      joiningLocked: false,
      appearance: { ...DEFAULT_ROOM_APPEARANCE },
    },
    players: {},
    rolls: [],
    visibleDice: {},
    grabLocks: {},
    clientRollIds: {},
    activeRolls: {},
    roomVersion: 0,
  };
}

export function toPublicPlayer(player: ServerPlayer): PublicPlayer {
  return {
    id: player.id,
    displayName: player.displayName,
    colorId: player.colorId,
    connected: player.connected,
    isHost: player.isHost,
    joinedAt: player.joinedAt,
  };
}

export function toPublicGrabLock(lock: ServerGrabLock): PublicGrabLock {
  return {
    id: lock.id,
    dieIds: lock.dieIds,
    controllerPlayerId: lock.controllerPlayerId,
    action: lock.action,
  };
}

/** Build the snapshot delivered to a (re)joining client (spec §20.4). */
export function toRoomSnapshot(room: RoomState, now: number): RoomSnapshot {
  return {
    code: room.code,
    settings: {
      ...room.settings,
      appearance: {
        ...DEFAULT_ROOM_APPEARANCE,
        ...room.settings.appearance,
      },
    },
    players: Object.values(room.players).map(toPublicPlayer),
    visibleDice: Object.values(room.visibleDice),
    rolls: room.rolls,
    grabLocks: Object.values(room.grabLocks).map(toPublicGrabLock),
    roomVersion: room.roomVersion,
    serverTime: now,
  };
}

export function connectedPlayerCount(room: RoomState): number {
  return Object.values(room.players).filter((p) => p.connected).length;
}

export function takenColorIds(room: RoomState): string[] {
  return Object.values(room.players).map((p) => p.colorId);
}

export function isDiceHandlingMode(value: unknown): value is DiceHandlingMode {
  return value === 'owner_only' || value === 'shared_rerolls';
}
