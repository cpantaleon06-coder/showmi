import { supabase } from '../lib/supabase';

/**
 * Espeja el entitlement de RevenueCat (verdad del lado del cliente) a `public.users.es_premium`
 * -- sin esto, nadie más que el propio dueño puede saber que un post/perfil es Premium (la
 * insignia en Feed depende de leer esto vía get_feed_posts, ver postsClient.ts). No bloqueante,
 * mismo patrón que registerSwipeRemote: se llama cada vez que cambia el CustomerInfo (ver
 * useRevenueCatSync.ts), nunca debe trabar la UI si falla.
 *
 * Nota de robustez consciente: esto es la app escribiendo su propia verdad de suscripción,
 * no un webhook server-side de RevenueCat -- suficiente para el v1 del Shipaton (nadie tiene
 * incentivo real para falsificar `es_premium` sin comprar nada, es solo una insignia
 * cosmética), pero no es a prueba de manipulación. Endurecerlo con un webhook de RevenueCat
 * -> Edge Function -> update directo es trabajo futuro, no bloquea este v1.
 */
export async function syncPremiumStatus(isPremium: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_premium_status', { p_is_premium: isPremium });
  if (error) {
    console.warn('[subscriptionClient] syncPremiumStatus falló (no bloqueante):', error.message);
  }
}
