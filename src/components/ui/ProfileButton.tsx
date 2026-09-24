import { Pressable, StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { UserCircleIcon } from 'phosphor-react-native';

import { ThemeColors } from '../../theme/colors';
import { iconSize } from '../../theme/icons';

interface ProfileButtonProps {
  colors: ThemeColors;
  style?: StyleProp<ViewStyle>;
}

/**
 * Perfil dejó de ser pestaña de la barra inferior -- es un ícono de esquina
 * superior derecha, patrón estándar de avatar/perfil, visible en las 3
 * pantallas principales (Swipe/Biblioteca/Feed dibujan su propio contenido,
 * sin header nativo, así que cada una monta este botón por su cuenta).
 */
export function ProfileButton({ colors, style }: ProfileButtonProps) {
  const router = useRouter();

  return (
    <Pressable
      onPress={() => router.push('/profile')}
      hitSlop={10}
      style={[styles.button, style]}
      accessibilityRole="button"
      accessibilityLabel="Perfil"
    >
      {/* 26 -> iconSize.lg (24) al adoptar la escala: dos pixeles menos, imperceptible al lado
          del resto de la cabecera, y deja de ser el unico icono de navegacion con medida propia. */}
      <UserCircleIcon weight="fill" size={iconSize.lg} color={colors.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    padding: 4,
  },
});
