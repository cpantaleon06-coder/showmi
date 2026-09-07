import { Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { CaretLeftIcon } from 'phosphor-react-native';

import { ThemeColors } from '../../theme/colors';
import { goBackOrHome } from '../../lib/navigation';

interface BackButtonProps {
  colors: ThemeColors;
}

/**
 * Perfil y Camerino ya no son pestañas -- se llega empujándolas sobre el
 * stack raíz (ver ProfileButton / Perfil -> Camerino), así que necesitan su
 * propio botón de volver: no hay header nativo (headerShown:false en toda
 * la app) que lo dibuje por nosotros.
 *
 * Usa goBackOrHome (ver lib/navigation.ts) en vez de router.back() plano --
 * ver ese archivo para por qué.
 */
export function BackButton({ colors }: BackButtonProps) {
  const router = useRouter();

  return (
    <Pressable onPress={() => goBackOrHome(router)} hitSlop={10} style={styles.button}>
      <CaretLeftIcon weight="light" size={24} color="#FFFFFF" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    top: 16,
    left: 16,
    zIndex: 5,
    padding: 4,
  },
});
