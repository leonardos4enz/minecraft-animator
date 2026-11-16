"""Lee los recursos de TU Minecraft Bedrock instalado (solo para usarlos en tu PC; no se redistribuye nada).
Bedrock guarda casi todo dentro de archivos .brarchive (formato propio de Mojang): cabecera de 16 bytes (firma, número de
entradas, versión), una tabla de entradas de 256 bytes (largo del nombre, nombre, desplazamiento y largo) y los datos.
Los packs vanilla vienen por versión (vanilla, vanilla_1.14 … vanilla_1.26.x): el más nuevo gana, como en el juego."""
import io
import json
import os
import re
import struct


def leer_brarchive(ruta):
    with open(ruta, "rb") as f:
        d = f.read()
    n = struct.unpack_from("<I", d, 8)[0]
    base = 16 + n * 256
    for i in range(n):
        o = 16 + i * 256
        largo = d[o]
        nombre = d[o + 1:o + 1 + largo].decode("utf-8", "replace")
        desp, tam = struct.unpack_from("<II", d, o + 248)
        yield nombre, d[base + desp:base + desp + tam]


def buscar_bedrock():
    for raiz in [r"C:\XboxGames", r"D:\XboxGames", r"E:\XboxGames"]:
        if os.path.isdir(raiz):
            for n in os.listdir(raiz):
                p = os.path.join(raiz, n, "Content", "data")
                if os.path.isdir(os.path.join(p, "resource_packs", "vanilla")):
                    return p
    return None


def _orden(nombre):
    nums = [int(x) for x in re.findall(r"\d+", nombre)]
    return (1, nums) if nums else (0, [])


class Bedrock:
    """Vista combinada de los packs vanilla: archivo (ruta relativa) → bytes; las versiones nuevas pisan a las viejas."""

    def __init__(self, data=None, tipo="resource_packs"):
        self.data = data or buscar_bedrock()
        self.archivos = {}
        if not self.data:
            return
        rp = os.path.join(self.data, tipo)
        packs = sorted([p for p in os.listdir(rp) if p == "vanilla" or re.fullmatch(r"vanilla_\d[\d.]*", p)], key=_orden)
        for p in packs:
            base = os.path.join(rp, p)
            for raiz, _, fs in os.walk(base):
                for f in fs:
                    full = os.path.join(raiz, f)
                    rel = os.path.relpath(full, base).replace(os.sep, "/")
                    if f.endswith(".brarchive"):
                        carpeta = rel.replace("__brarchive/", "")[:-len(".brarchive")]
                        for nombre, datos in leer_brarchive(full):
                            if datos:
                                self.archivos[carpeta + "/" + nombre] = datos
                    elif not rel.startswith("__brarchive"):
                        self.archivos[rel] = full                # se lee al pedirlo

    def leer(self, rel):
        v = self.archivos.get(rel)
        if isinstance(v, str):
            with open(v, "rb") as f:
                return f.read()
        return v

    def json(self, rel):
        d = self.leer(rel)
        if d is None:
            return None
        t = d.decode("utf-8-sig", "replace")
        try:
            return json.loads(t)
        except json.JSONDecodeError:                           # algunos traen comentarios // o comas de más
            t = re.sub(r"^\s*//.*$", "", t, flags=re.M)
            t = re.sub(r",(\s*[}\]])", r"\1", t)
            return json.loads(t)

    def lista(self, prefijo):
        return sorted(k for k in self.archivos if k.startswith(prefijo))

    # ── entidades del cliente (minecraft:client_entity): texturas, geometría, animaciones
    def entidades(self):
        out = {}
        for k in self.lista("entity/"):
            try:
                j = self.json(k)
            except Exception:
                continue
            d = (j or {}).get("minecraft:client_entity", {}).get("description")
            if d and d.get("identifier"):
                out.setdefault(d["identifier"], []).append((k, d))
        return out

    # ── geometrías: identificador → {texture_width, texture_height, bones} (formato 1.8 con herencia "a:b" y 1.12+)
    def geometrias(self):
        geos = {}
        for k in self.lista("models/"):
            if not k.endswith(".json"):
                continue
            try:
                j = self.json(k)
            except Exception:
                continue
            if not isinstance(j, dict):
                continue
            for g in j.get("minecraft:geometry", []) or []:
                d = g.get("description", {})
                if d.get("identifier"):
                    geos[d["identifier"]] = {"texture_width": d.get("texture_width", 64), "texture_height": d.get("texture_height", 64),
                                             "bones": g.get("bones", []), "archivo": k}
            for clave, g in j.items():
                if not clave.startswith("geometry.") or not isinstance(g, dict):
                    continue
                ident, _, padre = clave.partition(":")
                geos[ident] = {"texture_width": g.get("texturewidth", 64), "texture_height": g.get("textureheight", 64),
                               "bones": g.get("bones", []), "padre": padre or None, "archivo": k}
        # herencia: los huesos del hijo reemplazan a los del padre con el mismo nombre
        def resolver(ident, prof=0):
            g = geos.get(ident)
            if not g or not g.get("padre") or prof > 8:
                return g
            p = resolver(g["padre"], prof + 1)
            if not p:
                return g
            propios = {b["name"]: b for b in g["bones"]}
            huesos = [dict(p_b, **propios.pop(p_b["name"])) if p_b["name"] in propios else p_b for p_b in p["bones"]]
            huesos += list(propios.values())
            g = dict(g, bones=huesos, padre=None)
            if "texturewidth" not in g:
                g.setdefault("texture_width", p["texture_width"])
                g.setdefault("texture_height", p["texture_height"])
            geos[ident] = g
            return g
        for i in list(geos):
            resolver(i)
        return geos

    def textura(self, ruta):
        """ruta sin extensión (p. ej. textures/entity/pig/pig_v3) → imagen PIL RGBA, o None"""
        from PIL import Image
        for ext in (".png", ".tga"):
            d = self.leer(ruta + ext)
            if d:
                try:
                    return Image.open(io.BytesIO(d)).convert("RGBA")
                except Exception:
                    pass
        return None


def comportamiento(data=None):
    """tamaños de colisión (ancho, alto) de cada entidad del pack de comportamiento: identificador → [ancho, alto]"""
    bp = Bedrock(data, "behavior_packs")
    out = {}
    for k in bp.lista("entities/"):
        try:
            j = bp.json(k)
        except Exception:
            continue
        e = (j or {}).get("minecraft:entity", {})
        ident = e.get("description", {}).get("identifier")
        if not ident:
            continue
        caja = (e.get("components") or {}).get("minecraft:collision_box")
        if not caja:                                     # a veces viene solo en un grupo de componentes (adulto)
            for nombre, g in (e.get("component_groups") or {}).items():
                if "minecraft:collision_box" in g and "baby" not in nombre:
                    caja = g["minecraft:collision_box"]
                    break
        if caja:
            out[ident] = [caja.get("width", 0.6), caja.get("height", 1.8)]
    return out
