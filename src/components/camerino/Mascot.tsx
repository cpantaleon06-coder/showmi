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
    <Svg width={size} height={size} viewBox="0 0 120 120">
      <Defs>
        {/* El estampado se recorta al cuerpo para que nunca se salga del contorno. */}
        <ClipPath id="cuerpo">
          <Rect x={30} y={62} width={60} height={42} rx={14} />
        </ClipPath>
      </Defs>

      {/* Cuerpo */}
      <Rect x={30} y={62} width={60} height={42} rx={14} fill={body} stroke={outline} strokeWidth={stroke} />
      {estampado && <G clipPath="url(#cuerpo)">{renderEstampado(estampado.id, estampado.color)}</G>}

      {/* Pies */}
      <Ellipse cx={44} cy={106} rx={9} ry={5} fill={outline} />
      <Ellipse cx={76} cy={106} rx={9} ry={5} fill={outline} />

      {/* Cabeza */}
      <Circle cx={60} cy={45} r={29} fill={body} stroke={outline} strokeWidth={stroke} />

      {/* Ojos: blanco fijo + pupila del color de contorno -- no usan tokens de texto porque
          van sobre el color de marca, que no cambia entre temas. */}
      <Circle cx={50} cy={43} r={7} fill="#FFFFFF" stroke={outline} strokeWidth={2} />
      <Circle cx={70} cy={43} r={7} fill="#FFFFFF" stroke={outline} strokeWidth={2} />
      <Circle cx={51} cy={44} r={3} fill={outline} />
      <Circle cx={71} cy={44} r={3} fill={outline} />

      {/* Boca */}
      <Path d="M52 57 Q60 64 68 57" stroke={outline} strokeWidth={stroke} fill="none" strokeLinecap="round" />

      {accesorio && renderAccesorio(accesorio.id, accesorio.color, outline)}
      {sombrero && renderSombrero(sombrero.id, sombrero.color, outline)}
    </Svg>
  );
}

function renderSombrero(id: string, color: string, outline: string): ReactNode {
  const sw = 2.5;
  switch (id) {
    case 'sombrero_charro':
      return (
        <G>
          <Ellipse cx={60} cy={22} rx={40} ry={9} fill={color} stroke={outline} strokeWidth={sw} />
          <Path d="M42 22 Q42 2 60 2 Q78 2 78 22 Z" fill={color} stroke={outline} strokeWidth={sw} />
        </G>
      );
    case 'cresta':
      return (
        <G>
          <Polygon points="46,20 52,0 58,20" fill={color} stroke={outline} strokeWidth={sw} />
          <Polygon points="56,18 62,-2 68,18" fill={color} stroke={outline} strokeWidth={sw} />
          <Polygon points="66,20 72,2 78,20" fill={color} stroke={outline} strokeWidth={sw} />
        </G>
      );
    case 'gorra':
      return (
        <G>
          <Path d="M32 26 Q34 4 60 4 Q86 4 88 26 Z" fill={color} stroke={outline} strokeWidth={sw} />
          <Path d="M86 26 Q104 24 106 32 L86 32 Z" fill={color} stroke={outline} strokeWidth={sw} />
        </G>
      );
    case 'audifonos':
      return (
        <G>
          <Path d="M31 42 Q31 8 60 8 Q89 8 89 42" stroke={color} strokeWidth={7} fill="none" strokeLinecap="round" />
          <Rect x={22} y={36} width={16} height={22} rx={7} fill={color} stroke={outline} strokeWidth={sw} />
          <Rect x={82} y={36} width={16} height={22} rx={7} fill={color} stroke={outline} strokeWidth={sw} />
        </G>
      );
    case 'boina':
      return (
        <G>
          <Ellipse cx={58} cy={19} rx={30} ry={12} fill={color} stroke={outline} strokeWidth={sw} />
          <Circle cx={74} cy={9} r={4} fill={color} stroke={outline} strokeWidth={sw} />
        </G>
      );
    case 'turbante':
      return (
        <G>
          <Path d="M31 32 Q34 6 60 6 Q86 6 89 32 Z" fill={color} stroke={outline} strokeWidth={sw} />
          <Path d="M33 24 Q60 16 87 24" stroke={outline} strokeWidth={sw} fill="none" />
          <Path d="M34 16 Q60 8 86 16" stroke={outline} strokeWidth={sw} fill="none" />
        </G>
      );
    case 'corona':
      return (
        <Polygon
          points="34,26 34,4 46,15 60,0 74,15 86,4 86,26"
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

function renderAccesorio(id: string, color: string, outline: string): ReactNode {
  const sw = 2.5;
  switch (id) {
    case 'flor_oreja':
      return (
        <G>
          {[0, 72, 144, 216, 288].map((deg) => {
            const rad = (deg * Math.PI) / 180;
            return <Circle key={deg} cx={90 + Math.cos(rad) * 7} cy={34 + Math.sin(rad) * 7} r={5} fill={color} stroke={outline} strokeWidth={1.5} />;
          })}
          <Circle cx={90} cy={34} r={4} fill="#FFFFFF" stroke={outline} strokeWidth={1.5} />
        </G>
      );
    case 'pua':
      return (
        <G>
          <Path d="M40 68 Q60 78 80 68" stroke={outline} strokeWidth={2} fill="none" />
          <Path d="M55 74 L65 74 L60 86 Z" fill={color} stroke={outline} strokeWidth={sw} strokeLinejoin="round" />
        </G>
      );
    case 'cadena':
      return (
        <G>
          <Path d="M40 68 Q60 84 80 68" stroke={color} strokeWidth={5} fill="none" strokeLinecap="round" />
          <Circle cx={60} cy={81} r={5} fill={color} stroke={outline} strokeWidth={sw} />
        </G>
      );
    case 'visor':
      return (
        <G>
          <Rect x={33} y={36} width={54} height={14} rx={5} fill={color} stroke={outline} strokeWidth={sw} />
          <Path d="M38 43 L48 43 M54 43 L64 43 M70 43 L80 43" stroke="#FFFFFF" strokeWidth={2.5} strokeLinecap="round" />
        </G>
      );
    case 'moño':
      return (
        <G>
          <Polygon points="48,70 58,66 58,78 48,74" fill={color} stroke={outline} strokeWidth={sw} strokeLinejoin="round" />
          <Polygon points="72,70 62,66 62,78 72,74" fill={color} stroke={outline} strokeWidth={sw} strokeLinejoin="round" />
          <Circle cx={60} cy={72} r={3.5} fill={color} stroke={outline} strokeWidth={2} />
        </G>
      );
    case 'bufanda':
      return (
        <G>
          <Rect x={36} y={64} width={48} height={11} rx={5} fill={color} stroke={outline} strokeWidth={sw} />
          <Rect x={72} y={72} width={11} height={26} rx={5} fill={color} stroke={outline} strokeWidth={sw} />
        </G>
      );
    case 'lentes_dorados':
      return (
        <G>
          <Circle cx={50} cy={43} r={10} fill={color} stroke={outline} strokeWidth={sw} opacity={0.9} />
          <Circle cx={70} cy={43} r={10} fill={color} stroke={outline} strokeWidth={sw} opacity={0.9} />
          <Path d="M60 43 L60 43 M40 41 L32 39 M80 41 L88 39" stroke={outline} strokeWidth={sw} />
          <Path d="M60 43 L60 43" stroke={outline} strokeWidth={sw} />
          <Path d="M58 43 L62 43" stroke={outline} strokeWidth={sw} />
        </G>
      );
    default:
      return null;
  }
}

function renderEstampado(id: string, color: string): ReactNode {
  switch (id) {
    case 'rayas':
      return (
        <G opacity={0.85}>
          {[36, 48, 60, 72, 84].map((x) => (
            <Rect key={x} x={x} y={62} width={5} height={42} fill={color} />
          ))}
        </G>
      );
    case 'lunares':
      return (
        <G opacity={0.85}>
          {[
            [40, 72], [56, 70], [72, 74], [84, 68],
            [46, 88], [62, 90], [78, 86],
          ].map(([cx, cy]) => (
            <Circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={4} fill={color} />
          ))}
        </G>
      );
    case 'estrellas':
      return (
        <G opacity={0.95}>
          {[
            [44, 74], [64, 70], [80, 80], [52, 92], [74, 94],
          ].map(([cx, cy]) => (
            <Polygon
              key={`${cx}-${cy}`}
              points={starPoints(cx, cy, 6, 2.6)}
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
