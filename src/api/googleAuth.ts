import { GoogleSignin } from '@react-native-google-signin/google-signin';

let configured = false;

/**
 * `configure()` solo necesita llamarse una vez por proceso -- se hace perezoso (recién en
 * el primer intento real de sign-in) en vez de en el arranque de la app, porque
 * `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` puede estar vacío todavía (pendiente de que exista un
 * proyecto real en Google Cloud Console) y no tiene sentido configurar el SDK con un client
 * ID vacío antes de que alguien realmente toque el botón de Google.
 */
function ensureConfigured() {
  if (configured) return;
  GoogleSignin.configure({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  });
  configured = true;
}

/**
 * Flujo nativo (no redirect/browser) -- devuelve el idToken que authClient.ts pasa a
 * `supabase.auth.signInWithIdToken`. `null` si el usuario canceló el picker de cuentas de
 * Google, nunca una excepción por cancelar (eso sí sería un error real de UX).
 */
export async function getGoogleIdToken(): Promise<string | null> {
  ensureConfigured();
  await GoogleSignin.hasPlayServices();
  const response = await GoogleSignin.signIn();
  if (response.type === 'cancelled') return null;
  return response.data.idToken;
}
