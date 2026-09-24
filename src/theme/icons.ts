/**
 * Escala de tamaños de ícono (2026-09-23).
 *
 * POR QUÉ EXISTE: hasta hoy cada ícono elegía su tamaño a mano. Auditado el código, había
 * catorce valores distintos repartidos sin criterio -- 12, 13, 15, 16, 17, 18, 20, 22, 24, 26,
 * 28, 34, 40, 42, 44. Ninguno está "mal" por separado; el problema es que un 17 y un 18 en dos
 * pantallas distintas no son una decisión, son ruido, y nadie que añada un ícono nuevo tiene de
 * dónde agarrarse para elegir.
 *
 * LOS PASOS SALEN DEL CÓDIGO, NO DE UNA ESCALA BONITA. Contados los usos reales, 18 aparece 9
 * veces y 24 aparece 5 -- son los dos valores más frecuentes con diferencia, así que son los que
 * mandan. `sm` recoge el racimo de 15/16/17 y `xl` el de los botones grandes del deck (28).
 *
 * NO SE MIGRÓ TODA LA APP DE GOLPE, a propósito: snapear catorce valores a cuatro cambia el
 * aspecto de pantallas que hoy están bien, y eso es una revisión visual completa, no una
 * limpieza. El archivo queda disponible y se migra cuando se toque cada pantalla.
 *
 * Dos valores de ActionButtons (20 en deshacer y 22 en compartir) NO se migraron: no coinciden
 * con ningún paso, y acercarlos costaría 2 y 4 píxeles de cambio visible en los controles más
 * usados de la app. Esa es una decisión de diseño, no de limpieza, y no se toma de paso.
 */
export const iconSize = {
  /** 16 -- Íconos en línea con texto, insignias y adornos dentro de un chip. */
  sm: 16,
  /** 18 -- El caso normal. Es el valor más usado del proyecto; ante la duda, este. */
  md: 18,
  /** 24 -- Navegación y controles de cabecera (volver, perfil): se tocan, y se buscan con la vista. */
  lg: 24,
  /** 28 -- Las acciones principales del deck (like y pass). Reservado: si todo es grande, nada lo es. */
  xl: 28,
} as const;

export type IconSize = (typeof iconSize)[keyof typeof iconSize];
