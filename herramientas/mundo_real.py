"""Importa un pedazo de un mundo REAL de Minecraft Java (archivos de región .mca) como escenario del animador.

    python herramientas/mundo_real.py info  <carpeta_region>
    python herramientas/mundo_real.py importar <carpeta_region> <x0> <z0> <ancho> <largo> <nombre> [--y0 Y] [--alto H]
        → texturas_mc/mundos/<nombre>.bin (ids de bloque del animador, orden y-z-x) + <nombre>.json (tamaño, origen, bloques
          que no se reconocieron)

Sin dependencias: lector propio de NBT y del formato Anvil (1.18+: secciones con paleta y datos empaquetados en longs).
Sólo LEE el mundo (abre los .mca en modo lectura); trabaja mejor sobre una copia.
Cada bloque de Minecraft se traduce a uno de los bloques del animador (js/mundo.js → B); lo que no tiene equivalente
va al más parecido (piedras → piedra, flores raras → la flor más parecida) o a aire (decoración pequeña).
"""
import gzip, io, json, math, struct, sys, zlib
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]

# ───────────── NBT ─────────────
def _nbt(f, tipo):
    if tipo == 1: return struct.unpack(">b", f.read(1))[0]
    if tipo == 2: return struct.unpack(">h", f.read(2))[0]
    if tipo == 3: return struct.unpack(">i", f.read(4))[0]
    if tipo == 4: return struct.unpack(">q", f.read(8))[0]
    if tipo == 5: return struct.unpack(">f", f.read(4))[0]
    if tipo == 6: return struct.unpack(">d", f.read(8))[0]
    if tipo == 7: n = struct.unpack(">i", f.read(4))[0]; return f.read(n)
    if tipo == 8: n = struct.unpack(">H", f.read(2))[0]; return f.read(n).decode("utf-8", "replace")
    if tipo == 9:
        t, n = struct.unpack(">bi", f.read(5)); return [_nbt(f, t) for _ in range(n)]
    if tipo == 10:
        d = {}
        while True:
            t = f.read(1)[0]
            if t == 0: return d
            n = struct.unpack(">H", f.read(2))[0]; k = f.read(n).decode("utf-8", "replace")
            d[k] = _nbt(f, t)
    if tipo == 11: n = struct.unpack(">i", f.read(4))[0]; return struct.unpack(f">{n}i", f.read(4 * n))
    if tipo == 12: n = struct.unpack(">i", f.read(4))[0]; return struct.unpack(f">{n}q", f.read(8 * n))
    raise ValueError(f"tag NBT desconocido {tipo}")


def nbt(datos):
    f = io.BytesIO(datos)
    t = f.read(1)[0]
    n = struct.unpack(">H", f.read(2))[0]; f.read(n)
    return _nbt(f, t)


# ───────────── región (.mca) ─────────────
def chunks_region(ruta):
    """(cx, cz locales 0..31) → NBT del chunk"""
    d = Path(ruta).read_bytes()
    if len(d) < 8192:
        return {}
    out = {}
    for i in range(1024):
        off = int.from_bytes(d[i * 4:i * 4 + 3], "big"); sec = d[i * 4 + 3]
        if not off or not sec:
            continue
        p = off * 4096
        largo = struct.unpack(">I", d[p:p + 4])[0]; comp = d[p + 4]
        raw = d[p + 5:p + 4 + largo]
        if comp == 2: raw = zlib.decompress(raw)
        elif comp == 1: raw = gzip.decompress(raw)
        elif comp == 3: pass
        else: raise ValueError(f"compresión {comp} no soportada (¿LZ4? cambia region-file-compression a deflate)")
        out[(i % 32, i // 32)] = nbt(raw)
    return out


def bloques_seccion(sec):
    """devuelve (paleta [nombres], índices 4096 en orden y-z-x) o None si la sección es sólo aire"""
    bs = sec.get("block_states")
    if not bs:
        return None
    def nombre(p):                                   # {Name, Properties} o, en versiones nuevas, "minecraft:x[a=b,c=d]"
        if isinstance(p, dict) and set(p) == {""}:   # 1.21.5+: listas mixtas, cada elemento envuelto como {"": valor}
            p = p[""]
        if isinstance(p, str):
            n, _, pr = p.partition("[")
            return n.replace("minecraft:", "") + ("|" + ",".join(sorted(pr.rstrip("]").split(","))) if pr else "")
        n = p.get("Name") or p.get("id")                # 26.x: {id, properties}; antes: {Name, Properties}
        pr = p.get("Properties") or p.get("properties") or {}
        return n.replace("minecraft:", "") + ("|" + ",".join(f"{k}={v}" for k, v in sorted(pr.items())) if pr else "")
    pal = [nombre(p) for p in bs["palette"]]
    if "data" not in bs:
        return pal, [0] * 4096
    bits = max(4, math.ceil(math.log2(len(pal))))
    por = 64 // bits; mask = (1 << bits) - 1
    idx = []
    for v in bs["data"]:
        v &= (1 << 64) - 1
        for k in range(por):
            idx.append((v >> (k * bits)) & mask)
            if len(idx) == 4096:
                break
        if len(idx) == 4096:
            break
    return pal, idx


# ───────────── traducción a bloques del animador ─────────────
def traducir(nombre):
    """nombre de Minecraft (con |propiedades) → nombre de bloque del animador, o None = aire"""
    n, _, props = nombre.partition("|")
    arriba = "half=upper" in props
    exacto = {
        "grass_block": "pasto", "dirt": "tierra", "coarse_dirt": "tierra_gruesa", "rooted_dirt": "tierra", "podzol": "tierra_gruesa",
        "dirt_path": "camino", "farmland": "tierra", "mud": "tierra", "moss_block": "lima",
        "stone": "piedra", "cobblestone": "adoquin", "mossy_cobblestone": "adoquin", "andesite": "andesita", "polished_andesite": "andesita",
        "diorite": "calcita", "granite": "terracota", "deepslate": "oscuro", "tuff": "gris", "calcite": "calcita", "bedrock": "oscuro",
        "gravel": "grava", "sand": "arena", "red_sand": "terracota_naranja", "sandstone": "arena", "clay": "gris",
        "water": "agua", "bubble_column": "agua", "ice": "hielo", "packed_ice": "hielo", "blue_ice": "hielo", "snow_block": "nieve",
        "powder_snow": "nieve", "snow": "capa_nieve", "lava": "lava", "magma_block": "magma", "obsidian": "negro",
        "oak_log": "tronco", "oak_wood": "tronco", "dark_oak_log": "tronco", "jungle_log": "tronco", "acacia_log": "tronco", "mangrove_log": "tronco",
        "birch_log": "abedul_tronco", "birch_wood": "abedul_tronco", "spruce_log": "abeto_tronco", "spruce_wood": "abeto_tronco",
        "cherry_log": "cerezo", "cherry_wood": "cerezo",
        "oak_leaves": "hojas", "dark_oak_leaves": "hojas", "jungle_leaves": "hojas", "acacia_leaves": "hojas", "mangrove_leaves": "hojas",
        "birch_leaves": "abedul_hojas", "spruce_leaves": "abeto_hojas", "cherry_leaves": "cerezo_hojas",
        "azalea_leaves": "hojas_azalea", "flowering_azalea_leaves": "hojas_azalea", "azalea": "hojas_azalea", "flowering_azalea": "hojas_azalea",
        "short_grass": "pasto_corto", "grass": "pasto_corto", "fern": "pasto_corto", "dead_bush": "pasto_corto", "sweet_berry_bush": "pasto_corto",
        "tall_grass": "pasto_alto_arriba" if arriba else "pasto_alto", "large_fern": "pasto_alto_arriba" if arriba else "pasto_alto",
        "dandelion": "diente_leon", "poppy": "amapola", "oxeye_daisy": "margarita", "cornflower": "aciano", "allium": "allium",
        "azure_bluet": "margarita", "lily_of_the_valley": "margarita", "white_tulip": "margarita", "red_tulip": "amapola",
        "orange_tulip": "amapola", "pink_tulip": "allium", "blue_orchid": "aciano", "torchflower": "amapola",
        "pink_petals": "petalos", "wildflowers": "petalos", "leaf_litter": None,
        "seagrass": "pasto_marino", "tall_seagrass": "pasto_marino", "kelp": "alga", "kelp_plant": "alga",
        "glowstone": "luz", "torch": "antorcha", "wall_torch": "antorcha", "hay_block": "paja", "bookshelf": "librero",
        "oak_planks": "tablones", "spruce_planks": "abeto", "birch_planks": "abedul", "dark_oak_planks": "tablones_oscuros",
        "bricks": "ladrillo", "stone_bricks": "ladrillo_piedra", "glass": "vidrio", "white_wool": "lana", "terracotta": "terracota",
        "white_terracotta": "terracota_blanca", "orange_terracotta": "terracota_naranja", "red_terracotta": "terracota_roja",
        "light_gray_terracotta": "terracota_gris", "smooth_stone": "lisa", "quartz_block": "cuarzo", "note_block": "musical",
    }
    if n in exacto:
        return exacto[n]
    if n in ("air", "cave_air", "void_air"):
        return None
    if n.endswith("_ore") or "deepslate" in n or n.endswith("stone") or "stone_" in n:
        return "piedra"
    if n.endswith("_log") or n.endswith("_wood") or n.endswith("_stem"):
        return "tronco"
    if n.endswith("_leaves"):
        return "hojas"
    if n.endswith("_planks"):
        return "tablones"
    if any(k in n for k in ("flower", "tulip", "orchid", "rose", "lilac", "peony", "sunflower", "pitcher")):
        return "amapola"
    # decoración pequeña que no vale la pena (botones, setas, cañas, enredaderas, cosas con forma rara): aire
    return None


def b_del_animador():
    """los nombres e ids de B en js/mundo.js"""
    s = (RAIZ / "js" / "mundo.js").read_text(encoding="utf-8")
    i = s.index("export const B = {"); j = s.index("};", i)
    import re
    return {k: int(v) for k, v in re.findall(r"(\w+): (\d+)", s[i:j])}


def info(carpeta):
    regs = sorted(Path(carpeta).glob("r.*.mca"))
    print(f"{len(regs)} regiones")
    for r in regs[:40]:
        _, x, z, _ = r.name.split(".")
        print(f"  {r.name}: bloques x {int(x) * 512}…{int(x) * 512 + 511}, z {int(z) * 512}…{int(z) * 512 + 511} · {r.stat().st_size // 1024} KB")


def importar(carpeta, x0, z0, ancho, largo, nombre, y0=None, alto=None):
    B = b_del_animador()
    faltan = set(v for v in (traducir(k) for k in []) if v)
    carpeta = Path(carpeta)
    cols = {}                                     # (x, z) → lista de (y, nombre)
    desconocidos, sin_id = {}, {}
    cache = {}
    ymin_vista, ymax_vista = 10 ** 9, -10 ** 9
    for cz in range(z0 >> 4, (z0 + largo - 1 >> 4) + 1):
        for cx in range(x0 >> 4, (x0 + ancho - 1 >> 4) + 1):
            rx, rz = cx >> 5, cz >> 5
            if (rx, rz) not in cache:
                ruta = carpeta / f"r.{rx}.{rz}.mca"
                cache[(rx, rz)] = chunks_region(ruta) if ruta.exists() else {}
            ch = cache[(rx, rz)].get((cx & 31, cz & 31))
            if not ch or ch.get("Status", "").replace("minecraft:", "") not in ("full", "spawn", "postprocessed", "features", "light"):
                continue
            for sec in ch.get("sections", []):
                r = bloques_seccion(sec)
                if not r:
                    continue
                pal, idx = r
                if len(pal) == 1 and pal[0].startswith("air"):
                    continue
                sy = sec["Y"] * 16
                for i, p in enumerate(idx):
                    nm = pal[p]
                    if nm.startswith("air") or nm.startswith("cave_air"):
                        continue
                    y = sy + (i >> 8); z = cz * 16 + ((i >> 4) & 15); x = cx * 16 + (i & 15)
                    if not (x0 <= x < x0 + ancho and z0 <= z < z0 + largo):
                        continue
                    t = traducir(nm)
                    if t is None:
                        desconocidos[nm.partition("|")[0]] = desconocidos.get(nm.partition("|")[0], 0) + 1
                        continue
                    if t not in B:
                        sin_id[t] = sin_id.get(t, 0) + 1
                        continue
                    cols.setdefault((x, z), []).append((y, B[t]))
                    ymin_vista = min(ymin_vista, y); ymax_vista = max(ymax_vista, y)
    if not cols:
        raise SystemExit("no hay chunks generados en esa zona")
    # altura del suelo típico (mediana de la superficie) → y = 0 del escenario
    sup = sorted(max(y for y, _ in v) for v in cols.values())
    piso = sup[len(sup) // 2]
    if y0 is None:
        y0 = piso - 24                           # 24 bloques de subsuelo
    if alto is None:
        alto = min(ymax_vista - y0 + 2, 96)
    datos = bytearray(ancho * largo * alto)
    for (x, z), lista in cols.items():
        for y, idb in lista:
            yy = y - y0
            if 0 <= yy < alto:
                datos[(yy * largo + (z - z0)) * ancho + (x - x0)] = idb
    sal = RAIZ / "texturas_mc" / "mundos"
    sal.mkdir(parents=True, exist_ok=True)
    (sal / f"{nombre}.bin").write_bytes(bytes(datos))
    meta = {"nombre": nombre, "tam": {"x": ancho, "y": alto, "z": largo}, "origen": {"x": ancho // 2, "y": piso + 1 - y0, "z": largo // 2},
            "mundo": {"x0": x0, "z0": z0, "y0": y0, "piso": piso}, "fuente": str(carpeta),
            "ignorados_aire": dict(sorted(desconocidos.items(), key=lambda kv: -kv[1])[:40]), "sin_bloque_en_animador": sin_id}
    (sal / f"{nombre}.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps({k: meta[k] for k in ("tam", "origen", "mundo", "sin_bloque_en_animador")}, ensure_ascii=False))
    print("ignorados (aire):", list(meta["ignorados_aire"].items())[:12])


if __name__ == "__main__":
    a = sys.argv[1:]
    if not a:
        print(__doc__); sys.exit(1)
    if a[0] == "info":
        info(a[1])
    elif a[0] == "importar":
        opt = lambda k: int(a[a.index(k) + 1]) if k in a else None
        importar(a[1], int(a[2]), int(a[3]), int(a[4]), int(a[5]), a[6], opt("--y0"), opt("--alto"))


def pasillo(nombre, x0, x1, z0, z1, salida, banda=8, semilla=7):
    """Aplana un pasillo (coordenadas del .bin) para el rollo: en tierra quita todo lo que está sobre el piso (y del
    origen − 1), rellena hasta el piso con tierra y pasto y vuelve a sembrar pasto corto y flores; el agua se queda (el rollo
    pasa encima como un puente). En una banda de `banda` bloques alrededor quita árboles enteros y baja el terreno en rampa
    para que no queden paredes ni troncos cortados."""
    import random
    import numpy as np
    sal = RAIZ / "texturas_mc" / "mundos"
    meta = json.loads((sal / f"{nombre}.json").read_text(encoding="utf-8"))
    T = meta["tam"]; P = meta["origen"]["y"] - 1                 # índice y del bloque de piso (su cara de arriba = y 0)
    a = np.frombuffer((sal / f"{nombre}.bin").read_bytes(), np.uint8).reshape(T["y"], T["z"], T["x"]).copy()
    B = b_del_animador(); r = random.Random(semilla)
    arbol = {B[k] for k in ("tronco", "abedul_tronco", "abeto_tronco", "cerezo", "hojas", "abedul_hojas", "abeto_hojas", "cerezo_hojas", "hojas_azalea", "lima") if k in B}
    plantas = [(B["pasto_corto"], 0.14), (B["diente_leon"], 0.055), (B["amapola"], 0.05), (B["margarita"], 0.05), (B["aciano"], 0.04), (B["allium"], 0.025)]
    cambios = 0
    for z in range(max(0, z0 - banda), min(T["z"], z1 + banda)):
        for x in range(max(0, x0 - banda), min(T["x"], x1 + banda)):
            col = a[:, z, x]
            dentro = x0 <= x < x1 and z0 <= z < z1
            d = 0 if dentro else max(x0 - x, x - x1 + 1, z0 - z, z - z1 + 1, 0)
            tope = P + (0 if dentro else d)                        # rampa de 1 bloque por bloque de distancia
            agua_sup = col[P] == B["agua"] or (col[P + 1:] == B["agua"]).any()
            for y in range(T["y"] - 1, P, -1):
                if col[y] and (y > tope or col[y] in arbol):
                    if col[y] == B["agua"] and y <= P + 1:
                        continue
                    col[y] = 0; cambios += 1
            if dentro and not agua_sup:
                for y in range(P - 3, P + 1):
                    if col[y] in (0, B["agua"]) or col[y] in arbol:
                        col[y] = B["tierra"]; cambios += 1
                col[P] = B["pasto"]
                p = r.random()
                for idb, pr in plantas:
                    if p < pr:
                        col[P + 1] = idb; break
                    p -= pr
    (sal / f"{salida}.bin").write_bytes(a.tobytes())
    meta2 = {**meta, "nombre": salida, "pasillo": {"x": [x0, x1], "z": [z0, z1], "banda": banda, "de": nombre}}
    (sal / f"{salida}.json").write_text(json.dumps(meta2, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{salida}: pasillo x {x0}–{x1}, z {z0}–{z1} · {cambios} bloques cambiados")


if __name__ == "__main__" and len(sys.argv) > 1 and sys.argv[1] == "pasillo":
    a = sys.argv[2:]
    pasillo(a[0], int(a[1]), int(a[2]), int(a[3]), int(a[4]), a[5])
