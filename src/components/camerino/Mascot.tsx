import type { ReactNode } from 'react';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, LinearGradient, Path, Polygon, Rect, Stop } from 'react-native-svg';

import { CosmeticSlot, cosmeticById } from '../../lib/cosmetics';

/** Las tres criaturas. Cada una es una forma primitiva distinta -- esa restricción ES el
 *  sistema, no una limitación. */
export type MascotShape = 'circulo' | 'triangulo' | 'rombo' | 'estrella';

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
const SHAPES: Record<
  MascotShape,
  {
    body: string;
    /** Color del cuerpo. Tomado de la referencia, no derivado del tema. */
    color: string;
    /** Segunda parada del degradado del cuerpo. */
    colorHondo: string;
    /** Tronco que asoma bajo la forma. */
    torso: string;
    /** Muñones. En la referencia son MÁS CLAROS que el cuerpo, no más oscuros. */
    manos: string;
    /** Círculo añil + contorno violeta detrás. Solo el rombo los lleva en la referencia. */
    adorno?: boolean;
    pupil: 'redonda' | 'rombo';
    parpados: boolean;
    lentes: boolean;
    boca: string;
    munones: [number, number];
  }
> = {
  // Cabezón de párpados caídos. El naranja de la referencia.
  circulo: {
    body: 'M60,4 C79.9,4 96,20.1 96,40 C96,59.9 79.9,76 60,76 C40.1,76 24,59.9 24,40 C24,20.1 40.1,4 60,4 Z',
    color: '#FF914D',
    colorHondo: '#FF914D', // plano, como en la referencia
    torso: '#FF9F63',
    manos: '#FFBD59',
    pupil: 'redonda',
    parpados: true,
    lentes: false,
    boca: 'M52 57 Q60 63 67 56',
    munones: [48, 52],
  },
  // Punta arriba y base ANCHA. La base se abrió de 16..104 a 8..112 (2026-09-16) porque los
  // ojos crecieron: a la altura de los ojos el triángulo es lo más estrecho de las cuatro
  // formas, y con la base vieja los ojos nuevos se le salían por los lados.
  triangulo: {
    body: 'M60,4 L112,76 L8,76 Z',
    color: '#7ED957',
    colorHondo: '#7ED957', // plano
    torso: '#87C26D',
    manos: '#9BE07A',
    pupil: 'redonda',
    parpados: false,
    lentes: false,
    boca: 'M55 58 Q60 64 65 58',
    munones: [66, 69],
  },
  // Rombo (antes un bloque redondeado). Se escribe como rombo directo y NO como un cuadrado
  // rotado: rotando, los ojos y los cosméticos rotarían con él, y en la referencia la cara va
  // perfectamente horizontal sobre el cuerpo inclinado. Además así el rombo es ANCHÍSIMO justo
  // a la altura de los ojos (20..100), que es donde más falta hace.
  rombo: {
    body: 'M60,4 Q64,4 66,7 L97,36 Q100,40 97,44 L66,73 Q60,78 54,73 L23,44 Q20,40 23,36 L54,7 Q56,4 60,4 Z',
    color: '#004AAD',
    colorHondo: '#004AAD', // plano
    torso: '#1B62C4',
    manos: '#2E7BD8',
    adorno: true,
    pupil: 'rombo',
    parpados: false,
    lentes: false,
    boca: 'M53 56 Q60 66 67 56',
    munones: [45, 49],
  },
  // Estrella con lentes de sol. Los lentes se salen del cuerpo a propósito -- en la referencia
  // también sobresalen, y es lo que hace que se lean como puestos y no como pintados encima.
  estrella: {
    body: 'M60.0,4.0 L69.1,27.5 L94.2,28.9 L74.7,44.8 L81.2,69.1 L60.0,55.5 L38.8,69.1 L45.3,44.8 L25.8,28.9 L50.9,27.5 Z',
    color: '#FCEE21',
    colorHondo: '#FFC933',
    torso: '#FFD34D',
    manos: '#FFBD59',
    pupil: 'redonda',
    parpados: false,
    lentes: true,
    boca: 'M54 57 Q60 62 66 57',
    munones: [58, 61],
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
  // Fallback: un `shape` viejo guardado en el store persistido o en la tabla `mascots`
  // (por ejemplo el `cuadrado` que existió hasta el rediseño) apuntaría a undefined y tiraría
  // la pantalla entera. Cae al círculo, que es el valor por defecto de siempre.
  const def = SHAPES[shape] ?? SHAPES.circulo;
  const body = def.color;

  const sombrero = equipped.sombrero ? cosmeticById(equipped.sombrero) : undefined;
  const accesorio = equipped.accesorio ? cosmeticById(equipped.accesorio) : undefined;
  const estampado = equipped.estampado ? cosmeticById(equipped.estampado) : undefined;

  const [munIzq, munDer] = def.munones;
  /** Accesorios que se montan sobre los ojos y por tanto chocan con `def.lentes`. */
  const tapaLosOjos = accesorio?.id === 'lentes_dorados' || accesorio?.id === 'visor';

  // Los <Defs> de un SVG viven en el espacio de ids del DOCUMENTO, no del componente. Con
  // varias criaturas en pantalla (el Camerino muestra cinco a la vez) todas apuntaban al mismo
  // gradiente y heredaban el color de la primera en renderizarse. El sufijo por forma las
  // separa; no hace falta un id aleatorio porque dos criaturas de la MISMA forma comparten
  // color, así que compartir gradiente es correcto.
  const gradId = `cuerpoGrad-${shape}`;
  const clipId = `cuerpo-${shape}`;

  return (
    <Svg width={size} height={size} viewBox="0 -20 120 140">
      <Defs>
        <ClipPath id={clipId}>
          <Rect x={36} y={78} width={48} height={26} rx={13} />
        </ClipPath>
        {/* Degradado del cuerpo. Las dos paradas se DECLARAN por criatura y no se derivan
            del color con mix(): en la referencia el naranja, el verde y el azul son planos
            (mismo hex de punta a punta) y solo la estrella va de amarillo a ámbar. Derivarlas
            metía un degradado en las tres que no lo llevan. Cada criatura pone su
            `colorHondo` igual a su `color` cuando debe verse plana. */}
        <LinearGradient id={gradId} x1="0" y1="0" x2="0.85" y2="1">
          <Stop offset="0" stopColor={body} />
          <Stop offset="1" stopColor={def.colorHondo} />
        </LinearGradient>
      </Defs>

      {/* Muñones: DETRÁS del cuerpo, asomando por los lados. Van a alturas distintas a
          propósito (ver munones en SHAPES) -- la asimetría es el recurso que hace que la
          criatura se lea como dibujada a mano y no como una composición de figuras. */}
      <Circle cx={17} cy={munIzq} r={13} fill={def.manos} />
      <Circle cx={103} cy={munDer} r={13} fill={def.manos} />

      {/* Tronco, asomando bajo la forma principal. Existe sobre todo como percha de los
          cosméticos de cuerpo y los estampados, que están anclados a y=78. */}
      <Rect x={41} y={64} width={38} height={40} rx={15} fill={def.torso} />
      {estampado && <G clipPath={`url(#${clipId})`}>{renderEstampado(estampado.id, estampado.color)}</G>}

      {/* La forma. Es la criatura entera: una primitiva y nada más. */}
      {/* Dos piezas que en la referencia son parte del rombo y de nadie más: un círculo
          añil asomando por detrás de la punta superior derecha, y un contorno violeta
          LIGERAMENTE desplazado del cuerpo. El desplazamiento es lo que los hace ver como
          dos capas de una calcomanía y no como un borde: alineados se leerían como un
          simple stroke. Van antes del cuerpo para quedar detrás. */}
      {def.adorno && (
        <G>
          <Circle cx={96} cy={6} r={13} fill="#1800AD" />
          <Path d={def.body} fill="none" stroke="#8B3DFF" strokeWidth={2.5} transform="translate(3,-3)" />
        </G>
      )}
      <Path d={def.body} fill={`url(#${gradId})`} />

      {/* Los lentes cosidos a la estrella se quitan si el jugador se pone un cosmético que
          ocupa los mismos ojos: encimados, se ven dos pares de anteojos sobre una cara. Manda
          lo que el jugador eligió -- unos lentes que no se ven al ponértelos son un cosmético
          roto, y la estrella sigue siendo reconocible por su silueta. */}
      {/* Ojos enormes, y DESIGUALES a propósito: el derecho es un pelo más chico y va 1px más
          abajo. Perfectamente simétricos se veían corporativos; así se ven hechos a mano.
          
          El de cara dormida NO lleva un párpado dibujado encima -- se probó y los dos párpados
          juntos se leían como una monoceja que fusionaba los dos ojos en un bloque. En la
          referencia el sueño está en la FORMA del ojo: el blanco tiene el borde de arriba
          recto y solo la parte de abajo es redonda. */}
      {def.parpados ? (
        <G>
          <Path d="M34 36 A14 14 0 0 0 62 36 Z" fill="#FFFFFF" />
          <Path d="M58.8 37 A13.2 13.2 0 0 0 85.2 37 Z" fill="#FFFFFF" />
        </G>
      ) : (
        <G>
          <Circle cx={48} cy={40} r={14} fill="#FFFFFF" />
          <Circle cx={72} cy={41} r={13.2} fill="#FFFFFF" />
        </G>
      )}

      {def.pupil === 'rombo' ? (
        // Pupilas en rombo, no cuadradas: repiten la forma del cuerpo dentro del ojo, que es
        // lo que en la referencia hace que el azul se lea como un personaje coherente y no
        // como un cuadrado con ojos genéricos.
        <G>
          <Rect x={44} y={36} width={10} height={10} rx={1.5} fill={ink} transform="rotate(45 49 41)" />
          <Rect x={68.3} y={37.3} width={9.4} height={9.4} rx={1.5} fill={ink} transform="rotate(45 73 42)" />
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

      {/* Lentes de sol, cosidos a la estrella (no son un cosmético del Camerino): son parte de
          QUIÉN es, igual que los párpados caídos son parte del naranja. Sobresalen del cuerpo a
          propósito -- en la referencia también, y es lo que los hace ver puestos. */}
      {def.lentes && !tapaLosOjos && (
        // Dimensionados contra los OJOS (cx 48 y 72), no contra el ancho del cuerpo. La
        // primera versión los midió contra el cuerpo: 64 de ancho por 20 de alto, una mancha
        // negra que se comía la estrella entera y dejaba la silueta ilegible.
        <G>
          <Path d="M36 35 L84 35 L84 38 L63 38 L60 41 L57 38 L36 38 Z" fill={ink} />
          <Path d="M37 37 Q37 49 48 49 Q59 49 59 37 Z" fill={ink} />
          <Path d="M61 37 Q61 49 72 49 Q83 49 83 37 Z" fill={ink} />
          {/* Destello: sin él, dos manchas negras se leen como agujeros y no como cristal. */}
          <Path d="M40 39 L45 39 L42 46 L39 46 Z" fill="#FFFFFF" opacity={0.3} />
          <Path d="M64 39 L69 39 L66 46 L63 46 Z" fill="#FFFFFF" opacity={0.3} />
        </G>
      )}

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
