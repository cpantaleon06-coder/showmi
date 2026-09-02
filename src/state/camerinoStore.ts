import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import {
  COSMETICS,
  CosmeticSlot,
  GenreCategory,
  categoryForRawGenre,
  cosmeticById,
  levelForRatings,
} from '../lib/cosmetics';

type Equipped = Partial<Record<CosmeticSlot, string>>;

interface CamerinoState {
  /** Calificaciones acumuladas por categoría de género -- la única fuente de progreso. */
  ratingsByCategory: Partial<Record<GenreCategory, number>>;
  equipped: Equipped;
  /**
   * Suma una calificación a la categoría del género crudo del track. Cualquier rating de 1 a 5
   * cuenta igual: la regla de producto es "reseñó la canción", no "le gustó" -- calificar bajo
   * también es participar, y castigarlo empujaría a inflar las estrellas.
   */
  recordRating: (rawGenre: string | null | undefined) => void;
  /** Equipa (o quita, pasando el mismo id ya equipado) una pieza en su slot. */
  toggleEquip: (cosmeticId: string) => void;
  levelFor: (category: GenreCategory) => number;
  /** Un item de More requiere `isPremium`; uno ganado requiere el nivel en su categoría. */
  isUnlocked: (cosmeticId: string, isPremium: boolean) => boolean;
}

export const useCamerinoStore = create<CamerinoState>()(
  persist(
    (set, get) => ({
      ratingsByCategory: {},
      equipped: {},
      recordRating: (rawGenre) => {
        const category = categoryForRawGenre(rawGenre);
        if (!category) return; // género que no mapea a ninguna categoría: no se inventa progreso
        set((state) => ({
          ratingsByCategory: {
            ...state.ratingsByCategory,
            [category]: (state.ratingsByCategory[category] ?? 0) + 1,
          },
        }));
      },
      toggleEquip: (cosmeticId) => {
        const item = cosmeticById(cosmeticId);
        if (!item) return;
        set((state) => {
          const next = { ...state.equipped };
          if (next[item.slot] === cosmeticId) delete next[item.slot];
          else next[item.slot] = cosmeticId;
          return { equipped: next };
        });
      },
      levelFor: (category) => levelForRatings(get().ratingsByCategory[category] ?? 0),
      isUnlocked: (cosmeticId, isPremium) => {
        const item = cosmeticById(cosmeticId);
        if (!item) return false;
        if (item.source.kind === 'more') return isPremium;
        return get().levelFor(item.source.category) >= item.source.level;
      },
    }),
    { name: 'showmi-camerino', storage: createJSONStorage(() => AsyncStorage) },
  ),
);

/**
 * Piezas equipadas que la persona TODAVÍA puede usar, para dibujar la mascota. Filtra contra
 * el estado de desbloqueo en vez de confiar en `equipped` tal cual: si alguien equipa un item
 * de Showmi More y luego se le vence la suscripción, la pieza debe dejar de mostrarse sola --
 * sin esto seguiría puesta para siempre y el tier de pago no significaría nada.
 */
export function visibleEquipped(equipped: Equipped, isPremium: boolean): Equipped {
  const visible: Equipped = {};
  for (const [slot, id] of Object.entries(equipped)) {
    if (!id) continue;
    const item = cosmeticById(id);
    if (!item) continue;
    if (item.source.kind === 'more' && !isPremium) continue;
    visible[slot as CosmeticSlot] = id;
  }
  return visible;
}

export { COSMETICS };
