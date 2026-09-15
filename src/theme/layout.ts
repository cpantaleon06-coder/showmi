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

/**
 * Estilo de la isla flotante, factorizado desde app/(tabs)/_layout.tsx (2026-09-06) para que
 * app/(tabs)/index.tsx pueda restaurarlo con `navigation.setOptions({ tabBarStyle })` después
 * de ocultarlo -- ver esa pantalla para el motivo (ocultar la barra durante onboarding). Sin
 * esta fuente compartida, "ocultar y restaurar" tendría que reconstruir el objeto a mano y
 * arriesgarse a que las dos copias se desincronicen si alguien cambia solo una.
 */
export function floatingTabBarStyle(surfaceColor: string) {
  return {
    position: 'absolute' as const,
    left: 24,
    right: 24,
    bottom: 16,
    height: 52,
    borderRadius: 22,
    backgroundColor: surfaceColor,
    borderTopWidth: 0,
    // boxShadow y no el cuarteto shadowColor/Offset/Opacity/Radius + elevation: RN 0.76+
    // los marca deprecados y con la nueva arquitectura (newArchEnabled, ver app.json)
    // boxShadow renderiza en iOS y Android igual que en web, así que es UNA declaración en
    // vez de cinco. `elevation` se quita, no se conserva: con boxShadow ya soportado en
    // Android, dejarlo pintaría una segunda sombra encima.
    boxShadow: '0px 6px 12px rgba(0, 0, 0, 0.15)',
  };
}
