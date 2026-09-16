import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { CrownIcon } from 'phosphor-react-native';

import { ThemeColors } from '../../theme/colors';
import { fonts } from '../../theme/typography';
import { wordmark } from '../../theme/wordmark';

interface ProfileCrestProps {
  colors: ThemeColors;
  /** Nombre grande. Sin cuenta real no hay ninguno, y quien llama decide qué poner. */
  displayName: string;
  /** Línea de estado bajo el nombre. Quien llama decide qué contar ahí. */
  subtitle: string;
  /** Pinta la insignia de More en la esquina de la tarjeta. */
  isPremium: boolean;
  /** Enlace pequeño al lado del nombre. El rótulo cambia según haya cuenta o no. */
  actionLabel: string;
  onPressAction: () => void;
}

/**
 * Cabecera del Perfil (reconstruida 2026-09-16 desde la referencia que mandó el usuario, la
 * pantalla de perfil de Reddit).
 *
 * Lo que se tomó de la referencia, y por qué cada cosa:
 *
 *   - EL AVATAR COMO TARJETA VERTICAL ENMARCADA, no como círculo. Es lo que más carácter le da
 *     a la referencia: se lee como una credencial o un cromo, no como una foto de contacto. El
 *     marco va en `surface` y no en `background`: probado con `background`, el marco era
 *     invisible en cuanto la tarjeta bajaba de la curva, porque tenía el color de lo que tenía
 *     detrás. Es un marco, tiene que verse.
 *   - LA COLUMNA IZQUIERDA. Tarjeta, nombre y cifras apoyados contra el mismo margen. Es lo
 *     que distingue a la referencia de cualquier perfil centrado.
 *   - EL NOMBRE GRANDE CON UNA ACCIÓN PEQUEÑA AL LADO ("Editar" en la referencia). Puesta en la
 *     misma línea y subrayada, la acción se lee como parte del nombre y no como un botón más de
 *     la pantalla.
 *   - LAS CIFRAS EN FILA CON SEPARADORES FINOS. Las cifras ya existían en Showmi; lo que se
 *     copió es el tratamiento -- número grande arriba, rótulo chico abajo, y una línea de un
 *     pixel entre columnas. Sin la línea, cuatro pares de número+rótulo se leen como una sopa;
 *     con ella se leen como una tabla.
 *
 * Lo que NO se copió: la referencia tiene foto de avatar dibujada. Showmi no tiene ni fotos de
 * perfil ni ilustración propia (las mascotas se eliminaron el mismo día), así que la tarjeta
 * lleva el WORDMARK, que es la identidad que el producto sí tiene: las seis letras, cada una
 * con su color muestreado (ver theme/wordmark.ts). Poner ahí el icono de la app se descartó
 * porque hoy ese icono es todavía el de Expo por defecto.
 *
 * El interior de la tarjeta es tinta fija (#141414) y no `colors.surface`: los seis colores del
 * wordmark están calibrados para verse sobre oscuro, y en tema claro el amarillo (#F9EB06)
 * sobre una superficie clara desaparecía.
 */

/** Alto del telón de color, sin contar la curva. */
const BANNER_HEIGHT = 128;
/** Cuánto baja la curva en su punto más hondo. */
const CURVE_DEPTH = 34;

const CARD_W = 116;
const CARD_H = 150;
/** Grosor del marco que despega la tarjeta del telón. */
const FRAME = 7;

/** Las seis letras en dos columnas por tres filas: llena la tarjeta vertical sin estirar nada. */
const LETRAS: { letra: string; color: string }[] = [
  { letra: 'S', color: wordmark.s.corner },
  { letra: 'H', color: wordmark.h.corner },
  { letra: 'O', color: wordmark.o.corner },
  { letra: 'W', color: wordmark.w.corner },
  { letra: 'M', color: wordmark.m.corner },
  { letra: 'I', color: wordmark.i.corner },
];

export function ProfileCrest({
  colors,
  displayName,
  subtitle,
  isPremium,
  actionLabel,
  onPressAction,
}: ProfileCrestProps) {
  const { width } = useWindowDimensions();
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
              onda de varios picos: con más de un pico el borde compite con la tarjeta que lo
              monta, que es lo que tiene que mirarse. */}
          <Path
            d={`M0,0 L${width},0 L${width},${BANNER_HEIGHT}
                C${width * 0.72},${BANNER_HEIGHT + CURVE_DEPTH} ${width * 0.28},${BANNER_HEIGHT + CURVE_DEPTH} 0,${BANNER_HEIGHT}
                Z`}
            fill="url(#crest)"
          />
        </Svg>
      </View>

      {/* Empuja la tarjeta hasta donde tiene que montar la curva. */}
      <View style={{ height: BANNER_HEIGHT - 44 }} />

      <View style={styles.columna}>
      <View style={[styles.marco, { backgroundColor: colors.surface }]}>
        <View style={styles.tarjeta}>
          <View style={styles.rejilla}>
            {LETRAS.map(({ letra, color }) => (
              <Text key={letra} style={[styles.letra, { color }]}>
                {letra}
              </Text>
            ))}
          </View>
        </View>

        {/* Insignia en la esquina, como los distintivos de la referencia. Solo aparece si hay
            algo real que distinguir -- una esquina siempre ocupada deja de significar nada. */}
        {isPremium && (
          <View style={[styles.insignia, { borderColor: colors.surface }]}>
            <CrownIcon weight="fill" size={13} color="#1A1405" />
          </View>
        )}
      </View>

      <View style={styles.nombreFila}>
        <Text style={[styles.nombre, { color: colors.textPrimary }]} numberOfLines={1}>
          {displayName}
        </Text>
        <Pressable onPress={onPressAction} hitSlop={8}>
          <Text style={[styles.accion, { color: colors.textPrimary }]}>{actionLabel}</Text>
        </Pressable>
      </View>

      <Text style={[styles.subtitulo, { color: colors.textSecondary }]} numberOfLines={1}>
        {subtitle}
      </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // El margen izquierdo va en `columna` y NO acá: en React Native lo posicionado en absoluto se
  // coloca dentro del padding del padre, así que un paddingHorizontal en `wrap` metía el telón
  // 22px por cada lado y dejaba de ir de borde a borde.
  wrap: { alignItems: 'stretch' },
  // Alineado a la IZQUIERDA, como la referencia. Centrado es lo que hace cualquier perfil; la
  // referencia apoya la tarjeta, el nombre y las cifras contra el mismo margen, y esa columna
  // es la mitad de su carácter.
  columna: { alignItems: 'flex-start', paddingHorizontal: 22 },
  bannerLayer: { position: 'absolute', top: 0, left: 0, right: 0 },
  marco: {
    padding: FRAME,
    borderRadius: 22,
  },
  tarjeta: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 16,
    backgroundColor: '#141414',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  rejilla: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 78,
    justifyContent: 'center',
  },
  letra: {
    width: 39,
    textAlign: 'center',
    fontSize: 30,
    lineHeight: 40,
    fontFamily: fonts.display,
  },
  insignia: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    backgroundColor: '#C9A227',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nombreFila: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 12,
  },
  nombre: {
    fontSize: 26,
    fontFamily: fonts.display,
    letterSpacing: -0.6,
    flexShrink: 1,
  },
  /** Subrayado, como en la referencia: es lo que lo separa del nombre sin necesitar un botón
   *  con fondo, que a este tamaño competiría con el nombre en vez de acompañarlo. */
  accion: {
    fontSize: 14,
    fontFamily: fonts.bodyBold,
    textDecorationLine: 'underline',
  },
  subtitulo: {
    marginTop: 4,
    fontSize: 13,
    fontFamily: fonts.bodySemiBold,
  },
});
