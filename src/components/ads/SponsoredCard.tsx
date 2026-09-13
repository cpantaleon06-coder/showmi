import { Dimensions, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  NativeAsset,
  NativeAssetType,
  NativeAdView,
  NativeMediaView,
} from 'react-native-google-mobile-ads';

import { useNativeAd } from '../../hooks/useNativeAd';
import { trackAdOpened } from '../../lib/ads';
import { ThemeColors } from '../../theme/colors';
import { radii } from '../../theme/radii';
import { fonts } from '../../theme/typography';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface SponsoredCardProps {
  colors: ThemeColors;
  /** Identificador de dónde vive este slot -- ver Purchases.adTracker en lib/ads.ts, sirve
   *  para segmentar en el dashboard de RevenueCat (ej. "swipe_deck" vs "feed"). */
  placement: string;
  /** El deck sigue esperando este slot mientras el anuncio carga o si falla -- nunca debe
   *  quedarse trabado, así que SIEMPRE hay una salida visible. */
  onContinue: () => void;
}

/**
 * Tarjeta patrocinada del deck -- mismo tamaño/radio que SwipeCard.tsx (SCREEN_WIDTH-40,
 * radius 10) para caer en el mismo slot sin que SwipeDeck.tsx tenga que saber nada especial
 * de layout. A diferencia de SwipeCard, NO usa gestos de arrastre: un Native Ad no se "descarta
 * con swipe" en las guías de Google, se cierra con un control explícito -- por eso el botón
 * "Seguir viendo música" vive FUERA de <NativeAdView>, nunca dentro de la zona que Google
 * trackea como clic del anuncio (mezclar las dos cosas es exactamente el tipo de layout que
 * puede tumbar una cuenta de AdMob por "clics inválidos").
 *
 * "PATROCINADO" es obligatorio, no decorativo -- las políticas de Native Ads de Google exigen
 * una etiqueta de atribución visible en todo momento.
 */
export function SponsoredCard({ colors, placement, onContinue }: SponsoredCardProps) {
  const { ad, loading } = useNativeAd(placement, true);

  if (!ad) {
    // Sin anuncio (todavía cargando, o falló) -- nunca bloquea el deck: se salta el slot solo.
    if (!loading) onContinue();
    return (
      <View style={[styles.card, styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]} />
    );
  }

  return (
    <View style={styles.wrap}>
      <NativeAdView style={styles.card} nativeAd={ad}>
        <View style={[styles.card, { borderColor: colors.border }]}>
          {ad.mediaContent && (
            <NativeMediaView style={StyleSheet.absoluteFill} resizeMode="cover" />
          )}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.85)']}
            style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}
          />

          <View style={[styles.sponsoredBadge, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.sponsoredBadgeText, { color: colors.textSecondary }]}>PATROCINADO</Text>
          </View>

          <View style={styles.bottom}>
            <View style={styles.advertiserRow}>
              {ad.icon && (
                <NativeAsset assetType={NativeAssetType.ICON}>
                  <Image source={{ uri: ad.icon.url }} style={styles.icon} />
                </NativeAsset>
              )}
              {ad.advertiser && (
                <NativeAsset assetType={NativeAssetType.ADVERTISER}>
                  <Text style={styles.advertiser} numberOfLines={1}>
                    {ad.advertiser}
                  </Text>
                </NativeAsset>
              )}
            </View>

            <NativeAsset assetType={NativeAssetType.HEADLINE}>
              <Text style={styles.headline} numberOfLines={2}>
                {ad.headline}
              </Text>
            </NativeAsset>
            {ad.body ? (
              <Text style={styles.body} numberOfLines={2}>
                {ad.body}
              </Text>
            ) : null}

            <NativeAsset assetType={NativeAssetType.CALL_TO_ACTION}>
              <Pressable
                onPress={() => trackAdOpened(ad, placement)}
                style={[styles.ctaButton, { backgroundColor: colors.brand }]}
              >
                <Text style={styles.ctaText}>{ad.callToAction || 'Ver más'}</Text>
              </Pressable>
            </NativeAsset>
          </View>
        </View>
      </NativeAdView>

      {/* Fuera de NativeAdView a propósito -- ver comentario de arriba. */}
      <Pressable onPress={onContinue} style={[styles.continueButton, { borderColor: colors.border, backgroundColor: colors.surface }]} hitSlop={8}>
        <Text style={[styles.continueText, { color: colors.textPrimary }]}>Seguir viendo música</Text>
      </Pressable>
    </View>
  );
}

const CARD_WIDTH = SCREEN_WIDTH - 40;

const styles = StyleSheet.create({
  wrap: {
    width: CARD_WIDTH,
    height: '100%',
    alignItems: 'center',
  },
  card: {
    width: CARD_WIDTH,
    flex: 1,
    borderRadius: radii.card,
    borderWidth: 2,
    overflow: 'hidden',
  },
  emptyCard: {
    borderStyle: 'dashed',
  },
  sponsoredBadge: {
    position: 'absolute',
    top: 14,
    left: 14,
    borderWidth: 1.5,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  sponsoredBadgeText: {
    fontSize: 10,
    letterSpacing: 0.6,
    fontFamily: fonts.bodyExtraBold,
  },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 18,
    gap: 6,
  },
  advertiserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  icon: {
    width: 20,
    height: 20,
    borderRadius: 5,
  },
  advertiser: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    fontFamily: fonts.bodySemiBold,
  },
  headline: {
    fontSize: 20,
    color: '#FFFFFF',
    fontFamily: fonts.display,
  },
  body: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    fontFamily: fonts.bodyRegular,
  },
  ctaButton: {
    alignSelf: 'flex-start',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginTop: 8,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: fonts.bodyBold,
  },
  continueButton: {
    marginTop: 14,
    borderWidth: 2,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  continueText: {
    fontSize: 13,
    fontFamily: fonts.bodySemiBold,
  },
});
