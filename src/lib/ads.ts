/**
 * ANUNCIOS DESACTIVADOS EN ESTE BUILD (2026-09-13).
 *
 * `react-native-google-mobile-ads` NO se puede compilar hoy sobre Expo SDK 57. Es un bloqueo
 * real del ecosistema, no algo que se arregle configurando:
 *
 *   1. La libreria (16.5.0, la unica que soporta React Native 0.86) exige APIs de
 *      play-services-ads 25.x -- AgeRestrictedTreatment, getLargeAnchoredAdaptiveBannerAdSize.
 *   2. play-services-ads 25.x viene compilado por Google con Kotlin 2.2/2.3.
 *   3. Expo SDK 57 compila con Kotlin 2.1, que NO puede leer metadatos posteriores.
 *
 * Las dos condiciones no se pueden cumplir a la vez. Se intentaron, en builds reales, y
 * fallaron los tres caminos: subir el proyecto a Kotlin 2.3 (empeoro, rompio tambien
 * react-native-purchases-ui), fijar play-services-ads en 24.7.0 (adios errores de Kotlin,
 * hola APIs inexistentes) y parchear la libreria (cada parche destapaba la siguiente API).
 * Bajar la libreria tampoco: las versiones que fijan un SDK 24.x son de 2025, anteriores a
 * RN 0.86 y a la arquitectura nueva.
 *
 * Este archivo es el no-op que ya existia como variante web, promovido a implementacion unica
 * para que la app compile y se pueda verificar lo que de verdad bloquea la entrega: la compra
 * de RevenueCat.
 *
 * COMO RESTAURARLO cuando Expo suba a Kotlin 2.2+ (o Google publique un play-services-ads
 * compilado con 2.1): revertir el commit que introdujo este cambio. La implementacion real de
 * AdMob esta intacta en el historial de git, no reescrita.
 */

/**
 * Sustituto del tipo `NativeAd` del SDK, declarado local para que nada importe el paquete
 * nativo. Solo lleva lo que el codigo de Showmi usa de verdad (`destroy`, ver useNativeAd.ts):
 * es un stub del CONTRATO consumido, no una copia del tipo real. Si al restaurar AdMob hace
 * falta algo mas, el compilador lo dira.
 */
export type NativeAd = { destroy: () => void };

export async function initializeAds(): Promise<void> {}

export async function loadNativeAd(_placement: string): Promise<NativeAd | null> {
  return null;
}

export function trackAdDisplayed(_ad: NativeAd, _placement: string): void {}

export function trackAdOpened(_ad: NativeAd, _placement: string): void {}

/** Siempre false: quien llama ya salta el slot en vez de montarlo (ver SwipeDeck/feed). */
export function areAdsSupportedOnThisPlatform(): boolean {
  return false;
}
