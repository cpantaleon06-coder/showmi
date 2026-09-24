# -*- coding: utf-8 -*-
"""
Genera los iconos de la app a partir de la identidad que YA tiene el proyecto.

POR QUE EXISTE (2026-09-24): hasta hoy `assets/icon.png` y los tres de Android eran el icono
POR DEFECTO de Expo -- el chevron azul de la plantilla. El de iOS ademas traia las guias de
construccion dibujadas encima (circulos, lineas punteadas y la cruz del centro), o sea que el
icono que se veria en la tienda y en el cajon de apps era literalmente un archivo de andamio.

DE DONDE SALE EL DISENO. Showmi no tiene un logotipo vectorial en el repo; lo que tiene es el
wordmark, seis letras con su color muestreado (theme/wordmark.ts) y el degradado de marca
(NAGAI_GRADIENT en theme/colors.ts), que ya se usa en la cabecera de Perfil y en el paywall. El
icono se arma con esas dos cosas y con la MISMA tipografia de display de la app (Archivo Black,
la que ya viene en node_modules), asi que no inventa identidad nueva: reusa la que existe.

POR QUE UNA SOLA LETRA Y NO LAS SEIS. La tarjeta del Perfil enseña las seis letras en rejilla,
pero un icono se mira a 48 puntos en una pantalla llena de iconos: seis letras ahi son una
mancha. Una sola "S" en Archivo Black se lee a cualquier tamaño, y el degradado de tres paradas
es lo que impide que sea "la S de cualquiera".

SI APARECE EL LOGOTIPO ORIGINAL, ESTO SE TIRA. theme/wordmark.ts ya advierte que su paleta se
saco de un muestreo visual y no de un archivo fuente. El dia que exista el AI/SVG/Figma del
wordmark, el icono deberia salir de ahi y este script sobra.

Uso:  python scripts/generar-iconos.py
"""
import os
from PIL import Image, ImageDraw, ImageFont

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(RAIZ, 'assets')
FUENTE = os.path.join(
    RAIZ, 'node_modules', '@expo-google-fonts', 'archivo-black', '400Regular',
    'ArchivoBlack_400Regular.ttf',
)

# Mismas tres paradas que NAGAI_GRADIENT en src/theme/colors.ts, en el mismo orden.
PARADAS = [(0.0, '#FF8C5A'), (0.5, '#D9718C'), (1.0, '#0F6E7D')]
LETRA = 'S'
LADO = 1024

# Cuanto del lienzo ocupa la letra en el icono a sangre (iOS y favicon).
ALTO_LETRA_PLENO = 0.56
# En el adaptativo de Android el sistema RECORTA: solo se garantiza el 66% central del lienzo.
# La letra se encoge para caber dentro de esa zona segura con holgura, o el recorte se la come.
ALTO_LETRA_ADAPTATIVO = 0.44


def hex_a_rgb(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


def degradado(lado):
    """Degradado diagonal, de esquina superior izquierda a inferior derecha.

    Es la misma direccion que usan los LinearGradient de la app (x1=0,y1=0 -> x2=1,y2=1), para
    que el icono y la cabecera de Perfil se vean cortados por la misma tela.
    """
    img = Image.new('RGB', (lado, lado))
    px = img.load()
    paradas = [(p, hex_a_rgb(c)) for p, c in PARADAS]
    for y in range(lado):
        for x in range(lado):
            # Posicion sobre la diagonal, normalizada a 0..1.
            t = (x + y) / (2.0 * (lado - 1))
            for i in range(len(paradas) - 1):
                p0, c0 = paradas[i]
                p1, c1 = paradas[i + 1]
                if p0 <= t <= p1:
                    k = 0 if p1 == p0 else (t - p0) / (p1 - p0)
                    px[x, y] = tuple(int(c0[j] + (c1[j] - c0[j]) * k) for j in range(3))
                    break
    return img


def dibujar_letra(img, fraccion_alto, color):
    """Centra la letra OPTICAMENTE, no por su caja de texto.

    La caja que devuelve PIL incluye el espaciado propio de la fuente, distinto arriba y abajo;
    centrando por ella la letra queda visiblemente alta. Se mide el trazo real (getbbox del
    glifo ya dibujado) y se centra eso.
    """
    lado = img.size[0]
    objetivo = lado * fraccion_alto

    # Se busca el tamaño de fuente cuyo TRAZO mida lo pedido, en vez de calcularlo: las metricas
    # nominales de Archivo Black no coinciden con el alto real de la S.
    tam = int(objetivo)
    for _ in range(40):
        f = ImageFont.truetype(FUENTE, tam)
        caja = f.getbbox(LETRA)
        alto = caja[3] - caja[1]
        if alto == 0:
            break
        factor = objetivo / alto
        if abs(factor - 1) < 0.005:
            break
        tam = max(8, int(tam * factor))
    fuente = ImageFont.truetype(FUENTE, tam)

    caja = fuente.getbbox(LETRA)
    ancho_trazo = caja[2] - caja[0]
    alto_trazo = caja[3] - caja[1]
    x = (lado - ancho_trazo) / 2 - caja[0]
    y = (lado - alto_trazo) / 2 - caja[1]
    ImageDraw.Draw(img).text((x, y), LETRA, font=fuente, fill=color)
    return img


def guardar(img, nombre):
    ruta = os.path.join(ASSETS, nombre)
    img.save(ruta, 'PNG')
    print('  %-32s %s  %d KB' % (nombre, 'x'.join(map(str, img.size)), os.path.getsize(ruta) // 1024))


def main():
    if not os.path.exists(FUENTE):
        raise SystemExit('No encuentro Archivo Black. Corre npm install primero.')

    print('Generando iconos desde el wordmark y NAGAI_GRADIENT:')
    fondo = degradado(LADO)

    # 1. Icono a sangre (iOS y el generico). El sistema le pone las esquinas redondeadas.
    guardar(dibujar_letra(fondo.copy(), ALTO_LETRA_PLENO, '#FFFFFF'), 'icon.png')

    # 2. Android adaptativo: fondo y primer plano son capas separadas que el sistema mueve una
    #    sobre otra, asi que el degradado va entero en el fondo y la letra sola, transparente.
    guardar(fondo.copy(), 'android-icon-background.png')
    capa = Image.new('RGBA', (LADO, LADO), (0, 0, 0, 0))
    guardar(dibujar_letra(capa, ALTO_LETRA_ADAPTATIVO, (255, 255, 255, 255)), 'android-icon-foreground.png')

    # 3. Monocromo (iconos tematizados de Android 13+): el sistema lo tiñe con el color del
    #    fondo de pantalla, asi que solo importa la silueta. Blanco sobre transparente.
    mono = Image.new('RGBA', (LADO, LADO), (0, 0, 0, 0))
    guardar(dibujar_letra(mono, ALTO_LETRA_ADAPTATIVO, (255, 255, 255, 255)), 'android-icon-monochrome.png')

    # 4. Favicon. Se genera a 1024 y se reduce con LANCZOS: dibujar la letra directamente a 48px
    #    la deja con los bordes rotos.
    guardar(dibujar_letra(fondo.copy(), ALTO_LETRA_PLENO, '#FFFFFF').resize((48, 48), Image.LANCZOS), 'favicon.png')


if __name__ == '__main__':
    main()
