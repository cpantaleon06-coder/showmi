import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeAdView, NativeAsset, NativeAssetType, NativeMediaView } from 'react-native-google-mobile-ads';

import { useNativeAd } from '../../hooks/useNativeAd';
import { trackAdOpened } from '../../lib/ads';
import { ThemeColors } from '../../theme/colors';
import { fonts } from '../../theme/typography';

interface SponsoredPostProps {
  colors: ThemeColors;
  placement: string;
}

/**
 * Post patrocinado del Feed -- mismas medidas/radios que PostCard (borderWidth 2, radius 10,
 * padding 14) para que se lea como "un post más" al hacer scroll, con la etiqueta
 * "PATROCINADO" en el mismo lugar donde PostCard pone el badge "SHOWMI OFICIAL" (mismo
 * lenguaje visual, insignia arriba a la derecha del encabezado). Sin anuncio cargado o en
 * modo web (sin SDK nativo), no renderiza nada -- feed.tsx ya filtra estos slots del `data`
 * cuando corresponde, esto es la última línea de defensa.
 */
export function SponsoredPost({ colors, placement }: SponsoredPostProps) {
  const { ad } = useNativeAd(placement, true);

  if (!ad) return null;

  return (
    <NativeAdView style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]} nativeAd={ad}>
      <View style={styles.header}>
        {ad.icon ? (
          <NativeAsset assetType={NativeAssetType.ICON}>
            <Image source={{ uri: ad.icon.url }} style={styles.icon} />
          </NativeAsset>
        ) : (
          <View style={[styles.icon, { backgroundColor: colors.background }]} />
        )}
        <View style={styles.headerText}>
          <NativeAsset assetType={NativeAssetType.HEADLINE}>
            <Text style={[styles.headline, { color: colors.textPrimary }]} numberOfLines={1}>
              {ad.headline}
            </Text>
          </NativeAsset>
          {ad.advertiser && (
            <NativeAsset assetType={NativeAssetType.ADVERTISER}>
              <Text style={[styles.advertiser, { color: colors.textSecondary }]} numberOfLines={1}>
                {ad.advertiser}
              </Text>
            </NativeAsset>
          )}
        </View>
        <View style={[styles.badge, { backgroundColor: colors.premiumAccent }]}>
          <Text style={styles.badgeText}>PATROCINADO</Text>
        </View>
      </View>

      {ad.mediaContent && (
        <NativeMediaView style={styles.media} resizeMode="cover" />
      )}

      {ad.body ? (
        <Text style={[styles.body, { color: colors.textPrimary }]} numberOfLines={3}>
          {ad.body}
        </Text>
      ) : null}

      <NativeAsset assetType={NativeAssetType.CALL_TO_ACTION}>
        <Pressable onPress={() => trackAdOpened(ad, placement)} style={[styles.ctaButton, { borderColor: colors.brand }]}>
          <Text style={[styles.ctaText, { color: colors.brand }]}>{ad.callToAction || 'Ver más'}</Text>
        </Pressable>
      </NativeAsset>
    </NativeAdView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 2,
    borderRadius: 10,
    padding: 14,
    gap: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 10,
  },
  headerText: {
    flex: 1,
  },
  headline: {
    fontSize: 15,
    fontFamily: fonts.bodySemiBold,
  },
  advertiser: {
    fontSize: 12,
    marginTop: 2,
    fontFamily: fonts.bodyRegular,
  },
  badge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 9,
    letterSpacing: 0.4,
    fontFamily: fonts.bodyExtraBold,
    color: '#FFFFFF',
  },
  media: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 8,
  },
  body: {
    fontSize: 13,
    fontFamily: fonts.bodyRegular,
  },
  ctaButton: {
    alignSelf: 'flex-start',
    borderWidth: 2,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  ctaText: {
    fontSize: 13,
    fontFamily: fonts.bodyBold,
  },
});
