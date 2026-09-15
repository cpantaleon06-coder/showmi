// Supabase Edge Function: webhook de RevenueCat -> public.users.es_premium (2026-09-15)
//
// POR QUÉ EXISTE
// -------------
// `es_premium` es la copia server-side del entitlement de RevenueCat: existe para que el Feed
// pueda mostrar la insignia de More de otras personas (get_feed_posts no puede ver el
// CustomerInfo de nadie más). Hasta ahora lo escribía el propio cliente
// (`set_premium_status`, ver src/api/subscriptionClient.ts), que ya venía marcado ahí como
// "robustez consciente, endurecerlo es trabajo futuro". Esto es ese trabajo.
//
// Con el webhook, la única fuente de verdad de `es_premium` pasa a ser RevenueCat, que es
// quien de verdad sabe si hubo una compra, y la escritura la hace el servidor con
// service_role. Es además el requisito previo para poder mover el tope diario de swipes al
// servidor: sin esto, esa comprobación leería un valor que el cliente controla.
//
// El mapeo es directo, sin tabla intermedia: la app configura RevenueCat con el uuid de
// Supabase como appUserID (ver configureRevenueCat en src/lib/revenuecat.ts), así que el
// `app_user_id` del evento ES el `users.id`.
//
// DESPLIEGUE
// ----------
//   1. supabase functions deploy revenuecat-webhook --no-verify-jwt
//      Va SIN verify_jwt a propósito: quien llama es RevenueCat, no un usuario de Supabase, y
//      no tiene ningún JWT nuestro. La autenticación es el header compartido de abajo -- por
//      eso ese header NO es opcional acá (a diferencia de CRON_SECRET en los jobs de cron,
//      que falla abierto para no romper el cron a media migración). Sin el secreto
//      configurado, esta función rechaza TODO.
//   2. supabase secrets set REVENUECAT_WEBHOOK_SECRET=<algo largo y aleatorio>
//   3. En RevenueCat: Project settings -> Integrations -> Webhooks
//        URL:                 https://wdgjdgsxmwgsqrrngxyp.supabase.co/functions/v1/revenuecat-webhook
//        Authorization header: el MISMO valor del paso 2
//   4. Recién ENTONCES, quitarle a los clientes el permiso de llamar a set_premium_status.
//      En ese orden: si se revoca antes, nadie escribe es_premium y la insignia desaparece
//      para quien sí pagó. El SQL está en local/ (fuera de git, ver .gitignore).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

/** Debe calzar con el entitlement configurado en RevenueCat (ver src/lib/revenuecat.ts). */
const ENTITLEMENT = 'showmi_more';

/**
 * Eventos que revocan el acceso pase lo que pase.
 *
 * CANCELLATION NO está en la lista, y es el error clásico: en RevenueCat "cancelación"
 * significa que la persona apagó la renovación automática, no que perdió el acceso -- lo
 * conserva hasta que venza lo que ya pagó. Revocar ahí sería quitarle a alguien algo que
 * todavía está pagando.
 */
const EVENTOS_QUE_REVOCAN = new Set(['EXPIRATION', 'SUBSCRIPTION_PAUSED', 'TRANSFER']);

interface RevenueCatEvent {
  type?: string;
  app_user_id?: string;
  original_app_user_id?: string;
  entitlement_ids?: string[] | null;
  entitlement_id?: string | null;
  expiration_at_ms?: number | null;
}

const JSON_HEADERS = { 'Content-Type': 'application/json' };

/**
 * Comparación en tiempo constante. Con `===` sobre strings, el tiempo de respuesta depende de
 * cuántos caracteres coinciden desde el principio, y eso deja adivinar el secreto byte por
 * byte con suficientes intentos. Es barato no dar esa pista.
 */
function igualSinFiltrarTiempo(a: string, b: string): boolean {
  const ba = new TextEncoder().encode(a);
  const bb = new TextEncoder().encode(b);
  if (ba.length !== bb.length) return false;
  let dif = 0;
  for (let i = 0; i < ba.length; i++) dif |= ba[i] ^ bb[i];
  return dif === 0;
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: JSON_HEADERS });
  }

  const secret = Deno.env.get('REVENUECAT_WEBHOOK_SECRET');
  if (!secret) {
    // Falla CERRADO: sin secreto no hay forma de distinguir a RevenueCat de cualquiera, y esta
    // función escribe el flag de pago. Mejor caída ruidosa que puerta abierta.
    return new Response(JSON.stringify({ error: 'REVENUECAT_WEBHOOK_SECRET no configurado' }), {
      status: 500,
      headers: JSON_HEADERS,
    });
  }

  const auth = req.headers.get('authorization') ?? '';
  if (!igualSinFiltrarTiempo(auth, secret)) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401, headers: JSON_HEADERS });
  }

  let payload: { event?: RevenueCatEvent };
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Body inválido' }), { status: 400, headers: JSON_HEADERS });
  }

  const evento = payload.event;
  const userId = evento?.app_user_id ?? evento?.original_app_user_id;
  if (!evento || !userId) {
    return new Response(JSON.stringify({ error: 'Falta event.app_user_id' }), { status: 400, headers: JSON_HEADERS });
  }

  // Un appUserID anónimo de RevenueCat ($RCAnonymousID:...) aparece cuando el SDK se configuró
  // antes de tener sesión. No es un uuid de Supabase y no hay a quién aplicarle esto: se
  // responde 200 igual para que RevenueCat no lo reintente en bucle -- no es un fallo suyo.
  const ES_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!ES_UUID.test(userId)) {
    return new Response(JSON.stringify({ ok: true, skipped: 'app_user_id no es un uuid de Supabase' }), {
      headers: JSON_HEADERS,
    });
  }

  const entitlements = evento.entitlement_ids ?? (evento.entitlement_id ? [evento.entitlement_id] : []);
  const tieneEntitlement = entitlements.includes(ENTITLEMENT);
  // expiration_at_ms ausente/null = compra de por vida ($rc_lifetime, que Showmi sí vende):
  // sin fecha de vencimiento no hay nada que comparar y el acceso simplemente no caduca.
  const vigente = evento.expiration_at_ms == null || evento.expiration_at_ms > Date.now();

  const esPremium = !EVENTOS_QUE_REVOCAN.has(evento.type ?? '') && tieneEntitlement && vigente;

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Faltan los secrets de Supabase' }), { status: 500, headers: JSON_HEADERS });
  }

  // Service role: `es_premium` no es escribible por los clientes, justo para que esta sea la
  // única puerta.
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { error } = await supabase.from('users').update({ es_premium: esPremium }).eq('id', userId);

  if (error) {
    // 500 a propósito: RevenueCat reintenta los webhooks que fallan, y este es un caso donde
    // reintentar es exactamente lo correcto -- el evento es válido, lo que falló es la base.
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: JSON_HEADERS });
  }

  return new Response(JSON.stringify({ ok: true, user_id: userId, es_premium: esPremium, event: evento.type }), {
    headers: JSON_HEADERS,
  });
});
