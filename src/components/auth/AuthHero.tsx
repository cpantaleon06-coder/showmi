import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { Mascot } from '../camerino/Mascot';

/**
 * Cabecera ilustrada de las pantallas de cuenta.
 *
 * 2026-09-16, segunda versión: esto ya no es una escena "inspirada" en la referencia, es la
 * referencia. La primera versión tomaba elementos sueltos (tres criaturas, un globo de diálogo)
 * sobre el degradado de marca, y el usuario fue explícito: "no es referencia, tienen que ser
 * iguales".
 *
 * Así que la composición no se inventó: se MIDIÓ sobre la imagen. Las posiciones, los tamaños y
 * los giros de abajo están en los píxeles del original (un lienzo de 363 de ancho) y se escalan
 * al ancho real de la pantalla. Eso es lo que mantiene la escena reconocible en cualquier
 * teléfono -- si las hubiera puesto en porcentajes "a ojo", en un teléfono estrecho las cuatro
 * se amontonarían y en uno ancho se separarían, y dejaría de ser la misma imagen.
 *
 * Lo que la referencia hace y hay que respetar, porque es de donde sale su fuerza:
 *
 *   - LAS CRIATURAS SE SALEN DEL CUADRO. El rombo se corta arriba a la izquierda, el triángulo
 *     por la derecha y la estrella por abajo a la izquierda. Ninguna cabe entera. Encogerlas
 *     para que cupieran es exactamente lo que convertiría una ilustración en un catálogo.
 *   - SE ENCIMAN. El naranja va al frente y tapa parte del triángulo y de la estrella. Sin
 *     encimarse serían cuatro figuras sueltas y no un grupo.
 *   - EL FONDO ES AQUA, no el degradado de marca. Muestreado del original: #7CF6EE arriba a la
 *     derecha hacia #E8FEFD abajo. Los cuerpos son naranja, verde, azul y amarillo saturados, y
 *     es el aqua frío detrás lo que los hace saltar; sobre el degradado naranja de Showmi la
 *     criatura naranja casi desaparecía.
 *
 * Dos cosas que NO vienen de la imagen y son decisiones de pantalla, no de ilustración:
 *
 *   - EL BORDE INFERIOR CURVO. La imagen es un recorte cuadrado; acá el panel tiene que
 *     encontrarse con un formulario. Es la misma cúbica que usa ProfileCrest, así que las dos
 *     pantallas ilustradas de la app comparten silueta.
 * Y una que se QUITÓ: el wordmark SHOWMI que llevaba la versión anterior. En la imagen no hay
 * texto, y puesto encima caía justo sobre el rombo azul marino: en blanco desaparecía contra el
 * aqua claro del resto del panel, y en tinta oscura desaparecía contra el rombo. No hay sitio
 * legible para él dentro de esta ilustración, y el título de la pantalla ya dice dónde estás.
 */

/** Ancho del lienzo de la imagen original. Todas las medidas de abajo están en esa escala. */
const REF_ANCHO = 363;
/**
 * Alto del panel, en la escala de la referencia. El original es cuadrado (364) pero acá se
 * recorta por abajo: un panel cuadrado se comería media pantalla y dejaría el formulario fuera
 * de vista. Recortar por abajo es coherente con la propia imagen, que ya corta a tres de las
 * cuatro criaturas.
 */
const REF_ALTO = 330;
/** Cuánto baja la curva en su punto más hondo. */
const CURVA = 32;

/**
 * La escena, en píxeles del original.
 *
 * `x` e `y` son la esquina superior izquierda del cuadro de cada mascota (que es cuadrado y del
 * tamaño de `size`), no su centro: es lo que consume directamente el posicionamiento absoluto,
 * y convertir centros a esquinas en cada render sería aritmética repetida para nada.
 *
 * El ORDEN del arreglo es el orden de pintado, o sea la profundidad. El naranja va último
 * porque en la imagen está al frente.
 */
const ESCENA = [
  { shape: 'rombo' as const, size: 277, x: -61, y: -34, giro: '-4deg' },
  { shape: 'triangulo' as const, size: 219, x: 209, y: 81, giro: '3deg' },
  { shape: 'estrella' as const, size: 254, x: -65, y: 186, giro: '-25deg' },
  { shape: 'circulo' as const, size: 250, x: 78, y: 121, giro: '0deg' },
];

export function AuthHero() {
  const { width } = useWindowDimensions();
  // Escala única para toda la escena. Sale del ANCHO y no del alto a propósito: el recorte de la
  // imagen es horizontal (las criaturas se salen por los lados), así que es el ancho el que
  // tiene que cuadrar. Lo que sobre o falte de alto se resuelve recortando abajo.
  const k = width / REF_ANCHO;
  const alto = REF_ALTO * k;

  return (
    <View style={[styles.wrap, { height: alto + CURVA }]}>
      <Svg width={width} height={alto + CURVA} style={StyleSheet.absoluteFill}>
        <Defs>
          {/* Muestreado del original, no elegido: aqua saturado arriba a la derecha que se
              abre casi a blanco hacia abajo a la izquierda. */}
          <LinearGradient id="authHeroAqua" x1="1" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#7CF6EE" />
            <Stop offset="0.55" stopColor="#A5FAF4" />
            <Stop offset="1" stopColor="#E8FEFD" />
          </LinearGradient>
        </Defs>
        <Path
          d={`M0,0 L${width},0 L${width},${alto}
              C${width * 0.72},${alto + CURVA} ${width * 0.28},${alto + CURVA} 0,${alto}
              Z`}
          fill="url(#authHeroAqua)"
        />
      </Svg>

      {/* La escena va recortada por el panel: es lo que hace que las criaturas se CORTEN contra
          los bordes en vez de asomar por fuera y pisar el formulario. */}
      <View style={[styles.escena, { height: alto }]} pointerEvents="none">
        {ESCENA.map((m) => (
          <View
            key={m.shape}
            style={{
              position: 'absolute',
              left: m.x * k,
              top: m.y * k,
              transform: [{ rotate: m.giro }],
            }}
          >
            <Mascot equipped={{}} size={m.size * k} shape={m.shape} />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'flex-start', overflow: 'hidden' },
  escena: { position: 'absolute', left: 0, right: 0, top: 0, overflow: 'hidden' },
});
