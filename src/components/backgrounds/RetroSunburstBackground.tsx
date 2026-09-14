import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { wordmark } from '../../theme/wordmark';

interface RetroSunburstBackgroundProps {
  width: number;
  height: number;
}

/**
 * Fondo del paywall: sol naciente de rayos + surcos de vinilo + rejilla de horizonte
 * (2026-09-13).
 *
 * Tres citas retrofuturistas apiladas, todas de la misma familia visual y todas con un motivo
 * musical detrás -- no es decoración genérica:
 *
 *   - RAYOS: el estallido de cartel de concierto. Salen de un punto ALTO y fuera del encuadre,
 *     no del centro, para que abran hacia abajo y dejen limpio el centro de la pantalla, que
 *     es donde vive el precio.
 *   - SURCOS: círculos concéntricos = un vinilo visto de frente, centrado en el mismo punto
 *     que los rayos. Es lo que ata el motivo a la música en vez de quedarse en "años 80".
 *   - HORIZONTE: la rejilla en perspectiva del synthwave, abajo del todo, donde el degradado
 *     ya es más claro y una línea fina se lee sin competir con el CTA.
 *
 * Paleta: magenta y azul del wordmark (ver theme/wordmark.ts), no colores nuevos. El dorado
 * NO se usa acá a propósito -- es el color reservado de Showmi More y se guarda entero para el
 * botón de compra; si los rayos también fueran dorados, el CTA dejaría de ser lo único
 * dorado de la pantalla.
 *
 * CALIBRADO MIRANDO EL RESULTADO, no a ojo: la primera version tenia los rayos al 55% y se
 * comian el wordmark, y el horizonte a 0.74 de la altura le cruzaba una linea por encima al
 * texto de los beneficios. Ahora los rayos se apagan antes de la mitad (donde empieza la
 * tarjeta de planes) y el horizonte vive a 0.88, debajo de todo el contenido.
 *
 * SIEMPRE oscuro, en los dos temas. El paywall es un modal a pantalla completa y una pieza de
 * conversión: se comporta como un cartel, no como una pantalla más de la app. Mismo criterio
 * que ya se tomó con las tejas negras de Biblioteca (ver collectionColors.ts).
 */

/** Cuántos rayos. 24 da un estallido denso sin que las cuñas se cierren en un disco sólido. */
const RAY_COUNT = 24;
/** Surcos del vinilo. Radios crecientes en progresión geométrica: cerca del centro se juntan
 *  y hacia afuera se separan, que es como se ven en un disco real. */
const GROOVE_COUNT = 7;
/** Líneas de fuga del horizonte. */
const HORIZON_LINES = 11;

export function RetroSunburstBackground({ width, height }: RetroSunburstBackgroundProps) {
  // Origen del estallido: arriba y ligeramente fuera del encuadre. Ponerlo dentro dejaba un
  // punto de convergencia visible que competía con el wordmark.
  const cx = width / 2;
  const cy = -height * 0.06;
  const reach = Math.hypot(width, height) * 1.15;

  const rays = Array.from({ length: RAY_COUNT }, (_, i) => {
    // Solo el hemisferio inferior (0 a 180 grados): los rayos hacia arriba se perderían fuera
    // del encuadre y solo gastarían nodos.
    const step = Math.PI / RAY_COUNT;
    const a0 = i * step;
    // Cuñas de ancho alterno: dos anchos crean el ritmo de cartel. Con uno solo el estallido
    // se lee como un patrón de imprenta, no como luz.
    const w = (i % 2 === 0 ? 0.42 : 0.2) * step;
    const p1 = { x: cx + Math.cos(a0 - w) * reach, y: cy + Math.sin(a0 - w) * reach };
    const p2 = { x: cx + Math.cos(a0 + w) * reach, y: cy + Math.sin(a0 + w) * reach };
    return { d: `M${cx},${cy} L${p1.x},${p1.y} L${p2.x},${p2.y} Z`, strong: i % 2 === 0 };
  });

  const grooves = Array.from({ length: GROOVE_COUNT }, (_, i) => width * 0.18 * Math.pow(1.32, i));

  const horizonY = height * 0.88;

  return (
    <Svg width={width} height={height}>
      <Defs>
        {/* Del casi-negro de arriba al azul profundo del wordmark abajo. El degradado es
            ESTRUCTURAL acá (define el horizonte y de dónde viene la luz), no un adorno sobre
            un fondo plano -- por eso convive con la regla de "sin degradados decorativos". */}
        <LinearGradient id="canvas" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#0A0A12" />
          <Stop offset="0.55" stopColor="#1A0E3D" />
          <Stop offset="1" stopColor={wordmark.m.fill} />
        </LinearGradient>
        {/* Los rayos se desvanecen antes de llegar abajo: si llegaran enteros, competirían con
            la tarjeta de planes justo donde hay que leer precios. */}
        <LinearGradient id="rayFade" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={wordmark.w.fill} stopOpacity="0.30" />
          <Stop offset="0.28" stopColor={wordmark.w.corner} stopOpacity="0.10" />
          <Stop offset="0.5" stopColor={wordmark.w.corner} stopOpacity="0" />
        </LinearGradient>
        <LinearGradient id="grooveFade" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.30" />
          <Stop offset="0.6" stopColor="#FFFFFF" stopOpacity="0.06" />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </LinearGradient>
      </Defs>

      <Rect x={0} y={0} width={width} height={height} fill="url(#canvas)" />

      <G>
        {rays.map((r, i) => (
          <Path key={`ray-${i}`} d={r.d} fill="url(#rayFade)" opacity={r.strong ? 1 : 0.5} />
        ))}
      </G>

      {grooves.map((r, i) => (
        <Circle
          key={`groove-${i}`}
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="url(#grooveFade)"
          strokeWidth={i === GROOVE_COUNT - 1 ? 2 : 1}
        />
      ))}

      {/* Horizonte: una línea y sus fugas. Las verticales convergen en el mismo punto que los
          rayos, así que las dos mitades de la composición comparten perspectiva. */}
      <Path
        d={`M0,${horizonY} L${width},${horizonY}`}
        stroke={wordmark.h.corner}
        strokeWidth={1.5}
        opacity={0.35}
      />
      {Array.from({ length: HORIZON_LINES }, (_, i) => {
        const t = (i / (HORIZON_LINES - 1) - 0.5) * 2;
        const xBottom = cx + t * width * 1.9;
        return (
          <Path
            key={`v-${i}`}
            d={`M${cx + t * width * 0.1},${horizonY} L${xBottom},${height}`}
            stroke={wordmark.h.corner}
            strokeWidth={1}
            opacity={0.14}
          />
        );
      })}
    </Svg>
  );
}
