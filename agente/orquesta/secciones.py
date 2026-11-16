"""Propone las secciones del video a partir de la partitura: densidad de notas cada 5 s, registros y silencios largos.

    python agente/orquesta/secciones.py                  → tabla de densidad, silencios y secciones propuestas
    python agente/orquesta/secciones.py --json           → sólo el JSON propuesto ("secciones", "ecualizador", "textos")
    python agente/orquesta/secciones.py --guardar        → además lo escribe en secciones_propuestas.json (no toca video.json)
    python agente/orquesta/secciones.py otra_eventos.json   (por defecto, el <base>_eventos.json de video.json)
    opciones: --min 6 (s, sección más corta) · --max 24 (s, más larga) · --silencio 0.4 (s, hueco que cuenta)

Es lo que se hizo a mano en brief_creativo.md para Rush E 3, como punto de partida. Escúchalo y ajústalo en video.json:
- cortes donde la densidad cambia mucho (×1.7 y ≥ 15 notas/s de diferencia) o un registro entra o sale (cruza el 10 %),
  movidos a la nota real más cercana (o al borde del hueco más cercano, si hay uno a ≤ 1 s);
- hueco de ≥ 2 s en la segunda mitad = PAUSA; después de la pausa (o, sin pausa, desde que la densidad pasa de 3× la mediana)
  las notas mueven el ECUALIZADOR (el clímax);
- tramo de ≥ 4 s con varios huecos seguidos (≥ 3 s de silencio en total) = parte LENTA (cámara fija con LTezla mirando);
- tramo de ≥ 2.5× la mediana antes del clímax = EXPLOSIÓN (tomas cortas);
- las secciones de menos de --min se juntan con la vecina más parecida (densidad y registros) y las de más de --max se parten.
"""
import bisect, json, math, statistics, sys
from collections import Counter, defaultdict

import video as V

VENTANA = 5.0
ROTACION = [["orbita", "fpv", "lateral", "alto"], ["fpv", "alto", "orbita", "ras", "lateral"],
            ["lateral", "fpv", "orbita", "alto"], ["orbita", "fpv", "lateral", "alto", "ras"]]


def opcion(k, d):
    a = sys.argv
    return type(d)(a[a.index(k) + 1]) if k in a else d


def analizar(eventos, umbral):
    ts = sorted({round(e["t"], 4) for e in eventos})
    dens, por = Counter(), defaultdict(Counter)
    for e in eventos:
        k = int(e["t"] // VENTANA); dens[k] += 1; por[k][e["pista"]] += 1
    huecos = [(a, b) for a, b in zip(ts, ts[1:]) if b - a >= umbral]
    return ts, dens, por, huecos


def zonas_lentas(huecos):
    """huecos seguidos (≤ 1 s de notas entre uno y otro), ≥ 4 s y ≥ 3 s de silencio: partes lentas y espaciadas
    (en Rush E, la entrada tiene acordes cada 0.43 s: son huecos seguidos, pero cortos y rítmicos, no una parte lenta)"""
    zonas, actual = [], []
    for h in huecos:
        if actual and h[0] - actual[-1][1] > 1.0:
            zonas.append(actual); actual = []
        actual.append(h)
    zonas.append(actual)
    return [(z[0][0], z[-1][1]) for z in zonas if z and len(z) >= 2 and sum(b - a for a, b in z) >= 3 and 4 <= z[-1][1] - z[0][0] < 12]


def a_nota(ts, t, huecos, radio=1.0):
    """el corte cae en una nota real: el borde del hueco más cercano (≤ radio) o, si no hay, la nota más cercana"""
    bordes = [x for h in huecos for x in h if abs(x - t) <= radio]
    if bordes:
        return min(bordes, key=lambda x: abs(x - t))
    i = bisect.bisect_left(ts, t)
    cerca = [ts[j] for j in (i - 1, i) if 0 <= j < len(ts)]
    return min(cerca, key=lambda x: abs(x - t)) if cerca else t


def proponer(eventos, dur, umbral=0.4, minimo=6.0, maximo=24.0):
    ts, dens, por, huecos = analizar(eventos, umbral)
    evt = sorted(e["t"] for e in eventos)                  # todas las notas (un acorde cuenta cada nota)
    n_vent = int(dur // VENTANA) + 1
    nps = [dens[k] / VENTANA for k in range(n_vent)]
    primera, ultima = ts[0], ts[-1]
    mediana = statistics.median([x for x in nps if x > 0]) or 1
    pistas = sorted({e["pista"] for e in eventos})
    largos = [h for h in huecos if h[1] - h[0] >= 2.0 and h[0] > dur / 2]
    pausa = max(largos, key=lambda h: h[1] - h[0]) if largos else None
    if pausa:
        t_climax = pausa[1]
    else:
        fuertes = [k for k in range(n_vent) if nps[k] >= 3 * mediana and k * VENTANA > dur / 2]
        t_climax = a_nota(ts, fuertes[0] * VENTANA, huecos) if fuertes else None
    lentas = [z for z in zonas_lentas(huecos) if not pausa or not (z[0] < pausa[1] and z[1] > pausa[0])]

    # 1) cortes por densidad y por registros (antes del clímax: después, el ecualizador es una sola sección)
    cortes = set()
    fin_rio = t_climax if t_climax else ultima
    for k in range(1, n_vent):
        t = k * VENTANA
        if t <= primera + 2 or t >= fin_rio - 2:
            continue
        a, b = nps[k - 1], nps[k]
        cambio = max(a, b) >= 1.7 * max(min(a, b), 1e-6) and abs(a - b) >= 15
        reg = any((por[k - 1][p] / max(1, dens[k - 1]) >= 0.1) != (por[k][p] / max(1, dens[k]) >= 0.1) for p in pistas)
        if cambio or reg:
            cortes.add(round(a_nota(ts, t, huecos), 2))
    # 2) secciones fijas: adelanto, pausa, lentas, clímax, final
    fijas = {}
    if primera >= 1.0 and t_climax:
        fijas[(0.0, round(primera, 2))] = "adelanto"
    for z in lentas:
        fijas[(round(z[0], 2), round(z[1], 2))] = "lento"
    if pausa:
        fijas[(round(pausa[0], 2), round(pausa[1], 2))] = "pausa"
    fin = math.ceil(ultima * 100 - 1e-6) / 100            # la última nota queda dentro del clímax
    if t_climax:
        fijas[(round(t_climax, 2), fin)] = "clímax"
    fijas[(fin, round(dur, 4))] = "final"
    for a, b in fijas:
        cortes |= {a, b}
    cortes = {c for c in cortes if not any(a < c < b for a, b in fijas)} | {0.0, round(dur, 4)}
    if primera < 1.0 or not t_climax:
        cortes.discard(round(primera, 2))
    cs = sorted(cortes)
    secs = [[a, b, fijas.get((a, b))] for a, b in zip(cs, cs[1:]) if b - a > 1e-6]

    # 3) juntar las cortas (sin tipo) con la vecina libre más parecida: densidad y reparto entre registros
    def densidad(a, b):
        return (bisect.bisect_left(evt, b) - bisect.bisect_left(evt, a)) / max(b - a, 1e-6)

    def perfil(a, b):
        c = Counter(e["pista"] for e in eventos if a <= e["t"] < b)
        n = max(1, sum(c.values()))
        return math.log(max(densidad(a, b), 0.1)), [c[p] / n for p in pistas]

    def distancia(x, y):
        (da, ra), (db, rb) = perfil(*x), perfil(*y)
        return abs(da - db) + 2 * sum(abs(u - v) for u, v in zip(ra, rb))
    cambio = True
    while cambio:
        cambio = False
        for i, (a, b, tipo) in enumerate(secs):
            if tipo or b - a >= minimo:
                continue
            vec = [j for j in (i - 1, i + 1) if 0 <= j < len(secs) and not secs[j][2]]
            if not vec:
                continue
            j = min(vec, key=lambda j: distancia(secs[j][:2], (a, b)))
            lo, hi = min(i, j), max(i, j)
            secs[lo:hi + 1] = [[secs[lo][0], secs[hi][1], None]]
            cambio = True
            break
    # 4) partir las largas (sin tipo) en partes iguales, con el corte en una nota
    out = []
    for a, b, tipo in secs:
        if tipo or b - a <= maximo:
            out.append([a, b, tipo]); continue
        n = int((b - a) // maximo) + 1
        bordes = [a] + [round(a_nota(ts, a + (b - a) * i / n, huecos), 2) for i in range(1, n)] + [b]
        out += [[x, y, None] for x, y in zip(bordes, bordes[1:])]
    # 5) explosión: densa antes del clímax
    for s in out:
        if not s[2] and t_climax and s[1] <= t_climax and densidad(s[0], s[1]) >= 2.5 * mediana:
            s[2] = "explosión"
    return out, dict(ts=ts, evt=evt, nps=nps, por=por, huecos=huecos, pausa=pausa, t_climax=t_climax, lentas=lentas,
                     mediana=mediana, primera=primera, ultima=ultima, pistas=pistas)


def a_json(secs, info, dur):
    """las secciones en el formato de video.json, con cámaras y opciones de partida (las de Rush E)"""
    ts, nps = info["ts"], info["nps"]
    pico = None
    if info["t_climax"]:                                    # el segundo más denso del clímax: el adelanto y la ola congelada
        cuenta = Counter(int(t) for t in info["evt"] if t >= info["t_climax"])
        pico = float(max(cuenta, key=cuenta.get)) + 0.4 if cuenta else None
    rio = [s for s in secs if s[2] not in ("adelanto", "clímax", "final")]
    out, k_plan, n_libres = [], 0, 0
    for a, b, tipo in secs:
        hasta = "fin" if b >= dur - 1e-3 else b
        s = {"desde": a, "hasta": hasta}
        f = (rio.index([a, b, tipo]) / max(1, len(rio) - 1)) if [a, b, tipo] in rio else 1.0
        luz = [round(1.0 - 0.12 * f, 2), 1 + round(3 * f)]                # de la tarde al anochecer
        if tipo == "adelanto":
            s |= {"nombre": "adelanto (la ola)", "camara": {"dron": {"az": 205, "amp": 0, "el": 16, "zoom": 1, "dmin": 76, "dmax": 76,
                  "ty": V.C["ecualizador"]["alto_medio"] + 2, "giro": 4}}, "tc": pico, "climax": True}
        elif tipo == "lento":
            s |= {"nombre": "lento", "camara": {"fija": [{"az": 214, "el": 4, "dist": 9, "ty": 1.6, "fov": 40, "tilt": 6},
                  {"az": 222, "el": 5, "dist": 7.5, "ty": 1.6, "fov": 40, "tilt": 6}]}, "ltezla": "mira", "luz": luz}
        elif tipo == "pausa":
            s |= {"nombre": "pausa", "camara": {"claves": [[0, 25, 6, 6, 1.6], [0.55, 32, 8, 8, 1.6], [1, 10, 24, 40, 3]], "rot": 180},
                  "ltezla": "orilla", "luz": luz}
        elif tipo == "clímax":
            s |= {"nombre": "clímax", "camara": {"plan": {"estilos": ["orbita", "lateral", "alto", "orbita", "ras"], "corto": 3.0,
                  "largo": 4.5, "ty": V.C["ecualizador"]["alto_medio"], "zoom": 1.5}}, "climax": True, "luz": luz}
        elif tipo == "final":
            s |= {"nombre": "final", "camara": {"claves": [[0, 115, 6, 6.5, 1.7], [0.35, 140, 10, 12, 3], [1, 188, 24, 62, 9]]},
                  "climax": bool(info["t_climax"]), "ltezla": "final", "luz": luz}
        elif tipo == "explosión":
            s |= {"nombre": "explosion", "camara": {"plan": {"estilos": ["fpv", "orbita", "lateral", "ras"], "corto": 1.5, "largo": 2.2}},
                  "musicos": True, "luz": luz}
        elif n_libres == 0:
            n_libres += 1
            s |= {"nombre": "entrada", "camara": {"plan": {"estilos": ["ras", "fpv", "orbita"], "corto": 3.6, "largo": 5.0, "ty": 1.2}},
                  "ltezla": "corre"}
        else:
            n_libres += 1
            s |= {"nombre": f"parte {n_libres}", "camara": {"plan": {"estilos": ROTACION[k_plan % len(ROTACION)]}}, "musicos": True, "luz": luz}
            k_plan += 1
        out.append(s)
    ultima = info["ultima"]
    res = {"secciones": out, "textos": {"contador": {"hasta": round(ultima + 0.4, 1)}, "cierre": {"desde": round(ultima + 0.4, 1)},
                                        "faltan": None}}
    if info["t_climax"]:
        res["ecualizador"] = {"desde": round(info["t_climax"], 2), "z": int(V.C["rio"]["vel"] * info["t_climax"]) + 6,
                              "congelar": pico}
    if info["pausa"]:
        p = info["pausa"]
        res["textos"]["faltan"] = {"desde": round(p[0] + 0.25, 1), "hasta": round(p[1] - 0.25, 1)}
    return res


def main():
    args = [a for i, a in enumerate(sys.argv[1:], 1) if not a.startswith("--") and not sys.argv[i - 1].startswith("--m")
            and sys.argv[i - 1] != "--silencio"]
    ruta = V.AQUI / args[0] if args else V.EVENTOS
    datos = json.loads(ruta.read_text(encoding="utf-8"))
    eventos = datos["eventos"]
    dur = V.DUR if not args else round(-(-datos["duracion"] * V.FPS // 1) / V.FPS, 4)
    secs, info = proponer(eventos, dur, opcion("--silencio", 0.4), opcion("--min", 6.0), opcion("--max", 24.0))
    res = a_json(secs, info, dur)
    NL = chr(10)
    secc = ("," + NL).join("  " + json.dumps(x, ensure_ascii=False) for x in res["secciones"])   # una sección por línea, como en video.json
    resto = ("," + NL).join(f" {json.dumps(k)}: {json.dumps(v, ensure_ascii=False)}" for k, v in res.items() if k != "secciones")
    texto = NL.join(["{", ' "secciones": [', secc, " ],", resto, "}"])
    if "--guardar" in sys.argv:
        (V.AQUI / "secciones_propuestas.json").write_text(texto + "\n", encoding="utf-8")
    if "--json" in sys.argv:
        print(texto); return
    print(f"{ruta.name}: {len(eventos)} notas · {dur} s · primera nota {info['primera']:.2f} s · última {info['ultima']:.2f} s · "
          f"mediana {info['mediana']:.1f} notas/s\n")
    print("densidad cada 5 s (notas/s; " + " / ".join(info["pistas"]) + "):")
    for k, x in enumerate(info["nps"]):
        reg = " / ".join(str(info["por"][k][p]) for p in info["pistas"])
        print(f"  {k * VENTANA:6.1f}–{(k + 1) * VENTANA:6.1f}  {x:8.1f}  {'█' * min(40, round(x / max(info['nps']) * 40)):<40}  {reg}")
    print("\nsilencios (≥ " + f"{opcion('--silencio', 0.4)} s): " +
          ", ".join(f"{a:.2f}–{b:.2f} ({b - a:.2f})" for a, b in info["huecos"]))
    if info["pausa"]:
        print(f"pausa: {info['pausa'][0]:.2f}–{info['pausa'][1]:.2f} s ({info['pausa'][1] - info['pausa'][0]:.2f} s)")
    for z in info["lentas"]:
        print(f"parte lenta (huecos seguidos): {z[0]:.2f}–{z[1]:.2f} s")
    if info["t_climax"]:
        print(f"ecualizador (clímax) desde {info['t_climax']:.2f} s")
    print("\nsecciones propuestas:")
    for s in res["secciones"]:
        b = dur if s["hasta"] == "fin" else s["hasta"]
        print(f"  {s['desde']:7.2f}–{b:7.2f}  {b - s['desde']:5.1f} s  {s['nombre']:<18} {next(iter(s['camara']))}")
    print("\n`--json` imprime el bloque para video.json; `--guardar` lo deja en secciones_propuestas.json.")


if __name__ == "__main__":
    main()
