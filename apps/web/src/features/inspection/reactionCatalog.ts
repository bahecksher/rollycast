import type { RollReaction } from '@rollycast/shared';

/**
 * How each roll reaction is presented. Shared by the die menu, the history rows, and the live
 * toast so the same reaction never appears under two different faces.
 */
export const REACTION_CATALOG: Array<{ reaction: RollReaction; label: string; symbol: string }> = [
  { reaction: 'critical', label: 'Critical!', symbol: '★' },
  { reaction: 'success', label: 'Success', symbol: '✓' },
  { reaction: 'disaster', label: 'Disaster', symbol: '!' },
  { reaction: 'suspense', label: 'Suspense', symbol: '…' },
  { reaction: 'applause', label: 'Applause', symbol: '👏' },
  { reaction: 'question', label: 'Question', symbol: '?' },
];

const byReaction = new Map(REACTION_CATALOG.map((item) => [item.reaction, item]));

export function reactionPresentation(reaction: RollReaction) {
  return byReaction.get(reaction) ?? { reaction, label: reaction, symbol: '•' };
}
