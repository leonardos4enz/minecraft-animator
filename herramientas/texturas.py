"""Copia las texturas de bloques de TU Minecraft instalado (el .jar de la versión más nueva) a texturas_mc/.
Son para usarlas en tu propia computadora; no se suben a ningún lado.
Uso: python texturas.py <carpeta_del_proyecto>   → imprime una línea JSON con el resultado."""
import json
import os
import re
import sys
import zipfile

NECESARIAS = [
    "grass_block_top", "grass_block_side", "grass_block_side_overlay", "dirt", "stone", "cobblestone", "oak_planks",
    "dark_oak_planks", "oak_log", "oak_log_top", "oak_leaves", "glass", "sand", "bricks", "white_concrete",
    "light_gray_concrete", "gray_concrete", "light_blue_concrete", "blue_concrete", "quartz_block_side", "smooth_stone",
    "red_wool", "yellow_wool", "snow", "terracotta", "oak_door_bottom", "oak_door_top", "stone_bricks", "bookshelf",
    "glowstone", "polished_andesite", "spruce_planks", "birch_planks", "black_concrete", "cyan_terracotta",
    # escenarios del tráiler: cerezos, Nether, nieve, mar y camino de aldea
    "cherry_leaves", "cherry_log", "cherry_log_top", "netherrack", "crimson_nylium", "crimson_nylium_side", "nether_wart_block",
    "warped_wart_block", "crimson_stem", "crimson_stem_top", "shroomlight", "spruce_log", "spruce_log_top", "spruce_leaves",
    "grass_block_snow", "prismarine", "dark_prismarine", "sea_lantern", "dirt_path_top", "dirt_path_side", "white_wool",
    "hay_block_side", "hay_block_top", "gravel", "packed_ice", "lime_wool", "pink_concrete", "lava_still",
    # plantas en cruz (pasto, flores, raíces del Nether, algas)
    "short_grass", "tall_grass_bottom", "tall_grass_top", "dandelion", "poppy", "oxeye_daisy", "cornflower", "fern", "azure_bluet",
    "allium", "crimson_roots", "warped_roots", "seagrass", "kelp", "birch_log", "birch_leaves",
    # ronda 4: Nether distorsionado, antorchas, pétalos, franjas de la montaña nevada, lava que cae
    "warped_nylium", "warped_nylium_side", "warped_stem", "torch", "pink_petals", "pink_petals_stem", "orange_terracotta",
    "white_terracotta", "red_terracotta", "light_gray_terracotta", "brown_terracotta", "magma", "lava_flow", "calcite",
    "stripped_oak_log", "spruce_trapdoor", "smooth_sandstone", "bush", "firefly_bush", "leaf_litter",
]
# objetos (se guardan como item/<nombre>.png): el cuerno de cabra del jinete
ITEMS = ["goat_horn"]
# cielo: luna y nubes (texturas del ambiente)
AMBIENTE = ["celestial/moon/full_moon", "clouds"]
# mobs del tráiler (se guardan como entity/<carpeta>__<nombre>.png)
ENTIDADES = ["villager/villager", "villager/type/plains", "villager/profession/farmer", "chicken/chicken_temperate_baby",
             "sheep/sheep", "sheep/sheep_wool", "sheep/sheep_baby", "sheep/sheep_wool_baby", "goat/goat", "goat/goat_baby",
             "wolf/wolf", "squid/glow_squid", "strider/strider", "llama/llama_creamy", "equipment/wolf_body/armadillo_scute"]


def version_clave(nombre: str):
    m = re.fullmatch(r"(\d+)\.(\d+)(?:\.(\d+))?", nombre)
    return tuple(int(x or 0) for x in m.groups()) if m else None


def main():
    proyecto = sys.argv[1]
    base = os.path.join(os.environ.get("APPDATA", ""), ".minecraft", "versions")
    if not os.path.isdir(base):
        return {"ok": False, "error": "No encontré .minecraft/versions (¿Minecraft Java instalado?)"}
    candidatas = []
    for v in os.listdir(base):
        clave = version_clave(v)
        jar = os.path.join(base, v, v + ".jar")
        if clave and os.path.isfile(jar):
            candidatas.append((clave, v, jar))
    if not candidatas:
        return {"ok": False, "error": "No hay ninguna versión estable descargada"}
    _, version, jar = max(candidatas)
    destino = os.path.join(proyecto, "texturas_mc", "block")
    os.makedirs(destino, exist_ok=True)
    encontradas = []
    with zipfile.ZipFile(jar) as z:
        nombres = set(z.namelist())
        for n in NECESARIAS:
            ruta = f"assets/minecraft/textures/block/{n}.png"
            if ruta in nombres:
                with open(os.path.join(destino, n + ".png"), "wb") as f:
                    f.write(z.read(ruta))
                encontradas.append(n)
        dest_amb = os.path.join(proyecto, "texturas_mc", "environment")
        os.makedirs(dest_amb, exist_ok=True)
        for n in AMBIENTE:
            ruta = f"assets/minecraft/textures/environment/{n}.png"
            if ruta in nombres:
                with open(os.path.join(dest_amb, os.path.basename(n) + ".png"), "wb") as f:
                    f.write(z.read(ruta))
                encontradas.append("environment/" + os.path.basename(n))
        dest_ent = os.path.join(proyecto, "texturas_mc", "entity")
        os.makedirs(dest_ent, exist_ok=True)
        for n in ENTIDADES:
            ruta = f"assets/minecraft/textures/entity/{n}.png"
            if ruta in nombres:
                nombre = n.replace("/", "__") if not n.startswith("equipment/") else "armadillo_scute__wolfbody"
                with open(os.path.join(dest_ent, nombre + ".png"), "wb") as f:
                    f.write(z.read(ruta))
                encontradas.append("entity/" + nombre)
        dest_item = os.path.join(proyecto, "texturas_mc", "item")
        os.makedirs(dest_item, exist_ok=True)
        for n in ITEMS:
            ruta = f"assets/minecraft/textures/item/{n}.png"
            if ruta in nombres:
                with open(os.path.join(dest_item, n + ".png"), "wb") as f:
                    f.write(z.read(ruta))
                encontradas.append("item/" + n)
    indice = {"version": version, "texturas": encontradas}
    with open(os.path.join(proyecto, "texturas_mc", "indice.json"), "w", encoding="utf-8") as f:
        json.dump(indice, f)
    return {"ok": True, **indice}


if __name__ == "__main__":
    try:
        r = main()
    except Exception as e:
        r = {"ok": False, "error": f"{type(e).__name__}: {e}"}
    print(json.dumps(r, ensure_ascii=False))
