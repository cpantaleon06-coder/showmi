const { withProjectBuildGradle } = require('expo/config-plugins');

/**
 * Fija `play-services-ads` a una version compilada con Kotlin 2.1 (2026-09-13).
 *
 * EL PROBLEMA. El build de Android moria en :react-native-google-mobile-ads:compileReleaseKotlin
 * con 19 errores de este tipo:
 *
 *   e: play-services-ads-25.4.0-api.jar!/META-INF/....kotlin_module
 *      Module was compiled with an incompatible version of Kotlin.
 *      The binary version of its metadata is 2.3.0, expected version is 2.1.0.
 *
 * No es un bug de react-native-google-mobile-ads: el play-services-ads que arrastra viene
 * compilado POR GOOGLE con un Kotlin mas nuevo que el que usa Expo SDK 57, y un compilador no
 * puede leer metadatos de una version posterior a la suya.
 *
 * QUE SE DESCARTO, y por que, para que nadie repita el camino:
 *
 *   - Subir el proyecto a Kotlin 2.3.0 con expo-build-properties. Se PROBO en un build real y
 *     salio peor: el plugin de Kotlin subio a 2.3.0 pero el compilador siguio esperando
 *     metadatos 2.1.0 (algo fija languageVersion mas abajo), asi que el error de AdMob quedo
 *     igual Y ADEMAS reventó react-native-purchases-ui con un crash del type checker
 *     ("source must not be null"). De dos fallos a... dos fallos, uno nuevo.
 *
 *   - Bajar react-native-google-mobile-ads a 16.3.4, que fija play-services-ads 25.0.0. Se
 *     verifico descargando el AAR y leyendo la cabecera de sus .kotlin_module: 25.0.0 trae
 *     metadatos 2.2.0, tambien demasiado nuevo. Habria fallado igual.
 *
 *   - Bajar a 16.0.0, la ultima que fija un SDK 24.x. Es de octubre de 2025, meses anterior a
 *     React Native 0.86: cambiar una incompatibilidad por otra.
 *
 * LO QUE SI: se deja la libreria en su ultima version (la unica que soporta RN 0.86) y se
 * fuerza el SDK de Google a 24.7.0. Versiones verificadas leyendo los AAR de Google:
 *
 *     24.6.0 -> metadatos 2.1.0   OK
 *     24.7.0 -> metadatos 2.1.0   OK   <- la elegida, la mas nueva compatible
 *     25.0.0 -> metadatos 2.2.0   falla
 *     25.4.0 -> metadatos 2.3.0   falla (la que venia por defecto)
 *
 * CUANDO QUITAR ESTO: en cuanto Expo suba su Kotlin a 2.3+, o Google publique un
 * play-services-ads compilado con 2.1. Comprobarlo es releer la cabecera de un .kotlin_module
 * del AAR; si ya calza, este plugin sobra y hay que borrarlo -- dejar un `force` viejo
 * escondido es peor que no tenerlo.
 */
const ADS_SDK_VERSION = '24.7.0';

const BLOCK = `
// Insertado por plugins/withAdsSdkPin.js -- ver ese archivo para el porque completo.
// play-services-ads 25.x viene compilado con Kotlin 2.2/2.3 y Expo SDK 57 compila con 2.1,
// que no puede leer metadatos posteriores. 24.7.0 es la mas nueva con metadatos 2.1.
allprojects {
  configurations.all {
    resolutionStrategy {
      force 'com.google.android.gms:play-services-ads:${ADS_SDK_VERSION}'
    }
  }
}
`;

const MARKER = 'plugins/withAdsSdkPin.js';

module.exports = function withAdsSdkPin(config) {
  return withProjectBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') {
      throw new Error(
        'withAdsSdkPin: se esperaba un build.gradle en Groovy y llego ' + cfg.modResults.language,
      );
    }
    // Idempotente: prebuild puede correr varias veces sobre el mismo archivo.
    if (cfg.modResults.contents.includes(MARKER)) return cfg;

    // Se AÑADE al final en vez de editar un bloque existente: no hay regex que pueda
    // equivocarse, y un `allprojects` extra es valido en Groovy -- Gradle los acumula.
    cfg.modResults.contents += BLOCK;
    return cfg;
  });
};
