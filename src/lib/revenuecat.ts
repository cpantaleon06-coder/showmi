import { Platform } from 'react-native';
import Purchases, { CustomerInfo, PurchasesOffering, PurchasesPackage } from 'react-native-purchases';
import RevenueCatUI from 'react-native-purchases-ui';

/**
 * Identificador de entitlement configurado en el dashboard de RevenueCat -- convención propia
 * de este proyecto, no algo que el SDK imponga. Si el entitlement se nombra distinto al crear
 * el proyecto en RevenueCat, hay que actualizar esta constante para que coincida (si no, la
 * compra se procesa pero `isPremiumFromCustomerInfo` nunca la ve y el tier jamás se activa).
 *
 * Nota de nombres: el tier se llama **"Showmi More"** de cara al usuario (2026-09-01, antes
 * "Showmi Premium"). En el código el concepto genérico sigue siendo `premium` -- `isPremium`,
 * `es_premium`, `premiumAccent` -- a propósito: es el nombre del CONCEPTO (nivel de pago), no
 * de la marca, así que un cambio de marca futuro no obliga a tocar el esquema de la base ni
 * media docena de archivos. Solo los strings visibles dicen "Showmi More".
 *
 * Esta constante SÍ es la excepción: tiene que ser el identificador EXACTO configurado en el
 * dashboard de RevenueCat (Entitlements), que el usuario ya creó como `showmi_more` (no
 * `premium`, que era la suposición original de este archivo antes de que existiera el
 * proyecto real). Un desajuste acá no truena nada -- la compra se procesa igual en la tienda
 * -- simplemente `isPremiumFromCustomerInfo` nunca encuentra la entitlement activa y el tier
 * jamás se activa del lado de la app. Bug silencioso, no un error visible.
 */
export const PREMIUM_ENTITLEMENT_ID = 'showmi_more';

const IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS ?? '';
const ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID ?? '';

/**
 * true solo si hay una key real cargada para esta plataforma -- las variables de entorno
 * existen como placeholders vacíos desde el principio del proyecto (ver .env.example), y
 * react-native-purchases no tiene soporte de compra real en el target web de todos modos
 * (ver nota de RevenueCat: getProducts/purchaseProduct/restorePurchases no soportados en
 * web sin Billing configurado aparte). Sin esto, cada función de este archivo haría un
 * no-op silencioso en vez de intentar inicializar el SDK con una key vacía.
 */
export function isRevenueCatConfigured(): boolean {
  if (Platform.OS === 'web') return false;
  const key = Platform.OS === 'ios' ? IOS_KEY : ANDROID_KEY;
  if (key.length === 0) return false;

  // EL SDK CIERRA LA APP si encuentra una clave de Test Store en un build de release.
  //
  // No es una suposición: el APK del 2026-09-24 se instaló en un Android real y, al abrirlo,
  // salió un diálogo nativo de RevenueCat -- "Wrong API Key ... The app will close now to
  // protect the security of test purchases" -- y la app se cerraba. Ninguna pantalla llegaba a
  // verse. La clave `test_...` del Test Store es de desarrollo, y el SDK la rechaza en cuanto
  // el build no es depurable.
  //
  // La propia documentación de RevenueCat lo dice ("NEVER SUBMIT APPS WITH A TEST STORE API
  // KEY") y recomienda elegir la clave según el tipo de build: la de prueba en debug, la de
  // plataforma (`goog_...` / `appl_...`) en release. Eso es exactamente lo que hace esta línea.
  //
  // Al devolver false, la app entra en MODO GRATUITO -- que es un camino que este archivo ya
  // soportaba desde el principio para cuando no había claves. Todo funciona menos comprar, y
  // el paywall enseña "los planes todavía se están configurando". Preferible con mucho a una
  // app que no abre.
  //
  // Para volver a tener compras hay dos caminos, y ninguno es quitar esta comprobación:
  //   - Probar AHORA: un build depurable (perfil `development`), donde `__DEV__` es true y la
  //     clave de prueba es legítima.
  //   - Publicar: poner la clave `goog_...` de Google Play en EXPO_PUBLIC_REVENUECAT_API_KEY_
  //     ANDROID en el entorno `preview`/`production` de EAS. En cuanto no empiece por `test_`,
  //     esta comprobación deja de aplicar sola.
  if (!__DEV__ && key.startsWith('test_')) return false;

  return true;
}

/**
 * Se llama una sola vez, apenas hay un auth.uid() real (ver useRevenueCatSync.ts) -- el
 * mismo id de Supabase se usa como appUserID de RevenueCat para que ambos sistemas
 * identifiquen al mismo usuario sin un segundo login. No-op si no está configurado (ver
 * isRevenueCatConfigured) -- el resto de la app debe seguir funcionando en modo gratuito.
 */
export function configureRevenueCat(appUserId: string): void {
  if (!isRevenueCatConfigured()) return;
  const apiKey = Platform.OS === 'ios' ? IOS_KEY : ANDROID_KEY;
  Purchases.configure({ apiKey, appUserID: appUserId });
}

export function isPremiumFromCustomerInfo(info: CustomerInfo): boolean {
  return Boolean(info.entitlements.active[PREMIUM_ENTITLEMENT_ID]?.isActive);
}

export async function fetchCustomerInfo(): Promise<CustomerInfo | null> {
  if (!isRevenueCatConfigured()) return null;
  try {
    return await Purchases.getCustomerInfo();
  } catch (e) {
    console.warn('[revenuecat] getCustomerInfo falló:', e);
    return null;
  }
}

/** null cuando no hay oferta configurada todavía en el dashboard (o el SDK no está listo) --
 *  la pantalla de paywall debe degradar a un estado "planes no disponibles todavía", nunca
 *  crashear ni quedarse cargando para siempre. */
export async function fetchCurrentOffering(): Promise<PurchasesOffering | null> {
  if (!isRevenueCatConfigured()) return null;
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current;
  } catch (e) {
    console.warn('[revenuecat] getOfferings falló:', e);
    return null;
  }
}

export async function purchasePackage(pkg: PurchasesPackage): Promise<CustomerInfo> {
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  return customerInfo;
}

export async function restorePurchases(): Promise<CustomerInfo> {
  return Purchases.restorePurchases();
}

export function addCustomerInfoListener(listener: (info: CustomerInfo) => void): () => void {
  if (!isRevenueCatConfigured()) return () => {};
  Purchases.addCustomerInfoUpdateListener(listener);
  return () => Purchases.removeCustomerInfoUpdateListener(listener);
}

/**
 * Modal nativo de RevenueCat para gestionar una suscripción YA activa (cancelar, cambiar de
 * plan, pedir reembolso en iOS, contactar soporte) -- configurado desde el dashboard, no algo
 * que este archivo controle. A diferencia del paywall (hecho a mano en app/premium.tsx para
 * respetar el sistema de diseño propio de Showmi, ver comentario ahí), el Customer Center es
 * una pantalla de UTILIDAD -- gestionar algo que ya se compró -- no de conversión/venta, así
 * que usar la vista nativa de RevenueCat acá no compite con la identidad visual del producto
 * de la misma forma que un paywall genérico sí lo haría.
 *
 * La promesa resuelve cuando la persona cierra el modal -- quien llama debe refrescar
 * CustomerInfo después (pudo haber cancelado), ver el uso en app/premium.tsx.
 */
export async function presentCustomerCenter(): Promise<void> {
  if (!isRevenueCatConfigured()) return;
  try {
    await RevenueCatUI.presentCustomerCenter();
  } catch (e) {
    console.warn('[revenuecat] presentCustomerCenter falló:', e);
  }
}
