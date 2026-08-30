import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';

interface AuthState {
  session: Session | null;
  /** true una vez que el chequeo inicial de sesión (+ sign-in anónimo si hacía falta) terminó. */
  isReady: boolean;
  setSession: (session: Session | null) => void;
  setReady: (ready: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  isReady: false,
  setSession: (session) => set({ session }),
  setReady: (isReady) => set({ isReady }),
}));
