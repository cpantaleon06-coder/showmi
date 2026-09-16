import { useCallback, useEffect, useRef, useState } from 'react';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

import {
  SPOTIFY_DISCOVERY,
  SPOTIFY_SCOPES,
  exportCollectionToSpotify,
  ExportResult,
  NoMatchesError,
} from '../api/spotifyExport';

// Cierra la ventana del navegador y entrega el resultado a la app cuando vuelve el redirect.
// Va a nivel de módulo, como pide expo-auth-session.
WebBrowser.maybeCompleteAuthSession();

// El Client ID de Spotify es PÚBLICO por diseño (a diferencia del Secret, que vive solo en la
// Edge Function). Se lee de env EXPO_PUBLIC_* -> horneado en el build. Si no está, la función
// de export se anuncia como no disponible en vez de romper.
const CLIENT_ID = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID;

// showmi://spotify-auth en build nativa. DEBE estar registrado igual en el dashboard de
// Spotify (Settings -> Redirect URIs), o Spotify rechaza la autorización.
const redirectUri = AuthSession.makeRedirectUri({ scheme: 'showmi', path: 'spotify-auth' });

export type ExportStatus =
  | 'idle'
  | 'authorizing'
  | 'resolviendo'
  | 'creando'
  | 'agregando'
  | 'done'
  | 'error'
  | 'nomatches';

interface TrackRef {
  artist: string;
  title: string;
}
interface Pending {
  name: string;
  description: string;
  tracks: TrackRef[];
}

/**
 * Flujo completo de export a Spotify: login OAuth (Authorization Code + PKCE, sin secret en el
 * dispositivo) -> intercambio del código por token -> crear playlist y empujar las canciones
 * (ver spotifyExport.ts). Devuelve una máquina de estados chica para que la UI muestre el
 * progreso sin conocer los detalles del flujo.
 *
 * El payload a exportar se guarda en un ref porque el resultado del OAuth llega de forma
 * asíncrona por el efecto sobre `response`, no en la llamada a `start`.
 */
export function useSpotifyExport() {
  const available = !!CLIENT_ID;
  const [status, setStatus] = useState<ExportStatus>('idle');
  const [result, setResult] = useState<ExportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pendingRef = useRef<Pending | null>(null);

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: CLIENT_ID ?? '',
      scopes: SPOTIFY_SCOPES,
      usePKCE: true,
      redirectUri,
      responseType: AuthSession.ResponseType.Code,
    },
    SPOTIFY_DISCOVERY,
  );

  useEffect(() => {
    if (!response) return;

    if (response.type === 'error') {
      setStatus('error');
      setError(response.error?.message ?? 'La autorización de Spotify falló');
      pendingRef.current = null;
      return;
    }
    // dismiss / cancel: el usuario cerró la ventana. Volver a idle sin ruido.
    if (response.type !== 'success') {
      setStatus((s) => (s === 'authorizing' ? 'idle' : s));
      pendingRef.current = null;
      return;
    }

    const code = response.params.code;
    const pending = pendingRef.current;
    const verifier = request?.codeVerifier;
    if (!code || !pending || !verifier) {
      setStatus('error');
      setError('No llegó el código de autorización');
      pendingRef.current = null;
      return;
    }

    (async () => {
      try {
        const token = await AuthSession.exchangeCodeAsync(
          {
            clientId: CLIENT_ID as string,
            code,
            redirectUri,
            extraParams: { code_verifier: verifier },
          },
          SPOTIFY_DISCOVERY,
        );
        const res = await exportCollectionToSpotify(
          token.accessToken,
          pending,
          (stage) => setStatus(stage),
        );
        setResult(res);
        setStatus('done');
      } catch (e) {
        if (e instanceof NoMatchesError) {
          setStatus('nomatches');
        } else {
          setStatus('error');
          setError(e instanceof Error ? e.message : 'El export falló');
        }
      } finally {
        pendingRef.current = null;
      }
    })();
    // Solo reacciona al cambio de `response`; el resto son estables o refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [response]);

  const start = useCallback(
    (name: string, description: string, tracks: TrackRef[]) => {
      if (!available) {
        setStatus('error');
        setError('Spotify no está configurado en esta build');
        return;
      }
      if (!request) return; // el request de auth aún no está listo
      setResult(null);
      setError(null);
      setStatus('authorizing');
      pendingRef.current = { name, description, tracks };
      promptAsync();
    },
    [available, request, promptAsync],
  );

  const reset = useCallback(() => {
    setStatus('idle');
    setResult(null);
    setError(null);
    pendingRef.current = null;
  }, []);

  return { available, ready: !!request, status, result, error, start, reset };
}
