import { setAudioModeAsync } from 'expo-audio';

/**
 * Sesión de audio de Showmi (2026-09-16).
 *
 * POR QUÉ EXISTE: hasta hoy la app NUNCA llamaba a `setAudioModeAsync`, así que corría con los
 * defaults de expo-audio. Dos de esos defaults son malos para una app de música:
 *
 *   - `interruptionMode: 'mixWithOthers'` (default) significa que Showmi NO pide el foco de
 *     audio: suena ENCIMA de lo que ya estuviera sonando. Si traías Spotify puesto, el preview
 *     de 30s se mezclaba con la canción en curso y no se podía juzgar ninguna de las dos. Y al
 *     no participar del sistema de foco, tampoco se entera de cuándo lo pierde.
 *   - `shouldPlayInBackground: false` ya era el correcto, pero sin declararlo dependía de que
 *     no cambiara el default.
 *
 * `doNotMix` pide foco exclusivo. Es lo que corresponde: swipear música es juzgar UN clip, y
 * dos audios encima hacen esa tarea imposible. Además es lo que hace que el sistema nos pause
 * bien cuando entra una llamada, en vez de dejarnos sonando por debajo.
 *
 * `playsInSilentMode: true` se conserva a propósito (es el default, pero ahora explícito): la
 * persona abrió una app de descubrimiento musical y tocó una carta. Es el mismo criterio que
 * Spotify. Si el interruptor de silencio debiera mandar acá, el producto no tendría sentido.
 *
 * No bloquea el arranque ni rompe nada si falla: sin sesión configurada la app sigue sonando
 * con los defaults, que es exactamente donde estaba antes.
 */
export function configurarAudio(): void {
  setAudioModeAsync({
    interruptionMode: 'doNotMix',
    playsInSilentMode: true,
    shouldPlayInBackground: false,
  }).catch(() => {
    // Silencioso a propósito: es una mejora, no un requisito. Un fallo acá no debe impedir
    // que la app arranque.
  });
}
