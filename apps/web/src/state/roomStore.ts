import { DEFAULT_ROOM_APPEARANCE, type PublicPlayer, type RoomSettings } from '@rollycast/shared';
import { create } from 'zustand';

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'error';

export interface SelfInfo {
  playerId: string;
  displayName: string;
  colorId: string;
  isHost: boolean;
}

interface RoomStore {
  status: ConnectionStatus;
  self: SelfInfo | null;
  players: PublicPlayer[];
  settings: RoomSettings;
  errorMessage: string | null;

  setStatus: (status: ConnectionStatus) => void;
  setSelf: (self: SelfInfo | null) => void;
  setPlayers: (players: PublicPlayer[]) => void;
  upsertPlayer: (player: PublicPlayer) => void;
  setPlayerConnected: (playerId: string, connected: boolean) => void;
  removePlayer: (playerId: string) => void;
  setSettings: (settings: RoomSettings) => void;
  setError: (message: string | null) => void;
  reset: () => void;
}

const DEFAULT_SETTINGS: RoomSettings = {
  diceHandlingMode: 'owner_only',
  joiningLocked: false,
  appearance: { ...DEFAULT_ROOM_APPEARANCE },
};

export const useRoomStore = create<RoomStore>((set) => ({
  status: 'idle',
  self: null,
  players: [],
  settings: DEFAULT_SETTINGS,
  errorMessage: null,

  setStatus: (status) => set({ status }),
  setSelf: (self) => set({ self }),
  setPlayers: (players) => set({ players }),
  upsertPlayer: (player) =>
    set((state) => {
      const others = state.players.filter((p) => p.id !== player.id);
      return { players: [...others, player] };
    }),
  setPlayerConnected: (playerId, connected) =>
    set((state) => ({
      players: state.players.map((p) => (p.id === playerId ? { ...p, connected } : p)),
    })),
  removePlayer: (playerId) =>
    set((state) => ({ players: state.players.filter((p) => p.id !== playerId) })),
  setSettings: (settings) => set({ settings }),
  setError: (message) => set({ errorMessage: message }),
  reset: () =>
    set({
      status: 'idle',
      self: null,
      players: [],
      settings: DEFAULT_SETTINGS,
      errorMessage: null,
    }),
}));
