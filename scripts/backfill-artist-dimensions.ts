/**
 * Reescribe las dimensiones `artista:` de los swipes YA registrados con el split de
 * colaboraciones (2026-09-14, ver `splitArtists` en src/api/normalize.ts).
 *
 * Por qué se puede reescribir en vez de purgar, como sí hubo que hacer con los `genero:`
 * crudos en la migración v0->v1 del store local: `track_catalog.artist` conserva el string
 * ORIGINAL de iTunes ("Romeo Santos & Prince Royce"), así que las claves correctas se
 * recalculan desde la fuente en vez de adivinarse desde la clave ya normalizada -- donde los
 * separadores ya no existen y "romeo santos prince royce" es irrecuperable.
 *
 * Idempotente: borra TODAS las filas `artista:%` de cada swipe cubierto y las vuelve a
 * insertar. Correrlo dos veces da el mismo resultado.
 *
 * Deja un respaldo (swipe_dimensions_backup_<fecha>) antes de tocar nada.
 *
 * Uso:
 *   SUPABASE_ACCESS_TOKEN=... npx tsx scripts/backfill-artist-dimensions.ts [--apply]
 * Sin --apply solo reporta qué cambiaría.
 */
import { splitArtists } from '../src/api/normalize';

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF ?? 'wdgjdgsxmwgsqrrngxyp';
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
/** Mismo peso total que DEFAULT_WEIGHTS.artist en src/lib/tasteEngine.ts. */
const ARTIST_WEIGHT = 0.45;
const APPLY = process.argv.includes('--apply');

if (!TOKEN) throw new Error('Falta SUPABASE_ACCESS_TOKEN');

async function q<T = any>(sql: string): Promise<T[]> {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${body}`);
  return JSON.parse(body);
}

const lit = (s: string) => `'${s.replace(/'/g, "''")}'`;

async function main() {
  const rows = await q<{ id: string; artist: string }>(
    `select s.id, c.artist from swipes s join track_catalog c on c.track_id = s.track_id order by s.id;`,
  );
  const actuales = await q<{ swipe_id: string; dim_key: string }>(
    `select swipe_id, dim_key from swipe_dimensions where dim_key like 'artista:%';`,
  );
  const previas = new Map<string, string[]>();
  for (const r of actuales) previas.set(r.swipe_id, [...(previas.get(r.swipe_id) ?? []), r.dim_key]);

  let cambiados = 0;
  const values: string[] = [];
  const idsTocados: string[] = [];

  for (const row of rows) {
    const artistIds = splitArtists(row.artist ?? '');
    if (artistIds.length === 0) continue;
    const nuevas = artistIds.map((a) => `artista:${a}`);
    const antes = (previas.get(row.id) ?? []).slice().sort().join('|');
    if (antes === nuevas.slice().sort().join('|')) continue;

    cambiados++;
    idsTocados.push(row.id);
    const w = ARTIST_WEIGHT / artistIds.length;
    for (const key of nuevas) values.push(`(${lit(row.id)}::uuid, ${lit(key)}, ${w})`);
    if (cambiados <= 12) console.log(`  ${row.artist}\n    antes: ${antes || '(ninguna)'}\n    ahora: ${nuevas.join('|')}`);
  }

  console.log(`\nswipes con catálogo: ${rows.length}`);
  console.log(`swipes a corregir:   ${cambiados}`);
  console.log(`filas artista: nuevas ${values.length}`);

  if (!APPLY) {
    console.log('\n(dry-run: nada escrito. Repetir con --apply)');
    return;
  }

  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '_');
  await q(`create table if not exists swipe_dimensions_backup_${stamp} as select * from swipe_dimensions;`);
  console.log(`\nrespaldo: swipe_dimensions_backup_${stamp}`);

  // DELETE + INSERT en UN solo envío: la Management API corre el string completo dentro de
  // una transacción implícita, así que o quedan las dos cosas o ninguna. Separarlos en dos
  // llamadas dejaría una ventana con swipes sin ninguna dimensión de artista.
  //
  // Dos statements y no un CTE que borre e inserte a la vez: ahí el INSERT chocaría con las
  // filas que el propio comando acaba de borrar (semántica de CTE que modifica datos), y
  // ON CONFLICT no puede resolver una fila afectada dos veces por el mismo comando.
  const idList = idsTocados.map((i) => `${lit(i)}::uuid`).join(',');
  await q(`
    delete from swipe_dimensions
    where dim_key like 'artista:%' and swipe_id in (${idList});
    insert into swipe_dimensions (swipe_id, dim_key, weight)
    values ${values.join(',')}
    on conflict (swipe_id, dim_key) do update set weight = excluded.weight;
  `);
  console.log('aplicado.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
