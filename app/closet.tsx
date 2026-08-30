import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useThemeStore } from '../src/theme/useThemeStore';
import { fonts } from '../src/theme/typography';
import { NagaiHeader } from '../src/components/ui/NagaiHeader';
import { BackButton } from '../src/components/ui/BackButton';

export default function ClosetScreen() {
  const colors = useThemeStore((s) => s.colors);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <NagaiHeader colors={colors} title="Camerino" />
      <BackButton colors={colors} />

      <View style={styles.content}>
        <Text style={[styles.note, { color: colors.textSecondary }]}>
          Tu mascota y sus cosméticos llegan en la siguiente fase.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 40,
  },
  note: {
    fontSize: 14,
    textAlign: 'center',
    fontFamily: fonts.bodyRegular,
  },
});
