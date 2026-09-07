import { Platform } from 'react-native';
import mobileAds, { NativeAd, NativeAdEventType, TestIds } from 'react-native-google-mobile-ads';
import Purchases, { AdFormat, AdMediatorName, AdRevenuePrecision } from 'react-native-purchases';

/**
 * RevenueCat Ads, aclaración importante (2026-09-06): RevenueCat NO sirve anuncios -- solo
 * trackea ingresos de una red real vía `Purchases.adTracker` (beta pública, requiere
 * react-native-purchases >= 10.2.0, Showmi ya tiene 10.8.1). El anuncio en sí viene de Google
 * AdMob (`react-native-google-mobile-ads`), la única red que RevenueCat documenta a fondo.
 * Este archivo es la capa que junta las dos cosas: carga el anuncio real de AdMob y reporta
 * cada evento a RevenueCat para que aparezca en su dashboard de Ads junto a las suscripciones.
 *
 * Formato elegido: **Native Ads** -- a diferencia de banner/interstitial, un Native Ad no trae
 * su propio diseño, te da los datos crudos (headline, body, ícono, media, call-to-action) para
 * que TÚ los pintes con tus propios componentes. Es la única forma real de que un anuncio se
 * vea como "una tarjeta más" del deck o del Feed en vez de una caja ajena insertada encima.
 *
 * `TestIds.NATIVE` -- IDs de anuncio de prueba OFICIALES de Google (públicos, documentados,
 * funcionan sin cuenta de AdMob). El `androidAppId`/`iosAppId` en app.json también son los de
 * prueba de Google. **Antes de producción real hay que reemplazar ambos por los IDs reales de
 * una cuenta de AdMob propia** -- con IDs de prueba el anuncio que se ve es genérico
 * ("Test Ad"), nunca un anuncio real pagado.
 */
const AD_UNIT_NATIVE = TestIds.NATIVE;

let initialized = false;

/** Se llama una sola vez al arrancar la app (ver app/_layout.tsx) -- no-op si ya se llamó, o en
 *  web (el SDK de AdMob es nativo puro, sin build para web -- llamarlo ahí tira, no solo no
 *  hace nada). */
export async function initializeAds(): Promise<void> {
  if (initialized || !areAdsSupportedOnThisPlatform()) return;
  initialized = true;
  try {
    await mobileAds().initialize();
  } catch (e) {
    console.warn('[ads] initializeAds falló (no bloqueante):', e);
  }
}

/**
 * Carga un Native Ad y engancha el tracking de RevenueCat a sus eventos -- `loaded`/`failed`
 * se reportan de inmediato acá; `displayed` lo dispara quien llama cuando el ad de verdad
 * entra en pantalla (ver useNativeAd.ts), porque "cargado" y "visible" no son lo mismo (un ad
 * puede cargar de fondo antes de que el usuario llegue a esa tarjeta).
 *
 * `impressionId`: el SDK de AdMob para RN no expone un `impressionId` propio en `NativeAd` --
 * se usa `responseId` (identificador único por carga que sí expone la clase) como sustituto
 * razonable para el reporte a RevenueCat, que es analítica best-effort, no una fuente de
 * verdad financiera crítica.
 */
export async function loadNativeAd(placement: string): Promise<NativeAd | null> {
  try {
    const ad = await NativeAd.createForAdRequest(AD_UNIT_NATIVE, { requestAgent: 'Showmi' });
    trackAdEvent('trackAdLoaded', ad, placement);

    ad.addAdEventListener(NativeAdEventType.PAID, (payload) => {
      Purchases.adTracker
        .trackAdRevenue({
          mediatorName: AdMediatorName.adMob,
          adFormat: AdFormat.nativeAd,
          adUnitId: ad.adUnitId,
          impressionId: ad.responseId,
          revenueMicros: Math.round(payload.value * 1_000_000),
          currency: payload.currencyCode,
          precision: mapPrecision(payload.precision),
          placement,
        })
        .catch(() => {});
    });

    return ad;
  } catch (e) {
    Purchases.adTracker
      .trackAdFailedToLoad({
        mediatorName: AdMediatorName.adMob,
        adFormat: AdFormat.nativeAd,
        adUnitId: AD_UNIT_NATIVE,
        placement,
      })
      .catch(() => {});
    console.warn('[ads] loadNativeAd falló (no bloqueante, se omite el slot):', e);
    return null;
  }
}

/** Se llama cuando la tarjeta patrocinada de verdad entra en pantalla (no al cargar). */
export function trackAdDisplayed(ad: NativeAd, placement: string): void {
  trackAdEvent('trackAdDisplayed', ad, placement);
}

/** Se llama cuando la persona toca el call-to-action del anuncio. */
export function trackAdOpened(ad: NativeAd, placement: string): void {
  trackAdEvent('trackAdOpened', ad, placement);
}

function trackAdEvent(method: 'trackAdLoaded' | 'trackAdDisplayed' | 'trackAdOpened', ad: NativeAd, placement: string): void {
  Purchases.adTracker[method]({
    mediatorName: AdMediatorName.adMob,
    adFormat: AdFormat.nativeAd,
    adUnitId: ad.adUnitId,
    impressionId: ad.responseId,
    placement,
  }).catch(() => {});
}

/**
 * El payload nativo de AdMob manda `precision` como número (PrecisionType de Android/iOS:
 * 0=desconocido, 1=estimado, 2=definido por el publisher, 3=exacto), no como string -- mapeo
 * documentado por Google, no adivinado.
 */
function mapPrecision(raw: number): string {
  switch (raw) {
    case 3:
      return AdRevenuePrecision.exact;
    case 2:
      return AdRevenuePrecision.publisherDefined;
    case 1:
      return AdRevenuePrecision.estimated;
    default:
      return AdRevenuePrecision.unknown;
  }
}

/** Web nunca muestra anuncios reales (el SDK de AdMob es nativo puro, sin build para web) --
 *  mismo criterio ya establecido para RevenueCat en revenuecat.ts. */
export function areAdsSupportedOnThisPlatform(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}
