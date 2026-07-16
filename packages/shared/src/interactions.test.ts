import { describe, expect, it } from 'vitest';
import {
  canClearDie,
  canKeepDie,
  canMoveDie,
  canRerollDie,
  grabDenialReason,
} from './interactions';
import { ErrorCode } from './protocol';
import type { DiceHandlingMode, DieStatus } from './state';

interface Case {
  requesterId: string;
  ownerPlayerId: string;
  kept: boolean;
  status: DieStatus;
  mode: DiceHandlingMode;
}

const OWNER = 'p_owner';
const OTHER = 'p_other';

function die(overrides: Partial<Case> = {}): Case {
  return {
    requesterId: OWNER,
    ownerPlayerId: OWNER,
    kept: false,
    status: 'settled',
    mode: 'owner_only',
    ...overrides,
  };
}

describe('move permissions', () => {
  it('lets the owner move a settled die', () => {
    expect(canMoveDie(die())).toBe(true);
  });

  it('never lets another player move a die', () => {
    expect(canMoveDie(die({ requesterId: OTHER }))).toBe(false);
    expect(grabDenialReason(die({ requesterId: OTHER }), 'move')).toBe(ErrorCode.PERMISSION_DENIED);
  });
});

describe('reroll permissions', () => {
  it('lets the owner reroll their own die, even when kept', () => {
    expect(canRerollDie(die({ kept: true }))).toBe(true);
  });

  it('blocks another player under Owner Only', () => {
    expect(canRerollDie(die({ requesterId: OTHER }))).toBe(false);
    expect(grabDenialReason(die({ requesterId: OTHER }), 'reroll')).toBe(
      ErrorCode.SHARED_REROLLS_DISABLED,
    );
  });

  it('allows another player under Shared Rerolls on an unkept settled die', () => {
    expect(canRerollDie(die({ requesterId: OTHER, mode: 'shared_rerolls' }))).toBe(true);
  });

  it('protects kept dice even under Shared Rerolls', () => {
    const c = die({ requesterId: OTHER, mode: 'shared_rerolls', kept: true });
    expect(canRerollDie(c)).toBe(false);
    expect(grabDenialReason(c, 'reroll')).toBe(ErrorCode.KEPT_DIE_LOCKED);
  });
});

describe('grabbable status', () => {
  it('rejects grabs on dice that are not at rest', () => {
    for (const status of ['rolling', 'held', 'moving'] as DieStatus[]) {
      expect(grabDenialReason(die({ status }), 'move')).toBe(ErrorCode.DIE_UNAVAILABLE);
    }
  });

  it('allows grabbing settled and fading dice', () => {
    expect(grabDenialReason(die({ status: 'settled' }), 'move')).toBeNull();
    expect(grabDenialReason(die({ status: 'fading' }), 'move')).toBeNull();
  });
});

describe('keep and clear permissions', () => {
  it('are owner-only', () => {
    expect(canKeepDie({ requesterId: OWNER, ownerPlayerId: OWNER })).toBe(true);
    expect(canKeepDie({ requesterId: OTHER, ownerPlayerId: OWNER })).toBe(false);
    expect(canClearDie({ requesterId: OWNER, ownerPlayerId: OWNER })).toBe(true);
    expect(canClearDie({ requesterId: OTHER, ownerPlayerId: OWNER })).toBe(false);
  });
});
