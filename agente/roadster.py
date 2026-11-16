"""Corto de divulgación "El auto que vuela" (Minecraft Animator): LTezla explica la física del nuevo Tesla Roadster
(presentado el 15 de octubre de 2026): por qué unas llantas no bastan para ir de 0 a 96 km/h en 0.81 s, los ventiladores
de succión (más fuerza contra el piso = más fricción) y los propulsores de aire comprimido (tercera ley de Newton),
hasta que el auto despega y… se le acaba el aire.

  python agente/roadster.py            → agente/proyectos/roadster.json   (luego: agente.py abrir '{"nombre": "roadster"}')
  python agente/roadster.py poses      → una línea JSON por toma para el comando `personaje` (poses y ojos de LTezla)

Física (unidades: 1 bloque = 1 m, g = 9.8 m/s²). Datos de Tesla y de la prensa (Electrek, Teslarati, InsideEVs):
  masa ≈ 1700 kg · 0–60 mph (26.8 m/s) en 0.81 s → a = 33 m/s² ≈ 3.4 g · llantas: μ ≈ 1.2 → 1.2 g máx
  succión ≈ 4700 kgf → fuerza normal 6400 kgf (3.8× el peso) → hasta 4.5 g de agarre
  propulsores traseros ≈ 80 kN → 47 m/s² ≈ 4.8 g · peso = 1700 × 9.8 ≈ 17 kN (el empuje es 4.8× el peso)
  tanques de 600 L a 10 000 psi: a todo empuje duran unos segundos
Las trayectorias del auto se calculan aquí (tiro parabólico, arco de la rampa, caída libre, frenado) y van como `claves`
del efecto `roadster` (js/efectos.js); la rampa usa el mismo arco que dibuja el motor (radio R, ángulo θ).

Orientación: la pista corre a lo largo de z (escenario `pista`), el auto va hacia +z. El ancla de cada toma es el origen
(los efectos y el auto se miden desde ahí) y `actor` es a dónde mira la cámara (y donde está LTezla si sale).
"""
import copy
import json
import math
import os
import subprocess
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_n = 0


def nid():
    global _n
    _n += 1
    return f"rd{_n:04d}"


def V(az, el, dist, ty, **k):
    return {"az": az, "el": el, "dist": dist, "ty": ty, "fov": 38, **k}


def suave(u):
    return 0.0 if u <= 0 else 1.0 if u >= 1 else u * u * (3 - 2 * u)


G = 9.8
ROJO = dict(color="#ff3b30", color2="#ff6a55", sombra="#4a0505", sombra2="#9a1010")
BLANCO = dict(color="#e8e6e6", color2="#ffffff", sombra="#3e3a3a", sombra2="#6a6464")
AMARILLO = dict(color="#faf90d", color2="#ffff2e", sombra="#b0400c", sombra2="#f2a018")
CELESTE = dict(color="#58e6ff", color2="#b8f6ff", sombra="#063a52", sombra2="#0b6a8a")


def T(texto, x, y, tam, estilo, dur, inicio=0.0, **k):
    return {"texto": texto, "x": x, "y": y, "tam": tam, "prof": 0.35, "relieve": 0.06, "espaciado": -0.04, "interlinea": 1.05,
            "dur": dur, "inicio": inicio, "anim": "golpe", **estilo, **k}


def L(texto, pos, tam, estilo, desde, hasta=None, **k):
    """etiqueta 3D en el mundo (efecto texto)"""
    e = {"tipo": "texto", "texto": texto, "pos": pos, "tam": tam, "desde": desde, "anim": "golpe", "entra": 0.08, **{a: b for a, b in estilo.items() if a in ("color", "color2", "sombra", "sombra2")}, **k}
    if hasta is not None:
        e["hasta"], e["sale"] = hasta, k.get("sale", 0.15)
    return e


VOZ = "wXojZ3FhzsE0AumH6Oym"
TOMAS, SONIDOS = [], []        # sonidos: (texto, inicio absoluto, duración, volumen, tipo)
t_actual = 0.0


def toma(dur, nombre, escena, cams, poses=None, ojos=None, textos=(), matices=(), sonidos=()):
    global t_actual
    TOMAS.append(dict(dur=round(dur, 3), nombre=nombre, escena=escena, cams=cams, poses=poses or [["reposo", dur]],
                      ojos=ojos or [["neutral", dur]], textos=list(textos), matices=list(matices)))
    for s in sonidos:                                         # (texto, inicio relativo, dur, vol[, tipo])
        SONIDOS.append((s[0], round(t_actual + s[1], 3), s[2], s[3], s[4] if len(s) > 4 else "sfx"))
    t_actual += dur


# ═══════════ trayectorias (física) ═══════════
def claves(f, t0, t1, dt=1 / 60):
    """muestrea f(t) → (x, y, z, rumbo, cabeceo, alabeo) en [t0, t1] (tiempo de la toma)"""
    out, n = [], max(1, round((t1 - t0) / dt))
    for i in range(n + 1):
        t = t0 + (t1 - t0) * i / n
        out.append([round(t, 4)] + [round(v, 4) for v in f(t)])
    return out


# salto con giro ("kickflip"): llega a 16 m/s, sube la rampa (arco R, θ) y vuela en tiro parabólico
R_RAMPA, TH_RAMPA, V_SALTO = 7.0, 32.0, 16.0
TH = math.radians(TH_RAMPA)
LR = R_RAMPA * TH                                         # largo del arco
T_RAMPA = 1.4                                             # llega a la rampa (tiempo de la historia)
T_DESP = T_RAMPA + LR / V_SALTO                           # despega
Y0, Z0 = R_RAMPA * (1 - math.cos(TH)), R_RAMPA * math.sin(TH)
VZ, VY = V_SALTO * math.cos(TH), V_SALTO * math.sin(TH)
T_VUELO = (VY + math.sqrt(VY * VY + 2 * G * Y0)) / G      # hasta tocar el piso (y = 0)
T_ATERR = T_DESP + T_VUELO
Z_ATERR = Z0 + VZ * T_VUELO


def salto(T):
    """estado del auto en el tiempo de la historia T (0 = empieza la toma 1)"""
    if T < T_RAMPA:
        return (0, 0, V_SALTO * (T - T_RAMPA), 0, 0, 0)
    if T < T_DESP:
        phi = V_SALTO * (T - T_RAMPA) / R_RAMPA
        return (0, R_RAMPA * (1 - math.cos(phi)), R_RAMPA * math.sin(phi), 0, math.degrees(phi), 0)
    if T < T_ATERR:
        t = T - T_DESP
        cab = TH_RAMPA * (1 - suave(t / 0.75)) - 5 * suave((t - 0.9) / 0.5) * (1 - suave((t - 1.55) / 0.3))
        return (0, Y0 + VY * t - 0.5 * G * t * t, Z0 + VZ * t, 0, cab, 360 * suave((t - 0.12) / 1.5))
    t = T - T_ATERR                                       # aterriza: la suspensión rebota y frena a 6 m/s²
    v = max(0.0, VZ - 6 * t)
    z = Z_ATERR + (VZ * VZ - v * v) / 12
    return (0, -0.13 * math.exp(-5 * t) * math.sin(min(t, 1.2) * 11), z, 0, 2.5 * math.exp(-4 * t) * math.sin(t * 9), 0)


def desplazada(f, T0):
    return lambda t: f(t + T0)


# arrancón: de 0 a 26.8 m/s en 0.81 s (a = 33 m/s²) y luego sigue acelerando más suave
A_ARRANQUE = 26.8 / 0.81


def arrancon(t0, z0, x=0.0):
    def f(t):
        u = max(0.0, t - t0)
        if u < 0.81:
            z = 0.5 * A_ARRANQUE * u * u
        else:
            z = 0.5 * A_ARRANQUE * 0.81 ** 2 + 26.8 * (u - 0.81) + 0.5 * 4 * (u - 0.81) ** 2
        squat = 1.5 * suave(u / 0.12) * (1 - suave((u - 0.5) / 0.6)) if t >= t0 else 0
        return (x, 0, z0 + z, 0, squat, 0)
    return f


def quieto(x, y, z, rumbo=0, cab=0, ala=0):
    return lambda t: (x, y, z, rumbo, cab, ala)


# ═══════════ escena común ═══════════
DIA = dict(set="pista", ambiente="dia", sat=1.12, calidez=2, nubes=True)
ORIGEN = {"x": 0, "y": 0, "z": 0, "rot": 0}
RAMPA = {"tipo": "rampa", "pos": [0, 0, 0], "rumbo": 0, "radio": R_RAMPA, "angulo": TH_RAMPA, "ancho": 3.2}
NARANJA, CIAN, VERDE_F, BLANCO_F = [4.0, 1.1, 0.25], [0.35, 2.4, 3.6], [0.5, 3.2, 0.7], [2.6, 2.6, 2.8]
BOOM = "short deep cinematic boom impact with a quick whoosh, trailer hit"
DING = "cute game ui pop ding, bright and short"
MOTOR = "electric supercar motor whine accelerating fast, high pitched, passing by"
CHORRO = "powerful compressed air thruster blast, high pressure gas jet roaring hiss"
LLANTAS = "car tires screeching burnout, rubber squeal, spinning wheels"
VENTILADORES = "electric fans spinning up, rising turbine hum, vacuum suction"
CONGELAR = "time freeze effect, reverse whoosh riser then sudden silence with shimmer"
SIN_AIRE = "air running out, sputtering pressure hiss dying out, comedic deflate"
ATERRIZA = "massive heavy iron golem landing, ground impact thud, debris"
WHOOSH = "whoosh of a sword swing in slow motion"


def auto(f, t0, t1, **k):
    return {"tipo": "roadster", "claves": claves(f, t0, t1), **k}


def VW(cam, actor, ty, **k):
    """cámara puesta en el mundo: posición `cam` [x, y, z] mirando al actor (a `ty` sobre sus pies)"""
    ax, ay, az_, rot = actor.get("x", 0), actor.get("y", 0), actor.get("z", 0), actor.get("rot", 0)
    dx, dy, dz = cam[0] - ax, cam[1] - (ay + ty), cam[2] - az_
    d = math.sqrt(dx * dx + dy * dy + dz * dz)
    return V(round(math.degrees(math.atan2(dx, dz)) - rot, 2), round(math.degrees(math.asin(dy / d)), 2), round(d, 3), ty, **k)


def A(x, y, z, rot=0):
    return {"x": x, "y": y, "z": z, "rot": rot}


ESTELA = [{"punto": [0.8, 0.78, -2.27], "largo": 0.35, "ancho": 0.08}, {"punto": [-0.8, 0.78, -2.27], "largo": 0.35, "ancho": 0.08}]
ALA_VUELO = 1

# ═══════════ 1 · el gancho: un auto que vuela (0–4.4 s) ═══════════
a1 = A(0, 0, -2)
toma(1.6, "Llega a la rampa", dict(DIA, ancla=ORIGEN, actor=a1, ocultar=True, dof=0.45,
     efectos=[RAMPA, auto(salto, 0, 1.6, polvo=True, estela=ESTELA, ala=[[0, 0], [0.6, 1]])]),
     [dict(desde=VW([-3.6, 0.45, 6.5], a1, 0.8), hasta=VW([-3.2, 0.6, 5.6], a1, 0.95), curva="suave", temblor=0.18)],
     sonidos=[(MOTOR, 0, 2.6, 0.75)])

T1 = 1.6
a2 = A(0, 4.45, 14.6)
toma(3.6, "Vuela… y se congela", dict(DIA, ancla=ORIGEN, actor=a2, ocultar=True, dof=0.25, brillo=1.4,
     tiempo=[[0, 0], [0.7, 0.7], [0.95, 0.82], [3.0, 0.87], [3.25, 0.98], [3.6, 1.6]],
     efectos=[RAMPA, auto(desplazada(salto, T1), 0, 2.2, estela=ESTELA, ala=1, gas={"tasa": 16, "tam": 0.3, "vida": 0.9},
                          chorros=[[T_DESP - T1 + 0.05, T_DESP - T1 + 0.4, "abajo_izq", 1.0]])]),
     [dict(desde=V(-95, 4, 11.5, 0.0), hasta=V(-145, 9, 11.0, 0.0), curva="suave", temblor=0.08)],
     textos=[T("¿CÓMO?", 0.5, 0.8, 13, AMARILLO, 0.75, 2.85)],
     sonidos=[(CHORRO, 0.0, 1.2, 0.7), (CONGELAR, 0.55, 2.0, 0.75), ("[excited] ¡Este auto... VUELA!", 0.8, 1.4, 1.0, "voz"), (BOOM, 2.85, 1.5, 0.8)])

# ═══════════ 2 · ¿qué es? (4.4–11.6) ═══════════
a3 = A(0, 0, 0, 20)
toma(4.3, "El nuevo Roadster", dict(DIA, ancla=ORIGEN, actor=a3, dof=0.6, brillo=1.2,
     efectos=[auto(quieto(3.4, 0, -1.2, -35), 0, 4.3),
              L("TESLA ROADSTER", [3.4, 2.05, -1.2], 0.5, ROJO, 0.55),
              L("PRESENTADO EL 15 DE OCTUBRE DE 2026", [3.4, 1.6, -1.2], 0.17, BLANCO, 0.9, entra=0.15),
              {"tipo": "particulas", "estilo": "destellos", "pos": [3.4, 1.0, -1.2], "area": [4.6, 1.2, 2.4], "desde": 0.5, "tasa": 26}]),
     [dict(desde=VW([-0.6, 1.7, 7.4], a3, 1.25, pan=-10), hasta=VW([-0.4, 1.7, 6.6], a3, 1.25, pan=-10), curva="suave", temblor=0.05)],
     poses=[["presentar", 4.3]], ojos=[["emocionado", 2.0, 0.5, 0, {"aCamara": True}], ["feliz", 2.3, 0, 0, {"aCamara": True}]],
     matices=[["hablar", 0.2, 3.9, 0.8]],
     sonidos=[(DING, 0.55, 0.6, 0.5), ("[curious] Es el nuevo Tesla Roadster. ¡Lo acaban de presentar!", 0.25, 3.3, 1.0, "voz")])

ARR = arrancon(0.35, -54)
toma(3.6, "De 0 a 96 en 0.81 s", dict(DIA, ancla=ORIGEN, actor=A(0, 0, -54), ocultar=True, dof=0.3, brillo=1.3,
     efectos=[auto(ARR, 0, 3.6, polvo=True, estela=ESTELA, ala=[[0.6, 0], [1.0, 1]], chorros=[[0.3, 1.25, "atras", 1.0]], camara={"retraso": 0.12, "ofs": [0, 0, 0.6]}),
              {"tipo": "texto", "texto": "{v} S", "valor": [[0.35, 0], [1.16, 0.81]], "dec": 2, "sigue": "auto", "pos": [0, 2.2, 0], "tam": 0.55, **AMARILLO, "desde": 0.2}]),
     [dict(desde=V(-72, 4, 7.8, 0.8), hasta=V(-62, 5, 8.6, 0.9), curva="suave", temblor=0.3)],
     textos=[T("0 A 96 KM/H", 0.5, 0.16, 6.5, BLANCO, 2.0, 1.15), T("SEGÚN TESLA", 0.5, 0.25, 2.6, BLANCO, 1.9, 1.25, prof=0.12, relieve=0.03)],
     sonidos=[(CHORRO, 0.3, 1.4, 0.8), (MOTOR, 0.25, 2.5, 0.6), ("[excited] De cero a casi cien... ¡en ocho décimas de segundo!", 0.5, 2.6, 1.0, "voz")])

# ═══════════ 3 · el problema: las llantas (11.6–19.1) ═══════════
a5 = A(-0.6, 0, 4.4, -90)
toma(8.0, "El problema", dict(DIA, ancla=ORIGEN, actor=a5, dof=0.4,
     efectos=[auto(quieto(1.6, 0, 1.2, 180), 0, 8.0),
              {"tipo": "rejilla", "pos": [1.6, 0.03, -0.4], "tam": [6, 10], "paso": 1, "plano": "xz", "color": [0.25, 1.1, 1.8], "desde": 0.2, "entra": 0.5},
              {"tipo": "flecha", "sigue": "auto", "pos": [0, 0.75, 2.4], "dir": [0, 0, 1], "largo": 2.4, "color": NARANJA, "grosor": 0.14, "desde": 2.7, "encima": True, "texto": "NECESITA 3.4 G", "tamTexto": 0.34, "colorTexto": "#ffb15a", "ofsTexto": [0, 0.5, 1.7]},
              {"tipo": "flecha", "sigue": "auto", "pos": [1.05, 0.06, 1.42], "dir": [0, 0, 1], "largo": 1.05, "color": CIAN, "grosor": 0.1, "desde": 5.3, "encima": True, "texto": "LLANTAS: 1.2 G MÁX", "tamTexto": 0.26, "colorTexto": "#9ff0ff", "ofsTexto": [0, -0.35, 0]},
              {"tipo": "flecha", "sigue": "auto", "pos": [1.05, 0.06, -1.42], "dir": [0, 0, 1], "largo": 1.05, "color": CIAN, "grosor": 0.1, "desde": 5.4, "encima": True}]),
     [dict(dur=4.6, desde=VW([-10.8, 2.2, 2.4], a5, 1.25, pan=21), hasta=VW([-10.0, 2.3, 2.2], a5, 1.25, pan=21), curva="suave", temblor=0.05),
      dict(dur=3.4, desde=VW([-6.8, 1.2, 1.4], a5, 0.8, pan=40), hasta=VW([-6.4, 1.1, 1.2], a5, 0.8, pan=40), curva="suave", temblor=0.05)],
     poses=[["reposo", 2.4], ["senalar", 2.8, {"trans": 0.3}], ["encogerse", 2.8, {"trans": 0.35}]], ojos=[["feliz", 2.4, 0, 0, {"aCamara": True}], ["pensativo", 2.8, 0.6, 0], ["confundido", 2.8, 0, 0, {"aCamara": True}]],
     matices=[["hablar", 0.0, 1.9, 0.6], ["hablar", 2.1, 5.7, 0.7]],
     sonidos=[(DING, 2.7, 0.6, 0.45), (DING, 5.3, 0.6, 0.45), ("Pero hay un problema: unas llantas normales... ¡no empujan tan fuerte!", 2.1, 3.8, 1.0, "voz")])

a6 = A(-2.6, 0, -4.0, -125)
toma(4.7, "Patina", dict(DIA, ancla=ORIGEN, actor=a6, dof=0.35,
     efectos=[auto(lambda t: (0, 0, 0.3 * t * t, 0, 0.8 * math.sin(t * 31), 0.4 * math.sin(t * 23)), 0, 4.7, giroRuedas=[[0, 4.7, 55]], humo=[[0.05, 4.7]]),
              L("¡PATINA!", [0, 2.3, 0.6], 0.6, AMARILLO, 0.6),
              {"tipo": "particulas", "estilo": "chispas", "pos": [0, 0.05, -1.5], "area": [1.8, 0, 0.3], "dir": [0, 0.4, -1], "tasa": 45, "desde": 0.1}]),
     [dict(desde=VW([-10.5, 1.6, 2.6], a6, 1.2, pan=-8), hasta=VW([-10.0, 1.6, 2.2], a6, 1.2, pan=-8), temblor=0.3)],
     poses=[["sorpresa", 1.6], ["facepalm", 3.1, {"trans": 0.3}]], ojos=[["sorprendido", 1.6, 0.8, 0], ["cansado", 3.1]],
     matices=[["temblar", 1.7, 2.2, 0.4], ["hablar", 0.3, 4.2, 0.5]],
     sonidos=[(LLANTAS, 0, 4.7, 0.6), ("La fricción tiene un límite... ¡y patinas!", 0.3, 2.5, 1.0, "voz")])

# ═══════════ 4 · truco 1: succión (19.1–27.3) ═══════════
a7 = A(0, 0, 0)
toma(4.6, "Truco 1: ventiladores", dict(DIA, ancla=ORIGEN, actor=a7, ocultar=True, dof=0.25, brillo=1.4,
     efectos=[auto(quieto(0, 0, 0, 0), 0, 4.6, succion=[[0.3, 4.6]]),
              {"tipo": "flecha", "pos": [0.5, 4.3, -0.4], "dir": [0, -1, 0], "largo": 3.0, "color": CIAN, "grosor": 0.16, "desde": 1.5, "crece": 0.5, "encima": True},
              {"tipo": "flecha", "pos": [0.5, 2.5, 1.0], "dir": [0, -1, 0], "largo": 1.1, "color": BLANCO_F, "grosor": 0.12, "desde": 1.1, "crece": 0.4, "encima": True},
              L("PESO 1.7 T", [0.5, 2.0, 2.6], 0.3, BLANCO, 1.2),
              L("SUCCIÓN 4.7 T", [0.5, 3.3, -2.9], 0.34, CELESTE, 1.6),
              L("¡3.8 VECES MÁS AGARRE!", [0.5, 4.75, 0.3], 0.32, AMARILLO, 2.7)]),
     [dict(desde=VW([-6.4, 0.3, 1.2], a7, 0.55), hasta=VW([-10.5, 2.4, 0.3], a7, 2.2), curva="suave", temblor=0.05)],
     sonidos=[(VENTILADORES, 0.2, 3.5, 0.6), (DING, 1.6, 0.6, 0.45), (DING, 2.7, 0.6, 0.45),
              ("Truco uno: cuatro ventiladores lo chupan contra el piso.", 0.2, 3.2, 1.0, "voz")])

PARED = lambda t: (24, 5.6, -57 + 6.0 * t, 0, 0, -90)
toma(4.6, "Por la pared", dict(DIA, ancla=ORIGEN, actor=A(24, 5.6, -57), ocultar=True, dof=0.2, brillo=1.3,
     efectos=[auto(PARED, 0, 4.6, succion=[[0, 4.6]], estela=ESTELA, ruedasSiempre=True, camara={"retraso": 0, "ofs": [-1.0, 0, 0]}),
              {"tipo": "flecha", "sigue": "auto", "pos": [0, 0.6, 0.4], "dir": [0, -1, 0], "dirMundo": True, "largo": 1.3, "color": BLANCO_F, "grosor": 0.11, "desde": 0.8, "encima": True, "texto": "PESO", "tamTexto": 0.28},
              {"tipo": "flecha", "sigue": "auto", "pos": [0, 1.6, -0.6], "dir": [1, 0, 0], "dirMundo": True, "largo": 1.6, "color": CIAN, "grosor": 0.12, "desde": 1.2, "encima": True, "texto": "SUCCIÓN", "tamTexto": 0.28, "colorTexto": "#9ff0ff"},
              {"tipo": "flecha", "sigue": "auto", "pos": [0, 0.6, -0.4], "dir": [0, 1, 0], "dirMundo": True, "largo": 1.3, "color": VERDE_F, "grosor": 0.11, "desde": 1.7, "encima": True, "texto": "FRICCIÓN", "tamTexto": 0.28, "colorTexto": "#9dff8a"}]),
     [dict(desde=V(-42, -30, 9.5, 0), hasta=V(-32, -28, 9.2, 0), curva="suave", temblor=0.1)],
     sonidos=[(MOTOR, 0, 3.0, 0.4), ("Más fuerza contra el piso, más agarre... ¡hasta puede ir por la pared!", 0.2, 3.7, 1.0, "voz")])

# ═══════════ 5 · truco 2: propulsores (27.3–35.3) ═══════════
ARR2 = arrancon(0.9, -48)
toma(4.0, "Truco 2: propulsores", dict(DIA, ancla=ORIGEN, actor=A(0, 0, -48), ocultar=True, dof=0.25, brillo=1.4,
     efectos=[auto(ARR2, 0, 4.0, chorros=[[0.6, 2.6, "atras", 1.0]], estela=ESTELA, ala=[[0.5, 0], [0.9, 1]], camara={"retraso": 0.3, "ofs": [0, 0, 0]})]),
     [dict(desde=V(-140, 6, 8.5, 0.8), hasta=V(-150, 7, 9.5, 0.9), curva="suave", temblor=0.3)],
     textos=[T("3RA LEY DE NEWTON", 0.5, 0.18, 7, AMARILLO, 1.3, 2.7)],
     sonidos=[(CHORRO, 0.6, 2.4, 0.85), (BOOM, 0.62, 1.5, 0.6), ("[excited] Truco dos: ¡propulsores de aire comprimido!", 0.15, 2.5, 1.0, "voz")])

toma(5.0, "Acción y reacción", dict(DIA, ancla=ORIGEN, actor=A(0, 0, -2), ocultar=True, dof=0.2, brillo=1.4,
     tiempo=[[0, 0], [0.5, 0.5], [4.6, 0.95], [5.0, 1.1]],
     efectos=[auto(lambda t: (0, 0, -2 + 1.6 * t * t, 0, 0, 0), 0, 1.2, chorros=[[0.0, 1.2, "atras", 1.0]], estela=ESTELA, ala=1, camara={"retraso": 0, "ofs": [0, 0, 0]}),
              {"tipo": "flecha", "sigue": "auto", "pos": [0, 0.45, -2.7], "dir": [0, 0, -1], "largo": 2.8, "color": CIAN, "grosor": 0.15, "desde": 0.4, "encima": True, "texto": "AIRE HACIA ATRÁS", "tamTexto": 0.32, "colorTexto": "#9ff0ff", "ofsTexto": [0, 0.6, 2.4]},
              {"tipo": "flecha", "sigue": "auto", "pos": [0, 1.5, 0.9], "dir": [0, 0, 1], "largo": 2.8, "color": NARANJA, "grosor": 0.15, "desde": 0.62, "encima": True, "texto": "AUTO HACIA ADELANTE", "tamTexto": 0.32, "colorTexto": "#ffb15a", "ofsTexto": [0, 0.45, -1.6]},
              L("80 KN = 4.8 G", [0, 3.3, -0.6], 0.34, BLANCO, 0.82, sigue="auto")]),
     [dict(desde=V(-90, 9, 9.0, 1.1), hasta=V(-90, 9, 8.4, 1.1), temblor=0.08)],
     sonidos=[(CHORRO, 0, 5.0, 0.5), (DING, 0.5, 0.6, 0.45), (DING, 1.9, 0.6, 0.45),
              ("Avientas aire para atrás... ¡y sales disparado para adelante!", 0.3, 3.5, 1.0, "voz")])

# ═══════════ 6 · ¡despega! (35.3–42.8) ═══════════
a11 = A(0, 0, 0, 25)
toma(4.4, "¿Y hacia abajo?", dict(DIA, ancla=ORIGEN, actor=a11, dof=0.55,
     efectos=[auto(quieto(2.6, 0, -1.4, -30), 0, 4.4),
              {"tipo": "flecha", "sigue": "auto", "pos": [0, 0.45, -2.6], "dir": [[2.2, [0, 0, -1]], [3.2, [0, -1, 0]]], "largo": 2.0, "color": CIAN, "grosor": 0.17, "desde": 0.5, "encima": True}]),
     [dict(desde=VW([-0.8, 1.6, 6.2], a11, 1.3, pan=-9), hasta=VW([-0.6, 1.6, 5.6], a11, 1.3, pan=-9), curva="suave", temblor=0.05)],
     poses=[["pensar", 2.4], ["senalar_arriba", 2.0, {"trans": 0.3}]], ojos=[["pensativo", 2.4, -0.5, 0.4], ["picaro", 2.0, 0, 0, {"aCamara": True}]],
     matices=[["hablar", 0.2, 4.0, 0.7]],
     sonidos=[("[curious] ¿Y si apuntas los chorros... hacia abajo?", 0.15, 2.6, 1.0, "voz")])


def despegue(t):
    u = max(0.0, t - 0.7)
    y = 3.0 * suave(u / 1.6) + 0.12 * math.sin(u * 3.1) * suave(u / 1.6)
    return (0, y, 0, 8 * suave(u / 2.5), 0.8 * math.sin(u * 2.3), 0.6 * math.sin(u * 1.7))


toma(4.8, "Despega", dict(DIA, ancla=ORIGEN, actor=A(0, 1.6, 0), ocultar=True, dof=0.2, brillo=1.5,
     efectos=[auto(despegue, 0, 4.8, chorros=[[0.55, 4.8, "abajo", 1.0]], ala=[[0.6, 0], [1.2, 1]]),
              {"tipo": "particulas", "estilo": "polvo", "pos": [0, 0.05, 0], "area": [5, 0, 6], "dir": [0, 1, 0], "abre": 70, "vel": 4, "tasa": 50, "desde": 0.6, "suelo": True},
              {"tipo": "destello", "t": 0.62, "pos": [0, 0.3, 0], "tam": 6, "anillo": 7, "color": [2, 2.3, 2.8], "dur": 0.8},
              {"tipo": "flecha", "sigue": "auto", "pos": [0, 0.4, 0], "dir": [0, -1, 0], "dirMundo": True, "largo": 1.0, "color": BLANCO_F, "grosor": 0.16, "desde": 1.8, "encima": True, "texto": "PESO 17 KN", "tamTexto": 0.36, "ofsTexto": [0, -0.8, 0]},
              {"tipo": "flecha", "sigue": "auto", "pos": [0, 1.25, 0], "dir": [0, 1, 0], "dirMundo": True, "largo": 4.8, "color": CIAN, "grosor": 0.2, "desde": 2.4, "crece": 0.6, "encima": True, "texto": "EMPUJE 80 KN", "tamTexto": 0.38, "colorTexto": "#9ff0ff"}]),
     [dict(desde=V(-35, -6, 14, 2.4, tilt=-4), hasta=V(-28, -7, 15.5, 3.2, tilt=-5), curva="suave", temblor=0.3)],
     sonidos=[(CHORRO, 0.5, 4.0, 0.85), (BOOM, 0.55, 1.5, 0.7), (DING, 1.8, 0.6, 0.45), (DING, 2.4, 0.6, 0.45),
              ("Si el empuje le gana al peso... [gasps] ¡despegas!", 0.9, 3.2, 1.0, "voz")])

# ═══════════ 7 · el ¡ajá!: es Newton (42.8–47.3) ═══════════
TR = T_RAMPA - 0.25                                       # la repetición empieza 0.25 s antes de la rampa
toma(4.5, "Repetición: es Newton", dict(DIA, ancla=ORIGEN, actor=A(0, 2.8, 13.5), ocultar=True, dof=0.12, brillo=1.5,
     tiempo=[[0, 0], [4.5, 2.4]],
     efectos=[RAMPA, auto(desplazada(salto, TR), 0, 3.2, estela=ESTELA, chispas=[T_ATERR - TR], ala=1,
                          chorros=[[T_DESP - TR + 0.05, T_DESP - TR + 0.45, "abajo_izq", 1.0], [T_ATERR - TR - 0.25, T_ATERR - TR, "abajo", 0.9]]),
              {"tipo": "trayectoria", "auto": [T_DESP - TR, T_ATERR - TR], "punto": [0, 0.5, 0], "punteado": True, "color": [3.2, 3.0, 1.2], "dibuja": [T_DESP - TR, T_ATERR - TR], "desde": 0.2},
              {"tipo": "flecha", "sigue": "auto", "pos": [0, 0.6, 0], "dir": [0, -1, 0], "dirMundo": True, "largo": 1.3, "color": BLANCO_F, "grosor": 0.11, "desde": 0.55, "hasta": T_ATERR - TR - 0.05, "encima": True, "texto": "G", "tamTexto": 0.42},
              L("PARÁBOLA", [0, 6.6, 14.6], 0.5, AMARILLO, 1.2),
              {"tipo": "destello", "t": T_ATERR - TR, "pos": [0, 0.2, Z_ATERR], "tam": 4, "anillo": 5, "color": [3, 2, 1], "dur": 0.6}]),
     [dict(desde=V(-90, 6, 22, 0.5), hasta=V(-98, 9, 20, 1.0), curva="suave", temblor=0.06)],
     textos=[T("¡ES NEWTON!", 0.5, 0.2, 11, ROJO, 1.5, 3.0)],
     sonidos=[(WHOOSH, 0.3, 1.0, 0.7), (ATERRIZA, 3.0, 1.4, 0.7), ("No es magia. [excited] ¡Es Newton!", 1.6, 2.6, 1.0, "voz")])

# ═══════════ 8 · el remate: ¿cuánto vuela? (47.3–56.8) ═══════════
HAY = (10, 1.95, 8)                                      # encima de las pacas de paja


def flota(t):
    return (10, 3.6 + 0.12 * math.sin(t * 2.6), 2.0 + 1.4 * t, 0, 1.2 * math.sin(t * 1.9), 1.5 * math.sin(t * 1.3))


a14 = A(6.0, 0, 3.0, -155)
GAUGE = [1.9, 0.2, 0]                                    # el medidor va pegado al auto, a su izquierda
toma(3.5, "¿Cuánto vuela?", dict(DIA, ancla=ORIGEN, actor=a14, dof=0.3, brillo=1.3,
     efectos=[auto(flota, 0, 3.5, chorros=[[0, 3.5, "abajo", 0.85]], ala=1),
              {"tipo": "barra", "sigue": "auto", "pos": [-1.9, 0.5, 0], "ancho": 0.45, "alto": 2.0, "valor": [[0.4, 1.0], [3.5, 0.3]], "color": [0.5, 2.6, 0.6], "desde": 0.3},
              {"tipo": "texto", "texto": "AIRE {v}%", "valor": [[0.4, 100], [3.5, 30]], "paso": 5, "sigue": "auto", "pos": [-1.9, 2.85, 0], "tam": 0.32, **BLANCO, "desde": 0.3}]),
     [dict(desde=VW([3.0, 1.5, -4.0], a14, 1.5, pan=15, tilt=9), hasta=VW([3.2, 1.5, -3.5], a14, 1.5, pan=15, tilt=10), curva="suave", temblor=0.1)],
     poses=[["senalar_arriba", 3.5]], ojos=[["emocionado", 2.0, 0.6, 0.6], ["ilusionado", 1.5, 0, 0, {"aCamara": True}]],
     matices=[["hablar", 0.3, 2.0, 0.6]],
     sonidos=[(CHORRO, 0, 3.5, 0.45), ("[happy] ¿Y cuánto tiempo puede volar?", 0.2, 2.4, 1.0, "voz")])


def cae(t):
    if t < 1.0:                                           # sigue flotando y tose
        x, y, z, r, c, a = flota(3.5 + t)
        return (x, y - 0.25 * suave(t), z, r, c + 3 * math.sin(t * 15) * suave(t), a + 2 * math.sin(t * 13) * suave(t))
    u = t - 1.0                                           # caída libre hasta las pacas: y = y0 − ½ g t²
    x0, y0, z0, *_ = flota(4.5)
    y0 -= 0.25
    tc = math.sqrt(2 * (y0 - HAY[1]) / G)
    if u < tc:
        return (x0, y0 - 0.5 * G * u * u, z0 + (HAY[2] - z0) * u / tc, 0, -4 * u / tc, 0)
    w = u - tc
    return (HAY[0], HAY[1] - 0.28 * math.exp(-6 * w) * math.sin(min(w, 1) * 13), HAY[2], 0, -4 * math.exp(-5 * w), 0)


T_CAE = 1.0 + math.sqrt(2 * (flota(4.5)[1] - 0.25 - HAY[1]) / G)
a15 = A(6.0, 0, 3.0, -155)
toma(4.8, "Se acaba el aire", dict(DIA, ancla=ORIGEN, actor=a15, dof=0.3,
     efectos=[auto(cae, 0, 4.8, chorros=[[0, 0.3, "abajo", 0.6], [0.45, 0.55, "abajo", 0.4], [0.75, 0.8, "abajo", 0.25]], ala=[[0.8, 1], [1.3, 0]]),
              {"tipo": "barra", "sigue": "auto", "pos": [-1.9, 0.5, 0], "ancho": 0.45, "alto": 2.0, "valor": [[0, 0.3], [0.9, 0.0]], "color": [3.5, 0.3, 0.2], "hasta": T_CAE - 0.05},
              {"tipo": "texto", "texto": "AIRE {v}%", "valor": [[0, 30], [0.9, 0]], "paso": 5, "sigue": "auto", "pos": [-1.9, 2.85, 0], "tam": 0.32, "color": "#ff5040", "color2": "#ff8a70", "sombra": "#4a0505", "hasta": T_CAE - 0.05},
              {"tipo": "particulas", "estilo": "polvo", "color": [0.95, 0.82, 0.35], "color2": [0.85, 0.72, 0.3], "pos": [10, 2.0, 8], "area": [3, 0.2, 3.5], "rafaga": {"t": T_CAE, "n": 90}, "vel": 4, "abre": 60, "vida": 1.4},
              {"tipo": "destello", "t": T_CAE, "pos": [10, 2.2, 8], "tam": 3, "color": [1.6, 1.4, 0.8], "dur": 0.35}]),
     [dict(desde=VW([2.6, 1.6, -5.0], a15, 1.5, pan=15, tilt=7), hasta=VW([2.6, 1.5, -5.4], a15, 1.4, pan=14, tilt=3), curva="suave", temblor=0.2)],
     poses=[["senalar_arriba", 1.0], ["sorpresa", 0.9, {"trans": 0.15}], ["encogerse", 2.9, {"trans": 0.3}]],
     ojos=[["sorprendido", 1.1, 0.4, 0.6], ["asustado", 0.6], ["avergonzado", 3.1, 0, 0, {"aCamara": True}]],
     matices=[["hablar", 1.9, 2.8, 0.6]],
     sonidos=[(SIN_AIRE, 0, 1.6, 0.8), (ATERRIZA, T_CAE - 0.05, 1.4, 0.8), ("[nervous laugh] Jeje... unos segunditos.", 1.9, 1.6, 1.0, "voz")])

a16 = A(7.0, 0, 5.4, -122)
toma(3.0, "Mejor caminando", dict(DIA, ancla=ORIGEN, actor=a16, actorHasta=A(4.6, 0, 3.9, -122), dof=0.4,
     efectos=[auto(quieto(10, 1.95, 8, 0, -1, 0), 0, 3.0),
              {"tipo": "particulas", "estilo": "humo", "pos": [10, 2.4, 8], "area": [2, 0.3, 3], "tasa": 10, "vel": 0.5, "desde": 0}]),
     [dict(desde=VW([2.4, 1.5, 1.2], a16, 1.2, pan=6), hasta=VW([2.4, 1.5, 1.2], a16, 1.2, pan=6), curva="suave", temblor=0.05, fija=False)],
     poses=[["encogerse", 1.2], ["paso", 1.8, {"trans": 0.3}]], ojos=[["avergonzado", 1.2, 0, 0, {"aCamara": True}], ["feliz", 1.8, 0.6, 0]],
     matices=[["hablar", 0.1, 1.2, 0.6], ["caminar", 1.2, 1.8, 1]],
     sonidos=[("[sighs] Mejor me regreso caminando.", 0.1, 2.0, 1.0, "voz"), ("cartoon quick scurry footsteps running away", 1.3, 1.0, 0.5)])

FIN = dict(fundido={"entra": 0.5, "sale": 1.0}, anim="aparecer", deriva=0)
toma(4.2, "Título", dict(negro=True), [dict(desde=V(0, 4, 4, 1.1))],
     textos=[T("EL AUTO", 0.5, 0.3, 10, BLANCO, 3.9, 0.25, giro=[-12, 0, 0], **FIN),
             T("QUE VUELA", 0.5, 0.46, 10, ROJO, 3.8, 0.4, **FIN),
             T("LA FÍSICA DEL NUEVO ROADSTER, EN MINECRAFT", 0.5, 0.62, 2.8, AMARILLO, 3.4, 0.9, prof=0.12, relieve=0.03, **FIN),
             T("DATOS: PRESENTACIÓN DE TESLA (15 OCT 2026) · ELECTREK · TESLARATI", 0.5, 0.88, 1.6, BLANCO, 3.2, 1.1, prof=0.08, relieve=0.02, **FIN)],
     sonidos=[(BOOM, 0.25, 1.5, 0.7)])


MUSICA = ("Futuristic electronic tech music for a fun science explainer, 120 bpm, curious pulsing synth intro, "
          "playful plucks and arpeggios, building tension, energetic big drop with punchy drums, bright and optimistic, "
          "ends with a short final sting", 60)


def dur_audio(arch):
    try:
        r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", os.path.join(RAIZ, arch)], capture_output=True, text=True)
        return float(r.stdout.strip())
    except Exception:
        return None


def armar():
    base = json.load(open(os.path.join(RAIZ, "agente", "proyectos", "epico_base.json"), encoding="utf-8"))
    trailer = json.load(open(os.path.join(RAIZ, "proyectos", "trailer-bobicraft-ltezla.json"), encoding="utf-8"))   # solo lectura
    reposo = copy.deepcopy(base["pistas"]["poses"][0]["pose"])
    p = copy.deepcopy(base)
    p["nombre"] = "El auto que vuela"
    p["escena"] = copy.deepcopy(trailer["escena"])
    p["efectos"] = {**copy.deepcopy(trailer["efectos"]), "vineta": 0.28, "grano": 0.025, "brillo": 0.42}
    p["ajustes"] = {**trailer["ajustes"], "formato": "1280x720"}
    p["mundo"] = None
    k = {"escenas": [], "camara": [], "poses": [], "ojos": [], "matices": [], "textos": [], "audio": []}
    t0 = 0
    for s in TOMAS:
        esc = dict(s["escena"])
        k["escenas"].append({"id": nid(), "dur": s["dur"], "nombre": s["nombre"], "mobs": [], **esc})
        for c in s["cams"]:
            c = dict(c)
            k["camara"].append({"id": nid(), "tipo": "libre", "dur": c.pop("dur", s["dur"]), "desde": c["desde"], "hasta": c.pop("hasta", c["desde"]),
                                "curva": c.pop("curva", "lineal"), **{a: b for a, b in c.items() if a != "desde"}})
        k["poses"].append({"id": nid(), "pose": copy.deepcopy(reposo), "dur": s["dur"], "trans": 0, "curva": "natural", "corte": True})
        k["ojos"].append({"id": nid(), "cara": "neutral", "dur": s["dur"], "mx": 0, "my": 0})
        for tipo, ini, dur, inten in s["matices"]:
            k["matices"].append({"id": nid(), "tipo": tipo, "inicio": round(t0 + ini, 3), "dur": round(dur, 3), "intensidad": inten})
        for x in s["textos"]:
            k["textos"].append({"id": nid(), **x, "inicio": round(t0 + x.get("inicio", 0), 3)})
        t0 += s["dur"]
    ra = os.path.join(RAIZ, "agente", "roadster_audio.json")          # archivos ya generados (agente/roadster_audio.py)
    AUD = json.load(open(ra, encoding="utf-8")) if os.path.exists(ra) else {}
    boom = next(a for a in trailer["pistas"]["audio"] if a["texto"] == BOOM)
    mus = {"archivo": AUD[MUSICA[0]]} if MUSICA[0] in AUD else {}
    ini = {s["nombre"]: round(sum(x["dur"] for x in TOMAS[:i]), 3) for i, s in enumerate(TOMAS)}
    t_truco, t_titulo = ini["Truco 1: ventiladores"], ini["Título"]
    base_m = {"tipo": "musica", "texto": MUSICA[0], "durSfx": MUSICA[1], **mus}
    k["audio"].append({**base_m, "id": nid(), "inicio": 0, "desde": 3.0, "dur": round(t_truco - 16.0 + 0.4, 3), "vol": 0.42, "salida": 0.3})
    k["audio"].append({**base_m, "id": nid(), "inicio": round(t_truco - 16.0 + 0.15, 3), "desde": 0.15, "dur": round(56.4 - 0.15, 3), "vol": 0.5, "entrada": 0.3, "salida": 0.4})
    k["audio"].append({**base_m, "id": nid(), "inicio": round(t_titulo, 3), "desde": 51.6, "dur": round(t0 - t_titulo, 3), "vol": 0.5, "salida": 0.8})
    for texto, ini, dur, vol, tipo in SONIDOS:
        if texto == BOOM:
            k["audio"].append({**boom, "id": nid(), "inicio": ini, "vol": vol})
            continue
        arch = {"archivo": AUD[texto]} if texto in AUD else {}
        if arch and tipo == "voz" and os.path.exists(os.path.join(RAIZ, arch["archivo"][:-4] + ".json")):
            arch["alineacion"] = arch["archivo"][:-4] + ".json"          # para el lip-sync (visemas)
        if arch and tipo == "voz":
            d = dur_audio(arch["archivo"])
            if d:
                dur = round(d + 0.05, 3)
        if tipo == "voz":
            k["audio"].append({"id": nid(), "tipo": "voz", "texto": texto, "voz": VOZ, "modelo": "eleven_v3", "inicio": ini, "dur": dur, "vol": vol, **arch})
        else:
            k["audio"].append({"id": nid(), "tipo": "sfx", "texto": texto, "durSfx": max(0.5, min(22, dur)), "inicio": ini, "dur": dur, "vol": vol, **arch})
    p["pistas"] = k
    return p, t0


if __name__ == "__main__":
    p, total = armar()
    if len(sys.argv) > 1 and sys.argv[1] == "poses":
        for i, s in enumerate(TOMAS, 1):
            if not s["escena"].get("ocultar") and not s["escena"].get("negro"):
                print(json.dumps({"toma": i, "poses": s["poses"], "ojos": s["ojos"]}, ensure_ascii=False))
    else:
        ruta = os.path.join(RAIZ, "agente", "proyectos", "roadster.json")
        json.dump(p, open(ruta, "w", encoding="utf-8"), ensure_ascii=False)
        cortes, t = [], 0
        for s in TOMAS:
            cortes.append(f"{t:6.2f} {s['nombre']}")
            t += s["dur"]
        print("\n".join(cortes))
        print(json.dumps({"tomas": len(TOMAS), "duracion": round(total, 3), "sonidos": len(SONIDOS), "voces": sum(1 for s in SONIDOS if s[4] == "voz"),
                          "salto": {"despega": round(T_DESP, 3), "vuelo_s": round(T_VUELO, 3), "alcance_m": round(Z_ATERR - Z0, 2), "altura_max": round(Y0 + VY * VY / (2 * G), 2)}}))
