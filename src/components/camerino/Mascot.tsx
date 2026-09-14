import type { ReactNode } from 'react';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, Path, Polygon, Rect } from 'react-native-svg';

import { CosmeticSlot, cosmeticById } from '../../lib/cosmetics';
import { wordmark } from '../../theme/wordmark';

/** Las tres criaturas. Cada una es una forma primitiva distinta -- esa restricción ES el
 *  sistema, no una limitación. */
export type MascotShape = 'circulo' | 'triangulo' | 'cuadrado';

/**
 * Sin `colors`: desde que la tinta es fija y no hay contorno, la mascota NO depende del tema.
 * Se quita el prop en vez de dejarlo sin usar -- un parámetro que se ignora hace creer a quien
 * lo lee que la mascota reacciona al tema, y ya no lo hace.
 */
interface MascotProps {
  /** slot -> id de cosmético, ya filtrado por lo que la persona puede usar (ver visibleEquipped). */
  equipped: Partial<Record<CosmeticSlot, string>>;
  size?: number;
  shape?: MascotShape;
}

/**
 * Mezcla un hex hacia otro. Se usa para sacar el tono de los muñones del color del cuerpo en
 * vez de declarar un segundo color por criatura: así el muñón nunca puede desentonar, y si
 * algún día cambia la paleta no hay que acordarse de ajustar dos valores.
 */
function mix(hex: string, towards: string, amount: number): string {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [r1, g1, b1] = p(hex);
  const [r2, g2, b2] = p(towards);
  const c = (a: number, b: number) => Math.round(a + (b - a) * amount).toString(16).padStart(2, '0');
  return `#${c(r1, r2)}${c(g1, g2)}${c(b1, b2)}`;
}

/**
 * Geometría de cada criatura.
 *
 * TODAS comparten la altura de los ojos (cy=40) y el borde superior (y=4) a propósito, y no
 * porque sea lo más bonito para cada forma: los once cosméticos del Camerino están anclados a
 * esas dos referencias -- los sombreros al borde de arriba, los lentes y el visor a los ojos.
 * Mover los ojos por criatura dejaría los lentes flotando en dos de las tres.
 *
 * Verificado con aritmética antes de dibujar nada: a la altura y=40 los ojos ocupan de x=39 a
 * x=81, y el triángulo (el más estrecho ahí arriba) mide de 38 a 82. Entra por un pelo, y por
 * eso su base es tan ancha -- no es una elección estética, es el mínimo que permite que los
 * lentes le queden puestos.
 */
const SHAPES: Record<MascotShape, { body: string; color: string; pupil: 'redonda' | 'cuadrada'; parpados: boolean; boca: string; munones: [number, number] }> = {
  // Cabezón dormido: párpados caídos y media sonrisa. El de la referencia naranja.
  circulo: {
    body: 'M60,4 C79.9,4 96,20.1 96,40 C96,59.9 79.9,76 60,76 C40.1,76 24,59.9 24,40 C24,20.1 40.1,4 60,4 Z',
    color: wordmark.o.corner,
    pupil: 'redonda',
    parpados: true,
    boca: 'M52 57 Q60 63 67 56',
    munones: [48, 52],
  },
  // Punta arriba, base ancha. Ojos enormes y sonrisa mínima. El de la referencia verde.
  triangulo: {
    body: 'M60,4 L104,76 L16,76 Z',
    color: wordmark.h.corner,
    pupil: 'redonda',
    parpados: false,
    boca: 'M55 58 Q60 64 65 58',
    munones: [66, 69],
  },
  // Bloque con pupilas CUADRADAS -- el detalle que separa al azul de los otros dos en la
  // referencia, y lo que le da su cara de robot.
  cuadrado: {
    body: 'M38,4 L82,4 Q100,4 100,22 L100,58 Q100,76 82,76 L38,76 Q20,76 20,58 L20,22 Q20,4 38,4 Z',
    color: wordmark.m.corner,
    pupil: 'cuadrada',
    parpados: false,
    boca: 'M53 56 Q60 66 67 56',
    munones: [45, 49],
  },
};

/**
 * La mascota de Showmi, dibujada en SVG por código -- no hay assets de arte en el repo, y
 * dibujarla así le da dos cosas que un PNG no tendría: escala sin pixelarse a cualquier
 * tamaño (anillo chico de Perfil vs. retrato grande del Camerino), y los cosméticos se
 * componen encima como capas reales en vez de necesitar una imagen pre-renderizada por
 * cada combinación.
 *
 * SIN CONTORNO, solo rellenos planos (2026-09-14, pedido del usuario): es lo que hacen los
 * diseños originales, y el contorno grueso que tenía antes era justo lo que la volvía
 * siniestra en tema oscuro, porque se invertía a blanco. Es además el
 * ÚNICO elemento de firma visual del producto; el resto de la UI se mantiene quieta a
 * propósito, así que aquí es donde se permite tener personalidad.
 *
 * 2026-09-08: proporciones más chibi (pedido explícito, junto con calmar `brand` y redondear
 * botones -- mismo giro hacia "más amigable"). Cabeza más grande (r 29->34) y más arriba,
 * cuerpo más corto y angosto (antes 60x42, ahora 48x26) -- la relación cabeza:cuerpo es lo que
 * lee como "chibi", no un ajuste cualquiera. El viewBox creció hacia arriba (antes "0 0 120
 * 120", ahora "0 -20 120 140") en vez de encoger la cabeza para que quepa en el cuadro viejo --
 * los sombreros necesitaban ese espacio extra para no recortarse contra el borde superior.
 * El ancho (0-120) no cambió, así que ningún cosmético necesitó reajuste en X, solo en Y.
 */
export function Mascot({ equipped, size = 160, shape = 'circulo' }: MascotProps) {
  // Tinta FIJA en los dos temas, no `colors.border`.
  //
  // Ese token se invierte (casi negro en claro, casi blanco en oscuro), y en modo oscuro
  // dejaba a la criatura perfilada y con las pupilas EN BLANCO: ojos y boca se volvian huecos
  // luminosos sobre el cuerpo de color. Parecia un fantasma, no una mascota.
  //
  // Las facciones de un personaje no son cromo de interfaz: los ojos de un dibujo son negros
  // porque son ojos, no porque el fondo sea claro. Van siempre sobre el cuerpo saturado, que
  // tampoco cambia con el tema, asi que no hay ningun problema de contraste que resolver.
  const ink = '#141414';
  const def = SHAPES[shape];
  const body = def.color;
  // Muñones más oscuros que el cuerpo, como en las tres referencias. Derivado, no declarado.
  const limb = mix(body, '#000000', 0.22);

  const sombrero = equipped.sombrero ? cosmeticById(equipped.sombrero) : undefined;
  const accesorio = equipped.accesorio ? cosmeticById(equipped.accesorio) : undefined;
  const estampado = equipped.estampado ? cosmeticById(equipped.estampado) : undefined;

  const [munIzq, munDer] = def.munones;

  return (
    <Svg width={size} height={size} viewBox="0 -20 120 140">
      <Defs>
        <ClipPath id="cuerpo">
          <Rect x={36} y={78} width={48} height={26} rx={13} />
        </ClipPath>
      </Defs>

      {/* Muñones: DETRÁS del cuerpo, asomando por los lados. Van a alturas distintas a
          propósito (ver munones en SHAPES) -- la asimetría es el recurso que hace que la
          criatura se lea como dibujada a mano y no como una composición de figuras. */}
      <Circle cx={17} cy={munIzq} r={13} fill={limb} />
      <Circle cx={103} cy={munDer} r={13} fill={limb} />

      {/* Tronco, asomando bajo la forma principal. Existe sobre todo como percha de los
          cosméticos de cuerpo y los estampados, que están anclados a y=78. */}
      <Rect x={41} y={64} width={38} height={40} rx={15} fill={mix(body, '#FFFFFF', 0.16)} />
      {estampado && <G clipPath="url(#cuerpo)">{renderEstampado(estampado.id, estampado.color)}</G>}

      {/* La forma. Es la criatura entera: una primitiva y nada más. */}
      <Path d={def.body} fill={body} />

      {/* Ojos enormes, y DESIGUALES a propósito: el derecho es un pelo más chico y va 1px más
          abajo. Perfectamente simétricos se veían corporativos; así se ven hechos a mano.
          
          El de cara dormida NO lleva un párpado dibujado encima -- se probó y los dos párpados
          juntos se leían como una monoceja que fusionaba los dos ojos en un bloque. En la
          referencia el sueño está en la FORMA del ojo: el blanco tiene el borde de arriba
          recto y solo la parte de abajo es redonda. */}
      {def.parpados ? (
        <G>
          <Path d="M35 36 A13 13 0 0 0 61 36 Z" fill="#FFFFFF" />
          <Path d="M60 37 A12.2 12.2 0 0 0 84.4 37 Z" fill="#FFFFFF" />
        </G>
      ) : (
        <G>
          <Circle cx={48} cy={40} r={13} fill="#FFFFFF" />
          <Circle cx={72} cy={41} r={12.2} fill="#FFFFFF" />
        </G>
      )}

      {def.pupil === 'cuadrada' ? (
        <G>
          <Rect x={44} y={36} width={10} height={10} rx={2} fill={ink} />
          <Rect x={68} y={37} width={9.4} height={9.4} rx={2} fill={ink} />
        </G>
      ) : (
        <G>
          <Circle cx={49} cy={def.parpados ? 43 : 41} r={5.6} fill={ink} />
          <Circle cx={73} cy={def.parpados ? 44 : 42} r={5.2} fill={ink} />
        </G>
      )}
      {/* Brillo: siempre arriba a la izquierda en los dos ojos. Es lo que los hace parecer
          mojados en vez de dos agujeros. */}
      {!def.parpados && (
        <G>
          <Circle cx={45.5} cy={37} r={2.1} fill="#FFFFFF" />
          <Circle cx={69.8} cy={38} r={1.9} fill="#FFFFFF" />
        </G>
      )}

      <Path d={def.boca} stroke={ink} strokeWidth={4} fill="none" strokeLinecap="round" />

      {accesorio && renderAccesorio(accesorio.id, accesorio.color, ink)}
      {sombrero && renderSombrero(sombrero.id, sombrero.color, ink)}
    </Svg>
  );
}

/** Todos los sombreros se dibujaron originalmente para una cabeza con borde superior en y=16
 *  (cy=45, r=29) -- el borde superior nuevo es y=4 (cy=38, r=34), un salto de -12 que ahora
 *  cabe gracias al viewBox extendido hacia arriba. Coordenadas ya trasladadas a mano, no un
 *  transform en tiempo de render -- más fácil de leer/ajustar shape por shape. */
function renderSombrero(id: string, color: string, outline: string): ReactNode {
  const sw = 2.5;
  switch (id) {
    case 'sombrero_charro':
      return (
        <G>
          <Ellipse cx={60} cy={10} rx={40} ry={9} fill={color} stroke={outline} strokeWidth={sw} />
          <Path d="M42 10 Q42 -10 60 -10 Q78 -10 78 10 Z" fill={color} stroke={outline} strokeWidth={sw} />
        </G>
      );
    case 'cresta':
      return (
        <G>
          <Polygon points="46,8 52,-12 58,8" fill={color} stroke={outline} strokeWidth={sw} />
          <Polygon points="56,6 62,-14 68,6" fill={color} stroke={outline} strokeWidth={sw} />
          <Polygon points="66,8 72,-10 78,8" fill={color} stroke={outline} strokeWidth={sw} />
        </G>
      );
    case 'gorra':
      return (
        <G>
          <Path d="M32 14 Q34 -8 60 -8 Q86 -8 88 14 Z" fill={color} stroke={outline} strokeWidth={sw} />
          <Path d="M86 14 Q104 12 106 20 L86 20 Z" fill={color} stroke={outline} strokeWidth={sw} />
        </G>
      );
    case 'audifonos':
      return (
        <G>
          <Path d="M31 30 Q31 -4 60 -4 Q89 -4 89 30" stroke={color} strokeWidth={7} fill="none" strokeLinecap="round" />
          <Rect x={22} y={24} width={16} height={22} rx={7} fill={color} stroke={outline} strokeWidth={sw} />
          <Rect x={82} y={24} width={16} height={22} rx={7} fill={color} stroke={outline} strokeWidth={sw} />
        </G>
      );
    case 'boina':
      return (
        <G>
          <Ellipse cx={58} cy={7} rx={30} ry={12} fill={color} stroke={outline} strokeWidth={sw} />
          <Circle cx={74} cy={-3} r={4} fill={color} stroke={outline} strokeWidth={sw} />
        </G>
      );
    case 'turbante':
      return (
        <G>
          <Path d="M31 20 Q34 -6 60 -6 Q86 -6 89 20 Z" fill={color} stroke={outline} strokeWidth={sw} />
          <Path d="M33 12 Q60 4 87 12" stroke={outline} strokeWidth={sw} fill="none" />
          <Path d="M34 4 Q60 -4 86 4" stroke={outline} strokeWidth={sw} fill="none" />
        </G>
      );
    case 'corona':
      return (
        <Polygon
          points="34,14 34,-8 46,3 60,-12 74,3 86,-8 86,14"
          fill={color}
          stroke={outline}
          strokeWidth={sw}
          strokeLinejoin="round"
        />
      );
    default:
      return null;
  }
}

/**
 * A diferencia de los sombreros, los accesorios NO comparten un solo ancla -- flor_oreja/
 * visor/lentes_dorados van sobre la cabeza (siguen a los ojos, que se movieron de cy=43 a
 * cy=37/38) mientras que pua/cadena/moño/bufanda van sobre el cuello/cuerpo (que se movió de
 * y=62 a y=78, +16). Cada shape lleva su propio ajuste, no un desplazamiento uniforme.
 */
function renderAccesorio(id: string, color: string, outline: string): ReactNode {
  const sw = 2.5;
  switch (id) {
    case 'flor_oreja': // anclado a cabeza -- junto al ojo derecho, sigue su nueva posición
      return (
        <G>
          {[0, 72, 144, 216, 288].map((deg) => {
            const rad = (deg * Math.PI) / 180;
            return <Circle key={deg} cx={92 + Math.cos(rad) * 6} cy={33 + Math.sin(rad) * 6} r={4.5} fill={color} stroke={outline} strokeWidth={1.5} />;
          })}
          <Circle cx={92} cy={33} r={3.5} fill="#FFFFFF" stroke={outline} strokeWidth={1.5} />
        </G>
      );
    case 'pua': // anclado a cuerpo -- collar sobre el cuello nuevo (body top=78)
      return (
        <G>
          <Path d="M40 84 Q60 94 80 84" stroke={outline} strokeWidth={2} fill="none" />
          <Path d="M55 90 L65 90 L60 100 Z" fill={color} stroke={outline} strokeWidth={sw} strokeLinejoin="round" />
        </G>
      );
    case 'cadena': // anclado a cuerpo
      return (
        <G>
          <Path d="M40 84 Q60 100 80 84" stroke={color} strokeWidth={5} fill="none" strokeLinecap="round" />
          <Circle cx={60} cy={97} r={5} fill={color} stroke={outline} strokeWidth={sw} />
        </G>
      );
    case 'visor': // anclado a cabeza -- banda sobre los ojos nuevos
      return (
        <G>
          <Rect x={31} y={32} width={58} height={16} rx={5} fill={color} stroke={outline} strokeWidth={sw} />
          <Path d="M37 40 L47 40 M55 40 L65 40 M73 40 L83 40" stroke="#FFFFFF" strokeWidth={2.5} strokeLinecap="round" />
        </G>
      );
    case 'moño': // anclado a cuerpo
      return (
        <G>
          <Polygon points="48,86 58,82 58,94 48,90" fill={color} stroke={outline} strokeWidth={sw} strokeLinejoin="round" />
          <Polygon points="72,86 62,82 62,94 72,90" fill={color} stroke={outline} strokeWidth={sw} strokeLinejoin="round" />
          <Circle cx={60} cy={88} r={3.5} fill={color} stroke={outline} strokeWidth={2} />
        </G>
      );
    case 'bufanda': // anclado a cuerpo -- la tira colgante se acortó (26->16) para no salirse
      // del cuerpo nuevo, más corto que el viejo.
      return (
        <G>
          <Rect x={38} y={80} width={44} height={11} rx={5} fill={color} stroke={outline} strokeWidth={sw} />
          <Rect x={70} y={88} width={11} height={16} rx={5} fill={color} stroke={outline} strokeWidth={sw} />
        </G>
      );
    case 'lentes_dorados': // anclado a cabeza -- centrado exacto sobre los ojos nuevos
      return (
        <G>
          <Circle cx={48} cy={40} r={13.5} fill={color} stroke={outline} strokeWidth={sw} opacity={0.9} />
          <Circle cx={72} cy={41} r={12.7} fill={color} stroke={outline} strokeWidth={sw} opacity={0.9} />
          <Path d="M60 40 L62 40 M34 37 L26 34 M86 38 L94 35" stroke={outline} strokeWidth={sw} />
        </G>
      );
    default:
      return null;
  }
}

/** Recalculado contra el cuerpo nuevo (x:36-84, y:78-104, antes x:30-90, y:62-104) -- el
 *  cuerpo es más chico, así que los patrones también se reacomodan más apretados, no es un
 *  simple desplazamiento de los valores viejos. */
function renderEstampado(id: string, color: string): ReactNode {
  switch (id) {
    case 'rayas':
      return (
        <G opacity={0.85}>
          {[40, 50, 60, 70, 80].map((x) => (
            <Rect key={x} x={x} y={78} width={4} height={26} fill={color} />
          ))}
        </G>
      );
    case 'lunares':
      return (
        <G opacity={0.85}>
          {[
            [42, 86], [56, 83], [70, 87], [80, 82],
            [46, 98], [62, 99], [76, 95],
          ].map(([cx, cy]) => (
            <Circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={3.4} fill={color} />
          ))}
        </G>
      );
    case 'estrellas':
      return (
        <G opacity={0.95}>
          {[
            [42, 88], [58, 83], [74, 89], [48, 99], [70, 99],
          ].map(([cx, cy]) => (
            <Polygon
              key={`${cx}-${cy}`}
              points={starPoints(cx, cy, 5, 2.2)}
              fill={color}
            />
          ))}
        </G>
      );
    default:
      return null;
  }
}

/** Estrella de 5 puntas centrada en (cx, cy), como lista de puntos para <Polygon>. */
function starPoints(cx: number, cy: number, outer: number, inner: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    pts.push(`${(cx + Math.cos(angle) * r).toFixed(2)},${(cy + Math.sin(angle) * r).toFixed(2)}`);
  }
  return pts.join(' ');
}
