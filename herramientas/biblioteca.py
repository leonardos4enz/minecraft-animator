"""Biblioteca de recursos: copia a texturas_mc/ TODOS los mobs y objetos de Minecraft que se pueden usar en el animador y
genera el índice texturas_mc/biblioteca/indice.json (nombre en español, categoría, tamaño y de dónde sale cada uno).
Todo se lee de TU computadora y se queda en ella (no se redistribuye nada de Mojang, FreshLX ni Robotpants):

  1. Fresh Animations (zip en Descargas): modelos .jem y animaciones .jpm de ~85 mobs  → texturas_mc/packs/fresh/cem/
  2. Bare Bones (zip en Descargas): texturas de mobs, objetos y bloques "como los tráileres". Cada textura de mob es Bare
     Bones encima y Fresh Animations debajo (los pixeles extra que FA necesita), igual que con los dos packs puestos en el
     juego → texturas_mc/packs/mezcla/entity/ (también las variantes: gato siamés, caballo negro, rana fría… ver VARIANTES)
  3. Minecraft Bedrock instalado: geometría (.geo.json) y texturas de los mobs que Fresh Animations no trae (armadillo,
     camello, panda, warden…) → texturas_mc/biblioteca/bedrock/; la pose vanilla de las partes de FA que sus animaciones no
     mueven (se calcula de la geometría de Bedrock) y el tamaño de cada mob (cajas de colisión del pack de comportamiento).
  4. El .jar de Java (versión más nueva): nombres en español (es_mx) y las texturas de objetos/bloques que Bare Bones no trae.

Prioridad de cada mob: Fresh Animations + Bare Bones  >  Bedrock (geometría) con textura de Bare Bones si encaja  >  Bedrock.
Uso: python herramientas/biblioteca.py [carpeta_del_proyecto]   → imprime una línea JSON con el resumen."""
import io
import json
import os
import re
import sys
import unicodedata
import zipfile

from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bedrock import Bedrock, comportamiento          # noqa: E402
from packs import OVERLAYS, buscar_zip, limpiar_cara_aldeano   # noqa: E402

PROYECTO = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MC = os.path.join(os.environ.get("APPDATA", ""), ".minecraft")

# ───────────── catálogo de mobs ─────────────
# id: nombre del tipo en el animador · java: id de la entidad · cat: animal | mascota | aldeano | monstruo | acuatico | jefe | golem
# capas (Fresh Animations): [[modelo .jem, [texturas candidatas (ruta bajo textures/entity, sin .png)]], …]; si hay varias
#   candidatas se usa la primera que exista (Bare Bones y FA a veces nombran distinto la misma textura)
# be: entidad de Bedrock (geometría para la pose vanilla, el tamaño y, si no hay capas, el modelo entero)
# marcha: bipedo | cuadrupedo | volar | nadar | saltar | flotar · escala: tamaño extra (como el juego: wither skeleton 1.2…)
PROPIOS = {   # tipos que ya existían (js/mobs.js los arma a su manera; Fresh Animations manda en los que cubre)
    "pollito": ["chicken", "animal", "Pollito"], "oveja": ["sheep", "animal"], "cordero": ["sheep", "animal", "Cordero"],
    "cabra": ["goat", "animal"], "cabrito": ["goat", "animal", "Cabrito"], "aldeano": ["villager", "aldeano"],
    "granjero": ["villager", "aldeano", "Granjero"], "aldeanito": ["villager", "aldeano", "Aldeanito"], "lobo": ["wolf", "mascota"],
    "calamar": ["glow_squid", "acuatico"], "strider": ["strider", "animal"], "llama": ["llama", "animal"],
    "cubito": ["happy_ghast", "animal", "Cubito (cría de ghast feliz)"], "clawd": [None, "mascota", "Clawd"],
}
T = lambda *c: list(c)                                # candidatas de textura
MOBS = [
    # animales
    dict(java="chicken", id="gallina", cat="animal", capas=[["chicken", T("chicken/temperate_chicken", "chicken/chicken_temperate", "chicken")]], marcha="cuadrupedo"),
    dict(java="cow", id="vaca", cat="animal", capas=[["cow", T("cow/temperate_cow", "cow/cow_temperate", "cow/cow")]], marcha="cuadrupedo"),
    dict(java="mooshroom", id="champinaca", cat="animal", capas=[["mooshroom", T("cow/red_mooshroom", "cow/mooshroom_red", "cow/mooshroom")]], marcha="cuadrupedo"),
    dict(java="pig", id="cerdo", cat="animal", capas=[["pig", T("pig/temperate_pig", "pig/pig_temperate", "pig/pig")]], marcha="cuadrupedo"),
    dict(java="horse", id="caballo", cat="animal", capas=[["horse", T("horse/horse_chestnut")]], marcha="cuadrupedo", montura=True),
    dict(java="donkey", id="burro", cat="animal", capas=[["donkey", T("horse/donkey")]], marcha="cuadrupedo"),
    dict(java="mule", id="mula", cat="animal", capas=[["mule", T("horse/mule")]], marcha="cuadrupedo"),
    dict(java="trader_llama", id="llama_comerciante", cat="animal", capas=[["trader_llama", T("llama/gray", "llama/llama_gray")], ["trader_llama_decor", T("llama/decor/trader_llama", "equipment/llama_body/trader_llama")]], marcha="cuadrupedo", be="llama"),
    dict(java="fox", id="zorro", cat="animal", capas=[["fox", T("fox/fox")]], marcha="cuadrupedo"),
    dict(java="bee", id="abeja", cat="animal", capas=[["bee", T("bee/bee")]], marcha="volar"),
    dict(java="bat", id="murcielago", cat="animal", capas=[["bat", T("bat", "bat/bat")]], marcha="volar"),
    dict(java="frog", id="rana", cat="animal", capas=[["frog", T("frog/temperate_frog", "frog/frog_temperate")]], marcha="cuadrupedo"),
    dict(java="turtle", id="tortuga", cat="animal", capas=[["turtle", T("turtle/big_sea_turtle", "turtle/turtle")]], marcha="cuadrupedo"),
    dict(java="sniffer", id="sniffer", cat="animal", capas=[["sniffer", T("sniffer/sniffer")]], marcha="cuadrupedo"),
    dict(java="hoglin", id="hoglin", cat="monstruo", capas=[["hoglin", T("hoglin/hoglin")]], marcha="cuadrupedo"),
    dict(java="rabbit", id="conejo", cat="animal", marcha="saltar", be_tex=T("rabbit/brown", "rabbit/rabbit_brown")),
    dict(java="panda", id="panda", cat="animal", marcha="cuadrupedo", be_tex=T("panda/panda")),
    dict(java="polar_bear", id="oso_polar", cat="animal", marcha="cuadrupedo", be_tex=T("bear/polarbear")),
    dict(java="armadillo", id="armadillo", cat="animal", marcha="cuadrupedo", be_tex=T("armadillo", "armadillo/armadillo")),
    dict(java="camel", id="camello", cat="animal", marcha="cuadrupedo", be_tex=T("camel/camel")),
    dict(java="happy_ghast", id="ghast_feliz", cat="animal", capas=[["happy_ghast", T("ghast/happy_ghast")]], marcha="flotar", escala=4),
    # mascotas
    dict(java="cat", id="gato", cat="mascota", capas=[["cat", T("cat/tabby", "cat/cat_tabby")]], marcha="cuadrupedo"),
    dict(java="ocelot", id="ocelote", cat="mascota", capas=[["ocelot", T("cat/ocelot")]], marcha="cuadrupedo"),
    dict(java="parrot", id="loro", cat="mascota", capas=[["parrot", T("parrot/parrot_red_blue")]], marcha="volar"),
    dict(java="axolotl", id="ajolote", cat="mascota", capas=[["axolotl", T("axolotl/axolotl_lucy")]], marcha="cuadrupedo"),
    dict(java="allay", id="allay", cat="mascota", capas=[["allay", T("allay/allay")]], marcha="volar"),
    # acuáticos
    dict(java="squid", id="calamar_comun", cat="acuatico", capas=[["squid", T("squid/squid")]], marcha="nadar"),
    dict(java="dolphin", id="delfin", cat="acuatico", capas=[["dolphin", T("dolphin", "dolphin/dolphin")]], marcha="nadar"),
    dict(java="cod", id="bacalao", cat="acuatico", capas=[["cod", T("fish/cod")]], marcha="nadar"),
    dict(java="salmon", id="salmon", cat="acuatico", capas=[["salmon", T("fish/salmon")]], marcha="nadar"),
    dict(java="pufferfish", id="pez_globo", cat="acuatico", capas=[["puffer_fish_big", T("fish/pufferfish")]], marcha="nadar"),
    dict(java="tadpole", id="renacuajo", cat="acuatico", capas=[["tadpole", T("tadpole/tadpole")]], marcha="nadar"),
    dict(java="guardian", id="guardian", cat="acuatico", capas=[["guardian", T("guardian", "guardian/guardian")]], marcha="nadar"),
    dict(java="elder_guardian", id="guardian_anciano", cat="jefe", capas=[["elder_guardian", T("guardian_elder", "guardian/guardian_elder")]], marcha="nadar", escala=2.35),
    dict(java="nautilus", id="nautilo", cat="acuatico", marcha="nadar", be_tex=T("nautilus/nautilus")),
    # aldeanos e illagers
    dict(java="wandering_trader", id="comerciante", cat="aldeano", capas=[["wandering_trader", T("wandering_trader", "wandering_trader/wandering_trader")]], marcha="bipedo"),
    dict(java="witch", id="bruja", cat="aldeano", capas=[["witch", T("witch", "witch/witch")]], marcha="bipedo"),
    dict(java="zombie_villager", id="aldeano_zombi", cat="monstruo", capas=[["zombie_villager", T("zombie_villager/zombie_villager", "zombie/zombie_villager")]], marcha="bipedo"),
    dict(java="pillager", id="saqueador", cat="monstruo", capas=[["pillager", T("illager/pillager")]], marcha="bipedo"),
    dict(java="vindicator", id="vindicador", cat="monstruo", capas=[["vindicator", T("illager/vindicator")]], marcha="bipedo"),
    dict(java="evoker", id="invocador", cat="monstruo", capas=[["evoker", T("illager/evoker")]], marcha="bipedo", be="evocation_illager"),
    dict(java="illusioner", id="ilusionista", cat="monstruo", capas=[["illusioner", T("illager/illusioner")]], marcha="bipedo", be="evocation_illager"),
    dict(java="ravager", id="devastador", cat="monstruo", capas=[["ravager", T("illager/ravager")]], marcha="cuadrupedo"),
    dict(java="vex", id="vex", cat="monstruo", capas=[["vex", T("illager/vex")]], marcha="volar"),
    # monstruos
    dict(java="zombie", id="zombi", cat="monstruo", capas=[["zombie", T("zombie/zombie")]], marcha="bipedo"),
    dict(java="husk", id="momia", cat="monstruo", capas=[["husk", T("zombie/husk")]], marcha="bipedo"),
    dict(java="drowned", id="ahogado", cat="monstruo", capas=[["drowned", T("zombie/drowned")], ["drowned_outer", T("zombie/drowned_outer_layer")]], marcha="bipedo"),
    dict(java="skeleton", id="esqueleto", cat="monstruo", capas=[["skeleton", T("skeleton/skeleton")]], marcha="bipedo"),
    dict(java="stray", id="esqueleto_glacial", cat="monstruo", capas=[["stray", T("skeleton/stray")], ["stray_outer", T("skeleton/stray_overlay")]], marcha="bipedo"),
    dict(java="bogged", id="esqueleto_pantanoso", cat="monstruo", capas=[["bogged", T("skeleton/bogged")], ["bogged_outer", T("skeleton/bogged_overlay")]], marcha="bipedo"),
    dict(java="parched", id="esqueleto_reseco", cat="monstruo", capas=[["parched", T("skeleton/parched")]], marcha="bipedo"),
    dict(java="wither_skeleton", id="esqueleto_wither", cat="monstruo", capas=[["wither_skeleton", T("skeleton/wither_skeleton")]], marcha="bipedo", escala=1.2),
    dict(java="creeper", id="creeper", cat="monstruo", capas=[["creeper", T("creeper/creeper")]], marcha="cuadrupedo"),
    dict(java="spider", id="arana", cat="monstruo", capas=[["spider", T("spider/spider")]], marcha="cuadrupedo"),
    dict(java="cave_spider", id="arana_cueva", cat="monstruo", capas=[["cave_spider", T("spider/cave_spider")]], marcha="cuadrupedo", escala=0.7),
    dict(java="enderman", id="enderman", cat="monstruo", capas=[["enderman", T("enderman/enderman")]], marcha="bipedo"),
    dict(java="endermite", id="endermite", cat="monstruo", capas=[["endermite", T("endermite", "endermite/endermite")]], marcha="cuadrupedo"),
    dict(java="silverfish", id="pez_plateado", cat="monstruo", capas=[["silverfish", T("silverfish", "silverfish/silverfish")]], marcha="cuadrupedo"),
    dict(java="slime", id="slime", cat="monstruo", capas=[["slime", T("slime/slime")], ["slime_outer", T("slime/slime")]], marcha="saltar", escala=2),
    dict(java="magma_cube", id="cubo_magma", cat="monstruo", capas=[["magma_cube", T("slime/magmacube")]], marcha="saltar", escala=2),
    dict(java="blaze", id="blaze", cat="monstruo", capas=[["blaze", T("blaze", "blaze/blaze")]], marcha="flotar"),
    dict(java="ghast", id="ghast", cat="monstruo", capas=[["ghast", T("ghast/ghast")]], marcha="flotar", escala=4.5),
    dict(java="phantom", id="phantom", cat="monstruo", capas=[["phantom", T("phantom", "phantom/phantom")]], marcha="volar"),
    dict(java="shulker", id="shulker", cat="monstruo", capas=[["shulker", T("shulker/shulker")]], marcha="quieto"),
    dict(java="piglin", id="piglin", cat="monstruo", capas=[["piglin", T("piglin/piglin")]], marcha="bipedo"),
    dict(java="piglin_brute", id="piglin_bruto", cat="monstruo", capas=[["piglin_brute", T("piglin/piglin_brute")]], marcha="bipedo"),
    dict(java="zombified_piglin", id="piglin_zombificado", cat="monstruo", capas=[["zombified_piglin", T("piglin/zombified_piglin")]], marcha="bipedo"),
    dict(java="zoglin", id="zoglin", cat="monstruo", capas=[["zoglin", T("hoglin/zoglin")]], marcha="cuadrupedo"),
    dict(java="skeleton_horse", id="caballo_esqueleto", cat="monstruo", capas=[["skeleton_horse", T("horse/horse_skeleton")]], marcha="cuadrupedo"),
    dict(java="zombie_horse", id="caballo_zombi", cat="monstruo", capas=[["zombie_horse", T("horse/horse_zombie")]], marcha="cuadrupedo"),
    dict(java="breeze", id="breeze", cat="monstruo", marcha="flotar", be_tex=T("breeze/breeze")),
    dict(java="creaking", id="crujidor", cat="monstruo", marcha="bipedo", be_tex=T("creaking/creaking")),
    dict(java="warden", id="warden", cat="jefe", marcha="bipedo", be_tex=T("warden/warden")),
    dict(java="wither", id="wither", cat="jefe", marcha="flotar", be_tex=T("wither/wither")),
    dict(java="ender_dragon", id="dragon_ender", cat="jefe", marcha="volar", be_tex=T("enderdragon/dragon")),
    # gólems
    dict(java="iron_golem", id="golem_hierro", cat="golem", capas=[["iron_golem", T("iron_golem/iron_golem")]], marcha="bipedo"),
    dict(java="snow_golem", id="golem_nieve", cat="golem", capas=[["snow_golem", T("snow_golem", "snow_golem/snow_golem")]], marcha="bipedo"),
    dict(java="copper_golem", id="golem_cobre", cat="golem", marcha="bipedo", be_tex=T("copper_golem/copper_golem")),
]

# tamaño (ancho, alto en bloques) de Java donde el pack de comportamiento de Bedrock no sirve (otro tamaño o grupo raro)
TAM_JAVA = {"hoglin": [1.3965, 1.4], "zoglin": [1.3965, 1.4], "rabbit": [0.4, 0.5], "chicken": [0.4, 0.7], "bee": [0.7, 0.6],
            "cod": [0.5, 0.3], "creeper": [0.6, 1.7], "sheep": [0.9, 1.3], "goat": [0.9, 1.3], "ender_dragon": [16, 8]}

# lo que se ve distinto al juego (se muestra en la biblioteca y en catalogo)
NOTAS = {"dragon_ender": "aproximado: el cuello y la cola no toman su pose (Bedrock la arma con Molang)",
         "golem_nieve": "sin la cabeza de calabaza (en el juego es un bloque aparte)",
         "champinaca": "hongos como en Fresh Animations",
         "wither": "geometría de Bedrock con animación básica: no gira las cabezas",
         "slime": "la capa de afuera es translúcida, sin el brillo del juego",
         "ocelote": "Fresh Animations lo sienta solo cuando está quieto (pose al azar)"}

# ───────────── variantes (campo `variante` del grupo de mobs) ─────────────
# id del mob → [(id, nombre, nombre en Java, pila de texturas)…]; la primera es la que se usa sin `variante`.
# pila: lista de candidatas (como en MOBS) que se pintan una sobre otra en la capa `capa` del modelo (los demás capas igual);
# jem: otro modelo de Fresh Animations para esa variante (la vaca fría tiene cuernos). Mobs de Bedrock: la pila es la textura
# de Bare Bones (si encaja) y `be` la clave de la textura en la entidad de Bedrock.
def _v(lista, cands, **extra):
    return [dict(id=i, nombre=n, java=j, pila=[cands(j)], **extra) for i, n, j in lista]


CLIMAS = [("templada", "Templada", "temperate"), ("fria", "Fría", "cold"), ("calida", "Cálida", "warm")]
BIOMAS = [("llanura", "Llanura", "plains"), ("desierto", "Desierto", "desert"), ("jungla", "Jungla", "jungle"),
          ("sabana", "Sabana", "savanna"), ("nieve", "Nieve", "snow"), ("pantano", "Pantano", "swamp"), ("taiga", "Taiga", "taiga")]
PROFESIONES = ["farmer", "armorer", "butcher", "cartographer", "cleric", "fisherman", "fletcher", "leatherworker", "librarian",
               "mason", "nitwit", "shepherd", "toolsmith", "weaponsmith"]
COLORES_LANA = {"white": None, "orange": 0xF9801D, "magenta": 0xC74EBD, "light_blue": 0x3AB3DA, "yellow": 0xFED83D, "lime": 0x80C71F,
                "pink": 0xF38BAA, "gray": 0x474F52, "light_gray": 0x9D9D97, "cyan": 0x169C9C, "purple": 0x8932B8, "blue": 0x3C44AA,
                "brown": 0x835432, "green": 0x5E7C16, "red": 0xB02E26, "black": 0x1D1D21}   # DyeColor de Java (la lana: ×0.75)
VARIANTES = {
    "gato": _v([("atigrado", "Atigrado", "tabby"), ("negro", "Negro", "black"), ("rojo", "Rojo", "red"), ("siames", "Siamés", "siamese"),
                ("britanico", "Británico de pelo corto", "british_shorthair"), ("calico", "Calicó", "calico"), ("persa", "Persa", "persian"),
                ("ragdoll", "Ragdoll", "ragdoll"), ("blanco", "Blanco", "white"), ("jellie", "Jellie", "jellie"), ("todo_negro", "Todo negro", "all_black")],
               lambda j: T(f"cat/{j}", f"cat/cat_{j}")),
    "caballo": _v([("castano", "Castaño", "chestnut"), ("blanco", "Blanco", "white"), ("crema", "Crema", "creamy"), ("cafe", "Café", "brown"),
                   ("negro", "Negro", "black"), ("gris", "Gris", "gray"), ("cafe_oscuro", "Café oscuro", "darkbrown")],
                  lambda j: T(f"horse/horse_{j}")),
    "rana": _v(CLIMAS, lambda j: T(f"frog/{j}_frog", f"frog/frog_{j}")),
    "ajolote": _v([("rosa", "Rosa", "lucy"), ("cafe", "Café", "wild"), ("dorado", "Dorado", "gold"), ("cian", "Cian", "cyan"), ("azul", "Azul", "blue")],
                  lambda j: T(f"axolotl/axolotl_{j}")),
    "loro": _v([("rojo", "Rojo", "red_blue"), ("azul", "Azul", "blue"), ("verde", "Verde", "green"), ("cian", "Cian", "yellow_blue"), ("gris", "Gris", "grey")],
               lambda j: T(f"parrot/parrot_{j}")),
    "llama_comerciante": _v([("gris", "Gris", "gray"), ("crema", "Crema", "creamy"), ("blanca", "Blanca", "white"), ("cafe", "Café", "brown")],
                            lambda j: T(f"llama/{j}", f"llama/llama_{j}")),
    "champinaca": _v([("roja", "Roja", "red"), ("cafe", "Café", "brown")], lambda j: T(f"cow/{j}_mooshroom", f"cow/mooshroom_{j}")),
    "zorro": _v([("rojo", "Rojo", "red"), ("nieve", "Ártico", "snow")], lambda j: T("fox/fox") if j == "red" else T("fox/snow_fox", "fox/fox_snow")),
    # aldeano zombi: piel + ropa del bioma; la profesión va encima (EXTRAS: "desierto+bibliotecario")
    "aldeano_zombi": [dict(id=i, nombre=n, java=j, pila=[T("zombie_villager/zombie_villager", "zombie/zombie_villager"),
                                                          T(f"zombie_villager/biomes/{j}", f"zombie_villager/type/{j}")]) for i, n, j in BIOMAS],
    # mobs de Bedrock (be = clave de la textura en la entidad de Bedrock)
    "conejo": [dict(id=i, nombre=n, java=j, pila=[T(f"rabbit/{j}")], be=j) for i, n, j in
               [("cafe", "Café", "brown"), ("blanco", "Blanco", "white"), ("negro", "Negro", "black"), ("blanco_manchado", "Blanco y negro", "white_splotched"),
                ("dorado", "Dorado", "gold"), ("sal_y_pimienta", "Sal y pimienta", "salt"), ("toast", "Toast", "toast")]],
    "panda": [dict(id=i, nombre=n, java=j, pila=[T(f"panda/{j}_panda" if j != "default" else "panda/panda")], be=j) for i, n, j in
              [("normal", "Normal", "default"), ("perezoso", "Perezoso", "lazy"), ("preocupado", "Preocupado", "worried"), ("jugueton", "Juguetón", "playful"),
               ("cafe", "Café", "brown"), ("debil", "Débil", "weak"), ("agresivo", "Agresivo", "aggressive")]],
    "golem_cobre": [dict(id=i, nombre=n, java=j, pila=[T("copper_golem/copper_golem" + ("" if j == "default" else "_" + j))], be=j) for i, n, j in
                    [("cobre", "Cobre", "default"), ("expuesto", "Expuesto", "exposed"), ("erosionado", "Erosionado", "weathered"), ("oxidado", "Oxidado", "oxidized")]],
}
for _mob, _java in (("gallina", "chicken"), ("vaca", "cow"), ("cerdo", "pig")):        # Java 1.21.5: templados, fríos y cálidos
    VARIANTES[_mob] = [dict(id=i, nombre=n, java=j, pila=[T(f"{_java}/{j}_{_java}", f"{_java}/{_java}_{j}")], **({} if j == "temperate" else {"jem": f"{j}_{_java}"}))
                       for i, n, j in CLIMAS]
# capas que se ponen encima de la variante (se combinan con "+": "pantano+bibliotecario", "negro+patas_blancas")
EXTRAS = {
    "aldeano_zombi": [dict(java=p, pila=T(f"zombie_villager/profession/{p}", *(["zombie_villager/profession/stonemason"] if p == "mason" else [])))
                      for p in PROFESIONES],
    "caballo": [dict(id=i, nombre=n, java=j, pila=T(f"horse/horse_markings_{j}")) for i, n, j in
                [("patas_blancas", "Patas blancas", "white"), ("manchas_blancas", "Manchas blancas", "whitefield"),
                 ("puntos_blancos", "Puntos blancos", "whitedots"), ("puntos_negros", "Puntos negros", "blackdots")]],
}
# mobs del tráiler (js/mobs.js los arma a mano): sin `variante` quedan exactamente como en el video
VARIANTES_PROPIOS = {
    "llama": [("crema", "Crema", "creamy"), ("blanca", "Blanca", "white"), ("cafe", "Café", "brown"), ("gris", "Gris", "gray")],
}

# crías y mobs dibujados del tráiler (no tienen caja propia en Bedrock)
TAM_PROPIOS = {"pollito": [0.2, 0.35], "cordero": [0.45, 0.65], "cabrito": [0.45, 0.65], "aldeanito": [0.3, 0.95],
               "cubito": [0.95, 0.95], "clawd": [0.6, 0.45]}

# nombres de huesos de Bedrock → nombre de la parte vanilla de Java (los que no coinciden solos)
ALIAS_BE = {"upperbody": "mane", "hat": "headwear", "helmet": "headwear", "wing0": "right_wing", "wing1": "left_wing",
            "beak": "bill", "comb": "chin", "jacket": "jacket", "rightarm": "right_arm", "leftarm": "left_arm",
            "rightleg": "right_leg", "leftleg": "left_leg"}


# animaciones de Bedrock que dan la pose de reposo (con todo en 0 queda su parte constante: el cuerpo del oso polar a 90°…)
REPOSO_BE = ("setup", "base_pose", "move", "general")


def molang(expr):
    """valor de una expresión Molang con todas las consultas y variables en 0 (None si no se puede)"""
    if isinstance(expr, (int, float)):
        return float(expr)
    if not isinstance(expr, str):
        return None
    e = expr.lower().strip().rstrip(";")
    if ";" in e or "?" in e or "return" in e or "math.sin" in e or "math.cos" in e:     # oscilaciones: no son reposo
        return None
    e = re.sub(r"\bthis\b", "0", e)                          # "this" = el valor que ya trae el hueso (0 en reposo)
    e = re.sub(r"\b(query|q|variable|v|temp|t|context|c)\.[a-z0-9_.]+(\([^()]*\))?", "0", e)
    e = re.sub(r"\bmath\.(sin|cos)\(", lambda m: f"_{m.group(1)}(", e)
    e = re.sub(r"\bmath\.([a-z_]+)\(", r"_m.\1(", e)
    if re.search(r"[a-z_]{2,}", re.sub(r"_(sin|cos)|_m\.[a-z_]+", "", e)):
        return None
    import math as _mm

    class M:
        abs = staticmethod(abs); min = staticmethod(min); max = staticmethod(max); sqrt = staticmethod(_mm.sqrt)
        floor = staticmethod(_mm.floor); ceil = staticmethod(_mm.ceil); round = staticmethod(round)
        clamp = staticmethod(lambda x, a, b: max(a, min(b, x))); lerp = staticmethod(lambda a, b, k: a + (b - a) * k)
        pi = _mm.pi
    try:
        return float(eval(e, {"__builtins__": {}}, {"_sin": lambda d: _mm.sin(_mm.radians(d)), "_cos": lambda d: _mm.cos(_mm.radians(d)), "_m": M}))
    except Exception:
        return None


def snake(n):
    return re.sub(r"(?<=[a-z0-9])([A-Z])", r"_\1", n).lower()


def slug(t):
    t = unicodedata.normalize("NFD", t).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "_", t.lower()).strip("_")


# ───────────── fuentes ─────────────
def jar_mas_nuevo():
    base = os.path.join(MC, "versions")
    mejor = None
    for v in os.listdir(base) if os.path.isdir(base) else []:
        m = re.fullmatch(r"(\d+)\.(\d+)(?:\.(\d+))?", v)
        jar = os.path.join(base, v, v + ".jar")
        if m and os.path.isfile(jar):
            clave = tuple(int(x or 0) for x in m.groups())
            if not mejor or clave > mejor[0]:
                mejor = (clave, v, jar)
    return mejor


def idioma(codigo="es_mx"):
    idx_dir = os.path.join(MC, "assets", "indexes")
    for n in sorted(os.listdir(idx_dir), key=lambda s: int(re.sub(r"\D", "", s) or 0), reverse=True) if os.path.isdir(idx_dir) else []:
        try:
            idx = json.load(open(os.path.join(idx_dir, n), encoding="utf-8"))
            h = idx["objects"][f"minecraft/lang/{codigo}.json"]["hash"]
            return json.load(open(os.path.join(MC, "assets", "objects", h[:2], h), encoding="utf-8"))
        except (KeyError, OSError, ValueError):
            continue
    return {}


def main():
    zbb, zfa = buscar_zip(r"bare\s*bones"), buscar_zip(r"fresh\s*animations")
    if not zbb or not zfa:
        return {"ok": False, "error": "No encontré los zips de Bare Bones y Fresh Animations en Descargas"}
    bb, fa = zipfile.ZipFile(zbb), zipfile.ZipFile(zfa)
    nbb, nfa = set(bb.namelist()), set(fa.namelist())
    jar = jar_mas_nuevo()
    zj = zipfile.ZipFile(jar[2]) if jar else None
    nj = set(zj.namelist()) if zj else set()
    es, en = idioma("es_mx"), idioma("en_us")
    be = Bedrock()
    ents, geos = be.entidades(), be.geometrias()
    cajas = comportamiento(be.data)
    anims_be = {}
    for k in be.lista("animations/"):
        try:
            anims_be.update((be.json(k) or {}).get("animations") or {})
        except Exception:
            pass
    packs = os.path.join(PROYECTO, "texturas_mc", "packs")
    bib = os.path.join(PROYECTO, "texturas_mc", "biblioteca")

    def escribir(ruta, datos):
        os.makedirs(os.path.dirname(ruta), exist_ok=True)
        with open(ruta, "wb") as f:
            f.write(datos)

    def leer_bb(ruta):                                   # el overlay más nuevo gana, como en el juego
        for o in OVERLAYS:
            r = (o + "/" if o else "") + "assets/minecraft/" + ruta
            if r in nbb:
                return bb.read(r)
        return None

    def png(datos):
        return Image.open(io.BytesIO(datos)).convert("RGBA") if datos else None

    def guardar_png(im, ruta):
        buf = io.BytesIO()
        im.save(buf, "PNG")
        escribir(ruta, buf.getvalue())

    # ── 1. Fresh Animations: todos los modelos y animaciones
    cem = []
    for n in sorted(nfa):
        if n.startswith("assets/minecraft/optifine/cem/") and n.rsplit(".", 1)[-1] in ("jem", "jpm", "properties"):
            escribir(os.path.join(packs, "fresh", "cem", n.rsplit("/", 1)[1]), fa.read(n))
            cem.append(n.rsplit("/", 1)[1])

    # ── 2. textura mezclada (Bare Bones encima de Fresh Animations; si falta una, la otra; si faltan las dos, el .jar)
    def textura_mob(candidatas, clave_villager=False):
        dbb = dfa = djar = None
        for c in candidatas:
            dbb = dbb or leer_bb(f"textures/entity/{c}.png")
            r = f"assets/minecraft/textures/entity/{c}.png"
            dfa = dfa or (fa.read(r) if r in nfa else None)
            djar = djar or (zj.read(r) if r in nj else None)
        ibb, ifa = png(dbb), png(dfa)
        if ibb and ifa:
            if ifa.size != ibb.size:
                ifa = ifa.resize(ibb.size, Image.NEAREST)
            out = ifa.copy()
            out.alpha_composite(ibb)
            pb, po = ibb.load(), out.load()
            for y in range(ibb.height):
                for x in range(ibb.width):
                    if pb[x, y][3] > 0:
                        po[x, y] = pb[x, y]
        else:
            out = ibb or ifa or png(djar)
        if out is None:
            return None, None
        if clave_villager and ibb and ifa:
            limpiar_cara_aldeano(out)
        fuente = "+".join(n for n, v in (("barebones", ibb), ("fresh", ifa)) if v) or "jar"
        return out, fuente

    def pila_claves(pila):
        """lista de candidatas → claves de las texturas guardadas en mezcla/entity (None si falta alguna)"""
        claves = []
        for cands in pila:
            im, _ = textura_mob(cands)
            if im is None:
                return None
            claves.append(cands[0].replace("/", "__"))
            guardar_png(im, os.path.join(packs, "mezcla", "entity", claves[-1] + ".png"))
        return claves

    def extras_de(mid):
        out = []
        for x in EXTRAS.get(mid, []):
            claves = pila_claves([x["pila"]])
            nom = x.get("nombre") or es.get(f"entity.minecraft.villager.{x['java']}") or x["java"]
            if claves:
                out.append({"id": x.get("id") or slug(nom), "nombre": nom, "java": x["java"], "capa": 0, "tex": claves[0]})
            else:
                problemas.append(f"{mid}: sin textura para el extra {x['java']}")
        return out

    # ── 3. pose vanilla de las partes de FA (desde la geometría clásica de Bedrock)
    def entidad_be(java, be_id=None):
        lista = ents.get("minecraft:" + (be_id or java)) or []
        if not lista:
            return None
        lista = sorted(lista, key=lambda kd: ("v1.0" in kd[0], kd[0]))     # la definición nueva antes que la v1.0
        return lista

    def geometria_de(java, be_id=None, clasica=True):
        lista = entidad_be(java, be_id)
        if not lista:
            return None, None
        orden = list(reversed(lista)) if clasica else lista                 # clásica: la v1.0 (forma de Java de siempre)
        for _, d in orden:
            g = d.get("geometry") or {}
            gid = g.get("default") or next(iter(g.values()), None)
            if gid in geos:
                return gid, geos[gid]
        return None, None

    def poses_vanilla(jem_nombre, java, be_id):
        jem = json.loads(fa.read(f"assets/minecraft/optifine/cem/{jem_nombre}.jem"))
        # solo importan las partes que las animaciones de FA no reescriben por completo (tx ty tz rx ry rz)
        canales = set()
        for mm in jem.get("models", []):
            r = f"assets/minecraft/optifine/cem/{mm.get('model')}"
            if mm.get("model") and r in nfa:
                for bloque in json.loads(fa.read(r)).get("animations", []):
                    canales |= set(bloque)
            for bloque in mm.get("animations", []) or []:
                canales |= set(bloque)
        todos = {"tx", "ty", "tz", "rx", "ry", "rz"}
        # todas las partes llevan su padre (FA mueve los brazos de la rana respecto al cuerpo); la posición solo importa en
        # las que FA no reescribe por completo, y solo esas se reportan si no se encuentran
        partes = [m["part"] for m in jem.get("models", []) if m.get("part") and m["part"] != "root"]
        parciales = {p for p in partes if todos - {k.rsplit(".", 1)[1] for k in canales if k.rsplit(".", 1)[0] == p}}
        gid, g = geometria_de(java, be_id)
        if not g:
            return {}, partes
        huesos = {}
        for b in g["bones"]:
            n = b["name"]
            for alias in {n.lower(), snake(n), ALIAS_BE.get(n.lower(), "")}:
                if alias:
                    huesos.setdefault(alias, b)
            m = re.fullmatch(r"(leg|tentacle|tail|spine|segment|body)(\d+)", snake(n))
            if m:                                                           # Bedrock cuenta desde 0, Java desde 1
                huesos.setdefault(f"{m.group(1)}{int(m.group(2)) + 1}", b)
        por_nombre = {b["name"]: b for b in g["bones"]}
        abs_java = lambda b: [b.get("pivot", [0, 0, 0])[0], 24 - b.get("pivot", [0, 0, 0])[1], b.get("pivot", [0, 0, 0])[2]]
        out, faltan = {}, []
        # bípedos de Bedrock: arm0/leg0 = derecho, arm1/leg1 = izquierdo; cuadrúpedos con nombres front/back
        for jp, bes in {"right_arm": ["arm0", "rightarm"], "left_arm": ["arm1", "leftarm"], "right_leg": ["leg0", "rightleg"],
                        "left_leg": ["leg1", "leftleg"], "back_right_leg": ["leg0"], "back_left_leg": ["leg1"],
                        "front_right_leg": ["leg2"], "front_left_leg": ["leg3"]}.items():
            if jp in partes and jp not in huesos:
                for nb in bes:
                    b = next((x for x in g["bones"] if x["name"].lower() == nb), None)
                    if b:
                        huesos[jp] = b
                        break
        java_de = {}
        for p in partes:
            if p in huesos:
                java_de[huesos[p]["name"]] = p
        for p in partes:
            b = huesos.get(p)
            if not b:
                if p in parciales:
                    faltan.append(p)
                continue
            pa = abs_java(b)
            r = b.get("rotation") or [0, 0, 0]
            padre = b.get("parent")
            while padre and padre not in java_de and padre in por_nombre:  # sube hasta un padre que sea parte de Java
                padre = por_nombre[padre].get("parent")
            pose = [pa[0], pa[1], pa[2], r[0] * 3.14159265 / 180, -r[1] * 3.14159265 / 180, -r[2] * 3.14159265 / 180]
            if padre in java_de and java_de[padre] != p:
                pp = abs_java(por_nombre[padre])
                pose[:3] = [pa[0] - pp[0], pa[1] - pp[1], pa[2] - pp[2]]
                pose.append(java_de[padre])
            out[p] = [round(v, 4) if isinstance(v, float) else v for v in pose]
        return out, faltan

    # ── 4. mobs
    mobs, vanilla, problemas = [], {}, []
    for m in MOBS:
        java, be_id = m["java"], m.get("be")
        nombre = es.get(f"entity.minecraft.{java}") or m["id"]
        caja = TAM_JAVA.get(java) or cajas.get("minecraft:" + (be_id or java)) or cajas.get("minecraft:" + java)
        e = {"id": m["id"], "nombre": nombre, "nombre_en": en.get(f"entity.minecraft.{java}", java), "java": java, "cat": m["cat"],
             "marcha": m.get("marcha", "cuadrupedo"), "tam": caja or [0.6, 1.0], "escala": m.get("escala", 1),
             **({"nota": NOTAS[m["id"]]} if m["id"] in NOTAS else {})}
        if m.get("capas"):
            capas, ok = [], True
            for jem, cands in m["capas"]:
                if f"assets/minecraft/optifine/cem/{jem}.jem" not in nfa:
                    ok = False
                    break
                im, fuente = textura_mob(cands)
                if im is None:
                    problemas.append(f"{m['id']}: sin textura para {jem} ({cands[0]})")
                    ok = False
                    break
                clave = cands[0].replace("/", "__")
                guardar_png(im, os.path.join(packs, "mezcla", "entity", clave + ".png"))
                capas.append([jem, clave, fuente])
                if jem not in vanilla:
                    poses, faltan = poses_vanilla(jem, java, be_id)
                    vanilla[jem] = poses
                    if faltan:
                        vanilla[jem]["_sin_pose"] = faltan
            if ok:
                e.update(fuente="fresh", capas=capas)
                vs = []
                for v in VARIANTES.get(m["id"], []):
                    jem = v.get("jem") or capas[v.get("capa", 0)][0]
                    claves = pila_claves(v["pila"]) if f"assets/minecraft/optifine/cem/{jem}.jem" in nfa else None
                    if not claves:
                        problemas.append(f"{m['id']}: sin la variante {v['id']} ({jem}, {v['pila'][-1][0]})")
                        continue
                    cs = [[c[0], [c[1]]] for c in capas]
                    cs[v.get("capa", 0)] = [jem, claves]
                    vs.append({"id": v["id"], "nombre": v["nombre"], "java": v["java"], "capas": cs})
                    if jem not in vanilla:
                        poses, faltan = poses_vanilla(jem, java, be_id)
                        vanilla[jem] = {**poses, **({"_sin_pose": faltan} if faltan else {})}
                if vs:
                    e["variantes"] = vs
                if EXTRAS.get(m["id"]):
                    e["extras"] = extras_de(m["id"])
                mobs.append(e)
                continue
        # Bedrock: geometría nueva (la del juego actual) + textura de Bare Bones si coincide en tamaño, si no la de Bedrock
        gid, g = geometria_de(java, be_id, clasica=False)
        lista = entidad_be(java, be_id)
        if not g or not lista:
            problemas.append(f"{m['id']}: no hay geometría de Bedrock")
            continue
        def textura_be(clave_be, cands):
            """textura de Bare Bones si tiene la misma proporción que la de Bedrock; si no, la de Bedrock"""
            tex_be = None
            for _, d in lista:
                t = d.get("textures") or {}
                tex_be = tex_be or (t.get(clave_be) if clave_be else t.get("default") or next(iter(t.values()), None))
            ibe = be.textura(tex_be) if tex_be else None
            im, fuente = textura_mob(cands) if cands else (None, None)
            if im is not None and ibe is not None and abs(im.size[0] / im.size[1] - ibe.size[0] / ibe.size[1]) < 1e-3:
                return im, fuente
            if ibe is not None:
                return ibe, "bedrock"
            return im, fuente
        tw, th = g["texture_width"], g["texture_height"]
        elegida, fuente = textura_be(None, m.get("be_tex"))
        if elegida is None:
            problemas.append(f"{m['id']}: sin textura")
            continue
        guardar_png(elegida, os.path.join(bib, "bedrock", m["id"] + ".png"))
        vs = []
        for k, v in enumerate(VARIANTES.get(m["id"], [])):
            if k == 0:                                       # la primera es la de siempre
                vs.append({"id": v["id"], "nombre": v["nombre"], "java": v["java"], "tex": f"bedrock/{m['id']}"})
                continue
            im_v, _ = textura_be(v["be"], v["pila"][0])
            if im_v is None or im_v.size[0] * elegida.size[1] != im_v.size[1] * elegida.size[0]:
                problemas.append(f"{m['id']}: sin la variante {v['id']}")
                continue
            guardar_png(im_v, os.path.join(bib, "bedrock", f"{m['id']}__{v['id']}.png"))
            vs.append({"id": v["id"], "nombre": v["nombre"], "java": v["java"], "tex": f"bedrock/{m['id']}__{v['id']}"})
        if len(vs) > 1:
            e["variantes"] = vs
        # pose de reposo: bind_pose_rotation de la geometría + la parte constante de sus animaciones de movimiento
        reposo = {}
        for _, d in lista:
            for clave, anim in (d.get("animations") or {}).items():
                if clave not in REPOSO_BE or not isinstance(anim, str) or anim not in anims_be:
                    continue
                for hueso, canales in (anims_be[anim].get("bones") or {}).items():
                    for canal in ("rotation", "position"):
                        v = canales.get(canal)
                        if isinstance(v, dict) and clave not in ("setup", "base_pose"):
                            continue
                        if isinstance(v, dict):                      # con fotogramas: el primero
                            v = v.get("0.0") or v.get("0") or None
                            v = v.get("post") or v.get("pre") if isinstance(v, dict) else v
                        if isinstance(v, (int, float, str)):
                            v = [v, v, v]
                        if isinstance(v, list) and len(v) == 3:
                            vals = [molang(x) for x in v]
                            if all(x is not None for x in vals) and any(abs(x) > 1e-6 for x in vals):
                                acum = reposo.setdefault(hueso.lower(), {}).setdefault(canal, [0, 0, 0])
                                for i in range(3):
                                    acum[i] += vals[i]
            break
        huesos = []
        for b in g["bones"]:
            h = {k: v for k, v in b.items() if k in ("name", "parent", "pivot", "rotation", "cubes", "mirror", "inflate")}
            r = list(b.get("rotation") or [0, 0, 0])
            if b.get("bind_pose_rotation"):                  # gira solo los cubos del hueso (no a sus hijos)
                h["bind"] = b["bind_pose_rotation"]
            extra = reposo.get(b["name"].lower(), {})
            r = [a + c for a, c in zip(r, extra.get("rotation", [0, 0, 0]))]
            if any(r):
                h["rotation"] = r
            if "position" in extra:
                h["mover"] = extra["position"]
            huesos.append(h)
        geo = {"id": gid, "tw": tw, "th": th, "huesos": huesos}
        escribir(os.path.join(bib, "bedrock", m["id"] + ".json"), json.dumps(geo, separators=(",", ":")).encode())
        e.update(fuente="bedrock", textura=fuente, geo=gid)
        mobs.append(e)
    # tipos propios (ya existían): se listan con su nombre y tamaño
    propios = []
    for tid, (java, cat, *nom) in PROPIOS.items():
        caja = TAM_PROPIOS.get(tid) or ((TAM_JAVA.get(java) or cajas.get("minecraft:" + java)) if java else None)
        e = {"id": tid, "nombre": nom[0] if nom else (es.get(f"entity.minecraft.{java}") or tid), "java": java, "cat": cat,
             "fuente": "propio", "tam": caja or [0.6, 0.6]}
        if java == "sheep":                                  # lana teñida como en Java (×0.75); blanca = la del tráiler
            e["variantes"] = [{"id": slug(es.get(f"color.minecraft.{c}", c)), "nombre": es.get(f"color.minecraft.{c}", c), "java": c,
                               **({"tinte": "#%02x%02x%02x" % tuple(int(((rgb >> s) & 255) * 0.75) for s in (16, 8, 0))} if rgb else {})}
                              for c, rgb in COLORES_LANA.items()]
        for vid, vnom, vj in VARIANTES_PROPIOS.get(tid, []):
            claves = ["llama_creamy"] if vj == "creamy" else pila_claves([T(f"llama/{vj}", f"llama/llama_{vj}")])
            if claves:
                e.setdefault("variantes", []).append({"id": vid, "nombre": vnom, "java": vj, "tex": claves[0]})
        propios.append(e)

    # ── 5. objetos y bloques (texturas: Bare Bones, si no el .jar)
    items, cats = [], {}
    if zj:
        def modelo(ruta, prof=0):
            r = f"assets/minecraft/models/{ruta}.json"
            if r not in nj or prof > 8:
                return {}
            d = json.loads(zj.read(r))
            padre = d.get("parent", "").replace("minecraft:", "")
            base = modelo(padre, prof + 1) if padre else {}
            return {"texturas": {**base.get("texturas", {}), **d.get("textures", {})}, "cadena": base.get("cadena", []) + [ruta],
                    "elementos": d.get("elements") or base.get("elementos")}

        def primer_modelo(nodo):
            if isinstance(nodo, dict):
                if nodo.get("type") in ("minecraft:model",) and isinstance(nodo.get("model"), str):
                    return nodo["model"]
                if nodo.get("type") == "minecraft:special" and isinstance(nodo.get("base"), str):
                    return nodo["base"]
                for k in ("on_false", "fallback", "model", "models", "entries", "cases"):
                    if k in nodo:
                        r = primer_modelo(nodo[k])
                        if r:
                            return r
            if isinstance(nodo, list):
                for x in nodo:
                    r = primer_modelo(x)
                    if r:
                        return r
            return None

        def copiar_tex(tipo, nombre):
            """tipo item | block → ruta relativa servida, o None"""
            destino = os.path.join(bib, tipo, nombre + ".png")
            rel = f"texturas_mc/biblioteca/{tipo}/{nombre}.png"
            if os.path.exists(destino):
                return rel
            d = leer_bb(f"textures/{tipo}/{nombre}.png") or (zj.read(f"assets/minecraft/textures/{tipo}/{nombre}.png") if f"assets/minecraft/textures/{tipo}/{nombre}.png" in nj else None)
            if not d:
                return None
            im = png(d)
            if im.height > im.width:                             # texturas animadas (tira vertical): primer cuadro
                im = im.crop((0, 0, im.width, im.width))
            guardar_png(im, destino)
            return rel

        COMIDA = re.compile(r"(apple|bread|beef|porkchop|chicken|mutton|rabbit|cod|salmon|cookie|cake|pie|melon_slice|carrot|potato|beetroot|stew|soup|berries|honey_bottle|dried_kelp|chorus_fruit|tropical_fish|pufferfish|rotten_flesh|spider_eye|golden_carrot|milk_bucket)$")
        for n in sorted(x for x in nj if x.startswith("assets/minecraft/items/") and x.endswith(".json")):
            iid = n.rsplit("/", 1)[1][:-5]
            try:
                ruta = primer_modelo(json.loads(zj.read(n)).get("model"))
            except ValueError:
                continue
            if not ruta:
                continue
            ruta = ruta.replace("minecraft:", "")
            md = modelo(ruta)
            tex = {k: v.replace("minecraft:", "") for k, v in md.get("texturas", {}).items() if isinstance(v, str) and not v.startswith("#")}
            cadena = md.get("cadena", [])
            nombre = es.get(f"item.minecraft.{iid}") or es.get(f"block.minecraft.{iid}") or iid
            e = {"id": iid, "nombre": nombre, "nombre_en": en.get(f"item.minecraft.{iid}") or en.get(f"block.minecraft.{iid}") or iid}
            if ruta.startswith("item/") and "layer0" in tex and tex["layer0"].startswith("item/"):
                rel = copiar_tex("item", tex["layer0"][5:])
                if not rel:
                    continue
                e.update(forma="plano", tex=rel, mano="herramienta" if any("handheld" in c for c in cadena) else "plano")
                if "layer1" in tex and tex["layer1"].startswith("item/"):
                    r1 = copiar_tex("item", tex["layer1"][5:])
                    if r1:
                        e["tex2"] = r1
            elif ruta.startswith("block/"):
                lado = tex.get("side") or tex.get("all") or tex.get("end") or tex.get("texture") or tex.get("particle") or next(iter(tex.values()), None)
                arriba = tex.get("top") or tex.get("end") or tex.get("all") or lado
                if not lado or not lado.startswith("block/"):
                    continue
                rl, ra = copiar_tex("block", lado[6:]), copiar_tex("block", (arriba or lado)[6:])
                if not rl:
                    continue
                e.update(forma="bloque", tex=rl, tex_arriba=ra or rl, mano="bloque")
                if not md.get("elementos") or any(c.endswith(("cube", "cube_all", "cube_column", "cube_bottom_top", "cube_column_horizontal", "leaves", "cube_mirrored_all")) for c in cadena):
                    e["cubo"] = True
                else:
                    e["cubo"] = False                                    # escaleras, vallas…: se dibuja como cubo (aproximado)
            elif ruta.startswith("item/"):
                rel = copiar_tex("item", ruta[5:])
                if not rel:
                    continue
                e.update(forma="plano", tex=rel, mano="plano")
            else:
                continue
            k = iid
            if e["forma"] == "bloque":
                cat = "bloque"
            elif re.search(r"(sword|_bow$|^bow$|crossbow|trident|mace|spear|arrow)", k):
                cat = "arma"
            elif re.search(r"(pickaxe|_axe$|shovel|_hoe$|shears|fishing_rod|flint_and_steel|brush|spyglass|compass|clock|bucket|lead|carrot_on_a_stick|warped_fungus_on_a_stick|goat_horn|bundle)", k):
                cat = "herramienta"
            elif re.search(r"(helmet|chestplate|leggings|boots|horse_armor|wolf_armor|shield|elytra|turtle_helmet|harness)", k):
                cat = "armadura"
            elif COMIDA.search(k):
                cat = "comida"
            elif k.endswith("_spawn_egg"):
                continue                                                 # huevos de aparición: se omiten
            else:
                cat = "objeto"
            e["cat"] = cat
            cats[cat] = cats.get(cat, 0) + 1
            items.append(e)

    resumen = {"mobs_fresh": sum(1 for x in mobs if x["fuente"] == "fresh"), "mobs_bedrock": sum(1 for x in mobs if x["fuente"] == "bedrock"),
               "mobs_propios": len(propios), "items": len(items), "items_por_categoria": cats}
    indice = {"version": 1, "fuentes": {"barebones": os.path.basename(zbb), "fresh": os.path.basename(zfa), "jar": jar[1] if jar else None,
                                         "bedrock": be.data}, "resumen": resumen, "mobs": propios + mobs, "items": items,
              "vanilla": vanilla, "problemas": problemas}
    escribir(os.path.join(bib, "indice.json"), json.dumps(indice, ensure_ascii=False, indent=0).encode("utf-8"))
    return {"ok": True, **resumen, "cem": len(cem), "problemas": problemas,
            "sin_pose": {k: v["_sin_pose"] for k, v in vanilla.items() if "_sin_pose" in v}}


if __name__ == "__main__":
    try:
        r = main()
    except Exception as ex:
        import traceback
        traceback.print_exc()
        r = {"ok": False, "error": f"{type(ex).__name__}: {ex}"}
    print(json.dumps(r, ensure_ascii=False))
