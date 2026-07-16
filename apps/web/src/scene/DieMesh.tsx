import type { ThreeEvent } from '@react-three/fiber';
import { useRef } from 'react';
import { getDieDefinition, getDieGeometry, type SupportedDieType } from './dice/dieDefinitions';
import { getNumberTexture } from './numberTexture';
import type { PercentilePart } from '@rollycast/shared';

interface DieMeshProps {
  type: SupportedDieType;
  colorHex: string;
  textHex: string;
  percentilePart?: PercentilePart;
  interactive?: boolean;
  visualState?: DieVisualState;
  onInspect?: () => void;
  onOpenMenu?: (x: number, y: number) => void;
  kept?: boolean;
}

export type DieVisualState = 'normal' | 'selected' | 'related' | 'dimmed';

const LONG_PRESS_MS = 450;
const LONG_PRESS_MOVE_PX = 10;

/** Visual-only die: a colored solid plus a number decal laid on each face. */
export function DieMesh({
  type,
  colorHex,
  textHex,
  percentilePart,
  interactive = false,
  visualState = 'normal',
  onInspect,
  onOpenMenu,
  kept = false,
}: DieMeshProps) {
  const def = getDieDefinition(type);
  const geometry = getDieGeometry(type);
  const decalSize = def.size * 0.5;
  const pendingPress = useRef<{ x: number; y: number; timer: number } | null>(null);
  const suppressClick = useRef(false);
  const dimmed = visualState === 'dimmed';
  const highlighted = visualState === 'selected' || visualState === 'related';

  const cancelPendingPress = () => {
    if (!pendingPress.current) return;
    window.clearTimeout(pendingPress.current.timer);
    pendingPress.current = null;
  };

  const beginPress = (event: ThreeEvent<PointerEvent>) => {
    if (!interactive || event.button !== 0) return;
    event.stopPropagation();
    cancelPendingPress();
    const { clientX: x, clientY: y } = event.nativeEvent;
    pendingPress.current = {
      x,
      y,
      timer: window.setTimeout(() => {
        pendingPress.current = null;
        suppressClick.current = true;
        onOpenMenu?.(x, y);
      }, LONG_PRESS_MS),
    };
  };

  const movePress = (event: ThreeEvent<PointerEvent>) => {
    const pending = pendingPress.current;
    if (!pending) return;
    if (
      Math.hypot(event.nativeEvent.clientX - pending.x, event.nativeEvent.clientY - pending.y) >
      LONG_PRESS_MOVE_PX
    ) {
      cancelPendingPress();
    }
  };

  return (
    <group
      userData={{ dieHitTarget: interactive }}
      onPointerDown={beginPress}
      onPointerMove={movePress}
      onPointerUp={cancelPendingPress}
      onPointerLeave={cancelPendingPress}
      onClick={(event) => {
        if (!interactive) return;
        event.stopPropagation();
        if (suppressClick.current) {
          suppressClick.current = false;
          return;
        }
        onInspect?.();
      }}
      onContextMenu={(event) => {
        if (!interactive) return;
        event.stopPropagation();
        event.nativeEvent.preventDefault();
        cancelPendingPress();
        onOpenMenu?.(event.nativeEvent.clientX, event.nativeEvent.clientY);
      }}
    >
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshStandardMaterial
          color={colorHex}
          roughness={0.4}
          metalness={0.05}
          flatShading
          transparent={dimmed}
          opacity={dimmed ? 0.28 : 1}
          emissive={highlighted ? (visualState === 'selected' ? '#f2c94c' : '#e8934a') : '#000000'}
          emissiveIntensity={
            visualState === 'selected' ? 0.38 : visualState === 'related' ? 0.16 : 0
          }
        />
      </mesh>
      {highlighted && (
        <mesh geometry={geometry} scale={visualState === 'selected' ? 1.09 : 1.055}>
          <meshBasicMaterial
            color={visualState === 'selected' ? '#f2c94c' : '#e8934a'}
            wireframe
            transparent
            opacity={visualState === 'selected' ? 0.9 : 0.42}
            depthWrite={false}
          />
        </mesh>
      )}
      {kept && (
        <mesh position={[0, -def.inradius + 0.035, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[def.size * 0.72, 0.045, 8, 32]} />
          <meshBasicMaterial color="#f2c94c" transparent opacity={0.88} depthWrite={false} />
        </mesh>
      )}
      {def.decals.map((decal) => (
        <mesh key={decal.value} position={decal.position} quaternion={decal.quaternion}>
          <planeGeometry args={[decalSize, decalSize]} />
          <meshBasicMaterial
            map={getNumberTexture(
              percentilePart === 'tens'
                ? `${(decal.value - 1) * 10}`.padStart(2, '0')
                : percentilePart === 'ones'
                  ? decal.value - 1
                  : decal.value,
              textHex,
            )}
            transparent
            opacity={dimmed ? 0.32 : 1}
            depthWrite={false}
            polygonOffset
            polygonOffsetFactor={-2}
          />
        </mesh>
      ))}
    </group>
  );
}
