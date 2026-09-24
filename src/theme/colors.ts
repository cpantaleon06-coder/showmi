/**
 * 2026-08-31: pivote de identidad visual -- se abandona el azul (`brand`
 * anterior, #2D5BFF/#1A3FCC) y la paleta Nagai/City Pop como dirección
 * principal, a favor de constructivismo ruso: rojo de cartel, negro/crema
 * en vez de grises suaves, bordes marcados en vez de líneas discretas
 * (ver `border`, ahora casi negro puro en claro / casi blanco puro en
 * oscuro -- alto contraste tipo linework de afiche, no un borde sutil).
 * `nagaiGradient` se mantiene por ahora (sigue en uso en Perfil/Camerino y
 * el estado seleccionado de chips) pero queda pendiente de reemplazo por
 * el sistema reactivo de color-por-vibra (`vibeColors.ts`, nuevo) una vez
 * se toquen esos componentes -- ver orden de implementación de la sección
 * 8 (tokens -> swipe card -> onboarding -> edición -> Feed), esto es solo
 * el paso 1.
 *
 * 2026-09-08: `brand` se calma -- el rojo de cartel puro (#C81E13/#E8362A) leía
 * demasiado agresivo para el tono amigable que se quiere ahora (junto con
 * botones más redondos y la mascota más chibi, mismo pedido). Se mueve de rojo
 * puro a terracota/coral: mismo hue vecino, menos saturación, misma familia de
 * marca -- no un cambio de identidad, un ablande. Contraste contra texto blanco
 * verificado (4.67:1 claro / 3.64:1 oscuro, ambos sobre AA para texto grande o
 * negrita -- el original rondaba 4.15:1 en oscuro, así que sigue en el mismo
 * rango, no se sacrificó legibilidad por calidez).
 */
export type ThemeMode = 'light' | 'dark';

export interface ThemeColors {
  background: string;
  surface: string;
  textPrimary: string;
  textSecondary: string;
  brand: string;
  /**
   * `brand` cuando se usa como PRIMER PLANO (texto, íconos, spinners) sobre
   * `background`/`surface` -- no como relleno.
   *
   * 2026-09-08: nace al mover el fondo oscuro de casi-negro a outer space
   * (#2C363E). Sobre un fondo más claro, un solo tono no puede cumplir los dos
   * papeles: para que el terracota pase AA como TEXTO sobre #2C363E hay que
   * aclararlo a ~#E8836F, pero ahí el blanco ENCIMA del botón cae a 2.66:1 y los
   * botones quedan peor de lo que estaban. Medido, no estimado -- se barrieron
   * seis candidatos y no existe un valor que sirva para ambos.
   *
   * Así que se separan los papeles (mismo remedio que ya se aplicó a
   * `premiumAccent` cuando falló sobre `surface` claro, ver abajo): `brand` se
   * queda para rellenos con texto blanco encima (3.71:1, idéntico a antes del
   * cambio de fondo), y `brandText` es la variante aclarada para primer plano
   * (4.64:1 sobre background, 5.40:1 sobre surface).
   *
   * En claro son el mismo valor a propósito: #C64C3C ya daba 4.67:1 sobre ivory,
   * el problema era exclusivamente del tema oscuro.
   */
  brandText: string;
  like: string;
  pass: string;
  border: string;
  /**
   * Hiroshi Nagai / City Pop atmospheric sunset gradient (coral -> dusty rose
   * -> deep teal). Reserved for exactly three places: the Perfil/Camerino
   * header behind the mascot, and a chip/button's *selected* state (active
   * collection tab, chosen genre, chosen vibe). Never used for feed rows,
   * library rows, plain text, or navigation -- those stay flat and
   * disciplined so this gradient keeps reading as a deliberate accent
   * instead of decorative background noise.
   *
   * Deliberately independent of `brand`: this is the atmospheric palette,
   * not the interactive one. Its coral first stop is not derived from (and
   * should never be made to reference) `brand` -- they're allowed to drift
   * apart, as they did when `brand` moved to blue.
   *
   * 2026-08-29: cool anchor moved from purple/blue to deep teal specifically
   * to stop reading as the Instagram gradient (orange-magenta-purple) --
   * that one shares almost the same hue path the old version had. Same
   * triplet for both modes on purpose (this is the atmospheric palette, not
   * theme-derived) -- verified visually against both page backgrounds.
   */
  nagaiGradient: [string, string, string];
  /**
   * Dorado reservado para la insignia/CTA de "Showmi More" (paywall, badge en Feed/Perfil)
   * -- mismo espíritu de "acento reservado" que nagaiGradient (documentado ahí arriba): un
   * solo uso consistente en toda la app, nunca decorativo en otro lado, para que de verdad
   * lea como estatus y no se diluya.
   *
   * 2026-09-06: deja de ser un valor único -- `#C9A227` da 7.33:1 sobre `surface` oscuro
   * (bien) pero solo 2.38:1 sobre `surface` claro (falla WCAG AA, que pide 4.5:1 para texto
   * normal), encontrado en una pasada de pulido visual viendo "Hazte Showmi More" lavado en
   * modo claro. Mismo tipo de bug que el ámbar-sobre-blanco de la Fase 3 (ver historial de
   * `brand` más abajo) -- el dorado claro se oscurece a `#8A6B14` (4.93:1) para quedar
   * legible sin dejar de leerse como "la misma familia de color" en los dos modos.
   */
  premiumAccent: string;
}

const NAGAI_GRADIENT: [string, string, string] = ['#FF8C5A', '#D9718C', '#0F6E7D'];

/**
 * Rojo de cartel constructivista -- reemplaza el azul como color interactivo primario.
 *
 * 2026-09-08: el fondo deja de ser casi-negro (#121212) y pasa a outer space
 * (#2C363E), un gris azulado de medio tono. `surface` se rederivó a #232B32, que
 * es MÁS OSCURO que el fondo -- lo contrario a la convención habitual de "elevado
 * = más claro", y a propósito: probé primero superficies más claras (#364049,
 * #38444E) y sobre ellas `textSecondary` caía a 4.04:1 y `premiumAccent` a 4.37:1,
 * los dos por debajo de AA. Con la superficie hundida ambos suben solos (5.49 y
 * 5.93) sin tener que retocar ningún otro token. Las tarjetas se leen como huecos
 * en la página en vez de placas flotando sobre ella, que además le queda bien al
 * lenguaje de bloques planos del resto del sistema.
 *
 * Contrastes verificados contra el fondo nuevo: textPrimary 11.30, textSecondary
 * 4.71, border 10.50, like 6.41.
 *
 * `pass` SE CORRIGIÓ el 2026-09-23. Estaba en #F87171, que da 4.45 contra este
 * fondo -- justo por debajo del 4.5 de AA para texto normal, y sí se usa como
 * texto: es el color del mensaje de error de auth.tsx, o sea precisamente donde
 * alguien tiene un problema y necesita leer. Ahora es #F87676 y da **4.60**.
 *
 * SE ACLARÓ, NO SE OSCURECIÓ, y va contra la intuición: sobre un fondo OSCURO el
 * contraste sube alejándose de él, o sea hacia el blanco. Comprobado con la misma
 * fórmula de luminancia relativa de WCAG que el resto de este archivo: #F76E6E,
 * que parecía la corrección obvia por ser más intenso, da 4.35 -- peor que el
 * valor que se quería arreglar.
 *
 * El mínimo estricto que cruza el umbral es #F87373 (4.51), pero 0.01 de margen no
 * sobrevive a ningún redondeo, así que se tomó el siguiente escalón imperceptible:
 * cinco puntos de 255 en dos canales, indistinguible a ojo del rojo anterior.
 * Como ícono y como borde (umbral 3:1) sigue holgadísimo, y sobre `surface`
 * (#232B32) da 5.36.
 */
export const darkColors: ThemeColors = {
  background: '#2C363E',
  surface: '#232B32',
  textPrimary: '#F5F5F5',
  textSecondary: '#A0A0A0',
  brand: '#DC5C48',
  brandText: '#E8836F',
  like: '#34D399',
  pass: '#F87676',
  border: '#F2ECE4',
  nagaiGradient: NAGAI_GRADIENT,
  premiumAccent: '#C9A227',
};

export const lightColors: ThemeColors = {
  background: '#F3ECE0',
  surface: '#FFFDF8',
  textPrimary: '#141414',
  textSecondary: '#5C5449',
  brand: '#C64C3C',
  // Mismo valor que `brand`: en claro no hace falta separar los papeles (ver brandText).
  brandText: '#C64C3C',
  like: '#22C55E',
  pass: '#EF4444',
  border: '#141414',
  nagaiGradient: NAGAI_GRADIENT,
  premiumAccent: '#8A6B14',
};

export function colorsForMode(mode: ThemeMode): ThemeColors {
  return mode === 'dark' ? darkColors : lightColors;
}
