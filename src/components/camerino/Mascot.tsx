import type { ReactNode } from 'react';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, Path, Polygon, Rect } from 'react-native-svg';

import { CosmeticSlot, cosmeticById } from '../../lib/cosmetics';
import { ThemeColors } from '../../theme/colors';

interface MascotProps {
  colors: ThemeColors;
  /** slot -> id de cosmético, ya filtrado por lo que la persona puede usar (ver visibleEquipped). */
  equipped: Partial<Record<CosmeticSlot, string>>;
  size?: number;
}

/**
 * La mascota de Showmi, dibujada en SVG por código -- no hay assets de arte en el repo, y
 * dibujarla así le da tres cosas que un PNG no tendría: escala sin pixelarse a cualquier
 * tamaño (header chico de Perfil vs. retrato grande del Camerino), reacciona al tema
 * claro/oscuro, y los cosméticos se componen encima como capas reales en vez de necesitar
 * una imagen pre-renderizada por combinación.
 *
 * El trazo grueso y los rellenos planos son deliberados: es la misma dirección constructivista
 * del resto de la app (ver colors.ts) -- líneas de cartel, no sombras suaves. Es además el
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
export function Mascot({ colors, equipped, size = 160 }: MascotProps) {
  // El contorno usa `border` (casi negro en claro, casi blanco en oscuro) para que la mascota
  // se lea con la misma fuerza de línea en los dos temas.
  const outline = colors.border;
  const body = colors.brand;
  const stroke = 3.5;

  const sombrero = equipped.sombrero ? cosmeticById(equipped.sombrero) : undefined;
  const accesorio = equipped.accesorio ? cosmeticById(equipped.accesorio) : undefined;
  const estampado = equipped.estampado ? cosmeticById(equipped.estampado) : undefined;

  return (
    <Svg width={size} height={size} viewBox="0 -20 120 140">
      <Defs>
        {/* El estampado se recorta al cuerpo para que nunca se salga del contorno. */}
        <ClipPath id="cuerpo">
          <Rect x={36} y={78} width={48} height={26} rx={13} />
        </ClipPath>
      </Defs>

      {/* Cuerpo -- más corto y angosto que la cabeza a propósito, es lo que da la proporción
          chibi (rx=13 sobre 26 de alto = casi una píldora completa, más redondo que antes). */}
      <Rect x={36} y={78} width={48} height={26} rx={13} fill={body} stroke={outline} strokeWidth={stroke} />
      {estampado && <G clipPath="url(#cuerpo)">{renderEstampado(estampado.id, estampado.color)}</G>}

      {/* Pies */}
      <Ellipse cx={46} cy={106} rx={8} ry={5} fill={outline} />
      <Ellipse cx={74} cy={106} rx={8} ry={5} fill={outline} />

      {/* Cabeza -- más grande que el cuerpo (r=34 vs. cuerpo de 26 de alto), es la pieza
          central de la proporción chibi. */}
      <Circle cx={60} cy={38} r={34} fill={body} stroke={outline} strokeWidth={stroke} />

      {/* Ojos: más grandes y más juntos que antes (r=8.5, antes 7) -- ojos grandes es el otro
          medio de "chibi", no solo la cabeza. Blanco fijo + pupila del color de contorno --
          no usan tokens de texto porque van sobre el color de marca, que no cambia entre temas. */}
      <Circle cx={48} cy={37} r={8.5} fill="#FFFFFF" stroke={outline} strokeWidth={2} />
      <Circle cx={72} cy={37} r={8.5} fill="#FFFFFF" stroke={outline} strokeWidth={2} />
      <Circle cx={49.5} cy={38} r={3.8} fill={outline} />
      <Circle cx={73.5} cy={38} r={3.8} fill={outline} />

      {/* Boca */}
      <Path d="M53 51 Q60 57 67 51" stroke={outline} strokeWidth={stroke} fill="none" strokeLinecap="round" />

      {accesorio && renderAccesorio(accesorio.id, accesorio.color, outline)}
      {sombrero && renderSombrero(sombrero.id, sombrero.color, outline)}
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
            return <Circle key={deg} cx={92 + Math.cos(rad) * 6} cy={30 + Math.sin(rad) * 6} r={4.5} fill={color} stroke={outline} strokeWidth={1.5} />;
          })}
          <Circle cx={92} cy={30} r={3.5} fill="#FFFFFF" stroke={outline} strokeWidth={1.5} />
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
          <Rect x={33} y={30} width={54} height={14} rx={5} fill={color} stroke={outline} strokeWidth={sw} />
          <Path d="M38 37 L48 37 M54 37 L64 37 M70 37 L80 37" stroke="#FFFFFF" strokeWidth={2.5} strokeLinecap="round" />
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
          <Circle cx={48} cy={37} r={10} fill={color} stroke={outline} strokeWidth={sw} opacity={0.9} />
          <Circle cx={72} cy={37} r={10} fill={color} stroke={outline} strokeWidth={sw} opacity={0.9} />
          <Path d="M58 37 L62 37 M38 35 L30 33 M82 35 L90 33" stroke={outline} strokeWidth={sw} />
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
