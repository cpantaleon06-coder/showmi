import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { ThemeColors } from '../../theme/colors';
import { fonts } from '../../theme/typography';

interface ProfileCrestProps {
  colors: ThemeColors;
  /** Nombre grande. Sin cuenta real no hay ninguno, y quien llama decide qué poner. */
  displayName: string;
  /** Línea de estado bajo el nombre. Quien llama decide qué contar ahí. */
  subtitle: string;
}

/**
 * Cabecera del Perfil: telón de color con el borde inferior curvo y el avatar en un aro que lo
 * monta (2026-09-13).
 *
 * Viene de las referencias que mandó el usuario: la curva y el aro claro que despega el avatar
 * del fondo de color vienen de LUSH Club y de las tarjetas de perfil; el nombre grande con su
 * línea de estado debajo viene de LEX.
 *
 * 2026-09-16, al eliminarse las mascotas: el avatar pasó de ser la criatura del Camerino a un
 * MONOGRAMA con la inicial del nombre. No se sustituyó por una foto de perfil porque Showmi no
 * tiene fotos y no debería fingir que las tiene; la inicial es lo que puede decirse con lo que
 * el producto realmente sabe de la persona.
 *
 * En la misma limpieza desaparecieron las dos cifras que flanqueaban al avatar ("Calificadas" y
 * "Al siguiente"): las dos salían del progreso por categoría, que existía únicamente para
 * desbloquear cosméticos. Sin cosméticos, un nivel no abre nada y anunciarlo sería prometer algo
 * que no llega. Las cifras que sí siguen significando algo (guardadas, géneros, artistas,
 * vibras) ya estaban en su propia fila justo debajo, así que no se perdió ninguna información:
 * se perdió una repetida que además ya no era cierta.
 *
 * El telón se acortó de 132 a 104 en la misma operación. No es estética: sin las dos cifras
 * dentro, 132 de degradado vacío se leían como un hueco donde antes había algo.
 */

/** Alto del telón de color, sin contar la curva. */
const BANNER_HEIGHT = 104;
/** Cuánto baja la curva en su punto más hondo. */
const CURVE_DEPTH = 34;
const AVATAR_RING = 104;
const AVATAR = 84;

export function ProfileCrest({ colors, displayName, subtitle }: ProfileCrestProps) {
  const { width } = useWindowDimensions();
  const totalH = BANNER_HEIGHT + CURVE_DEPTH;
  const inicial = (displayName.trim()[0] ?? '?').toUpperCase();

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
              onda de varios picos: con más de un pico el borde compite con el avatar que lo
              monta, que es lo que tiene que mirarse. */}
          <Path
            d={`M0,0 L${width},0 L${width},${BANNER_HEIGHT}
                C${width * 0.72},${BANNER_HEIGHT + CURVE_DEPTH} ${width * 0.28},${BANNER_HEIGHT + CURVE_DEPTH} 0,${BANNER_HEIGHT}
                Z`}
            fill="url(#crest)"
          />
        </Svg>
      </View>

      {/* Empuja el aro hasta el borde del telón. Antes ese hueco lo ocupaba la fila de cifras. */}
      <View style={{ height: BANNER_HEIGHT }} />

      <View style={[styles.avatarRing, { backgroundColor: colors.background }]}>
        <View style={[styles.avatar, { backgroundColor: colors.surface }]}>
          <Text style={[styles.inicial, { color: colors.textPrimary }]}>{inicial}</Text>
        </View>
      </View>

      <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>
        {displayName}
      </Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={1}>
        {subtitle}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  bannerLayer: { position: 'absolute', top: 0, left: 0, right: 0 },
  /** Sube para montar la curva: el aro es lo que cose el telón con el contenido de abajo. El
   *  borde es del color del FONDO, no blanco, para que en los dos temas lea como un recorte
   *  limpio y no como un anillo pintado. */
  avatarRing: {
    width: AVATAR_RING,
    height: AVATAR_RING,
    borderRadius: AVATAR_RING / 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -AVATAR_RING / 2 - 8,
  },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inicial: { fontSize: 36, fontFamily: fonts.display, letterSpacing: -1 },
  name: {
    marginTop: 12,
    fontSize: 26,
    fontFamily: fonts.display,
    letterSpacing: -0.6,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 3,
    fontSize: 13,
    fontFamily: fonts.bodySemiBold,
    textAlign: 'center',
  },
});
