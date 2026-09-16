import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PlusIcon } from 'phosphor-react-native';

import { DotGridBackground } from '../../src/components/backgrounds/DotGridBackground';
import { Track } from '../../src/api/types';
import { useThemeStore } from '../../src/theme/useThemeStore';
import { fonts } from '../../src/theme/typography';
import { radii } from '../../src/theme/radii';
import { getCollectionColor, getTileAccent } from '../../src/theme/collectionColors';
import { useLibraryStore } from '../../src/state/libraryStore';
import { TileVariant, TrackTile } from '../../src/components/library/TrackTile';
import { SpotifyExportButton } from '../../src/components/library/SpotifyExportButton';
import { EchoTitle } from '../../src/components/ui/EchoTitle';
import { EmptyCollection } from '../../src/components/library/EmptyCollection';
import { TileReveal } from '../../src/components/library/TileReveal';
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

interface TileCell {
  track: Track;
  variant: TileVariant;
  /** Posición absoluta en la colección -- alimenta el retraso del escalonado y el color de
   *  respaldo de la teja (ver getTileAccent). */
  index: number;
}

/**
 * Agrupa las canciones en filas del mosaico: la primera de cada bloque de cinco ocupa una
 * fila entera y las demás van de a dos.
 *
 * 2026-09-12: las parejas dejaron de ser simétricas. Antes los dos módulos de una fila medían
 * exactamente lo mismo, y a partir de la tercera fila la pantalla volvía a leerse como una
 * cuadrícula regular por más que el módulo ancho la abriera. Ahora cada pareja reparte 1.35
 * contra 1 y ALTERNA de qué lado va la grande, así que la rejilla zigzaguea hacia abajo -- que
 * es el ritmo de mosaico de las referencias, no el de una galería de fotos.
 *
 * Se arma por filas en vez de usar `numColumns` de FlatList porque numColumns exige que
 * TODAS las celdas midan lo mismo -- que es justo lo que un mosaico no hace. La fila sigue
 * siendo la unidad que virtualiza FlatList, así que no se pierde reciclado.
 */
function buildTileRows(tracks: Track[]): TileCell[][] {
  const rows: TileCell[][] = [];
  let i = 0;
  let pairIndex = 0;

  while (i < tracks.length) {
    if (i % WIDE_TILE_EVERY === 0) {
      rows.push([{ track: tracks[i], variant: 'wide', index: i }]);
      i += 1;
      continue;
    }

    const pair = tracks.slice(i, i + 2);
    if (pair.length === 1) {
      // Puede quedar de a uno al final del bloque. Se promueve a módulo ancho en vez de
      // dejarlo estirado a media fila: una teja cuadrada ocupando el ancho completo se ve
      // como un hueco esperando a la que falta.
      rows.push([{ track: pair[0], variant: 'wide', index: i }]);
      i += 1;
      continue;
    }

    const tallFirst = pairIndex % 2 === 0;
    rows.push(
      pair.map((track, k) => ({
        track,
        variant: (k === 0) === tallFirst ? ('tall' as const) : ('small' as const),
        index: i + k,
      })),
    );
    pairIndex += 1;
    i += 2;
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

  const activeIndex = Math.max(
    collections.findIndex((c) => c.id === activeId),
    0,
  );
  const activeCollection = collections[activeIndex] ?? collections[0];
  const activeColor = getCollectionColor(activeCollection.id, activeIndex);
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

  const countLabel = tracks.length === 1 ? '1 canción' : `${tracks.length} canciones`;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.headerRow}>
        {/* El título vive en su propia fila debajo (es demasiado grande para compartirla con
            el botón de perfil), así que acá solo queda el botón, alineado a la derecha. */}
        <View style={styles.headerSpacer} />
        <ProfileButton colors={colors} />
      </View>

      <View style={styles.titleBlock}>
        <EchoTitle text="Biblioteca" accent={activeColor} color={colors.textPrimary} size={42} />
        <View style={styles.countRow}>
          <Text style={[styles.count, { color: colors.textPrimary }]}>{countLabel}</Text>
          {/* El pill con el nombre de la colección vivía acá y se fue (2026-09-15): la fila de
              chips de abajo ya muestra la colección activa, resaltada y con su conteo. Eran
              dos veces el mismo dato a 40px de distancia, y el pill además repetía el color
              del chip -- dos manchas del mismo color discutiendo cuál manda. */}
        </View>
        {/* Exporta la colección ACTIVA (la que se está viendo), no toda la biblioteca: es lo que
            el usuario tiene enfrente y el nombre de la playlist sale de ahí. El botón se oculta
            solo si la colección está vacía o si Spotify no está configurado en la build. */}
        <View style={styles.exportRow}>
          <SpotifyExportButton colors={colors} collectionName={activeCollection.name} tracks={tracks} />
        </View>
      </View>

      <View style={styles.tabsRow}>
        <FlatList
          horizontal
          data={collections}
          keyExtractor={(c) => c.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsContent}
          renderItem={({ item, index }) => {
            const color = getCollectionColor(item.id, index);
            return (
              <GradientChip
                colors={colors}
                label={item.name}
                selected={item.id === activeCollection.id}
                // UN acento por pantalla (2026-09-15). Antes cada chip apagado llevaba SU
                // color en el contorno: la fila entera era un arcoíris y ninguna mandaba, que
                // es justo lo que hacía ver la pantalla barata. Ahora el color solo lo tiene
                // la colección ACTIVA; las demás son contorno neutro. El color sigue estando
                // -- solo dejó de estar cinco veces a la vez.
                fillColor={color}
                outlineColor={colors.border}
                onPress={() => setActiveId(item.id)}
              />
            );
          }}
          ListFooterComponent={
            isCreating ? (
              <View
                style={[
                  styles.newTabInputWrap,
                  {
                    borderColor: inputFocused ? colors.textPrimary : colors.border,
                    backgroundColor: colors.background,
                  },
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
              // Era un círculo relleno del color de la colección SIGUIENTE. Sonaba bien en
              // teoría (anticipar el color) pero en la práctica metía un tercer lenguaje de
              // forma -- pill relleno, pill contorneado y círculo -- y un color más que no
              // correspondía a nada visible. Ahora es un chip igual a los demás, apagado:
              // pertenece a la fila en vez de interrumpirla.
              <Pressable
                onPress={() => setIsCreating(true)}
                style={[styles.newTabButton, { borderColor: colors.border, backgroundColor: colors.background }]}
                accessibilityRole="button"
                accessibilityLabel="Crear una colección nueva"
              >
                <PlusIcon weight="bold" size={17} color={colors.textSecondary} />
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
          <View style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}>
            <DotGridBackground width={screenWidth} height={screenHeight} mode={mode} dotColor={activeColor} />
          </View>
        )}
        <FlatList
          data={tileRows}
          keyExtractor={(row) => row.map((cell) => cell.track.id).join('+')}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item: row }) => (
            <View style={styles.tileRow}>
              {row.map((cell) => (
                <TileReveal
                  key={cell.track.id}
                  index={cell.index}
                  style={
                    cell.variant === 'wide'
                      ? styles.cellWide
                      : // El peso va acá y no en la teja: este View es el hijo directo de la
                        // fila, así que es el único que puede cambiar cómo se reparte el ancho.
                        { flexGrow: cell.variant === 'tall' ? 1.35 : 1, flexBasis: 0 }
                  }
                >
                  <TrackTile
                    track={cell.track}
                    colors={colors}
                    variant={cell.variant}
                    accent={getTileAccent(cell.track.genre, cell.index)}
                    onRemove={() => removeFromCollection(activeCollection.id, cell.track.id)}
                  />
                </TileReveal>
              ))}
            </View>
          )}
          ListEmptyComponent={<EmptyCollection type={activeCollection.type} accent={activeColor} />}
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
  /** Fila del mosaico: un módulo ancho solo, o una pareja desigual repartiendose el ancho
   *  (ver buildTileRows). El gap horizontal vive aca y el vertical en listContent. */
  tileRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  cellWide: {
    width: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  headerSpacer: {
    flex: 1,
  },
  exportRow: { marginTop: 14, alignItems: 'flex-start' },
  titleBlock: {
    paddingHorizontal: 20,
    // Aire arriba: el titulo arrancaba pegado al boton de perfil y la pantalla se sentia
    // apretada desde el primer pixel.
    paddingTop: 6,
    // El eco del título se sale hacia abajo; sin este respiro choca con la fila de chips.
    paddingBottom: 14,
    gap: 12,
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: 6,
  },
  count: {
    fontSize: 15,
    fontFamily: fonts.display,
  },
  countPill: {
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  countPillText: {
    fontSize: 13,
    fontFamily: fonts.bodyExtraBold,
  },
  tabsRow: {
    paddingBottom: 14,
  },
  tabsContent: {
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  newTabButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newTabInputWrap: {
    borderWidth: 2,
    borderRadius: radii.pill,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  newTabInput: {
    fontSize: 13,
    minWidth: 110,
    fontFamily: fonts.bodyBold,
  },
  listContent: {
    paddingHorizontal: 20,
    // Separación vertical entre filas del mosaico (la horizontal vive en tileRow).
    gap: 12,
    // Colchón para la isla flotante de pestañas -- ver theme/layout.ts.
    paddingBottom: FLOATING_TAB_BAR_CLEARANCE,
  },
});
