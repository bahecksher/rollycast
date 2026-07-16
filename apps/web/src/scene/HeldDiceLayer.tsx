import type { ThreeEvent } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { TABLE } from './tableConfig';
import { estimateThrowVelocity, type ThrowSample } from './throwMath';

interface HeldDiceLayerProps {
  onMove: (center: [number, number, number]) => void;
  onThrow: (center: [number, number, number], velocity: [number, number, number]) => void;
  onCancel: () => void;
  height: number;
}

/** Pointer plane used while a granted grab lock is controlled by this browser. */
export function HeldDiceLayer({ onMove, onThrow, onCancel, height }: HeldDiceLayerProps) {
  const holding = useRef(false);
  const samples = useRef<ThrowSample[]>([]);

  useEffect(() => {
    const cancel = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', cancel);
    return () => window.removeEventListener('keydown', cancel);
  }, [onCancel]);

  const centerOf = (event: ThreeEvent<PointerEvent>): [number, number, number] => [
    event.point.x,
    height,
    event.point.z,
  ];

  const begin = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    holding.current = true;
    samples.current = [{ point: event.point.clone(), time: performance.now() }];
    onMove(centerOf(event));
  };

  const move = (event: ThreeEvent<PointerEvent>) => {
    if (!holding.current) return;
    onMove(centerOf(event));
    samples.current.push({ point: event.point.clone(), time: performance.now() });
    if (samples.current.length > 8) samples.current.shift();
  };

  const end = (event: ThreeEvent<PointerEvent>) => {
    if (!holding.current) return;
    holding.current = false;
    const velocity = estimateThrowVelocity(samples.current);
    samples.current = [];
    onThrow(centerOf(event), [velocity.x, velocity.y, velocity.z]);
  };

  return (
    <mesh
      position={[0, height, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      onPointerDown={begin}
      onPointerMove={move}
      onPointerUp={end}
      onPointerLeave={end}
    >
      <planeGeometry args={[TABLE.halfX * 2 + 4, TABLE.halfZ * 2 + 4]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}
