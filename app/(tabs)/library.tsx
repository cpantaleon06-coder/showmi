import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DotGridBackground } from '../../src/components/backgrounds/DotGridBackground';
import { Track } from '../../src/api/types';
import { useThemeStore } from '../../src/theme/useThemeStore';
import { fonts } from '../../src/theme/typography';
import { useLibraryStore } from '../../src/state/libraryStore';
import { TrackTile } from '../../src/components/library/TrackTile';
import { GradientChip } from '../../src/components/ui/GradientChip';
import { ProfileButton } from '../../src/components/ui/ProfileButton';
import { FLOATING_TAB_BAR_CLEARANCE } from '../../src/theme/layout';

/**
 * Cada cuántas canciones se abre un módulo ancho. 5 = una portada grande arriba de cada
 * bloque, y las otras cuatro en dos parejas debajo -- el bloque cierra completo y el
 * patrón se repite. Con 4 la rejilla se sentiría casi toda de módulos grandes; con 6+ el
 * ritmo se pierde y vuelve a leerse como una galería uniforme.
 */
const WIDE_TILE_EVERY = 5;

/**
 * Agrupa las canciones en filas de la rejilla modular: la primera de cada bloque de cinco
 * ocupa una fila entera (módulo ancho) y las demás van de a dos.
 *
 * Se arma por filas en vez de usar `numColumns` de FlatList porque numColumns exige que
 * TODAS las celdas midan lo mismo -- que es justo lo que una rejilla modular no hace. La
 * fila sigue siendo la unidad que virtualiza FlatList, así que no se pierde reciclado.
 */
function buildTileRows(tracks: Track[]): Track[][] {
  const rows: Track[][] = [];
  let i = 0;
  while (i < tracks.length) {
    if (i % WIDE_TILE_EVERY === 0) {
      rows.push([tracks[i]]);
      i += 1;
    } else {
      // Puede quedar de a uno al final del bloque; en ese caso la pareja es de un solo
      // elemento y `flex: 1` lo estira -- deliberado, para que la rejilla nunca deje un
      // hueco fantasma esperando un track que no existe.
      rows.push(tracks.slice(i, i + 2));
      i += 2;
    }
  }
  return rows;
}

export default function LibraryScreen() {
  const colors = useThemeStore((s) => s.colors);
  const mode = useThemeStore((s) => s.mode);
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const collections = useLibraryStore((s) => s.collections);
  const items = useLibraryStore((s) => s.items);
  const removeFromCollection = useLibraryStore((s) => s.removeFromCollection);
  const createCollection = useLibraryStore((s) => s.createCollection);

  const [activeId, setActiveId] = useState(collections[0]?.id ?? 'para_escuchar');
  const [creatingName, setCreatingName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);

  const activeCollection = collections.find((c) => c.id === activeId) ?? collections[0];
  const tracks = items[activeCollection.id] ?? [];
  const tileRows = useMemo(() => buildTileRows(tracks), [tracks]);

  const handleCreateCollection = () => {
    const name = creatingName.trim();
    if (!name) return;
    const created = createCollection(name);
    setActiveId(created.id);
    setCreatingName('');
    setIsCreating(false);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.headerRow}>
        <Text style={[styles.header, { color: colors.textPrimary }]}>Biblioteca</Text>
        <ProfileButton colors={colors} />
      </View>

      <View style={styles.tabsRow}>
        <FlatList
          horizontal
          data={collections}
          keyExtractor={(c) => c.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsContent}
          renderItem={({ item }) => {
            const active = item.id === activeCollection.id;
            return (
              <GradientChip
                colors={colors}
                label={`${item.name} (${(items[item.id] ?? []).length})`}
                selected={active}
                onPress={() => setActiveId(item.id)}
              />
            );
          }}
          ListFooterComponent={
            isCreating ? (
              <View
                style={[
                  styles.tab,
                  styles.newTabInputWrap,
                  { borderColor: inputFocused ? colors.brand : colors.border, borderWidth: inputFocused ? 2.5 : 2 },
                ]}
              >
                <TextInput
                  value={creatingName}
                  onChangeText={setCreatingName}
                  onSubmitEditing={handleCreateCollection}
                  onFocus={() => setInputFocused(true)}
                  onBlur={() => setInputFocused(false)}
                  placeholder="Nombre"
                  placeholderTextColor={colors.textSecondary}
                  style={[styles.newTabInput, { color: colors.textPrimary }]}
                  autoFocus
                />
              </View>
            ) : (
              <Pressable onPress={() => setIsCreating(true)} style={[styles.tab, { borderColor: colors.border }]}>
                <Text style={[styles.tabText, { color: colors.textSecondary }]}>+ Nueva</Text>
              </Pressable>
            )
          }
        />
      </View>

      {/* La retícula solo se monta con la colección vacía -- con filas reales encima
          competiría con ellas, justo lo que el sistema de diseño evita (ver colors.ts).
          overflow:'hidden' en el contenedor porque el SVG se dimensiona a la ventana
          completa, no al alto real de esta área. */}
      <View style={styles.listArea}>
        {tracks.length === 0 && (
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <DotGridBackground width={screenWidth} height={screenHeight} mode={mode} />
          </View>
        )}
        <FlatList
          data={tileRows}
          keyExtractor={(row) => row.map((t) => t.id).join('+')}
          contentContainerStyle={styles.listContent}
          renderItem={({ item: row }) => (
            <View style={styles.tileRow}>
              {row.map((track) => (
                <TrackTile
                  key={track.id}
                  track={track}
                  colors={colors}
                  variant={row.length === 1 ? 'wide' : 'small'}
                  onRemove={() => removeFromCollection(activeCollection.id, track.id)}
                />
              ))}
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {activeCollection.type === 'para_escuchar'
                  ? 'Guarda canciones deslizando a la derecha en Swipe.'
                  : activeCollection.type === 'escuchadas'
                    ? 'Las canciones que marques "ya la escuché" aparecen aquí.'
                    : 'Todavía no has agregado canciones a esta colección.'}
              </Text>
            </View>
          }
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listArea: {
    flex: 1,
    overflow: 'hidden',
  },
  /** Fila de la rejilla modular: un módulo ancho solo, o dos chicos repartiendose el ancho
   *  (ver buildTileRows). El gap horizontal vive aca y el vertical en listContent. */
  tileRow: {
    flexDirection: 'row',
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  header: {
    fontSize: 22,
    fontFamily: fonts.display,
  },
  tabsRow: {
    paddingVertical: 12,
  },
  tabsContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  tab: {
    borderWidth: 2,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
  },
  tabText: {
    fontSize: 13,
    fontFamily: fonts.bodySemiBold,
  },
  newTabInputWrap: {
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  newTabInput: {
    fontSize: 13,
    minWidth: 100,
    fontFamily: fonts.bodyRegular,
  },
  listContent: {
    paddingHorizontal: 20,
    // Separación vertical entre filas de la rejilla (la horizontal vive en tileRow).
    gap: 12,
    // Colchón para la isla flotante de pestañas -- ver theme/layout.ts.
    paddingBottom: FLOATING_TAB_BAR_CLEARANCE,
  },
  empty: {
    paddingTop: 40,
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    fontFamily: fonts.bodyRegular,
  },
});
