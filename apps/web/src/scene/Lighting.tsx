import { TABLE } from './tableConfig';

/** Simple, cheap lighting (spec §30.3): soft ambient/hemisphere fill plus one shadow-casting key. */
export function Lighting({ shadows = true }: { shadows?: boolean }) {
  return (
    <>
      <hemisphereLight args={['#dfe8f2', '#0b0e12', 0.7]} />
      <ambientLight intensity={0.35} />
      <directionalLight
        position={[4, 10, 6]}
        intensity={1.15}
        castShadow={shadows}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-bias={-0.0004}
        shadow-camera-near={1}
        shadow-camera-far={30}
        shadow-camera-left={-TABLE.halfX - 1}
        shadow-camera-right={TABLE.halfX + 1}
        shadow-camera-top={TABLE.halfZ + 3}
        shadow-camera-bottom={-TABLE.halfZ - 3}
      />
    </>
  );
}
