"""El rollo: cada nota de la canción (video.json; aquí, Rush E 3) pone su bloque musical. z = tiempo, x = tono (como un piano), y = apilado.
En el clímax (desde la pausa) las notas ya no se construyen: levantan un ECUALIZADOR gigante de bloques que sube y baja.

    python agente/orquesta/rollo.py              → rollo.json + climax.json (golpes) + agente/proyectos/<proyecto>.json
    python agente/orquesta/rollo.py personajes   → comandos `personaje` (LTezla) para después de `abrir`
    python herramientas/agente.py abrir '{"nombre": "<proyecto>"}'

Lo propio del video (duración, secciones, ecualizador, río, mundo, proyecto) está en video.json (lo lee video.py).

Reparto en x (73 columnas, una por bloque distinto de la canción; 1 de pasillo entre registros):
  bajo  clics 0–23 → x −37…−14 · arpa clics 0–24 → x −12…12 · campana clics 1–24 → x 14…37
Avance en z: VEL bloques/s hasta ecualizador.desde (Rush E: la pausa, 136.63 s). El ecualizador queda en Z_ECU, delante de la orilla del río.

Cámara: el dron va ADELANTE del frente mirando hacia atrás (az ≈ 0): se ve dónde aparecen las notas y el río que dejan,
con el sol de frente. El clímax va a contraluz (az ≈ 180). (Leo, borrador v1: "la cámara puede moverse mucho mejor, como un dron"; "no se ve lo que está pasando"):
cada sección tiene un ESTILO de dron y el punto de mira persigue el centro de las notas que están sonando (promedio con
peso en el tiempo, suavizado), y la distancia se abre o cierra según qué tan repartidas están. Ruta cada 0.25 s,
interpolada con Catmull-Rom en el motor (motor.js → rutaEn).
"""
import copy, json, math, sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parents[1]
import video as V

C = V.C
FPS, DUR = V.FPS, V.DUR                                   # Rush E: 169.4667 s = 5084 cuadros
VEL, T_CLIMAX = C["rio"]["vel"], V.T_CLIMAX
X0 = C["rio"]["x0"]
# mundo real (herramientas/mundo_real.py): archipiélago con bosque de flores de un mundo generado por el servidor oficial
# 26.3 (semilla 8966625098790227075, x −384…127, z 512…1279). El pasillo aplanado empieza en z = 20 del .bin → z = −364
# de la escena; el rollo entero cabe, así que el ancla es FIJA en todas las tomas
MUNDO, ANCLA_Z = C["mundo"]["set"], C["mundo"]["ancla_z"]
PASILLO = C["rio"]["pasillo"]                             # el hueco de 1 bloque entre arpa (≤ 12) y campana (≥ 14), con tablones sobre el agua
ECU = C["ecualizador"]
Z_ECU = ECU["z"]                                          # fila de adelante del ecualizador (z del rollo; en Rush E la orilla del río está en 527)
ECU_ALTO_MEDIO, ECU_MAX = ECU["alto_medio"], ECU["max"]


def z_de(t):
    return t * VEL


def golpes(eventos):
    alto, rollo, climax = {}, [], []
    for e in eventos:
        x = X0[e["pista"]] + e["clics"]
        if e["t"] >= T_CLIMAX:
            climax.append([round(e["t"], 4), x, 0, Z_ECU, e["clics"]])
            continue
        z = int(z_de(e["t"]))
        y = alto.get((x, z), 0)
        alto[(x, z)] = y + 1
        rollo.append([round(e["t"], 4), x, y, z, e["clics"]])
    rollo.sort(key=lambda g: g[0]); climax.sort(key=lambda g: g[0])
    return rollo, climax, max(alto.values())


def cam(az, el, dist, ty=1.0, fov=38):
    return {"az": az, "el": el, "dist": dist, "ty": ty, "fov": fov}


# Tomas: las "secciones" de video.json → (inicio, fin, nombre, cámara, opciones). cámara = {"plan": …}, {"dron": estilo},
# {"fija": [desde, hasta]} o {"claves": [[fracción, az, el, dist, ty], …], "rot": giro del actor}.
# plan: el planificador la parte en tomas de 3–5.5 s (corto/largo) con los estilos de camaras.py; ty, zoom, musicos.
# estilo de dron: az/amp/periodo (órbita lateral, s), el/ampel, zoom (multiplica la distancia que encuadra las notas),
# dmin/dmax, ty, alejar (factor de distancia al final de la toma), giro (°/s).
# opciones: tc = tiempo de la canción que muestra la toma; ltezla = "corre" | "mira" | "orilla" | "final"; climax = notas
# más grandes; musicos; luz = [exposición, calidez].
# Leo (v3): tomas más cortas, más perspectivas, dron que vuela entre los bloques, sin mareo.
TOMAS = V.TOMAS


# ── colisión: alturas del mundo real (terreno, plantas y agua), del río de bloques y del ecualizador, en x/z de escena
_ALT = None


def alturas(rollo):
    """terreno del mundo real (incluye plantas y agua) + por columna, los bloques del río con su tiempo (t, alto)"""
    global _ALT
    if _ALT is None:
        import numpy as np
        nombre = MUNDO.split(":", 1)[1]                  # "real:orquesta" → texturas_mc/mundos/orquesta.json + .bin
        meta = json.loads((RAIZ / "texturas_mc" / "mundos" / f"{nombre}.json").read_text(encoding="utf-8"))
        T, O = meta["tam"], meta["origen"]
        a = np.frombuffer((RAIZ / "texturas_mc" / "mundos" / f"{nombre}.bin").read_bytes(), np.uint8).reshape(T["y"], T["z"], T["x"])
        sys.path.insert(0, str(RAIZ / "herramientas")); import mundo_real as MR
        B = MR.b_del_animador()
        plantas = [B[k] for k in ("pasto_corto", "pasto_alto", "pasto_alto_arriba", "diente_leon", "amapola", "margarita",
                                  "aciano", "allium", "petalos", "pasto_marino", "alga", "antorcha", "capa_nieve") if k in B]
        lleno = a > 0
        top = np.where(lleno.any(0), T["y"] - np.argmax(lleno[::-1], axis=0), 0)
        h = top.astype(float) - O["y"]                    # con plantas: la cámara no puede quedar dentro de una flor
        solido = lleno & ~np.isin(a, plantas)
        tops = np.where(solido.any(0), T["y"] - np.argmax(solido[::-1], axis=0), 0)
        hs = tops.astype(float) - O["y"]                  # sin plantas: para la línea de vista (una flor no tapa la toma)
        cols = {}
        for g in rollo:                                   # ordenados por t: el alto de una columna sólo crece
            cols.setdefault((g[1] + O["x"], g[3] + ANCLA_Z + O["z"]), []).append((g[0], g[2] + 1))
        _ALT = (h, O, T, cols, hs)
    return _ALT


def altura_en(x, z, rollo, t=1e9, plantas=True):
    """lo que hay en (x, z) en el instante t de la canción: terreno + bloques del río ya puestos + ecualizador (clímax)"""
    h, O, T, cols, hs = alturas(rollo)
    xi, zi = int(math.floor(x)) + O["x"], int(math.floor(z)) + O["z"]
    if not (0 <= xi < T["x"] and 0 <= zi < T["z"]):
        return 0.0
    alto = (h if plantas else hs)[zi, xi]
    c = cols.get((xi, zi))
    if c:
        for t0, y in c:
            if t0 > t:
                break
            alto = max(alto, y)
    if t >= T_CLIMAX and -38 <= math.floor(x) <= 38 and Z_ECU <= math.floor(z) - ANCLA_Z < Z_ECU + 3:
        alto = max(alto, ECU_MAX)
    return alto


def _libre(az, el, dist, ty, mx, mz, rollo, margen, t=1e9):
    a, e = math.radians(az), math.radians(el)
    cx, cy, cz = mx + math.sin(a) * math.cos(e) * dist, ty + math.sin(e) * dist, mz + math.cos(a) * math.cos(e) * dist
    alrededor = max(altura_en(cx + dx, cz + dz, rollo, t) for dx in (-1.5, 0, 1.5) for dz in (-1.5, 0, 1.5))
    if cy < alrededor + margen:                                    # ni dentro ni rozando nada (1.5 bloques a los lados)
        return False
    for ox, tol in ((0.0, 1.2), (-5.0, 0.3), (5.0, 0.3)):          # línea de vista al centro de las notas y a sus costados
        for k in range(4, 20):
            u = k / 20
            tx = mx + ox
            px, py, pz = cx + (tx - cx) * u, cy + (ty - cy) * u, cz + (mz - cz) * u
            if py < altura_en(px, pz, rollo, t, plantas=False) + tol:
                return False
    return True


def sin_choque(az, el, dist, ty, mx, mz, rollo, margen=None, t=1e9):
    """busca la vista libre MÁS PARECIDA a la pedida: primero girar (±12…40°) y subir poco; después acercar; al final subir"""
    if margen is None:
        margen = 1.6 if dist < 12 else 2.5                 # de cerca alcanza con no rozar
    for de in (0, 4, 8):
        for daz in (0, 12, -12, 25, -25, 40, -40):
            if _libre(az + daz, el + de, dist, ty, mx, mz, rollo, margen, t):
                return az + daz, el + de, dist
    for f in (0.8, 0.65):
        for daz in (0, 20, -20):
            if _libre(az + daz, el + 4, dist * f, ty, mx, mz, rollo, margen, t):
                return az + daz, el + 4, dist * f
    e = el
    while e < 80 and not _libre(az, e, dist, ty, mx, mz, rollo, margen, t):
        e += 3
    return az, e, dist


def objetivo(todos, t, z_fijo=None):
    """centro (x) y dispersión de las notas que suenan alrededor de t; z = el frente del rollo (o el ecualizador)"""
    sx = sw = sxx = 0.0
    for g in todos:
        if g[0] < t - 0.9:
            continue
        if g[0] > t + 0.35:
            break
        w = math.exp(-abs(g[0] - t) / 0.4)
        sx += w * g[1]; sxx += w * g[1] * g[1]; sw += w
    if sw < 1e-6:
        return None
    m = sx / sw
    return m, math.sqrt(max(0.0, sxx / sw - m * m)), (Z_ECU + 1.5 if z_fijo else z_de(t))


def suavizar(xs, sigma):
    if sigma <= 0 or len(xs) < 3:
        return xs
    r = int(sigma * 3)
    out = []
    for i in range(len(xs)):
        s = w = 0.0
        for j in range(max(0, i - r), min(len(xs), i + r + 1)):
            k = math.exp(-0.5 * ((j - i) / sigma) ** 2); s += k * xs[j]; w += k
        out.append(s / w)
    return out


def ruta_claves(claves, d, mira, rollo, tc=0.0):
    """grúa por claves [(fracción, az, el, dist, ty)] interpolada (lineal; el motor la suaviza), con colisión"""
    out = []
    n = max(2, int(d / 0.25) + 1)
    for i in range(n):
        tau = d * i / (n - 1); f = tau / d
        k = max(j for j in range(len(claves)) if claves[j][0] <= f + 1e-9)
        k2 = min(k + 1, len(claves) - 1)
        f0, f1 = claves[k][0], claves[k2][0]
        u = 0 if f1 == f0 else (f - f0) / (f1 - f0)
        u = u * u * (3 - 2 * u)
        az, el, dist, ty = [claves[k][j] + (claves[k2][j] - claves[k][j]) * u for j in range(1, 5)]
        az, el, dist = sin_choque(az, el, dist, ty, mira[0], mira[1], rollo, t=tc + tau)
        out.append([round(tau, 3), round(az, 2), round(el, 2), round(dist, 2), ty, 38, 0])
    return suavizar_ruta(out)


def suavizar_ruta(r, sigma=2.5):
    """los giros que mete la colisión se suavizan (sin tirones); se suaviza az, el y dist"""
    for k in (1, 2, 3):
        v = suavizar([p[k] for p in r], sigma)
        for p, x in zip(r, v):
            p[k] = round(x, 2)
    return r


def ruta_dron(todos, a, b, tc, est, climax, rollo=None, fijo=None):
    """ruta de cámara [[tau, az, el, dist, ty, fov, roll]] y del punto de mira [[tau, x, y, z]] (escena) cada 0.25 s"""
    d = b - a
    n = max(2, int(d / 0.25) + 1)
    taus = [d * i / (n - 1) for i in range(n)]
    cx, sp, zz = [], [], []
    ultimo = (0.0, 10.0, z_de(tc) if not climax else Z_ECU + 1.5)
    for tau in taus:
        o = objetivo(todos, tc + tau, climax) or ultimo
        if est.get("mira_x") is not None:                  # mirar a los músicos de una orilla (x fija) en el frente
            o = (est["mira_x"] - 0.5, 10.0, o[2])
        if est.get("mira"):                                # punto de mira fijo (x, z del rollo): el final muestra todo el río
            o = (est["mira"][0], 10.0, est["mira"][1])
        ultimo = o
        cx.append(o[0]); sp.append(o[1]); zz.append(o[2])
    cx = suavizar(cx, 4); sp = suavizar(sp, 6)
    cam_r, mira = [], []
    for i, tau in enumerate(taus):
        f = tau / d if d else 0
        ang = 2 * math.pi * tau / est.get("periodo", 12)
        az = est["az"] + est.get("amp", 0) * math.sin(ang) + est.get("giro", 0) * tau      # giro: órbita continua (°/s)
        el = est["el"] + est.get("ampel", 0) * math.sin(ang * 0.77 + 1.0)
        dist = min(est.get("dmax", 60), max(est.get("dmin", 12), est.get("zoom", 1) * (10 + 2.4 * sp[i])))
        dist *= 1 + (est.get("alejar", 1) - 1) * f
        roll = -est.get("amp", 0) * math.cos(ang) * 2 * math.pi / est.get("periodo", 12) * 0.08     # se ladea al girar, como un dron
        mx, mz = (fijo(tau) if fijo else (cx[i] + 0.5, zz[i] + ANCLA_Z))
        if rollo is not None:
            az, el, dist = sin_choque(az, el, dist, est.get("ty", 1.0), mx, mz, rollo, t=tc + tau)
        cam_r.append([round(tau, 3), round(az, 2), round(el, 2), round(dist, 2), est.get("ty", 1.0), 38, round(roll, 2)])
        mira.append([round(tau, 3), round(mx, 2), 0, round(mz, 2)])
    return (suavizar_ruta(cam_r) if rollo is not None else cam_r), mira


# músicos: corren a la par del frente por las orillas del río y SALTAN en sus notas (accion.tiempos: el salto aterriza en
# la nota). Lobos = bajo (orilla izquierda), zorros = campana (orilla derecha), allays = arpa (vuelan sobre el centro).
# Un mob por grupo (n = 1, sin dispersión) para que no se separen. Saltos con ≥ 0.3 s entre uno y otro (lo que dura un salto)
# músicos: corren junto al frente por las orillas del río y SALTAN en notas reales (accion.tiempos: el salto aterriza en
# la nota). Leo (v2): "que no se vean como soldados" y "el zorro no tiene la animación correcta" → los zorros pasan a
# gatos (Fresh Animations) y cada músico tiene SU parte: su franja de tonos (clics), su separación mínima entre saltos,
# su altura de salto, su lugar (adelante/atrás, más cerca o más lejos del río) y su propio zigzag al correr.
# (tipo, pista, x de la orilla, variante, y, [(clics_min, clics_max, separación, Δz, Δx), …])
MUSICOS = [
    ("lobo", "bajo", -39.5, None, 0, [(0, 9, 0.34, -3.5, 0.0), (8, 16, 0.5, 0.8, -1.2), (14, 24, 0.42, 4.6, 0.8)]),
    ("gato", "campana", 39.5, None, 0, [(1, 9, 0.38, -2.4, 0.4), (8, 17, 0.55, 1.6, 1.3), (15, 24, 0.31, 5.2, -0.6)]),
    ("allay", "arpa", 0, None, 5.5, [(0, 12, 0.3, -1.5, -3.0), (12, 24, 0.36, 2.8, 3.0)]),
]
VARIANTES = {"gato": ["siames", "atigrado", "negro"]}


def tiempos_de(eventos, pista, a, b, sep=0.3, cmin=0, cmax=24):
    out, ult = [], -9
    for e in eventos:
        if e["pista"] != pista or e["t"] < a or e["t"] >= b or not (cmin <= e.get("clics", 0) <= cmax):
            continue
        if e["t"] - ult >= sep:
            out.append(round(e["t"] - a, 4)); ult = e["t"]
    return out


def musicos(eventos, a, d, tc):
    import random
    grupos = []
    for k, (tipo, pista, x, variante, y, partes) in enumerate(MUSICOS):
        for i, (cmin, cmax, sep, dz, dx) in enumerate(partes):
            r = random.Random(100 * k + i)
            ts = tiempos_de(eventos, pista, tc, tc + d, sep, cmin, cmax)
            z0 = z_de(tc) + dz
            ruta, t = [], 2.5 + r.random()                      # zigzag propio: un punto cada ~3 s, ±1.4 bloques
            while t < d + 4:
                xx = x + dx + (r.random() - 0.5) * 2.8
                if x:                                           # dentro del muelle: |x| de 38 a 43
                    xx = max(38.0, min(43.0, abs(xx))) * (1 if x > 0 else -1)
                ruta.append([round(xx, 2), round(z_de(tc + t) + dz, 2)]); t += 2.4 + r.random() * 1.6
            g = {"tipo": tipo, "n": 1, "fijo": True, "x": round(x + dx, 2), "z": round(z0, 2), "modo": "correr", "vel": VEL,
                 "escala": 1.8, "ruta": ruta, "dir": 0, "semilla": 10 * k + i + 1,
                 "accion": {"tipo": "saltitos", "tiempos": ts, "dur": round(0.22 + 0.08 * r.random(), 3)}}
            if y:
                g["y"] = round(y + (r.random() - 0.5) * 1.5, 2)
            v = (VARIANTES.get(tipo) or [None])[i % len(VARIANTES.get(tipo) or [None])]
            if v:
                g["variante"] = v
            grupos.append(g)
    return grupos


# ── planificador de tomas (camaras.py): tomas cortas que muestran lo que suena
import random as _random
import camaras as CAM


def sonando(todos, t, climax_desde=T_CLIMAX):
    """puntos 3D (escena) de las notas que suenan alrededor de t: bloques del río o columnas del ecualizador"""
    pts = []
    for g in todos:
        if g[0] < t - 0.35:
            continue
        if g[0] > t + 0.05:
            break
        if g[0] >= climax_desde:
            pts.append((g[1] + 0.5, 8.0, Z_ECU + 1.5 + ANCLA_Z))
        else:
            pts.append((g[1] + 0.5, g[2] + 0.5, g[3] + 0.5 + ANCLA_Z))
    if len(pts) > 60:
        pts = pts[:: len(pts) // 60 + 1]
    return pts


def cortes(todos, a, b, rng, corto=3.0, largo=5.5):
    """cortes en notas reales cada 3–5.5 s (la última toma no queda de menos de 2.5 s)"""
    ts = [g[0] for g in todos if a < g[0] < b]
    out, t = [a], a
    while True:
        meta = t + corto + rng.random() * (largo - corto)
        if meta > b - 2.5:
            break
        cerca = [x for x in ts if abs(x - meta) < 0.6]
        c = min(cerca, key=lambda x: abs(x - meta)) if cerca else meta
        c = round(c * FPS) / FPS
        out.append(c); t = c
    return out + [b]


def planear_toma(todos, rollo, a, b, estilo, prev_az, mira_fn=None, ty=1.0, bonus=None, zoom=1.0, base_fija=None):
    """elige az/el/dist/órbita del estilo que más notas muestra sin chocar; devuelve (ruta cámara, ruta mira, info)"""
    E = CAM.ESTILOS[estilo]
    d = b - a
    n = max(3, int(d / 0.25) + 1)
    taus = [d * i / (n - 1) for i in range(n)]
    mira, spr, pts = [], [], []
    ult = (0.0, 10.0, z_de(a))
    for tau in taus:
        t = a + tau
        o = objetivo(todos, t, t >= T_CLIMAX) or ult; ult = o
        mx, mz = mira_fn(tau) if mira_fn else (o[0] + 0.5, o[2] + ANCLA_Z)
        mira.append((mx, mz)); spr.append(o[1]); pts.append(sonando(todos, t) + (bonus(t) if bonus else []))
    xs = suavizar([m[0] for m in mira], 4); zs = suavizar([m[1] for m in mira], 4); spr = suavizar(spr, 6)
    mira = list(zip(xs, zs))
    base = base_fija or zoom * sum(min(60, max(10, 10 + 2.4 * s)) for s in spr) / len(spr)
    mejor = None
    for az0 in range(0, 360, 30):
        for sentido in (1, -1):
            for el in E["els"]:
                for fd in E["dist"]:
                    orb = (E["orbita"][0] + E["orbita"][1]) / 2 * sentido
                    vis, fallos, k = 0.0, 0, 0
                    for i in range(0, n, 2):
                        f = taus[i] / d
                        az = az0 + orb * f; dist = base * fd * (1 + (E["empuje"] - 1) * f)
                        if not _libre(az, el, dist, ty, mira[i][0], mira[i][1], rollo, E["margen"], a + taus[i]):
                            fallos += 1
                        v = CAM.visibles(pts[i], CAM.camara(az, el, dist, ty, mira[i][0], mira[i][1]))
                        if v is not None:
                            vis += v; k += 1
                    vis = vis / k if k else 0.5
                    distinto = 0 if prev_az is None else min(1, abs(((az0 - prev_az + 180) % 360) - 180) / 60)
                    score = vis - 1.2 * fallos / ((n + 1) // 2) + 0.15 * distinto
                    if mejor is None or score > mejor[0]:
                        mejor = (score, az0, sentido, el, fd, vis, fallos)
    _, az0, sentido, el, fd, vis, fallos = mejor
    orb = (E["orbita"][0] + E["orbita"][1]) / 2 * sentido
    ruta, rm = [], []
    for i, tau in enumerate(taus):
        f = tau / d
        az = az0 + orb * f; dist = base * fd * (1 + (E["empuje"] - 1) * f)
        az2, el2, dist2 = sin_choque(az, el, dist, ty, mira[i][0], mira[i][1], rollo, margen=E["margen"], t=a + tau)
        roll = E["ladeo"] * sentido * math.sin(math.pi * f) if E.get("fpv") else 0
        ruta.append([round(tau, 3), round(az2, 2), round(el2, 2), round(dist2, 2), ty, 38, round(roll, 2)])
        rm.append([round(tau, 3), round(mira[i][0], 2), 0, round(mira[i][1], 2)])
    ruta = suavizar_ruta(ruta, sigma=4)
    vis_final = []
    for i in range(0, n, 2):
        v = CAM.visibles(pts[i], CAM.camara(ruta[i][1], ruta[i][2], ruta[i][3], ty, mira[i][0], mira[i][1]))
        if v is not None:
            vis_final.append(v)
    info = {"estilo": estilo, "az": az0, "el": el, "vis": round(sum(vis_final) / len(vis_final), 3) if vis_final else None}
    return ruta, rm, info


def planear_seccion(todos, rollo, a, b, estilos, semilla, prev_az=None, corto=3.0, largo=5.5, **kw):
    rng = _random.Random(semilla)
    cs = cortes(todos, a, b, rng, corto, largo)
    tomas = []
    for k, (x, y) in enumerate(zip(cs, cs[1:])):
        estilo = estilos[(k + semilla) % len(estilos)]
        ruta, mira, info = planear_toma(todos, rollo, x, y, estilo, prev_az, **kw)
        if info["vis"] is not None and info["vis"] < 0.45 and estilo != "orbita":     # no se ve lo que suena: órbita
            ruta, mira, info = planear_toma(todos, rollo, x, y, "orbita", prev_az, **kw)
        prev_az = info["az"]
        tomas.append((x, y, ruta, mira, info))
    return tomas


def bonus_musicos(lado):
    """puntos de los músicos de una orilla (pesan el triple en la visibilidad): las tomas de lobos/gatos los muestran"""
    x = -40.5 if lado == "lobos" else 40.5
    return lambda t: [(x, 1.0, z_de(t) + dz + ANCLA_Z) for dz in (-3, 0.5, 4.5)] * 3


def expandir(todos, rollo):
    """TOMAS con las secciones "plan" convertidas en tomas cortas (cada una con su ruta de cámara y de mira)"""
    out, prev, semilla = [], None, 1
    for a, b, nombre, camara, op in TOMAS:
        if "plan" not in camara:
            out.append((a, b, nombre, camara, op)); continue
        P = dict(camara["plan"])
        estilos = P.pop("estilos"); corto = P.pop("corto", 3.0); largo = P.pop("largo", 5.5)
        kw = {}
        if op.get("ltezla") == "corre":
            kw["mira_fn"] = None
        if P.get("musicos"):
            kw["bonus"] = bonus_musicos(P["musicos"])
        if P.get("ty"):
            kw["ty"] = P["ty"]
        if P.get("zoom"):
            kw["zoom"] = P["zoom"]
        if op.get("ltezla") == "corre":
            tomas = []
            rng = _random.Random(semilla)
            cs = cortes(todos, a, b, rng, corto, largo)
            for k2, (x, y) in enumerate(zip(cs, cs[1:])):
                ruta, mira, info = planear_toma(todos, rollo, x, y, estilos[k2 % len(estilos)], prev,
                                                mira_fn=lambda tau, x=x: (PASILLO, z_de(x + tau) + ANCLA_Z), ty=kw.get("ty", 1.2),
                                                base_fija=11, bonus=lambda t: [(PASILLO, 1.0, z_de(t) + ANCLA_Z)] * 8)   # LTezla cerca y a la vista
                prev = info["az"]; tomas.append((x, y, ruta, mira, info))
        else:
            tomas = planear_seccion(todos, rollo, a, b, estilos, semilla, prev, corto, largo, **kw)
            prev = tomas[-1][4]["az"]
        semilla += 1
        for k2, (x, y, ruta, mira, info) in enumerate(tomas):
            out.append((x, y, f"{nombre} {k2 + 1}·{info['estilo']}", {"ruta": ruta, "mira": mira, "info": info}, op))
    return out


# loros (Leo, v5: "añadir loros volando ayudaría mucho"): una bandada de 5 colores sobre el río, a la par del frente, cada
# uno con su ruta en zigzag, su altura y su velocidad (nada de formación)
LOROS = ["rojo", "azul", "verde", "cian", "gris"]


def loros(a, d, tc):
    r = _random.Random(int(tc * 100) + 7)
    out = []
    for i, v in enumerate(LOROS):
        x0, dz, y = (r.random() - 0.5) * 40, -6 + r.random() * 16, 6 + r.random() * 4
        ruta, t = [], 1.2 + r.random()
        while t < d + 3:
            ruta.append([round((r.random() - 0.5) * 56, 2), round(z_de(tc + t) + dz + (r.random() - 0.5) * 4, 2)]); t += 1.4 + r.random() * 1.8
        out.append({"tipo": "loro", "variante": v, "n": 1, "fijo": True, "x": round(x0, 2), "z": round(z_de(tc) + dz, 2),
                    "y": round(y, 2), "modo": "correr", "vel": round(VEL * (1.05 + r.random() * 0.25), 2), "escala": 1.6,
                    "ruta": ruta, "dir": 0, "semilla": 50 + i})
    return out


def proyecto(rollo, climax, eventos):
    base = json.loads((RAIZ / "agente" / "proyectos" / "epico_base.json").read_text(encoding="utf-8"))
    trailer = json.loads((RAIZ / "proyectos" / "trailer-bobicraft-ltezla.json").read_text(encoding="utf-8"))  # sólo lectura
    p = copy.deepcopy(base)
    p["nombre"] = C["proyecto"]["nombre"]
    p["escena"] = copy.deepcopy(trailer["escena"])
    # modo premium (js/escena.js): rayos de sol, neblina dorada, destellos, nubes con volumen, viento, agua y etalonaje
    p["efectos"] = {**copy.deepcopy(trailer["efectos"]), "vineta": 0.25, "grano": 0.012, "brillo": 0.55, "premium": True, "neblina": 0.35,
                  "dof": 0.08, "saturacion": 0.9}         # ronda 2: menos desenfoque y un verde menos chillón
    p["ajustes"] = {**trailer["ajustes"], "formato": "1080x1920"}
    p["personaje"]["capa"] = "skins/capa_mcc15.png"     # la capa de Leo (NameMC: MCC 15th Year, b169480d76031eb0)
    p["mundo"] = None
    p["ediciones"] = {}
    reposo = copy.deepcopy(base["pistas"]["poses"][0]["pose"])
    k = {"escenas": [], "camara": [], "poses": [], "ojos": [], "matices": [], "textos": [], "audio": []}
    todos = sorted(rollo + climax, key=lambda g: g[0])
    n = 0

    def nid():
        nonlocal n
        n += 1
        return f"or{n:04d}"

    global VISIBILIDAD
    VISIBILIDAD = []
    for a, b, nombre, camara, op in expandir(todos, rollo):
        b = min(b, DUR)
        d = round(round(b * FPS) / FPS - round(a * FPS) / FPS, 4)
        tc = round(round(op.get("tc", a) * FPS) / FPS, 4)          # tiempo de la canción al empezar la toma
        lt = op.get("ltezla")
        grande = op.get("climax", False)
        ef = [{"tipo": "notas", "archivo": f"{V.REL}/rollo.json", "construye": True, "tam": 0.55, "pulso": 0.2, "vida": 0.7,
               "tenue": 0.04, "desfase": tc}]
        if grande or tc + d > T_CLIMAX:
            ef.append({"tipo": "ecualizador", "archivo": f"{V.REL}/climax.json", "desfase": tc, "z": Z_ECU, "prof": 3,
                       "ventana": 0.45, "max": ECU_MAX, "tam": 1.4, **({"congelar": ECU["congelar"]} if lt == "final" else {})})
        mobs = musicos(eventos, a, d, tc) if op.get("musicos") else []
        if tc + d <= T_CLIMAX + 0.05 and not op.get("tc"):
            mobs += loros(a, d, tc)
        esc = {"id": nid(), "dur": d, "nombre": nombre, "mobs": mobs, "set": MUNDO, "ambiente": "dorado",
               "ancla": {"x": 0, "y": 0, "z": ANCLA_Z, "rot": 0}, "ocultar": not lt, "brillo": 1.25, "sueloInfinito": "agua",
               "efectos": ef}
        clip = {"id": nid(), "tipo": "libre", "dur": d, "curva": "lineal"}
        if lt == "corre":                                  # LTezla corre por el pasillo (tablones sobre el agua), en el frente
            esc["actor"] = {"x": PASILLO, "y": 0, "z": round(z_de(tc) + ANCLA_Z, 2), "rot": 0}
            esc["actorHasta"] = {"x": PASILLO, "y": 0, "z": round(z_de(tc + d) + ANCLA_Z, 2), "rot": 0}
        elif lt == "orilla":                               # en la pausa se queda en la orilla del río de bloques
            esc["actor"] = {"x": PASILLO, "y": 0, "z": round(z_de(tc) + 1.5 + ANCLA_Z, 2), "rot": 180}     # mira hacia la cámara, con el río detrás
        elif lt == "mira":                                 # la toma lenta: LTezla en el pasillo mirando el atardecer
            esc["actor"] = {"x": PASILLO, "y": 0, "z": round(z_de(tc + 3) + ANCLA_Z, 2), "rot": 0}
        elif lt == "final":                                # frente al ecualizador
            esc["actor"] = {"x": PASILLO, "y": 0, "z": round(Z_ECU - 6 + ANCLA_Z, 2), "rot": 0}
        if op.get("luz"):                                  # de la tarde hacia el anochecer: menos exposición, más cálido
            esc["exp"], esc["calidez"] = op["luz"]
        if lt == "corre":
            fijo = lambda tau, tc=tc: (PASILLO, z_de(tc + tau) + ANCLA_Z)
        elif lt:
            fijo = lambda tau, p=esc["actor"]: (p["x"], p["z"])
        else:
            fijo = None
        if "ruta" in camara:                               # toma del planificador
            r = camara["ruta"]
            clip["desde"] = cam(*r[0][1:5]); clip["hasta"] = cam(*r[-1][1:5]); clip["ruta"] = r
            if not lt:
                esc["actor"] = {"x": camara["mira"][0][1], "y": 0, "z": camara["mira"][0][3], "rot": 0}
                esc["actorRuta"] = camara["mira"]
            VISIBILIDAD.append({"t": round(a, 2), "dur": d, "toma": nombre, **camara["info"]})
        elif "claves" in camara:
            mx, mz = fijo(0)
            r = ruta_claves(camara["claves"], d, (mx, mz), rollo, tc)
            if camara.get("rot"):                          # la cámara del motor suma el giro del actor (posicionCamara)
                for p_ in r:
                    p_[1] = round(p_[1] - camara["rot"], 2)
            clip["desde"] = cam(*r[0][1:5]); clip["hasta"] = cam(*r[-1][1:5]); clip["ruta"] = r
        elif "dron" in camara:
            r, mira = ruta_dron(todos, a, b, tc, camara["dron"], grande, rollo, fijo)
            clip["desde"] = cam(*r[0][1:5]); clip["hasta"] = cam(*r[-1][1:5]); clip["ruta"] = r
            if not lt:                                     # sin LTezla, la cámara mira al centro de las notas
                esc["actor"] = {"x": mira[0][1], "y": 0, "z": mira[0][3], "rot": 0}
                esc["actorRuta"] = mira
        else:
            clip["desde"], clip["hasta"] = camara["fija"]
            if not lt:
                o = objetivo(todos, tc + d / 2) or (0, 0, z_de(tc))
                esc["actor"] = {"x": round(o[0] + 0.5, 2), "y": 0, "z": round(z_de(tc + d / 2) + ANCLA_Z, 2), "rot": 0}
        k["escenas"].append(esc)
        k["camara"].append(clip)
        k["poses"].append({"id": nid(), "pose": copy.deepcopy(reposo), "dur": d, "trans": 0, "curva": "natural", "corte": True})
        k["ojos"].append({"id": nid(), "cara": "neutral", "dur": d, "mx": 0, "my": 0})
    k["audio"].append({"id": nid(), "tipo": "musica", "texto": f"{C['cancion']} en bloques musicales (partitura.py)",
                       "archivo": f"{V.REL}/{V.ESCUCHAR.name}", "inicio": 0, "desde": 0, "dur": DUR, "vol": 1.0})
    p["pistas"] = k
    return p


def personajes():
    """comandos `personaje` para las tomas con LTezla (se aplican después de `abrir`)"""
    out = []
    ev = json.loads(V.EVENTOS.read_text(encoding="utf-8"))
    rollo, climax, _ = golpes(ev["eventos"])
    for i, (a, b, nombre, camara, op) in enumerate(expandir(sorted(rollo + climax, key=lambda g: g[0]), rollo), start=1):
        d = round(b - a, 3)
        if op.get("ltezla") == "corre":
            # 4 bloques/s es correr (Leo: "no camina naturalmente"): pose de carrera + piernas a 2.6 pasos/s
            # (Leo v2: "corre muy raro") la pose "correr" + el matiz "correr" se sumaban: piernas y brazos exagerados y
            # torcidos. Ahora pose neutra + matiz de carrera (2.6 pasos/s, simétrico)
            out.append({"toma": i, "poses": [["reposo", d]], "ojos": [["emocionado", d, 0, 0]], "matices": [["correr", 0, d, 1]]})   # estrellas rojas con volumen (rostro-suave.js), elegidas por Leo
        elif op.get("ltezla") == "mira":
            out.append({"toma": i, "poses": [["relajado", d]], "ojos": [["feliz", d, 0, 0]], "matices": [["respirar", 0, d, 1], ["balancear", 0, d, 0.4]]})
        elif op.get("ltezla") == "final":
            out.append({"toma": i, "poses": [["celebrar", d]], "ojos": [["muy_feliz", d, 0, 0]], "matices": [["rebotar", 0, d, 0.6]]})
        elif op.get("ltezla") == "orilla":
            out.append({"toma": i, "poses": [["reposo", d]], "ojos": [["sorprendido", d, 0, 0]], "matices": [["respirar", 0, d, 1]]})
    return out


def main():
    errores = V.comprobar()
    if errores:
        raise SystemExit("video.json: " + "; ".join(errores))
    ev = json.loads(V.EVENTOS.read_text(encoding="utf-8"))
    rollo, climax, alto = golpes(ev["eventos"])
    (AQUI / "rollo.json").write_text(json.dumps({"vel": VEL, "t_climax": T_CLIMAX, "x0": X0, "altura_max": alto, "golpes": rollo}), encoding="utf-8")
    (AQUI / "climax.json").write_text(json.dumps({"z": Z_ECU, "golpes": climax}), encoding="utf-8")
    p = proyecto(rollo, climax, ev["eventos"])
    (RAIZ / "agente" / "proyectos" / f"{V.PROYECTO}.json").write_text(json.dumps(p, ensure_ascii=False), encoding="utf-8")
    vs = [v["vis"] for v in VISIBILIDAD if v["vis"] is not None]
    (AQUI / "critica" / "visibilidad.json").write_text(json.dumps(VISIBILIDAD, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"visibilidad de las notas que suenan (tomas planificadas): media {sum(vs) / len(vs):.0%} · "
          f"mínima {min(vs):.0%} · tomas < 60 %: {sum(v < 0.6 for v in vs)} de {len(vs)}")
    print(f"{len(rollo)} golpes construidos + {len(climax)} en el ecualizador · río de {z_de(T_CLIMAX):.0f} bloques · altura máx {alto} · "
          f"{len(TOMAS)} tomas · {sum(e['dur'] for e in p['pistas']['escenas']):.2f} s")


if __name__ == "__main__":
    if sys.argv[1:] == ["personajes"]:
        for c in personajes():
            print(json.dumps(c))
    else:
        main()
