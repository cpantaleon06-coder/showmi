/**
 * Variante web de ads.ts -- react-native-google-mobile-ads es un módulo nativo puro (sin
 * "browser"/build web en su package.json, confirmado antes de escribir esto). Metro resuelve
 * este archivo automáticamente en vez de ads.ts para cualquier bundle de plataforma web (por
 * el sufijo .web.ts, convención estándar de React Native/Expo) -- así el import real del SDK
 * nativo nunca se ejecuta ahí, ni siquiera para descubrir en tiempo de build que no hace nada.
 * Mismas firmas que ads.ts para que useNativeAd.ts y quien más importe de 'lib/ads' no necesite
 * saber en qué plataforma está.
 */
import type { NativeAd } from 'react-native-google-mobile-ads';

export async function initializeAds(): Promise<void> {}

export async function loadNativeAd(_placement: string): Promise<NativeAd | null> {
  return null;
}

export function trackAdDisplayed(_ad: NativeAd, _placement: string): void {}

export function trackAdOpened(_ad: NativeAd, _placement: string): void {}

export function areAdsSupportedOnThisPlatform(): boolean {
  return false;
}
