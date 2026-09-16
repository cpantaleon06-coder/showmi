import { StyleSheet, Text, View } from 'react-native';
import { DiscIcon } from 'phosphor-react-native';

import { CollectionType } from '../../state/libraryStore';
import { TILE_SURFACE, TILE_TEXT_MUTED } from '../../theme/collectionColors';
import { radii } from '../../theme/radii';
import { fonts } from '../../theme/typography';
import { TileReveal } from './TileReveal';

interface EmptyCollectionProps {
  type: CollectionType;
  /** Color de la colección activa -- ver getCollectionColor. */
  accent: string;
}

/**
 * Colección vacía.
 *
 * Es la primera pantalla que ve alguien recién instalada la app, así que se diseña como
 * cartel y no como aviso de error: panel negro, contorno del color de la colección, titular en
 * display.
 *
 * 2026-09-15, segunda pasada: la versión anterior abría con tres barras horizontales de ancho
 * decreciente. La intención era el "eco" de la referencia, pero tres barras grises apiladas
 * arriba de una tarjeta son el idioma universal de SKELETON DE CARGA -- se leía como que la
 * pantalla se quedó a medio cargar, que es exactamente lo contrario de lo que un estado vacío
 * debe comunicar. También se fue la fila de puntos de colores: flotaba suelta bajo el panel,
 * sin relación con nada, y leía como un resto olvidado.
 *
 * En su lugar, un disco grande RECORTADO por el borde del panel. Que se salga del cuadro es lo
 * que lo hace verse compuesto a propósito: un ícono centrado y completo habría sido
 * decoración; uno sangrado es una decisión de cartel. Y dice de qué va la app sin ilustración
 * ni copy extra.
 */
const COPY: Record<CollectionType, { title: string; body: string }> = {
  para_escuchar: {
    title: 'Todavía nada\nque escuchar',
    body: 'Desliza a la derecha en Swipe y lo que te guste cae aquí.',
  },
  escuchadas: {
    title: 'Aún no\nhas marcado\nninguna',
    body: 'Las canciones que marques "ya la escuché" se guardan aquí.',
  },
  personalizada: {
    title: 'Colección\nen blanco',
    body: 'Todavía no has agregado canciones a esta colección.',
  },
};

export function EmptyCollection({ type, accent }: EmptyCollectionProps) {
  const copy = COPY[type];

  return (
    <View style={styles.wrap}>
      <TileReveal index={0}>
        <View style={styles.panel}>
          {/* Sangrado abajo-derecha. `overflow: hidden` en el panel es lo que lo recorta. */}
          <View style={styles.discBleed} pointerEvents="none">
            <DiscIcon weight="fill" size={190} color={accent} />
          </View>

          <Text style={styles.title}>{copy.title}</Text>
          <Text style={styles.body}>{copy.body}</Text>
        </View>
      </TileReveal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: 8 },
  panel: {
    backgroundColor: TILE_SURFACE,
    // 2.5 -> 1.5: un contorno grueso en color saturado grita mas de lo que compone.
    borderRadius: radii.card,
    padding: 22,
    gap: 12,
    overflow: 'hidden',
    // Alto mínimo para que el disco sangrado tenga de dónde salirse. Sin esto el panel se
    // ajusta al texto y el recorte no se lee como recorte.
    minHeight: 230,
    justifyContent: 'flex-end',
  },
  discBleed: {
    position: 'absolute',
    right: -54,
    top: -46,
    opacity: 0.16,
  },
  title: {
    fontSize: 30,
    lineHeight: 33,
    color: '#FFFFFF',
    fontFamily: fonts.display,
    letterSpacing: -0.9,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    color: TILE_TEXT_MUTED,
    fontFamily: fonts.bodySemiBold,
    maxWidth: '88%',
  },
});
