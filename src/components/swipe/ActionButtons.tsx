import { Pressable, StyleSheet, Text, View } from 'react-native';
import { HeartIcon, XIcon } from 'phosphor-react-native';

import { ThemeColors } from '../../theme/colors';
import { fonts } from '../../theme/typography';

interface ActionButtonsProps {
  colors: ThemeColors;
  /** Color reactivo de vibra de sesión (ver SwipeDeck.tsx) -- reemplaza colors.brand en el
   *  botón central. */
  accentColor: string;
  onPass: () => void;
  onLike: () => void;
  onHeard: () => void;
}

export function ActionButtons({ colors, accentColor, onPass, onLike, onHeard }: ActionButtonsProps) {
  return (
    <View style={styles.row}>
      <Pressable
        onPress={onPass}
        style={[styles.button, styles.sideButton, { borderColor: colors.pass }]}
        hitSlop={8}
      >
        <XIcon weight="fill" size={22} color={colors.pass} />
      </Pressable>

      <Pressable
        onPress={onHeard}
        style={[styles.button, styles.centerButton, { borderColor: accentColor, backgroundColor: accentColor }]}
        hitSlop={8}
      >
        <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>YA LA ESCUCHÉ</Text>
      </Pressable>

      <Pressable
        onPress={onLike}
        style={[styles.button, styles.sideButton, { borderColor: colors.like }]}
        hitSlop={8}
      >
        <HeartIcon weight="fill" size={22} color={colors.like} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  button: {
    borderWidth: 3,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideButton: {
    flex: 1,
  },
  centerButton: {
    flex: 1.3,
  },
  buttonText: {
    fontSize: 13,
    letterSpacing: 0.4,
    fontFamily: fonts.bodyExtraBold,
  },
});
