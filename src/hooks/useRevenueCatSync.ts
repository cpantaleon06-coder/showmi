import { useEffect } from 'react';

import { syncPremiumStatus } from '../api/subscriptionClient';
import { addCustomerInfoListener, configureRevenueCat, fetchCustomerInfo, isPremiumFromCustomerInfo } from '../lib/revenuecat';
import { useSubscriptionStore } from '../state/subscriptionStore';

/**
 * Conecta RevenueCat con el resto de la app -- se monta una sola vez en app/_layout.tsx, igual
 * que useAuthBootstrap. Espera a tener un auth.uid() real (aunque sea anónimo, ver
 * useAuthBootstrap.ts) antes de configurar el SDK: el mismo id de Supabase se usa como
 * appUserID de RevenueCat (ver configureRevenueCat), así que configurar antes de tener uno
 * dejaría el SDK con un id anónimo propio de RevenueCat, desconectado del usuario real.
 *
 * Sin keys reales configuradas todavía (.env vacío) o en web, todo acá es un no-op silencioso
 * -- ver isRevenueCatConfigured en revenuecat.ts -- así que isPremium se queda en false
 * (modo gratuito) en vez de romper nada.
 */
export function useRevenueCatSync(userId: string | undefined) {
  useEffect(() => {
    if (!userId) return;

    configureRevenueCat(userId);

    const applyCustomerInfo = (info: Parameters<typeof isPremiumFromCustomerInfo>[0]) => {
      const isPremium = isPremiumFromCustomerInfo(info);
      useSubscriptionStore.getState().setPremium(isPremium);
      syncPremiumStatus(isPremium).catch(() => {});
    };

    fetchCustomerInfo().then((info) => {
      if (info) applyCustomerInfo(info);
    });

    const unsubscribe = addCustomerInfoListener(applyCustomerInfo);
    return unsubscribe;
  }, [userId]);
}
