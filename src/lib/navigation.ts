import { useRouter } from 'expo-router';

/**
 * router.back() sin guarda revienta con "GO_BACK no manejado" si se llega a la
 * pantalla actual sin historial propio -- recarga de la pestaña web estando ya
 * ahí, o un deep link directo, no solo el flujo normal push-desde-tabs. Sin
 * historial, la raíz de tabs es el destino razonable.
 */
export function goBackOrHome(router: ReturnType<typeof useRouter>) {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace('/(tabs)');
  }
}
