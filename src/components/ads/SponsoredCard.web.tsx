import { useEffect } from 'react';

import { ThemeColors } from '../../theme/colors';

interface SponsoredCardProps {
  colors: ThemeColors;
  placement: string;
  onContinue: () => void;
}

/**
 * Variante web -- ver ads.web.ts para el motivo (react-native-google-mobile-ads es nativo
 * puro, este archivo evita que Metro intente resolver <NativeAdView>/<NativeAsset> en el
 * bundle web). Este slot nunca debería llegar a montarse en la práctica (SwipeDeck.tsx
 * revisa areAdsSupportedOnThisPlatform antes de insertar el slot en el stack), pero si algo
 * lo monta igual, sigue de largo solo en vez de crashear.
 */
export function SponsoredCard({ onContinue }: SponsoredCardProps) {
  useEffect(() => {
    onContinue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
