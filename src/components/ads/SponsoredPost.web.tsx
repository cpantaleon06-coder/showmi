import { ThemeColors } from '../../theme/colors';

interface SponsoredPostProps {
  colors: ThemeColors;
  placement: string;
}

/** Variante web -- ver SponsoredCard.web.tsx / ads.web.ts para el motivo. feed.tsx ya filtra
 *  estos slots del `data` en web (ver areAdsSupportedOnThisPlatform), esto es la última
 *  línea de defensa. */
export function SponsoredPost(_props: SponsoredPostProps) {
  return null;
}
