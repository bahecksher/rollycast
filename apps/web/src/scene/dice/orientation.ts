import { Quaternion, Vector3 } from 'three';

/** One face of a die: the value printed on it and its unit outward normal in local space. */
export interface DieFace {
  value: number;
  normal: Vector3;
}

const UP = new Vector3(0, 1, 0);

/**
 * The value of the face pointing most upward for a die at the given world orientation.
 * This is the "reading" used to confirm a settled die matches its authoritative result.
 */
export function upFaceValue(quaternion: Quaternion, faces: readonly DieFace[]): number {
  const worldNormal = new Vector3();
  let bestDot = -Infinity;
  let bestValue = faces[0]?.value ?? 0;
  for (const face of faces) {
    worldNormal.copy(face.normal).applyQuaternion(quaternion);
    const dot = worldNormal.dot(UP);
    if (dot > bestDot) {
      bestDot = dot;
      bestValue = face.value;
    }
  }
  return bestValue;
}

/**
 * A target orientation that makes `result`'s face point straight up, reached by a shortest-arc
 * correction from `current` so the die's yaw (spin about vertical) is preserved and the fix does
 * not look like a teleport (spec §7.3).
 */
export function targetQuaternionForResult(
  current: Quaternion,
  faces: readonly DieFace[],
  result: number,
): Quaternion {
  const face = faces.find((f) => f.value === result);
  if (!face) {
    throw new Error(`Die has no face with value ${result}`);
  }
  const worldNormal = face.normal.clone().applyQuaternion(current).normalize();
  const delta = new Quaternion().setFromUnitVectors(worldNormal, UP);
  return delta.multiply(current);
}
