import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { ArrowsClockwiseIcon, CheckCircleIcon, CrownIcon, GearIcon, InfinityIcon, ProhibitIcon, TShirtIcon } from 'phosphor-react-native';
import type { PurchasesPackage } from 'react-native-purchases';

import { useThemeStore } from '../src/theme/useThemeStore';
import { fonts } from '../src/theme/typography';
import { BackButton } from '../src/components/ui/BackButton';
import { useSubscriptionStore, DAILY_FREE_SWIPE_LIMIT } from '../src/state/subscriptionStore';
import {
  fetchCurrentOffering,
  fetchCustomerInfo,
  isPremiumFromCustomerInfo,
  isRevenueCatConfigured,
  presentCustomerCenter,
  purchasePackage,
  restorePurchases,
} from '../src/lib/revenuecat';
import { syncPremiumStatus } from '../src/api/subscriptionClient';
import { PageTransition } from '../src/components/ui/PageTransition';
import { ThemeColors } from '../src/theme/colors';
import { radii } from '../src/theme/radii';

const PERKS: { icon: typeof CrownIcon; title: string; description: string }[] = [
  {
    icon: InfinityIcon,
    title: 'Swipes ilimitados',
    description: `Sin el tope de ${DAILY_FREE_SWIPE_LIMIT} swipes diarios -- descubre a tu ritmo, todos los días.`,
  },
  {
    icon: CrownIcon,
    title: 'Insignia de More',
    description: 'Visible junto a tu nombre en el Feed y tu Perfil.',
  },
  {
    icon: TShirtIcon,
    title: 'Cosméticos exclusivos del Camerino',
    description: 'Corona, lentes dorados y estampado de estrellas para tu mascota. Los ves antes de pagar -- nunca son aleatorios.',
  },
  {
    // 2026-09-06: antes deliberadamente NO se prometía esto (ver revenuecat.ts, "honestidad
    // consciente" -- no existía ningún sistema de anuncios construido). Ahora sí existe
    // (tarjetas patrocinadas en el deck y el Feed, ver lib/ads.ts) y Showmi More las oculta
    // de verdad -- ya no es una promesa vacía.
    icon: ProhibitIcon,
    title: 'Sin anuncios',
    description: 'Ni en el deck ni en el Feed -- solo música y gente real.',
  },
];

function PerkRow({ colors, icon: Icon, title, description }: { colors: ThemeColors; icon: typeof CrownIcon; title: string; description: string }) {
  return (
    <View style={styles.perkRow}>
      <View style={[styles.perkIcon, { borderColor: colors.premiumAccent }]}>
        <Icon weight="fill" size={20} color={colors.premiumAccent} />
      </View>
      <View style={styles.perkText}>
        <Text style={[styles.perkTitle, { color: colors.textPrimary }]}>{title}</Text>
        <Text style={[styles.perkDescription, { color: colors.textSecondary }]}>{description}</Text>
      </View>
    </View>
  );
}

function PackageButton({ colors, pkg, onPress, busy }: { colors: ThemeColors; pkg: PurchasesPackage; onPress: () => void; busy: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      style={[styles.packageButton, { borderColor: colors.premiumAccent, opacity: busy ? 0.6 : 1 }]}
    >
      <Text style={[styles.packageTitle, { color: colors.textPrimary }]}>{pkg.product.title || pkg.identifier}</Text>
      <Text style={[styles.packagePrice, { color: colors.premiumAccent }]}>{pkg.product.priceString}</Text>
    </Pressable>
  );
}

export default function PremiumScreen() {
  const colors = useThemeStore((s) => s.colors);
  const isPremium = useSubscriptionStore((s) => s.isPremium);
  const setPremium = useSubscriptionStore((s) => s.setPremium);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [openingCenter, setOpeningCenter] = useState(false);

  const offeringQuery = useQuery({
    queryKey: ['revenuecat-current-offering'],
    queryFn: fetchCurrentOffering,
    staleTime: 1000 * 60 * 10,
  });

  const applyCustomerInfo = (info: Parameters<typeof isPremiumFromCustomerInfo>[0]) => {
    const premium = isPremiumFromCustomerInfo(info);
    setPremium(premium);
    syncPremiumStatus(premium).catch(() => {});
  };

  const handlePurchase = async (pkg: PurchasesPackage) => {
    setPurchasingId(pkg.identifier);
    try {
      const info = await purchasePackage(pkg);
      applyCustomerInfo(info);
    } catch (e) {
      const userCancelled = (e as { userCancelled?: boolean })?.userCancelled;
      if (!userCancelled) Alert.alert('No se pudo completar la compra', 'Intenta de nuevo en unos momentos.');
    } finally {
      setPurchasingId(null);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    try {
      const info = await restorePurchases();
      applyCustomerInfo(info);
      Alert.alert(
        'Listo',
        isPremiumFromCustomerInfo(info)
          ? 'Tu Showmi More fue restaurado.'
          : 'No encontramos compras previas para restaurar.',
      );
    } catch {
      Alert.alert('No se pudo restaurar', 'Intenta de nuevo en unos momentos.');
    } finally {
      setRestoring(false);
    }
  };

  const handleManageSubscription = async () => {
    setOpeningCenter(true);
    try {
      await presentCustomerCenter();
      // El Customer Center puede haber cancelado/cambiado el plan mientras estuvo abierto --
      // el modal no notifica cambios en vivo, así que se refresca CustomerInfo al cerrarlo.
      const info = await fetchCustomerInfo();
      if (info) applyCustomerInfo(info);
    } finally {
      setOpeningCenter(false);
    }
  };

  const packages = offeringQuery.data?.availablePackages ?? [];

  return (
    <PageTransition>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={[styles.header, { backgroundColor: colors.brand }]}>
          <BackButton colors={colors} />
          {/* Blanco fijo, no colors.premiumAccent -- este header siempre es colors.brand (rojo)
              en los dos temas, igual que headerTitle de abajo. El dorado de premiumAccent se
              calibró contra colors.surface (contraste 4.93:1 en claro / 7.33:1 en oscuro, ver
              colors.ts) -- sobre rojo da apenas 1.15:1, prácticamente ilegible. */}
          <CrownIcon weight="fill" size={40} color="#FFFFFF" />
          <Text style={styles.headerTitle}>Showmi More</Text>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {isPremium ? (
            <>
              <View style={[styles.activeBanner, { borderColor: colors.premiumAccent }]}>
                <CheckCircleIcon weight="fill" size={22} color={colors.premiumAccent} />
                <Text style={[styles.activeBannerText, { color: colors.textPrimary }]}>Ya tienes Showmi More -- gracias por tu apoyo.</Text>
              </View>
              {isRevenueCatConfigured() && (
                <Pressable
                  onPress={handleManageSubscription}
                  disabled={openingCenter}
                  style={[styles.manageRow, { borderColor: colors.border, opacity: openingCenter ? 0.6 : 1 }]}
                  hitSlop={8}
                >
                  <GearIcon weight="bold" size={16} color={colors.textPrimary} />
                  <Text style={[styles.manageRowText, { color: colors.textPrimary }]}>
                    {openingCenter ? 'Abriendo…' : 'Gestionar suscripción'}
                  </Text>
                </Pressable>
              )}
            </>
          ) : null}

          <View style={styles.perks}>
            {PERKS.map((perk) => (
              <PerkRow key={perk.title} colors={colors} icon={perk.icon} title={perk.title} description={perk.description} />
            ))}
          </View>

          {!isPremium && (
            <>
              {!isRevenueCatConfigured() ? (
                <Text style={[styles.note, { color: colors.textSecondary }]}>
                  Los planes todavía se están configurando -- vuelve pronto.
                </Text>
              ) : offeringQuery.isLoading ? (
                <ActivityIndicator color={colors.premiumAccent} size="small" style={styles.loading} />
              ) : packages.length === 0 ? (
                <Text style={[styles.note, { color: colors.textSecondary }]}>
                  No hay planes disponibles todavía -- vuelve pronto.
                </Text>
              ) : (
                <View style={styles.packages}>
                  {packages.map((pkg) => (
                    <PackageButton
                      key={pkg.identifier}
                      colors={colors}
                      pkg={pkg}
                      busy={purchasingId === pkg.identifier}
                      onPress={() => handlePurchase(pkg)}
                    />
                  ))}
                </View>
              )}
            </>
          )}

          <Pressable onPress={handleRestore} disabled={restoring} style={styles.restoreRow} hitSlop={8}>
            <ArrowsClockwiseIcon weight="bold" size={16} color={colors.textSecondary} />
            <Text style={[styles.restoreText, { color: colors.textSecondary }]}>
              {restoring ? 'Restaurando…' : 'Restaurar compras'}
            </Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </PageTransition>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 20,
    paddingBottom: 24,
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: fonts.display,
    color: '#FFFFFF',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
    gap: 20,
  },
  activeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 2,
    borderRadius: radii.card,
    paddingHorizontal: 16,
    paddingVertical: 12,
    width: '100%',
  },
  activeBannerText: {
    flex: 1,
    fontSize: 13,
    fontFamily: fonts.bodySemiBold,
  },
  manageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 2,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 12,
    width: '100%',
    marginTop: -8,
  },
  manageRowText: {
    fontSize: 13,
    fontFamily: fonts.bodyBold,
  },
  perks: {
    width: '100%',
    gap: 18,
  },
  perkRow: {
    flexDirection: 'row',
    gap: 14,
  },
  perkIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  perkText: {
    flex: 1,
  },
  perkTitle: {
    fontSize: 15,
    fontFamily: fonts.bodyBold,
  },
  perkDescription: {
    fontSize: 13,
    marginTop: 2,
    fontFamily: fonts.bodyRegular,
  },
  note: {
    fontSize: 13,
    textAlign: 'center',
    fontFamily: fonts.bodyRegular,
  },
  loading: {
    marginTop: 8,
  },
  packages: {
    width: '100%',
    gap: 12,
  },
  packageButton: {
    borderWidth: 2,
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 16,
    alignItems: 'center',
    gap: 4,
  },
  packageTitle: {
    fontSize: 15,
    fontFamily: fonts.bodyBold,
  },
  packagePrice: {
    fontSize: 18,
    fontFamily: fonts.display,
  },
  restoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  restoreText: {
    fontSize: 13,
    fontFamily: fonts.bodyRegular,
  },
});
