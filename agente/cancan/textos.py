"""Textos en pantalla (Minecraft Ten) como capa aparte, cuadro por cuadro y exactos a la partitura.

    python agente/orquesta/textos.py            → salida/textos/f_00000.png … (1080×1920 con alfa, sólo donde hay texto)
                                                   + salida/textos/lista.txt (qué cuadros tienen texto)

- Contador "NOTA {n} / DE 34.961": arriba, dentro de la zona segura (y 250–450), desde la primera nota (1.87 s). {n} = cuántos
  bloques sonaron hasta ese cuadro (rollo.json).
- Gancho "RUSH E / EN BLOQUES" en 0–1.8 s · "FALTAN {n}" sólo en la pausa (132.0–136.4) · final "34.961 NOTAS"
  desde 165.5 s. (Leo: el video NO dice que es mejor que hacerlo a mano; se quitó "A MANO: 42 A 56 SEMANAS".)
  Los textos y sus tiempos están en video.json → "textos" (los de arriba son los de Rush E); "faltan": null lo quita.
Todo lo que se escribe sale de facts.json o de la partitura.
"""
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

import video as V

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parents[1]
FUENTE = str(RAIZ / "texturas_mc" / "packs" / "fuentes" / "minecraft-ten.ttf")
W, H, FPS = 1080, 1920, V.FPS
CUADROS = V.CUADROS
TX = V.C["textos"]
GANCHO = [(150, 1060, (255, 214, 120)), (92, 1190, (255, 255, 255))]     # (tamaño, y, color) de cada línea del gancho
SALIDA = AQUI / "salida" / "textos"


def miles(n):
    return f"{n:,}".replace(",", ".")


def texto(d, x, y, s, tam, color=(255, 255, 255), sombra=(40, 22, 10), ancla="mm"):
    f = ImageFont.truetype(FUENTE, tam)
    o = max(3, tam // 14)                                   # sombra dura abajo a la derecha, como en Minecraft
    borde = max(3, tam // 18)                               # contorno oscuro: se lee sobre pasto claro, cielo y bloques
    d.text((x + o, y + o), s, font=f, fill=sombra + (220,), anchor=ancla, stroke_width=borde, stroke_fill=sombra + (220,))
    d.text((x, y), s, font=f, fill=color + (255,), anchor=ancla, stroke_width=borde, stroke_fill=(52, 30, 14, 255))


def halo(im, capas):
    """sombra oscura difuminada sólo alrededor de las letras: se lee sobre cielo claro sin tapar el cielo"""
    from PIL import ImageFilter
    capa = Image.new("RGBA", im.size, (0, 0, 0, 0))
    dd = ImageDraw.Draw(capa)
    for s, x, y, tam, col in capas:
        f = ImageFont.truetype(FUENTE, tam)
        dd.text((540, y), s, font=f, fill=(20, 12, 8, 255), anchor="mm", stroke_width=max(6, tam // 8), stroke_fill=(20, 12, 8, 255))
    capa = capa.filter(ImageFilter.GaussianBlur(max(6, capas[0][3] // 9)))
    a = capa.split()[3].point(lambda v: int(v * 0.6))
    capa.putalpha(a)
    im.alpha_composite(capa)


def banda(im, capas):
    """degradado oscuro suave detrás de los textos (técnico: ~1.000 cuadros del contador a < 3:1 sobre cielo y agua claros)"""
    ys = [y for _, _, y, tam, _ in capas]
    if not ys:
        return
    a, b = min(ys) - 90, max(ys) + 90
    capa = Image.new("RGBA", im.size, (0, 0, 0, 0))
    px = capa.load()
    for y in range(max(0, a - 60), min(H, b + 60)):
        f = 1.0 if a <= y <= b else max(0.0, 1 - min(abs(y - a), abs(y - b)) / 60)
        al = int(125 * f)                                 # técnico ronda 2: con 70 bajaba de 3:1 sobre cielo claro
        for x in range(W):
            px[x, y] = (10, 8, 20, al)
    im.alpha_composite(capa)


def main():
    golpes = sorted(json.loads((AQUI / "rollo.json").read_text(encoding="utf-8"))["golpes"] +
                    json.loads((AQUI / "climax.json").read_text(encoding="utf-8"))["golpes"])      # río + ecualizador
    facts = json.loads((AQUI / "facts.json").read_text(encoding="utf-8"))
    total = len(golpes)
    ts = [g[0] for g in golpes]
    SALIDA.mkdir(parents=True, exist_ok=True)
    import bisect
    hechos, ultimo = [], None
    for c in range(CUADROS):
        t = c / FPS
        n = bisect.bisect_right(ts, t + 1e-6)
        capas = []
        g, cont, fal, cie = TX["gancho"], TX["contador"], TX.get("faltan"), TX["cierre"]
        if t < g["hasta"]:                              # abajo: no tapa la ola
            capas += [(s, 540, y, tam, col) for s, (tam, y, col) in zip(g["lineas"], GANCHO)]
        if t >= ts[0] - 1e-6 and t < cont["hasta"]:
            capas += [(f"NOTA {miles(n)}", 540, 330, 86, (255, 255, 255)), (f"DE {miles(total)}", 540, 440, 74, (255, 236, 196))]
        if fal and fal["desde"] <= t < fal["hasta"]:    # sólo en la pausa (crítico mudo: "sale dos veces y luego nunca")
            capas += [(f"FALTAN {miles(total - n)}", 540, 760, 96, (255, 214, 120))]
        if t >= cie["desde"]:
            capas += [(f"{miles(total)}", 540, 640, 190, (255, 255, 255)), (cie["palabra"], 540, 800, 110, (255, 226, 170))]
        clave = json.dumps([x[:3] for x in capas])
        ruta = SALIDA / f"f_{c:05d}.png"
        if capas:
            if clave != ultimo:
                im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
                halo(im, capas)                       # Leo: la banda oscura se veía como "cielo café gris feo"
                d = ImageDraw.Draw(im)
                for s, x, y, tam, col in capas:
                    texto(d, 540, y, s, tam, col)
                im.save(ruta, optimize=True)
                ultimo_ruta = ruta
            else:
                ruta = ultimo_ruta
            hechos.append((c, ruta.name))
        ultimo = clave
    # lista para ffmpeg (concat demuxer): un PNG por cuadro, con su duración de 1/30 s
    lineas = []
    vacio = SALIDA / "vacio.png"
    Image.new("RGBA", (W, H), (0, 0, 0, 0)).save(vacio)
    mapa = dict(hechos)
    for c in range(CUADROS):
        lineas += [f"file '{mapa.get(c, 'vacio.png')}'", f"duration {1 / FPS:.6f}"]
    lineas.append(f"file '{mapa.get(CUADROS - 1, 'vacio.png')}'")
    (SALIDA / "lista.txt").write_text("\n".join(lineas) + "\n", encoding="utf-8")
    print(f"{len(hechos)} cuadros con texto · {len(set(mapa.values()))} imágenes distintas · total {miles(total)} notas")


if __name__ == "__main__":
    main()
