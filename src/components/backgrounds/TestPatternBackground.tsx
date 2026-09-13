import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

interface TestPatternBackgroundProps {
  width: number;
  height: number;
}

/**
 * Barras de color tipo carta de ajuste de TV -- el fondo de los estados de "no se pudo
 * cargar" (imagen de referencia mandada por el usuario, 2026-09-09).
 *
 * Es el ÚNICO fondo del sistema que no reacciona al tema. Los otros tres
 * (HalftoneWave/DotGrid/StaticClearing) se calibran contra el fondo claro u oscuro porque son
 * textura de la app; éste no es textura, es una CITA: la pantalla que sale cuando la señal se
 * cae. Una carta de ajuste que cambia de color con el tema deja de leerse como tal.
 *
 * Por eso mismo va con caja negra encima para el texto (ver ErrorPanel en SwipeDeck): sobre
 * las barras no hay ningún color de texto que contraste en las siete columnas a la vez --
 * blanco desaparece sobre la barra blanca, negro desaparece sobre la azul. La caja no es
 * decoración, es lo que hace legible el mensaje.
 *
 * Dibujado como SVG y no como archivo de imagen: escala a cualquier tamaño de pantalla sin
 * pixelarse ni cargar un asset, que es el mismo criterio de los otros tres fondos.
 */
export function TestPatternBackground({ width, height }: TestPatternBackgroundProps) {
  // Proporciones tomadas de la imagen de referencia: barras grandes, franja de croma
  // invertido, rampa de grises y la banda inferior.
  const barsH = height * 0.783;
  const chromaH = height * 0.047;
  const rampH = height * 0.06;
  const chromaY = barsH;
  const rampY = chromaY + chromaH;
  const bottomY = rampY + rampH;
  const bottomH = height - bottomY;

  const col = width / 7;

  const bars = ['#FFFFFF', '#FFE500', '#00EFF2', '#1CDF00', '#F93FF2', '#F52516', '#0F00DC'];
  // Croma invertido: el orden clásico deja negro entre cada color, no es una secuencia al azar.
  const chroma = ['#0F00DC', '#000000', '#F93FF2', '#000000', '#00EFF2', '#000000', '#FFFFFF'];
  // Escalones discretos de la mitad derecha de la rampa, de blanco a negro.
  const steps = ['#FFFFFF', '#DDDDDD', '#B4B4B4', '#8C8C8C', '#666666', '#414141', '#1E1E1E'];

  const rampSplit = width * 0.5;
  const stepW = (width - rampSplit) / steps.length;

  return (
    <Svg width={width} height={height}>
      <Defs>
        {/* La mitad izquierda de la rampa es un degradado continuo, no escalones -- es la
            diferencia que la carta de ajuste original usa para comparar respuesta continua
            contra discreta. */}
        <LinearGradient id="grayRamp" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#FFFFFF" />
          <Stop offset="1" stopColor="#000000" />
        </LinearGradient>
      </Defs>

      {/* Base negra: si alguna banda no cubre por redondeo, debajo hay negro y no el fondo
          de la app asomándose. */}
      <Rect x={0} y={0} width={width} height={height} fill="#000000" />

      {bars.map((fill, i) => (
        <Rect key={`bar-${fill}-${i}`} x={i * col} y={0} width={col + 1} height={barsH} fill={fill} />
      ))}

      {chroma.map((fill, i) => (
        <Rect key={`chroma-${fill}-${i}`} x={i * col} y={chromaY} width={col + 1} height={chromaH} fill={fill} />
      ))}

      <Rect x={0} y={rampY} width={rampSplit} height={rampH} fill="url(#grayRamp)" />
      {steps.map((fill, i) => (
        <Rect
          key={`step-${fill}-${i}`}
          x={rampSplit + i * stepW}
          y={rampY}
          width={stepW + 1}
          height={rampH}
          fill={fill}
        />
      ))}

      <Rect x={0} y={bottomY} width={width * 0.162} height={bottomH} fill="#333333" />
      <Rect x={width * 0.162} y={bottomY} width={width * 0.176} height={bottomH} fill="#000000" />
      <Rect x={width * 0.338} y={bottomY} width={width * 0.162} height={bottomH} fill="#555555" />
      <Rect x={width * 0.5} y={bottomY} width={width * 0.5} height={bottomH} fill="#000000" />
    </Svg>
  );
}
