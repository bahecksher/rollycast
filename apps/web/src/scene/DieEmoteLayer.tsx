import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { Sprite } from 'three';
import { useLocalRoller } from '../state/localRoller';
import { getDiePosition } from './dieTracker';
import { getEmoteTexture } from './emoteTexture';

const LIFETIME_MS = 1200;
/** How far above the die the emote starts, and how far it drifts up before fading out. */
const START_HEIGHT = 0.9;
const RISE = 0.7;
const SIZE = 0.7;

/**
 * The emotes currently floating above dice. These live outside the physics bodies on purpose: a die
 * tumbles, and a sprite parented to it would swing around with it rather than hover overhead. Each
 * frame the sprite re-reads its die's live position from the tracker instead.
 */
export function DieEmoteLayer() {
  const emotes = useLocalRoller((s) => s.dieEmotes);
  return (
    <>
      {emotes.map((emote) => (
        <FloatingEmote key={emote.id} dieId={emote.dieId} emote={emote.emote} at={emote.at} />
      ))}
    </>
  );
}

function FloatingEmote({
  dieId,
  emote,
  at,
}: {
  dieId: string;
  emote: Parameters<typeof getEmoteTexture>[0];
  at: number;
}) {
  const sprite = useRef<Sprite>(null);
  const lastPosition = useRef<[number, number, number] | null>(null);

  useFrame(() => {
    const node = sprite.current;
    if (!node) return;
    const progress = Math.min(1, (Date.now() - at) / LIFETIME_MS);

    // Follow the die while it still exists; if it has been cleared mid-emote, hold the last known
    // spot and finish the fade there rather than snapping to the origin.
    const position = getDiePosition(dieId);
    if (position) lastPosition.current = [position.x, position.y, position.z];
    const anchor = lastPosition.current;
    if (!anchor) return;

    node.position.set(anchor[0], anchor[1] + START_HEIGHT + RISE * progress, anchor[2]);
    // Hold full opacity briefly so the emote registers, then fade over the back half.
    const material = node.material;
    material.opacity = progress < 0.45 ? 1 : 1 - (progress - 0.45) / 0.55;
  });

  return (
    <sprite ref={sprite} scale={[SIZE, SIZE, SIZE]} renderOrder={10}>
      <spriteMaterial
        map={getEmoteTexture(emote)}
        transparent
        depthTest={false}
        depthWrite={false}
        toneMapped={false}
      />
    </sprite>
  );
}
