import type { DieTransform } from '@rollycast/shared';
import { streamRollTransforms } from './roomCommands';

const SEND_INTERVAL_MS = 1000 / 12;
const transformsByRoll = new Map<string, Map<string, DieTransform>>();
const lastSentByRoll = new Map<string, number>();

export function publishTransform(rollId: string, transform: DieTransform, force = false): void {
  let roll = transformsByRoll.get(rollId);
  if (!roll) {
    roll = new Map();
    transformsByRoll.set(rollId, roll);
  }
  roll.set(transform.dieId, transform);

  const now = performance.now();
  const lastSent = lastSentByRoll.get(rollId) ?? -Infinity;
  if (force || now - lastSent >= SEND_INTERVAL_MS) {
    streamRollTransforms(rollId, [...roll.values()]);
    lastSentByRoll.set(rollId, now);
  }
}

export function transformsForRoll(rollId: string): DieTransform[] {
  return [...(transformsByRoll.get(rollId)?.values() ?? [])];
}

export function clearTransformStream(rollId?: string): void {
  if (rollId) {
    transformsByRoll.delete(rollId);
    lastSentByRoll.delete(rollId);
    return;
  }
  transformsByRoll.clear();
  lastSentByRoll.clear();
}
