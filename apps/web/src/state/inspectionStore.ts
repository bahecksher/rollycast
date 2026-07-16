import { create } from 'zustand';

export interface DiceMenuAnchor {
  x: number;
  y: number;
}

export interface DiceActionMenuState extends DiceMenuAnchor {
  dieId: string;
  rollId: string;
}

interface InspectionState {
  selectedRollId: string | null;
  selectedDieId: string | null;
  rerollDieIds: string[];
  selectingMultiple: boolean;
  actionMenu: DiceActionMenuState | null;
  inspectRoll: (rollId: string, dieId?: string) => void;
  inspectDie: (dieId: string, rollId: string) => void;
  interactWithDie: (dieId: string, rollId: string) => void;
  focusDie: (dieId: string, rollId: string) => void;
  beginMultiSelect: (dieId: string, rollId: string) => void;
  toggleRerollDie: (dieId: string, rollId: string) => void;
  cancelMultiSelect: () => void;
  openActionMenu: (dieId: string, rollId: string, anchor: DiceMenuAnchor) => void;
  closeActionMenu: () => void;
  clearInspection: () => void;
  reset: () => void;
}

const initialState = {
  selectedRollId: null,
  selectedDieId: null,
  rerollDieIds: [],
  selectingMultiple: false,
  actionMenu: null,
};

/** Local-only inspection state. It is intentionally never synchronized to other players. */
export const useInspectionStore = create<InspectionState>((set) => ({
  ...initialState,
  inspectRoll: (rollId, dieId) =>
    set({
      selectedRollId: rollId,
      selectedDieId: dieId ?? null,
      rerollDieIds: [],
      selectingMultiple: false,
      actionMenu: null,
    }),
  inspectDie: (dieId, rollId) =>
    set({
      selectedRollId: rollId,
      selectedDieId: dieId,
      rerollDieIds: [],
      selectingMultiple: false,
      actionMenu: null,
    }),
  interactWithDie: (dieId, rollId) =>
    set((state) => {
      if (state.selectingMultiple && state.selectedRollId === rollId) {
        const selected = state.rerollDieIds.includes(dieId)
          ? state.rerollDieIds.filter((id) => id !== dieId)
          : [...state.rerollDieIds, dieId];
        return { selectedDieId: dieId, rerollDieIds: selected, actionMenu: null };
      }
      return {
        selectedRollId: rollId,
        selectedDieId: dieId,
        rerollDieIds: [],
        selectingMultiple: false,
        actionMenu: null,
      };
    }),
  focusDie: (dieId, rollId) => set({ selectedRollId: rollId, selectedDieId: dieId }),
  beginMultiSelect: (dieId, rollId) =>
    set({
      selectedRollId: rollId,
      selectedDieId: dieId,
      rerollDieIds: [dieId],
      selectingMultiple: true,
      actionMenu: null,
    }),
  toggleRerollDie: (dieId, rollId) =>
    set((state) => {
      if (!state.selectingMultiple || state.selectedRollId !== rollId) {
        return {
          selectedRollId: rollId,
          selectedDieId: dieId,
          rerollDieIds: [dieId],
          selectingMultiple: true,
        };
      }
      return {
        selectedDieId: dieId,
        rerollDieIds: state.rerollDieIds.includes(dieId)
          ? state.rerollDieIds.filter((id) => id !== dieId)
          : [...state.rerollDieIds, dieId],
      };
    }),
  cancelMultiSelect: () => set({ rerollDieIds: [], selectingMultiple: false }),
  openActionMenu: (dieId, rollId, anchor) =>
    set({
      selectedRollId: rollId,
      selectedDieId: dieId,
      rerollDieIds: [],
      selectingMultiple: false,
      actionMenu: { dieId, rollId, ...anchor },
    }),
  closeActionMenu: () => set({ actionMenu: null }),
  clearInspection: () => set(initialState),
  reset: () => set(initialState),
}));
