import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { File, Paths } from 'expo-file-system';

/**
 * Elegir una imagen de la galería y dejarla en un sitio del que no se vaya a evaporar.
 *
 * EL PASO QUE PARECE DE MÁS Y NO LO ES: `launchImageLibraryAsync` no devuelve la ruta original
 * de la foto; devuelve una COPIA en el directorio de caché de la app. Y la caché es, por
 * definición, lo primero que el sistema borra cuando al teléfono le falta espacio. Guardar esa
 * URI tal cual deja una foto de perfil que funciona durante semanas y un día desaparece sola,
 * sin que nadie haya tocado nada -- el peor tipo de fallo, porque no hay nada que reproducir.
 * Por eso se copia a `Paths.document`, que es el directorio que el sistema respeta.
 *
 * EN WEB NO SE COPIA. `expo-file-system` en web es un stub sin métodos (comprobado en sus
 * propias declaraciones: la clase base web no expone `copy` ni `delete`), así que ahí se
 * devuelve la URI que da el selector. Web es el banco de pruebas de este proyecto, no un
 * destino de entrega -- la app se entrega como APK.
 *
 * El nombre lleva la marca de tiempo a propósito. Sin ella, la imagen nueva se escribiría sobre
 * la vieja en la misma ruta, y tanto `<Image>` de React Native como la capa de caché del
 * sistema seguirían enseñando la anterior: misma URI, luego nada que recargar. Con el sufijo,
 * cada elección es un archivo distinto y se ve al instante.
 */
async function elegirYGuardar(
  nombre: string,
  aspecto: [number, number],
): Promise<string | null> {
  const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permiso.granted) return null;

  const resultado = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    // Recorte en el propio selector, con la proporción exacta del hueco donde va a acabar. Sin
    // esto, una foto vertical metida en la portada apaisada se recorta sola por el centro y casi
    // nunca por donde la persona habría elegido.
    allowsEditing: true,
    aspect: aspecto,
    // 0.8 y no 1: a los tamaños a los que se enseñan estas imágenes (116x150 y el ancho de la
    // pantalla) la diferencia no se ve, y al máximo una foto de móvil moderno son varios megas
    // que se quedarían ocupando el almacenamiento del teléfono para siempre.
    quality: 0.8,
  });

  if (resultado.canceled || !resultado.assets?.[0]) return null;
  const origen = resultado.assets[0].uri;

  if (Platform.OS === 'web') return origen;

  try {
    const destino = new File(Paths.document, `${nombre}-${Date.now()}.jpg`);
    await new File(origen).copy(destino);
    return destino.uri;
  } catch {
    // Si la copia falla (sin espacio, permisos raros), la URI de caché sigue siendo utilizable
    // hoy. Es peor que la copia, pero mucho mejor que devolver null y que la elección de la
    // persona se pierda sin explicación.
    return origen;
  }
}

/** Foto de perfil. Cuadrada: es lo que espera un avatar y evita recortes sorpresa. */
export function elegirFotoPerfil(): Promise<string | null> {
  return elegirYGuardar('avatar', [1, 1]);
}

/** Imagen de portada. 16:7, la proporción del telón donde acaba. */
export function elegirPortada(): Promise<string | null> {
  return elegirYGuardar('portada', [16, 7]);
}

/**
 * Borra una imagen que hayamos copiado nosotros.
 *
 * Solo toca archivos DENTRO del directorio de documentos de la app: la URI que llega podría ser
 * la de la galería del teléfono (cuando la copia falló y se guardó el origen), y borrar ahí
 * sería borrarle a alguien su foto de verdad. Lo peor que puede pasar por no borrar es dejar un
 * archivo huérfano de unos kilobytes.
 */
export function olvidarImagen(uri: string | null): void {
  if (!uri || Platform.OS === 'web') return;
  if (!uri.startsWith(Paths.document.uri)) return;
  try {
    const archivo = new File(uri);
    if (archivo.exists) archivo.delete();
  } catch {
    // Un archivo que no se deja borrar no es motivo para que falle cambiar de foto.
  }
}
