"""Objetos a medida para los TikToks: cualquier cosa hecha de bloques (efecto `voxel`) y cuadros con imagen (efecto `cuadro`).
No hay que limitarse a Minecraft vanilla: un teléfono plegable, una ballena de 33 bloques, un cohete o un meme en una
pintura. Todo queda como datos (cajas de colores), así sale igual en la hoja y en el render.

  Biblioteca:  tiktok/modelos/<nombre>.json   {"nombre", "tam": [ancho, alto, fondo], "cajas": [[x, y, z, w, h, d, "#color", brilla?], …]}
               (bloques; x, z centrados; y = 0 la base). En el guion: {"receta": "objeto", "modelo": "<nombre>"} o, en
               cualquier toma, "fx": [{"tipo": "voxel", "modelo": "<nombre>", "pos": [x, y, z], …}].
  Imágenes:    tiktok/imagenes/<nombre>.png   (para "cuadro"; `pixelar` les da el look de Minecraft)

  python tiktok/motor/modelos.py lista
  python tiktok/motor/modelos.py base                      regenera los modelos de ejemplo (teléfono, ballena, cohete, trofeo…)
  python tiktok/motor/modelos.py dibujo <nombre> <archivo.txt> [prof]   arte ASCII + paleta → modelo de bloques y PNG
  python tiktok/motor/modelos.py imagen <nombre> <img> <ancho_bloques> [prof]   una imagen (con transparencia) → modelo extruido
  python tiktok/motor/modelos.py pixelar <img> <nombre> [lado] [colores]        imagen → tiktok/imagenes/<nombre>.png pixelada

Formas para armar modelos desde Python: caja, cilindro, esfera, cono, desde_grilla (voxeles → cajas, unidas por filas)."""
import json
import math
import os
import sys

MOTOR = os.path.dirname(os.path.abspath(__file__))
TT = os.path.dirname(MOTOR)
DIR_MODELOS = os.path.join(TT, "modelos")
DIR_IMAGENES = os.path.join(TT, "imagenes")


# ───────────── formas ─────────────
def caja(x, y, z, w, h, d, color, brilla=0):
    c = [round(x, 3), round(y, 3), round(z, 3), round(w, 3), round(h, 3), round(d, 3), color]
    return c + [brilla] if brilla else c


def desde_grilla(vox, paso=1.0, ox=0.0, oy=0.0, oz=0.0):
    """{(i, j, k): (color, brilla)} → cajas, uniendo voxeles contiguos del mismo color a lo largo de x (menos caras)"""
    cajas, vistos = [], set()
    for (i, j, k) in sorted(vox, key=lambda v: (v[1], v[2], v[0])):
        if (i, j, k) in vistos:
            continue
        col = vox[(i, j, k)]
        n = 1
        while (i + n, j, k) in vox and vox[(i + n, j, k)] == col and (i + n, j, k) not in vistos:
            n += 1
        for q in range(n):
            vistos.add((i + q, j, k))
        cajas.append(caja(ox + (i + n / 2) * paso, oy + j * paso, oz + (k + 0.5) * paso, n * paso, paso, paso, col[0], col[1]))
    return cajas


def centrar(cajas):
    """x, z centrados y la base en y = 0; devuelve (cajas, tam)"""
    xs = [c[0] - c[3] / 2 for c in cajas] + [c[0] + c[3] / 2 for c in cajas]
    zs = [c[2] - c[5] / 2 for c in cajas] + [c[2] + c[5] / 2 for c in cajas]
    y0 = min(c[1] for c in cajas)
    cx, cz = (min(xs) + max(xs)) / 2, (min(zs) + max(zs)) / 2
    out = [[round(c[0] - cx, 3), round(c[1] - y0, 3), round(c[2] - cz, 3), *c[3:]] for c in cajas]
    alto = max(c[1] + c[4] for c in out)
    return out, [round(max(xs) - min(xs), 2), round(alto, 2), round(max(zs) - min(zs), 2)]


def cilindro(cx, y, cz, r, h, color, eje="y", paso=0.25, brilla=0):
    """cilindro de voxeles de `paso` (eje y vertical, o z acostado)"""
    vox = {}
    n = int(math.ceil(r / paso))
    for a in range(-n, n):
        for b in range(-n, n):
            if (a + 0.5) ** 2 + (b + 0.5) ** 2 <= (r / paso) ** 2:
                for c in range(int(round(h / paso))):
                    vox[(a, c, b) if eje == "y" else (a, b, c)] = (color, brilla)
    return desde_grilla(vox, paso, cx, y, cz) if eje == "y" else desde_grilla(vox, paso, cx, y + r, cz - h / 2)


def esfera(cx, cy, cz, r, color, paso=0.25, brilla=0, escala=(1, 1, 1)):
    vox = {}
    sx, sy, sz = escala
    n = int(math.ceil(r * max(escala) / paso)) + 1
    for i in range(-n, n):
        for j in range(-n, n):
            for k in range(-n, n):
                x, y, z = (i + 0.5) * paso / sx, (j + 0.5) * paso / sy, (k + 0.5) * paso / sz
                if x * x + y * y + z * z <= r * r:
                    vox[(i, j, k)] = (color, brilla)
    return desde_grilla(vox, paso, cx, cy, cz)


def cono(cx, y, cz, r, h, color, paso=0.25, brilla=0):
    vox = {}
    capas = int(round(h / paso))
    for c in range(capas):
        rr = r * (1 - c / capas) / paso
        n = int(math.ceil(rr))
        for a in range(-n, n):
            for b in range(-n, n):
                if (a + 0.5) ** 2 + (b + 0.5) ** 2 <= rr * rr:
                    vox[(a, c, b)] = (color, brilla)
    return desde_grilla(vox, paso, cx, y, cz)


# ───────────── biblioteca ─────────────
def guardar(nombre, cajas, nota=""):
    cajas, tam = centrar(cajas)
    os.makedirs(DIR_MODELOS, exist_ok=True)
    datos = {"nombre": nombre, "tam": tam, "nota": nota, "cajas": cajas}
    with open(os.path.join(DIR_MODELOS, nombre + ".json"), "w", encoding="utf-8") as f:
        json.dump(datos, f, ensure_ascii=False, separators=(",", ":"))
    return datos


def cargar(nombre):
    ruta = os.path.join(DIR_MODELOS, nombre + ".json")
    if not os.path.exists(ruta):
        raise FileNotFoundError(f"no hay modelo '{nombre}' en tiktok/modelos/ (python tiktok/motor/modelos.py lista)")
    with open(ruta, encoding="utf-8") as f:
        return json.load(f)


def lista():
    if not os.path.isdir(DIR_MODELOS):
        return []
    return sorted(f[:-5] for f in os.listdir(DIR_MODELOS) if f.endswith(".json"))


# ───────────── dibujos: arte ASCII o imagen → bloques ─────────────
def leer_dibujo(ruta):
    """archivo de texto: primero la paleta ("x = #ff0000" o "x = #ff0000 brilla 2"), una línea vacía y luego el dibujo
    (un carácter por pixel; espacio o "." = vacío)"""
    pal, filas, en_dibujo = {}, [], False
    for linea in open(ruta, encoding="utf-8").read().splitlines():
        if not en_dibujo:
            if not linea.strip():
                en_dibujo = bool(pal)
                continue
            k, v = linea.split("=", 1)
            partes = v.split()
            pal[k.strip()] = (partes[0], float(partes[2]) if len(partes) > 2 and partes[1] == "brilla" else 0)
        else:
            filas.append(linea)
    return pal, filas


def dibujo_a_modelo(nombre, pal, filas, prof=1, paso=0.25):
    vox = {}
    alto = len(filas)
    for j, fila in enumerate(filas):
        for i, ch in enumerate(fila):
            if ch in pal:
                for k in range(prof):
                    vox[(i, alto - 1 - j, k)] = pal[ch]
    return guardar(nombre, desde_grilla(vox, paso), f"dibujo {len(filas[0]) if filas else 0}×{alto} px, paso {paso}")


def dibujo_a_png(nombre, pal, filas, escala=16):
    from PIL import Image
    w, h = max(len(f) for f in filas), len(filas)
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    for j, fila in enumerate(filas):
        for i, ch in enumerate(fila):
            if ch in pal:
                c = pal[ch][0].lstrip("#")
                im.putpixel((i, j), (int(c[0:2], 16), int(c[2:4], 16), int(c[4:6], 16), 255))
    os.makedirs(DIR_IMAGENES, exist_ok=True)
    ruta = os.path.join(DIR_IMAGENES, nombre + ".png")
    im.resize((w * escala, h * escala), Image.NEAREST).save(ruta)
    return ruta


def imagen_a_modelo(nombre, img, ancho_bloques, prof=1, max_px=48):
    """imagen con transparencia → modelo extruido (cada pixel opaco = un voxel de ancho_bloques / ancho_px)"""
    from PIL import Image
    im = Image.open(img).convert("RGBA")
    k = max(im.width, im.height) / max_px
    if k > 1:
        im = im.resize((round(im.width / k), round(im.height / k)), Image.NEAREST)
    paso = ancho_bloques / im.width
    vox = {}
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = im.getpixel((x, y))
            if a > 128:
                col = (f"#{r >> 4 << 4:02x}{g >> 4 << 4:02x}{b >> 4 << 4:02x}", 0)        # 16 niveles: une más cajas
                for z in range(prof):
                    vox[(x, im.height - 1 - y, z)] = col
    return guardar(nombre, desde_grilla(vox, paso), f"imagen {os.path.basename(img)} {im.width}×{im.height} px")


def pixelar(img, nombre, lado=48, colores=32):
    """imagen → tiktok/imagenes/<nombre>.png con look de Minecraft (pocos pixeles y pocos colores, escalada sin suavizar)"""
    from PIL import Image
    im = Image.open(img).convert("RGBA")
    k = max(im.width, im.height) / lado
    peq = im.resize((max(1, round(im.width / k)), max(1, round(im.height / k))), Image.BOX)
    rgb = peq.convert("RGB").quantize(colors=colores, method=Image.Quantize.MEDIANCUT).convert("RGBA")
    rgb.putalpha(peq.getchannel("A"))
    os.makedirs(DIR_IMAGENES, exist_ok=True)
    ruta = os.path.join(DIR_IMAGENES, nombre + ".png")
    rgb.resize((rgb.width * 16, rgb.height * 16), Image.NEAREST).save(ruta)
    return ruta


# ───────────── modelos de ejemplo (1 bloque = 1 m) ─────────────
def base():
    hechos = []
    # teléfono plegable abierto (pantalla que brilla), a escala de mano grande: ~0.6 × 0.9 bloques
    t = [caja(0, 0, 0, 0.62, 0.9, 0.05, "#1d1f24"),
         caja(0, 0.03, 0.028, 0.56, 0.84, 0.01, "#4fa9ff", 1.4),
         caja(0, 0.03, 0.034, 0.012, 0.84, 0.004, "#2a3d55"),            # el pliegue
         caja(0.18, 0.72, -0.04, 0.16, 0.12, 0.04, "#30333a")]           # cámaras
    hechos.append(guardar("telefono_plegable", t, "teléfono plegable abierto; pantalla con brillo"))
    # ballena azul de 33 bloques (33 m: NOAA, hasta ~110 ft), cuerpo de elipsoides en voxeles de 0.5
    cuerpo = []
    for z, r, y in [(-14, 2.2, 0.9), (-9, 3.0, 0.7), (-3, 3.3, 0.6), (3, 3.0, 0.7), (8, 2.4, 0.9), (12, 1.6, 1.2), (15, 0.9, 1.4)]:
        cuerpo += esfera(0, r * 0.9 + 0.3, z, r, "#4a6f9c", paso=0.5, escala=(1, 0.8, 1.6))
    cuerpo += esfera(0, 1.2, -13, 2.0, "#c9d6e3", paso=0.5, escala=(1, 0.5, 1.5))            # panza clara
    cuerpo += [caja(0, 1.6, 17, 6, 0.4, 1.6, "#3d5f88"),                                     # cola
               caja(-3.4, 1.2, -6, 2.2, 0.3, 1.2, "#3d5f88"), caja(3.4, 1.2, -6, 2.2, 0.3, 1.2, "#3d5f88"),   # aletas
               caja(-1.9, 3.0, -15.2, 0.4, 0.4, 0.3, "#111111"), caja(1.9, 3.0, -15.2, 0.4, 0.4, 0.3, "#111111")]
    hechos.append(guardar("ballena_azul", cuerpo, "33 bloques de largo (≈ 33 m); mira a −z"))
    # cohete (Saturno V a escala 1:4 ≈ 27.7 bloques sería enorme: éste mide 12)
    c = cilindro(0, 0, 0, 1.0, 9, "#f2f2f2", paso=0.25) + cilindro(0, 3, 0, 1.02, 0.6, "#222222", paso=0.25) + \
        cono(0, 9, 0, 1.0, 2.6, "#d8342c", paso=0.25)
    for ang in (0, 90, 180, 270):
        dx, dz = round(math.sin(math.radians(ang)) * 1.2, 2), round(math.cos(math.radians(ang)) * 1.2, 2)
        c.append(caja(dx, 0, dz, 0.2 if dz else 0.9, 2.0, 0.9 if dz else 0.2, "#d8342c"))
    c.append(caja(0, -0.6, 0, 1.0, 0.6, 1.0, "#ffb347", 2.5))                                # fuego (brilla)
    hechos.append(guardar("cohete", c, "12 bloques; el fuego brilla"))
    # trofeo dorado
    tr = cilindro(0, 0, 0, 0.45, 0.25, "#5b3a1e", paso=0.125) + cilindro(0, 0.25, 0, 0.12, 0.5, "#e8b923", paso=0.125) + \
        cilindro(0, 0.75, 0, 0.4, 0.55, "#f4c430", paso=0.125)
    tr += [caja(-0.5, 0.85, 0, 0.12, 0.35, 0.12, "#e8b923"), caja(0.5, 0.85, 0, 0.12, 0.35, 0.12, "#e8b923")]
    hechos.append(guardar("trofeo", tr, "copa dorada de 1.3 bloques"))
    # foco (para la luz prendida): bombilla que brilla
    fo = esfera(0, 0.55, 0, 0.32, "#fff3a0", paso=0.08, brilla=2.2) + cilindro(0, 0, 0, 0.16, 0.3, "#9a9a9a", paso=0.08)
    hechos.append(guardar("foco", fo, "foco prendido (brilla)"))
    # pantalla grande / tele para mostrar un cuadro encima
    hechos.append(guardar("tele", [caja(0, 0.0, 0, 0.5, 0.9, 0.3, "#2b2b2b"), caja(0, 0.9, 0, 3.2, 1.9, 0.18, "#151515")], "tele de 3.2 × 1.9; pon un cuadro delante (luz 1.3)"))
    return [(h["nombre"], h["tam"], len(h["cajas"])) for h in hechos]


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    a = sys.argv[1:]
    if not a or a[0] in ("-h", "--help"):
        print(__doc__)
    elif a[0] == "lista":
        for n in lista():
            m = cargar(n)
            print(f"{n:22} {m['tam']}  {len(m['cajas'])} cajas  {m.get('nota', '')}")
    elif a[0] == "base":
        for fila in base():
            print(*fila)
    elif a[0] == "dibujo":
        pal, filas = leer_dibujo(a[2])
        m = dibujo_a_modelo(a[1], pal, filas, int(a[3]) if len(a) > 3 else 1)
        print(m["tam"], len(m["cajas"]), "cajas ·", dibujo_a_png(a[1], pal, filas))
    elif a[0] == "imagen":
        m = imagen_a_modelo(a[1], a[2], float(a[3]), int(a[4]) if len(a) > 4 else 1)
        print(m["tam"], len(m["cajas"]), "cajas")
    elif a[0] == "pixelar":
        print(pixelar(a[1], a[2], int(a[3]) if len(a) > 3 else 48, int(a[4]) if len(a) > 4 else 32))
