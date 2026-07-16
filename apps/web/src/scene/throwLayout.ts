/**
 * A uniformly-random unit quaternion for a die's spawn orientation. Because the physics now decides
 * the result, starting each die facing a random direction keeps outcomes fair even for a gentle
 * throw that barely tumbles — fairness no longer depends on how hard you flick it.
 */
export function randomSpawnRotation(): [number, number, number, number] {
  const u1 = Math.random();
  const u2 = Math.random() * Math.PI * 2;
  const u3 = Math.random() * Math.PI * 2;
  const a = Math.sqrt(1 - u1);
  const b = Math.sqrt(u1);
  return [a * Math.sin(u2), a * Math.cos(u2), b * Math.sin(u3), b * Math.cos(u3)];
}

/**
 * Spin for a freshly thrown die, derived from the throw itself so it feels like you loaded it: a
 * die flung hard rolls fast, and a sideways flick puts curve on it (a vertical-axis spin that makes
 * the roll veer like a curve ball). A dash of randomness keeps repeated throws from looking canned.
 */
export function throwSpin(velocity: [number, number, number]): [number, number, number] {
  const [vx, , vz] = velocity;
  const speed = Math.hypot(vx, vz);
  // Rolling tumble about the horizontal axis perpendicular to the direction of travel.
  const nx = speed > 1e-3 ? vz / speed : 0;
  const nz = speed > 1e-3 ? -vx / speed : 1;
  const roll = 4 + speed * 1.1;
  // Curve: vertical-axis spin biased by how much you threw across the table.
  const curve = vx * 0.9 + (Math.random() - 0.5) * 7;
  const jitter = () => (Math.random() - 0.5) * 4;
  return [nx * roll + jitter(), curve, nz * roll + jitter()];
}

/** Three-free spawn-layout math, safe to import from the store/UI without pulling in three.js. */
export function spreadSpawnPositions(
  center: [number, number, number],
  count: number,
  spacing: number,
): Array<[number, number, number]> {
  const positions: Array<[number, number, number]> = [];
  for (let i = 0; i < count; i += 1) {
    const angle = (i / Math.max(count, 1)) * Math.PI * 2;
    const ring = count > 1 ? spacing : 0;
    positions.push([
      center[0] + Math.cos(angle) * ring + (Math.random() - 0.5) * 0.15,
      center[1] + Math.random() * 0.4,
      center[2] + Math.sin(angle) * ring + (Math.random() - 0.5) * 0.15,
    ]);
  }
  return positions;
}
