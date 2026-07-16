import { beforeEach, describe, expect, it } from 'vitest';
import { useInspectionStore } from './inspectionStore';

describe('inspection store', () => {
  beforeEach(() => useInspectionStore.getState().reset());

  it('selects rolls and individual dice locally', () => {
    useInspectionStore.getState().inspectRoll('roll-1');
    expect(useInspectionStore.getState()).toMatchObject({
      selectedRollId: 'roll-1',
      selectedDieId: null,
    });

    useInspectionStore.getState().inspectDie('die-2', 'roll-1');
    expect(useInspectionStore.getState()).toMatchObject({
      selectedRollId: 'roll-1',
      selectedDieId: 'die-2',
    });
  });

  it('opens and closes an anchored accessible action menu', () => {
    useInspectionStore.getState().openActionMenu('die-1', 'roll-1', { x: 120, y: 240 });
    expect(useInspectionStore.getState().actionMenu).toEqual({
      dieId: 'die-1',
      rollId: 'roll-1',
      x: 120,
      y: 240,
    });

    useInspectionStore.getState().closeActionMenu();
    expect(useInspectionStore.getState().actionMenu).toBeNull();
    expect(useInspectionStore.getState().selectedRollId).toBe('roll-1');
  });

  it('builds a multi-die reroll selection within one roll', () => {
    useInspectionStore.getState().beginMultiSelect('die-1', 'roll-1');
    useInspectionStore.getState().interactWithDie('die-2', 'roll-1');
    expect(useInspectionStore.getState().rerollDieIds).toEqual(['die-1', 'die-2']);

    useInspectionStore.getState().toggleRerollDie('die-1', 'roll-1');
    expect(useInspectionStore.getState().rerollDieIds).toEqual(['die-2']);
  });
});
