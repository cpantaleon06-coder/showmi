import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { colorsForMode, ThemeColors, ThemeMode } from './colors';
import { syncAcrossTabs } from '../state/crossTabSync';

interface ThemeState {
  mode: ThemeMode;
  colors: ThemeColors;
  toggleMode: () => void;
  setMode: (mode: ThemeMode) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: 'dark',
      colors: colorsForMode('dark'),
      toggleMode: () => {
        const next: ThemeMode = get().mode === 'dark' ? 'light' : 'dark';
        set({ mode: next, colors: colorsForMode(next) });
      },
      setMode: (mode) => set({ mode, colors: colorsForMode(mode) }),
    }),
    {
      name: 'showmi-theme',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ mode: state.mode }),
      onRehydrateStorage: () => (state) => {
        if (state) state.colors = colorsForMode(state.mode);
      },
    }
  )
);

// Rehidrata cuando otra instancia de la app escribe esta clave -- ver crossTabSync.ts
// para el bug de pisado que esto arregla (medido 2026-09-12).
syncAcrossTabs(useThemeStore, 'showmi-theme');
