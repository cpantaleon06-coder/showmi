import { useEffect } from 'react';

import { supabase } from '../lib/supabase';
import { useAuthStore } from '../state/authStore';

/**
 * Login/auth real, modo invitado: cada usuario obtiene sesión anónima real
 * (auth.uid() válido, RLS funciona) desde que abre la app la primera vez, sin
 * pantalla de login -- misma filosofía de "sin fricción" que ya establecimos
 * para Spotify. La sesión persiste en AsyncStorage (ver src/lib/supabase.ts),
 * así que esto solo crea una cuenta anónima nueva la primera vez de verdad,
 * no en cada apertura de la app. Vincular email/password más adelante (desde
 * Perfil) no pierde este auth.uid() -- Supabase solo agrega la identidad.
 */
export function useAuthBootstrap() {
  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        if (!cancelled) {
          useAuthStore.getState().setSession(session);
          useAuthStore.getState().setReady(true);
        }
        return;
      }

      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) {
        // No hay nada mejor que hacer sin sesión -- swipes/posts fallarían
        // igual, pero la UI local (deck, biblioteca) sigue funcionando.
        console.warn('[auth] signInAnonymously falló:', error.message);
      }
      if (!cancelled) {
        useAuthStore.getState().setSession(data?.session ?? null);
        useAuthStore.getState().setReady(true);
      }
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      useAuthStore.getState().setSession(session);
    });

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, []);
}
