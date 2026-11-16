"""Estilo nuevo del can-can: filtros de Minecraft, impact frames con golpe en el mundo, paletas y partículas.

    python agente/cancan/estilo.py              → agente/proyectos/cancan.json + estilo_golpes_<sección>.json
    python agente/cancan/estilo.py render vN    → agente/cancan/salida/borrador_<vN>.mp4 (540×960, calidad baja)

La canción entera (118.4 s, 148 compases de 2/4 a 150 bpm) en 10 secciones (ver SECCIONES). Cada sección arma su propia
espiral de bloques musicales alrededor de LTezla (la melodía se abre hacia afuera, una vuelta cada 4 compases, la altura
= el tono; el bajo en un anillo cerca de él) y la anterior se va con el impacto que abre la sección.

En cada impacto: impact frame de 2 cuadros (silueta) + en el mundo LTezla salta y aterriza, explosión de humo de pixeles,
onda en el suelo, tierra que salta, los últimos bloques estallan y la cámara se sacude. Además la paleta del mundo, el
cielo y el filtro de Minecraft cambian en el corte. Cada nota: corchea, destello, onda, haz de luz y chispas (más fuertes
en las partes ff). La prueba anterior (sólo el coro) quedó en estilo_prueba_coro.py.
"""
import copy, json, math, random, subprocess, sys, time
from pathlib import Path

import video as V

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parents[1]
FPS = 30
COMPAS = 0.8                                   # 2/4 a 150 bpm
NEGRA = 0.4
VUELTA = 4 * COMPAS                            # una vuelta de la espiral = 4 compases
DUR = V.DUR


def tb(c):                                     # inicio del compás c (1 = el primero)
    return round((c - 1) * COMPAS, 4)


# ── secciones: compases [c0, c1], por nota (anillo, rayo, chispas) y las tomas (compás, largo en compases, cámara,
# paleta, cielo, filtro, impacto). impacto: "mundo" = impact frame + golpe en el mundo; "congela" = además cámara lenta
# congelada (bullet time); "suspendido" = la nota larga; "final" = el último; None = corte limpio.
# extra: impactos a mitad de toma (compases); temblor: la cámara tiembla en cada negra (de f0 a f1)
T = lambda c, n, cam, pal=None, amb="dia", fil=None, imp="mundo", **kw: dict(c=c, n=n, cam=cam, pal=pal, amb=amb, fil=fil, imp=imp, **kw)
# ronda 4 (críticos): gancho de frente con impacto en el cuadro 0; sin impactos a mitad de toma; un solo creeper y un
# solo spider corto; el lápiz sólo 3.2 s; los filtros raros se guardan para la segunda mitad; plano de recompensa al final
SECCIONES = [
    dict(nombre="galop", c=(1, 16), nota=(1.0, 0, 0), tomas=[
        T(1, 4, "cerca", imp="mundo"), T(5, 4, "ras", imp=None), T(9, 4, "grua", imp=None), T(13, 4, "latigo", imp=None)]),
    dict(nombre="octavas", c=(17, 31), nota=(1.3, 2.0, 4), tomas=[
        T(17, 2, "empuje", "nether", "nether"), T(19, 2, "cerca", "nether", "nether", None, None),
        T(21, 2, "holandes", "roja", "atardecer"), T(23, 2, "alto", "roja", "atardecer", None, None),
        T(25, 2, "ras", "naranja", "dorado"), T(27, 2, "cerca", "naranja", "dorado", None, None),
        T(29, 3, "grua", "oro", "dorado", "deconverge")]),
    dict(nombre="re-la", c=(32, 39), nota=(1.3, 2.5, 5), tomas=[
        T(32, 4, "espiral_sube", "obsidiana", "atardecer", None),
        T(36, 2, "vertigo", "obsidiana", "atardecer", "wobble", None, temblor=(0.15, 0.45)),
        T(38, 2, "holandes", "obsidiana", "atardecer", ("oscuridad", 0.4), None, temblor=(0.3, 0.8))]),
    dict(nombre="coro en sol", c=(40, 71), nota=(1.5, 3.0, 6), tomas=[
        T(40, 2, "ras", "rosa", "rosa", None, "congela"), T(42, 2, "alto", "azul", "lila"),
        T(44, 2, "cerca", "oro", "dorado", "bits"), T(46, 2, "holandes", "verde", "dia", ("creeper", 0.6)),
        T(48, 2, "latigo", "end", "lila", "ntsc"), T(50, 2, "vertigo", "nether", "nether"),
        T(52, 2, "cenital", "prismarina", "atardecer"), T(54, 2, "cerca", "lila", "lila", ("spider", 1.0, 0.8)),
        T(56, 2, "ras", "rosa", "rosa", None, "congela"), T(58, 2, "empuje", "hielo", "nieve", "deconverge"),
        T(60, 2, "holandes", "oro", "dorado"), T(62, 2, "alto", "verde", "dia"),
        T(64, 2, "latigo", "roja", "atardecer", "wobble"), T(66, 2, "cerca", "azul", "noche"),
        T(68, 2, "grua", "prismarina", "atardecer"), T(70, 2, "ras", "end", "lila", "bits")]),
    dict(nombre="galop 2", c=(72, 83), nota=(1.0, 0, 2), tomas=[
        T(72, 4, "cerca", None, "noche", None, "mundo"), T(76, 4, "cenital", None, "noche", "vision", None),
        T(80, 4, "ras", None, "noche", None, None)]),
    dict(nombre="subida", c=(84, 93), nota=(1.3, 2.5, 5), tomas=[
        T(84, 4, "vertigo", "hielo", "nieve", "nieve", "mundo"),
        T(88, 2, "grua", "hielo", "nieve", ("oscuridad", 0.5), None, temblor=(0.2, 0.6)),
        T(90, 1, "cerca", "hielo", "nieve", None, None, temblor=(0.5, 0.7)),
        T(91, 1, "holandes", "hielo", "nieve", "deconverge", None, temblor=(0.6, 0.8)),
        T(92, 1, "ras", "hielo", "nieve", None, None, temblor=(0.7, 0.9)),
        T(93, 1, "empuje", "hielo", "nieve", "bits", None, temblor=(0.8, 1.0))]),
    dict(nombre="coro en re", c=(94, 123), nota=(1.8, 4.0, 8), tomas=[
        T(94, 2, "ras", "oro", "dorado", None, "congela"), T(96, 2, "alto", "nether", "nether", "deconverge"),
        T(98, 2, "holandes", "rosa", "rosa", "bits"), T(100, 2, "latigo", "azul", "lila", "ntsc"),
        T(102, 2, "cerca", "verde", "dia"), T(104, 2, "vertigo", "end", "lila"),
        T(106, 2, "cenital", "roja", "atardecer", "ntsc"), T(108, 2, "empuje", "prismarina", "atardecer", "bits"),
        T(110, 2, "ras", "oro", "dorado"), T(112, 2, "holandes", "nether", "nether", "deconverge"),
        T(114, 2, "latigo", "lila", "lila", "sobel"), T(116, 2, "cerca", "azul", "noche", "bits"),
        T(118, 2, "grua", "rosa", "rosa"), T(120, 2, "alto", "verde", "dia", "deconverge"),
        T(122, 2, "ras", "end", "lila", "sobel")]),
    dict(nombre="hop hop", c=(124, 135), nota=(1.6, 3.5, 7), tomas=[
        T(124, 2, "cerca", None, "dia", "pencil"), T(126, 2, "ras", None, "dia", "pencil"),
        T(128, 2, "holandes", "rosa", "rosa", "sobel"), T(130, 2, "latigo", "oro", "dorado"),
        T(132, 2, "empuje", "azul", "noche", "deconverge"), T(134, 2, "vertigo", "nether", "nether")]),
    dict(nombre="nota larga", c=(136, 140), nota=(1.5, 3.0, 6), tomas=[
        T(136, 5, "orbita_lenta", "end", "lila", None, "suspendido")]),
    dict(nombre="final", c=(141, 148), nota=(2.0, 4.5, 10), tomas=[
        T(141, 1, "empuje", "oro", "dorado"), T(142, 1, "ras", "rosa", "rosa", "deconverge", None),
        T(143, 1, "holandes", "azul", "noche"), T(144, 1, "cerca", "nether", "nether", "bits", None),
        T(145, 1, "alto", "verde", "dia"), T(146, 1, "latigo", "prismarina", "atardecer", None, None),
        T(147, 0.5, "cerca", "lila", "lila", None, "final")]),
    # la recompensa: la espiral de las 1.918 notas de la canción, toda junta, mientras suena la cola del último acorde
    dict(nombre="cierre", c=(147.5, 147.5), nota=(0, 0, 0), todo=True, tomas=[
        T(147.5, 3, "recompensa", None, "dorado", None, None)]),
]
COLOR_IMP = {"nether": "#ff5a3a", "roja": "#ff4a3a", "naranja": "#ffa040", "oro": "#ffd23a", "obsidiana": "#9a66ff",
             "rosa": "#ff7ac0", "azul": "#6fb0ff", "verde": "#4dff6a", "end": "#f3f0a0", "prismarina": "#6ff0d0",
             "lila": "#d6a6ff", "hielo": "#bfe8ff", None: "#ffffff"}
TIERRA = {"nether": "netherrack", "roja": "netherrack", "end": "end_stone", "lila": "end_stone", "hielo": "stone",
          "oro": "sand", "naranja": "sand"}
BLOQ = "texturas_mc/packs/barebones/block/"


# ── cámaras: ruta [[tau, az, el, dist, ty, fov, roll], …] para una toma de d segundos (az relativo al frente de LTezla)
# (cerca: dentro del anillo libre entre el bajo, r 2.5, y la espiral, r ≥ 6.5; abiertas: altas, por encima de la espiral)
def ruta_camara(estilo, d, az0):
    k = lambda u, az, el, dist, ty=1.2, fov=38, roll=0: [round(u * d, 3), round(az, 2), el, dist, ty, fov, roll]
    if estilo == "cerca":
        return [k(0, az0, 9, 4.6), k(1, az0 + 28, 7, 4.3)]
    if estilo == "alto":
        return [k(0, az0, 44, 12, 1.0), k(1, az0 + 32, 48, 11, 1.0)]
    if estilo == "ras":                         # contrapicado con gran angular: LTezla enorme contra el cielo
        return [k(0, az0, -7, 3.3, 1.5, 64), k(1, az0 + 22, -9, 3.0, 1.5, 66)]
    if estilo == "holandes":                    # plano holandés: la cámara ladeada
        return [k(0, az0, 12, 5.2, 1.2, 36, 16), k(1, az0 + 16, 10, 5.0, 1.2, 36, 22)]
    if estilo == "vertigo":                     # efecto vértigo: se aleja mientras cierra el zoom (LTezla queda igual)
        return [k(0, az0, 28, 3.6, 1.2, 64), k(0.5, az0 + 6, 29, 7.5, 1.2, 33), k(1, az0 + 12, 30, 13, 1.2, 20)]
    if estilo == "latigo":                      # giro de látigo de 180°
        return [k(0, az0, 18, 5.2), k(0.3, az0 + 14, 18, 5.2), k(0.55, az0 + 160, 20, 5.4), k(1, az0 + 180, 20, 5.4)]
    if estilo == "grua":
        return [k(0, az0, 6, 5.0), k(0.5, az0 + 20, 32, 7.5), k(1, az0 + 40, 55, 9.5, 1.0)]
    if estilo == "empuje":                      # acercamiento de choque
        return [k(0, az0, 34, 15, 1.0), k(0.35, az0 + 6, 14, 5.0), k(1, az0 + 14, 10, 4.5)]
    if estilo == "cenital":                     # desde arriba, girando
        return [k(0, az0, 74, 7.5, 1.0), k(1, az0 + 90, 76, 7.0, 1.0)]
    if estilo == "dron_baja":
        return [k(0, az0, 62, 34, 1.0), k(0.6, az0 + 40, 25, 12), k(1, az0 + 60, 12, 6.0)]
    if estilo == "espiral_sube":
        return [k(0, az0, 5, 5.0), k(0.5, az0 + 90, 26, 8), k(1, az0 + 180, 48, 11, 1.0)]
    if estilo == "orbita_lenta":                # bullet time: vuelta de 300° alrededor de LTezla suspendido
        return [k(i / 6, az0 + 50 * i, round(14 + 6 * math.sin(i), 2), 6.0, 2.2, 40) for i in range(7)]
    if estilo == "recompensa":                  # sube hasta ver la espiral de toda la canción
        # sube y se queda quieta el último 0.8 s sobre la espiral entera (ronda 5: 1.8 s siempre en movimiento no se leía)
        return [k(0, az0, 26, 6, 1.3, 40), k(0.35, az0 + 25, 50, 26, 1.0, 40), k(0.7, az0 + 45, 70, 62, 1.0, 40),
                k(0.85, az0 + 48, 71, 64, 1.0, 40), k(1, az0 + 49, 71, 64.5, 1.0, 40)]
    raise ValueError(estilo)


# ── la cámara no atraviesa bloques ni los deja delante de LTezla (ronda 4): con los bloques ya puestos en cada instante,
# si la cámara cae dentro de uno o algo tapa la línea hasta el pecho de LTezla, sube (el) y si no alcanza, se acerca
def pos_camara(az, el, dist, ty):
    a, e = math.radians(az), math.radians(el)
    return (math.sin(a) * math.cos(e) * dist, ty + math.sin(e) * dist, math.cos(a) * math.cos(e) * dist)


def ve_actor(celdas, az, el, dist, ty):
    px, py, pz = pos_camara(az, el, dist, ty)
    if py < 0.3:
        return False
    for dx in (-0.35, 0.35):                      # la cámara no puede estar dentro (ni pegada a) un bloque
        for dz in (-0.35, 0.35):
            for dy in (-0.3, 0.3):
                if (math.floor(px + dx), math.floor(py + dy), math.floor(pz + dz)) in celdas:
                    return False
    tx, ty_, tz = 0.0, 1.1, 0.0
    largo = math.dist((px, py, pz), (tx, ty_, tz))
    pasos = max(4, int(largo * 4))
    for i in range(1, pasos):
        u = i / pasos
        if largo * (1 - u) < 0.8:                 # el último tramo es el propio LTezla
            break
        c = (math.floor(px + (tx - px) * u), math.floor(py + (ty_ - py) * u), math.floor(pz + (tz - pz) * u))
        if c in celdas:
            return False
    return True


def resolver_ruta(ruta, d, gs, tc):
    """ruta densa (cada 0.1 s) corregida para que se vea a LTezla"""
    def interp(t):
        for a, b in zip(ruta, ruta[1:]):
            if a[0] <= t <= b[0]:
                u = 0 if b[0] == a[0] else (t - a[0]) / (b[0] - a[0])
                return [a[i] + (b[i] - a[i]) * u for i in range(1, 7)]
        return list(ruta[-1][1:])
    ts = [round(min(d, i * 0.1), 3) for i in range(int(d / 0.1) + 2)]
    ts = sorted(set(ts))
    puntos, cambios = [], 0
    for t in ts:
        az, el, dist, ty, fov, roll = interp(t)
        celdas = {(g[1], g[2], g[3]) for g in gs if g[0] <= tc + t + 0.05}
        el0, dist0 = el, dist
        while not ve_actor(celdas, az, el, dist, ty) and el < 84:
            el = min(84, el + 5)
        while not ve_actor(celdas, az, el, dist, ty) and dist > 2.6:
            dist *= 0.88
        cambios += (el != el0 or dist != dist0)
        puntos.append([t, az, el, dist, ty, fov, roll])
    # suavizar sin perder lo corregido: máximo móvil de la elevación y mínimo de la distancia, luego promedio
    def movil(xs, f, w=3):
        return [f(xs[max(0, i - w):i + w + 1]) for i in range(len(xs))]
    els = movil(movil([q[2] for q in puntos], max), lambda v: sum(v) / len(v), 2)
    dis = movil(movil([q[3] for q in puntos], min), lambda v: sum(v) / len(v), 2)
    for q, e, di in zip(puntos, els, dis):
        q[2], q[3] = round(e, 2), round(di, 2)
        q[1] = round(q[1], 2)
    return puntos, cambios


# ── poses de LTezla
def patada(lado):
    s, o = ("D", "I") if lado == "D" else ("I", "D")
    return {"nombre": f"Patada can-can {s}", "cat": "Baile", "id": "patada", "p": [0, 1.2, 0],
            "r": {f"pierna{s}": [-118, 0, 0], f"rodilla{s}": [0, 0, 0], f"pierna{o}": [6, 0, 0], f"rodilla{o}": [10, 0, 0],
                  "torso": [-10, 0, 0], "cabeza": [-10, 0, 0], "brazoD": [0, 0, -38], "codoD": [-95, 0, 0],
                  "brazoI": [0, 0, 38], "codoI": [-95, 0, 0]}}


PARADO = {"nombre": "Can-can parado", "cat": "Baile", "id": "reposo", "p": [0, 0, 0],
          "r": {"rodillaD": [18, 0, 0], "rodillaI": [18, 0, 0], "piernaD": [-8, 0, 0], "piernaI": [-8, 0, 0],
                "brazoD": [0, 0, -38], "codoD": [-95, 0, 0], "brazoI": [0, 0, 38], "codoI": [-95, 0, 0]}}
SALTO = {"nombre": "Salto alto", "cat": "Baile", "id": "salto", "p": [0, 22, 0],
         "r": {"piernaD": [-60, 0, -6], "rodillaD": [100, 0, 0], "piernaI": [-60, 0, 6], "rodillaI": [100, 0, 0],
               "brazoD": [-170, 0, -20], "brazoI": [-170, 0, 20], "cabeza": [-12, 0, 0], "torso": [8, 0, 0]}}
ATERRIZA = {"nombre": "Aterrizaje de superhéroe", "cat": "Baile", "id": "agachado", "p": [0, -7, 0],
            "r": {"piernaD": [-95, 0, -10], "rodillaD": [95, 0, 0], "piernaI": [-20, 0, 12], "rodillaI": [120, 0, 0],
                  "torso": [38, 0, 0], "cabeza": [-38, 0, 0], "brazoD": [-80, 0, -10], "codoD": [-10, 0, 0],
                  "brazoI": [30, 0, 40], "codoI": [-20, 0, 0]}}
VICTORIA = {"nombre": "Victoria can-can", "cat": "Baile", "id": "celebrar", "p": [0, 0, 0],
            "r": {"brazoD": [0, 0, -165], "codoD": [-10, 0, 0], "brazoI": [0, 0, 165], "codoI": [-10, 0, 0], "cabeza": [-15, 0, 0],
                  "piernaD": [-118, 0, 0], "rodillaD": [0, 0, 0], "torso": [-8, 0, 0]}}
FLOTA = {"nombre": "Suspendido en el aire", "cat": "Baile", "id": "volar", "p": [0, 30, 0],
         "r": {"piernaD": [-118, 0, 0], "rodillaD": [0, 0, 0], "piernaI": [20, 0, 0], "rodillaI": [60, 0, 0],
               "brazoD": [-160, 0, -40], "brazoI": [-160, 0, 40], "cabeza": [-20, 0, 0], "torso": [-12, 0, 0]}}


# ── espiral de cada sección (tiempos de la canción)
def golpes_seccion(eventos, a, b):
    gs, ocup = [], set()
    for e in eventos:
        t = e["t"]
        if t < a - 1e-6 or t >= b - 1e-6:
            continue
        u = (t - a) / VUELTA
        vuelta, frac = int(u), u - int(u)
        if e["pista"] == "bajo":                 # anillo del bajo (r 2.5): no se apila entre vueltas
            r, y = 2.5, 0
        else:
            r = 6.5 + 1.2 * vuelta + (0.7 if e["pista"] == "campana" else 0)
            y = min(5, max(0, (e["midi"] - 62) // 4))
        ang = 2 * math.pi * frac + math.pi / 2
        x, z = round(r * math.cos(ang)), round(r * math.sin(ang))
        while e["pista"] != "bajo" and (x, y, z) in ocup:
            y += 1
        ocup.add((x, y, z))
        gs.append([round(t, 4), x, y, z, e["clics"], e["pista"]])
    gs.sort(key=lambda g: g[0])
    return gs


def golpe_mundo(t, pal, previos, sem, cerca=False, humo=True, tierra_sale=True):
    """el impacto dentro del mundo en t (tiempo de la toma): explosión, onda, tierra que salta, bloques que estallan y sacudida"""
    tierra = BLOQ + TIERRA.get(pal, "dirt") + ".png"
    rng = random.Random(sem)
    # cerca de la cámara, la mitad (ronda 2: los pedazos y el humo tapaban a LTezla en las tomas cercanas)
    trozos = sorted([[t, round(math.cos(a) * r), 0, round(math.sin(a) * r), 4 if cerca else 7]
                     for a, r in ((rng.uniform(0, 6.283), rng.uniform(0.8, 3.5)) for _ in range(14))], key=lambda f: f[0])
    ef = [
        # humo de explosión de Minecraft: pocas nubes de pixeles que se abren a ras del suelo (ronda 2: con 90 nubes grandes
        # el humo tapaba la pantalla en las tomas cercanas y en las congeladas)
        # (ronda 5: aun así tapaba a LTezla; ahora sale a ras del piso, rápido hacia los lados, y se apaga antes)
        {"tipo": "particulas", "estilo": "humo", "pos": [0, 0.12, 0], "dir": [0, 1, 0], "abre": 86, "vel": 9, "vida": 0.55,
         "tam": 0.42, "crece": 1.5, "arrastre": 5.0, "g": 0.2, "color": [1, 1, 1], "color2": [0.55, 0.55, 0.58],
         "rafaga": {"t": t, "n": 14 if cerca else 32}, "semilla": sem, **({} if humo else {"alfa": 0})},
        {"tipo": "particulas", "estilo": "chispas", "pos": [0, 0.3, 0], "dir": [0, 1, 0], "abre": 80, "vel": 11, "vida": 0.6,
         "rafaga": {"t": t, "n": 70}, "semilla": sem + 1},
        {"tipo": "destello", "t": t, "pos": [0, 0.6, 0], "tam": 4, "dur": 0.35, "color": [2.6, 2.3, 1.8], "anillo": 13,
         "colorAnillo": [2.6, 2.6, 2.6]},
        *([{"tipo": "fragmentos", "golpes": trozos, "textura": tierra, "vel": 9, "vida": 1.1, "tam": 0.32, "g": -22}] if tierra_sale else []),
        {"tipo": "sacude", "golpes": [[t, 1.0]], "dura": 0.45, "zoom": 0.14, "giro": 5},
    ]
    if previos:
        ef.append({"tipo": "fragmentos", "golpes": sorted([[t, g[1], g[2], g[3], 4 if cerca else 8] for g in previos], key=lambda f: f[0]),
                   "vel": 7, "vida": 1.0, "tam": 0.22})
    return ef


def proyecto():
    ev = json.loads(V.EVENTOS.read_text(encoding="utf-8"))["eventos"]
    base = json.loads((RAIZ / "agente" / "proyectos" / "epico_base.json").read_text(encoding="utf-8"))
    trailer = json.loads((RAIZ / "proyectos" / "trailer-bobicraft-ltezla.json").read_text(encoding="utf-8"))  # sólo lectura
    p = copy.deepcopy(base)
    p["nombre"] = "Can-can en bloques (estilo nuevo)"
    p["escena"] = copy.deepcopy(trailer["escena"])
    p["efectos"] = {"calidad": "cine", "ao": True, "dof": 0, "grano": 0.01, "aberracion": 0, "vineta": 0.15, "saturacion": 1.1,
                    "suavidad": 0, "brillo": 0.45, "contraste": 1.05}
    p["ajustes"] = {**trailer["ajustes"], "formato": "1080x1920"}
    p["personaje"]["capa"] = "skins/capa_mcc15.png"
    p["mundo"] = None
    p["ediciones"] = {}
    k = {"escenas": [], "camara": [], "poses": [], "ojos": [], "matices": [], "textos": [], "audio": []}
    n = 0

    def nid():
        nonlocal n
        n += 1
        return f"cc{n:04d}"

    rng = random.Random(1858)
    impactos, ventanas, prev_az = [], [], 0          # ventanas: tramos sin patadas (saltos, aterrizajes, suspendido)
    resumen = []
    todas = golpes_seccion(ev, 0, 1e9)              # la espiral de toda la canción (para el cierre)
    inicios = []
    total_cambios = 0
    for si, S in enumerate(SECCIONES):
        a_s = tb(S["c"][0])
        b_s = tb(SECCIONES[si + 1]["c"][0]) if si + 1 < len(SECCIONES) else DUR
        if S.get("todo"):
            gs = todas
        else:
            gs = golpes_seccion(ev, a_s, b_s)
        arch = f"estilo_golpes_{si:02d}.json"                # melodía (con haz de luz)
        (AQUI / arch).write_text(json.dumps({"golpes": [g[:5] for g in gs if g[5] != "bajo"]}), encoding="utf-8")
        arch_b = f"estilo_golpes_{si:02d}_bajo.json"         # bajo: sin haz (pasa delante de la cámara en las cercanas)
        (AQUI / arch_b).write_text(json.dumps({"golpes": [g[:5] for g in gs if g[5] == "bajo"]}), encoding="utf-8")
        anillo, rayo, chispas = S["nota"]
        tomas = S["tomas"]
        for ti, Tm in enumerate(tomas):
            a = tb(Tm["c"])
            b = tb(tomas[ti + 1]["c"]) if ti + 1 < len(tomas) else b_s
            tc0 = round(round(a * FPS) / FPS, 4)
            d0 = round(round(b * FPS) / FPS - tc0, 4)
            pal, imp = Tm["pal"], Tm["imp"]
            frente = Tm["cam"] in ("cerca", "ras", "holandes", "vertigo", "empuje", "orbita_lenta")
            for _ in range(20):
                az0 = rng.uniform(-60, 40) if frente else rng.uniform(0, 360)
                if abs(((az0 - prev_az) + 180) % 360 - 180) > 50:
                    break
            prev_az = az0
            fil = Tm["fil"]
            fil = (fil, 1.0, None) if isinstance(fil, str) else (tuple(fil) + (None,))[:3] if fil else None
            # el impact frame va en un plano cercano insertado (2 cuadros; el final, 12) para que la silueta sea grande
            # (ronda 4: en los planos abiertos la silueta era una manchita de 20 px)
            n_imp = (12 if imp == "final" else 2) if imp else 0
            desfase_d = 10000 if S.get("todo") else 0
            col = COLOR_IMP.get(pal, "#ffffff")
            previos = [g for g in gs if g[0] < a - 1e-6][-14:] if imp else []
            cerca_fx = Tm["cam"] in ("cerca", "ras", "holandes", "latigo") or imp in ("congela", "final")
            partes = []
            if n_imp:
                partes.append(("impacto", tc0, round(n_imp / FPS, 4)))
            partes.append(("toma", round(tc0 + n_imp / FPS, 4), round(d0 - n_imp / FPS, 4)))
            for parte, tc, d in partes:
                notas = [{"tipo": "notas", "archivo": f"{V.REL}/{arch}", "construye": True, "tam": 0.6, "pulso": 0.2, "vida": 0.8,
                          "tenue": 0.12, "desfase": tc + desfase_d, "real": True, "anillo": anillo, "rayo": rayo, "chispas": chispas},
                         {"tipo": "notas", "archivo": f"{V.REL}/{arch_b}", "construye": True, "tam": 0.6, "pulso": 0.12, "vida": 0.8,
                          "tenue": 0.08, "desfase": tc + desfase_d, "real": True, "anillo": anillo, "chispas": chispas // 2}]
                ef = list(notas)
                if pal:
                    ef.append({"tipo": "paleta", "cambios": [[0, pal]], "real": True})
                esc_extra = {}
                if parte == "impacto":
                    ef.append({"tipo": "impacto", "golpes": [[0.0, col]], "cuadros": n_imp, "fases": [1, 2], "pixel": 6, "real": True})
                    ef += golpe_mundo(0.0, pal, previos, si * 100 + ti, True, humo=tc0 > 0 and imp != "congela", tierra_sale=tc0 > 0)
                    # (mira a 0.8: LTezla está agachado al aterrizar; con 1.2 la silueta quedaba cortada abajo)
                    mira = 1.25 if tc0 < 0.3 else 0.8
                    ruta = [[0, az0, 10, 4.6, mira, 42, 0], [d, az0 + 1, 10, 4.6, mira, 42, 0]]
                else:
                    if fil:
                        nombre_f, fuerza, hasta = fil
                        # (ronda 5: el filtro entraba 2 cuadros después del corte = un salto de luz extra; ahora en el corte)
                        cam_f = [[0, nombre_f, fuerza]]
                        if hasta:                        # (medido desde el inicio de la frase, no de la toma)
                            cam_f.append([round(hasta - n_imp / FPS, 4), None])
                        ef.append({"tipo": "filtro", "cambios": cam_f, "real": True})
                    ruta = ruta_camara(Tm["cam"], d, az0)
                    if imp:                              # el golpe en el mundo sigue desde el impacto (empezó n_imp cuadros antes)
                        ef += golpe_mundo(round(-n_imp / FPS, 4), pal, previos, si * 100 + ti, cerca_fx, humo=tc0 > 0 and imp != "congela", tierra_sale=tc0 > 0)
                        if imp == "congela":             # bullet time: la explosión queda suspendida 1 s y la cámara gira
                            esc_extra["tiempo"] = [[0, 0], [0.06, 0.06], [1.04, 0.11]]
                            ruta = [[0, az0, 14, 4.8, 1.3, 44, 0], [0.06, az0 + 4, 14, 4.8, 1.3, 44, 0], [1.04, az0 + 120, 20, 5.6, 1.4, 40, 0],
                                    [d, az0 + 140, 18, 5.4, 1.3, 38, 0]]
                        elif imp == "suspendido":        # la nota larga: LTezla flota y todo queda suspendido
                            esc_extra["tiempo"] = [[0, 0], [0.1, 0.1], [d - 0.15, 0.25]]
                            ef.append({"tipo": "particulas", "estilo": "destellos", "pos": [0, 2.5, 0], "dir": [0, 1, 0], "abre": 180, "vel": 6,
                                       "vida": 2.5, "tam": 0.16, "g": -2, "arrastre": 0.8, "color": [1.2, 2.6, 0.4], "color2": [2.6, 2.2, 0.3],
                                       "rafaga": {"t": 0.05, "n": 300}, "real": True})
                    if Tm.get("temblor"):                # la subida: la cámara tiembla en cada negra, cada vez más
                        f0, f1 = Tm["temblor"]
                        nn = int(round(d / NEGRA))
                        ef.append({"tipo": "sacude", "golpes": [[round(j * NEGRA, 3), round(f0 + (f1 - f0) * j / max(1, nn - 1), 2)] for j in range(nn)],
                                   "dura": 0.3, "zoom": 0.06, "giro": 2.5, "real": True})
                    if S.get("todo"):                    # la recompensa: destellos que suben sobre la espiral
                        ef.append({"tipo": "particulas", "estilo": "destellos", "pos": [0, 1.5, 0], "area": [60, 2, 60], "dir": [0, 1, 0],
                                   "abre": 20, "vel": 1.5, "vida": 2.0, "tam": 0.35, "tasa": 220, "color": [2.6, 2.2, 0.8], "real": True})
                if True:                              # (la recompensa también: la cámara atravesaba un bloque en 117.6 s)
                    ruta, cambios = resolver_ruta(ruta, d, gs, tc + desfase_d)
                    total_cambios += cambios
                # (ronda 6: con 1.2 el bloom quemaba la cara y las manos de LTezla en 28-30 s)
                brillo = 0.6 if Tm["amb"] in ("rosa", "atardecer") else 0.8
                esc = {"id": nid(), "dur": d, "nombre": f"{S['nombre']} · {'impacto' if parte == 'impacto' else Tm['cam']}", "mobs": [],
                       "set": "llano", "ambiente": Tm["amb"], "ancla": {"x": 0, "y": 0, "z": 0, "rot": 0},
                       "actor": {"x": 0, "y": 0, "z": 0, "rot": 0}, "ocultar": False, "brillo": brillo, "sueloInfinito": True,
                       "efectos": ef, **esc_extra}
                cm = lambda r: {"az": r[1], "el": r[2], "dist": r[3], "ty": r[4], "fov": r[5], "pan": 0, "tilt": 0, "roll": r[6]}
                clip = {"id": nid(), "tipo": "libre", "dur": d, "curva": "lineal", "desde": cm(ruta[0]), "hasta": cm(ruta[-1]), "ruta": ruta}
                k["escenas"].append(esc)
                k["camara"].append(clip)
                inicios.append(tc)
            if imp:
                impactos.append(round(tc0, 3))
                if imp == "congela":
                    ventanas.append((tc0 - 0.45, tc0 + 1.25, "congela"))
                elif imp == "suspendido":
                    ventanas.append((tc0 - 0.45, tc0 + d0, "suspendido"))
                else:
                    ventanas.append((tc0 - 0.45, tc0 + 0.4, "salto"))
            if S.get("todo"):
                ventanas.append((tc0 - 0.45, DUR, "victoria"))
            resumen.append((tc0, d0, S["nombre"], Tm["cam"], pal, fil[0] if fil else None, imp))
    print(f"cámara corregida en {total_cambios} muestras (bloques delante o cámara dentro de un bloque)")
    # cortes 2 ms ANTES de su cuadro (ronda 6: con duraciones redondeadas a 4 decimales, 2/30 = 0.0667 > 0.06667 y el
    # cuadro siguiente al impact frame caía todavía en el plano insertado: un cuadro intruso en 48 de 49 impactos)
    bordes = [0.0] + [round(t - 0.002, 6) for t in inicios[1:]] + [DUR]
    for esc, clip, a_, b_ in zip(k["escenas"], k["camara"], bordes, bordes[1:]):
        dd = round(b_ - a_, 6)
        esc["dur"] = clip["dur"] = dd
        for e in esc["efectos"]:
            if e["tipo"] == "notas":
                e["desfase"] = round(a_ + (e["desfase"] - round(e["desfase"], 1) if e["desfase"] >= 10000 else 0) + (10000 if e["desfase"] >= 10000 else 0), 6)
    k["poses"] = poses(ventanas, nid)
    k["ojos"].append({"id": nid(), "cara": "muy_feliz", "dur": DUR, "mx": 0, "my": 0})
    k["audio"].append({"id": nid(), "tipo": "musica", "texto": f"{V.C['cancion']} en bloques musicales (partitura.py)",
                       "archivo": f"{V.REL}/{V.ESCUCHAR.name}", "inicio": 0, "desde": 0, "dur": DUR, "vol": 1.0})
    p["pistas"] = k
    return p, impactos, resumen


def poses(ventanas, nid):
    """patadas en cada negra (alternadas, llegan arriba en la negra); en cada impacto: salto antes y aterrizaje en el golpe"""
    claves = []                                   # (t, pose, trans)
    libre = lambda t: not any(a <= t <= b for a, b, _ in ventanas)
    lado = "D"
    for j in range(int(DUR / NEGRA) + 1):
        q = j * NEGRA
        if libre(q - 0.12) and libre(q + 0.12):
            claves.append((max(0, q - 0.12), patada(lado), 0.12))
            claves.append((q + 0.12, PARADO, 0.12))
            lado = "I" if lado == "D" else "D"
    for a, b, tipo in ventanas:
        tI = a + 0.45
        if tI < 0.3:                              # el impacto del cuadro 0: sin salto ni aterrizaje (silueta legible)
            continue
        if tipo == "victoria":                    # el cierre: patada final con los brazos arriba hasta el último cuadro
            claves.append((tI, VICTORIA, 0.25))
            continue
        if tI > 0.3:
            claves.append((tI - 0.38, SALTO, 0.2))
        if tipo == "suspendido":
            claves.append((tI - 0.05, FLOTA, 0.3))
            claves.append((b - 0.05, ATERRIZA, 0.05))
        else:
            claves.append((max(0, tI - 0.05), ATERRIZA, 0.05))
            claves.append((b - 0.05 if tipo == "congela" else tI + 0.3, PARADO, 0.2))
    claves = sorted((c for c in claves if c[0] < DUR - 0.02), key=lambda c: c[0])
    claves[0] = (0.0, claves[0][1], 0)
    clips = []
    for i, (t, pose, tr) in enumerate(claves):
        fin = claves[i + 1][0] if i + 1 < len(claves) else DUR
        if fin - t < 0.02:
            continue
        clips.append({"id": nid(), "pose": pose, "dur": round(fin - t, 4), "trans": 0 if not clips else tr, "curva": "natural",
                      **({"corte": True} if not clips else {})})
    clips[-1]["dur"] = round(clips[-1]["dur"] + DUR - sum(c["dur"] for c in clips), 4)
    return clips


def main():
    p, impactos, resumen = proyecto()
    destino = RAIZ / "agente" / "proyectos" / f"{V.PROYECTO}.json"
    destino.write_text(json.dumps(p, ensure_ascii=False), encoding="utf-8")
    k = p["pistas"]
    sep = [b - a for a, b in zip(impactos, impactos[1:])]
    print(f"{destino.relative_to(RAIZ)}: {len(k['escenas'])} tomas · {sum(e['dur'] for e in k['escenas']):.2f} s · "
          f"poses {sum(c['dur'] for c in k['poses']):.2f} s · {len(impactos)} impactos (mín. {min(sep):.2f} s entre dos = "
          f"{2 / min(sep):.1f} destellos/s)")
    (AQUI / "critica").mkdir(exist_ok=True)
    (AQUI / "critica" / "tomas_estilo.json").write_text(json.dumps(
        [dict(t=t, dur=d, seccion=s, camara=c, paleta=pa, filtro=f, impacto=i) for t, d, s, c, pa, f, i in resumen],
        ensure_ascii=False, indent=1), encoding="utf-8")


def agente(*args, timeout=900):
    try:
        r = subprocess.run([sys.executable, str(RAIZ / "herramientas" / "agente.py"), *args], capture_output=True, text=True,
                           encoding="utf-8", timeout=timeout, cwd=RAIZ)
        return r.stdout
    except subprocess.TimeoutExpired:                  # la página se colgó: se reinicia y se reintenta
        return '"error": "tiempo agotado"'


def render(v):
    """borrador en calidad baja (540×960) por tramos de 20 s, con el audio exacto y −14 LUFS"""
    sal = AQUI / "salida"; trab = sal / "trabajo"; trab.mkdir(parents=True, exist_ok=True)
    cuadros = round(DUR * FPS)
    cortes = list(range(0, cuadros, 600)) + [cuadros]
    partes = []
    for a, b in zip(cortes, cortes[1:]):
        nombre = f"_cancan_{v}_{a:05d}"
        dest = trab / f"{nombre}.mp4"
        if not dest.exists():
            for intento in range(3):
                t0 = time.time()
                out = agente("exportar", json.dumps({"nombre": nombre, "desde": a / FPS, "hasta": b / FPS, "fps": FPS, "calidad": "normal", "escala": 0.5}))
                vid = RAIZ / "Videos" / f"{nombre}.mp4"
                if vid.exists() and '"ok": true' in out:
                    vid.replace(dest); print(f"tramo {a / FPS:6.1f}–{b / FPS:6.1f} s: {time.time() - t0:.0f} s", flush=True); break
                print(f"tramo {a}: falló ({out[-200:]!r}); reinicio la página", flush=True)
                agente("--reiniciar", timeout=300)
                agente("abrir", json.dumps({"nombre": V.PROYECTO}), timeout=600)
            else:
                raise SystemExit(f"el tramo {a} no salió")
        partes.append((dest, b - a))
    entradas, filtros = [], []
    for i, (pth, nc) in enumerate(partes):
        entradas += ["-i", str(pth)]
        filtros.append(f"[{i}:v]scale=540:960:flags=bicubic,fps={FPS},trim=end_frame={nc},setpts=PTS-STARTPTS[v{i}]")
    kk = len(partes)
    filtros.append("".join(f"[v{i}]" for i in range(kk)) + f"concat=n={kk}:v=1:a=0,setpts=N/{FPS}/TB[out]")
    entradas += ["-i", str(V.WAV)]
    final = sal / f"borrador_{v}.mp4"
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *entradas, "-filter_complex", ";".join(filtros),
                    "-map", "[out]", "-map", f"{kk}:a", "-frames:v", str(cuadros), "-c:v", "libx264", "-crf", "24", "-preset", "veryfast",
                    "-c:a", "aac", "-b:a", "160k", "-ar", "48000",
                    "-af", f"atrim=0:{DUR},afade=t=out:st={DUR - 0.35}:d=0.35,loudnorm=I=-14:TP=-1.5", "-shortest", str(final)], check=True)
    print("listo:", final)


def final(v):
    """render FINAL: 1080×1920 en calidad alta (supermuestreo 1.5×) por tramos de 10 s, con la página reiniciada antes de
    cada tramo (como orquesta/final.py), loudnorm de dos pasadas (−14 LUFS, TP −1.5: el AAC sube ~0.3 dB los picos),
    48 kHz. Salen el `destino` de video.json, la versión "solo musica" (el audio ya es sólo música: misma mezcla) y
    portada.jpg (el cuadro 0 es una silueta: la portada es LTezla pateando a los 3.6 s)."""
    trab = AQUI / "salida" / "final"; trab.mkdir(parents=True, exist_ok=True)
    cuadros = round(DUR * FPS)
    cortes = list(range(0, cuadros, 300)) + [cuadros]
    partes = []
    for a, b in zip(cortes, cortes[1:]):
        nombre = f"_final_{v}_{a:05d}"
        dest = trab / f"{nombre}.mp4"
        if not dest.exists():
            for intento in range(3):
                agente("--reiniciar", timeout=300)
                agente("abrir", json.dumps({"nombre": V.PROYECTO}), timeout=900)
                t0 = time.time()
                out = agente("exportar", json.dumps({"nombre": nombre, "desde": a / FPS, "hasta": b / FPS, "fps": FPS, "calidad": "alta"}), timeout=1800)
                vid = RAIZ / "Videos" / f"{nombre}.mp4"
                if vid.exists() and '"ok": true' in out:
                    vid.replace(dest); print(f"tramo {a / FPS:6.1f}–{b / FPS:6.1f} s: {time.time() - t0:.0f} s", flush=True); break
                print(f"tramo {a}: falló ({out[-160:]!r}); reintento", flush=True)
            else:
                raise SystemExit(f"el tramo {a} no salió")
        partes.append((dest, b - a))
    wav = V.WAV
    m = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(wav), "-af", f"atrim=0:{DUR},loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"],
                       capture_output=True, text=True).stderr
    j = json.loads(m[m.rindex("{"):m.rindex("}") + 1])
    norm = (f"loudnorm=I=-14:TP=-1.5:LRA=11:measured_I={j['input_i']}:measured_TP={j['input_tp']}:measured_LRA={j['input_lra']}:"
            f"measured_thresh={j['input_thresh']}:offset={j['target_offset']}:linear=true")
    mezcla = trab / "mezcla.wav"
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(wav), "-af",
                    f"atrim=0:{DUR},afade=t=out:st={DUR - 0.35}:d=0.35,{norm},aresample=48000,apad", "-t", f"{DUR:.4f}", str(mezcla)], check=True)
    filtros, entradas = [], []
    for i, (pth, n) in enumerate(partes):
        entradas += ["-i", str(pth)]
        filtros.append(f"[{i}:v]scale=1080:1920:flags=lanczos,fps={FPS},trim=end_frame={n},setpts=PTS-STARTPTS[v{i}]")
    k = len(partes)
    filtros.append("".join(f"[v{i}]" for i in range(k)) + f"concat=n={k}:v=1:a=0,setpts=N/{FPS}/TB,format=yuv420p[out]")
    entradas += ["-i", str(mezcla)]
    destino = V.DESTINO
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *entradas, "-filter_complex", ";".join(filtros),
                    "-map", "[out]", "-map", f"{k}:a", "-frames:v", str(cuadros), "-c:v", "libx264", "-crf", "16", "-preset", "slow",
                    "-profile:v", "high", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-c:a", "aac", "-b:a", "320k", "-ar", "48000",
                    "-t", f"{DUR:.4f}", str(destino)], check=True)
    solo = destino.with_name(destino.stem + " - solo musica.mp4")
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(destino), "-c", "copy", str(solo)], check=True)
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-ss", "3.6", "-i", str(destino), "-frames:v", "1", "-q:v", "2",
                    str(AQUI / "salida" / "portada.jpg")], check=True)
    print("listo:", destino, "·", solo.name, "· portada.jpg")


if __name__ == "__main__":
    if sys.argv[1:2] == ["final"]:
        final(sys.argv[2] if len(sys.argv) > 2 else "v1")
    elif sys.argv[1:2] == ["render"]:
        render(sys.argv[2] if len(sys.argv) > 2 else "v2")
    else:
        main()
