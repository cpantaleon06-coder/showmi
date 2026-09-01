/**
 * 2026-09-01: la barra de pestañas pasó a ser una "isla flotante"
 * (position: absolute, separada de los 3 bordes -- ver app/(tabs)/_layout.tsx)
 * en vez de una barra fija que reserva su propio espacio en el layout.
 * Ganancia visual, pero efecto secundario real: cualquier contenido pegado
 * al fondo de una pantalla (botones fijos, el final de una lista) ahora
 * puede quedar tapado por la isla, porque position:absolute la saca del
 * flujo normal y las pantallas no se enteran de que existe.
 *
 * Este valor es el colchón que hay que sumarle al padding-bottom de
 * cualquier contenido pegado al fondo en las 3 pestañas (Swipe/Biblioteca/
 * Feed) para que quede visible arriba de la isla, no detrás.
 * bottom(16) + height(52) de la isla + margen de respiro -- bajado junto
 * con la isla cuando se hizo más delgada (antes 24+64).
 */
export const FLOATING_TAB_BAR_CLEARANCE = 90;
