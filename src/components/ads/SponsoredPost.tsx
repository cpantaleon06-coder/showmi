import { ThemeColors } from '../../theme/colors';

interface SponsoredPostProps {
  colors: ThemeColors;
  placement: string;
}

/** Slot de anuncio desactivado -- ver la nota larga en src/lib/ads.ts. feed.tsx ya filtra
 *  estos slots del `data`; esto es la ultima linea de defensa. */
export function SponsoredPost(_props: SponsoredPostProps) {
  return null;
}
