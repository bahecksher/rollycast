import { CuboidCollider, RigidBody } from '@react-three/rapier';
import type { RoomAppearance } from '@rollycast/shared';
import { useEffect, useState } from 'react';
import { SRGBColorSpace, TextureLoader, type Texture } from 'three';
import { TABLE } from './tableConfig';

/**
 * The shared surface: a fixed floor plus low rim walls that keep dice on the table. The floor
 * top sits at y = 0; dice rest on it. Visuals stay dark and low-contrast (spec §30.1).
 */
export function DiceTable({ appearance }: { appearance: RoomAppearance }) {
  const { halfX, halfZ, wallHeight, wallThickness } = TABLE;

  return (
    <group>
      {/* Visual felt surface */}
      {appearance.backgroundImage ? (
        <TexturedSurface
          image={appearance.backgroundImage}
          fallbackColor={appearance.surfaceColor}
          width={halfX * 2}
          depth={halfZ * 2}
        />
      ) : (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
          <planeGeometry args={[halfX * 2, halfZ * 2]} />
          <meshStandardMaterial color={appearance.surfaceColor} roughness={0.95} metalness={0} />
        </mesh>
      )}

      {/* Subtle rim frame (visual only) */}
      <mesh position={[0, wallHeight / 2 - 0.2, halfZ]}>
        <boxGeometry args={[halfX * 2 + wallThickness, wallHeight, wallThickness]} />
        <meshStandardMaterial color={appearance.rimColor} roughness={0.8} />
      </mesh>
      <mesh position={[0, wallHeight / 2 - 0.2, -halfZ]}>
        <boxGeometry args={[halfX * 2 + wallThickness, wallHeight, wallThickness]} />
        <meshStandardMaterial color={appearance.rimColor} roughness={0.8} />
      </mesh>
      <mesh position={[halfX, wallHeight / 2 - 0.2, 0]}>
        <boxGeometry args={[wallThickness, wallHeight, halfZ * 2]} />
        <meshStandardMaterial color={appearance.rimColor} roughness={0.8} />
      </mesh>
      <mesh position={[-halfX, wallHeight / 2 - 0.2, 0]}>
        <boxGeometry args={[wallThickness, wallHeight, halfZ * 2]} />
        <meshStandardMaterial color={appearance.rimColor} roughness={0.8} />
      </mesh>

      {/* Physics colliders: floor + four walls */}
      <RigidBody type="fixed" colliders={false} friction={0.8} restitution={0.2}>
        <CuboidCollider args={[halfX, 0.5, halfZ]} position={[0, -0.5, 0]} />
        <CuboidCollider
          args={[halfX, wallHeight, wallThickness / 2]}
          position={[0, wallHeight, halfZ]}
        />
        <CuboidCollider
          args={[halfX, wallHeight, wallThickness / 2]}
          position={[0, wallHeight, -halfZ]}
        />
        <CuboidCollider
          args={[wallThickness / 2, wallHeight, halfZ]}
          position={[halfX, wallHeight, 0]}
        />
        <CuboidCollider
          args={[wallThickness / 2, wallHeight, halfZ]}
          position={[-halfX, wallHeight, 0]}
        />
      </RigidBody>
    </group>
  );
}

function TexturedSurface({
  image,
  fallbackColor,
  width,
  depth,
}: {
  image: string;
  fallbackColor: string;
  width: number;
  depth: number;
}) {
  const [texture, setTexture] = useState<Texture | null>(null);

  useEffect(() => {
    let active = true;
    const loaded = new TextureLoader().load(image, (ready) => {
      ready.colorSpace = SRGBColorSpace;
      ready.needsUpdate = true;
      if (active) setTexture(ready);
      else ready.dispose();
    });
    return () => {
      active = false;
      loaded.dispose();
    };
  }, [image]);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[width, depth]} />
      <meshStandardMaterial
        map={texture}
        color={texture ? '#ffffff' : fallbackColor}
        roughness={0.9}
        metalness={0}
      />
    </mesh>
  );
}
