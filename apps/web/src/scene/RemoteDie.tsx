import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { Group, Quaternion, Vector3 } from 'three';
import { DieMesh, type DieVisualState } from './DieMesh';
import type { DieSpec } from './RollingDie';
import { DieExpirationFade } from './DieExpirationFade';

/** A non-controlling client's visual die. It interpolates network targets and runs no physics. */
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
  const group = useRef<Group>(null);
  const targetPosition = useRef(new Vector3(...spec.position));
  const targetRotation = useRef(new Quaternion(...spec.rotation));

  useEffect(() => {
    // The rolling client already levels the die onto its landed face, so the streamed rotation (and
    // the final settled one) is authoritative here — just follow it, no per-face correction.
    targetPosition.current.set(...spec.position);
    targetRotation.current.copy(new Quaternion(...spec.rotation).normalize());
  }, [spec.position, spec.rotation, spec.status, spec.type]);

  useFrame((_, delta) => {
    const current = group.current;
    if (!current) return;
    const alpha = spec.status === 'settled' ? 1 - Math.exp(-delta * 18) : 1 - Math.exp(-delta * 12);
    current.position.lerp(targetPosition.current, alpha);
    current.quaternion.slerp(targetRotation.current, alpha);
  });

  return (
    <group ref={group} position={spec.position} quaternion={spec.rotation}>
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
    </group>
  );
}
