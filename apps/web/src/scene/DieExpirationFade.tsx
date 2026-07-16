import { useFrame } from '@react-three/fiber';
import { useEffect, useRef, type ReactNode } from 'react';
import { Group, Material, Mesh } from 'three';

const FADE_MS = 1_000;

/** Fades an expiring unkept die during its final second; the server remains authoritative. */
export function DieExpirationFade({
  expiresAt,
  kept,
  children,
}: {
  expiresAt?: number;
  kept: boolean;
  children: ReactNode;
}) {
  const group = useRef<Group>(null);
  const originalOpacity = useRef(new Map<string, number>());

  useEffect(() => {
    const current = group.current;
    return () => {
      current?.traverse((object) => {
        if (!(object instanceof Mesh)) return;
        for (const material of materialsOf(object.material)) {
          const opacity = originalOpacity.current.get(material.uuid);
          if (opacity !== undefined) material.opacity = opacity;
        }
      });
      originalOpacity.current.clear();
      if (current) current.visible = true;
    };
  }, [expiresAt, kept]);

  useFrame(() => {
    const current = group.current;
    if (!current || kept || !expiresAt) return;
    const remaining = expiresAt - Date.now();
    if (remaining > FADE_MS) return;
    const alpha = Math.max(0, remaining / FADE_MS);
    current.visible = alpha > 0;
    current.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      for (const material of materialsOf(object.material)) {
        if (!originalOpacity.current.has(material.uuid)) {
          originalOpacity.current.set(material.uuid, material.opacity);
        }
        material.transparent = true;
        material.opacity = (originalOpacity.current.get(material.uuid) ?? 1) * alpha;
      }
    });
  });

  return <group ref={group}>{children}</group>;
}

function materialsOf(material: Material | Material[]): Material[] {
  return Array.isArray(material) ? material : [material];
}
