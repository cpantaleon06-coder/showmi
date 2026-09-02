import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { Mascot } from '../camerino/Mascot';
import { useCamerinoStore, visibleEquipped } from '../../state/camerinoStore';
import { useSubscriptionStore } from '../../state/subscriptionStore';
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
 * 2026-09-01: el círculo de avatar dejó de ser un placeholder -- ahora muestra
 * la mascota real con lo que la persona tenga equipado (ver Camerino). El aro
 * translúcido se conserva como marco para que la mascota se despegue del
 * degradado, que de otro modo le compite al contorno.
 */
export function NagaiHeader({ colors, title }: NagaiHeaderProps) {
  const equipped = useCamerinoStore((s) => s.equipped);
  const isPremium = useSubscriptionStore((s) => s.isPremium);

  return (
    <LinearGradient
      colors={colors.nagaiGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.header}
    >
      <Text style={styles.title}>{title}</Text>
      <View style={styles.avatarFrame}>
        <Mascot colors={colors} equipped={visibleEquipped(equipped, isPremium)} size={78} />
      </View>
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
  avatarFrame: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.6)',
  },
});
