/**
 * Predefined dice colors (spec §18.2). At least 12, distinguishable on dark and light
 * table themes, each with a readable face-number color. Clients may only pick from these
 * ids — arbitrary CSS colors are never accepted.
 */
export interface DiceColor {
  id: string;
  name: string;
  /** Base die body color. */
  hex: string;
  /** High-contrast color for face numbering. */
  text: string;
}

export const DICE_COLORS: readonly DiceColor[] = [
  { id: 'crimson', name: 'Crimson', hex: '#e23c4e', text: '#ffffff' },
  { id: 'amber', name: 'Amber', hex: '#f5a623', text: '#241a00' },
  { id: 'gold', name: 'Gold', hex: '#e8c547', text: '#241f00' },
  { id: 'lime', name: 'Lime', hex: '#8bd450', text: '#12240a' },
  { id: 'emerald', name: 'Emerald', hex: '#2fbf71', text: '#04170d' },
  { id: 'teal', name: 'Teal', hex: '#28c2b8', text: '#032220' },
  { id: 'sky', name: 'Sky', hex: '#38b6ff', text: '#04141f' },
  { id: 'azure', name: 'Azure', hex: '#4c6ef5', text: '#ffffff' },
  { id: 'violet', name: 'Violet', hex: '#8a5cf6', text: '#ffffff' },
  { id: 'magenta', name: 'Magenta', hex: '#e05bd6', text: '#ffffff' },
  { id: 'rose', name: 'Rose', hex: '#f78fb2', text: '#2a0f19' },
  { id: 'slate', name: 'Slate', hex: '#9aa7b4', text: '#0d1116' },
  { id: 'bone', name: 'Bone', hex: '#e9e2d0', text: '#20180a' },
  { id: 'obsidian', name: 'Obsidian', hex: '#3a3f4b', text: '#f2f4f8' },
] as const;

export const DEFAULT_COLOR_ID = DICE_COLORS[0]!.id;

const COLOR_BY_ID = new Map(DICE_COLORS.map((c) => [c.id, c]));

export function isValidColorId(id: unknown): id is string {
  return typeof id === 'string' && COLOR_BY_ID.has(id);
}

export function getColor(id: string): DiceColor | undefined {
  return COLOR_BY_ID.get(id);
}

/**
 * Choose a color for a joining player. Prefers the requested color if free, otherwise the
 * nearest available color by palette order, otherwise (all taken) falls back to the
 * preferred/first color — duplicates are allowed but avoided when possible (spec §18.2).
 */
export function assignAvailableColor(
  takenColorIds: readonly string[],
  preferredId?: string,
): string {
  const taken = new Set(takenColorIds);

  if (preferredId && isValidColorId(preferredId) && !taken.has(preferredId)) {
    return preferredId;
  }

  const startIndex =
    preferredId && isValidColorId(preferredId)
      ? DICE_COLORS.findIndex((c) => c.id === preferredId)
      : 0;

  for (let offset = 0; offset < DICE_COLORS.length; offset += 1) {
    const color = DICE_COLORS[(startIndex + offset) % DICE_COLORS.length];
    if (color && !taken.has(color.id)) {
      return color.id;
    }
  }

  // Every color is taken (only possible with > palette-size players). Reuse a valid color.
  return preferredId && isValidColorId(preferredId) ? preferredId : DEFAULT_COLOR_ID;
}
