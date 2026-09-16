import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { Mascot } from '../camerino/Mascot';
import { ThemeColors } from '../../theme/colors';
import { fonts } from '../../theme/typography';

/**
 * Cabecera ilustrada de las pantallas de cuenta (2026-09-16).
 *
 * Antes, registrarse en Showmi era un título, un párrafo y dos campos: la misma pantalla que
 * tiene cualquier app, en una app cuya única cosa memorable son sus criaturas. Y es la primera
 * pantalla donde alguien decide si esto le cae bien, así que era el peor sitio para no
 * enseñarlas.
 *
 * Tres recursos tomados de las referencias que mandó el usuario, traídos a lo que Showmi ya
 * tiene en vez de copiarlos:
 *
 *   - El PANEL DE COLOR CON BORDE INFERIOR CURVO (Worly). Acá no se dibuja de cero: es la
 *     misma cúbica simétrica que ya usa ProfileCrest, así que las dos pantallas ilustradas de
 *     la app comparten silueta en vez de parecerse de casualidad.
 *   - LAS TRES CRIATURAS COMO ESCENA (moimoi). Showmi tiene tres formas y hasta hoy solo se
 *     veían de una en una, en el Camerino. Juntas, a tamaños y alturas distintas, se leen como
 *     un elenco -- que es lo que son.
 *   - EL GLOBO DE DIÁLOGO saludando (moimoi), que es lo que convierte la ilustración en algo
 *     que te habla en vez de un adorno.
 *
 * La cara RECORTADA por el borde superior (la referencia azul) se probó y se descartó: con el
 * wordmark arriba, cortar una mascota contra el mismo borde dejaba dos cosas peleando por el
 * mismo sitio. La escena de tres cuerpos enteros dice lo mismo sin ese choque.
 */

/** Alto del panel sin contar la curva. */
const PANEL = 244;
/** Cuánto baja la curva en su punto más hondo. */
const CURVA = 34;

interface AuthHeroProps {
  colors: ThemeColors;
  /** Lo que dice el globo. Cambia entre crear cuenta e iniciar sesión. */
  saludo: string;
}

export function AuthHero({ colors, saludo }: AuthHeroProps) {
  const { width } = useWindowDimensions();
  const alto = PANEL + CURVA;

  return (
    <View style={[styles.wrap, { height: alto }]}>
      <Svg width={width} height={alto} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="authHero" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colors.nagaiGradient[0]} />
            <Stop offset="0.5" stopColor={colors.nagaiGradient[1]} />
            <Stop offset="1" stopColor={colors.nagaiGradient[2]} />
          </LinearGradient>
        </Defs>
        <Path
          d={`M0,0 L${width},0 L${width},${PANEL}
              C${width * 0.72},${PANEL + CURVA} ${width * 0.28},${PANEL + CURVA} 0,${PANEL}
              Z`}
          fill="url(#authHero)"
        />
      </Svg>

      <Text style={styles.wordmark}>SHOWMI</Text>

      {/* Escena. Posiciones absolutas y no una fila: una fila las alinearía por la base y las
          tres quedarían a la misma altura, que es justo lo que hace que un grupo de personajes
          se vea como un catálogo en vez de como una escena. */}
      <View style={styles.escena} pointerEvents="none">
        <View style={[styles.lado, styles.izquierda]}>
          <Mascot equipped={{}} size={72} shape="triangulo" />
        </View>

        <View style={styles.centro}>
          <Mascot equipped={{}} size={104} shape="circulo" />
        </View>

        <View style={[styles.lado, styles.derecha]}>
          <Mascot equipped={{}} size={80} shape="rombo" />
        </View>

        {/* El globo va sobre el hombro de la criatura del centro, no centrado: centrado se lee
            como un rótulo, y descentrado se lee como que ALGUIEN lo dijo. */}
        <View style={styles.globo}>
          <Text style={styles.globoTexto}>{saludo}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'flex-start' },
  /** Blanco fijo en los dos temas: el panel es el degradado de identidad en ambos, así que el
   *  texto de encima no puede seguir al tema. Mismo criterio que ProfileCrest. */
  wordmark: {
    marginTop: 14,
    fontSize: 30,
    letterSpacing: 2,
    color: '#FFFFFF',
    fontFamily: fonts.display,
  },
  escena: {
    position: 'absolute',
    left: 0,
    right: 0,
    // Ancladas ABAJO, no arriba: apoyadas casi sobre la curva se leen como paradas en el borde
    // del panel. Con la escena arriba quedaba un tercio de degradado vacío debajo y las tres
    // parecían flotando en el aire.
    bottom: CURVA + 4,
    height: 132,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  centro: { position: 'absolute', bottom: 0 },
  lado: { position: 'absolute', bottom: 6 },
  // Rotaciones mínimas y en sentidos opuestos: lo justo para que no parezcan pegadas con
  // escuadra. Más de ~8 grados y empiezan a verse caídas, no relajadas.
  izquierda: { left: '12%', transform: [{ rotate: '-7deg' }] },
  derecha: { right: '11%', bottom: 18, transform: [{ rotate: '6deg' }] },
  globo: {
    position: 'absolute',
    // Justo encima del hombro de la del centro: así se lee como que ELLA lo dijo. Suelto y
    // centrado bajo el wordmark parecía un rótulo de la pantalla, no algo dicho.
    top: 2,
    right: '8%',
    backgroundColor: '#141414',
    borderRadius: 16,
    paddingHorizontal: 13,
    paddingVertical: 7,
  },
  globoTexto: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: fonts.bodyBold,
  },
});
