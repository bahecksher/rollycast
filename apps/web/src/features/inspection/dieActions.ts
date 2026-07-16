import { canClearDie, canRerollDie, type DiceHandlingMode } from '@rollycast/shared';

export interface DieActionHandlers {
  onRequestReroll: (dieId: string) => void;
  onClearRoll: () => void;
}

export interface DieActionSubject {
  id: string;
  ownerPlayerId: string;
  kept: boolean;
  status: 'rolling' | 'settled' | 'held';
}

export interface DieAction {
  key: string;
  label: string;
  run: () => void;
}

/**
 * The actions available on a die, in one place. Both surfaces that offer them — the inspection panel
 * and the right-click/long-press menu — build from this, so the permission rules can't drift apart
 * between them.
 */
export function dieActionsFor(
  die: DieActionSubject,
  requesterId: string,
  mode: DiceHandlingMode,
  handlers: DieActionHandlers,
): DieAction[] {
  const permission = {
    requesterId,
    ownerPlayerId: die.ownerPlayerId,
    kept: die.kept,
    status: die.status,
    mode,
  } as const;

  const actions: DieAction[] = [];
  if (canRerollDie(permission)) {
    actions.push({ key: 'reroll', label: 'Reroll', run: () => handlers.onRequestReroll(die.id) });
  }
  if (canClearDie(permission)) {
    actions.push({ key: 'clear', label: 'Clear roll', run: handlers.onClearRoll });
  }
  return actions;
}
