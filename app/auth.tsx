import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useThemeStore } from '../src/theme/useThemeStore';
import { fonts } from '../src/theme/typography';
import { useAuthStore } from '../src/state/authStore';
import { signInExistingAccount, upgradeAnonymousAccount } from '../src/api/authClient';

type Mode = 'upgrade' | 'signin';

/**
 * Pantalla real de auth -- dos modos, dos métodos de Supabase distintos (ver
 * authClient.ts para por qué no se pueden mezclar):
 *  - "Guardar mi progreso" (`upgrade`): convierte la sesión anónima ACTUAL en cuenta real,
 *    preserva auth.uid() y todo lo ya acumulado. Es el modo por default -- a quién le
 *    llega esta pantalla normalmente ya está en modo invitado y quiere no perder lo suyo.
 *  - "Ya tengo cuenta" (`signin`): entra a una cuenta real que ya existía (otro
 *    dispositivo/reinstalación) -- reemplaza la sesión actual, no la fusiona.
 * No hay Google/Apple Sign-In todavía -- necesitan credenciales de desarrollador
 * (Google Cloud / Apple Developer Program) que no existen en este proyecto todavía.
 */
export default function AuthScreen() {
  const colors = useThemeStore((s) => s.colors);
  const router = useRouter();
  const isAnonymous = useAuthStore((s) => s.session?.user.is_anonymous ?? true);

  const [mode, setMode] = useState<Mode>(isAnonymous ? 'upgrade' : 'signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!email.trim() || password.length < 6) {
      setError('Ingresa un email válido y una contraseña de al menos 6 caracteres.');
      return;
    }
    setSubmitting(true);
    setError(null);

    const result =
      mode === 'upgrade'
        ? await upgradeAnonymousAccount(email.trim(), password)
        : await signInExistingAccount(email.trim(), password);

    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.back();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancelar</Text>
        </Pressable>
      </View>

      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          {mode === 'upgrade' ? 'Guarda tu progreso' : 'Inicia sesión'}
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {mode === 'upgrade'
            ? 'Convierte tu cuenta de invitado en una cuenta real -- no pierdes nada de lo que ya swipeaste.'
            : 'Entra a una cuenta que ya tienes de otro dispositivo. Esto reemplaza tu sesión de invitado actual.'}
        </Text>

        <View style={styles.modeRow}>
          <Pressable
            onPress={() => setMode('upgrade')}
            style={[
              styles.modeButton,
              { borderColor: mode === 'upgrade' ? colors.brand : colors.border },
              mode === 'upgrade' && { backgroundColor: colors.brand },
            ]}
          >
            <Text style={[styles.modeButtonText, { color: mode === 'upgrade' ? '#FFFFFF' : colors.textSecondary }]}>
              Crear cuenta
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setMode('signin')}
            style={[
              styles.modeButton,
              { borderColor: mode === 'signin' ? colors.brand : colors.border },
              mode === 'signin' && { backgroundColor: colors.brand },
            ]}
          >
            <Text style={[styles.modeButtonText, { color: mode === 'signin' ? '#FFFFFF' : colors.textSecondary }]}>
              Ya tengo cuenta
            </Text>
          </Pressable>
        </View>

        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          style={[styles.input, { color: colors.textPrimary, borderColor: colors.textPrimary }]}
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Contraseña"
          placeholderTextColor={colors.textSecondary}
          secureTextEntry
          style={[styles.input, { color: colors.textPrimary, borderColor: colors.textPrimary }]}
        />

        {error && <Text style={[styles.error, { color: colors.pass }]}>{error}</Text>}

        <Pressable
          onPress={submit}
          disabled={submitting}
          style={[styles.submitButton, { backgroundColor: colors.brand, opacity: submitting ? 0.6 : 1 }]}
          hitSlop={8}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.submitButtonText}>{mode === 'upgrade' ? 'Crear cuenta' : 'Iniciar sesión'}</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerRow: {
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  cancelText: {
    fontSize: 13,
    fontFamily: fonts.bodySemiBold,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 24,
    gap: 14,
  },
  title: {
    fontSize: 24,
    fontFamily: fonts.display,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 8,
    fontFamily: fonts.bodyRegular,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 4,
  },
  modeButton: {
    flex: 1,
    borderWidth: 2,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  modeButtonText: {
    fontSize: 13,
    fontFamily: fonts.bodyBold,
  },
  input: {
    borderWidth: 2,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: fonts.bodyRegular,
  },
  error: {
    fontSize: 13,
    fontFamily: fonts.bodySemiBold,
  },
  submitButton: {
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: fonts.bodyBold,
  },
});
