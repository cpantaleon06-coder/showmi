import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { ThemeColors } from '../../theme/colors';
import { fonts } from '../../theme/typography';

interface NagaiHeaderProps {
  colors: ThemeColors;
  title: string;
}

/**
 * The Hiroshi Nagai / City Pop atmospheric-sunset treatment, reserved for
 * Perfil and Camerino only (see nagaiGradient's doc comment in
 * src/theme/colors.ts) -- this is where the mascot gets shown off, so this
 * is the one place besides selected chips that earns the gradient.
 * The avatar circle here is a placeholder silhouette; it becomes the real
 * mascot + cosmetics once the Camerino system is built.
 */
export function NagaiHeader({ colors, title }: NagaiHeaderProps) {
  return (
    <LinearGradient
      colors={colors.nagaiGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.header}
    >
      <Text style={styles.title}>{title}</Text>
      <View style={styles.avatarPlaceholder} />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: 20,
    paddingBottom: 28,
    alignItems: 'center',
    gap: 16,
  },
  title: {
    fontSize: 20,
    fontFamily: fonts.display,
    color: '#FFFFFF',
  },
  avatarPlaceholder: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.6)',
  },
});
