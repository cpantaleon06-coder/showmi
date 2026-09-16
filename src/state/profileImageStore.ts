import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { olvidarImagen } from '../lib/imagenPerfil';

/**
 * Foto de perfil y portada elegidas por la persona.
 *
 * SOLO GUARDA RUTAS, nunca la imagen. Los archivos viven en el directorio de documentos de la
 * app (ver lib/imagenPerfil.ts) y acá queda una cadena de texto. La alternativa -- meter la
 * imagen en base64 en AsyncStorage -- comparte presupuesto con todo lo demás que este proyecto
 * persiste (swipes, biblioteca, perfil de gustos) y en Android ese presupuesto es de unos pocos
 * megas para TODO: dos fotos podrían dejar sin sitio al historial de swipes, que sí es
 * irreemplazable.
 *
 * ES LOCAL, NO VIAJA. Quien reinstale la app o entre desde otro teléfono no ve su foto. Para
 * que viajara habría que subirla a Supabase Storage, lo que pide un bucket con sus políticas y
 * columnas nuevas en `users`; está bien planteado hacerlo, pero no se hizo acá. Vale la pena
 * saberlo antes de prometer en ningún sitio que la foto "es de tu cuenta": hoy es de este
 * teléfono.
 */
interface ProfileImageState {
  /** Ruta de la foto de perfil, o null para usar el wordmark. */
  avatarUri: string | null;
  /** Ruta de la portada, o null para usar el degradado de marca. */
  portadaUri: string | null;
  setAvatar: (uri: string | null) => void;
  setPortada: (uri: string | null) => void;
}

export const useProfileImageStore = create<ProfileImageState>()(
  persist(
    (set, get) => ({
      avatarUri: null,
      portadaUri: null,

      // Los dos borran el archivo ANTERIOR antes de apuntar al nuevo. Sin esto, cada cambio de
      // foto dejaría el archivo viejo en el teléfono para siempre, sin nada que lo referencie
      // -- una fuga de almacenamiento silenciosa que solo crece.
      setAvatar: (uri) => {
        const previo = get().avatarUri;
        if (previo && previo !== uri) olvidarImagen(previo);
        set({ avatarUri: uri });
      },
      setPortada: (uri) => {
        const previo = get().portadaUri;
        if (previo && previo !== uri) olvidarImagen(previo);
        set({ portadaUri: uri });
      },
    }),
    { name: 'profile-images', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
