import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useMemo, useRef, useState, type MutableRefObject } from 'react';
import { Group, Vector3 } from 'three';
import type { SupportedDieType } from './dice/dieTypes';
import { DieMesh } from './DieMesh';
import { TABLE } from './tableConfig';
import { estimateThrowVelocity, type ThrowSample } from './throwMath';
import { spreadSpawnPositions } from './throwLayout';
import { gestureState } from './gestureState';

/** Live pointer velocity on the throw plane, timestamped so held dice can let it decay when you pause. */
interface PointerMotion {
  vel: Vector3;
  time: number;
}

interface ThrowLayerProps {
  type: SupportedDieType;
  quantity: number;
  colorHex: string;
  textHex: string;
  reducedMotion?: boolean;
  onThrow: (center: [number, number, number], velocity: [number, number, number]) => void;
}

/**
 * A held-but-not-yet-thrown die that hangs and swings under the pointer like it is on a string:
 * it trails your movement, rolls in the direction you drag, and settles into a slow idle dangle when
 * you hold still. Static when the viewer prefers reduced motion.
 */
function JuggleDie({
  index,
  type,
  colorHex,
  textHex,
  reducedMotion,
  pointer,
}: {
  index: number;
  type: SupportedDieType;
  colorHex: string;
  textHex: string;
  reducedMotion: boolean;
  pointer: MutableRefObject<PointerMotion>;
}) {
  const ref = useRef<Group>(null);
  const offset = useRef(new Vector3());
  const offsetVel = useRef(new Vector3());
  const spin = useRef(new Vector3(0.8, 0.5, 0.35)); // start mid-idle-tumble
  // Offset so several held dice swing out of sync rather than in lockstep.
  const phase = useMemo(() => index * 1.7, [index]);

  useFrame((state, delta) => {
    const group = ref.current;
    if (!group || reducedMotion) return;
    const dt = Math.min(delta, 0.05);
    const t = state.clock.elapsedTime;

    // Pointer velocity, faded by how long since the last real move so it eases off when you pause.
    const decay = Math.exp(-(performance.now() - pointer.current.time) / 110);
    const pvx = pointer.current.vel.x * decay;
    const pvz = pointer.current.vel.z * decay;
    const drag = Math.hypot(pvx, pvz);

    // Position: hang a little below the anchor and lag behind motion like a die on a string, plus a
    // soft bob. A damped spring gives the swing weight and a little overshoot.
    const targetX = -pvx * 0.05;
    const targetY = -0.12 + Math.sin(t * 3.2 + phase) * 0.035;
    const targetZ = -pvz * 0.05;
    const stiffness = 60;
    offsetVel.current.x += (targetX - offset.current.x) * stiffness * dt;
    offsetVel.current.y += (targetY - offset.current.y) * stiffness * dt;
    offsetVel.current.z += (targetZ - offset.current.z) * stiffness * dt;
    offsetVel.current.multiplyScalar(1 - Math.min(8 * dt, 1));
    offset.current.addScaledVector(offsetVel.current, dt);
    group.position.copy(offset.current);

    // Rotation: roll in the drag direction over a gentle idle tumble, easing so it feels weighty.
    let tsx = 0.8;
    let tsy = 0.5;
    let tsz = 0.35;
    if (drag > 1e-3) {
      const k = drag * 1.8;
      tsx += (pvz / drag) * k;
      tsz += -(pvx / drag) * k;
      tsy += pvx * 0.6; // a little curl as you sweep sideways
    }
    const ease = 1 - Math.exp(-dt * 7);
    spin.current.x += (tsx - spin.current.x) * ease;
    spin.current.y += (tsy - spin.current.y) * ease;
    spin.current.z += (tsz - spin.current.z) * ease;
    group.rotation.x += spin.current.x * dt;
    group.rotation.y += spin.current.y * dt;
    group.rotation.z += spin.current.z * dt;
  });

  return (
    <group ref={ref}>
      <DieMesh type={type} colorHex={colorHex} textHex={textHex} />
    </group>
  );
}

/**
 * Press-drag-release throwing (spec §6.2–§6.3). While held, dice hover above the pointer on the
 * throw plane; on release the recent pointer motion becomes the dice velocity. A plain tap still
 * produces a small valid roll.
 */
export function ThrowLayer({
  type,
  quantity,
  colorHex,
  textHex,
  reducedMotion = false,
  onThrow,
}: ThrowLayerProps) {
  const holding = useRef(false);
  const group = useRef<Group>(null);
  const samples = useRef<ThrowSample[]>([]);
  const pointer = useRef<PointerMotion>({ vel: new Vector3(), time: 0 });
  const [held, setHeld] = useState(false);

  const begin = (event: ThreeEvent<PointerEvent>) => {
    if (gestureState.pinching) return;
    const hitInteractiveDie = event.intersections.some((intersection) => {
      let object: typeof intersection.object | null = intersection.object;
      while (object) {
        if (object.userData.dieHitTarget === true) return true;
        object = object.parent;
      }
      return false;
    });
    if (hitInteractiveDie) return;
    event.stopPropagation();
    holding.current = true;
    samples.current = [{ point: event.point.clone(), time: performance.now() }];
    group.current?.position.copy(event.point);
    setHeld(true);
  };

  const move = (event: ThreeEvent<PointerEvent>) => {
    if (!holding.current) return;
    // A second finger landed and we are now pinch-zooming: drop the throw instead of flinging a die.
    if (gestureState.pinching) {
      holding.current = false;
      samples.current = [];
      setHeld(false);
      return;
    }
    const now = performance.now();
    const prev = samples.current[samples.current.length - 1];
    if (prev) {
      const seconds = Math.max((now - prev.time) / 1000, 1 / 120);
      pointer.current.vel.copy(event.point).sub(prev.point).divideScalar(seconds);
      pointer.current.time = now;
    }
    group.current?.position.copy(event.point);
    samples.current.push({ point: event.point.clone(), time: now });
    if (samples.current.length > 8) samples.current.shift();
  };

  const end = (event: ThreeEvent<PointerEvent>) => {
    if (!holding.current) return;
    holding.current = false;
    setHeld(false);
    if (gestureState.pinching) {
      samples.current = [];
      return;
    }
    const release = event.point.clone();
    const velocity = estimateThrowVelocity(samples.current);
    samples.current = [];
    onThrow([release.x, TABLE.throwHeight, release.z], [velocity.x, velocity.y, velocity.z]);
  };

  const previewOffsets = spreadSpawnPositions([0, 0, 0], quantity, 0.5).map(
    (p) => [p[0], 0, p[2]] as [number, number, number],
  );

  return (
    <>
      <mesh
        position={[0, TABLE.throwHeight, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerDown={begin}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
      >
        <planeGeometry args={[TABLE.halfX * 2 + 4, TABLE.halfZ * 2 + 4]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {held && (
        <group ref={group}>
          {previewOffsets.map((offset, i) => (
            <group key={i} position={offset}>
              <JuggleDie
                index={i}
                type={type}
                colorHex={colorHex}
                textHex={textHex}
                reducedMotion={reducedMotion}
                pointer={pointer}
              />
            </group>
          ))}
        </group>
      )}
    </>
  );
}
