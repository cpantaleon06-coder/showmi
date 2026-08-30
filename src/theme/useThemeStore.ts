import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { colorsForMode, ThemeColors, ThemeMode } from './colors';

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
