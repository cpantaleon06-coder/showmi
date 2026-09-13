import { Platform } from 'react-native';

/**
 * Forma mínima de un store de zustand con el middleware `persist` aplicado. Se declara acá en
 * vez de importar los tipos genéricos de zustand/persist para que esta utilidad no tenga que
 * conocer la forma del estado de cada store -- lo único que necesita es poder rehidratar.
 */
interface RehydratableStore {
  persist: { rehydrate: () => void | Promise<void> };
}

/**
 * Sincroniza un store persistido entre instancias de la app abiertas a la vez (2026-09-12).
 *
 * EL BUG QUE ARREGLA, medido con dos pestañas abiertas y repro determinista:
 *   1. 3 swipes en la pestaña B -> taste_state 119 claves, Biblioteca 4 canciones
 *   2. UN swipe en la pestaña A -> taste_state 108 claves (-11), Biblioteca 3 (-1)
 *
 * No era que no se guardara: se BORRABA lo ya aprendido. Cada instancia hidrata su estado al
 * cargar, lo mantiene en memoria, y en cada cambio escribe el objeto COMPLETO. La pestaña A
 * llevaba cargada un rato, su copia en memoria estaba vieja, y su primera escritura pisó todo
 * lo que B había aprendido mientras tanto. Con tráfico intercalado, de 10 swipes se
 * registraron 6.
 *
 * El arreglo ataca la causa dominante, que es que una instancia NUNCA vuelve a leer lo que
 * escribió la otra: ahora, cuando otra pestaña escribe esta clave, ésta se rehidrata. El
 * evento `storage` del navegador solo se dispara en las OTRAS pestañas, nunca en la que
 * escribió, así que no hay bucle.
 *
 * LO QUE NO ARREGLA, dicho explícitamente: si las dos instancias escriben dentro del mismo
 * instante (antes de que el evento llegue), una de las dos escrituras sigue perdiéndose. Cerrar
 * esa ventana del todo pide leer-mezclar-escribir en cada `set`, con una semántica de mezcla
 * distinta por store (unión por clave en el perfil de gustos, unión por track en Biblioteca,
 * máximo en el contador de swipes) -- mucho más invasivo, para una ventana de milisegundos.
 *
 * Solo web: en nativo no existen dos instancias de la app compartiendo AsyncStorage, y
 * `window`/`storage` tampoco existen. La guarda de Platform hace que esto sea un no-op ahí.
 */
export function syncAcrossTabs(store: RehydratableStore, storageKey: string): void {
  if (Platform.OS !== 'web') return;
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;

  window.addEventListener('storage', (event: StorageEvent) => {
    // `key === null` = alguien llamó localStorage.clear(); no es un cambio de ESTA clave y
    // rehidratar ahí solo traería un estado vacío antes de tiempo.
    if (event.key !== storageKey) return;
    void store.persist.rehydrate();
  });
}
