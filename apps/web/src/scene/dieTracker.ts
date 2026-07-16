import { Vector3 } from 'three';

/**
 * Live world positions of the dice on the table, written every frame by the die components and read
 * by overlays that need to sit above a die without being parented to it.
 *
 * This exists because a die's rigid body tumbles: anything parented to it inherits that rotation, so
 * an "above the die" offset would orbit the die instead of staying above it. Keeping positions here
 * (refs, not React state) also avoids a re-render per frame, matching how transforms are handled
 * elsewhere in the scene.
 */
const positions = new Map<string, Vector3>();

export function trackDiePosition(dieId: string, x: number, y: number, z: number): void {
  const existing = positions.get(dieId);
  if (existing) {
    existing.set(x, y, z);
    return;
  }
  positions.set(dieId, new Vector3(x, y, z));
}

export function getDiePosition(dieId: string): Vector3 | undefined {
  return positions.get(dieId);
}

export function untrackDie(dieId: string): void {
  positions.delete(dieId);
}
