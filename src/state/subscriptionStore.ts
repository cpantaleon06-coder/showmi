import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * Fricción tipo Tinder Free: un límite diario de swipes gratis, Premium = ilimitado. Es la
 * mitad "producto" del paquete recomendado por el usuario (junto con la insignia/cosméticos,
 * ver PREMIUM_ENTITLEMENT_ID en revenuecat.ts) -- sin ALGO que limitar, "hazte Premium" no
 * tiene ningún gancho real. 50 ronda un pool típico de deck (ver LOAD_MORE_WHEN_REMAINING en
 * useDeck.ts, pools de 50-85 tracks) -- una sesión completa gratis al día, no una miseria.
 */
export const DAILY_FREE_SWIPE_LIMIT = 50;

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

interface SubscriptionState {
  isPremium: boolean;
  swipesUsedToday: number;
  swipeDate: string;
  setPremium: (isPremium: boolean) => void;
  /** Incrementa el contador si no es Premium (Premium nunca gasta cupo) -- se llama en cada
   *  swipe real (ver SwipeDeck.tsx::handleSwiped), rueda el día solo si hace falta. */
  consumeFreeSwipe: () => void;
  /** Lectura pura -- rueda el día si hace falta antes de comparar, para que un swipe justo
   *  después de medianoche no siga viendo el contador de ayer. */
  hasFreeSwipesLeft: () => boolean;
}

export const useSubscriptionStore = create<SubscriptionState>()(
  persist(
    (set, get) => ({
      isPremium: false,
      swipesUsedToday: 0,
      swipeDate: todayKey(),
      setPremium: (isPremium) => set({ isPremium }),
      consumeFreeSwipe: () => {
        const { isPremium, swipeDate } = get();
        if (isPremium) return;
        const today = todayKey();
        if (swipeDate !== today) {
          set({ swipeDate: today, swipesUsedToday: 1 });
        } else {
          set((state) => ({ swipesUsedToday: state.swipesUsedToday + 1 }));
        }
      },
      hasFreeSwipesLeft: () => {
        const { isPremium, swipeDate, swipesUsedToday } = get();
        if (isPremium) return true;
        const today = todayKey();
        if (swipeDate !== today) return true; // día nuevo, contador todavía sin rodar
        return swipesUsedToday < DAILY_FREE_SWIPE_LIMIT;
      },
    }),
    { name: 'subscription-storage', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
