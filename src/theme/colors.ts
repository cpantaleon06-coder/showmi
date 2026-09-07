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

/** Rojo de cartel constructivista -- reemplaza el azul como color interactivo primario. */
export const darkColors: ThemeColors = {
  background: '#121212',
  surface: '#1C1620',
  textPrimary: '#F5F5F5',
  textSecondary: '#A0A0A0',
  brand: '#DC5C48',
  like: '#34D399',
  pass: '#F87171',
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
  like: '#22C55E',
  pass: '#EF4444',
  border: '#141414',
  nagaiGradient: NAGAI_GRADIENT,
  premiumAccent: '#8A6B14',
};

export function colorsForMode(mode: ThemeMode): ThemeColors {
  return mode === 'dark' ? darkColors : lightColors;
}
