import { useEffect, useRef, useState } from 'react';
import { NativeAd, areAdsSupportedOnThisPlatform, loadNativeAd, trackAdDisplayed } from '../lib/ads';

interface UseNativeAdResult {
  ad: NativeAd | null;
  /** true mientras carga -- quien llama decide qué mostrar (nada, un placeholder, saltar el
   *  slot) en vez de que este hook imponga un spinner. */
  loading: boolean;
}

/**
 * Carga un Native Ad una sola vez por montaje y lo destruye al desmontar (`ad.destroy()` --
 * un NativeAd es de un solo uso, dejarlo vivo sin destruir es una fuga real). `enabled=false`
 * (ej. usuario con Showmi More, o plataforma sin soporte) no carga nada -- ni siquiera
 * pega a la red, no solo oculta el resultado.
 */
export function useNativeAd(placement: string, enabled: boolean): UseNativeAdResult {
  const [ad, setAd] = useState<NativeAd | null>(null);
  const [loading, setLoading] = useState(enabled);
  const displayedRef = useRef(false);

  useEffect(() => {
    if (!enabled || !areAdsSupportedOnThisPlatform()) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    loadNativeAd(placement).then((loaded) => {
      if (cancelled) {
        loaded?.destroy();
        return;
      }
      setAd(loaded);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placement, enabled]);

  useEffect(() => {
    return () => {
      ad?.destroy();
    };
  }, [ad]);

  useEffect(() => {
    if (ad && !displayedRef.current) {
      displayedRef.current = true;
      trackAdDisplayed(ad, placement);
    }
  }, [ad, placement]);

  return { ad, loading };
}
