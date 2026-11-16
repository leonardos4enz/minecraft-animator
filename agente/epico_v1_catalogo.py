"""Video épico "Minecraft Animator": todos los mobs de la biblioteca en ~41 s, cortado a los golpes de la música del tráiler
(música y golpes ya generados: audio/ en caché, no se pide nada nuevo a ElevenLabs).

  python agente/epico.py            → agente/proyectos/epico.json   (luego: agente.py abrir '{"nombre": "epico"}')
  python agente/epico.py poses      → imprime los comandos `personaje` de cada toma (poses y ojos de LTezla)
"""
import copy
import json
import os
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_n = 0


def nid():
    global _n
    _n += 1
    return f"ep{_n:04d}"


def V(az, el, dist, ty, **k):
    return {"az": az, "el": el, "dist": dist, "ty": ty, "fov": 40, **k}


def G(tipo, n, x, z, **k):
    """grupo de mobs (semilla estable a partir de la posición)"""
    return {"tipo": tipo, "n": n, "x": x, "z": z, "ancho": 1.6, "prof": 1.6, "semilla": n * 7 + round(x * 13 + z * 5) + len(tipo), **k}


def U(tipo, x, z, **k):
    """un solo mob en un punto"""
    return {"tipo": tipo, "n": 1, "x": x, "z": z, "fijo": True, "semilla": round(abs(x) * 31 + abs(z) * 17) + len(tipo), **k}


# estilo de títulos (como el tráiler)
VERDE = dict(color="#0dbd14", color2="#18c91f", sombra="#021a08", sombra2="#06420f")
AMARILLO = dict(color="#faf90d", color2="#ffff2e", sombra="#b0400c", sombra2="#f2a018")
ROJO = dict(color="#ff4a3d", color2="#ff7a5c", sombra="#3a0505", sombra2="#7a120c")
CIAN = dict(color="#16eef9", color2="#4ff7ff", sombra="#03384e", sombra2="#0a7d96")
ROSA = dict(color="#f9b2fa", color2="#ffc6ff", sombra="#5a003e", sombra2="#9a0e6c")
MORADO = dict(color="#c48cff", color2="#dcb8ff", sombra="#2a0a4e", sombra2="#5a1f96")
BLANCO = dict(color="#d8d3d2", color2="#efeaea", sombra="#3e3a3a", sombra2="#6a6464")


def T(texto, x, y, tam, estilo, dur, inicio=0.0, **k):
    return {"texto": texto, "x": x, "y": y, "tam": tam, "prof": 0.35, "relieve": 0.06, "espaciado": -0.04, "interlinea": 1.05,
            "dur": dur, "inicio": inicio, "anim": "golpe", **estilo, **k}


GATOS = ["atigrado", "negro", "rojo", "siames", "britanico", "calico", "persa", "ragdoll", "blanco", "jellie", "todo_negro"]
LANAS = ["blanco", "naranja", "magenta", "azul_claro", "amarillo", "verde_lima", "rosa", "gris", "gris_claro", "cian", "morado",
         "azul", "cafe", "verde", "rojo", "negro"]
CABALLOS = ["castano", "blanco+manchas_blancas", "crema", "negro+patas_blancas", "cafe_oscuro+puntos_blancos", "gris", "cafe+puntos_negros"]
ZOMBI_ALD = ["desierto+armero", "jungla+agricultor", "sabana+carnicero", "nieve+librero", "pantano+sacerdote", "taiga+herrero", "llanura+pescador"]

# ───────────── guion: (duración, escena, cámaras, poses, ojos, títulos, matices) ─────────────
# cortes = golpes de la música del tráiler (2.0, 3.75, 4.5, 6.2, 8.0, 11.0, 12.2, 14.5, 15.5, 18.54, 21.0, 22.29, 23.0,
# 24.5, 25.875, 27.917, 29.5, 33.1; termina en 40.85)
DIA = dict(set="pradera", ambiente="dia", sat=1.25, calidez=2)
TOMAS = []


def toma(dur, nombre, escena, cams, poses=None, ojos=None, textos=(), matices=()):
    TOMAS.append(dict(dur=dur, nombre=nombre, escena=escena, cams=cams, poses=poses or [["reposo", dur]], ojos=ojos or [["feliz", dur]],
                      textos=list(textos), matices=list(matices)))


# 1 · negro: el nombre aparece
toma(2.0, "Intro: MINECRAFT ANIMATOR", dict(negro=True), [dict(desde=V(0, 4, 4, 1.1))],
     textos=[T("MINECRAFT", 0.5, 0.40, 13.5, BLANCO, 1.75, 0.2, anim="aparecer", fundido={"entra": 0.5, "sale": 0.25}, giro=[-10, 0, 0]),
             T("ANIMATOR", 0.5, 0.56, 9.0, VERDE, 1.75, 0.45, anim="aparecer", fundido={"entra": 0.45, "sale": 0.25}, espaciado=0.08)])

# 2 · amanecer: LTezla de espaldas mira el valle lleno de ovejas de colores
toma(1.75, "Amanecer: LTezla mira el valle", dict(DIA, ambiente="atardecer", actor={"x": 0, "y": 0, "z": 3, "rot": 180}, dof=0.4,
     mobs=[U("oveja", -3 + (i % 8) * 0.9, -2 - (i // 8) * 1.4, variante=LANAS[i], modo="quieto", dir=(i * 47) % 360) for i in range(16)]),
     [dict(desde=V(185, 10, 4.2, 1.5, tilt=6), hasta=V(172, 7, 3.4, 1.5, tilt=6), temblor=0.12)],
     poses=[["contemplar", 1.75]])

# 3 · gatos de las 11 razas corren hacia la cámara
toma(0.75, "Gatos: 11 razas corriendo", dict(DIA, ocultar=True, dof=0.5,
     mobs=[U("gato", -2.0 + i * 0.4, -2.6 - (i % 3) * 0.5, variante=v, modo="correr", dir=0, vel=3.6) for i, v in enumerate(GATOS)]),
     [dict(desde=V(0, 4, 2.6, 0.25, tilt=3), hasta=V(0, 4, 3.2, 0.25, tilt=3), temblor=0.3)])

# 4 · estampida de ovejas arcoíris + "92 MOBS"
toma(1.7, "Ovejas arcoíris en estampida", dict(DIA, ocultar=True, dof=0.35,
     mobs=[U("oveja", -3.6 + (i % 8) * 1.0, -5 - (i // 8) * 1.8 - (i % 3) * 0.4, variante=LANAS[i], modo="correr", dir=0, vel=3.0) for i in range(16)]
     + [U("cordero", -2.5 + i * 1.6, -3.4, variante=LANAS[(i * 5) % 16], modo="correr", dir=0, vel=3.6) for i in range(4)]),
     [dict(desde=V(0, 5, 5.0, 0.7), hasta=V(0, 4, 7.0, 0.7), temblor=0.35)],
     textos=[T("92 MOBS", 0.5, 0.30, 15, AMARILLO, 1.5, 0.15)])

# 5 · caballos galopan de lado (colores y marcas)
toma(1.8, "Caballos al galope", dict(DIA, ocultar=True, dof=0.3,
     mobs=[U("caballo", -11 + i * 1.7 - (i % 2) * 0.8, -1.2 + (i % 3) * 1.1, variante=v, modo="correr", dir=90, vel=5.2) for i, v in enumerate(CABALLOS)]
     + [U("burro", -14.5, 0.6, modo="correr", dir=90, vel=5.0), U("mula", -15.5, -0.8, modo="correr", dir=90, vel=5.0)]),
     [dict(desde=V(0, 4, 8.5, 1.0, pan=-18), hasta=V(0, 4, 8.5, 1.0, pan=14), temblor=0.25)])

# 6 · LA ESTAMPIDA: todos los animales hacia la cámara
ANIMALES = [("vaca", "templada"), ("vaca", "fria"), ("vaca", "calida"), ("cerdo", "templada"), ("cerdo", "fria"), ("cerdo", "calida"),
            ("gallina", "templada"), ("gallina", "fria"), ("gallina", "calida"), ("champinaca", "roja"), ("champinaca", "cafe"),
            ("llama", "blanca"), ("llama", "cafe"), ("llama_comerciante", None), ("cabra", None), ("zorro", "rojo"), ("zorro", "nieve"),
            ("conejo", "blanco"), ("conejo", "dorado"), ("conejo", "negro"), ("panda", "normal"), ("panda", "cafe"), ("oso_polar", None),
            ("camello", None), ("armadillo", None), ("rana", "templada"), ("rana", "fria"), ("rana", "calida"), ("sniffer", None),
            ("tortuga", None), ("lobo", None), ("ocelote", None), ("cabrito", None), ("pollito", None)]
toma(3.0, "Estampida: todos los animales", dict(DIA, ocultar=True, dof=0.25,
     mobs=[U(t, -5.5 + (i % 9) * 1.35 + (i // 9 % 2) * 0.6, -4.5 - (i // 9) * 2.0, **({"variante": v} if v else {}), modo="correr", dir=0,
             vel=3.0 + (i % 4) * 0.25, retraso=(i % 5) * 0.08) for i, (t, v) in enumerate(ANIMALES)]),
     [dict(desde=V(0, 4, 4.5, 0.8), hasta=V(0, 7, 10.5, 1.0), temblor=0.45)],
     textos=[T("TODOS\nLOS MOBS", 0.5, 0.28, 13, VERDE, 2.4, 0.35)])

# 7 · bajo el agua
toma(1.2, "Océano: delfines, calamares, ajolotes, guardianes", dict(set="agua", ambiente="agua", ocultar=True, dof=0.3,
     mobs=[G("delfin", 3, -2, -2, modo="caminar", dir=90, vel=2.2, ancho=3, prof=2), G("calamar", 2, 2.5, -4, modo="quieto", y=1.6),
           G("calamar_comun", 2, -3, -5, modo="quieto", y=1.2), G("bacalao", 5, 1, -1, modo="caminar", dir=-90, vel=1.4, ancho=2, prof=1.5),
           G("salmon", 4, -1, 0, modo="caminar", dir=80, vel=1.6), U("pez_globo", 1.6, 0.6, modo="quieto"), U("tortuga", -0.8, 1.2, modo="caminar", dir=30, vel=0.4),
           U("guardian", 3.5, -2.5, modo="quieto"), U("guardian_anciano", -4.5, -7, modo="quieto")]
     + [U("ajolote", -1.5 + i * 0.7, 1.8, variante=v, modo="caminar", dir=90, vel=0.7) for i, v in enumerate(["rosa", "cafe", "dorado", "cian", "azul"])]),
     [dict(desde=V(0, 4, 6.5, 1.0), hasta=V(-8, 4, 6.0, 1.0), temblor=0.15)])

# 8 · el cielo: abejas, loros, allays y el ghast feliz; LTezla señala arriba
toma(2.3, "Cielo: loros, abejas, allays, ghast feliz", dict(set="cerezos", ambiente="rosa", actor={"x": 0, "y": 0, "z": 0, "rot": 0}, dof=0.2,
     mobs=[U("loro", -2.6 + i * 1.3, -1.5 + (i % 2), variante=v, modo="caminar", dir=90, vel=1.2) for i, v in enumerate(["rojo", "azul", "verde", "cian", "gris"])]
     + [G("abeja", 4, 2.5, -2, modo="caminar", dir=-90, vel=1.0), G("allay", 3, -2.5, -0.5, modo="caminar", dir=45, vel=0.8),
        U("ghast_feliz", 0.5, -9, modo="flotar", y=5, dir=0), G("cubito", 3, 3.5, -4, color="rosa", modo="flotar", y=2.6, ancho=3)]),
     [dict(desde=V(20, 3, 4.6, 1.6, tilt=-14), hasta=V(38, 3, 5.4, 1.8, tilt=-18), temblor=0.15)],
     poses=[["senalar_arriba", 2.3]], ojos=[["emocionado", 2.3, 0, 0.6]])

# 9 · cae la noche
toma(1.0, "Cae la noche", dict(set="noche", ambiente="noche", ocultar=True, exp=0.8, luna=[0, 0.35], dof=0.5,
     mobs=[U("creeper", 0, 0, modo="quieto", dir=0, calmo=True), U("enderman", -2.4, -3, modo="quieto", dir=20)]),
     [dict(desde=V(0, 0, 2.6, 1.2), hasta=V(0, 0, 2.1, 1.25), temblor=0.1)],
     textos=[T("PERO DE NOCHE...", 0.5, 0.22, 8.5, ROJO, 0.95, 0.05)])

# 10 · el ejército de la noche marcha hacia la cámara
NOCHE = [("zombi", 10), ("esqueleto", 8), ("creeper", 6), ("arana", 4), ("enderman", 3), ("momia", 4), ("ahogado", 4),
         ("esqueleto_glacial", 3), ("esqueleto_pantanoso", 3), ("bruja", 2), ("arana_cueva", 3), ("slime", 2), ("aldeano_zombi", 0)]
mobs10 = []
for i, (t, n) in enumerate(NOCHE):
    if n:
        mobs10.append(G(t, n, -5 + (i % 5) * 2.5, -7 - (i // 5) * 3.5, modo="caminar", dir=0, vel=1.1, ancho=2.6, prof=2.4))
mobs10 += [U("aldeano_zombi", -4.2 + i * 1.4, -4.2 - (i % 2) * 0.8, variante=v, modo="caminar", dir=0, vel=1.0) for i, v in enumerate(ZOMBI_ALD)]
mobs10 += [G("phantom", 3, 0, -6, modo="caminar", dir=90, vel=2.0, y=4.5, ancho=6)]
toma(3.042, "Noche: el ejército de monstruos", dict(set="noche", ambiente="noche", ocultar=True, exp=1.05, luna=[0, 0.4], dof=0.3, mobs=mobs10),
     [dict(desde=V(0, 3, 5.6, 1.3), hasta=V(0, 2, 4.4, 1.2), temblor=0.2)],
     textos=[T("MONSTRUOS", 0.5, 0.2, 11, ROJO, 2.6, 0.4)])

# 11 · la incursión: LTezla con espada frente a los illagers
toma(2.458, "Incursión: LTezla contra los illagers", dict(DIA, ambiente="atardecer", actor={"x": 0, "y": 0, "z": 2.5, "rot": 180}, objeto="diamond_sword", dof=0.35,
     mobs=[G("saqueador", 4, -2.5, -7, modo="caminar", dir=0, vel=1.3, objeto="crossbow"), G("vindicador", 4, 1.5, -7.5, modo="caminar", dir=0, vel=1.4, objeto="iron_axe"),
           U("invocador", 0, -8, modo="caminar", dir=0, vel=1.0), U("ilusionista", -3.5, -9, modo="caminar", dir=0, vel=1.0),
           U("devastador", 4.5, -9, modo="caminar", dir=-10, vel=1.4), U("devastador", -5.5, -10.5, modo="caminar", dir=10, vel=1.3),
           G("vex", 3, 0, -6, modo="caminar", dir=0, vel=1.5, y=1.8)]),
     [dict(desde=V(170, 6, 3.6, 1.6, pan=4), hasta=V(160, 4, 3.0, 1.5, pan=4), temblor=0.2)],
     poses=[["en_guardia", 2.458]], ojos=[["determinado", 2.458]])

# 12 · el Nether
toma(1.292, "Nether: piglins, hoglins, blazes, ghasts", dict(set="nether", ambiente="nether", ocultar=True, dof=0.25,
     mobs=[G("piglin", 4, -2, -3, modo="caminar", dir=0, vel=1.2, objeto="golden_sword"), G("piglin_bruto", 2, 2, -3.5, modo="caminar", dir=0, vel=1.2, objeto="golden_axe"),
           G("piglin_zombificado", 3, 0, -6, modo="caminar", dir=0, vel=1.0), G("hoglin", 2, -4, -6, modo="caminar", dir=20, vel=1.4),
           U("zoglin", 4.5, -6, modo="caminar", dir=-20, vel=1.4), G("blaze", 3, 0, -9, modo="flotar", y=2.5, ancho=5),
           G("cubo_magma", 2, 3, -1, modo="caminar", dir=-45, vel=1.2), U("ghast", -3, -16, modo="flotar", y=7),
           U("strider", -4.5, -1, modo="caminar", dir=45, vel=0.6), G("esqueleto_wither", 2, 4, -8, modo="caminar", dir=0, vel=1.1)]),
     [dict(desde=V(0, 6, 7.5, 1.4), hasta=V(10, 4, 6.5, 1.4), temblor=0.2)])

# 13 · el warden, de cerca y en contrapicado
toma(0.708, "Warden", dict(set="noche", ambiente="noche", ocultar=True, exp=1.25, dof=0.5,
     mobs=[U("warden", 0, 0, modo="caminar", dir=0, vel=0.5), U("crujidor", -2.2, -2.2, modo="quieto", dir=20)]),
     [dict(desde=V(-20, 3, 5.2, 1.9, tilt=-8), hasta=V(-16, 3, 4.6, 2.0, tilt=-10), temblor=0.35)])

# 14 · los jefes: dragón y wither
toma(1.5, "Jefes: dragón del End y wither", dict(set="cresta", ambiente="noche", ocultar=True, cielo=[180, 10], luna=[180, 0.45], exp=0.9,
     mobs=[U("dragon_ender", -16, -12, modo="caminar", dir=90, vel=9, y=5), U("wither", 2.2, -2.5, modo="flotar", y=1.2, dir=-15),
           G("esqueleto_wither", 3, -1.5, -1, modo="quieto", dir=0)]),
     [dict(desde=V(0, 2, 8, 2.8, tilt=-9), hasta=V(0, 2, 7, 3.0, tilt=-11), temblor=0.3)],
     textos=[T("JEFES", 0.5, 0.78, 12, MORADO, 1.4, 0.1)])

# 15 · LTezla, determinado (respiro antes del final)
toma(1.375, "LTezla se prepara", dict(DIA, ambiente="atardecer", actor={"x": 0, "y": 0, "z": 0, "rot": 0}, objeto="diamond_sword", dof=0.7),
     [dict(desde=V(-42, 2, 2.4, 1.5), hasta=V(-32, 2, 2.0, 1.5), temblor=0.1)],
     poses=[["en_guardia", 1.375]], ojos=[["determinado", 1.375, 0, 0, {"aCamara": True}]])

# 16 · los aliados detrás de LTezla: gólems, aldeanos y mascotas
ALIADOS = [U("golem_hierro", -2.2, -1.6, modo="quieto", dir=0), U("golem_hierro", 2.2, -1.6, modo="quieto", dir=0),
           U("golem_nieve", -3.6, -0.6, modo="quieto", dir=0), U("golem_nieve", 3.6, -0.6, modo="quieto", dir=0)]
ALIADOS += [U("golem_cobre", -1.4 + i * 0.95, 1.2, variante=v, modo="quieto", dir=0) for i, v in enumerate(["cobre", "expuesto", "erosionado", "oxidado"])]
ALIADOS += [U("aldeano", -5, -2.5, modo="quieto", dir=10), U("granjero", 5, -2.5, modo="quieto", dir=-10), U("comerciante", -6.2, -1, modo="quieto", dir=20),
            U("lobo", -1.0, 0.7, armadura="#ff86b8", modo="quieto", dir=0), U("lobo", 1.0, 0.7, armadura="#a99cff", modo="quieto", dir=0),
            U("gato", -0.6, 1.9, variante="siames", modo="quieto", dir=0), U("gato", 0.6, 1.9, variante="negro", modo="quieto", dir=0)]
toma(2.042, "Los aliados: gólems, aldeanos, mascotas", dict(DIA, ambiente="atardecer", actor={"x": 0, "y": 0, "z": 0, "rot": 0}, objeto="diamond_sword", dof=0.3, mobs=ALIADOS),
     [dict(desde=V(0, 4, 4.5, 1.2), hasta=V(0, 14, 8.5, 1.6), temblor=0.15)],
     poses=[["chulo", 2.042]], ojos=[["determinado", 2.042]], textos=[T("ALIADOS", 0.5, 0.18, 10, CIAN, 1.9, 0.05)])

# 17 · ¡a la carga!
CARGA = [dict(m, modo="correr", dir=0, vel=4.2, x=m["x"], z=m["z"] - 3) for m in ALIADOS]
toma(1.583, "¡A la carga!", dict(DIA, ambiente="atardecer", actor={"x": 0, "y": 0, "z": -3, "rot": 0}, actorHasta={"x": 0, "y": 0, "z": 4.5, "rot": 0},
     objeto="diamond_sword", dof=0.3, mobs=CARGA + [G("caballo", 3, -4, -6, variante="negro", modo="correr", dir=0, vel=4.8)]),
     [dict(desde=V(0, 2, 4.2, 1.1), hasta=V(0, 2, 4.6, 1.1), temblor=0.5)],
     poses=[["correr", 1.583]], ojos=[["furioso", 1.583]], matices=[["correr", 0, 1.583, 1]])

# 18 · EL FINAL: todos los mobs juntos alrededor de LTezla, la cámara gira y sube
import math  # noqa: E402
TODOS = [t for t in ["vaca", "cerdo", "gallina", "oveja", "cabra", "llama", "caballo", "burro", "mula", "champinaca", "zorro", "conejo", "panda",
                     "oso_polar", "camello", "armadillo", "rana", "tortuga", "sniffer", "lobo", "gato", "ocelote", "loro", "allay", "abeja",
                     "aldeano", "granjero", "aldeanito", "comerciante", "bruja", "golem_hierro", "golem_nieve", "golem_cobre", "pollito",
                     "cabrito", "cordero", "llama_comerciante", "strider", "hoglin", "zoglin", "piglin", "piglin_bruto", "piglin_zombificado",
                     "zombi", "momia", "ahogado", "aldeano_zombi", "esqueleto", "esqueleto_glacial", "esqueleto_pantanoso", "esqueleto_reseco",
                     "esqueleto_wither", "creeper", "arana", "arana_cueva", "enderman", "endermite", "pez_plateado", "slime", "cubo_magma",
                     "blaze", "saqueador", "vindicador", "invocador", "ilusionista", "devastador", "vex", "breeze", "crujidor", "warden",
                     "caballo_esqueleto", "caballo_zombi", "shulker", "golem_cobre", "murcielago", "phantom"]]
VAR_FINAL = {"oveja": "rosa", "gato": "calico", "caballo": "blanco+manchas_blancas", "loro": "azul", "conejo": "dorado", "panda": "jugueton",
             "aldeano_zombi": "pantano+librero", "rana": "calida", "vaca": "fria", "cerdo": "calida", "llama": "cafe", "ajolote": "cian"}
mobs18 = []
for i, t in enumerate(TODOS):
    anillo = 0 if i < 14 else 1 if i < 34 else 2 if i < 58 else 3
    en_anillo = [14, 20, 24, 40][anillo]
    k = i - [0, 14, 34, 58][anillo]
    r = [2.6, 4.4, 6.4, 8.6][anillo]
    a = 2 * math.pi * (k + 0.5 * (anillo % 2)) / en_anillo
    x, z = round(r * math.sin(a), 2), round(r * math.cos(a), 2)
    vuela = t in ("loro", "allay", "abeja", "vex", "murcielago", "phantom", "blaze", "breeze")
    mobs18.append(U(t, x, z, modo="quieto", dir=round(math.degrees(math.atan2(-x, -z))), **({"variante": VAR_FINAL[t]} if t in VAR_FINAL else {}),
                    **({"y": 2.2 + (i % 3) * 0.6} if vuela else {})))
mobs18 += [U("ghast_feliz", -6, -14, modo="flotar", y=6, dir=0), U("ghast", 9, -16, modo="flotar", y=8, dir=-30),
           U("dragon_ender", 0, -22, modo="caminar", dir=90, vel=4, y=14), U("wither", -11, -8, modo="flotar", y=3, dir=40),
           U("guardian_anciano", 12, -6, modo="flotar", y=2, dir=-60)]
toma(3.6, "FINAL: todos los mobs alrededor de LTezla", dict(DIA, ambiente="atardecer", actor={"x": 0, "y": 0, "z": 0, "rot": 0}, objeto="diamond_sword", dof=0.15, mobs=mobs18),
     [dict(desde=V(0, 8, 4.5, 1.3), hasta=V(80, 32, 15.5, 1.0), curva="suave", temblor=0.1)],
     poses=[["victoria", 3.6]], ojos=[["muy_feliz", 3.6, 0, 0, {"aCamara": True}]])

# 19 · tarjeta final
FIN = dict(dur=7.75, fundido={"entra": 0.55, "sale": 1.2}, anim="aparecer", deriva=0)
toma(7.75, "Tarjeta final", dict(negro=True), [dict(desde=V(0, 4, 4, 1.1))],
     textos=[T("MINECRAFT", 0.5, 0.20, 12.5, BLANCO, inicio=0.3, giro=[-14, 0, 0], **FIN),
             T("ANIMATOR", 0.5, 0.33, 8.6, VERDE, inicio=0.45, espaciado=0.08, **{**FIN, "dur": 7.6}),
             T("92 MOBS  ·  1205 OBJETOS  ·  12 ESCENARIOS", 0.5, 0.49, 3.4, AMARILLO, inicio=0.9, prof=0.12, relieve=0.03, **{**FIN, "dur": 7.15}),
             T("FRESH ANIMATIONS + BARE BONES · HECHO EN TU NAVEGADOR", 0.5, 0.57, 2.3, BLANCO, inicio=1.2, prof=0.08, relieve=0, peso=400, **{**FIN, "dur": 6.85}),
             T("¡ANÍMALO TÚ!", 0.5, 0.72, 6.5, ROSA, inicio=1.6, **{**FIN, "dur": 6.45})])

GOLPES = [2.0, 3.75, 4.5, 6.2, 8.0, 11.0, 12.2, 14.5, 15.5, 18.542, 21.0, 22.292, 23.0, 24.5, 25.875, 27.917, 29.5, 33.1]
MUSICA = "Upbeat playful electronic game music, 128 bpm, kick on every beat, plucky square-wave lead, glittery arpeggios, warm synth bass, whoosh and boom accents, joyful and energetic like a Minecraft update trailer. 2 second fade-in intro, energetic main section, breakdown with build-up around 24 seconds, final drop, ends at 33 seconds with an epic hit and a soft 7 second fading outro. No vocals."
BOOM = "short deep cinematic boom impact with a quick whoosh, trailer hit"


def armar():
    base = json.load(open(os.path.join(RAIZ, "agente", "proyectos", "epico_base.json"), encoding="utf-8"))
    trailer = json.load(open(os.path.join(RAIZ, "proyectos", "trailer-bobicraft-ltezla.json"), encoding="utf-8"))   # solo lectura
    reposo = copy.deepcopy(base["pistas"]["poses"][0]["pose"])
    p = copy.deepcopy(base)
    p["nombre"] = "Minecraft Animator - Épico"
    p["escena"] = copy.deepcopy(trailer["escena"])
    p["efectos"] = copy.deepcopy(trailer["efectos"])
    p["ajustes"] = {**trailer["ajustes"], "formato": "1280x720"}
    p["mundo"] = None
    k = {"escenas": [], "camara": [], "poses": [], "ojos": [], "matices": [], "textos": [], "audio": []}
    t0 = 0
    for s in TOMAS:
        k["escenas"].append({"id": nid(), "dur": s["dur"], "nombre": s["nombre"], "mobs": [], **s["escena"]})
        for c in s["cams"]:
            c = dict(c)
            k["camara"].append({"id": nid(), "tipo": "libre", "dur": c.pop("dur", s["dur"]), "desde": c["desde"], "hasta": c.pop("hasta", c["desde"]),
                                "curva": c.pop("curva", "lineal"), **{a: b for a, b in c.items() if a != "desde"}})
        for i, (_, dur, *_r) in enumerate(s["poses"]):
            k["poses"].append({"id": nid(), "pose": copy.deepcopy(reposo), "dur": dur, "trans": 0 if i == 0 else 0.35, "curva": "natural", **({"corte": True} if i == 0 else {})})
        for cara, dur, *r in s["ojos"]:
            k["ojos"].append({"id": nid(), "cara": cara, "dur": dur, "mx": r[0] if r else 0, "my": r[1] if len(r) > 1 else 0, **(r[2] if len(r) > 2 else {})})
        for tipo, ini, dur, inten in s["matices"]:
            k["matices"].append({"id": nid(), "tipo": tipo, "inicio": round(t0 + ini, 3), "dur": dur, "intensidad": inten})
        for x in s["textos"]:
            k["textos"].append({"id": nid(), **x, "inicio": round(t0 + x.get("inicio", 0), 3)})
        t0 += s["dur"]
    musica = next(a for a in trailer["pistas"]["audio"] if a["tipo"] == "musica")
    boom = next(a for a in trailer["pistas"]["audio"] if a["texto"] == BOOM)
    k["audio"].append({**musica, "id": nid(), "inicio": 0, "dur": round(t0, 3)})
    for g in GOLPES:
        k["audio"].append({**boom, "id": nid(), "inicio": round(g - 0.05, 3)})
    p["pistas"] = k
    return p, t0


if __name__ == "__main__":
    p, total = armar()
    if len(sys.argv) > 1 and sys.argv[1] == "poses":
        for i, s in enumerate(TOMAS, 1):
            print(json.dumps({"toma": i, "poses": s["poses"], "ojos": s["ojos"]}, ensure_ascii=False))
    else:
        ruta = os.path.join(RAIZ, "agente", "proyectos", "epico.json")
        json.dump(p, open(ruta, "w", encoding="utf-8"), ensure_ascii=False)
        print(json.dumps({"archivo": ruta, "tomas": len(TOMAS), "duracion": round(total, 3),
                          "mobs": sum(sum(m.get("n", 1) for m in s["escena"].get("mobs", [])) for s in TOMAS)}))
