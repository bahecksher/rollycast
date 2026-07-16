import { Vector3 } from 'three';

export interface ThrowSample {
  point: Vector3;
  time: number; // performance.now() ms
}

const GAIN = 1.5;
const MAX_HORIZONTAL_SPEED = 14;
const MIN_HORIZONTAL_SPEED = 1.4;
const TOSS_DOWN = 1.5;

/**
 * Estimate a throw velocity from recent pointer samples on the throw plane. A slow/tiny release
 * still yields a small valid roll (spec §6.2). Returns a world-space velocity vector.
 */
export function estimateThrowVelocity(samples: ThrowSample[]): Vector3 {
  const velocity = new Vector3(0, -TOSS_DOWN, 2.5);
  if (samples.length >= 2) {
    const last = samples[samples.length - 1]!;
    let reference = samples[0]!;
    for (let i = samples.length - 1; i >= 0; i -= 1) {
      if (last.time - samples[i]!.time >= 55) {
        reference = samples[i]!;
        break;
      }
    }
    const dt = Math.max((last.time - reference.time) / 1000, 1 / 120);
    velocity.copy(last.point).sub(reference.point).divideScalar(dt).multiplyScalar(GAIN);
    velocity.y = -TOSS_DOWN;
  }

  const horizontal = Math.hypot(velocity.x, velocity.z);
  if (horizontal > MAX_HORIZONTAL_SPEED) {
    const scale = MAX_HORIZONTAL_SPEED / horizontal;
    velocity.x *= scale;
    velocity.z *= scale;
  } else if (horizontal < MIN_HORIZONTAL_SPEED) {
    // Nudge a near-stationary release so dice still tumble.
    velocity.x += (Math.random() - 0.5) * 2;
    velocity.z += 1.5 + Math.random();
  }
  return velocity;
}
