import { Canvas } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import { Suspense } from 'react';
import { useLocalRoller } from '../state/localRoller';
import { useInspectionStore } from '../state/inspectionStore';
import { useRoomStore } from '../state/roomStore';
import { CameraZoom } from './CameraZoom';
import { DiceTable } from './DiceTable';
import { Lighting } from './Lighting';
import { RollingDie } from './RollingDie';
import { RemoteDie } from './RemoteDie';
import { ThrowLayer } from './ThrowLayer';
import { HeldDiceLayer } from './HeldDiceLayer';
import { TABLE } from './tableConfig';

interface DiceSceneProps {
  reducedMotion?: boolean;
}

/**
 * The 3D dice table. Lazy-loaded after entering a room so the landing page stays light and the
 * three.js + Rapier bundles load only when needed (spec §35).
 */
export default function DiceScene({ reducedMotion = false }: DiceSceneProps) {
  const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  const lowPower =
    reducedMotion ||
    navigator.hardwareConcurrency <= 4 ||
    (deviceMemory !== undefined && deviceMemory <= 4);
  const activeDice = useLocalRoller((s) => s.activeDice);
  const selection = useLocalRoller((s) => s.selection);
  const color = useLocalRoller((s) => s.color);
  const throwSelection = useLocalRoller((s) => s.throwSelection);
  const markSettled = useLocalRoller((s) => s.markSettled);
  const dieMissed = useLocalRoller((s) => s.dieMissed);
  const updateTransform = useLocalRoller((s) => s.updateTransform);
  const appearance = useRoomStore((s) => s.settings.appearance);
  const activeGrab = useLocalRoller((s) => s.activeGrab);
  const moveHeldDice = useLocalRoller((s) => s.moveHeldDice);
  const releaseActiveGrab = useLocalRoller((s) => s.releaseActiveGrab);
  const cancelActiveGrab = useLocalRoller((s) => s.cancelActiveGrab);
  const selectedRollId = useInspectionStore((s) => s.selectedRollId);
  const selectedDieId = useInspectionStore((s) => s.selectedDieId);
  const rerollDieIds = useInspectionStore((s) => s.rerollDieIds);
  const interactWithDie = useInspectionStore((s) => s.interactWithDie);
  const openActionMenu = useInspectionStore((s) => s.openActionMenu);
  const clearInspection = useInspectionStore((s) => s.clearInspection);

  const visualStateFor = (dieId: string, rollId: string) => {
    if (!selectedRollId) return 'normal' as const;
    if (selectedDieId === dieId || rerollDieIds.includes(dieId)) return 'selected' as const;
    if (selectedRollId === rollId) return 'related' as const;
    return 'dimmed' as const;
  };

  return (
    <Canvas
      shadows={!lowPower}
      dpr={[1, lowPower ? 1.25 : 2]}
      camera={{ position: [0, 8.5, 7.5], fov: 40 }}
      onCreated={({ camera }) => camera.lookAt(0, 0, 0)}
      onPointerMissed={(event) => {
        if (event.button === 0) clearInspection();
      }}
      style={{ touchAction: 'none' }}
    >
      <color attach="background" args={[appearance.backgroundColor]} />
      <CameraZoom />
      <Lighting shadows={!lowPower} />
      <Suspense fallback={null}>
        <Physics gravity={[0, -30, 0]} timeStep={1 / 60}>
          <DiceTable appearance={appearance} />
          {activeDice.map((spec) =>
            spec.isController && spec.status !== 'held' ? (
              <RollingDie
                key={spec.id}
                spec={spec}
                visualState={visualStateFor(spec.id, spec.rollId)}
                onInspect={interactWithDie}
                onOpenMenu={(dieId, rollId, x, y) => openActionMenu(dieId, rollId, { x, y })}
                reducedMotion={reducedMotion}
                onTransform={updateTransform}
                onSettled={markSettled}
                onMissed={dieMissed}
              />
            ) : (
              <RemoteDie
                key={spec.id}
                spec={spec}
                visualState={visualStateFor(spec.id, spec.rollId)}
                onInspect={interactWithDie}
                onOpenMenu={(dieId, rollId, x, y) => openActionMenu(dieId, rollId, { x, y })}
              />
            ),
          )}
          {activeGrab?.isController ? (
            <HeldDiceLayer
              height={activeGrab.action === 'move' ? 0.7 : TABLE.throwHeight}
              onMove={moveHeldDice}
              onThrow={releaseActiveGrab}
              onCancel={cancelActiveGrab}
            />
          ) : (
            <ThrowLayer
              type={selection.type === 'd100' ? 'd10' : selection.type}
              quantity={selection.type === 'd100' ? selection.quantity * 2 : selection.quantity}
              colorHex={color.hex}
              textHex={color.text}
              reducedMotion={reducedMotion}
              onThrow={throwSelection}
            />
          )}
        </Physics>
      </Suspense>
    </Canvas>
  );
}
