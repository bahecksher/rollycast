import { ErrorCode } from './protocol';
import type { DiceHandlingMode, DieStatus, GrabAction } from './state';

/**
 * Inputs needed to decide who may handle a die (spec §9, §12, §13). Ownership and room
 * permission rules live here as pure functions so the server enforces them and the client
 * reuses the exact same logic to show/hide menu actions.
 */
export interface DiePermissionInput {
  requesterId: string;
  ownerPlayerId: string;
  kept: boolean;
  status: DieStatus;
  mode: DiceHandlingMode;
}

/** A die can be physically grabbed only once it has come to rest (settled or fading). */
export function isGrabbableStatus(status: DieStatus): boolean {
  return status === 'settled' || status === 'fading';
}

export function isOwner(input: Pick<DiePermissionInput, 'requesterId' | 'ownerPlayerId'>): boolean {
  return input.requesterId === input.ownerPlayerId;
}

/**
 * Reason a grab must be denied, or `null` if allowed. Lets the server return a precise
 * error code (spec §39) while the client uses the boolean helpers below.
 */
export function grabDenialReason(input: DiePermissionInput, action: GrabAction): ErrorCode | null {
  if (!isGrabbableStatus(input.status)) return ErrorCode.DIE_UNAVAILABLE;

  const owner = isOwner(input);
  if (action === 'move') {
    // Only the owner may move a die; kept status doesn't block the owner.
    return owner ? null : ErrorCode.PERMISSION_DENIED;
  }

  // action === 'reroll'
  if (owner) return null;
  if (input.mode !== 'shared_rerolls') return ErrorCode.SHARED_REROLLS_DISABLED;
  if (input.kept) return ErrorCode.KEPT_DIE_LOCKED;
  return null;
}

export function canGrabDie(input: DiePermissionInput, action: GrabAction): boolean {
  return grabDenialReason(input, action) === null;
}

/** Moving a settled die without rerolling — owner only (spec §14). */
export function canMoveDie(input: DiePermissionInput): boolean {
  return canGrabDie(input, 'move');
}

/** Pick up and reroll — owner always; another player only under Shared Rerolls on an unkept die. */
export function canRerollDie(input: DiePermissionInput): boolean {
  return canGrabDie(input, 'reroll');
}

/** Keeping / releasing a die — owner only (spec §13). */
export function canKeepDie(
  input: Pick<DiePermissionInput, 'requesterId' | 'ownerPlayerId'>,
): boolean {
  return isOwner(input);
}

/** Clearing a die/roll from the table — owner only, even under Shared Rerolls (spec §16.1). */
export function canClearDie(
  input: Pick<DiePermissionInput, 'requesterId' | 'ownerPlayerId'>,
): boolean {
  return isOwner(input);
}

/** Inspection and reactions are available to everyone (spec §9, §11, §15). */
export function canInspect(): boolean {
  return true;
}
