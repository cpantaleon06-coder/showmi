import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowsClockwiseIcon,
  CheckIcon,
  CrownIcon,
  GearIcon,
  InfinityIcon,
  ProhibitIcon,
} from 'phosphor-react-native';
import type { PurchasesPackage } from 'react-native-purchases';

import { useThemeStore } from '../src/theme/useThemeStore';
import { fonts } from '../src/theme/typography';
import { wordmark } from '../src/theme/wordmark';
import { BackButton } from '../src/components/ui/BackButton';
import { EchoTitle } from '../src/components/ui/EchoTitle';
import { RetroSunburstBackground } from '../src/components/backgrounds/RetroSunburstBackground';
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
import { PageTransition } from '../src/components/ui/PageTransition';
import { radii } from '../src/theme/radii';

/**
 * Paywall de Showmi More.
 *
 * 2026-09-13, rediseño retrofuturista (referencia mandada por el usuario: paywall de PICNIC).
 * Dos cambios de fondo respecto de la versión anterior, que era una lista de perks con un
 * botón por plan:
 *
 *  1. SELECCIONAR Y UN SOLO CTA, en vez de un botón de compra por plan. Con un botón por plan,
 *     cada uno compite con los otros dos y ninguno es "el" botón; además obliga a decidir y
 *     comprar en el mismo gesto. Con selección previa, la decisión y la confirmación se
 *     separan, que es como funciona cualquier paywall que convierte.
 *  2. La pantalla SIEMPRE es oscura, en los dos temas. Es un modal a pantalla completa y una
 *     pieza de conversión: se comporta como un cartel, no como una pantalla más de la app.
 *     Mismo criterio ya tomado con las tejas negras de Biblioteca (ver collectionColors.ts).
 *
 * El dorado (`premiumAccent`) queda EXCLUSIVAMENTE para el botón de compra y la marca de
 * selección. El fondo usa magenta y azul del wordmark justamente para no gastarlo: si los
 * rayos también fueran dorados, el CTA dejaría de ser lo único dorado de la pantalla.
 *
 * Toda la lógica de compra (handlePurchase, restore, Customer Center) se conserva intacta:
 * este commit es presentación y modelo de selección, no negocio.
 */

/** Oro de Showmi More. Fijo y no `colors.premiumAccent` porque esta pantalla ya no sigue el
 *  tema -- el valor claro (#8A6B14) se calibró contra un fondo ivory que acá no existe. */
const GOLD = '#C9A227';
const INK_ON_GOLD = '#1A1405';
const TEXT_DIM = '#B9B3C7';

/**
 * Lo que se promete a cambio del dinero.
 *
 * Al eliminarse el Camerino (2026-09-16) salió de acá la ventaja "Cosméticos del Camerino", y
 * el gancho de arriba dejó de hablar de vestir a la mascota. No es un detalle de presentación:
 * esta es la lista por la que alguien decide pagar, y dejar en ella una ventaja que el
 * comprador no va a poder ver en ningún sitio es cobrar por algo que no se entrega.
 */
const PERKS: { icon: typeof CrownIcon; title: string; description: string }[] = [
  {
    icon: InfinityIcon,
    title: 'Swipes ilimitados',
    description: `Sin el tope de ${DAILY_FREE_SWIPE_LIMIT} diarios — descubre a tu ritmo.`,
  },
  {
    icon: CrownIcon,
    title: 'Insignia de More',
    description: 'Visible junto a tu nombre en el Feed y tu Perfil.',
  },
  {
    icon: ProhibitIcon,
    title: 'Sin anuncios',
    description: 'Ni en el deck ni en el Feed — solo música y gente real.',
  },
];

/**
 * Nombre legible de un paquete. RevenueCat entrega identificadores (`$rc_annual`) y, en la
 * Test Store, títulos de producto poco presentables -- pero el fallback a `product.title` se
 * mantiene por si la tienda real sí trae uno bueno.
 */
const PACKAGE_LABELS: Record<string, { title: string; caption: string }> = {
  $rc_annual: { title: 'Anual', caption: 'El plan completo' },
  $rc_monthly: { title: 'Mensual', caption: 'Tómate tu tiempo' },
  $rc_weekly: { title: 'Semanal', caption: 'Pruébalo sin compromiso' },
  $rc_lifetime: { title: 'De por vida', caption: 'Un solo pago, para siempre' },
};

function labelFor(pkg: PurchasesPackage): { title: string; caption: string } {
  return PACKAGE_LABELS[pkg.identifier] ?? { title: pkg.product.title || pkg.identifier, caption: '' };
}

/**
 * Ahorro del plan anual frente a pagar mensual doce veces. Se CALCULA con los precios reales
 * de RevenueCat en vez de escribir un porcentaje a mano: un número inventado en el paywall es
 * publicidad engañosa en cuanto alguien cambie un precio en el dashboard.
 *
 * Devuelve null si falta alguno de los dos planes o si el anual no sale más barato -- en ese
 * caso simplemente no hay insignia, en vez de presumir un ahorro que no existe.
 */
function annualSavingsPercent(packages: PurchasesPackage[]): number | null {
  const annual = packages.find((p) => p.identifier === '$rc_annual');
  const monthly = packages.find((p) => p.identifier === '$rc_monthly');
  if (!annual || !monthly) return null;
  const yearOfMonthly = monthly.product.price * 12;
  if (!yearOfMonthly || annual.product.price >= yearOfMonthly) return null;
  return Math.round((1 - annual.product.price / yearOfMonthly) * 100);
}

/** Precio mensualizado del plan anual, para poder compararlo de un vistazo con el mensual. */
function perMonthLabel(pkg: PurchasesPackage): string | null {
  if (pkg.identifier !== '$rc_annual') return null;
  const perMonth = pkg.product.price / 12;
  if (!Number.isFinite(perMonth) || perMonth <= 0) return null;
  // Se reusa el símbolo que ya trae priceString en vez de asumir moneda o formato.
  const symbol = pkg.product.priceString.replace(/[\d.,\s]/g, '') || '';
  return `${symbol}${perMonth.toFixed(2)}/mes`;
}

function PlanRow({
  pkg,
  selected,
  onPress,
  badge,
  isLast,
}: {
  pkg: PurchasesPackage;
  selected: boolean;
  onPress: () => void;
  badge: string | null;
  isLast: boolean;
}) {
  const { title, caption } = labelFor(pkg);
  const perMonth = perMonthLabel(pkg);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${title}, ${pkg.product.priceString}`}
      style={[styles.planRow, selected && styles.planRowSelected, !isLast && styles.planRowDivider]}
    >
      {/* Marca de selección: círculo relleno de oro con palomita, o aro apagado. El aro vacío
          y el relleno miden IGUAL para que la fila no se mueva un pixel al cambiar de plan. */}
      {/* Sin anillo: el radio apagado es un disco tenue y el encendido se pinta de dorado. */}
      <View style={[styles.radio, { backgroundColor: selected ? GOLD : 'rgba(255,255,255,0.18)' }]}>
        {selected && <CheckIcon weight="bold" size={13} color={INK_ON_GOLD} />}
      </View>

      <View style={styles.planText}>
        <Text style={[styles.planTitle, !selected && styles.planTitleDim]}>{title}</Text>
        {!!caption && <Text style={styles.planCaption}>{caption}</Text>}
      </View>

      <View style={styles.planPrices}>
        <Text style={[styles.planPrice, !selected && styles.planTitleDim]}>{pkg.product.priceString}</Text>
        {!!perMonth && <Text style={styles.planPerMonth}>{perMonth}</Text>}
      </View>

      {!!badge && (
        <View style={styles.planBadge}>
          <Text style={styles.planBadgeText}>{badge}</Text>
        </View>
      )}
    </Pressable>
  );
}

export default function PremiumScreen() {
  const colors = useThemeStore((s) => s.colors);
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const isPremium = useSubscriptionStore((s) => s.isPremium);
  const setPremium = useSubscriptionStore((s) => s.setPremium);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [openingCenter, setOpeningCenter] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const offeringQuery = useQuery({
    queryKey: ['revenuecat-current-offering'],
    queryFn: fetchCurrentOffering,
    staleTime: 1000 * 60 * 10,
  });

  const packages = useMemo(() => offeringQuery.data?.availablePackages ?? [], [offeringQuery.data]);

  /** El anual arranca preseleccionado si existe -- es el que la insignia de ahorro destaca, y
   *  un paywall sin nada seleccionado obliga a un toque de más antes de poder comprar. */
  const selectedPackage = useMemo(() => {
    if (packages.length === 0) return null;
    return (
      packages.find((p) => p.identifier === selectedId) ??
      packages.find((p) => p.identifier === '$rc_annual') ??
      packages[0]
    );
  }, [packages, selectedId]);

  const savings = useMemo(() => annualSavingsPercent(packages), [packages]);

  const applyCustomerInfo = (info: Parameters<typeof isPremiumFromCustomerInfo>[0]) => {
    // Solo estado LOCAL: desbloquea la UI al instante tras comprar. La copia server-side
    // (`users.es_premium`, la insignia que ven los demás en el Feed) la escribe el webhook de
    // RevenueCat, no el cliente -- ver supabase/functions/revenuecat-webhook. Llega con unos
    // segundos de retraso frente a esta línea, y ese desfase es aceptable: lo que la persona
    // acaba de pagar se le abre aquí y ahora.
    setPremium(isPremiumFromCustomerInfo(info));
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

  const busy = purchasingId !== null;

  return (
    <PageTransition>
      <View style={styles.container}>
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <RetroSunburstBackground width={screenWidth} height={screenHeight} />
        </View>

        <SafeAreaView style={styles.safe} edges={['top']}>
          <BackButton colors={colors} />

          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.hero}>
              {/* El eco es la firma tipográfica de Showmi (ver EchoTitle) -- la misma que abre
                  Biblioteca. Se reusa en vez de inventar un tratamiento nuevo para el paywall:
                  la pantalla que cobra debe verse de la misma app que la que no cobra. */}
              <EchoTitle text="Showmi" accent={wordmark.w.fill} color="#FFFFFF" size={44} />
              <Text style={styles.heroMore}>MORE</Text>
            </View>

            <Text style={styles.headline}>
              Descubre sin freno{'\n'}
              <Text style={{ color: wordmark.w.corner }}>y sin interrupciones</Text>
            </Text>

            {isPremium ? (
              <View style={styles.activeBanner}>
                <CheckIcon weight="bold" size={18} color={GOLD} />
                <Text style={styles.activeBannerText}>Ya tienes Showmi More — gracias por tu apoyo.</Text>
              </View>
            ) : null}

            {!isPremium && (
              <>
                {!isRevenueCatConfigured() ? (
                  <Text style={styles.note}>Los planes todavía se están configurando — vuelve pronto.</Text>
                ) : offeringQuery.isLoading ? (
                  <ActivityIndicator color={GOLD} size="small" style={styles.loading} />
                ) : packages.length === 0 ? (
                  <Text style={styles.note}>No hay planes disponibles todavía — vuelve pronto.</Text>
                ) : (
                  <View style={styles.planCard}>
                    {packages.map((pkg, i) => (
                      <PlanRow
                        key={pkg.identifier}
                        pkg={pkg}
                        selected={selectedPackage?.identifier === pkg.identifier}
                        onPress={() => setSelectedId(pkg.identifier)}
                        badge={pkg.identifier === '$rc_annual' && savings !== null ? `AHORRA ${savings}%` : null}
                        isLast={i === packages.length - 1}
                      />
                    ))}
                  </View>
                )}
              </>
            )}

            <View style={styles.perks}>
              {PERKS.map((perk) => (
                <View key={perk.title} style={styles.perkRow}>
                  <View style={styles.perkIcon}>
                    <perk.icon weight="fill" size={17} color={GOLD} />
                  </View>
                  <View style={styles.perkText}>
                    <Text style={styles.perkTitle}>{perk.title}</Text>
                    <Text style={styles.perkDescription}>{perk.description}</Text>
                  </View>
                </View>
              ))}
            </View>

            {isPremium && isRevenueCatConfigured() && (
              <Pressable
                onPress={handleManageSubscription}
                disabled={openingCenter}
                style={[styles.ghostRow, { opacity: openingCenter ? 0.6 : 1 }]}
                hitSlop={8}
              >
                <GearIcon weight="bold" size={16} color="#FFFFFF" />
                <Text style={styles.ghostRowText}>{openingCenter ? 'Abriendo…' : 'Gestionar suscripción'}</Text>
              </Pressable>
            )}

            <Pressable onPress={handleRestore} disabled={restoring} style={styles.restoreRow} hitSlop={8}>
              <ArrowsClockwiseIcon weight="bold" size={15} color={TEXT_DIM} />
              <Text style={styles.restoreText}>{restoring ? 'Restaurando…' : 'Restaurar compras'}</Text>
            </Pressable>
          </ScrollView>

          {/* El CTA vive FUERA del ScrollView, anclado abajo: en un paywall el botón no debe
              poder quedarse fuera de pantalla por scroll. */}
          {!isPremium && selectedPackage && (
            <SafeAreaView edges={['bottom']} style={styles.ctaDock}>
              <Pressable
                onPress={() => handlePurchase(selectedPackage)}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel={`Obtener Showmi More ${labelFor(selectedPackage).title} por ${selectedPackage.product.priceString}`}
                style={[styles.cta, busy && styles.ctaBusy]}
              >
                {busy ? (
                  <ActivityIndicator color={INK_ON_GOLD} size="small" />
                ) : (
                  <Text style={styles.ctaText}>Obtener Showmi More</Text>
                )}
              </Pressable>
              {/* Letra chica que dice el precio REAL de lo seleccionado. Un CTA que no repite
                  qué se está a punto de cobrar es justo lo que hace que la gente desconfíe. */}
              <Text style={styles.ctaFinePrint}>
                {labelFor(selectedPackage).title} · {selectedPackage.product.priceString}
                {selectedPackage.identifier === '$rc_lifetime' ? ' · pago único' : ' · cancela cuando quieras'}
              </Text>
            </SafeAreaView>
          )}
        </SafeAreaView>
      </View>
    </PageTransition>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A12' },
  safe: { flex: 1 },
  content: {
    paddingHorizontal: 22,
    paddingTop: 56,
    paddingBottom: 24,
  },
  hero: {
    alignItems: 'center',
    marginBottom: 18,
  },
  /** "MORE" en caja alta y muy espaciado: el contrapunto sereno al eco del wordmark de
   *  arriba, y lo que convierte dos palabras sueltas en un bloque de marca. */
  heroMore: {
    marginTop: 10,
    fontSize: 15,
    letterSpacing: 9,
    color: GOLD,
    fontFamily: fonts.display,
  },
  headline: {
    fontSize: 27,
    lineHeight: 32,
    textAlign: 'center',
    color: '#FFFFFF',
    fontFamily: fonts.display,
    letterSpacing: -0.6,
    marginBottom: 26,
  },
  /** Tarjeta única con las filas dentro, no una tarjeta por plan: así los tres precios se
   *  comparan en una sola lectura vertical, que es lo que hace la referencia. */
  planCard: {
    backgroundColor: 'rgba(10, 6, 24, 0.72)',
    borderRadius: radii.card,
    overflow: 'visible',
    marginBottom: 26,
  },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 15,
    paddingHorizontal: 15,
  },
  planRowSelected: {
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  planRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.10)',
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planText: { flex: 1 },
  planTitle: {
    fontSize: 17,
    color: '#FFFFFF',
    fontFamily: fonts.display,
    letterSpacing: -0.3,
  },
  /** Los planes no elegidos se apagan, no se ocultan: siguen comparables pero dejan claro
   *  cuál manda. */
  planTitleDim: { color: '#9F99B0' },
  planCaption: {
    fontSize: 12,
    color: TEXT_DIM,
    fontFamily: fonts.bodyRegular,
    marginTop: 1,
  },
  planPrices: { alignItems: 'flex-end' },
  planPrice: {
    fontSize: 17,
    color: '#FFFFFF',
    fontFamily: fonts.bodyExtraBold,
  },
  planPerMonth: {
    fontSize: 11,
    color: TEXT_DIM,
    fontFamily: fonts.bodySemiBold,
    marginTop: 1,
  },
  /** Montada sobre el borde superior de su fila, como en la referencia: pegada dentro se
   *  leería como una etiqueta más del plan; encima del borde se lee como un sello. */
  planBadge: {
    position: 'absolute',
    top: -9,
    right: 14,
    backgroundColor: wordmark.w.fill,
    borderRadius: radii.pill,
    paddingHorizontal: 9,
    paddingVertical: 2,
  },
  planBadgeText: {
    fontSize: 10,
    letterSpacing: 0.6,
    color: '#FFFFFF',
    fontFamily: fonts.bodyExtraBold,
  },
  perks: { gap: 13, marginBottom: 22 },
  perkRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  perkIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  perkText: { flex: 1 },
  perkTitle: {
    fontSize: 14,
    color: '#FFFFFF',
    fontFamily: fonts.bodyBold,
  },
  perkDescription: {
    fontSize: 12,
    lineHeight: 17,
    color: TEXT_DIM,
    fontFamily: fonts.bodyRegular,
    marginTop: 1,
  },
  activeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderRadius: radii.card,
    padding: 13,
    marginBottom: 22,
  },
  activeBannerText: {
    flex: 1,
    fontSize: 13,
    color: '#FFFFFF',
    fontFamily: fonts.bodySemiBold,
  },
  ghostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: radii.pill,
    paddingVertical: 11,
    marginBottom: 14,
  },
  ghostRowText: { fontSize: 14, color: '#FFFFFF', fontFamily: fonts.bodyBold },
  restoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 8,
  },
  restoreText: { fontSize: 13, color: TEXT_DIM, fontFamily: fonts.bodySemiBold },
  note: {
    fontSize: 13,
    textAlign: 'center',
    color: TEXT_DIM,
    fontFamily: fonts.bodyRegular,
    marginBottom: 22,
  },
  loading: { marginBottom: 22 },
  ctaDock: {
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 6,
    // Vela sobre el degradado para que el botón no flote sobre la rejilla del horizonte.
    backgroundColor: 'rgba(10, 6, 24, 0.86)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.10)',
  },
  cta: {
    backgroundColor: GOLD,
    borderRadius: radii.pill,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaBusy: { opacity: 0.7 },
  ctaText: {
    fontSize: 16,
    color: INK_ON_GOLD,
    fontFamily: fonts.display,
    letterSpacing: -0.2,
  },
  ctaFinePrint: {
    marginTop: 8,
    fontSize: 11.5,
    textAlign: 'center',
    color: TEXT_DIM,
    fontFamily: fonts.bodyRegular,
  },
});
