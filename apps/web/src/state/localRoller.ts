import {
  DICE_COLORS,
  formatDicePool,
  getColor,
  randomOffTheTableSaying,
  rollTotalFromDice,
  type DieTransform,
  type RollCreatedPayload,
  type RollFinalizedPayload,
  type RollRecord,
  type RollTransformsPayload,
  type GrabCanceledPayload,
  type GrabGrantedPayload,
  type HeldDiceTransformsPayload,
  type PublicGrabLock,
  type RerollCreatedPayload,
  type AllDiceClearedPayload,
  type DiceMovedPayload,
  type DieKeptUpdatedPayload,
  type RollClearedPayload,
  type RollReaction,
  type RollReactionEntry,
  type RollReactionPayload,
  type RoomSnapshot,
  type DieEmote,
  type DieEmoteBroadcastPayload,
  type RollExpiryExtendedPayload,
  type DieType,
  type DiceSelection,
} from '@rollycast/shared';
import {
  cancelHeldDiceGrab,
  clearRoomRoll,
  reactToRoomRoll,
  releaseHeldDiceAsMove,
  releaseHeldDiceAsReroll,
  requestDiceReroll,
  requestDiceMove,
  requestRoomRoll,
  sendDieEmote,
  settleRoomRoll,
  setRoomDieKept,
  streamHeldDiceTransforms,
} from '../network/roomCommands';
import {
  clearTransformStream,
  publishTransform,
  transformsForRoll,
} from '../network/transformStream';
import { isSupportedDieType, type SelectableDieType } from '../scene/dice/dieTypes';
import { useRoomStore } from './roomStore';
import type { DieSpec } from '../scene/RollingDie';
import { randomSpawnRotation, throwSpin, spreadSpawnPositions } from '../scene/throwLayout';
import { create } from 'zustand';

export interface LocalRollEntry {
  id: string;
  /** 'roll' (default) is a dice result; 'event' is a table note like a color switch. */
  kind?: 'roll' | 'event';
  expression: string;
  results: number[];
  total: number;
  at: number;
  ownerName?: string;
  /** The roller's die color, used to tint the history row. */
  colorHex?: string;
  /** Text for an 'event' row, e.g. "Color switch: Bee". */
  label?: string;
  /** Who reacted to this roll and how. Server-persisted, so it survives reconnects. */
  reactions: RollReactionEntry[];
}

export interface LocalRollReaction {
  id: string;
  rollId: string;
  reaction: RollReaction;
  playerId: string;
}

/** An emote floating above a die right now. Cosmetic and short-lived; never recorded. */
export interface LocalDieEmote {
  id: string;
  dieId: string;
  emote: DieEmote;
  at: number;
}

const DIE_EMOTE_LIFETIME_MS = 1200;

const DEFAULT_COLOR = DICE_COLORS[0]!;
const UNKEPT_DIE_LIFETIME_MS = 30_000;
const heldStreamTimes = new Map<string, number>();

function clampQuantity(value: number): number {
  return Math.max(1, Math.min(10, Math.round(value)));
}

function heldPositions(
  center: [number, number, number],
  count: number,
): Array<[number, number, number]> {
  return Array.from({ length: count }, (_, index) => {
    const angle = (index / Math.max(count, 1)) * Math.PI * 2;
    const radius = count > 1 ? 0.5 : 0;
    return [center[0] + Math.cos(angle) * radius, center[1], center[2] + Math.sin(angle) * radius];
  });
}

type RollMeta = RollCreatedPayload | RollRecord;

const rollIdOf = (roll: RollMeta) => ('rollId' in roll ? roll.rollId : roll.id);

function entryForRoll(
  roll: RollMeta,
  ownerName?: string,
  colorHex?: string,
): LocalRollEntry | null {
  if (!roll.dice[0]) return null;
  const quantities = new Map<DieType, number>();
  const results: number[] = [];
  for (let index = 0; index < roll.dice.length; index += 1) {
    const die = roll.dice[index]!;
    if (die.percentilePart === 'tens') {
      const ones = roll.dice[index + 1];
      if (ones?.percentilePart !== 'ones') return null;
      const tensDigit = die.result - 1;
      const onesDigit = ones.result - 1;
      results.push(tensDigit === 0 && onesDigit === 0 ? 100 : tensDigit * 10 + onesDigit);
      quantities.set('d100', (quantities.get('d100') ?? 0) + 1);
      index += 1;
      continue;
    }
    results.push(die.result);
    quantities.set(die.type, (quantities.get(die.type) ?? 0) + 1);
  }
  const dice = [...quantities].map(([type, quantity]) => ({ type, quantity }));
  return {
    id: rollIdOf(roll),
    kind: 'roll',
    expression: formatDicePool({ dice, modifier: roll.modifier }),
    results,
    total: roll.total,
    at: roll.createdAt,
    ownerName: 'ownerNameAtRoll' in roll ? roll.ownerNameAtRoll : ownerName,
    colorHex,
    reactions: 'reactions' in roll ? (roll.reactions ?? []) : [],
  };
}

function visibleToSpec(
  die: RoomSnapshot['visibleDice'][number],
  isController = false,
): DieSpec | null {
  if (!isSupportedDieType(die.type)) return null;
  const color = getColor(die.colorId) ?? DEFAULT_COLOR;
  return {
    id: die.id,
    rollId: die.rollId,
    type: die.type,
    colorHex: color.hex,
    textHex: color.text,
    result: die.result,
    ownerPlayerId: die.ownerPlayerId,
    kept: die.kept,
    position: die.position,
    rotation: die.rotation,
    linearVelocity: [0, 0, 0],
    angularVelocity: [0, 0, 0],
    isController,
    status: die.status === 'settled' ? 'settled' : die.status === 'held' ? 'held' : 'rolling',
    expiresAt: die.expiresAt,
    percentilePart: die.percentilePart,
  };
}

interface LocalRollerState {
  color: { hex: string; text: string };
  selection: { type: SelectableDieType; quantity: number };
  pool: DiceSelection[];
  modifier: number;
  activeDice: DieSpec[];
  log: LocalRollEntry[];
  rollMeta: Record<string, RollMeta>;
  ownerNames: Record<string, string>;
  ownerColors: Record<string, string>;
  settledDieIds: string[];
  missedRollIds: string[];
  submittedRollIds: string[];
  pendingGrabDieIds: string[];
  activeGrab: (PublicGrabLock & { isController: boolean }) | null;
  grabMessage: string | null;
  reactions: LocalRollReaction[];
  dieEmotes: LocalDieEmote[];
  setType: (type: SelectableDieType) => void;
  setColor: (color: { hex: string; text: string }) => void;
  setQuantity: (quantity: number) => void;
  setModifier: (modifier: number) => void;
  addSelection: () => void;
  removeSelection: (type: DieType) => void;
  clearPool: () => void;
  throwSelection: (center: [number, number, number], velocity: [number, number, number]) => void;
  hydrateSnapshot: (snapshot: RoomSnapshot) => void;
  receiveRollCreated: (
    payload: RollCreatedPayload,
    selfPlayerId?: string,
    ownerName?: string,
  ) => void;
  receiveTransforms: (payload: RollTransformsPayload) => void;
  receiveFinalized: (payload: RollFinalizedPayload) => void;
  updateTransform: (
    id: string,
    position: [number, number, number],
    rotation: [number, number, number, number],
  ) => void;
  markSettled: (
    id: string,
    position: [number, number, number],
    rotation: [number, number, number, number],
    result: number,
  ) => void;
  dieMissed: (rollId: string) => void;
  requestReroll: (dieIds: string[]) => void;
  requestMove: (dieIds: string[]) => void;
  receiveGrabGranted: (payload: GrabGrantedPayload, selfPlayerId?: string) => void;
  receiveDiceGrabbed: (grabLock: PublicGrabLock, selfPlayerId?: string) => void;
  receiveGrabDenied: (reason: string) => void;
  receiveHeldTransforms: (payload: HeldDiceTransformsPayload) => void;
  moveHeldDice: (center: [number, number, number]) => void;
  releaseActiveGrab: (center: [number, number, number], velocity: [number, number, number]) => void;
  cancelActiveGrab: () => void;
  receiveGrabCanceled: (payload: GrabCanceledPayload) => void;
  receiveRerollCreated: (
    payload: RerollCreatedPayload,
    selfPlayerId?: string,
    ownerName?: string,
  ) => void;
  receiveDiceMoved: (payload: DiceMovedPayload) => void;
  setKept: (dieId: string, kept: boolean) => void;
  receiveKeptUpdated: (payload: DieKeptUpdatedPayload) => void;
  clearRoll: (rollId: string) => void;
  receiveRollCleared: (payload: RollClearedPayload) => void;
  receiveDiceCleared: (payload: AllDiceClearedPayload) => void;
  reactToRoll: (rollId: string, reaction: RollReaction) => void;
  receiveReaction: (payload: RollReactionPayload) => void;
  /** This client's die was knocked into; tell the room so everyone sees it react. */
  emitDieEmote: (dieId: string, emote: DieEmote) => void;
  receiveDieEmote: (payload: DieEmoteBroadcastPayload) => void;
  receiveExpiryExtended: (payload: RollExpiryExtendedPayload) => void;
  clearDice: () => void;
  resetRoom: () => void;
  /** Prepend a non-roll note (e.g. a name or color change) to the history, tinted with a color. */
  logEvent: (label: string, colorHex: string) => void;
}

/** Shared-roll client state. Physics transforms are streamed from refs, never stored every frame. */
export const useLocalRoller = create<LocalRollerState>((set, get) => ({
  color: { hex: DEFAULT_COLOR.hex, text: DEFAULT_COLOR.text },
  selection: { type: 'd20', quantity: 1 },
  pool: [],
  modifier: 0,
  activeDice: [],
  log: [],
  rollMeta: {},
  ownerNames: {},
  ownerColors: {},
  settledDieIds: [],
  missedRollIds: [],
  submittedRollIds: [],
  pendingGrabDieIds: [],
  activeGrab: null,
  grabMessage: null,
  reactions: [],
  dieEmotes: [],

  setType: (type) => set((state) => ({ selection: { ...state.selection, type } })),
  setColor: (color) => set({ color }),
  setQuantity: (quantity) =>
    set((state) => ({ selection: { ...state.selection, quantity: clampQuantity(quantity) } })),
  setModifier: (modifier) =>
    set({ modifier: Math.max(-999, Math.min(999, Math.round(modifier || 0))) }),
  addSelection: () => {
    const { selection } = get();
    set((state) => ({
      pool: [...state.pool.filter((item) => item.type !== selection.type), selection],
    }));
  },
  removeSelection: (type) =>
    set((state) => ({ pool: state.pool.filter((selection) => selection.type !== type) })),
  clearPool: () => set({ pool: [] }),

  throwSelection: (center, velocity) => {
    const { selection, pool, modifier } = get();
    requestRoomRoll(
      pool.length > 0 ? pool : [selection],
      {
        startPosition: center,
        releasePosition: center,
        velocity,
        durationMs: 0,
      },
      modifier,
    );
  },

  hydrateSnapshot: (snapshot) => {
    const activeDice = snapshot.visibleDice
      .map((die) => visibleToSpec(die))
      .filter((die): die is DieSpec => die !== null);
    const rollingRollIds = new Set(
      snapshot.visibleDice.filter((die) => die.status !== 'settled').map((die) => die.rollId),
    );
    // Roll records don't store the die color, so tint each row with the owner's current color.
    const playerColors: Record<string, string> = Object.fromEntries(
      snapshot.players.map((player) => [
        player.id,
        (getColor(player.colorId) ?? DEFAULT_COLOR).hex,
      ]),
    );
    const ownerColors: Record<string, string> = Object.fromEntries(
      snapshot.rolls.map((roll) => [
        roll.id,
        playerColors[roll.ownerPlayerId] ?? DEFAULT_COLOR.hex,
      ]),
    );
    const log = snapshot.rolls
      .filter((roll) => !rollingRollIds.has(roll.id))
      .map((roll) => entryForRoll(roll, undefined, ownerColors[roll.id]))
      .filter((entry): entry is LocalRollEntry => entry !== null)
      .reverse();
    set({
      activeDice,
      log,
      rollMeta: Object.fromEntries(snapshot.rolls.map((roll) => [roll.id, roll])),
      ownerNames: Object.fromEntries(snapshot.rolls.map((roll) => [roll.id, roll.ownerNameAtRoll])),
      ownerColors,
      settledDieIds: activeDice.filter((die) => die.status === 'settled').map((die) => die.id),
      missedRollIds: [],
      submittedRollIds: [],
      pendingGrabDieIds: [],
      activeGrab: null,
      grabMessage: null,
      reactions: [],
      dieEmotes: [],
    });
  },

  receiveRollCreated: (payload, selfPlayerId, ownerName) => {
    if (get().activeDice.some((die) => die.rollId === payload.rollId)) return;
    const color = getColor(payload.colorId) ?? DEFAULT_COLOR;
    const controller = payload.actingPlayerId === selfPlayerId;
    const positions = spreadSpawnPositions(
      payload.approvedGesture.releasePosition,
      payload.dice.length,
      0.55,
    );
    const dice: DieSpec[] = payload.dice.flatMap((die, index) => {
      if (!isSupportedDieType(die.type)) return [];
      return [
        {
          id: die.dieId,
          rollId: payload.rollId,
          type: die.type,
          colorHex: color.hex,
          textHex: color.text,
          result: die.result,
          ownerPlayerId: payload.ownerPlayerId,
          kept: false,
          position: positions[index] ?? payload.approvedGesture.releasePosition,
          rotation: controller ? randomSpawnRotation() : [0, 0, 0, 1],
          linearVelocity: controller ? payload.approvedGesture.velocity : [0, 0, 0],
          angularVelocity: controller ? throwSpin(payload.approvedGesture.velocity) : [0, 0, 0],
          isController: controller,
          status: 'rolling',
          percentilePart: die.percentilePart,
        },
      ];
    });
    set((state) => ({
      activeDice: [...state.activeDice, ...dice],
      rollMeta: { ...state.rollMeta, [payload.rollId]: payload },
      ownerNames: ownerName
        ? { ...state.ownerNames, [payload.rollId]: ownerName }
        : state.ownerNames,
      ownerColors: { ...state.ownerColors, [payload.rollId]: color.hex },
    }));
  },

  receiveTransforms: (payload) => {
    const byId = new Map(payload.transforms.map((transform) => [transform.dieId, transform]));
    set((state) => ({
      activeDice: state.activeDice.map((die) => {
        if (die.rollId !== payload.rollId || die.isController) return die;
        const transform = byId.get(die.id);
        return transform
          ? { ...die, position: transform.position, rotation: transform.rotation }
          : die;
      }),
    }));
  },

  receiveFinalized: (payload) => {
    const expiresAt = Date.now() + UNKEPT_DIE_LIFETIME_MS;
    const byId = new Map(payload.transforms.map((transform) => [transform.dieId, transform]));
    // The physics-decided faces arrive with finalization; adopt them so this client's history and
    // dice match everyone else's (a non-controlling client had only the provisional values).
    const resultById = new Map((payload.results ?? []).map((entry) => [entry.dieId, entry.result]));
    const rawMeta = get().rollMeta[payload.rollId];
    let meta = rawMeta;
    if (rawMeta && resultById.size > 0) {
      const dice = rawMeta.dice.map((die) =>
        resultById.has(die.dieId) ? { ...die, result: resultById.get(die.dieId)! } : die,
      );
      // Recompute the total from the adopted faces so the die results and the total stay consistent.
      meta = { ...rawMeta, dice, total: rollTotalFromDice(dice, rawMeta.modifier) };
    }
    const entry = meta
      ? entryForRoll(meta, get().ownerNames[payload.rollId], get().ownerColors[payload.rollId])
      : null;
    set((state) => ({
      activeDice: state.activeDice.map((die) => {
        if (die.rollId !== payload.rollId) return die;
        const result = resultById.get(die.id) ?? die.result;
        const transform = byId.get(die.id);
        return transform
          ? {
              ...die,
              position: transform.position,
              rotation: transform.rotation,
              result,
              status: 'settled' as const,
              expiresAt: die.kept ? undefined : expiresAt,
            }
          : { ...die, result };
      }),
      settledDieIds: [
        ...new Set([
          ...state.settledDieIds,
          ...state.activeDice.filter((die) => die.rollId === payload.rollId).map((die) => die.id),
        ]),
      ],
      rollMeta: meta ? { ...state.rollMeta, [payload.rollId]: meta } : state.rollMeta,
      log:
        entry && !state.log.some((item) => item.id === entry.id)
          ? [entry, ...state.log].slice(0, 100)
          : state.log,
    }));
    clearTransformStream(payload.rollId);
  },

  updateTransform: (id, position, rotation) => {
    const die = get().activeDice.find((candidate) => candidate.id === id);
    if (!die?.isController) return;
    publishTransform(die.rollId, { dieId: id, position, rotation });
  },

  markSettled: (id, position, rotation, result) => {
    const state = get();
    const die = state.activeDice.find((candidate) => candidate.id === id);
    if (!die?.isController) return;
    const transform: DieTransform = { dieId: id, position, rotation };
    publishTransform(die.rollId, transform, true);
    const settled = new Set([...state.settledDieIds, id]);
    set((current) => ({
      activeDice: current.activeDice.map((item) =>
        item.id === id
          ? {
              ...item,
              position,
              rotation,
              result,
              status: 'settled' as const,
              expiresAt: item.kept ? undefined : Date.now() + UNKEPT_DIE_LIFETIME_MS,
            }
          : item,
      ),
      settledDieIds: [...settled],
    }));

    // A roll where a die left the table doesn't count — skip submission (and its out-of-bounds error).
    if (get().missedRollIds.includes(die.rollId)) return;

    // Once every die in the roll has landed, report the faces the physics produced (the real result).
    const rollDice = get().activeDice.filter((candidate) => candidate.rollId === die.rollId);
    if (
      rollDice.every((candidate) => settled.has(candidate.id)) &&
      !state.submittedRollIds.includes(die.rollId)
    ) {
      const transforms = transformsForRoll(die.rollId);
      if (transforms.length === rollDice.length) {
        const results = rollDice.map((candidate) => ({
          dieId: candidate.id,
          result: candidate.result,
        }));
        settleRoomRoll(die.rollId, transforms, results);
        set((current) => ({ submittedRollIds: [...current.submittedRollIds, die.rollId] }));
      }
    }
  },

  dieMissed: (rollId) => {
    // Show a single cheeky nudge the first time any die of a roll leaves the table. The die keeps
    // falling away on its own; we just record the miss so the roll won't be submitted as a result.
    if (get().missedRollIds.includes(rollId)) return;
    set((state) => ({ missedRollIds: [...state.missedRollIds, rollId] }));
    useRoomStore.getState().setError(randomOffTheTableSaying());
  },

  requestReroll: (dieIds) => {
    if (requestDiceReroll(dieIds)) {
      set({ pendingGrabDieIds: dieIds, grabMessage: 'Requesting die…' });
    } else {
      set({ grabMessage: 'Reconnect before picking up dice.' });
    }
  },

  requestMove: (dieIds) => {
    if (requestDiceMove(dieIds)) {
      set({ pendingGrabDieIds: dieIds, grabMessage: 'Requesting die…' });
    } else {
      set({ grabMessage: 'Reconnect before moving dice.' });
    }
  },

  receiveGrabGranted: (payload, selfPlayerId) => {
    set({
      activeGrab: {
        id: payload.grabLockId,
        dieIds: payload.dieIds,
        controllerPlayerId: selfPlayerId ?? '',
        action: payload.action,
        isController: true,
      },
      pendingGrabDieIds: [],
      grabMessage:
        payload.action === 'reroll'
          ? 'Die held. Drag across the table and release to reroll.'
          : 'Die held. Drag it to a new place and release.',
    });
  },

  receiveDiceGrabbed: (grabLock, selfPlayerId) => {
    set((state) => ({
      activeDice: state.activeDice.map((die) =>
        grabLock.dieIds.includes(die.id) ? { ...die, status: 'held' as const } : die,
      ),
      activeGrab:
        grabLock.controllerPlayerId === selfPlayerId
          ? { ...grabLock, isController: true }
          : state.activeGrab,
      pendingGrabDieIds:
        grabLock.controllerPlayerId === selfPlayerId ? [] : state.pendingGrabDieIds,
    }));
  },

  receiveGrabDenied: (reason) =>
    set({ pendingGrabDieIds: [], activeGrab: null, grabMessage: reason }),

  receiveHeldTransforms: (payload) => {
    if (get().activeGrab?.id === payload.grabLockId && get().activeGrab?.isController) return;
    const byId = new Map(payload.transforms.map((transform) => [transform.dieId, transform]));
    set((state) => ({
      activeDice: state.activeDice.map((die) => {
        const transform = byId.get(die.id);
        return transform
          ? {
              ...die,
              position: transform.position,
              rotation: transform.rotation,
              status: 'held' as const,
            }
          : die;
      }),
    }));
  },

  moveHeldDice: (center) => {
    const state = get();
    const grab = state.activeGrab;
    if (!grab?.isController) return;
    const offsets = heldPositions(center, grab.dieIds.length);
    const transforms: DieTransform[] = [];
    set((current) => ({
      activeDice: current.activeDice.map((die) => {
        const index = grab.dieIds.indexOf(die.id);
        if (index < 0) return die;
        const position = offsets[index] ?? center;
        transforms.push({ dieId: die.id, position, rotation: die.rotation });
        return { ...die, position, status: 'held' as const };
      }),
    }));
    const now = performance.now();
    if (now - (heldStreamTimes.get(grab.id) ?? 0) >= 1000 / 12) {
      heldStreamTimes.set(grab.id, now);
      streamHeldDiceTransforms(grab.id, transforms);
    }
  },

  releaseActiveGrab: (center, velocity) => {
    const grab = get().activeGrab;
    if (!grab?.isController) return;
    if (grab.action === 'move') {
      const transforms = get()
        .activeDice.filter((die) => grab.dieIds.includes(die.id))
        .map((die) => ({ dieId: die.id, position: die.position, rotation: die.rotation }));
      if (releaseHeldDiceAsMove(grab.id, transforms)) {
        set({ grabMessage: 'Placing die…' });
        return;
      }
    } else if (releaseHeldDiceAsReroll(grab.id, center, velocity)) {
      set({ grabMessage: 'Rerolling…' });
      return;
    }
    set({ grabMessage: 'Unable to release while disconnected.' });
  },

  cancelActiveGrab: () => {
    const grab = get().activeGrab;
    if (!grab?.isController) return;
    cancelHeldDiceGrab(grab.id);
    set({ grabMessage: 'Returning die…' });
  },

  receiveGrabCanceled: (payload) => {
    const byId = new Map(payload.transforms.map((transform) => [transform.dieId, transform]));
    heldStreamTimes.delete(payload.grabLockId);
    set((state) => ({
      activeDice: state.activeDice.map((die) => {
        const transform = byId.get(die.id);
        return transform
          ? {
              ...die,
              position: transform.position,
              rotation: transform.rotation,
              status: 'settled' as const,
              expiresAt: die.kept ? undefined : Date.now() + UNKEPT_DIE_LIFETIME_MS,
            }
          : die;
      }),
      activeGrab: state.activeGrab?.id === payload.grabLockId ? null : state.activeGrab,
      pendingGrabDieIds: [],
      grabMessage: null,
    }));
  },

  receiveRerollCreated: (payload, selfPlayerId, ownerName) => {
    const grabId = get().activeGrab?.id;
    if (grabId) heldStreamTimes.delete(grabId);
    set((state) => ({
      activeDice: state.activeDice.filter((die) => !payload.replacedDieIds.includes(die.id)),
      activeGrab: null,
      pendingGrabDieIds: [],
      grabMessage: null,
    }));
    get().receiveRollCreated(payload, selfPlayerId, ownerName);
  },

  receiveDiceMoved: (payload) => {
    const byId = new Map(payload.transforms.map((transform) => [transform.dieId, transform]));
    heldStreamTimes.delete(payload.grabLockId);
    set((state) => ({
      activeDice: state.activeDice.map((die) => {
        const transform = byId.get(die.id);
        return transform
          ? {
              ...die,
              position: transform.position,
              rotation: transform.rotation,
              status: 'settled' as const,
              expiresAt: die.kept ? undefined : Date.now() + UNKEPT_DIE_LIFETIME_MS,
            }
          : die;
      }),
      activeGrab: state.activeGrab?.id === payload.grabLockId ? null : state.activeGrab,
      grabMessage: null,
    }));
  },

  setKept: (dieId, kept) => {
    if (!setRoomDieKept(dieId, kept)) set({ grabMessage: 'Reconnect before changing kept dice.' });
  },

  receiveKeptUpdated: (payload) =>
    set((state) => ({
      activeDice: state.activeDice.map((die) =>
        die.id === payload.dieId
          ? {
              ...die,
              kept: payload.kept,
              expiresAt: payload.kept ? undefined : Date.now() + UNKEPT_DIE_LIFETIME_MS,
            }
          : die,
      ),
    })),

  clearRoll: (rollId) => {
    if (!clearRoomRoll(rollId)) set({ grabMessage: 'Reconnect before clearing dice.' });
  },

  receiveRollCleared: (payload) =>
    set((state) => ({
      activeDice: state.activeDice.filter((die) => !payload.dieIds.includes(die.id)),
      activeGrab: state.activeGrab?.dieIds.some((id) => payload.dieIds.includes(id))
        ? null
        : state.activeGrab,
    })),

  receiveDiceCleared: (payload) =>
    set((state) => ({
      activeDice: state.activeDice.filter((die) => !payload.dieIds.includes(die.id)),
      activeGrab: state.activeGrab?.dieIds.some((id) => payload.dieIds.includes(id))
        ? null
        : state.activeGrab,
    })),

  reactToRoll: (rollId, reaction) => {
    if (!reactToRoomRoll(rollId, reaction)) set({ grabMessage: 'Reconnect before reacting.' });
  },

  receiveReaction: (payload) => {
    // The server sends the roll's full reaction set, so adopt it wholesale rather than applying a
    // delta — a dropped message then can't leave a row permanently wrong.
    set((state) => ({
      log: state.log.map((entry) =>
        entry.id === payload.rollId ? { ...entry, reactions: payload.reactions } : entry,
      ),
      rollMeta: state.rollMeta[payload.rollId]
        ? {
            ...state.rollMeta,
            [payload.rollId]: { ...state.rollMeta[payload.rollId]!, reactions: payload.reactions },
          }
        : state.rollMeta,
    }));

    // Taking a reaction back is a correction, not a moment — no toast for it.
    if (payload.removed) return;
    const id = `${payload.playerId}:${payload.rollId}:${Date.now()}`;
    set((state) => ({
      reactions: [
        ...state.reactions,
        { id, rollId: payload.rollId, reaction: payload.reaction, playerId: payload.playerId },
      ],
    }));
    window.setTimeout(() => {
      set((state) => ({ reactions: state.reactions.filter((reaction) => reaction.id !== id) }));
    }, 1800);
  },

  emitDieEmote: (dieId, emote) => {
    // Fire and forget. The server echoes it back to everyone including us, so the emote we show is
    // the same one everyone else sees — and a dropped emote is simply a joke that didn't land.
    sendDieEmote(dieId, emote);
  },

  receiveDieEmote: (payload) => {
    const id = `${payload.dieId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
    set((state) => ({
      // One emote per die at a time: a fresh knock replaces the old reaction rather than stacking
      // glyphs on top of each other.
      dieEmotes: [
        ...state.dieEmotes.filter((item) => item.dieId !== payload.dieId),
        { id, dieId: payload.dieId, emote: payload.emote, at: Date.now() },
      ],
    }));
    window.setTimeout(() => {
      set((state) => ({ dieEmotes: state.dieEmotes.filter((item) => item.id !== id) }));
    }, DIE_EMOTE_LIFETIME_MS);
  },

  receiveExpiryExtended: (payload) => {
    const dieIds = new Set(payload.dieIds);
    set((state) => ({
      activeDice: state.activeDice.map((die) =>
        dieIds.has(die.id) && !die.kept ? { ...die, expiresAt: payload.expiresAt } : die,
      ),
    }));
  },

  clearDice: () => set({ activeDice: [] }),
  resetRoom: () => {
    clearTransformStream();
    set({
      activeDice: [],
      log: [],
      rollMeta: {},
      ownerNames: {},
      ownerColors: {},
      settledDieIds: [],
      missedRollIds: [],
      submittedRollIds: [],
      pendingGrabDieIds: [],
      activeGrab: null,
      grabMessage: null,
      reactions: [],
      dieEmotes: [],
    });
  },

  logEvent: (label, colorHex) =>
    set((state) => ({
      log: [
        {
          id: `event:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
          kind: 'event' as const,
          expression: '',
          results: [],
          total: 0,
          at: Date.now(),
          label,
          colorHex,
          reactions: [],
        },
        ...state.log,
      ].slice(0, 100),
    })),
}));
