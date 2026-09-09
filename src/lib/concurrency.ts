/**
 * Corre `fn` sobre `items` con como máximo `limit` en vuelo a la vez, preservando el orden
 * del resultado. Equivalente a `Promise.allSettled(items.map(fn))` pero sin disparar todo de
 * golpe.
 *
 * Existe por un bug real (2026-09-08): `fetchCandidatePool` hacía `Promise.allSettled` sobre
 * ~150 búsquedas de iTunes a la vez y Apple respondía 403 a una de cada seis por rate limit
 * (~20 req/min por IP). Esos candidatos se perdían en silencio -- el `.filter` de resultados
 * los descartaba sin distinguir "no hubo match" de "me throttlearon" -- encogiendo el pool y
 * disparando la relajación del filtro duro.
 *
 * Nunca rechaza: cada item resuelve a `{status:'fulfilled'|'rejected'}` igual que allSettled,
 * para que un fallo suelto no tumbe la tanda entera.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results = new Array<PromiseSettledResult<R>>(items.length);
  let cursor = 0;

  async function worker(): Promise<void> {
    for (;;) {
      const i = cursor++;
      if (i >= items.length) return;
      try {
        results[i] = { status: 'fulfilled', value: await fn(items[i], i) };
      } catch (reason) {
        results[i] = { status: 'rejected', reason };
      }
    }
  }

  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker);
  await Promise.all(workers);
  return results;
}
