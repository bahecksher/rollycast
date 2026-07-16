import { useFrame } from '@react-three/fiber';
import {
  ConvexHullCollider,
  CuboidCollider,
  RigidBody,
  type RapierRigidBody,
} from '@react-three/rapier';
import { useRef } from 'react';
import { Quaternion, Vector3 } from 'three';
import { DieMesh, type DieVisualState } from './DieMesh';
import { getDieDefinition, type SupportedDieType } from './dice/dieDefinitions';
import { targetQuaternionForResult, upFaceValue } from './dice/orientation';
import { DieExpirationFade } from './DieExpirationFade';
import { TABLE } from './tableConfig';
import type { PercentilePart } from '@rollycast/shared';

export interface DieSpec {
  id: string;
  rollId: string;
  type: SupportedDieType;
  colorHex: string;
  textHex: string;
  /** Provisional/fallback result. The face the physics actually lands on decides the real result. */
  result: number;
  ownerPlayerId: string;
  kept: boolean;
  position: [number, number, number];
  linearVelocity: [number, number, number];
  angularVelocity: [number, number, number];
  rotation: [number, number, number, number];
  isController: boolean;
  status: 'rolling' | 'settled' | 'held';
  expiresAt?: number;
  percentilePart?: PercentilePart;
}

// RigidBodyType.KinematicPositionBased. Cast avoids importing the WASM enum just for this value.
const KINEMATIC_POSITION = 2;
// The die is physics-authoritative: it tumbles freely and whatever face it lands on is the result.
// So we wait for it to genuinely come to rest before reading the face — there is no correction to a
// different face, so nothing ever "flips".
const SETTLE_LINEAR = 0.4;
const SETTLE_ANGULAR = 0.6;
const SETTLE_DURATION = 0.12; // must be nearly still this long before we read the landed face
const SETTLE_HEIGHT_FACTOR = 1.8; // must be down on the table, not mid-bounce
const MAX_ROLL_DURATION = 6; // hard cap (spec §7.1)
// Once settled we only level the landed face perfectly flat — a tiny same-face tidy, not a turn to a
// different number — over this brief eased motion.
const LEVEL_DURATION = 0.12;
// A die that clears a wall or drops below the surface has "missed the table". It keeps falling away
// (the look the user likes), but we stop streaming its rogue position so the server isn't spammed,
// and notify once so a single cheeky nudge shows.
const MISS_MARGIN = 0.6;
const MISS_FLOOR = -0.8;

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function isOffTable(x: number, y: number, z: number): boolean {
  return (
    Math.abs(x) > TABLE.halfX + MISS_MARGIN ||
    Math.abs(z) > TABLE.halfZ + MISS_MARGIN ||
    y < MISS_FLOOR
  );
}

interface RollingDieProps {
  spec: DieSpec;
  visualState?: DieVisualState;
  onInspect?: (dieId: string, rollId: string) => void;
  onOpenMenu?: (dieId: string, rollId: string, x: number, y: number) => void;
  reducedMotion?: boolean;
  onTransform?: (
    id: string,
    position: [number, number, number],
    rotation: [number, number, number, number],
  ) => void;
  onSettled?: (
    id: string,
    position: [number, number, number],
    rotation: [number, number, number, number],
    result: number,
  ) => void;
  /** The die flew off the table (fired once); triggers a single cheeky nudge. */
  onMissed?: (rollId: string) => void;
}

/**
 * A die that tumbles under Rapier physics, detects when it has come to rest, reads the face it landed
 * on, and levels that same face flat before sleeping. The visible physics decides the result (a
 * friendly-table choice), so the die never rotates to a different number — nothing flips.
 */
export function RollingDie({
  spec,
  visualState = 'normal',
  onInspect,
  onOpenMenu,
  reducedMotion = false,
  onTransform,
  onSettled,
  onMissed,
}: RollingDieProps) {
  const body = useRef<RapierRigidBody>(null);
  const def = getDieDefinition(spec.type);

  const phase = useRef<'rolling' | 'reconciling' | 'done'>('rolling');
  const stillFor = useRef(0);
  const elapsed = useRef(0);
  const missed = useRef(false);
  const reconcile = useRef<{
    progress: number;
    from: Quaternion;
    to: Quaternion;
    pos: Vector3;
    result: number;
  } | null>(null);

  useFrame((_, delta) => {
    const rb = body.current;
    if (!rb || phase.current === 'done') return;
    const dt = Math.min(delta, 0.05);
    elapsed.current += dt;

    if (phase.current === 'rolling') {
      const position = rb.translation();
      // Missed the table: notify once and stop streaming the rogue position (no server flood), but
      // let the die keep tumbling away under physics — that fall is the look we want to keep.
      if (!missed.current && isOffTable(position.x, position.y, position.z)) {
        missed.current = true;
        onMissed?.(spec.rollId);
      }
      const rotation = rb.rotation();
      if (!missed.current) {
        onTransform?.(
          spec.id,
          [position.x, position.y, position.z],
          [rotation.x, rotation.y, rotation.z, rotation.w],
        );
      }
      const lin = rb.linvel();
      const ang = rb.angvel();
      const speed = Math.hypot(lin.x, lin.y, lin.z);
      const spin = Math.hypot(ang.x, ang.y, ang.z);
      // Wait for a genuine rest on the table before reading the face, so the value is stable.
      const onTable = position.y < def.inradius * SETTLE_HEIGHT_FACTOR;
      const nearlyStill = onTable && speed < SETTLE_LINEAR && spin < SETTLE_ANGULAR;
      stillFor.current = nearlyStill ? stillFor.current + dt : 0;

      const reduceNow = reducedMotion && elapsed.current > 0.6;
      const settled =
        stillFor.current >= SETTLE_DURATION || elapsed.current >= MAX_ROLL_DURATION || reduceNow;
      if (!settled) return;

      const t = rb.translation();
      const r = rb.rotation();
      const from = new Quaternion(r.x, r.y, r.z, r.w);
      // Read the face the physics landed on; that IS the result. Then level that same face flat.
      const landed = upFaceValue(from, def.faces);
      const to = targetQuaternionForResult(from, def.faces, landed);
      rb.setLinvel({ x: 0, y: 0, z: 0 }, false);
      rb.setAngvel({ x: 0, y: 0, z: 0 }, false);
      (rb.setBodyType as (type: number, wakeUp: boolean) => void)(KINEMATIC_POSITION, true);
      reconcile.current = {
        progress: 0,
        from,
        to,
        pos: new Vector3(t.x, def.inradius, t.z),
        result: landed,
      };
      phase.current = 'reconciling';
      return;
    }

    if (phase.current === 'reconciling' && reconcile.current) {
      const rc = reconcile.current;
      const step = reducedMotion ? 1 : dt / LEVEL_DURATION;
      rc.progress = Math.min(1, rc.progress + step);
      const q = rc.from.clone().slerp(rc.to, easeOutCubic(rc.progress));
      rb.setNextKinematicRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
      rb.setNextKinematicTranslation({ x: rc.pos.x, y: rc.pos.y, z: rc.pos.z });
      if (rc.progress >= 1) {
        phase.current = 'done';
        onSettled?.(spec.id, [rc.pos.x, rc.pos.y, rc.pos.z], [q.x, q.y, q.z, q.w], rc.result);
      }
    }
  });

  return (
    <RigidBody
      ref={body}
      colliders={false}
      position={spec.position}
      linearVelocity={spec.linearVelocity}
      angularVelocity={spec.angularVelocity}
      restitution={0.3}
      friction={0.7}
      linearDamping={0.12}
      angularDamping={0.16}
      ccd
    >
      {def.collider.kind === 'cuboid' ? (
        <CuboidCollider args={def.collider.halfExtents} />
      ) : (
        <ConvexHullCollider args={[def.collider.points]} />
      )}
      <DieExpirationFade expiresAt={spec.expiresAt} kept={spec.kept}>
        <DieMesh
          type={spec.type}
          colorHex={spec.colorHex}
          textHex={spec.textHex}
          percentilePart={spec.percentilePart}
          interactive={spec.status === 'settled'}
          visualState={visualState}
          onInspect={() => onInspect?.(spec.id, spec.rollId)}
          onOpenMenu={(x, y) => onOpenMenu?.(spec.id, spec.rollId, x, y)}
          kept={spec.kept}
        />
      </DieExpirationFade>
    </RigidBody>
  );
}
