import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { Track } from '../api/types';

export type CollectionType = 'para_escuchar' | 'escuchadas' | 'personalizada';

export interface Collection {
  id: string;
  name: string;
  type: CollectionType;
}

const DEFAULT_COLLECTIONS: Collection[] = [
  { id: 'para_escuchar', name: 'Para escuchar', type: 'para_escuchar' },
  { id: 'escuchadas', name: 'Escuchadas', type: 'escuchadas' },
];

interface LibraryState {
  collections: Collection[];
  items: Record<string, Track[]>; // collectionId -> tracks, most recent first
  addToCollection: (collectionId: string, track: Track) => void;
  removeFromCollection: (collectionId: string, trackId: string) => void;
  createCollection: (name: string) => Collection;
}

/**
 * Local-only for now, same seam as swipeStore -- once a real Supabase
 * project exists this becomes a sync target for the `collections` /
 * `collection_items` tables instead of the source of truth.
 */
export const useLibraryStore = create<LibraryState>()(
  persist(
    (set, get) => ({
      collections: DEFAULT_COLLECTIONS,
      items: {},
      addToCollection: (collectionId, track) =>
        set((state) => {
          const existing = state.items[collectionId] ?? [];
          if (existing.some((t) => t.id === track.id)) return state;
          return { items: { ...state.items, [collectionId]: [track, ...existing] } };
        }),
      removeFromCollection: (collectionId, trackId) =>
        set((state) => ({
          items: {
            ...state.items,
            [collectionId]: (state.items[collectionId] ?? []).filter((t) => t.id !== trackId),
          },
        })),
      createCollection: (name) => {
        const collection: Collection = { id: `custom-${Date.now()}`, name, type: 'personalizada' };
        set((state) => ({ collections: [...state.collections, collection] }));
        return collection;
      },
    }),
    {
      name: 'showmi-library',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
