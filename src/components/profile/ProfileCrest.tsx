import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { ClipPath, Defs, Image as SvgImage, LinearGradient, Path, Stop } from 'react-native-svg';
import { Image } from 'expo-image';
import { CameraIcon, CrownIcon, XIcon } from 'phosphor-react-native';

import { useProfileImageStore } from '../../state/profileImageStore';
import { elegirFotoPerfil, elegirPortada } from '../../lib/imagenPerfil';
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
 * Lo que se tomó de la referencia:
 *
 *   - EL AVATAR COMO TARJETA VERTICAL ENMARCADA, no como círculo. Es lo que más carácter le da:
 *     se lee como una credencial o un cromo, no como una foto de contacto. El marco va en
 *     `surface` y no en `background`: probado con `background`, era invisible en cuanto la
 *     tarjeta bajaba de la curva, porque tenía el color de lo que tenía detrás.
 *   - LA COLUMNA IZQUIERDA. Tarjeta, nombre y cifras contra el mismo margen.
 *   - EL NOMBRE GRANDE CON UNA ACCIÓN PEQUEÑA AL LADO. En la misma línea y subrayada, se lee
 *     como parte del nombre y no como un botón más de la pantalla.
 *
 * IMÁGENES DE LA PERSONA (2026-09-16). La tarjeta admite una foto y el telón una portada. Las
 * dos son opcionales y las dos tienen un respaldo que NO es un hueco gris: sin foto, la tarjeta
 * enseña el wordmark (las seis letras con su color); sin portada, el telón es el degradado de
 * marca de siempre. Eso importa -- un perfil recién hecho tiene que verse terminado, no vacío a
 * la espera de que alguien lo rellene.
 *
 * La portada se recorta con la MISMA curva que dibuja el degradado, vía clipPath, en vez de
 * meterse en un rectángulo: si la foto fuera recta y el degradado curvo, la cabecera cambiaría
 * de silueta según la persona hubiera puesto foto o no.
 *
 * La equis de quitar solo aparece cuando hay algo que quitar: un botón de borrar permanentemente
 * visible sobre un avatar vacío no significa nada.
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

  const avatarUri = useProfileImageStore((s) => s.avatarUri);
  const portadaUri = useProfileImageStore((s) => s.portadaUri);
  const setAvatar = useProfileImageStore((s) => s.setAvatar);
  const setPortada = useProfileImageStore((s) => s.setPortada);

  // Bloquea los botones mientras el selector está abierto. Sin esto, dos toques rápidos abren
  // dos selectores encadenados y el segundo resultado pisa al primero.
  const [eligiendo, setEligiendo] = useState(false);

  const elegir = async (cual: 'avatar' | 'portada') => {
    if (eligiendo) return;
    setEligiendo(true);
    try {
      const uri = cual === 'avatar' ? await elegirFotoPerfil() : await elegirPortada();
      // null = canceló o negó el permiso. En los dos casos se deja lo que hubiera: cancelar no
      // puede significar "bórrame la foto que ya tenía".
      if (uri) (cual === 'avatar' ? setAvatar : setPortada)(uri);
    } finally {
      setEligiendo(false);
    }
  };

  const curva = `M0,0 L${width},0 L${width},${BANNER_HEIGHT}
      C${width * 0.72},${BANNER_HEIGHT + CURVE_DEPTH} ${width * 0.28},${BANNER_HEIGHT + CURVE_DEPTH} 0,${BANNER_HEIGHT}
      Z`;

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
            <ClipPath id="crestCurva">
              <Path d={curva} />
            </ClipPath>
          </Defs>

          {portadaUri ? (
            // `slice` y no `meet`: la portada tiene que CUBRIR el telón aunque le sobre por un
            // lado. Con `meet`, una foto de proporción distinta dejaría franjas vacías a los
            // lados, que es exactamente el aspecto de algo mal montado.
            <SvgImage
              href={{ uri: portadaUri }}
              x={0}
              y={0}
              width={width}
              height={totalH}
              preserveAspectRatio="xMidYMid slice"
              clipPath="url(#crestCurva)"
            />
          ) : (
            <Path d={curva} fill="url(#crest)" />
          )}
        </Svg>
      </View>

      <View style={styles.columna}>
        {/* Empuja la tarjeta hasta donde tiene que montar la curva. */}
        <View style={{ height: BANNER_HEIGHT - 44 }} />

        <View style={[styles.marco, { backgroundColor: colors.surface }]}>
          <Pressable onPress={() => elegir('avatar')} style={styles.tarjeta}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.foto} contentFit="cover" />
            ) : (
              <View style={styles.rejilla}>
                {LETRAS.map(({ letra, color }) => (
                  <Text key={letra} style={[styles.letra, { color }]}>
                    {letra}
                  </Text>
                ))}
              </View>
            )}

            {/* Sobre la propia tarjeta, no al lado: es la pista de que la tarjeta se toca. */}
            <View style={styles.camara}>
              <CameraIcon weight="fill" size={13} color="#FFFFFF" />
            </View>
          </Pressable>

          {avatarUri && (
            <Pressable
              onPress={() => setAvatar(null)}
              hitSlop={8}
              style={[styles.quitarFoto, { borderColor: colors.surface }]}
            >
              <XIcon weight="bold" size={12} color="#FFFFFF" />
            </Pressable>
          )}

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

      {/* Controles de la portada. A la derecha porque la izquierda ya es del botón de volver.
          VAN AL FINAL DEL ÁRBOL a propósito: aunque estén posicionados en absoluto, `columna`
          es un hermano posterior que ocupa también esta zona y, por orden de pintado, se comía
          los toques. Probado: la equis del avatar respondía y la de la portada no, porque la
          primera está DENTRO de `columna` y la segunda quedaba debajo. El zIndex es el cinturón
          de seguridad para nativo, donde el orden del árbol no siempre basta. */}
      <View style={styles.portadaBotones}>
        {portadaUri && (
          <Pressable onPress={() => setPortada(null)} hitSlop={8} style={styles.botonRedondo}>
            <XIcon weight="bold" size={14} color="#FFFFFF" />
          </Pressable>
        )}
        <Pressable onPress={() => elegir('portada')} hitSlop={8} style={styles.botonRedondo}>
          <CameraIcon weight="fill" size={15} color="#FFFFFF" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // El margen izquierdo va en `columna` y NO acá: en React Native lo posicionado en absoluto se
  // coloca dentro del padding del padre, así que un paddingHorizontal en `wrap` metía el telón
  // 22px por cada lado y dejaba de ir de borde a borde.
  wrap: { alignItems: 'stretch' },
  bannerLayer: { position: 'absolute', top: 0, left: 0, right: 0 },
  // Alineado a la IZQUIERDA, como la referencia. Centrado es lo que hace cualquier perfil; la
  // referencia apoya la tarjeta, el nombre y las cifras contra el mismo margen, y esa columna
  // es la mitad de su carácter.
  columna: { alignItems: 'flex-start', paddingHorizontal: 22 },
  portadaBotones: { position: 'absolute', top: 14, right: 16, flexDirection: 'row', gap: 8, zIndex: 2 },
  /** Fondo translúcido oscuro y no del tema: van encima de una FOTO cualquiera, y ningún color
   *  del tema puede garantizar contraste contra una imagen que todavía no existe. */
  botonRedondo: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  marco: { padding: FRAME, borderRadius: 22 },
  tarjeta: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 16,
    backgroundColor: '#141414',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  foto: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  rejilla: { flexDirection: 'row', flexWrap: 'wrap', width: 78, justifyContent: 'center' },
  letra: {
    width: 39,
    textAlign: 'center',
    fontSize: 30,
    lineHeight: 40,
    fontFamily: fonts.display,
  },
  camara: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quitarFoto: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    backgroundColor: '#141414',
    alignItems: 'center',
    justifyContent: 'center',
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
  nombreFila: { marginTop: 12, flexDirection: 'row', alignItems: 'baseline', gap: 12 },
  nombre: { fontSize: 26, fontFamily: fonts.display, letterSpacing: -0.6, flexShrink: 1 },
  /** Subrayado, como en la referencia: es lo que lo separa del nombre sin necesitar un botón
   *  con fondo, que a este tamaño competiría con el nombre en vez de acompañarlo. */
  accion: { fontSize: 14, fontFamily: fonts.bodyBold, textDecorationLine: 'underline' },
  subtitulo: { marginTop: 4, fontSize: 13, fontFamily: fonts.bodySemiBold },
});
