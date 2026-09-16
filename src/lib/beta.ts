/**
 * Barreras de beta: cosas que están construidas pero que todavía no se enseñan.
 *
 * POR QUÉ EXISTE (2026-09-16): las mascotas y el Camerino funcionan -- se visten, suben de
 * nivel, desbloquean cosméticos -- pero su dibujo no está a la altura del resto de la app, y a
 * dos semanas de la entrega arreglarlo bien no cabe. Entre enseñar arte que no convence y
 * esconder la función hasta que lo esté, se esconde: una app que se ve entera y hace menos
 * cosas gana a una que hace más y se ve a medias.
 *
 * SE ESCONDE, NO SE BORRA. El código del Camerino, los once cosméticos, los niveles por
 * categoría y el almacén siguen ahí y siguen funcionando; lo único que cambia es que no hay
 * manera de llegar. Borrarlos obligaría a reescribirlos, y lo que falla es el dibujo, no la
 * mecánica.
 *
 * SE LEE EN TIEMPO DE COMPILACIÓN, no en tiempo de ejecución. `EXPO_PUBLIC_*` se hornea en el
 * bundle al construir, así que con la barrera puesta el APK que se entrega no tiene forma de
 * abrir el Camerino ni por deep link -- no es un interruptor que alguien pueda encontrar.
 *
 * PARA TRABAJAR EN ELLAS: poner `EXPO_PUBLIC_BETA_MASCOTAS=1` en `.env` y reiniciar Metro.
 * Todo vuelve a aparecer exactamente donde estaba.
 */
export const MASCOTAS_ACTIVAS = process.env.EXPO_PUBLIC_BETA_MASCOTAS === '1';
