import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as AppleAuthentication from 'expo-apple-authentication';
import { GoogleSigninButton } from '@react-native-google-signin/google-signin';

import { useThemeStore } from '../src/theme/useThemeStore';
import { fonts } from '../src/theme/typography';
import { useAuthStore } from '../src/state/authStore';
import {
  signInExistingAccount,
  signInWithAppleIdToken,
  signInWithGoogleIdToken,
  upgradeAnonymousAccount,
} from '../src/api/authClient';
import { getGoogleIdToken } from '../src/api/googleAuth';

type Mode = 'upgrade' | 'signin';

/**
 * Pantalla real de auth -- dos modos para el formulario de email (ver authClient.ts para
 * por qué no se pueden mezclar los métodos de Supabase detrás de cada uno):
 *  - "Guardar mi progreso" (`upgrade`): convierte la sesión anónima ACTUAL en cuenta real,
 *    preserva auth.uid() y todo lo ya acumulado. Es el modo por default -- a quién le
 *    llega esta pantalla normalmente ya está en modo invitado y quiere no perder lo suyo.
 *  - "Ya tengo cuenta" (`signin`): entra a una cuenta real que ya existía (otro
 *    dispositivo/reinstalación) -- reemplaza la sesión actual, no la fusiona.
 *
 * Google/Apple (abajo) NO tienen ese mismo par de modos -- signInWithIdToken siempre
 * crea-o-entra, nunca preserva la sesión anónima actual (ver comentario largo en
 * authClient.ts). Mismo botón sirve para "crear" y "entrar" indistintamente, como en
 * casi cualquier app.
 *
 * Requieren credenciales que este proyecto no tiene todavía (no se pueden probar hasta
 * que existan):
 *  - Google: EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID (.env, hoy vacío) + provider Google
 *    habilitado en el dashboard de Supabase con ese mismo client ID/secret.
 *  - Apple: Apple Developer Program (capability "Sign In with Apple" en el bundle ID) +
 *    provider Apple habilitado en Supabase (Services ID, Team ID, Key ID, private key).
 *    Además solo puede aparecer en iOS -- por eso el chequeo de isAvailableAsync abajo.
 */
export default function AuthScreen() {
  const colors = useThemeStore((s) => s.colors);
  const themeMode = useThemeStore((s) => s.mode);
  const router = useRouter();
  const isAnonymous = useAuthStore((s) => s.session?.user.is_anonymous ?? true);

  const [mode, setMode] = useState<Mode>(isAnonymous ? 'upgrade' : 'signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    AppleAuthentication.isAvailableAsync().then(setAppleAvailable);
  }, []);

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

  const submitGoogle = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const idToken = await getGoogleIdToken();
      if (!idToken) {
        // Canceló el picker de cuentas -- no es un error, no hay nada que mostrar.
        setSubmitting(false);
        return;
      }
      const result = await signInWithGoogleIdToken(idToken);
      setSubmitting(false);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.back();
    } catch (e) {
      setSubmitting(false);
      setError(e instanceof Error ? e.message : 'No se pudo iniciar sesión con Google.');
    }
  };

  const submitApple = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
      });
      if (!credential.identityToken) throw new Error('Apple no devolvió un identityToken.');
      const result = await signInWithAppleIdToken(credential.identityToken);
      setSubmitting(false);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.back();
    } catch (e: any) {
      setSubmitting(false);
      // ERR_REQUEST_CANCELED -- el usuario canceló, no es un error real para mostrar.
      if (e?.code === 'ERR_REQUEST_CANCELED') return;
      setError(e instanceof Error ? e.message : 'No se pudo iniciar sesión con Apple.');
    }
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

        {Platform.OS !== 'web' && (
          <View style={styles.socialColumn}>
            <GoogleSigninButton
              size={GoogleSigninButton.Size.Wide}
              color={GoogleSigninButton.Color.Dark}
              onPress={submitGoogle}
              disabled={submitting}
              style={styles.googleButton}
            />
            {Platform.OS === 'ios' && appleAvailable && (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                // Blanco en modo oscuro, negro en modo claro -- mismo criterio de contraste
                // que pide la guía de Apple para su botón oficial, no una elección de estilo.
                buttonStyle={
                  themeMode === 'dark'
                    ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                    : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
                }
                cornerRadius={10}
                style={styles.appleButton}
                onPress={submitApple}
              />
            )}

            <View style={styles.dividerRow}>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
              <Text style={[styles.dividerText, { color: colors.textSecondary }]}>o con email</Text>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            </View>
          </View>
        )}

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
  socialColumn: {
    gap: 12,
  },
  googleButton: {
    width: '100%',
    height: 48,
  },
  appleButton: {
    width: '100%',
    height: 48,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 12,
    fontFamily: fonts.bodySemiBold,
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
