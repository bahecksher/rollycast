/**
 * Three-free die-type constants. Kept separate from `dieDefinitions` (which imports three.js and
 * eagerly builds geometry) so UI code — the tray, the store — can reference die types without
 * pulling the 3D bundle into the main chunk (spec §35).
 */
export const SUPPORTED_DIE_TYPES = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20'] as const;
export type SupportedDieType = (typeof SUPPORTED_DIE_TYPES)[number];
export const SELECTABLE_DIE_TYPES = [...SUPPORTED_DIE_TYPES, 'd100'] as const;
export type SelectableDieType = (typeof SELECTABLE_DIE_TYPES)[number];

export function isSupportedDieType(type: string): type is SupportedDieType {
  return (SUPPORTED_DIE_TYPES as readonly string[]).includes(type);
}
