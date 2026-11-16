"""Corto épico "La noche en que llegaron" (Minecraft Animator): una historia con suspenso y clímax hecha con los mobs de la
biblioteca. La música es la del tráiler (ya en caché) usada desde el principio: 0–15 s casi en silencio y creciendo
(suspenso), golpe enorme en 15.0, energía hasta otro golpe en 52.5 y silencio después (el remate).

  python agente/epico.py            → agente/proyectos/epico.json   (luego: agente.py abrir '{"nombre": "epico"}')
  python agente/epico.py poses      → una línea JSON por toma para el comando `personaje` (poses y ojos de LTezla)

Orientación: LTezla en el origen mirando a +z. Los monstruos llegan por +z (el bosque oscuro), los aliados por −z.
"""
import copy
import json
import math
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
    return {"tipo": tipo, "n": n, "x": x, "z": z, "ancho": 1.6, "prof": 1.6, "semilla": n * 7 + round(x * 13 + z * 5) + len(tipo), **k}


def U(tipo, x, z, **k):
    return {"tipo": tipo, "n": 1, "x": round(x, 2), "z": round(z, 2), "fijo": True, "semilla": round(abs(x) * 31 + abs(z) * 17) + len(tipo), **k}


VERDE = dict(color="#0dbd14", color2="#18c91f", sombra="#021a08", sombra2="#06420f")
BLANCO = dict(color="#d8d3d2", color2="#efeaea", sombra="#3e3a3a", sombra2="#6a6464")
AMARILLO = dict(color="#faf90d", color2="#ffff2e", sombra="#b0400c", sombra2="#f2a018")


def T(texto, x, y, tam, estilo, dur, inicio=0.0, **k):
    return {"texto": texto, "x": x, "y": y, "tam": tam, "prof": 0.35, "relieve": 0.06, "espaciado": -0.04, "interlinea": 1.05,
            "dur": dur, "inicio": inicio, "anim": "golpe", **estilo, **k}


VOZ = "wXojZ3FhzsE0AumH6Oym"
TOMAS, SONIDOS = [], []        # sonidos: (texto, inicio absoluto, duración, volumen, tipo)
t_actual = 0.0
B = 60 / 128 * 4               # un compás de la música (1.875 s)


def toma(dur, nombre, escena, cams, poses=None, ojos=None, textos=(), matices=(), sonidos=()):
    global t_actual
    TOMAS.append(dict(dur=round(dur, 3), nombre=nombre, escena=escena, cams=cams, poses=poses or [["reposo", dur]],
                      ojos=ojos or [["neutral", dur]], textos=list(textos), matices=list(matices)))
    for s in sonidos:                                         # (texto, inicio relativo, dur, vol[, tipo])
        SONIDOS.append((s[0], round(t_actual + s[1], 3), s[2], s[3], s[4] if len(s) > 4 else "sfx"))
    t_actual += dur


DIA = dict(set="pradera", ambiente="atardecer", sat=1.3, calidez=4)
NOCHE = dict(set="noche", ambiente="noche", exp=0.75, luna=[55, 1.3], nubes=True)
# antorchas alrededor del lugar de la batalla (x, z relativos a LTezla): luz cálida que parpadea contra la noche azul
TORCHAS = [[-2.4, 1.6], [2.6, -1.4], [-3.6, -3.2], [3.4, 3.4], [0.4, -6.5], [6.2, 0.8], [-6.4, 2.2], [1.5, 6.5], [-1.2, -10], [7, -6], [-7.5, -6.5], [-4, 7]]
GATA = "siames"
HORDA_TIPOS = ["zombi", "esqueleto", "zombi", "aldeano_zombi", "creeper", "momia", "esqueleto", "zombi", "arana", "ahogado", "zombi",
               "esqueleto_glacial", "aldeano_zombi", "esqueleto", "zombi", "creeper", "bruja", "esqueleto_pantanoso", "zombi", "momia"]
ZVAR = ["desierto+armero", "pantano+librero", "taiga+herrero", "nieve+carnicero", "jungla+agricultor", "sabana+pescador"]


def horda(z0, filas=3, por_fila=10, sep=1.15, dir=180, vel=0.9, modo="caminar", desde=0, x0=0.0, **k):
    out = []
    for f in range(filas):
        for c in range(por_fila):
            i = desde + f * por_fila + c
            t = HORDA_TIPOS[i % len(HORDA_TIPOS)]
            x = x0 + (c - (por_fila - 1) / 2) * sep + (f % 2) * sep / 2
            extra = {"variante": ZVAR[i % len(ZVAR)]} if t == "aldeano_zombi" else {}
            out.append(U(t, x, z0 + f * 1.5 + ((c * 7) % 3) * 0.25, modo=modo, dir=dir, vel=vel + ((i * 3) % 5) * 0.05, **extra, **k))
    return out


# ═══════════ ACTO 1 · la calma (música casi en silencio) ═══════════
toma(3.2, "Amanecer en la pradera", dict(DIA, ocultar=True, fundido={"entra": 1.6}, dof=0.3,
     mobs=[U("oveja", -3 + i * 1.3, -3 - (i % 3) * 1.2, variante=v, modo="quieto", dir=(i * 61) % 360) for i, v in enumerate(["blanco", "rosa", "blanco", "gris_claro", "blanco", "cafe"])]
     + [U("caballo", 5, -9, variante="blanco", modo="caminar", dir=-80, vel=0.6), U("caballo", 7, -10, variante="castano", modo="caminar", dir=-80, vel=0.6),
        G("pollito", 3, -1, 1.5, modo="quieto", ancho=1.5, prof=1)]),
     [dict(desde=V(0, 16, 12, 0.8), hasta=V(10, 10, 9, 0.8), curva="suave", temblor=0.05)],
     sonidos=[("peaceful morning meadow ambience, soft birds chirping, gentle wind", 0, 6.2, 0.5)])

toma(3.0, "LTezla y su gata", dict(DIA, actor={"x": 0, "y": 0, "z": 0, "rot": 0}, dof=0.55,
     mobs=[U("gato", 0.95, -0.35, variante=GATA, modo="quieto", dir=-20, calmo=True), G("gallina", 2, 2.2, 2.0, modo="quieto", ancho=1.2, prof=0.8),
           U("oveja", -2.6, -2.5, variante="blanco", modo="quieto", dir=40, calmo=True)]),
     [dict(desde=V(30, 6, 3.4, 0.7), hasta=V(22, 5, 2.8, 0.75), curva="suave", temblor=0.05)],
     poses=[["sentado", 3.0]], ojos=[["feliz", 1.6, -0.4, -0.2], ["ojos_cerrados", 0.4], ["feliz", 1.0, 0.5, -0.3]])

# ═══════════ ACTO 2 · la amenaza (sube la música) ═══════════
toma(1.8, "El sol se va: la gata se levanta", dict(DIA, ambiente="lila", exp=0.6, ocultar=True, dof=0.8,
     mobs=[U("gato", 0, 0, variante=GATA, modo="quieto", dir=0, calmo=True, cabezaYaw=[[0, -30], [0.7, -30], [0.95, 0]])]),
     [dict(desde=V(150, 14, 2.3, 0.4), hasta=V(160, 12, 2.0, 0.4), temblor=0.05)],
     sonidos=[("deep ominous low drone, dark cinematic tension rising slowly", 0, 7.0, 0.55)])

toma(2.0, "Ojos en el bosque", dict(NOCHE, exp=0.68, ocultar=True, dof=0.4,
     mobs=[U("enderman", -2.5, 9, modo="quieto", dir=180, calmo=True), U("enderman", 3.4, 11, modo="quieto", dir=190, calmo=True),
           U("arana", 0.6, 7.5, modo="quieto", dir=180, calmo=True), U("arana", -4.6, 8.5, modo="quieto", dir=160, calmo=True)]),
     [dict(desde=V(180, 3, 2.5, 1.6), hasta=V(180, 2, 1.0, 1.6), temblor=0.08)])

toma(1.6, "Algo detrás de él", dict(NOCHE, exp=0.7, actor={"x": 0, "y": 0, "z": 0, "rot": 0}, dof=0.9,
     mobs=[U("creeper", -0.9, -3.2, modo="caminar", dir=10, vel=0.55, calmo=True)]),
     [dict(desde=V(-14, 1, 1.9, 1.55), hasta=V(-12, 1, 1.6, 1.55), temblor=0.06)],
     poses=[["reposo", 1.6]], ojos=[["neutral", 0.7, 0.3, 0], ["asustado", 0.9, -0.8, 0]],
     sonidos=[("minecraft creeper fuse hiss, close, tense", 1.0, 1.0, 0.7)])

toma(1.8, "La horda sale de la oscuridad", dict(NOCHE, exp=1.0, actor={"x": 0, "y": 0, "z": 0, "rot": 0}, dof=0.35,
     mobs=horda(5.0, filas=3, por_fila=11, vel=0.8) + [U("gato", 0.45, -0.7, variante=GATA, modo="quieto", dir=0)]
     + [U("enderman", -6, 11, modo="caminar", dir=180, vel=0.8), U("enderman", 6.5, 12, modo="caminar", dir=180, vel=0.8)]),
     [dict(desde=V(205, 14, 4.6, 1.3), hasta=V(200, 12, 5.2, 1.3), temblor=0.1)],
     poses=[["miedo", 1.8]], ojos=[["asustado", 1.8]],
     sonidos=[("[whispers] ...Nos encontraron.", 0.25, 1.4, 0.75, "voz"), ("crowd of zombies groaning in the dark, distant, menacing", 0, 2.2, 0.45)])

toma(1.6, "La espada", dict(NOCHE, exp=0.85, antorchas=TORCHAS, actor={"x": 0, "y": 0, "z": 0, "rot": 0}, objeto="diamond_sword", dof=1.0),
     [dict(desde=V(-30, 2, 2.2, 1.55), hasta=V(-36, 1, 1.45, 1.62), temblor=0.12)],
     poses=[["miedo", 0.55], ["guardia_espada", 1.05, {"trans": 0.25}]], ojos=[["asustado", 0.5], ["determinado", 1.1, 0, 0, {"aCamara": True}]],
     sonidos=[("sword being drawn, metallic ring", 0.45, 1.0, 0.8), ("[shouting] ¡AHORA!", 1.05, 0.8, 0.9, "voz")])

# ═══════════ ACTO 3 · la batalla (golpe en 15.0: compases de 1.875 s) ═══════════
toma(B, "¡Caen los gólems!", dict(NOCHE, exp=1.0, actor={"x": 0, "y": 0, "z": 0, "rot": 0}, objeto="diamond_sword", dof=0.2,
     mobs=[U("golem_hierro", -2.3, -2.2, modo="caer", gira=False, altura=3, dir=0), U("golem_hierro", 2.4, -2.0, modo="caer", gira=False, altura=4.5, dir=0),
           U("golem_hierro", 0.1, -3.6, modo="caer", gira=False, altura=6, dir=0), U("golem_nieve", -4, -1, modo="caer", gira=False, altura=7, dir=10),
           U("golem_nieve", 4.2, -1.2, modo="caer", gira=False, altura=8, dir=-10)], antorchas=TORCHAS),
     [dict(desde=V(0, -4, 5.0, 2.0, tilt=-4), hasta=V(0, -4, 5.6, 2.0, tilt=-4), temblor=0.6)],
     poses=[["guardia_espada", B]], ojos=[["determinado", B]],
     sonidos=[("massive heavy iron golem landing, ground impact thud, debris", 0.25, 1.6, 0.9)])

toma(B, "Los lobos", dict(NOCHE, exp=1.0, ocultar=True, dof=0.25,
     mobs=[U("lobo", -1.0, -6, armadura="#ff86b8", modo="correr", dir=0, vel=6.0), U("lobo", 1.1, -7.2, armadura="#a99cff", modo="correr", dir=0, vel=6.2),
           U("lobo", -2.8, -8.2, armadura="#7ff0ff", modo="correr", dir=5, vel=5.8), U("lobo", 2.8, -9.0, modo="correr", dir=-5, vel=6.0),
           U("lobo", 0.2, -10.5, armadura="#ffd84a", modo="correr", dir=0, vel=6.1)]),
     [dict(desde=V(0, 4, 3.0, 0.3, tilt=2), hasta=V(0, 4, 3.0, 0.3, tilt=2), temblor=0.5)],
     sonidos=[("pack of wolves howling together, epic", 0.0, 1.9, 0.7)])

toma(B, "La caballería", dict(NOCHE, exp=1.0, ocultar=True, dof=0.2,
     mobs=[U("caballo", -4.5 + i * 1.5, -9 - (i % 2) * 1.6, variante=v, modo="correr", dir=0, vel=6.5) for i, v in
           enumerate(["blanco+manchas_blancas", "negro+patas_blancas", "castano", "crema", "cafe_oscuro+puntos_blancos", "gris"])]
     + [U("caballo_esqueleto", 4.6, -12, modo="correr", dir=0, vel=6.5)]),
     [dict(desde=V(0, -5, 4.2, 1.2, tilt=-3), hasta=V(0, -5, 4.6, 1.2, tilt=-3), temblor=0.55)],
     sonidos=[("horses galloping stampede approaching fast", 0.0, 1.9, 0.7)])

toma(B, "Refuerzos del cielo", dict(NOCHE, exp=1.0, actor={"x": 0, "y": 0, "z": 0, "rot": 0}, objeto="diamond_sword", luna=[80, 1.4], dof=0.2,
     mobs=[U("ghast_feliz", -3, -7, modo="flotar", y=6, dir=20, vel=1.2), G("cubito", 3, 4, -5, color="verde", modo="flotar", y=4, vel=1.2, dir=20, ancho=3),
           U("cubito", -5, -4, color="morado", modo="flotar", y=3.2, vel=1.3, dir=30)]
     + [U("loro", -3 + i * 1.3, -2 - (i % 2), variante=v, modo="caminar", dir=10, vel=2.2, y=2.6) for i, v in enumerate(["rojo", "azul", "verde", "cian", "gris"])]
     + [G("allay", 3, 1.5, -3, modo="caminar", dir=0, vel=1.6, y=2.2)]),
     [dict(desde=V(15, -12, 4.4, 2.6, tilt=9), hasta=V(25, -14, 4.8, 2.9, tilt=11), temblor=0.15)],
     poses=[["senalar_arriba", B]], ojos=[["emocionado", B, 0, 0.7]])

# el choque: los aliados (−z) y los monstruos (+z) corren y se encuentran en z ≈ 0
ALIADOS_CARGA = ([U("golem_hierro", -3 + i * 2, -7 - (i % 2), modo="correr", dir=0, vel=3.4, parar=1.45) for i in range(4)]
                 + [U("lobo", -4 + i * 1.6, -6, armadura=["#ff86b8", "#a99cff", "#7ff0ff", "#ffd84a", "#ffffff", "#ff5050"][i], modo="correr", dir=0, vel=4.2, parar=1.3) for i in range(6)]
                 + [U("caballo", -5 + i * 2.5, -9.5, variante=v, modo="correr", dir=0, vel=4.6, parar=1.5) for i, v in enumerate(["blanco", "negro", "castano", "crema", "gris"])])
toma(B, "El choque", dict(NOCHE, exp=1.05, ocultar=True, dof=0.1,
     mobs=[dict(m, accion={"tipo": "atacar", "en": 1.35, "cada": 0.5, "veces": 2}) for m in ALIADOS_CARGA]
     + horda(4.5, filas=2, por_fila=10, sep=1.2, vel=2.8, modo="correr", parar=1.45, accion={"tipo": "atacar", "en": 1.4, "cada": 0.55, "veces": 2}), antorchas=TORCHAS),
     [dict(desde=V(90, 22, 15, 0.8), hasta=V(96, 18, 12.5, 0.8), temblor=0.3)],
     sonidos=[("epic battle clash, crowd charging, impacts", 1.3, 1.6, 0.8)])

toma(B, "LTezla en medio de la batalla", dict(NOCHE, exp=1.05, actor={"x": 0, "y": 0, "z": 0, "rot": 0}, objeto="diamond_sword", dof=0.4,
     mobs=[U(t, 3.0 * math.sin(a), 3.0 * math.cos(a), modo="caminar", dir=round(math.degrees(math.atan2(-math.sin(a), -math.cos(a)))), vel=0.5, parar=0.6, accion={"tipo": "atacar", "en": 0.5 + (round(a * 10) % 4) * 0.15, "cada": 0.7, "veces": 2})
           for t, a in zip(["zombi", "esqueleto", "zombi", "aldeano_zombi", "momia", "zombi"], [0.3, 1.2, 2.3, 3.6, 4.6, 5.5])]
     + [U("golem_hierro", -3.2, -2.4, modo="quieto", dir=60, accion={"tipo": "atacar", "en": 0.3, "cada": 0.8, "veces": 2})], antorchas=TORCHAS),
     [dict(desde=V(-35, 10, 2.5, 1.2), hasta=V(35, 10, 2.4, 1.2), curva="suave", temblor=0.25)],
     poses=[["guardia_espada", 0.3], ["espada_atras", 0.35, {"trans": 0.18}], ["espada_golpe", 0.35, {"trans": 0.07}], ["espada_atras", 0.3, {"trans": 0.15}], ["estocada", 0.575, {"trans": 0.08}]],
     ojos=[["furioso", B]], matices=[["agitado", 0, B, 0.8]])

toma(B, "La gata contra los creepers", dict(NOCHE, exp=1.05, ocultar=True, dof=0.35,
     mobs=[U("gato", 0, -2.5, variante=GATA, modo="correr", dir=0, vel=3.2, parar=0.9)]
     + [U("creeper", -1.6 + i * 1.1, 2.6 + (i % 2) * 0.7, modo="correr", dir=180, vel=3.6, rumbo=[[0, 180], [0.55, 180], [0.85, 0]], retraso=0.1) for i in range(4)]),
     [dict(desde=V(80, 8, 6.4, 0.6), hasta=V(88, 8, 6.8, 0.6), temblor=0.25)],
     sonidos=[("angry cat hiss", 0.5, 0.8, 0.8)])

toma(B, "Gólem contra devastador", dict(NOCHE, exp=1.05, ocultar=True, dof=0.3,
     mobs=[U("golem_hierro", -1.8, 0, modo="caminar", dir=90, vel=1.2, parar=0.6, accion={"tipo": "atacar", "en": 0.65, "cada": 0.6, "veces": 2}),
           U("devastador", 2.4, 0.2, modo="caminar", dir=-90, vel=1.5, accion={"tipo": "embestir", "en": 0.7}),
           G("vindicador", 3, 4, 3, modo="caminar", dir=-120, vel=1.0, objeto="iron_axe", accion={"tipo": "atacar", "en": 0.8, "cada": 0.6, "veces": 2}), U("lobo", -3.5, 2, armadura="#ff86b8", modo="correr", dir=60, vel=3)], antorchas=TORCHAS),
     [dict(desde=V(0, 10, 7.5, 1.3), hasta=V(6, 9, 6.6, 1.3), temblor=0.45)],
     sonidos=[("two giants colliding, heavy body slam impact", 0.85, 1.0, 0.85)])

# el giro: aparece el warden
toma(B, "Silencio: algo viene", dict(NOCHE, exp=1.0, ocultar=True, dof=0.5,
     mobs=[U("warden", 0, 6.5, modo="caminar", dir=180, vel=0.6)] + horda(2.5, filas=1, por_fila=8, sep=1.5, vel=3.2, modo="correr", dir=180)),
     [dict(desde=V(180, 2, 4.5, 1.8, tilt=-4), hasta=V(180, 1, 3.8, 2.0, tilt=-6), temblor=0.7)],
     sonidos=[("deep monstrous warden roar, sonic boom rumble, terrifying", 0.3, 1.6, 0.95)])

toma(B, "Frente a frente", dict(NOCHE, exp=1.05, actor={"x": 0, "y": 0, "z": 0, "rot": 0}, objeto="diamond_sword", dof=0.25,
     mobs=[U("warden", 0, 5.2, modo="caminar", dir=180, vel=0.45), U("gato", -0.5, -0.6, variante=GATA, modo="quieto", dir=0)], antorchas=TORCHAS),
     [dict(desde=V(90, 3, 8.0, 1.8, pan=16), hasta=V(90, 3, 7.6, 1.8, pan=16), temblor=0.2)],
     poses=[["guardia_espada", B]], ojos=[["asustado", B, 0, 0.3]],
     sonidos=[("heavy slow footsteps of a giant, heartbeat", 0, 1.9, 0.7)])

toma(B, "Retrocede", dict(NOCHE, exp=1.05, actor={"x": 0, "y": 0, "z": 0, "rot": 0}, actorHasta={"x": 0, "y": 0, "z": -0.9, "rot": 0}, objeto="diamond_sword", dof=1.0,
     mobs=[U("warden", 0.3, 3.4, modo="caminar", dir=180, vel=0.5, accion={"tipo": "atacar", "en": 1.2, "veces": 1})], antorchas=TORCHAS),
     [dict(desde=V(-155, 10, 3.6, 2.0), hasta=V(-160, 8, 3.2, 2.0), temblor=0.15)],
     poses=[["guardia_espada", B]], ojos=[["asustado", 1.1], ["triste", 0.775]], matices=[["caminar_atras", 0, B, 1]])

# todos se ponen detrás de él
DETRAS = ([U("golem_hierro", -2.4 + i * 1.6, -2.2 - (i % 2) * 0.4, modo="caminar", dir=0, vel=0.7) for i in range(4)]
          + [U("lobo", -1.8 + i * 0.9, -1.0, armadura=["#ff86b8", "#a99cff", "#7ff0ff", "#ffd84a", "#ff5050"][i], modo="caminar", dir=0, vel=0.7) for i in range(5)]
          + [U("gato", 0.5, -0.4, variante=GATA, modo="caminar", dir=0, vel=0.6)]
          + [U(t, -5 + i * 1.25, -3.8, modo="caminar", dir=0, vel=0.7, **({"variante": v} if v else {})) for i, (t, v) in
             enumerate([("aldeano", None), ("granjero", None), ("caballo", "blanco"), ("golem_nieve", None), ("llama", None), ("cabra", None), ("caballo", "negro"), ("golem_nieve", None), ("comerciante", None)])]
          + [U("ghast_feliz", 1, -9, modo="flotar", y=5, dir=0, vel=0.5)])
toma(B, "No está solo", dict(NOCHE, exp=1.0, actor={"x": 0, "y": 0, "z": 0, "rot": 0}, objeto="diamond_sword", dof=0.25, mobs=DETRAS, antorchas=TORCHAS),
     [dict(desde=V(0, 2, 4.5, 1.4), hasta=V(0, 10, 7.5, 1.6), curva="suave", temblor=0.15)],
     poses=[["guardia_espada", 0.6], ["victoria_espada", 1.275, {"trans": 0.4}]], ojos=[["sorprendido", 0.6, 0, 0], ["determinado", 1.275, 0, 0, {"aCamara": True}]])

toma(2 * B, "¡Todos juntos!", dict(NOCHE, exp=1.05, actor={"x": 0, "y": 0, "z": 0, "rot": 0}, actorHasta={"x": 0, "y": 0, "z": 7.5, "rot": 0}, objeto="diamond_sword", dof=0.2, antorchas=TORCHAS,
     mobs=[dict(m, modo="correr", vel=2.1) for m in DETRAS if m["tipo"] != "ghast_feliz"] + [U("ghast_feliz", 1, -6, modo="flotar", y=5, dir=0, vel=2.0)]
     + [U("caballo", -6 + i * 3, -6, variante=v, modo="correr", dir=0, vel=2.3) for i, v in enumerate(["crema", "gris+puntos_negros", "castano", "cafe+patas_blancas", "blanco"])]),
     [dict(desde=V(0, 4, 4.2, 1.2), hasta=V(0, 4, 4.2, 1.2), temblor=0.6, fija=False)],
     poses=[["correr", 2 * B]], ojos=[["furioso", 2 * B]], matices=[["correr", 0, 2 * B, 1]],
     sonidos=[("huge army battle cry charging, epic", 0.1, 3.0, 0.8)])

# la gran batalla desde arriba: todo el mundo converge, el dragón pasa encima
GRANDE = horda(6, filas=4, por_fila=12, sep=1.2, vel=2.4, modo="correr", parar=1.8, accion={"tipo": "atacar", "en": 1.9, "cada": 0.6, "veces": 3})
GRANDE += [U(t, -9 + (i % 12) * 1.6, -7 - (i // 12) * 1.6, modo="correr", dir=0, vel=2.6, parar=1.9, accion={"tipo": "atacar", "en": 2.0, "cada": 0.6, "veces": 3}, **({"variante": v} if v else {}),
             **({"armadura": "#ff86b8"} if t == "lobo" else {}))
           for i, (t, v) in enumerate([("golem_hierro", None), ("lobo", None), ("caballo", "blanco"), ("golem_nieve", None), ("lobo", None), ("caballo", "negro"),
                                       ("golem_hierro", None), ("gato", GATA), ("aldeano", None), ("llama", None), ("golem_cobre", "oxidado"), ("lobo", None)] * 3)]
GRANDE += [U("dragon_ender", -22, 2, modo="caminar", dir=90, vel=11, y=8), U("warden", 0, 11, modo="caminar", dir=180, vel=0.8)]
toma(2 * B, "La gran batalla", dict(NOCHE, exp=1.05, ocultar=True, dof=0.05, mobs=GRANDE, antorchas=TORCHAS),
     [dict(desde=V(70, 26, 17, 0), hasta=V(105, 34, 20, 0), curva="suave", temblor=0.2)])

toma(B, "El salto", dict(NOCHE, exp=1.3, actor={"x": 0, "y": 0, "z": 0, "rot": 0}, actorHasta={"x": 0, "y": 1.6, "z": 1.6, "rot": 0}, objeto="diamond_sword", luna=[110, 1.2], dof=0.3,
     mobs=[U("warden", 0, 4.8, modo="quieto", dir=180)], antorchas=TORCHAS),
     [dict(desde=V(-150, -12, 4.6, 2.6, tilt=-10), hasta=V(-160, -16, 4.0, 3.0, tilt=-14), temblor=0.3)],
     poses=[["espada_atras", 1.0], ["espada_golpe", 0.875, {"trans": 0.08}]], ojos=[["furioso", B]],
     sonidos=[("whoosh of a sword swing in slow motion", 0.7, 1.0, 0.8)])

toma(B, "Todos atacan", dict(NOCHE, exp=1.05, ocultar=True, dof=0.25,
     mobs=[U("warden", 0, 0, modo="quieto", dir=180, accion={"tipo": "atacar", "en": 0.2, "cada": 0.8, "veces": 2})]
     + [U("lobo", 3.2 * math.sin(a), 3.2 * math.cos(a), armadura="#a99cff", modo="lanzar", vy=6, dir=round(math.degrees(math.atan2(-math.sin(a), -math.cos(a)))))
        for a in (2.4, 3.2, 4.0)]
     + [U("golem_hierro", -2.4, -2.4, modo="caminar", dir=45, vel=1.5, parar=0.4, accion={"tipo": "atacar", "en": 0.45, "cada": 0.55, "veces": 3}),
        U("golem_hierro", 2.4, -2.4, modo="caminar", dir=-45, vel=1.5, parar=0.4, accion={"tipo": "atacar", "en": 0.6, "cada": 0.55, "veces": 3})], antorchas=TORCHAS),
     [dict(desde=V(180, 6, 7.5, 1.6), hasta=V(195, 8, 6.5, 1.6), temblor=0.5)],
     sonidos=[("multiple heavy impacts, warden groan", 0.5, 1.4, 0.85)])

toma(B, "Huyen", dict(NOCHE, exp=1.1, ocultar=True, dof=0.15,
     mobs=[U("warden", 0, 2, modo="caminar", dir=0, vel=1.2)] + horda(-1, filas=2, por_fila=10, sep=1.3, dir=0, vel=4.0, modo="correr")),
     [dict(desde=V(180, 8, 6.0, 1.2), hasta=V(180, 10, 9.0, 1.2), temblor=0.35)])

toma(B, "Amanece", dict(DIA, ambiente="atardecer", exp=1.0, actor={"x": 0, "y": 0, "z": 0, "rot": 180}, objeto="diamond_sword", dof=0.3,
     mobs=[U("golem_hierro", -2.2, -1, modo="quieto", dir=180), U("golem_hierro", 2.2, -1, modo="quieto", dir=180), U("gato", 0.6, -0.4, variante=GATA, modo="quieto", dir=180),
           U("lobo", -1.0, -0.8, armadura="#ff86b8", modo="quieto", dir=180, accion={"tipo": "aullar", "en": 0.4, "dur": 1.3, "sentarse": True}),
           U("lobo", 1.2, -1.2, armadura="#a99cff", modo="quieto", dir=180, accion={"tipo": "aullar", "en": 0.5, "dur": 1.2, "sentarse": True})]),
     [dict(desde=V(170, 0, 5.5, 1.6, tilt=4), hasta=V(176, 0, 4.8, 1.8, tilt=4), temblor=0.15)],
     poses=[["guardia_espada", 0.7], ["victoria_espada", 1.175, {"trans": 0.35}]], ojos=[["determinado", 0.7], ["muy_feliz", 1.175]])

# ═══════════ ACTO 4 · todos (golpe en 52.5) y el remate ═══════════
idx = json.load(open(os.path.join(RAIZ, "texturas_mc", "biblioteca", "indice.json"), encoding="utf-8"))
ALTO = {m["id"]: m["tam"][1] * (m.get("escala") or 1) for m in idx["mobs"]}
AMIGOS = ["pollito", "gato", "conejo", "rana", "zorro", "ajolote", "armadillo", "cordero", "cabrito", "aldeanito", "lobo", "ocelote", "gallina",
          "golem_cobre", "cerdo", "oveja", "cabra", "vaca", "champinaca", "panda", "tortuga", "aldeano", "granjero", "comerciante", "llama",
          "llama_comerciante", "burro", "mula", "caballo", "oso_polar", "golem_nieve", "sniffer", "camello", "golem_hierro", "strider",
          "loro", "abeja", "allay"]
VAR4 = {"gato": GATA, "conejo": "dorado", "rana": "calida", "zorro": "nieve", "ajolote": "cian", "oveja": "rosa", "vaca": "fria", "cerdo": "calida",
        "panda": "jugueton", "caballo": "blanco+manchas_blancas", "golem_cobre": "expuesto", "loro": "azul", "champinaca": "cafe", "llama": "blanca"}
AMIGOS.sort(key=lambda t: ALTO.get(t, 1))
FINAL = []
k = 0
for anillo, (r, n) in enumerate([(2.2, 9), (3.6, 13), (5.2, 17)]):
    angs = [a for a in (2 * math.pi * (j + 0.5 * (anillo % 2)) / n for j in range(n)) if abs(math.remainder(a, 2 * math.pi)) > 0.45]   # pasillo hacia la cámara
    for a in angs:
        if k >= len(AMIGOS):
            break
        t = AMIGOS[k]
        k += 1
        x, z = r * math.sin(a), r * math.cos(a)
        vuela = t in ("loro", "abeja", "allay")
        FINAL.append(U(t, x, z, modo="quieto", calmo=True, dir=round(math.degrees(math.atan2(-x, -z))), **({"variante": VAR4[t]} if t in VAR4 else {}),
                       **({"y": 2.4} if vuela else {}), **({"armadura": "#ff86b8"} if t == "lobo" else {})))
FINAL += [U("ghast_feliz", -4, -12, modo="flotar", y=6, dir=20), G("cubito", 3, 5, -9, color="rosa", modo="flotar", y=3.5, ancho=3)]
toma(4.5, "Todos juntos al amanecer", dict(DIA, ambiente="atardecer", actor={"x": 0, "y": 0, "z": 0, "rot": 0}, objeto="diamond_sword", dof=0.15, mobs=FINAL),
     [dict(desde=V(0, 6, 3.0, 1.3), hasta=V(60, 34, 14.5, 0.8), curva="suave", temblor=0.08)],
     poses=[["victoria_espada", 4.5]], ojos=[["muy_feliz", 4.5, 0, 0, {"aCamara": True}]],
     sonidos=[("peaceful morning meadow ambience, soft birds chirping, gentle wind", 1.5, 6.0, 0.4)])

toma(3.4, "El creeper", dict(DIA, ambiente="atardecer", actor={"x": 0, "y": 0, "z": 0, "rot": 0}, dof=0.35,
     mobs=[U("creeper", 1.7, -2.9, modo="caminar", dir=-11, vel=0.55, parar=1.2, rumbo=[[0, -11], [1.6, -11], [1.85, 169]]),
           U("gato", 1.0, 0.2, variante=GATA, modo="quieto", dir=110, cabezaYaw=[[0, 0], [1.1, 0], [1.3, -70]], accion={"tipo": "sacudirse", "en": 1.4, "dur": 0.4}),
           U("golem_hierro", -2.2, -1.5, modo="quieto", dir=40, calmo=True), U("lobo", -1.1, 0.8, armadura="#a99cff", modo="quieto", dir=60, calmo=True)]),
     [dict(desde=V(25, 4, 4.6, 0.9), hasta=V(30, 4, 4.4, 0.9), temblor=0.05)],
     poses=[["sentado", 1.6], ["risa_atras", 1.8, {"trans": 0.3}]], ojos=[["sorprendido", 1.6, 0.8, 0], ["riendo", 1.8]],
     sonidos=[("minecraft creeper fuse hiss, close, tense", 1.1, 1.0, 0.6), ("angry cat hiss", 1.4, 0.8, 0.8),
              ("cartoon quick scurry footsteps running away", 1.85, 1.0, 0.6), ("[laughs] Jajaja... [laughs harder] jajajaja, ay...", 2.0, 1.4, 0.7, "voz")])

FIN = dict(fundido={"entra": 0.6, "sale": 1.2}, anim="aparecer", deriva=0)
toma(6.0, "Título", dict(negro=True), [dict(desde=V(0, 4, 4, 1.1))],
     textos=[T("MINECRAFT", 0.5, 0.33, 12.5, BLANCO, 5.6, 0.3, giro=[-14, 0, 0], **FIN),
             T("ANIMATOR", 0.5, 0.47, 8.6, VERDE, 5.45, 0.45, espaciado=0.08, **FIN),
             T("UNA HISTORIA HECHA CON 92 MOBS", 0.5, 0.63, 3.0, AMARILLO, 4.9, 1.0, prof=0.12, relieve=0.03, **FIN)])

BOOM = "short deep cinematic boom impact with a quick whoosh, trailer hit"
GOLPES = [15.0, 30.0, 37.5, 45.0, 52.5]


def armar():
    base = json.load(open(os.path.join(RAIZ, "agente", "proyectos", "epico_base.json"), encoding="utf-8"))
    trailer = json.load(open(os.path.join(RAIZ, "proyectos", "trailer-bobicraft-ltezla.json"), encoding="utf-8"))   # solo lectura
    reposo = copy.deepcopy(base["pistas"]["poses"][0]["pose"])
    p = copy.deepcopy(base)
    p["nombre"] = "La noche en que llegaron"
    p["escena"] = copy.deepcopy(trailer["escena"])
    p["efectos"] = {**copy.deepcopy(trailer["efectos"]), "vineta": 0.3, "grano": 0.03}
    p["ajustes"] = {**trailer["ajustes"], "formato": "1280x720"}
    p["mundo"] = None
    k = {"escenas": [], "camara": [], "poses": [], "ojos": [], "matices": [], "textos": [], "audio": []}
    t0 = 0
    for s in TOMAS:
        esc = dict(s["escena"])
        if esc.get("luna") and "cielo" not in esc:          # la cámara mira hacia az + 180: la luna un poco a un lado, arriba
            c0 = s["cams"][0]["desde"]
            esc["cielo"] = [round((esc.get("actor", {}).get("rot", 0) + c0["az"] + 180 + 22) % 360), 14 + max(0, -c0["el"])]
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
    musica = next(a for a in trailer["pistas"]["audio"] if a["tipo"] == "musica")
    boom = next(a for a in trailer["pistas"]["audio"] if a["texto"] == BOOM)
    k["audio"].append({**musica, "id": nid(), "desde": 0, "inicio": 0, "dur": 56.0, "vol": 0.85, "salida": 1.0})
    for g in GOLPES:
        k["audio"].append({**boom, "id": nid(), "inicio": round(g - 0.05, 3), "vol": 0.85})
    ra = os.path.join(RAIZ, "agente", "epico_audio.json")          # archivos ya generados (agente/epico_audio.py)
    AUD = json.load(open(ra, encoding="utf-8")) if os.path.exists(ra) else {}
    for texto, ini, dur, vol, tipo in SONIDOS:
        arch = {"archivo": AUD[texto]} if texto in AUD else {}
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
        ruta = os.path.join(RAIZ, "agente", "proyectos", "epico.json")
        json.dump(p, open(ruta, "w", encoding="utf-8"), ensure_ascii=False)
        cortes, t = [], 0
        for s in TOMAS:
            cortes.append(f"{t:6.2f} {s['nombre']}")
            t += s["dur"]
        print("\n".join(cortes))
        print(json.dumps({"tomas": len(TOMAS), "duracion": round(total, 3), "mobs": sum(sum(m.get("n", 1) for m in s["escena"].get("mobs", [])) for s in TOMAS),
                          "sonidos": len(SONIDOS)}))
