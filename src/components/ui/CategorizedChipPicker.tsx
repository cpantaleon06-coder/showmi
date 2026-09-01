import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ThemeColors } from '../../theme/colors';
import { fonts } from '../../theme/typography';
import { GradientChip } from './GradientChip';

interface CategorizedItem<T extends string> {
  key: T;
  category: string;
  label: string;
  emoji: string;
}

interface CategorizedChipPickerProps<T extends string> {
  colors: ThemeColors;
  items: CategorizedItem<T>[];
  /** Orden de aparición de las secciones -- no alfabético, decidido por producto
   *  (ver GENRE_CATEGORY_ORDER/VIBE_CATEGORY_ORDER en lib/genres.ts, lib/vibes.ts). */
  categoryOrder: string[];
  /** Decide selección por key en vez de recibir un único `T | null` -- así el mismo picker
   *  sirve tanto para selección única (sesión: `isSelected={(k) => k === genre}`) como
   *  múltiple (onboarding: `isSelected={(k) => genres.includes(k)}`); quien llama decide la
   *  semántica de `onSelect`, este componente solo dispara el toggle por item. */
  isSelected: (key: T) => boolean;
  onSelect: (key: T) => void;
  /** Color de fill por item -- opcional, para que una vibra reaccione con SU propio color
   *  (ver theme/vibeColors.ts) en vez del rojo de marca genérico. Sin esto, GradientChip usa
   *  su default (colors.brand). */
  fillColorFor?: (key: T) => string;
}

const INITIAL_VISIBLE = 6;

/**
 * Selector categorizado con "mostrar más" por sección -- reemplaza las filas de scroll
 * horizontal cuando la taxonomía crece demasiado para escanearse de un vistazo (37 géneros,
 * 18 vibras, ver GenreCategory/VibeCategory). Referencia de diseño: el picker de intereses de
 * apps tipo Hinge que mandó el usuario -- secciones con encabezado, chips en grid que
 * envuelve (no scroll horizontal), y un toggle de texto para expandir cada sección por
 * separado en vez de mostrar las 37 opciones de una.
 *
 * Genérico sobre T (CanonicalGenre | VibeKey) para que un solo componente sirva para las dos
 * taxonomías -- misma interacción, mismos estilos, sin duplicar el layout.
 */
export function CategorizedChipPicker<T extends string>({
  colors,
  items,
  categoryOrder,
  isSelected,
  onSelect,
  fillColorFor,
}: CategorizedChipPickerProps<T>) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleExpanded = (category: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  };

  return (
    <View>
      {categoryOrder.map((category) => {
        const categoryItems = items.filter((item) => item.category === category);
        if (categoryItems.length === 0) return null;

        const isExpanded = expanded.has(category);
        const visibleItems = isExpanded ? categoryItems : categoryItems.slice(0, INITIAL_VISIBLE);
        const hiddenCount = categoryItems.length - visibleItems.length;

        return (
          <View key={category} style={styles.section}>
            <Text style={[styles.categoryLabel, { color: colors.textSecondary }]}>{category}</Text>
            <View style={styles.chipGrid}>
              {visibleItems.map((item) => (
                <GradientChip
                  key={item.key}
                  colors={colors}
                  label={`${item.emoji} ${item.label}`}
                  selected={isSelected(item.key)}
                  onPress={() => onSelect(item.key)}
                  fillColor={fillColorFor?.(item.key)}
                />
              ))}
            </View>
            {(hiddenCount > 0 || isExpanded) && categoryItems.length > INITIAL_VISIBLE && (
              <Pressable onPress={() => toggleExpanded(category)} hitSlop={8} style={styles.showMore}>
                <Text style={[styles.showMoreText, { color: colors.brand }]}>
                  {isExpanded ? 'Mostrar menos' : `Mostrar ${hiddenCount} más`}
                </Text>
              </Pressable>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 20,
  },
  categoryLabel: {
    fontSize: 12,
    fontFamily: fonts.bodyBold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  showMore: {
    marginTop: 8,
  },
  showMoreText: {
    fontSize: 13,
    fontFamily: fonts.bodyBold,
  },
});
