"""MIDI → canción de bloques musicales (el JSON que lee partitura.py). Sin dependencias: lector de SMF propio.

    python agente/orquesta/midi.py <archivo.mid> [--salida cancion.json] [--velocidad 1.0] [--desde s] [--hasta s]
    python agente/orquesta/midi.py [--salida x.json]   → sin archivo: el MIDI, los tramos y la velocidad de video.json
                                                         ("midi"); la salida es <base>.json

- Respeta el mapa de tempo del MIDI (Rush E acelera muchísimo) y cuantiza cada ataque al cuadro más cercano (30 fps):
  así cada nota cae en un cuadro y su acción en pantalla también. Las notas que caen en el mismo cuadro forman un acorde.
- Reparte las notas por registro entre instrumentos del juego (cada uno tiene 2 octavas); lo que se sale de todos
  se mueve de octava (y se cuenta en `fuera_de_rango`).
- `--velocidad` multiplica el tempo (1.0 = como el MIDI).
- `--tramos 0-12.08,116.45-132.73,136.63-170`: arma un corte con esos tramos del MIDI, uno detrás de otro.
"""
import json, struct, sys
from pathlib import Path

# registros por instrumento: [nota más grave, más aguda] en número MIDI (fa#1 = 30 … fa#7 = 102)
REGISTROS = [
    ("bajo", 30, 53, "golem"),        # fa#1–fa3
    ("arpa", 54, 78, "bloques"),      # fa#3–fa#5
    ("campana", 79, 102, "allays"),   # sol5–fa#7 (la flauta es sostenida y no suena a piano: no se usa)
]
PIANO = (21, 108)                     # la0–do8: lo de afuera son "dibujos" de los MIDI de visualización, no suenan


def _vlq(d, i):
    v = 0
    while True:
        b = d[i]; i += 1
        v = (v << 7) | (b & 0x7F)
        if not b & 0x80:
            return v, i


def leer(ruta):
    """Devuelve las notas [(t_s, dur_s, nota, vel, pista)] con el mapa de tempo aplicado."""
    d = Path(ruta).read_bytes()
    if d[:4] != b"MThd":
        raise SystemExit("no es un archivo MIDI (falta MThd)")
    _, ntrk, div = struct.unpack(">HHH", d[8:14])
    if div & 0x8000:
        raise SystemExit("MIDI con tiempo SMPTE: no soportado")
    i, pistas = 14, []
    for _ in range(ntrk):
        while d[i:i + 4] != b"MTrk":           # saltar bloques desconocidos
            i += 8 + struct.unpack(">I", d[i + 4:i + 8])[0]
        largo = struct.unpack(">I", d[i + 4:i + 8])[0]
        j, fin, tick, estado, evs = i + 8, i + 8 + largo, 0, 0, []
        while j < fin:
            dt, j = _vlq(d, j); tick += dt
            b = d[j]
            if b == 0xFF:
                tipo = d[j + 1]; n, j = _vlq(d, j + 2)
                if tipo == 0x51:
                    evs.append((tick, "tempo", int.from_bytes(d[j:j + 3], "big")))
                j += n; continue
            if b in (0xF0, 0xF7):
                n, j = _vlq(d, j + 1); j += n; continue
            if b & 0x80:
                estado = b; j += 1
            tipo, canal = estado & 0xF0, estado & 0x0F
            if tipo in (0xC0, 0xD0):
                j += 1; continue
            a, v = d[j], d[j + 1]; j += 2
            if tipo == 0x90 and v > 0:
                evs.append((tick, "on", (canal, a, v)))
            elif tipo == 0x80 or (tipo == 0x90 and v == 0):
                evs.append((tick, "off", (canal, a)))
        pistas.append(evs); i = fin

    tempos = sorted((t, us) for p in pistas for (t, k, us) in p if k == "tempo") or [(0, 500000)]
    if tempos[0][0] != 0:
        tempos.insert(0, (0, 500000))

    def seg(tick):
        s, t0, us = 0.0, 0, tempos[0][1]
        for t, u in tempos[1:]:
            if t >= tick:
                break
            s += (t - t0) * us / div / 1e6; t0, us = t, u
        return s + (tick - t0) * us / div / 1e6

    notas = []
    for ip, p in enumerate(pistas):
        abiertas = {}
        for tick, k, x in sorted((e for e in p if e[1] != "tempo"), key=lambda e: (e[0], e[1] == "on")):
            if k == "on":
                abiertas.setdefault((x[0], x[1]), []).append((tick, x[2]))
            elif abiertas.get((x[0], x[1])):
                t0, vel = abiertas[(x[0], x[1])].pop(0)
                if x[0] == 9:
                    continue                         # canal 10 = percusión General MIDI: se ignora
                notas.append((seg(t0), seg(tick) - seg(t0), x[1], vel, ip))
    notas.sort()
    return notas, {"pistas": ntrk, "division": div, "cambios_de_tempo": len(tempos)}


def nombre(m):
    return ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"][m % 12] + str(m // 12 - 1)


def recortar(notas, tramos, fps=30):
    """tramos [[a, b], …] en segundos del MIDI → las notas de cada tramo, puestos uno tras otro.
    Cada tramo arranca en un cuadro entero, para que el resto siga en la rejilla."""
    out, base = [], 0.0
    for a, b in tramos:
        out += [(base + t - a, *resto) for t, *resto in notas if a <= t < b]
        base += round((b - a) * fps) / fps
    return out


def convertir(ruta, velocidad=1.0, desde=0.0, hasta=None, fps=30, tramos=None):
    notas, info = leer(ruta)
    if tramos:
        notas = recortar(notas, tramos, fps)
        info["tramos"] = tramos
    BPM = 112.5                                       # 16 cuadros por pulso a 30 fps: pulso = cuadro / 16
    cpp = 60 / BPM * fps
    pistas = {r[0]: {"nombre": r[0], "instrumento": r[0], "vol": 1.0, "pan": 0.0, "quien": r[3], "notas": []}
              for r in REGISTROS}
    fuera, visuales, vistos, t_ini = 0, 0, set(), None
    for t, dur, m, vel, _ in notas:
        t /= velocidad; dur /= velocidad
        if t < desde or (hasta is not None and t > hasta):
            continue
        if not PIANO[0] <= m <= PIANO[1]:
            visuales += 1
            continue
        t_ini = t if t_ini is None else t_ini
        cuadro = round((t - desde) * fps)
        mm = m
        while mm < REGISTROS[0][1]: mm += 12
        while mm > REGISTROS[-1][2]: mm -= 12
        fuera += mm != m
        inst = next(r for r in REGISTROS if r[1] <= mm <= r[2])
        clave = (cuadro, mm)
        if clave in vistos:                           # la misma nota dos veces en un cuadro suena como una
            continue
        vistos.add(clave)
        pistas[inst[0]]["notas"].append([cuadro / cpp, nombre(mm), max(dur * fps, 1) / cpp, round((vel / 127) ** 1.5, 3)])
    pans = {"bajo": -0.25, "arpa": 0.0, "campana": 0.3}
    out = {"nota": f"convertido de {Path(ruta).name} (velocidad ×{velocidad})", "bpm": BPM, "compas": 4, "fps": fps,
           "origen": {**info, "notas_midi": len(notas), "fuera_del_piano_quitadas": visuales,
                      "cambiadas_de_octava": fuera},
           "pistas": [{**p, "pan": pans[k]} for k, p in pistas.items() if p["notas"]]}
    return out


if __name__ == "__main__":
    a = list(sys.argv)
    if a[1:2] in (["-h"], ["--help"]):
        print(__doc__); sys.exit(0)
    opt = lambda k, d=None: a[a.index(k) + 1] if k in a else d
    tr = None
    if len(a) < 2 or a[1].startswith("--"):            # sin archivo: lo dice video.json
        import video as V
        M = V.C["midi"]
        a.insert(1, str(V.MIDI))
        tr = M.get("tramos") or None                     # [[0, 12.08], [116.45, 132.73]] o "0-12.08,116.45-132.73"
        if isinstance(tr, str):
            tr = [[float(x) for x in t.split("-")] for t in tr.split(",")]
        if opt("--velocidad") is None and M.get("velocidad"):
            a += ["--velocidad", str(M["velocidad"])]
        if opt("--salida") is None:
            a += ["--salida", str(V.CANCION)]
    if opt("--tramos"):
        tr = [[float(x) for x in s.split("-")] for s in opt("--tramos").split(",")]
    c = convertir(a[1], float(opt("--velocidad", 1)), float(opt("--desde", 0)),
                  float(opt("--hasta")) if opt("--hasta") else None, tramos=tr)
    sal = Path(opt("--salida", Path(a[1]).with_suffix(".json")))
    sal.write_text(json.dumps(c, ensure_ascii=False, indent=1), encoding="utf-8")
    n = sum(len(p["notas"]) for p in c["pistas"])
    print(f"{sal.name}: {n} notas · {', '.join(f'{p['nombre']} {len(p['notas'])}' for p in c['pistas'])} · "
          f"origen {c['origen']}")
