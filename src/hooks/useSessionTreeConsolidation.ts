import { useCallback, useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { consolidateSessionTree } from '../api/tasteEngineClient';
import { useSessionTreeStore } from '../state/sessionTreeStore';

/**
 * Cierre de "sesión de árbol" (más fino que sessionFilterStore.resolvedThisSession, que dura
 * todo el proceso de JS -- ver comentario en sessionTreeStore.ts): definición confirmada con
 * el usuario 2026-08-30.
 *   - Trigger primario: salir de la pestaña Swipe (foco perdido).
 *   - Trigger secundario: backgrounding prolongado MIENTRAS sigue en Swipe (no cuenta un
 *     vistazo rápido a notificaciones -- solo si pasa BACKGROUND_CONSOLIDATE_DELAY_MS
 *     todavía en background).
 *   - Agotar el deck NO cuenta solo como cierre de sesión.
 *   - Mínimo de actividad: al menos 1 swipe (acumulador no vacío) -- si no hubo ninguno, no
 *     se consolida nada (nada que decir, y evita una escritura remota vacía).
 * Se monta una sola vez, desde app/(tabs)/index.tsx (la pantalla de Swipe).
 */
const BACKGROUND_CONSOLIDATE_DELAY_MS = 5 * 60 * 1000;

export function useSessionTreeConsolidation() {
  const backgroundTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const consolidateAndReset = useCallback(() => {
    const { accumulator, resetAccumulator } = useSessionTreeStore.getState();
    if (Object.keys(accumulator).length === 0) return; // sin actividad, nada que consolidar
    consolidateSessionTree(accumulator).catch(() => {});
    resetAccumulator();
  }, []);

  useFocusEffect(
    useCallback(() => {
      // Ganó foco (entró o volvió a Swipe): nada que hacer acá, solo se arma la
      // suscripción de AppState para el trigger secundario mientras esté enfocado.
      const handleAppStateChange = (nextState: AppStateStatus) => {
        if (nextState === 'background') {
          backgroundTimer.current = setTimeout(consolidateAndReset, BACKGROUND_CONSOLIDATE_DELAY_MS);
        } else if (nextState === 'active' && backgroundTimer.current) {
          // Volvió antes del umbral -- fue un vistazo rápido, no un cierre de sesión real.
          clearTimeout(backgroundTimer.current);
          backgroundTimer.current = null;
        }
      };
      const subscription = AppState.addEventListener('change', handleAppStateChange);

      // Perdió foco (trigger primario: salió de Swipe) -- cleanup de useFocusEffect.
      return () => {
        subscription.remove();
        if (backgroundTimer.current) {
          clearTimeout(backgroundTimer.current);
          backgroundTimer.current = null;
        }
        consolidateAndReset();
      };
    }, [consolidateAndReset])
  );

  // Por si el componente se desmonta del todo (ej. cierre real de la app) sin pasar por el
  // blur de arriba -- red de seguridad, no el camino principal.
  useEffect(() => {
    return () => consolidateAndReset();
  }, [consolidateAndReset]);
}
