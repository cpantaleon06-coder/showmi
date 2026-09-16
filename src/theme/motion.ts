import { Easing, withSpring, withTiming } from 'react-native-reanimated';

/**
 * Vocabulario de movimiento de Showmi (2026-09-16).
 *
 * POR QUÉ EXISTE: hasta hoy cada componente inventaba su propia curva. Auditado, había cinco
 * configuraciones de spring distintas (damping 14/15/18, stiffness 120/180/320, una con mass y
 * las demás no) y duraciones de 90, 260, 320 y 2600 ms repartidas sin criterio. Ninguna estaba
 * "mal" por separado; el problema es que juntas no se leen como UNA app -- un chip rebotaba
 * distinto que la barra, que a su vez entraba distinto que una teja.
 *
 * Nada de esto es por rendimiento: TODAS las animaciones del proyecto animan solo `opacity` y
 * `transform` (verificado archivo por archivo), que es lo que corresponde. Nada anima ancho,
 * alto ni márgenes, así que no hay reflow que quitar. Lo que faltaba era coherencia.
 *
 * REGLAS
 * 1. Lo que ENTRA desacelera (`curva.entrada`): llega y se acomoda, no se estrella.
 * 2. Lo que SALE acelera (`curva.salida`): irse rápido no se nota; irse lento estorba.
 * 3. La UI funcional NO rebota. Un chip que rebota al seleccionarlo se siente barato y, peor,
 *    tarda más en quedarse quieto de lo que tarda el ojo en querer leerlo.
 * 4. El rebote se reserva para momentos de gracia contados (`resortes.gracia`).
 */

/** Springs. `mass` explícito en los tres: sin él, Reanimated usa 1 y los tres se sentirían
 *  más pesados de lo que sugiere su stiffness. */
export const resortes = {
  /** UI funcional: selección, pestañas, filtros. Responde y para en seco, sin pasarse. */
  ui: { damping: 20, stiffness: 220, mass: 0.7 },
  /** Entradas y asentamientos. Más suave y con más recorrido; se usa cuando algo APARECE. */
  suave: { damping: 18, stiffness: 140, mass: 0.9 },
  /** Un rebote mínimo, para momentos de gracia. Usar poco: si todo rebota, nada destaca. */
  gracia: { damping: 12, stiffness: 180, mass: 0.8 },
} as const;

/** Duraciones en ms. Tres, a propósito: con más, la escala deja de ser una escala. */
export const duracion = {
  /** Acuses de recibo: un toque, un resalte. Por debajo de 120 se percibe como un salto. */
  rapida: 160,
  /** El caso normal: entradas, cambios de estado, transiciones de pantalla. */
  base: 240,
  /** Recorridos largos o piezas grandes. Más allá de ~400 se siente lento, no elegante. */
  lenta: 360,
} as const;

export const curva = {
  entrada: Easing.out(Easing.cubic),
  salida: Easing.in(Easing.cubic),
  /** Para algo que se mueve de un punto a otro estando ya visible. */
  mover: Easing.inOut(Easing.cubic),
} as const;

/**
 * "Sin animación" para los casos SIN callback.
 *
 * Por el proyecto había `withTiming(x, { duration: 1 })` repetido como forma de saltarse la
 * animación con reduced-motion, y para un cambio puramente visual `duration: 0` es más directo.
 *
 * PERO el 1ms no siempre es un parche: en SwipeCard está puesto a propósito y documentado ahí
 * -- esas animaciones llevan un callback que COMPLETA el swipe, y el 1ms garantiza que dispare.
 * Esos sitios no se migran a este helper. Si alguna vez se tocan, leer primero ese comentario.
 */
const INSTANTANEO = { duration: 0 } as const;

/**
 * Anima con resorte, respetando "reducir movimiento".
 *
 * Centralizar el ternario evita que cada componente se acuerde (o se olvide) de respetarlo:
 * hoy esa decisión estaba copiada a mano en ocho archivos.
 */
export function conResorte(
  destino: number,
  reducedMotion: boolean,
  preset: { damping: number; stiffness: number; mass: number } = resortes.ui,
) {
  'worklet';
  return reducedMotion ? withTiming(destino, INSTANTANEO) : withSpring(destino, preset);
}

/** Anima con duración y curva, respetando "reducir movimiento". */
export function conTiempo(
  destino: number,
  reducedMotion: boolean,
  ms: number = duracion.base,
  easing: (t: number) => number = curva.entrada,
) {
  'worklet';
  return reducedMotion ? withTiming(destino, INSTANTANEO) : withTiming(destino, { duration: ms, easing });
}

/**
 * Retraso del escalonado por posición, acotado.
 *
 * Un escalonado sin tope es la forma clásica de que una lista larga se sienta rota: el
 * elemento 30 entraría casi un segundo después del primero. Se corta a los 6 primeros; de ahí
 * en adelante todos entran juntos y nadie lo nota, porque ya están fuera de la primera pantalla.
 */
export function retraso(indice: number, paso = 45, maximo = 6): number {
  return Math.min(indice, maximo) * paso;
}
