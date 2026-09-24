import { isRevenueCatConfigured } from './revenuecat';

/**
 * Modo demo para la entrega del Shipaton (2026-09-24).
 *
 * POR QUE EXISTE: el concurso es de RevenueCat, asi que la experiencia de pago es justo lo que
 * hay que poder ENSEÑAR -- el paywall, la compra, el tier activandose, las ventajas
 * desbloqueandose. Pero las compras reales estan bloqueadas detras de Google Play (cuenta, ficha,
 * productos, clave `goog_`), y ese camino no depende del codigo sino de tramites que tardan
 * dias. Sin esto, no habria nada que grabar para el video.
 *
 * QUE HACE: deja activar "Showmi More" desde el paywall sin cobrar nada, para poder recorrer y
 * grabar el flujo completo.
 *
 * QUE **NO** HACE, y es lo que lo hace seguro:
 *
 *   - NO toca `users.es_premium` del servidor. Esa columna solo la escribe el webhook de
 *     RevenueCat desde el 2026-09-15, y `set_premium_status` esta revocada para anon y
 *     authenticated. El demo vive en el almacen LOCAL y nada mas; la seguridad que se cerro
 *     entonces sigue intacta.
 *   - NO simula una compra ante nadie. No hay cobro, ni recibo, ni pantalla que finja un cargo:
 *     el boton dice lo que hace. Fingir un cobro seria mentirle a quien lo mire.
 *   - NO puede quedarse encendido por accidente en una app con monetizacion real. Ver abajo.
 *
 * SE APAGA SOLO. La condicion incluye `!isRevenueCatConfigured()`: el dia que exista la clave
 * `goog_...` de Google Play, el modo demo se desactiva aunque alguien olvide quitar la variable
 * de entorno. Un interruptor que hay que acordarse de apagar es un interruptor que un dia se
 * queda encendido, y ese dia estarias regalando el tier de pago.
 *
 * COMO SE ENCIENDE: `EXPO_PUBLIC_DEMO_MODE=1` en el entorno del build. Se hornea al compilar, asi
 * que no es algo que se pueda activar desde un telefono ya instalado.
 */
export const MODO_DEMO = process.env.EXPO_PUBLIC_DEMO_MODE === '1' && !isRevenueCatConfigured();

/** Planes de mentira para el paywall del demo. Precios realistas para el mercado de Showmi:
 *  inventar "$0.00" haria que el paywall se viera roto en el video en vez de creible. */
export const PLANES_DEMO = [
  { id: 'mensual', titulo: 'Mensual', precio: 'MX$49', pie: 'cancela cuando quieras', ahorro: null },
  { id: 'anual', titulo: 'Anual', precio: 'MX$399', pie: 'MX$33 al mes', ahorro: 'AHORRA 32%' },
] as const;
