import AsyncStorage from '@react-native-async-storage/async-storage';

const GREETINGS = [
  '¿Qué te gustaría explorar hoy?',
  '¿Cuál es tu vibra hoy?',
  '¿Ganas de algo nuevo?',
  '¿Qué se te antoja hoy?',
  '¿Con qué ánimo vienes?',
  '¿Qué onda traes hoy?',
  '¿Hacia dónde te lleva el oído?',
  '¿Qué buscas hoy?',
];

const LAST_GREETING_KEY = 'showmi-last-greeting';

/**
 * Puramente decorativo (a diferencia del resto del selector de sesión, que
 * sí filtra el deck) -- una frase al azar por apertura de app, sin repetir
 * la última mostrada.
 */
export async function pickSessionGreeting(): Promise<string> {
  const last = await AsyncStorage.getItem(LAST_GREETING_KEY);
  const pool = last ? GREETINGS.filter((g) => g !== last) : GREETINGS;
  const next = pool[Math.floor(Math.random() * pool.length)];
  await AsyncStorage.setItem(LAST_GREETING_KEY, next);
  return next;
}
