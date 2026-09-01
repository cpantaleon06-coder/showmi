import { supabase } from '../lib/supabase';

/**
 * Tres flujos reales de auth, cada uno mapeado a un método distinto de Supabase --
 * mezclarlos (ej. usar signUp en vez de updateUser para "guardar progreso") perdería el
 * auth.uid() actual y con él todo el taste_profile/swipes ya acumulados en la sesión
 * anónima. Ver useAuthBootstrap.ts para el comentario original que ya anticipaba esto
 * ("vincular email/password más adelante no pierde este auth.uid()").
 */

/**
 * Convierte la sesión anónima ACTUAL en una cuenta real con email/password, preservando
 * auth.uid() -- este es el flujo de "guarda tu progreso": todo lo que el usuario ya swipeó/
 * calificó como anónimo sigue siendo suyo después. `updateUser` es el método correcto para
 * esto (no `signUp`, que crearía una identidad nueva separada). Si la confirmación de email
 * está activada en el proyecto de Supabase, esto dispara un correo de verificación -- la
 * sesión sigue siendo válida mientras tanto, no hace falta esperar la confirmación para
 * seguir usando la app.
 */
export async function upgradeAnonymousAccount(email: string, password: string): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.updateUser({ email, password });
  return { error: error?.message ?? null };
}

/**
 * Inicia sesión en una cuenta YA EXISTENTE (de otro dispositivo, o de una reinstalación).
 * A diferencia de upgradeAnonymousAccount, esto REEMPLAZA la sesión actual -- cualquier
 * progreso acumulado en la sesión anónima de ESTE dispositivo queda huérfano (no se
 * fusiona con la cuenta real). Es el comportamiento esperado: son dos identidades
 * distintas hasta este punto, no tiene sentido fusionar datos de un dispositivo nuevo con
 * los de la cuenta real sin que el usuario lo pida explícitamente (fuera de alcance hoy).
 */
export async function signInExistingAccount(email: string, password: string): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return { error: error?.message ?? null };
}

/**
 * Cierra sesión. useAuthBootstrap.ts escucha SIGNED_OUT y crea una sesión anónima nueva de
 * inmediato -- la app nunca se queda sin auth.uid() (ver comentario ahí), así que esto no
 * dejar al usuario "deslogueado" de verdad, solo vuelve a modo invitado.
 */
export async function signOut(): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.signOut();
  return { error: error?.message ?? null };
}

/**
 * Google/Apple -- a diferencia de email (upgradeAnonymousAccount/signInExistingAccount),
 * `signInWithIdToken` SIEMPRE crea o entra a una cuenta nueva, nunca preserva la sesión
 * anónima actual: Supabase no expone un `linkIdentity` equivalente para tokens nativos
 * (`linkIdentity` existe, pero solo para el flujo OAuth por navegador/redirect, no para el
 * idToken que entrega el SDK nativo de Google/Apple). Consecuencia real: usar estos botones
 * abandona el progreso acumulado como invitado en este dispositivo, igual que
 * signInExistingAccount con email -- comportamiento estándar en la mayoría de apps (nadie
 * intenta fusionar datos de invitado con una cuenta real vía OAuth tampoco), pero vale
 * dejarlo documentado porque es distinto del flujo de email de al lado.
 */
export async function signInWithGoogleIdToken(idToken: string): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: idToken });
  return { error: error?.message ?? null };
}

export async function signInWithAppleIdToken(identityToken: string): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.signInWithIdToken({ provider: 'apple', token: identityToken });
  return { error: error?.message ?? null };
}
