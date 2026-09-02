import { Platform } from 'react-native';
import Purchases, { CustomerInfo, PurchasesOffering, PurchasesPackage } from 'react-native-purchases';

/**
 * Identificador de entitlement configurado en el dashboard de RevenueCat -- convención propia
 * de este proyecto, no algo que el SDK imponga. Si el entitlement se nombra distinto al crear
 * el proyecto en RevenueCat, hay que actualizar esta constante para que coincida (si no, la
 * compra se procesa pero `isPremiumFromCustomerInfo` nunca la ve y el tier jamás se activa).
 *
 * Nota de nombres: el tier se llama **"Showmi More"** de cara al usuario (2026-09-01, antes
 * "Showmi Premium"). En el código el concepto genérico sigue siendo `premium` -- `isPremium`,
 * `es_premium`, `premiumAccent`, esta constante -- a propósito: es el nombre del CONCEPTO
 * (nivel de pago), no de la marca, así que un cambio de marca futuro no obliga a tocar el
 * esquema de la base ni media docena de archivos. Solo los strings visibles dicen "Showmi More".
 */
export const PREMIUM_ENTITLEMENT_ID = 'premium';

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
  return key.length > 0;
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
