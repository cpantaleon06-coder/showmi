# Showmi

**Descubrimiento musical swipeando.** Escuchas 30 segundos de una canción, swipeas, y el deck
aprende de ti: cada swipe mueve tu perfil de gustos y el siguiente deck ya viene distinto.

### → [Probar Showmi en el navegador](https://showmi-cpantaleon06-coders-projects.vercel.app)

No hay que instalar nada. También hay una [landing](https://cpantaleon06-coder.github.io/showmi/)
si prefieres compartir un enlace más presentable.

---

## Qué hace

- **Deck de descubrimiento** con previews reales de iTunes, filtrable por género y por vibra.
- **Motor de gustos propio** que aprende de cada swipe y reancla el deck sobre la marcha.
- **Biblioteca** con colecciones, y **export a una playlist de Spotify** con tu cuenta.
- **Feed** donde las canciones calificadas se vuelven publicaciones, con votación de vibra.
- **Showmi More**, el tier de pago: swipes ilimitados, insignia y sin anuncios.

## Estado

Esta es la versión de demostración para el **RevenueCat Shipaton 2026**. La suscripción se puede
activar desde el paywall para recorrer el flujo completo y **no genera ningún cargo**: mientras no
haya una clave de tienda real, el modo demo se enciende solo y se apaga solo en cuanto exista
(ver `src/lib/demo.ts`).

## Stack

Expo SDK 57 · React Native 0.86 · expo-router · Reanimated · Supabase (Postgres, RLS, Edge
Functions) · RevenueCat · iTunes Search API y Last.fm como fuentes de catálogo.

## Correr en local

```bash
npm install
npx expo start
```

Necesitas un `.env` con las variables `EXPO_PUBLIC_*` (Supabase, Spotify y, si quieres probar
compras, RevenueCat). Para la versión web:

```bash
npx expo export --platform web
npx serve -s dist
```
