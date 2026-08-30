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
}

const NAGAI_GRADIENT: [string, string, string] = ['#FF8C5A', '#D9718C', '#0F6E7D'];

export const darkColors: ThemeColors = {
  background: '#121212',
  surface: '#1C1620',
  textPrimary: '#F5F5F5',
  textSecondary: '#A0A0A0',
  brand: '#2D5BFF',
  like: '#34D399',
  pass: '#F87171',
  border: '#2A2430',
  nagaiGradient: NAGAI_GRADIENT,
};

export const lightColors: ThemeColors = {
  background: '#FAF9FC',
  surface: '#FFFFFF',
  textPrimary: '#1A1A1A',
  textSecondary: '#6B6B6B',
  brand: '#1A3FCC',
  like: '#22C55E',
  pass: '#EF4444',
  border: '#E8E4EE',
  nagaiGradient: NAGAI_GRADIENT,
};

export function colorsForMode(mode: ThemeMode): ThemeColors {
  return mode === 'dark' ? darkColors : lightColors;
}
