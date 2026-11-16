"""Estilo nuevo del can-can: filtros de Minecraft, impact frames, cambio de paleta y partículas (prueba del coro).

    python agente/cancan/estilo.py [desde hasta]   → agente/proyectos/agente-cancan.json + estilo_golpes.json

Por defecto arma la prueba del coro en sol: compases 40–55 (31.2–44.0 s de la canción). El tiempo 0 del proyecto es
`desde` (el audio se recorta con "desde"). Cada 2 compases (1.6 s) hay una toma nueva que entra con un impact frame de
2 cuadros, otra paleta del mundo, otro cielo y otro filtro de Minecraft.

Escena: LTezla baila el can-can (patadas alternadas en cada negra) en el centro de un llano. Cada nota de la melodía pone
su bloque musical en una espiral que se abre hacia afuera (una vuelta cada 2 compases, la altura = el tono) y el bajo
llena un anillo cerca de él. Las notas sueltan su corchea de Minecraft (efecto `notas`) y los golpes fuertes, pedazos
de bloque (efecto `fragmentos`).
"""
import copy, json, math, sys
from pathlib import Path

import video as V

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parents[1]
FPS = 30
COMPAS = 0.8                                   # 2/4 a 150 bpm
NEGRA = 0.4
DESDE, HASTA = (float(sys.argv[1]), float(sys.argv[2])) if len(sys.argv) > 2 else (31.2, 44.0)
VUELTA = 2 * COMPAS                            # una vuelta de la espiral = una frase de 2 compases

# una toma por frase: paleta del mundo, cielo, filtro, cámara (az0, az1, el, dist, ty) y color del impact frame
TOMAS = [
# (cámaras: o muy cerca, dentro del anillo libre de r < 6, o lejos y alto por encima de la espiral; ronda 1 la cámara
# quedaba entre los bloques y tapaba a LTezla)
    dict(paleta="rosa", amb="rosa", filtro=None, cam=(20, 48, 8, 4.2, 1.2), imp="#ff7ac0"),
    dict(paleta="azul", amb="noche", filtro="deconverge", cam=(120, 150, 40, 26, 1.5), imp="#6fb0ff"),
    dict(paleta="oro", amb="dorado", filtro="bits", cam=(-40, -12, 12, 5.0, 1.2), imp="#ffd23a"),
    dict(paleta="verde", amb="dia", filtro="creeper", cam=(-70, -40, 10, 5.5, 1.1), imp="#4dff6a"),
    dict(paleta="end", amb="lila", filtro="sobel", cam=(0, 200, 34, 18, 1.5), imp="#f3f0a0", totem=True),
    dict(paleta="nether", amb="nether", filtro=None, cam=(95, 70, 16, 27, 2.0), imp="#ff5a3a"),
    dict(paleta="prismarina", amb="atardecer", filtro="ntsc", cam=(180, 240, 62, 28, 1.0), imp="#6ff0d0"),
    dict(paleta="lila", amb="lila", filtro="spider", cam=(270, 300, 10, 4.5, 1.2), imp="#d6a6ff"),
]

# patadas del can-can: pierna estirada arriba, manos en la cintura, un saltito
def patada(lado):
    s = "D" if lado == "D" else "I"
    o = "I" if lado == "D" else "D"
    return {"nombre": f"Patada can-can {s}", "cat": "Baile", "id": "patada", "p": [0, 1.2, 0],
            "r": {f"pierna{s}": [-118, 0, 0], f"rodilla{s}": [0, 0, 0], f"pierna{o}": [6, 0, 0], f"rodilla{o}": [10, 0, 0],
                  "torso": [-10, 0, 0], "cabeza": [-10, 0, 0], "brazoD": [0, 0, -38], "codoD": [-95, 0, 0],
                  "brazoI": [0, 0, 38], "codoI": [-95, 0, 0]}}


PARADO = {"nombre": "Can-can parado", "cat": "Baile", "id": "reposo", "p": [0, 0, 0],
          "r": {"rodillaD": [18, 0, 0], "rodillaI": [18, 0, 0], "piernaD": [-8, 0, 0], "piernaI": [-8, 0, 0],
                "brazoD": [0, 0, -38], "codoD": [-95, 0, 0], "brazoI": [0, 0, 38], "codoI": [-95, 0, 0]}}


def golpes_espiral(eventos):
    """bloques en tiempo de la canción: melodía en espiral (radio crece por vuelta, altura = tono), bajo en un anillo"""
    gs, ocup = [], set()
    for e in eventos:
        t = e["t"]
        if t < DESDE - 1e-6 or t >= HASTA - 1e-6:
            continue
        u = (t - DESDE) / VUELTA
        vuelta, frac = int(u), u - int(u)
        if e["pista"] == "bajo":                 # anillo del bajo: siempre los mismos bloques (no se apilan entre vueltas)
            r, y = 3.5, 0
        else:
            r = 6.5 + 1.5 * vuelta + (0.7 if e["pista"] == "campana" else 0)
            y = min(5, max(0, (e["midi"] - 62) // 4))
        ang = 2 * math.pi * frac + math.pi / 2
        x, z = round(r * math.cos(ang)), round(r * math.sin(ang))
        while e["pista"] != "bajo" and (x, y, z) in ocup:     # acorde: el bloque de la segunda nota va encima
            y += 1
        ocup.add((x, y, z))
        gs.append([round(t, 4), x, y, z, e["clics"], e["pista"]])
    gs.sort(key=lambda g: g[0])
    return gs


def main():
    ev = json.loads(V.EVENTOS.read_text(encoding="utf-8"))["eventos"]
    gs = golpes_espiral(ev)
    (AQUI / "estilo_golpes.json").write_text(json.dumps({"golpes": [g[:5] for g in gs]}), encoding="utf-8")
    base = json.loads((RAIZ / "agente" / "proyectos" / "epico_base.json").read_text(encoding="utf-8"))
    trailer = json.loads((RAIZ / "proyectos" / "trailer-bobicraft-ltezla.json").read_text(encoding="utf-8"))  # sólo lectura
    p = copy.deepcopy(base)
    p["nombre"] = "Can-can en bloques · prueba de estilo (coro)"
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

    dur_total = round(round((HASTA - DESDE) * FPS) / FPS, 4)
    cortes = [DESDE + i * VUELTA for i in range(int(round((HASTA - DESDE) / VUELTA)) + 1)]
    cortes[-1] = HASTA
    impactos = []
    for i, (a, b) in enumerate(zip(cortes, cortes[1:])):
        T = TOMAS[i % len(TOMAS)]
        tc = round(round(a * FPS) / FPS, 4)
        d = round(round(b * FPS) / FPS - tc, 4)
        az0, az1, el, dist, ty = T["cam"]
        # bloques golpeados en esta frase: los fuertes (tiempos 1 del compás) sueltan pedazos
        fuertes = [g for g in gs if a - 1e-6 <= g[0] < b - 1e-6 and abs((g[0] - DESDE) / COMPAS - round((g[0] - DESDE) / COMPAS)) < 0.02]
        frag = [[g[0], g[1], g[2], g[3], 10 if g[5] != "bajo" else 5] for g in fuertes]
        # en el corte: los últimos bloques puestos estallan con el impacto
        previos = [g for g in gs if g[0] < a - 1e-6][-14:]
        frag = sorted([[tc, g[1], g[2], g[3], 8] for g in previos] + frag, key=lambda f: f[0])
        ef = [
            {"tipo": "notas", "archivo": f"{V.REL}/estilo_golpes.json", "construye": True, "tam": 0.6, "pulso": 0.2, "vida": 0.8,
             "tenue": 0.12, "desfase": tc},
            {"tipo": "paleta", "cambios": [[0, T["paleta"]]]},
            {"tipo": "impacto", "golpes": [[0, T["imp"], 0.5, 0.46]], "cuadros": 2, "pixel": 6},
            {"tipo": "fragmentos", "golpes": frag, "desfase": tc, "vel": 6, "vida": 0.9, "tam": 0.2},
        ]
        if T["filtro"]:
            ef.append({"tipo": "filtro", "cambios": [[0, None], [2 / FPS, T["filtro"], 1]]})
        if T.get("totem"):                          # el tótem de la inmortalidad: estallido verde y amarillo
            ef.append({"tipo": "particulas", "estilo": "destellos", "pos": [0, 1.2, 0], "dir": [0, 1, 0], "abre": 180, "vel": 7,
                       "vida": 1.4, "tam": 0.16, "g": -4, "arrastre": 1.2, "color": [1.2, 2.6, 0.4], "color2": [2.6, 2.2, 0.3],
                       "rafaga": {"t": 2 / FPS, "n": 260}})
        impactos.append(round(tc - DESDE, 4))
        esc = {"id": nid(), "dur": d, "nombre": f"frase {i + 1} ({T['paleta']})", "mobs": [], "set": "llano", "ambiente": T["amb"],
               "ancla": {"x": 0, "y": 0, "z": 0, "rot": 0}, "actor": {"x": 0, "y": 0, "z": 0, "rot": 0}, "ocultar": False,
               "brillo": 1.2, "sueloInfinito": True, "efectos": ef}
        cam = lambda az, el=el, dist=dist, ty=ty: {"az": az, "el": el, "dist": dist, "ty": ty, "fov": 38, "pan": 0, "tilt": 0}
        clip = {"id": nid(), "tipo": "libre", "dur": d, "curva": "lineal" if i != 4 else "natural", "desde": cam(az0), "hasta": cam(az1)}
        k["escenas"].append(esc)
        k["camara"].append(clip)
    # patadas: una por negra, alternadas; la pose llega al pico justo en la negra (empieza 0.1 s antes)
    # (la patada j empieza 0.12 s antes de su negra y tarda 0.12 s en llegar; la primera ya está arriba en el corte)
    lado, t = "D", 0.0
    nn = int(round(dur_total / NEGRA))
    for j in range(nn):
        ini = 0.0 if j == 0 else j * NEGRA - 0.12
        fin_patada = j * NEGRA + 0.12
        fin = min(dur_total, (j + 1) * NEGRA - 0.12) if j < nn - 1 else dur_total
        k["poses"].append({"id": nid(), "pose": patada(lado), "dur": round(fin_patada - ini, 4), "trans": 0 if j == 0 else 0.12,
                           "curva": "natural", **({"corte": True} if j == 0 else {})})
        k["poses"].append({"id": nid(), "pose": PARADO, "dur": round(fin - fin_patada, 4), "trans": 0.12, "curva": "natural"})
        lado = "I" if lado == "D" else "D"
    k["ojos"].append({"id": nid(), "cara": "muy_feliz", "dur": dur_total, "mx": 0, "my": 0})
    k["audio"].append({"id": nid(), "tipo": "musica", "texto": f"{C_CANCION()} en bloques musicales (partitura.py)",
                       "archivo": f"{V.REL}/{V.ESCUCHAR.name}", "inicio": 0, "desde": DESDE, "dur": dur_total, "vol": 1.0})
    p["pistas"] = k
    destino = RAIZ / "agente" / "proyectos" / f"{V.PROYECTO}.json"
    destino.write_text(json.dumps(p, ensure_ascii=False), encoding="utf-8")
    print(f"{destino.relative_to(RAIZ)}: {len(k['escenas'])} tomas · {dur_total} s (canción {DESDE}–{HASTA}) · "
          f"{len(gs)} bloques · impactos en {impactos} · {sum(len(e['efectos'][3]['golpes']) for e in k['escenas'])} estallidos")


def C_CANCION():
    return V.C["cancion"]


if __name__ == "__main__":
    main()
