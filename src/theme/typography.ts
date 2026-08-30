/**
 * Nunca dejar la fuente del sistema en texto visible -- toda la app usa
 * exactamente estas dos familias. Display para títulos/nombres de canción
 * (con carácter propio, geométrica, funciona incluso chica); cuerpo para
 * todo lo demás (legible, más personalidad que Inter).
 */
export const fonts = {
  display: 'ArchivoBlack_400Regular',
  bodyRegular: 'PlusJakartaSans_400Regular',
  bodySemiBold: 'PlusJakartaSans_600SemiBold',
  bodyBold: 'PlusJakartaSans_700Bold',
  bodyExtraBold: 'PlusJakartaSans_800ExtraBold',
} as const;
