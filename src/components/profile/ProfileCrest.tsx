import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { Mascot } from '../camerino/Mascot';
import { useCamerinoStore, visibleEquipped } from '../../state/camerinoStore';
import { useSubscriptionStore } from '../../state/subscriptionStore';
import { GenreCategory } from '../../lib/cosmetics';
import { MAX_LEVEL, levelForRatings, progressToNextLevel } from '../../lib/cosmetics';
import { ThemeColors } from '../../theme/colors';
import { fonts } from '../../theme/typography';

interface ProfileCrestProps {
  colors: ThemeColors;
  /** Nombre grande. Sin cuenta real no hay ninguno, y quien llama decide qué poner. */
  displayName: string;
}

/**
 * Cabecera del Perfil: telón de color con el borde inferior curvo, la mascota en un aro que lo
 * monta, y dos cifras flanqueándola (2026-09-13).
 *
 * Es la síntesis de las tres referencias que mandó el usuario: la curva y las dos cifras a los
 * lados del avatar vienen de LUSH Club, el nombre grande con su línea de estado debajo viene
 * de LEX, y el aro claro que despega el avatar del fondo de color viene de las tarjetas de
 * perfil. Traído al lenguaje de Showmi: el avatar es la MASCOTA con lo que tenga equipado en
 * el Camerino, no una foto -- este producto no tiene fotos de perfil y no debería fingir que
 * las tiene.
 *
 * El nivel que se muestra es el de la CATEGORÍA DOMINANTE, no un promedio ni una suma. Los
 * umbrales (LEVEL_THRESHOLDS, ver cosmetics.ts) están calibrados para una categoría: sumarlos
 * todos inflaría el nivel y prometería cosméticos que el Camerino no va a desbloquear. Mostrar
 * "Nivel 2 · Latino" es cierto y además explica de dónde sale.
 */

/** Alto del telón de color, sin contar la curva. */
const BANNER_HEIGHT = 132;
/** Cuánto baja la curva en su punto más hondo. */
const CURVE_DEPTH = 34;
const MASCOT_RING = 104;

export function ProfileCrest({ colors, displayName }: ProfileCrestProps) {
  const { width } = useWindowDimensions();
  const equipped = useCamerinoStore((s) => s.equipped);
  const ratingsByCategory = useCamerinoStore((s) => s.ratingsByCategory);
  const isPremium = useSubscriptionStore((s) => s.isPremium);

  // Categoría dominante = la más calificada. Con empate gana la primera, que es estable
  // porque el orden de Object.entries sigue el de inserción.
  const entries = Object.entries(ratingsByCategory) as [GenreCategory, number][];
  const dominant = entries.reduce<[GenreCategory, number] | null>(
    (best, cur) => (best === null || cur[1] > best[1] ? cur : best),
    null,
  );
  const ratings = dominant?.[1] ?? 0;
  const level = levelForRatings(ratings);
  const progress = Math.round(progressToNextLevel(ratings) * 100);

  const totalH = BANNER_HEIGHT + CURVE_DEPTH;

  return (
    <View style={styles.wrap}>
      <View style={styles.bannerLayer} pointerEvents="none">
        <Svg width={width} height={totalH}>
          <Defs>
            <LinearGradient id="crest" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={colors.nagaiGradient[0]} />
              <Stop offset="0.5" stopColor={colors.nagaiGradient[1]} />
              <Stop offset="1" stopColor={colors.nagaiGradient[2]} />
            </LinearGradient>
          </Defs>
          {/* Rectángulo cuyo borde inferior es una curva. Una sola cúbica simétrica, no una
              onda de varios picos: con más de un pico el borde compite con la mascota que lo
              monta, que es lo que tiene que mirarse. */}
          <Path
            d={`M0,0 L${width},0 L${width},${BANNER_HEIGHT}
                C${width * 0.72},${BANNER_HEIGHT + CURVE_DEPTH} ${width * 0.28},${BANNER_HEIGHT + CURVE_DEPTH} 0,${BANNER_HEIGHT}
                Z`}
            fill="url(#crest)"
          />
        </Svg>
      </View>

      <View style={[styles.statsRow, { height: BANNER_HEIGHT }]}>
        <CrestStat label="Calificadas" value={String(ratings)} />
        {/* Hueco del ancho del aro: la mascota va en su propia capa para poder montar la
            curva, así que acá solo se le reserva el sitio. */}
        <View style={{ width: MASCOT_RING }} />
        <CrestStat label={level >= MAX_LEVEL ? 'Nivel máximo' : 'Al siguiente'} value={`${progress}%`} />
      </View>

      <View style={[styles.mascotRing, { backgroundColor: colors.background, borderColor: colors.background }]}>
        <Mascot colors={colors} equipped={visibleEquipped(equipped, isPremium)} size={84} />
      </View>

      <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>
        {displayName}
      </Text>
      <Text style={[styles.level, { color: colors.textSecondary }]}>
        {dominant ? `Nivel ${level} · ${dominant[0]}` : 'Sin nivel todavía — califica canciones'}
      </Text>
    </View>
  );
}

function CrestStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.crestStat}>
      <Text style={styles.crestStatLabel}>{label}</Text>
      <Text style={styles.crestStatValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  bannerLayer: { position: 'absolute', top: 0, left: 0, right: 0 },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    paddingHorizontal: 22,
    gap: 12,
  },
  crestStat: { flex: 1, alignItems: 'center', gap: 2 },
  /* Blanco fijo: el telón es el degradado Nagai en los DOS temas, así que el texto de encima
     no puede seguir al tema -- en claro, colors.textPrimary es casi negro y desaparecería. */
  crestStatLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.82)',
    fontFamily: fonts.bodySemiBold,
    textAlign: 'center',
  },
  crestStatValue: {
    fontSize: 22,
    color: '#FFFFFF',
    fontFamily: fonts.display,
    letterSpacing: -0.5,
  },
  /** Sube para montar la curva: el aro es lo que cose el telón con el contenido de abajo. El
   *  borde es del color del FONDO, no blanco, para que en los dos temas lea como un recorte
   *  limpio y no como un anillo pintado. */
  mascotRing: {
    width: MASCOT_RING,
    height: MASCOT_RING,
    borderRadius: MASCOT_RING / 2,
    borderWidth: 5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -MASCOT_RING / 2 - 8,
  },
  name: {
    marginTop: 12,
    fontSize: 26,
    fontFamily: fonts.display,
    letterSpacing: -0.6,
    textAlign: 'center',
  },
  level: {
    marginTop: 3,
    fontSize: 13,
    fontFamily: fonts.bodySemiBold,
    textAlign: 'center',
  },
});
