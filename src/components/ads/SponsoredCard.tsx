import { useEffect } from 'react';

import { ThemeColors } from '../../theme/colors';

interface SponsoredCardProps {
  colors: ThemeColors;
  placement: string;
  onContinue: () => void;
}

/**
 * Slot de anuncio desactivado -- ver la nota larga en src/lib/ads.ts para por que AdMob no
 * compila sobre Expo SDK 57 hoy.
 *
 * No deberia llegar a montarse (SwipeDeck revisa areAdsSupportedOnThisPlatform antes de
 * insertar el slot), pero si algo lo monta, sigue de largo solo en vez de crashear.
 */
export function SponsoredCard({ onContinue }: SponsoredCardProps) {
  useEffect(() => {
    onContinue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
