"""Explainer "El creeper era un cerdo" (Minecraft Animator): el cerdo que Notch programó con el alto y el ancho cambiados se
pone de pie, te sigue con la mirada, se vuelve verde, se esconde entre hojas y explota. Datos: agente/creeper/facts.json.

  python agente/creeper/creeper.py            → agente/proyectos/creeper.json + agente/creeper/timing.json
  python agente/creeper/creeper.py aplicar    → además lo abre en el animador y pone poses y ojos de LTezla

Todos los tiempos salen de timing.json (beats de la música y palabras clave de las voces). Escenario `pradera` (plano en
r < 14). El cerdo protagonista (mob `cerdo_error`, js/mobs.js) está en C mirando a −z; LTezla en L mirándolo; detrás del
cerdo, un arbusto en forma de nicho (bloques en `ediciones`) donde se esconde al volverse verde.
"""
import copy
import json
import math
import os
import subprocess
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(os.path.dirname(AQUI))
sys.path.insert(0, AQUI)
import guion  # noqa: E402

_n = 0


def nid():
    global _n
    _n += 1
    return f"cr{_n:04d}"


def V(az, el, dist, ty, **k):
    return {"az": round(az, 2), "el": round(el, 2), "dist": round(dist, 3), "ty": ty, "fov": k.pop("fov", 36), **k}


def A(x, y, z, rot=0):
    return {"x": x, "y": y, "z": z, "rot": rot}


def VW(cam, actor, ty, **k):
    """cámara en el mundo: posición `cam` [x, y, z] mirando al actor (a `ty` sobre sus pies)"""
    dx, dy, dz = cam[0] - actor["x"], cam[1] - (actor["y"] + ty), cam[2] - actor["z"]
    d = math.sqrt(dx * dx + dy * dy + dz * dz)
    return V(math.degrees(math.atan2(dx, dz)) - actor.get("rot", 0), math.degrees(math.asin(dy / d)), d, ty, **k)


def VWT(cam, actor, ty, mira, **k):
    """cámara en `cam` con el actor como referencia (la escena siempre mira al actor) pero apuntando a `mira` [x, y, z]
    con pan/tilt: la cámara hace lookAt al actor y luego gira (escena.js: rotateY(pan), rotateX(tilt))"""
    v = VW(cam, actor, ty, **k)
    def ang(px, py, pz):
        dx, dy, dz = px - cam[0], py - cam[1], pz - cam[2]
        return math.degrees(math.atan2(dx, dz)), math.degrees(math.atan2(dy, math.hypot(dx, dz)))
    ha, pa = ang(actor["x"], actor["y"] + ty, actor["z"])
    hm, pm = ang(*mira)
    v["pan"] = round(((hm - ha + 180) % 360) - 180, 2)
    v["tilt"] = round(pm - pa, 2)
    return v


BLANCO = dict(color="#f2f0ee", color2="#ffffff", sombra="#2a2626", sombra2="#4a4444")
ROSA = dict(color="#f0a5a2", color2="#ffc4c0", sombra="#5a1e22", sombra2="#8a3a3e")
VERDE = dict(color="#0da70b", color2="#3fd23a", sombra="#063a0b", sombra2="#0a5a12")
CREMA = dict(color="#fff3c4", color2="#ffffff", sombra="#3a2a10", sombra2="#6a5020")
CIAN = [0.35, 2.2, 3.4]
ROSA_F = [3.2, 1.2, 1.15]


def T(texto, x, y, tam, estilo, dur, inicio=0.0, **k):
    return {"texto": texto, "x": x, "y": y, "tam": tam, "prof": 0.35, "relieve": 0.06, "espaciado": -0.04, "interlinea": 1.05,
            "dur": dur, "inicio": inicio, "anim": "golpe", **estilo, **k}


# ═══════════ tiempos (audio primero) ═══════════
AN = json.load(open(os.path.join(AQUI, "audio_analisis.json"), encoding="utf-8"))
AUD = json.load(open(os.path.join(AQUI, "audio.json"), encoding="utf-8"))
BEATS = AN["musica"]["beats"]
PARA_MUSICA = 27.283                 # la música se corta en este beat (silencio + siseo)
EXPLOTA = 30.60                      # explosión; la música vuelve desde PARA_MUSICA
OFS_FINAL = EXPLOTA - PARA_MUSICA    # desfase de la música después de la explosión
FIN = 40.5


def b(t):
    """beat más cercano de la película (antes del corte usa la música tal cual; después, desplazada)"""
    lista = [x for x in BEATS if x <= PARA_MUSICA + 0.01] + [x + OFS_FINAL for x in BEATS if x >= PARA_MUSICA - 0.01]
    return min(lista, key=lambda x: abs(x - t))


NOMBRES = ["gancho", "pradera", "notch", "alto_ancho", "te_mira", "creepy", "miedo", "verde", "idea", "sale", "mecha", "boom", "aturdido",
           "nacio", "titulo", "remate"]
TC = {"gancho": 0, "pradera": b(2.62), "notch": b(4.78), "alto_ancho": b(6.71), "te_mira": b(12.91), "creepy": b(16.35), "miedo": b(18.48),
      "verde": b(19.78), "idea": b(23.94), "sale": PARA_MUSICA, "mecha": EXPLOTA - 1.5, "boom": EXPLOTA, "aturdido": EXPLOTA + 0.9,
      "nacio": b(33.16), "titulo": b(36.59), "remate": b(38.52)}
CORTES = [TC[n] for n in NOMBRES] + [FIN]
TOMA_VOZ = {"L1": "L1B", "L2": "L2C", "L3": "L3A", "L4": "L4A", "L5": "L5A", "L6": "L6E", "L7": "L7D", "L8": "L8A"}


def palabra(clave, w):
    a = json.load(open(os.path.join(RAIZ, AUD[clave][:-4] + ".json"), encoding="utf-8"))
    s = "".join(a["characters"])
    return a["character_start_times_seconds"][s.find(w)]


GIRO = b(10.12)                       # ALTO y ANCHO se cruzan (en "¡con el ancho!")
PARA = b(11.63)                       # el cuerpo se levanta 1.5 s después del cruce, con anticipación (misma toma)
VOCES = {"L1": 0.30, "L2": 2.80, "L3": round(GIRO - palabra("L3A", "ancho"), 3), "L4": round(PARA - 0.14, 3),
         "L5": 13.55, "L6": 21.0, "L7": round(PARA_MUSICA + 0.69 - palabra("L7D", "EXPLOTA"), 3), "L8": round(b(33.16) + 0.05, 3)}
T_CREEPY = VOCES["L5"] + palabra("L5A", "creepy")
MECHA = (EXPLOTA - 1.5, EXPLOTA)      # 1.5 s de mecha, como en el juego (F8)
OINK = round(TC["remate"] + 0.95, 3)

SFX_T = [("glitch", 0.0, 0.35), ("glitch", b(0.7), 0.4), ("glitch", b(1.97), 0.35), ("oink", TC["pradera"] - 0.05, 1.0), ("whoosh", TC["alto_ancho"] - 0.25, 0.95),
         ("pop", round(GIRO + 0.33, 3), 2.5), ("levanta", PARA - 0.12, 0.3), ("pixeles", TC["verde"] + 0.1, 0.35),
         ("hojas", TC["verde"] + 2.2, 3.2), ("idea", round(VOCES["L7"] + 0.1, 3), 0.45), ("siseo", MECHA[0], 0.8), ("explosion", EXPLOTA, 1.7),
         ("mareo", TC["aturdido"] + 0.45, 1.0), ("whoosh", TC["nacio"] - 0.25, 0.35), ("pop", TC["titulo"], 1.0), ("oink", OINK, 1.3)]

# ═══════════ mundo ═══════════
C = A(0, 0, 3.0)                      # el cerdo protagonista (mira a −z)
L = A(-1.7, 0, 1.3, 45)               # LTezla, mirándolo
LA, LB = A(-1.9, 0, 1.0, 90), A(1.9, 0, 1.0, 90)          # LTezla cruza delante del cerdo
L2 = A(1.9, 0, 1.0, -43)              # LTezla del otro lado, mirando al cerdo
ORIGEN = A(0, 0, 0)
BASE = dict(set="pradera", ambiente="dia", sat=1.1, calidez=3, nubes=True, ancla=ORIGEN)
ATARDECER = dict(BASE, ambiente="atardecer", calidez=6)
# arbusto de hojas de azalea con forma de nicho detrás del cerdo (fondo, lados y techo), donde se esconde al volverse verde
H = A(-2.0, 0, 8.35)                  # dentro del arbusto (a un lado del cerdo: los primeros planos ya no tienen la pared detrás)
HOJA = lambda x, y, z: "hojas" if (x * 7 + y * 3 + z * 5) % 3 == 0 else "hojas_azalea"      # dos verdes: se lee como arbusto
_celdas = ([(x, y, 9) for x in range(-4, 0) for y in range(0, 4)] + [(x, y, 8) for x in (-4, -1) for y in range(0, 4)] +
           [(x, 3, 8) for x in (-3, -2)] + [(x, y, 7) for x in (-4, -1) for y in range(0, 2)] + [(x, 4, 9) for x in (-3, -2)] +
           [(-5, y, 8) for y in range(0, 3)] + [(0, y, 9) for y in range(0, 2)] + [(x, 0, 7) for x in (-3, -2)])
C2 = A(-2.0, 0, 6.6)                  # al volverse verde está delante del arbusto
LIMPIO = [[x, y, z, "aire"] for x in range(-7, 4) for y in range(0, 5) for z in range(3, 12)
          if math.hypot(x + 0.5, z + 0.5) >= 4.9]                # sin arbustos sueltos de la pradera alrededor del escondite
NICHO = LIMPIO + ([[x, y, z, HOJA(x, y, z)] for x, y, z in _celdas] +
         [[x, 0, z, "aire"] for x in range(-2, 4) for z in range(-6, -1)] + [[x, 0, z, "aire"] for x in range(-2, 3) for z in range(1, 6)])          # sin pasto alto delante del cerdo del remate


def cerdo(**k):
    return {"tipo": "cerdo_error", "n": 1, "x": C["x"], "z": C["z"], "dir": 180, "modo": "quieto", "fijo": True, "calmo": True, "semilla": 11, "foco": True, **k}


EXTRAS = [{"tipo": "cerdo", "n": 1, "x": 3.6, "z": 5.6, "dir": 120, "modo": "quieto", "fijo": True, "semilla": 3, "accion": {"tipo": "pastar", "en": 0.4, "dur": 9, "cada": 3}},
          {"tipo": "cerdo", "n": 1, "x": 3.3, "z": 1.6, "dir": 250, "modo": "caminar", "vel": 0.35, "fijo": True, "semilla": 5}]


def ang_cabeza(desde, hacia, cuerpo=180):
    """grados que gira la cabeza (relativos al cuerpo) para mirar de `desde` a `hacia`"""
    a = math.degrees(math.atan2(hacia["x"] - desde["x"], hacia["z"] - desde["z"]))
    return round(((a - cuerpo + 180) % 360) - 180, 1)


def suave(u):
    return 0.0 if u <= 0 else 1.0 if u >= 1 else u * u * (3 - 2 * u)


TOMAS = []


def toma(nombre_toma, titulo, escena, cams, poses=None, ojos=None, textos=(), matices=()):
    dur = D(nombre_toma)
    TOMAS.append(dict(dur=dur, nombre=titulo, escena=escena, cams=cams, poses=poses or [["reposo", dur]],
                      ojos=ojos or [["neutral", dur]], textos=list(textos), matices=list(matices)))


def D(n):
    i = NOMBRES.index(n)
    return round(CORTES[i + 1] - CORTES[i], 3)


def rel(n, t):
    return round(t - TC[n], 3)


ERG = [[0, 1.0]]                       # cuerpo de pie
TINTA = "#151515"                      # etiquetas oscuras: contraste alto sobre pasto, cuadrícula y cerdo

# 1 · gancho: la cara del creeper… parpadea a cerdo desde el cuadro 0
t1, t2 = rel("gancho", b(0.7)), rel("gancho", b(1.97))
toma("gancho", "Gancho: este cerdo", dict(BASE, actor=C, ocultar=True, dof=0.9, brillo=1.1,
     mobs=[cerdo(error=ERG, verde=[[0, 0.55], [0.1, 1], [t1 - 0.02, 1], [t1 + 0.32, 0], [t2 - 0.01, 0], [t2 + 0.03, 0.85], [t2 + 0.13, 0.85], [t2 + 0.2, 0]],
                 cabezaYaw=[[0, 6], [1.2, -3], [2.4, 2]])]),
     [dict(desde=VW([0.18, 1.72, 1.55], C, 1.65, fov=30), hasta=VW([0.14, 1.72, 1.8], C, 1.65, fov=30), curva="suave", temblor=0.04)])

# 2 · mundo conocido: LTezla presenta a su cerdo (sin saludo)
LC = A(-1.7, 0, 1.3, 200)
toma("pradera", "La pradera", dict(BASE, actor=LC, dof=0.35, mobs=[cerdo(cabezaYaw=[[0, 0], [1.0, ang_cabeza(C, L)]]), *EXTRAS]),
     [dict(desde=V(0, 6, 3.9, 1.0, pan=-12), hasta=V(4, 6, 3.5, 1.0, pan=-12), curva="suave", temblor=0.05)],
     poses=[["senalar", 0.9], ["presentar", round(D("pradera") - 0.9, 3), {"trans": 0.3}]], ojos=[["feliz", 0.9, 0.8, 0], ["feliz", round(D("pradera") - 0.9, 3), 0, 0, {"aCamara": True}]],
     matices=[["hablar", 0.1, 1.9, 0.6], ["balancear", 0.0, D("pradera"), 0.5]])
toma("notch", "Notch quiso un cerdo", dict(BASE, actor=L, dof=0.45, mobs=[cerdo(cabezaYaw=[[0, ang_cabeza(C, L)]]), *EXTRAS]),
     [dict(desde=VWT([1.3, 1.45, 4.3], L, 1.0, [-0.8, 0.95, 2.2]), hasta=VWT([1.05, 1.4, 3.85], L, 1.0, [-0.8, 0.95, 2.2]), curva="lineal", temblor=0.05)],
     poses=[["senalar", D("notch")]], ojos=[["emocionado", 1.0, 0.6, 0], ["feliz", round(D("notch") - 1.0, 3), 0, 0, {"aCamara": True}]], matices=[["hablar", 0.0, 1.9, 0.6], ["asentir", 0.4, 1.2, 0.6]])

# 3 · la causa y firma 1: ALTO y ANCHO se cruzan como manecillas… y el cuerpo se para sobre "parado" (misma toma)
g, pp = rel("alto_ancho", GIRO), rel("alto_ancho", PARA)
c1 = rel("alto_ancho", b(8.2))
ESQ = [0.75, 0.04, 4.25]               # esquina detrás del cerdo, a ras del piso
toma("alto_ancho", "Alto y ancho", dict(BASE, actor=C, ocultar=True, dof=0.12, brillo=1.25,
     mobs=[cerdo(error=[[0, 0], [pp - 0.3, 0], [pp - 0.13, -0.07], [pp - 0.05, 0.05], [pp + 0.2, 1.14], [pp + 0.38, 0.92], [pp + 0.56, 1.04], [pp + 0.76, 1.0]],
                 cabezaYaw=[[0, 25], [1.2, -15], [2.3, 20], [g, -25], [pp + 0.3, 0], [pp + 0.5, 0]])],
     efectos=[{"tipo": "rejilla", "pos": [0, 0.03, 3.0], "tam": [5, 5], "paso": 0.5, "plano": "xz", "color": CIAN, "grosor": 0.025, "desde": 0.15, "entra": 0.6},
              {"tipo": "flecha", "pos": ESQ, "dir": [[g - 0.02, [0, 1, 0]], [g + 0.33, [0, 0, 1]]], "largo": 0.95, "color": ROSA_F, "grosor": 0.09, "desde": round(c1 + 0.05, 3), "crece": 0.35, "encima": True,
               "texto": "ALTO", "tamTexto": 0.3, "colorTexto": TINTA, "sombraTexto": "#f4f4f4", "ofsTexto": [0, 0.36, 0]},
              {"tipo": "flecha", "pos": ESQ, "dir": [[g - 0.02, [0, 0, -1]], [g + 0.33, [0, 1, 0]]], "largo": 1.3, "color": CIAN, "grosor": 0.09, "desde": round(c1 + 0.35, 3), "crece": 0.35, "encima": True,
               },
              {"tipo": "texto", "texto": "ANCHO", "pos": [0.75, 1.42, 2.75], "tam": 0.3, "color": TINTA, "sombra": "#f4f4f4", "encima": True, "desde": round(c1 + 0.45, 3), "hasta": round(g + 0.1, 3), "anim": "golpe"},
              {"tipo": "texto", "texto": "ANCHO", "pos": [0.75, 1.25, 5.15], "tam": 0.3, "color": TINTA, "sombra": "#f4f4f4", "encima": True, "desde": round(g + 0.3, 3), "anim": "golpe"},
              {"tipo": "particulas", "estilo": "polvo", "pos": [0, 0.05, 3.0], "area": [1.2, 0, 1.2], "rafaga": {"t": pp + 0.18, "n": 22}, "vel": 1.5, "abre": 75, "vida": 0.5, "tam": 0.18, "color": [0.75, 0.68, 0.5]}]),
     [dict(dur=c1, desde=VW([3.9, 3.6, 0.2], C, 0.55), hasta=VW([2.6, 2.7, 1.5], C, 0.6), curva="lineal", temblor=0.06),
      dict(dur=round(D("alto_ancho") - c1, 3), desde=VWT([5.6, 1.75, 4.5], C, 1.0, [0.5, 1.15, 4.05]), hasta=VWT([4.7, 1.55, 3.6], C, 1.0, [0.5, 1.2, 4.05]), curva="lineal", temblor=0.06)])

# 4 · "te seguía con la mirada": LTezla cruza por delante y la cabeza lo sigue a golpes (cámara que lo acompaña)
dm = D("te_mira")
posL = lambda t: A(LA["x"] + (LB["x"] - LA["x"]) * min(1.0, t / dm), 0, LA["z"])
snaps = [[0, ang_cabeza(C, posL(0))]]
for ts in (0.55, 1.45, 2.35):
    snaps += [[ts, snaps[-1][1]], [ts + 0.13, ang_cabeza(C, posL(ts + 0.5))]]
snaps.append([dm, snaps[-1][1]])
toma("te_mira", "Te sigue con la mirada", dict(BASE, actor=LA, actorHasta=LB, dof=0.25,
     mobs=[cerdo(error=ERG, cabezaYaw=snaps), *EXTRAS[:1]]),
     [dict(desde=V(68, 38, 4.7, 1.6, pan=-4, tilt=10), hasta=V(68, 38, 4.7, 1.6, pan=-4, tilt=10), curva="lineal", temblor=0.04)],
     poses=[["paso", dm]], ojos=[["sospecha", 1.2, -0.6, 0], ["sospecha", 1.0, 0.7, 0], ["asustado", round(dm - 2.2, 3), -0.7, 0]], matices=[["caminar", 0.0, dm, 1]])
cr = rel("creepy", T_CREEPY - 0.08)
toma("creepy", "Súper creepy", dict(BASE, actor=C, ocultar=True, dof=0.5,
     mobs=[cerdo(error=ERG, cabezaYaw=[[0, 38], [cr, 38], [cr + 0.15, -3], [cr + 0.32, 1], [D("creepy"), 0]]), *EXTRAS[:1]]),
     [dict(desde=VW([0.3, 1.75, 1.15], C, 1.62, fov=30), hasta=VW([0.0, 1.7, 1.75], C, 1.62, fov=30), curva="lineal", temblor=0.05)])
toma("miedo", "Le da miedo", dict(BASE, actor=L2, dof=0.5,
     mobs=[cerdo(error=ERG, cabezaYaw=[[0, ang_cabeza(C, L2)]]), *EXTRAS[:1]]),
     [dict(desde=V(-10, 4, 2.2, 1.4), hasta=V(-8, 4, 2.4, 1.4), curva="suave", temblor=0.08)],
     poses=[["sorpresa", D("miedo")]], ojos=[["sorprendido", 0.4, -0.8, 0], ["sorprendido", 0.4, 0.8, 0], ["asustado", round(D("miedo") - 0.8, 3), 0, 0.2]],
     matices=[["temblar", 0.1, D("miedo") - 0.1, 0.5], ["caminar_atras", 0.3, D("miedo") - 0.3, 0.6]])

# 5 · firma 2: los pixeles se vuelven verdes y se esconde entre las hojas
dv = D("verde")
toma("verde", "Se vuelve verde", dict(BASE, actor=C, ocultar=True, dof=0.08,
     mobs=[cerdo(x=C2["x"], z=C2["z"], error=ERG, verde=[[0.15, 0], [1.9, 1]], cabezaYaw=[[0, 4], [1.5, -3], [2.6, 0]], modo="caminar", ruta=[[H["x"], H["z"]]], arranque=1.9, vel=0.9, rumbo=[[0, 180]])]),
     [dict(dur=2.0, desde=VWT([-1.3, 1.5, 3.7], C, 1.2, [-2.0, 1.2, 6.6], fov=34), hasta=VWT([-1.7, 1.5, 4.3], C, 1.2, [-2.0, 1.2, 6.6], fov=34), curva="lineal", temblor=0.05),
      dict(dur=round(dv - 2.0, 3), desde=VWT([-1.7, 1.5, 4.3], C, 1.2, [-2.0, 1.2, 6.6], fov=34), hasta=VWT([-1.95, 1.55, 3.3], C, 1.2, [H["x"], 1.45, H["z"] - 0.4], fov=34), curva="suave", temblor=0.03)])

# 6 · la idea del amigo
di = D("idea")
toma("idea", "La idea", dict(BASE, actor=L2, dof=0.6, mobs=[cerdo(x=H["x"], z=H["z"], error=ERG, verde=1)]),
     [dict(desde=V(-25, 2, 2.4, 1.5), hasta=V(-21, 2, 2.1, 1.5), curva="suave", temblor=0.04)],
     poses=[["pensar", 1.0], ["senalar_arriba", round(di - 1.0, 3), {"trans": 0.2}]], ojos=[["pensativo", 1.0, -0.4, 0.4], ["picaro", round(di - 1.0, 3), 0, 0, {"aCamara": True}]],
     matices=[["hablar", 0.8, di - 0.8, 0.6]])

# 7 · sale del arbusto (silencio) y la mecha: se infla, parpadea (≤ 3 veces/s) y revienta en blanco dentro de su toma
toma("sale", "Sale del arbusto", dict(BASE, actor=C, ocultar=True, dof=0.3,
     mobs=[cerdo(x=H["x"], z=H["z"], error=ERG, verde=1, modo="caminar", ruta=[[-1.5, 6.1]], arranque=0.55, vel=1.2, cabezaYaw=[[0, 0], [1.2, 0], [1.6, -8]])]),
     [dict(desde=VWT([-1.75, 1.45, 4.3], C, 1.3, [-2.0, 1.45, 8.1], fov=34), hasta=VWT([-1.6, 1.35, 3.7], C, 1.3, [-1.5, 1.3, 6.4], fov=34), curva="lineal", temblor=0.05)])
toma("mecha", "La mecha", dict(BASE, actor=C, ocultar=True, dof=0.4, brillo=1.25,
     mobs=[cerdo(error=ERG, verde=1, mecha=[0.0, 1.5], hasta=1.46, cabezaYaw=[[0, -8], [0.3, 0]])],
     efectos=[{"tipo": "destello", "t": 1.47, "pos": [0, 1.2, 2.9], "tam": 7, "color": [3.6, 3.4, 3.1], "dur": 0.3}]),
     [dict(desde=VW([0.25, 1.45, -0.9], C, 1.4, fov=34), hasta=VW([0.2, 1.5, -0.3], C, 1.55, fov=34), curva="suave", temblor=0.14)])

# 8 · ¡boom! (plano abierto) y LTezla sentado, aturdido, de frente
POS_BOOM = [0.0, 1.0, 3.0]
dB = D("boom")
toma("boom", "Boom", dict(BASE, actor=L2, dof=0.25, brillo=1.6,
     efectos=[{"tipo": "destello", "t": 0.0, "pos": POS_BOOM, "tam": 13, "anillo": 8, "color": [3.6, 3.3, 3.0], "dur": 0.6},
              {"tipo": "particulas", "estilo": "humo", "pos": POS_BOOM, "area": [1.8, 1.2, 1.8], "rafaga": {"t": 0.02, "n": 320}, "vel": 5.0, "abre": 180, "vida": 1.9, "tam": 0.9, "crece": 2.6, "color": [0.7, 0.7, 0.7], "arrastre": 1.8},
              {"tipo": "particulas", "estilo": "polvo", "forma": "cuadro", "pos": POS_BOOM, "area": [1.0, 0.6, 1.0], "rafaga": {"t": 0.0, "n": 70}, "vel": 9, "abre": 160, "dir": [0, 1, 0], "vida": 1.6, "tam": 0.16, "g": 14, "suelo": True, "color": [0.35, 0.55, 0.2], "color2": [0.45, 0.3, 0.18]},
              {"tipo": "particulas", "estilo": "chispas", "pos": POS_BOOM, "area": [0.6, 0.6, 0.6], "rafaga": {"t": 0.0, "n": 70}, "vel": 8, "abre": 180, "vida": 0.6, "g": 6}]),
     [dict(desde=VWT([0.6, 1.9, -3.2], L2, 0.9, [0.9, 1.0, 1.6]), hasta=VWT([0.62, 1.95, -3.5], L2, 0.9, [0.9, 1.0, 1.6]), curva="suave", temblor=1.0)],
     poses=[["sorpresa", 0.2], ["sentado", round(dB - 0.2, 3), {"trans": 0.1}]], ojos=[["sorprendido", dB, 0, 0]], matices=[["temblar", 0.25, dB - 0.25, 0.55]])
dA = D("aturdido")
toma("aturdido", "Aturdido", dict(BASE, actor=L2, dof=0.5,
     efectos=[{"tipo": "particulas", "estilo": "humo", "pos": [1.9, 0.25, 2.6], "area": [3.0, 0.5, 1.2], "tasa": 12, "vel": 0.4, "vida": 1.6, "tam": 0.6, "crece": 1.5, "color": [0.65, 0.65, 0.65], "desde": 0},
              {"tipo": "particulas", "estilo": "destellos", "pos": [1.9, 1.15, 1.0], "area": [0.7, 0.15, 0.7], "tasa": 14, "vida": 0.7, "tam": 0.09, "color": [3.0, 2.8, 1.2], "desde": 0.15}]),
     [dict(desde=V(0, 2, 2.5, 0.95), hasta=V(3, 2, 2.3, 0.95), curva="suave", temblor=0.06)],
     poses=[["sentado", dA]], ojos=[["sorprendido", 0.2, 0.9, 0.3], ["confundido", 0.22, -0.9, -0.3], ["sorprendido", 0.22, 0.9, -0.3], ["confundido", 0.22, -0.9, 0.3], ["sorprendido", 0.22, 0.6, 0], ["confundido", round(dA - 1.08, 3), 0, 0, {"aCamara": True}]],
     matices=[["balancear", 0.0, dA, 1.0], ["negar", 0.1, 1.0, 0.8], ["temblar", 0.0, 0.5, 0.3]])

# 9 · así nació el creeper (contrapicado contra el cielo, 1.9 s)
CR = A(0.5, 0, -6.0)
CREEPERS = [{"tipo": "creeper", "n": 1, "x": CR["x"], "z": CR["z"], "dir": 10, "modo": "caminar", "vel": 0.35, "fijo": True, "semilla": 21, "parar": 0.9, "foco": True,
             "cabezaYaw": [[0, 0], [1.6, 0], [2.3, 22]]},
            {"tipo": "creeper", "n": 4, "x": -1.0, "z": -12.0, "ancho": 9, "prof": 4, "dir": 30, "modo": "caminar", "vel": 0.45, "semilla": 31}]
toma("nacio", "Así nació el creeper", dict(BASE, actor=CR, ocultar=True, dof=0.3, mobs=CREEPERS),
     [dict(desde=VW([-0.9, 0.25, -3.3], CR, 1.35, fov=34), hasta=VW([0.1, 0.3, -2.5], CR, 1.4, fov=34), curva="lineal", temblor=0.05)])

# 10 · título sobre negro (respira: vaivén y acercamiento lentos) y remate: el cerdo entra, mira y hace oink
dT = D("titulo")
VIVO = dict(vivo=5.0, crece=0.08)
toma("titulo", "Título", dict(negro=True), [dict(desde=V(0, 4, 4, 1.1))],
     textos=[T("EL CREEPER", 0.5, 0.33, 13, VERDE, dT, 0.0, **VIVO),
             T("ERA UN CERDO", 0.5, 0.53, 13, ROSA, dT - 0.25, 0.25, **VIVO),
             T("FUENTE: MINECRAFT.NET - MEET THE CREEPER - 2017", 0.5, 0.85, 3.0, BLANCO, dT - 0.6, 0.6, prof=0.1, relieve=0.03, **VIVO)])
PZ = A(0.3, 0, -5.0)
toma("remate", "Remate: oink", dict(BASE, actor=PZ, ocultar=True, dof=0.3, fundido={"entra": 0.0, "sale": 0.35},
     mobs=[{"tipo": "cerdo", "n": 1, "x": 1.2, "z": -5.0, "dir": 270, "modo": "caminar", "vel": 1.1, "fijo": True, "semilla": 9, "ruta": [[0.3, -5.0]], "arranque": 0.0, "parar": 0.7,
            "cabezaYaw": [[0, 0], [0.75, 0], [0.92, 75], [2.0, 72]], "foco": True}]),
     [dict(desde=VW([0.45, 1.1, -2.3], PZ, 0.5, fov=32), hasta=VW([0.15, 1.0, -1.9], PZ, 0.5, fov=32), curva="lineal", temblor=0.05)])


# ═══════════ armar el proyecto ═══════════
def dur_audio(arch):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", os.path.join(RAIZ, arch)], capture_output=True, text=True)
    return float(r.stdout.strip())


def armar():
    base = json.load(open(os.path.join(RAIZ, "agente", "proyectos", "epico_base.json"), encoding="utf-8"))
    trailer = json.load(open(os.path.join(RAIZ, "proyectos", "trailer-bobicraft-ltezla.json"), encoding="utf-8"))   # solo lectura
    reposo = copy.deepcopy(base["pistas"]["poses"][0]["pose"])
    p = copy.deepcopy(base)
    p["nombre"] = "El creeper era un cerdo"
    p["escena"] = copy.deepcopy(trailer["escena"])
    p["efectos"] = {**copy.deepcopy(trailer["efectos"]), "vineta": 0.28, "grano": 0.025, "brillo": 0.42}
    p["ajustes"] = {**trailer["ajustes"], "formato": "1280x720"}
    p["mundo"] = None
    p["ediciones"] = {"pradera": NICHO}
    k = {"escenas": [], "camara": [], "poses": [], "ojos": [], "matices": [], "textos": [], "audio": []}
    t0 = 0
    for s in TOMAS:
        k["escenas"].append({"id": nid(), "dur": s["dur"], "nombre": s["nombre"], "mobs": [], **s["escena"]})
        for c in s["cams"]:
            c = dict(c)
            k["camara"].append({"id": nid(), "tipo": "libre", "dur": c.pop("dur", s["dur"]), "desde": c["desde"], "hasta": c.pop("hasta", c["desde"]),
                                "curva": c.pop("curva", "lineal"), **{a: v for a, v in c.items() if a != "desde"}})
        k["poses"].append({"id": nid(), "pose": copy.deepcopy(reposo), "dur": s["dur"], "trans": 0, "curva": "natural", "corte": True})
        k["ojos"].append({"id": nid(), "cara": "neutral", "dur": s["dur"], "mx": 0, "my": 0})
        for tipo, ini, dur, inten in s["matices"]:
            k["matices"].append({"id": nid(), "tipo": tipo, "inicio": round(t0 + ini, 3), "dur": round(dur, 3), "intensidad": inten})
        for x in s["textos"]:
            k["textos"].append({"id": nid(), **x, "inicio": round(t0 + x.get("inicio", 0), 3)})
        t0 += s["dur"]
    mus = AUD["musica"]
    k["audio"].append({"id": nid(), "tipo": "musica", "texto": guion.MUSICA[0], "durSfx": guion.MUSICA[1], "archivo": mus, "inicio": 0, "desde": 0,
                       "dur": PARA_MUSICA, "vol": 0.42, "salida": 0.12})
    k["audio"].append({"id": nid(), "tipo": "musica", "texto": guion.MUSICA[0], "durSfx": guion.MUSICA[1], "archivo": mus, "inicio": EXPLOTA, "desde": PARA_MUSICA,
                       "dur": round(FIN - EXPLOTA, 3), "vol": 0.5, "entrada": 0.02, "salida": 0.8})
    for lid, ini in VOCES.items():
        clave = TOMA_VOZ[lid]
        arch = AUD[clave]
        texto = guion.LINEAS[lid][0 if clave.endswith(("A", "C")) else 1]
        k["audio"].append({"id": nid(), "tipo": "voz", "texto": texto, "voz": guion.VOZ, "modelo": "eleven_v3", "inicio": round(ini, 3),
                           "dur": round(dur_audio(arch) + 0.05, 3), "vol": 1.0, "archivo": arch, "alineacion": arch[:-4] + ".json"})
    for nombre, ini, vol in SFX_T:
        arch = AUD[nombre]
        d = dur_audio(arch)
        k["audio"].append({"id": nid(), "tipo": "sfx", "texto": guion.SFX[nombre][0], "durSfx": guion.SFX[nombre][1], "inicio": round(ini, 3), "dur": round(d, 3), "vol": vol, "archivo": arch})
    p["pistas"] = k
    return p, t0


def timing(total):
    voces = {}
    for lid, ini in VOCES.items():
        arch = AUD[TOMA_VOZ[lid]]
        voces[lid] = {"archivo": arch, "inicio_s": round(ini, 3), "fin_s": round(ini + dur_audio(arch), 3),
                      "in_frame": round(ini * 30), "out_frame": round((ini + dur_audio(arch)) * 30)}
    return {"fps": 30, "duracion_s": total, "cuadros": round(total * 30),
            "musica": {"archivo": AUD["musica"], "bpm": AN["musica"]["bpm"], "tramos": [{"pelicula": [0, PARA_MUSICA], "musica": [0, PARA_MUSICA]},
                                                                                   {"pelicula": [EXPLOTA, FIN], "musica": [PARA_MUSICA, round(FIN - OFS_FINAL, 3)]}]},
            "beats_pelicula_s": [round(x, 3) for x in BEATS if x <= PARA_MUSICA + 0.01] + [round(x + OFS_FINAL, 3) for x in BEATS if x >= PARA_MUSICA - 0.01 and x + OFS_FINAL <= FIN],
            "drop": {"t_s": EXPLOTA, "frame": round(EXPLOTA * 30), "nota": "explosión + regreso de la música"},
            "silencio_musica": [PARA_MUSICA, EXPLOTA],
            "cambios_de_camara": [{"t_s": round(TC["alto_ancho"] + c1, 3), "frame": round((TC["alto_ancho"] + c1) * 30), "toma": "Alto y ancho (vista de arriba → lateral, sobre \"alto\")"}],
            "cortes": [{"t_s": round(c, 3), "frame": round(c * 30), "toma": (TOMAS[j]["nombre"] if j < len(TOMAS) else "fin")} for j, c in enumerate(CORTES)],
            "acciones": {"cara_a_cerdo": b(0.7), "glitch_gancho": b(1.97), "giro_alto_ancho": GIRO, "se_levanta": PARA, "verde_empieza": round(TC["verde"] + 0.15, 3),
                         "mecha": list(MECHA), "explosion": EXPLOTA, "oink_final": OINK},
            "voces": voces,
            "sfx": [{"nombre": n, "t_s": round(t, 3), "frame": round(t * 30), "vol": v} for n, t, v in SFX_T]}


def agente(cmd, args=None):
    r = subprocess.run([sys.executable, os.path.join(RAIZ, "herramientas", "agente.py"), cmd, json.dumps(args or {}, ensure_ascii=False)],
                       capture_output=True, text=True, encoding="utf-8")
    return r.stdout.strip()[:300]


if __name__ == "__main__":
    p, total = armar()
    json.dump(p, open(os.path.join(RAIZ, "agente", "proyectos", "creeper.json"), "w", encoding="utf-8"), ensure_ascii=False)
    json.dump(timing(round(total, 3)), open(os.path.join(AQUI, "timing.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    for j, s in enumerate(TOMAS):
        print(f"{CORTES[j]:6.2f} {s['dur']:5.2f}  {s['nombre']}")
    print("total", round(total, 3), "voces", VOCES)
    if len(sys.argv) > 1 and sys.argv[1] == "aplicar":
        print(agente("abrir", {"nombre": "creeper"}))
        for j, s in enumerate(TOMAS, 1):
            if not s["escena"].get("ocultar") and not s["escena"].get("negro"):
                print(j, agente("personaje", {"toma": j, "poses": s["poses"], "ojos": s["ojos"]}))
