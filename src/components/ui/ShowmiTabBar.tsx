import { useEffect, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedProps, useSharedValue } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useThemeStore } from '../../theme/useThemeStore';
import { conResorte, resortes } from '../../theme/motion';
import { fonts } from '../../theme/typography';

const AnimatedPath = Animated.createAnimatedComponent(Path);

/**
 * Barra inferior propia (2026-09-15, referencia mandada por el usuario: la anterior "no queda
 * con la estética de la app").
 *
 * Lo que la hace de Showmi y no una tab bar cualquiera es la MUESCA: el borde superior se hunde
 * en una cuchara justo encima de la pestaña activa, y esa cuchara se desliza al cambiar de
 * pestaña. Es el único elemento de la navegación que se mueve, así que se lleva la atención sin
 * competir con nada.
 *
 * Vuelven las ETIQUETAS de texto bajo cada ícono. El 2026-09-01 se habían quitado por otra
 * referencia ("tipo Reels, solo íconos"); esta referencia las trae de vuelta y son mejores acá:
 * con tres destinos de nombre no obvio (Biblioteca / Swipe / Feed) un ícono solo obliga a
 * adivinar.
 *
 * Se dibuja la silueta en SVG en vez de usar un View con borderRadius porque una muesca cóncava
 * no se puede expresar con bordes redondeados -- hay que recortar la forma.
 */

/** Alto de la barra sin contar el inset seguro de abajo. Da para ícono + etiqueta sin apretar. */
const ALTO = 66;
/** Radio de las esquinas. Alto/2.6 -- redondeado de pastilla sin llegar a cápsula. */
const RADIO = 25;
/** Medio ancho de la muesca y cuánto se hunde. Calibrado contra el ícono (24px): la cuchara
 *  tiene que ser claramente más ancha que él o se lee como un defecto, no como un gesto. */
const MUESCA_MEDIO = 40;
const MUESCA_HONDO = 11;
/** Separación de la isla respecto a los bordes de la pantalla. */
const MARGEN = 18;

/**
 * Silueta de la barra con la cuchara centrada en `cx`. Worklet: la construye el hilo de UI en
 * cada frame de la animación, así que no puede llamar a nada de fuera.
 */
function siluetaConMuesca(ancho: number, alto: number, cxCrudo: number): string {
  'worklet';
  // La cuchara tiene que caber ENTERA en el tramo recto de arriba. Sin esto, con la primera o
  // la última pestaña activa su borde cae dentro de la esquina redondeada y el trazo se
  // devuelve sobre sí mismo (medido: con 3 pestañas se pasaba 2.5px de cada lado y deformaba
  // la esquina). Se corre la muesca lo mínimo; el ícono se queda en su centro real, y a esa
  // distancia el desfase no se percibe.
  const minCx = RADIO + MUESCA_MEDIO;
  const maxCx = ancho - RADIO - MUESCA_MEDIO;
  const cx = cxCrudo < minCx ? minCx : cxCrudo > maxCx ? maxCx : cxCrudo;
  const izq = cx - MUESCA_MEDIO;
  const der = cx + MUESCA_MEDIO;
  // Dos cúbicas simétricas: baja hasta el fondo en el centro y vuelve a subir. Los tiradores a
  // ~0.5 del medio ancho dan una curva suave; más cerca del borde la haría una V.
  const cuchara =
    `L${izq},0 ` +
    `C${izq + MUESCA_MEDIO * 0.5},0 ${cx - MUESCA_MEDIO * 0.55},${MUESCA_HONDO} ${cx},${MUESCA_HONDO} ` +
    `C${cx + MUESCA_MEDIO * 0.55},${MUESCA_HONDO} ${der - MUESCA_MEDIO * 0.5},0 ${der},0 `;

  return (
    `M0,${RADIO} A${RADIO},${RADIO} 0 0 1 ${RADIO},0 ` +
    cuchara +
    `L${ancho - RADIO},0 A${RADIO},${RADIO} 0 0 1 ${ancho},${RADIO} ` +
    `L${ancho},${alto - RADIO} A${RADIO},${RADIO} 0 0 1 ${ancho - RADIO},${alto} ` +
    `L${RADIO},${alto} A${RADIO},${RADIO} 0 0 1 0,${alto - RADIO} Z`
  );
}

/**
 * Tajada MÍNIMA del contrato de tabBar de react-navigation que esta barra consume de verdad.
 * Se declara a mano en vez de importar `BottomTabBarProps`: @react-navigation/bottom-tabs no es
 * dependencia directa del proyecto (expo-router trae la suya adentro), y agregar el paquete
 * entero para un tipo sería cargar una dependencia por una firma.
 */
interface TabBarProps {
  state: { index: number; routes: { key: string; name: string }[] };
  descriptors: Record<
    string,
    {
      options: {
        title?: string;
        tabBarIcon?: (p: { focused: boolean; color: string; size: number }) => ReactNode;
        tabBarStyle?: unknown;
      };
    }
  >;
  navigation: {
    emit: (e: { type: 'tabPress'; target: string; canPreventDefault: true }) => { defaultPrevented: boolean };
    navigate: (name: string) => void;
  };
}

export function ShowmiTabBar({ state, descriptors, navigation }: TabBarProps) {
  const colors = useThemeStore((s) => s.colors);
  const insets = useSafeAreaInsets();
  const { width: anchoPantalla } = useWindowDimensions();
  const reducedMotion = useReducedMotion();

  // Se respeta el `tabBarStyle` de la pantalla enfocada solo para OCULTAR la barra: es como
  // app/(tabs)/index.tsx la esconde durante el onboarding y el selector de sesión (ver
  // showingGate ahí). Con una tabBar propia ese estilo ya no se aplica solo, así que se lee
  // a mano en vez de tocar esa pantalla.
  const estiloActiva = descriptors[state.routes[state.index].key]?.options.tabBarStyle as
    | { display?: string }
    | undefined;
  const oculta = estiloActiva?.display === 'none';

  // Math.max y no la resta a secas: `useWindowDimensions` devuelve 0 en el primer frame (en web
  // durante la hidratación, y en nativo en algún momento del montaje), y 0 - 36 daba un ancho
  // NEGATIVO. El navegador lo rechazaba con "<svg> attribute width: A negative value is not
  // valid (-36)", y peor: `siluetaConMuesca` calculaba entonces maxCx = -101 y construía un
  // trazo con coordenadas sin sentido. Encontrado en consola, no a ojo -- la barra acababa
  // pintándose bien un frame después, así que no se veía nada raro.
  const ancho = Math.max(0, anchoPantalla - MARGEN * 2);
  const paso = ancho / state.routes.length;
  const centroDe = (i: number) => paso * i + paso / 2;

  const cx = useSharedValue(centroDe(state.index));

  useEffect(() => {
    const destino = centroDe(state.index);
    // Mismo resorte que los chips: cambiar de pestaña y seleccionar un chip son el mismo
    // gesto conceptual, y ahora se mueven igual.
    cx.value = conResorte(destino, reducedMotion, resortes.ui);
    // centroDe depende de `ancho`, que cambia al rotar -- por eso va en deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.index, ancho, reducedMotion]);

  const animatedProps = useAnimatedProps(() => ({
    d: siluetaConMuesca(ancho, ALTO, cx.value),
  }));

  // `ancho <= 0` significa que la pantalla todavía no se ha medido. No se dibuja una barra de
  // ancho cero: no se vería, y evita alimentar geometría inválida al SVG.
  if (oculta || ancho <= 0) return null;

  return (
    <View
      style={[styles.wrap, { left: MARGEN, right: MARGEN, bottom: Math.max(insets.bottom, 10) }]}
      pointerEvents="box-none"
    >
      <Svg width={ancho} height={ALTO} style={StyleSheet.absoluteFill}>
        {/* Sin contorno: la separacion del fondo la da la sombra del contenedor (ver styles.wrap). */}
        <AnimatedPath animatedProps={animatedProps} fill={colors.surface} />
      </Svg>

      <View style={[styles.fila, { height: ALTO }]}>
        {state.routes.map((route, i) => {
          const { options } = descriptors[route.key];
          const enfocada = state.index === i;
          const tinte = enfocada ? colors.brand : colors.textSecondary;
          const etiqueta = options.title ?? route.name;

          const onPress = () => {
            const evento = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!enfocada && !evento.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              accessibilityRole="tab"
              accessibilityState={{ selected: enfocada }}
              accessibilityLabel={etiqueta}
              style={styles.item}
              hitSlop={6}
            >
              {/* NADA se desplaza en vertical. La primera versión subía el ícono activo para
                  "meterlo" en la cuchara, y eso estaba al revés: la muesca es un hueco, así que
                  subir el ícono lo dejaba flotando justo sobre el trazo del borde, cortado por
                  la curva. La cuchara va ENCIMA del ícono, no alrededor -- todo el contenido se
                  queda dentro de la barra y la fila entera baja unos píxeles para librarla. */}
              <View style={{ alignItems: 'center', gap: 3 }}>
                {options.tabBarIcon?.({ focused: enfocada, color: tinte, size: 24 })}
                <Text
                  numberOfLines={1}
                  style={[
                    styles.etiqueta,
                    { color: tinte, fontFamily: enfocada ? fonts.bodyBold : fonts.bodyRegular },
                  ]}
                >
                  {etiqueta}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    // La sombra va acá y no en el SVG: react-native-svg no proyecta sombra de la silueta, y
    // boxShadow sobre el contenedor sí sigue el recorte en los dos temas.
    boxShadow: '0px 6px 16px rgba(0, 0, 0, 0.16)',
  },
  // paddingTop: baja el contenido para que ni el ícono ni la etiqueta toquen la cuchara.
  fila: { flexDirection: 'row', alignItems: 'center', paddingTop: 8 },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  etiqueta: { fontSize: 11, letterSpacing: 0.1 },
});
