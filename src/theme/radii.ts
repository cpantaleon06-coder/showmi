/**
 * Radios de borde del sistema.
 *
 * 2026-09-08: antes cada pantalla elegía el suyo a ojo y había siete valores
 * distintos conviviendo (5, 6, 8, 10, 12, 16, 18) sin que la diferencia
 * significara nada. `card` unifica en 14 todo lo que es una SUPERFICIE
 * contenedora -- tarjeta del deck, post del Feed, tarjeta patrocinada, tarjetas
 * del Camerino, el popup de calificar, la teja de Biblioteca.
 *
 * Lo que NO se unificó, y por qué:
 *  - Botones y chips se quedan en `pill` (18-20). Son redondos a propósito desde
 *    el pedido de "botones más redondos y amigables" (ver colors.ts); bajarlos a
 *    14 desharía ese trabajo y además borraría la jerarquía que hace que un botón
 *    se lea distinto de la tarjeta que lo contiene.
 *  - Las miniaturas (`thumb`, 6) se quedan chicas: un radio de 14 en una imagen de
 *    44px se come la esquina y la deja con forma de pastilla, no de foto.
 *  - ActionButtons sigue en 999 (círculo real) y NagaiHeader en 48 (su curva es
 *    parte del header, no un radio de tarjeta).
 */
export const radii = {
  /** Superficies contenedoras: tarjetas, paneles, tejas. */
  card: 14,
  /** Botones y chips -- ver nota de arriba sobre por qué no bajan a `card`. */
  pill: 20,
  /** Miniaturas e imágenes chicas dentro de una tarjeta. */
  thumb: 6,
} as const;
