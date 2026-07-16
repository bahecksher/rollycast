import { useFrame } from '@react-three/fiber';
import {
  ConvexHullCollider,
  CuboidCollider,
  RigidBody,
  type RapierRigidBody,
} from '@react-three/rapier';
import { useEffect, useRef } from 'react';
import { Quaternion, Vector3 } from 'three';
import { DieMesh, type DieVisualState } from './DieMesh';
import { getDieDefinition } from './dice/dieDefinitions';
import { trackDiePosition, untrackDie } from './dieTracker';
import type { DieSpec } from './RollingDie';
import { DieExpirationFade } from './DieExpirationFade';

/**
 * Another player's die. This client doesn't simulate it — the throwing client does, and streams the
 * result — so the body is kinematic and simply follows the interpolated network target.
 *
 * It is a real body rather than a bare mesh so that our own dice can knock into it: everyone throws
 * into the same tray, and dice passing through each other looks broken. Being kinematic means it
 * pushes our dice around without ever being pushed itself, which keeps the throwing client the sole
 * authority over where its own die ends up.
 */
export function RemoteDie({
  spec,
  visualState = 'normal',
  onInspect,
  onOpenMenu,
}: {
  spec: DieSpec;
  visualState?: DieVisualState;
  onInspect?: (dieId: string, rollId: string) => void;
  onOpenMenu?: (dieId: string, rollId: string, x: number, y: number) => void;
}) {
  const body = useRef<RapierRigidBody>(null);
  const def = getDieDefinition(spec.type);
  const targetPosition = useRef(new Vector3(...spec.position));
  const targetRotation = useRef(new Quaternion(...spec.rotation));
  const current = useRef(new Vector3(...spec.position));
  const currentRotation = useRef(new Quaternion(...spec.rotation).normalize());

  useEffect(() => {
    // The rolling client already levels the die onto its landed face, so the streamed rotation (and
    // the final settled one) is authoritative here — just follow it, no per-face correction.
    targetPosition.current.set(...spec.position);
    targetRotation.current.copy(new Quaternion(...spec.rotation).normalize());
  }, [spec.position, spec.rotation, spec.status, spec.type]);

  useEffect(() => () => untrackDie(spec.id), [spec.id]);

  useFrame((_, delta) => {
    const rb = body.current;
    if (!rb) return;
    const alpha = spec.status === 'settled' ? 1 - Math.exp(-delta * 18) : 1 - Math.exp(-delta * 12);
    current.current.lerp(targetPosition.current, alpha);
    currentRotation.current.slerp(targetRotation.current, alpha);
    // Move via setNextKinematic* rather than teleporting, so Rapier derives a contact velocity from
    // the motion and our dice get a believable shove instead of being ejected.
    rb.setNextKinematicTranslation(current.current);
    rb.setNextKinematicRotation(currentRotation.current);
    trackDiePosition(spec.id, current.current.x, current.current.y, current.current.z);
  });

  return (
    <RigidBody
      ref={body}
      type="kinematicPosition"
      colliders={false}
      position={spec.position}
      quaternion={spec.rotation}
      userData={{ isDie: true, dieId: spec.id }}
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
