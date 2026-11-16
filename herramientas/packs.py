"""Copia de TUS packs descargados lo que usa el tráiler, a texturas_mc/packs/ (solo para tu computadora):
  - Bare Bones (texturas "como los tráileres"): bloques, ambiente y mobs, resolviendo sus carpetas overlay_* por versión.
  - Fresh Animations (FreshLX): modelos .jem y animaciones .jpm de los mobs (formato OptiFine CEM / EMF) y sus texturas.
  - mezcla/: textura de cada mob = Bare Bones encima y, donde Bare Bones está vacío, los pixeles extra que Fresh
    Animations necesita (ojos, párpados), igual que cuando se ponen los dos packs juntos en el juego.
Uso: python herramientas/packs.py [carpeta_del_proyecto] [zip_bare_bones] [zip_fresh_animations]
  - fuentes/minecraft-ten.ttf: la fuente "Minecraft Ten" de Mojang (títulos de los tráileres), copiada de TU Minecraft
    Bedrock instalado (data/resource_packs/vanilla/font). © Mojang AB, todos los derechos reservados: solo para tu PC.
Fresh Animations: © FreshLX, uso personal y en videos con crédito (ver FAterms&conditions.txt dentro del zip).
No se redistribuye nada: los zips se leen de tu carpeta de Descargas."""
import io
import json
import os
import re
import sys
import zipfile

from PIL import Image

DESCARGAS = os.path.join(os.path.expanduser("~"), "Downloads")
OVERLAYS = ["overlay_1_21_11", "overlay_1_21_9", "overlay_1_21_6", "overlay_1_21_5", "overlay_1_21_4", "overlay_1_21_2", ""]
MOBS_CEM = ["wolf", "wolf_armor", "chicken", "sheep", "sheep_wool", "goat", "villager", "glow_squid", "strider", "llama",
            "llama_decor", "happy_ghast_baby", "happy_ghast", "happy_ghast_harness"]
# textura de cada modelo: [ruta en Bare Bones (sin "textures/entity/"), ruta en Fresh Animations]
TEXTURAS = {
    "wolf": ["wolf/wolf.png", "wolf/wolf.png"],
    "wolf_armor": ["equipment/wolf_body/armadillo_scute.png", None],
    "wolf_armor_overlay": ["equipment/wolf_body/armadillo_scute_overlay.png", None],
    "chicken": ["chicken/temperate_chicken.png", "chicken/chicken_temperate.png"],
    "sheep": ["sheep/sheep.png", "sheep/sheep.png"],
    "sheep_wool": ["sheep/sheep_wool.png", None],
    "goat": ["goat/goat.png", "goat/goat.png"],
    "villager": ["villager/villager.png", "villager/villager.png"],
    "villager_plains": ["villager/type/plains.png", None],
    "villager_farmer": ["villager/profession/farmer.png", None],
    "glow_squid": ["squid/glow_squid.png", "squid/glow_squid.png"],
    "strider": ["strider/strider.png", "strider/strider.png"],
    "llama_creamy": ["llama/creamy.png", "llama/llama_creamy.png"],
    "happy_ghast_baby": ["ghast/happy_ghast_baby.png", "ghast/happy_ghast_baby.png"],
    "happy_ghast_harness_red": ["equipment/happy_ghast_body/red_harness.png", None],
}


def buscar_zip(patron):
    if not os.path.isdir(DESCARGAS):
        return None
    for n in sorted(os.listdir(DESCARGAS), reverse=True):
        if re.search(patron, n, re.I) and n.lower().endswith(".zip"):
            return os.path.join(DESCARGAS, n)
    return None


def buscar_fuente_ten():
    """minecraft-ten.ttf dentro de Minecraft Bedrock (Xbox app / Microsoft Store)."""
    rel = os.path.join("Content", "data", "resource_packs", "vanilla", "font", "minecraft-ten.ttf")
    for raiz in [r"C:\XboxGames", r"D:\XboxGames", r"E:\XboxGames"]:
        if os.path.isdir(raiz):
            for n in os.listdir(raiz):
                p = os.path.join(raiz, n, rel)
                if os.path.isfile(p):
                    return p
    return None


def limpiar_cara_aldeano(im):
    """Bare Bones pinta uniceja, ojos y boca en la cara del aldeano; Fresh Animations los dibuja aparte como partes que se
    mueven (cejas, ojos, boca, con su textura en 13..21 × 19..24) y su propia cara viene lisa. Con los dos packs salían
    dos unicejas (muy visible en el aldeanito, cuyas cejas FA baja). Aquí la cara de Bare Bones queda lisa por dentro,
    con su color de piel; los costados (patillas) se conservan."""
    px = im.load()
    cara = [px[x, y] for x in range(8, 16) for y in range(8, 18)]
    piel = max(set(cara), key=cara.count)
    for y in range(12, 18):
        for x in range(9, 15):
            p = px[x, y]
            if sum(abs(p[i] - piel[i]) for i in range(3)) > 40:
                px[x, y] = piel


def main():
    proyecto = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    zbb = sys.argv[2] if len(sys.argv) > 2 else buscar_zip(r"bare\s*bones")
    zfa = sys.argv[3] if len(sys.argv) > 3 else buscar_zip(r"fresh\s*animations")
    if not zbb or not zfa:
        return {"ok": False, "error": "No encontré los zips de Bare Bones y Fresh Animations en Descargas"}
    destino = os.path.join(proyecto, "texturas_mc", "packs")
    bb, fa = zipfile.ZipFile(zbb), zipfile.ZipFile(zfa)
    nbb, nfa = set(bb.namelist()), set(fa.namelist())

    def leer_bb(ruta):                       # el overlay más nuevo gana, como en el juego
        for o in OVERLAYS:
            r = (o + "/" if o else "") + "assets/minecraft/" + ruta
            if r in nbb:
                return bb.read(r)
        return None

    def escribir(rel, datos):
        p = os.path.join(destino, rel)
        os.makedirs(os.path.dirname(p), exist_ok=True)
        with open(p, "wb") as f:
            f.write(datos)

    # bloques y ambiente de Bare Bones (todas las texturas de bloque: el mundo elige las que usa)
    bloques = sorted({re.sub(r"^(overlay_[^/]+/)?assets/minecraft/textures/block/", "", n) for n in nbb
                      if re.match(r"^(overlay_[^/]+/)?assets/minecraft/textures/block/[^/]+\.png$", n)})
    for b in bloques:
        escribir("barebones/block/" + b, leer_bb("textures/block/" + b))
    amb = []
    for n in ["environment/clouds.png", "environment/celestial/moon/full_moon.png", "environment/moon_phases.png", "environment/sun.png",
              "environment/celestial/sun.png"]:
        d = leer_bb("textures/" + n)
        if d:
            escribir("barebones/environment/" + os.path.basename(n), d)
            amb.append(os.path.basename(n))
    # modelos y animaciones de Fresh Animations
    cem = []
    for m in MOBS_CEM:
        for ext in (".jem", "_animations.jpm", ".properties"):
            r = "assets/minecraft/optifine/cem/" + m + ext
            if r in nfa:
                escribir("fresh/cem/" + m + ext, fa.read(r))
                cem.append(m + ext)
    # texturas mezcladas (Bare Bones encima, Fresh Animations debajo)
    mezcla = {}
    for clave, (rbb, rfa) in TEXTURAS.items():
        dbb = leer_bb("textures/entity/" + rbb) if rbb else None
        dfa = fa.read("assets/minecraft/textures/entity/" + rfa) if rfa and "assets/minecraft/textures/entity/" + rfa in nfa else None
        if not dbb and not dfa:
            continue
        ibb = Image.open(io.BytesIO(dbb)).convert("RGBA") if dbb else None
        ifa = Image.open(io.BytesIO(dfa)).convert("RGBA") if dfa else None
        if ibb and ifa:
            if ifa.size != ibb.size:              # misma proporción de UV: llevar Fresh Animations al tamaño de Bare Bones
                ifa = ifa.resize(ibb.size, Image.NEAREST)
            out = ifa.copy()
            out.alpha_composite(ibb)
            # donde Bare Bones tiene un pixel opaco, manda Bare Bones (sin mezclar bordes)
            pb, po = ibb.load(), out.load()
            for y in range(ibb.height):
                for x in range(ibb.width):
                    if pb[x, y][3] > 0:
                        po[x, y] = pb[x, y]
        else:
            out = ibb or ifa
        if clave == "villager" and ibb and ifa:
            limpiar_cara_aldeano(out)
        buf = io.BytesIO()
        out.save(buf, "PNG")
        escribir("mezcla/entity/" + clave + ".png", buf.getvalue())
        mezcla[clave] = {"tam": list(out.size), "barebones": bool(ibb), "fresh": bool(ifa)}
    # fuente de los títulos: Minecraft Ten de tu Bedrock (si no está, los títulos usan la fuente pixel de respaldo)
    ften = buscar_fuente_ten()
    if ften:
        with open(ften, "rb") as f:
            escribir("fuentes/minecraft-ten.ttf", f.read())
    indice = {"barebones": os.path.basename(zbb), "fresh": os.path.basename(zfa), "bloques": len(bloques), "ambiente": amb,
              "cem": cem, "mezcla": mezcla, "fuente": "minecraft-ten.ttf" if ften else None}
    with open(os.path.join(destino, "indice.json"), "w", encoding="utf-8") as f:
        json.dump(indice, f, ensure_ascii=False, indent=1)
    return {"ok": True, **{k: v for k, v in indice.items() if k != "mezcla"}, "mezcla": list(mezcla)}


if __name__ == "__main__":
    try:
        r = main()
    except Exception as e:
        r = {"ok": False, "error": f"{type(e).__name__}: {e}"}
    print(json.dumps(r, ensure_ascii=False))
