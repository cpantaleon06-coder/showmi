import { StyleSheet, Text, View } from 'react-native';

import { CollectionType } from '../../state/libraryStore';
import { TILE_SURFACE, TILE_TEXT_MUTED } from '../../theme/collectionColors';
import { radii } from '../../theme/radii';
import { fonts } from '../../theme/typography';
import { WORDMARK_CORNER_SEQUENCE } from '../../theme/wordmark';
import { TileReveal } from './TileReveal';

interface EmptyCollectionProps {
  type: CollectionType;
  /** Color de la colección activa -- ver getCollectionColor. */
  accent: string;
}

/**
 * Colección vacía (2026-09-12).
 *
 * Antes era una frase gris centrada sobre la retícula de puntos. Funcionaba como aviso pero
 * dejaba la Biblioteca vacía viéndose como una pantalla rota, y ésta es la primera cosa que ve
 * alguien que acaba de instalar la app -- o sea, es la pantalla que más trabajo de diseño
 * necesitaba y la que menos tenía.
 *
 * Ahora es un cartel: panel negro con contorno del color de la colección, el eco de barras de
 * la referencia como elemento gráfico, y el mensaje en tipografía display. El vacío deja de
 * ser la ausencia del mosaico y pasa a ser una pieza más del mosaico.
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

/** Barras del eco: anchos decrecientes, como las capas de la referencia. */
const ECHO_BARS = [
  { width: '100%' as const, opacity: 1 },
  { width: '72%' as const, opacity: 0.55 },
  { width: '44%' as const, opacity: 0.28 },
];

export function EmptyCollection({ type, accent }: EmptyCollectionProps) {
  const copy = COPY[type];

  return (
    <View style={styles.wrap}>
      <TileReveal index={0}>
        <View style={[styles.panel, { borderColor: accent }]}>
          {/* Eco de barras: el mismo recurso que EchoTitle pero como gráfico puro. Le da al
              panel algo que mirar sin recurrir a una ilustración ni a un ícono decorativo. */}
          <View style={styles.echoStack}>
            {ECHO_BARS.map((bar) => (
              <View
                key={bar.width}
                style={[styles.echoBar, { width: bar.width, backgroundColor: accent, opacity: bar.opacity }]}
              />
            ))}
          </View>

          <Text style={styles.title}>{copy.title}</Text>
          <Text style={styles.body}>{copy.body}</Text>
        </View>
      </TileReveal>

      {/* Fila de puntos con los 6 colores del wordmark: cierra el cartel abajo y deja a la
          vista la paleta completa de la app justo cuando no hay ninguna portada que la
          muestre. Con contenido real nunca aparece, así que no compite con nada. */}
      <TileReveal index={1} style={styles.dotsRow}>
        <View style={styles.dotsRowInner}>
          {WORDMARK_CORNER_SEQUENCE.map((color) => (
            <View key={color} style={[styles.dot, { backgroundColor: color }]} />
          ))}
        </View>
      </TileReveal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingTop: 8,
    gap: 14,
  },
  panel: {
    backgroundColor: TILE_SURFACE,
    borderWidth: 2.5,
    borderRadius: radii.card,
    padding: 22,
    gap: 14,
  },
  echoStack: {
    gap: 6,
    marginBottom: 4,
  },
  echoBar: {
    height: 12,
    borderRadius: 6,
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
  },
  dotsRow: {
    alignItems: 'center',
  },
  dotsRowInner: {
    flexDirection: 'row',
    gap: 10,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
});
