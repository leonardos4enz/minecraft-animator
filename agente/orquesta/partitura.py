"""La orquesta de bloques: partitura → audio con los bloques musicales reales + eventos.json.

    python agente/orquesta/partitura.py <cancion.json>          → <cancion>.wav + <cancion>_eventos.json
    python agente/orquesta/partitura.py <cancion.json> --comprobar   además mide con librosa que cada nota suene en su cuadro
    python agente/orquesta/partitura.py [--comprobar]                sin archivo: <base>.json de video.json

La canción es un JSON:
    {"bpm": 112.5, "compas": 4, "fps": 30,
     "pistas": [{"nombre": "melodia", "instrumento": "arpa", "vol": 1.0, "pan": 0.0, "quien": "bloques",
                 "notas": [[pulso, "E4", duracion_en_pulsos], [pulso, "R", 1], ...]}]}
- `pulso` cuenta negras desde 0 (puede ser 0.5, 0.25…). Con bpm 112.5 y 30 fps, una semicorchea = 4 cuadros exactos:
  todas las notas caen EN un cuadro, no entre dos.
- Notas como en el juego: cada instrumento cubre 2 octavas (pitch 0.5–2.0) alrededor de su nota base; fuera de rango
  es un error, porque en Minecraft no se puede tocar.
- Percusión (bombo, caja, platillo): la nota se ignora; usa "x".
"""
import json, math, sys
from pathlib import Path

import numpy as np
import soundfile as sf

RAIZ = Path(__file__).resolve().parents[2]
NOTE = RAIZ / "texturas_mc" / "sonidos" / "note"
SR = 48000

# instrumento → (archivo, nota base con pitch 1.0). Las bases se midieron con librosa.pyin sobre cada .ogg
# (ver ledger.md); coinciden con minecraft.wiki: arpa fa#3–fa#5, bajo fa#1–fa#3, campana fa#5–fa#7, etc.
INSTRUMENTOS = {
    "arpa": ("harp2.ogg", "F#4"), "bajo": ("bassattack.ogg", "F#2"), "campana": ("bell.ogg", "F#6"),
    "flauta": ("flute.ogg", "F#5"), "guitarra": ("guitar.ogg", "F#3"), "carillon": ("icechime.ogg", "F#6"),
    "xilofono": ("xylobone.ogg", "F#6"), "vibrafono": ("iron_xylophone.ogg", "F#4"), "cencerro": ("cow_bell.ogg", "F#5"),
    "didgeridoo": ("didgeridoo.ogg", "F#2"), "bit": ("bit.ogg", "F#4"), "banjo": ("banjo.ogg", "F#4"),
    "pling": ("pling.ogg", "F#4"),
    "bombo": ("bd.ogg", None), "caja": ("snare.ogg", None), "platillo": ("hat.ogg", None),
}
NOMBRES = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}


def midi(n):
    """'F#4' → 66, 'Bb3' → 58."""
    letra, resto = n[0].upper(), n[1:]
    alt = 0
    while resto and resto[0] in "#b":
        alt += 1 if resto[0] == "#" else -1
        resto = resto[1:]
    return 12 * (int(resto) + 1) + NOMBRES[letra] + alt


_cache = {}


def muestra(archivo):
    if archivo not in _cache:
        import librosa
        y, _ = librosa.load(NOTE / archivo, sr=SR, mono=True)
        _cache[archivo] = y.astype(np.float32)
    return _cache[archivo]


def afinar(y, pitch):
    """Como el juego: cambia la velocidad de reproducción (más agudo = más corto)."""
    if abs(pitch - 1) < 1e-6:
        return y
    n = int(len(y) / pitch)
    return np.interp(np.arange(n) * pitch, np.arange(len(y)), y).astype(np.float32)


def generar(ruta):
    ruta = Path(ruta)
    c = json.loads(ruta.read_text(encoding="utf-8"))
    bpm, fps = c["bpm"], c.get("fps", 30)
    seg_pulso = 60.0 / bpm
    eventos, fin = [], 0.0
    for p in c["pistas"]:
        archivo, base = INSTRUMENTOS[p["instrumento"]]
        for pulso, nota, dur, *fuerza in p["notas"]:     # 4.º campo opcional: fuerza de la nota (velocity del MIDI)
            if nota == "R":
                continue
            t = pulso * seg_pulso
            cuadro = t * fps
            if abs(cuadro - round(cuadro)) > 1e-6:
                raise SystemExit(f"{p['nombre']}: la nota del pulso {pulso} cae entre cuadros ({cuadro:.3f}); "
                                 f"usa un bpm con semicorcheas de cuadros enteros (112.5, 90, 150…)")
            ev = {"t": round(t, 6), "cuadro": int(round(cuadro)), "pista": p["nombre"], "instrumento": p["instrumento"],
                  "quien": p.get("quien", "bloques"), "pulso": pulso, "dur": dur * seg_pulso, "vol": p.get("vol", 1.0) * (fuerza[0] if fuerza else 1.0),
                  "pan": p.get("pan", 0.0)}
            if base:
                m, mb = midi(nota), midi(base)
                clics = m - mb + 12                       # los 25 clics del bloque musical: 0 = pitch 0.5
                if not 0 <= clics <= 24:
                    raise SystemExit(f"{p['nombre']}: {nota} fuera del rango del {p['instrumento']} en Minecraft "
                                     f"({base} ± 1 octava)")
                ev.update(nota=nota, midi=m, clics=clics, pitch=round(2 ** ((m - mb) / 12), 6))
            else:
                ev.update(nota="x", pitch=1.0)
            eventos.append(ev)
            fin = max(fin, t + dur * seg_pulso)

    eventos.sort(key=lambda e: (e["t"], e["pista"]))
    largo = int((fin + 1.5) * SR)
    mezcla = np.zeros((largo, 2), np.float32)
    for e in eventos:
        y = afinar(muestra(INSTRUMENTOS[e["instrumento"]][0]), e["pitch"]) * e["vol"]
        i = int(round(e["t"] * SR))
        izq, der = math.cos((e["pan"] + 1) * math.pi / 4), math.sin((e["pan"] + 1) * math.pi / 4)
        j = min(largo, i + len(y))
        mezcla[i:j, 0] += y[: j - i] * izq
        mezcla[i:j, 1] += y[: j - i] * der
    pico = float(np.abs(mezcla).max())
    if pico > 0:
        mezcla *= 10 ** (-1.0 / 20) / pico                # pico a −1 dBFS; la sonoridad final la pone mezcla.py

    wav = ruta.with_suffix(".wav")
    sf.write(wav, mezcla, SR, subtype="PCM_24")
    salida = {"cancion": ruta.name, "bpm": bpm, "fps": fps, "duracion": round(fin, 3),
              "total_eventos": len(eventos),
              "por_pista": {p["nombre"]: sum(e["pista"] == p["nombre"] for e in eventos) for p in c["pistas"]},
              "eventos": eventos}
    js = ruta.with_name(ruta.stem + "_eventos.json")
    js.write_text(json.dumps(salida, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{wav.name}: {fin:.2f} s · {len(eventos)} eventos · {salida['por_pista']}")
    return wav, salida


def comprobar(wav, salida):
    """Cada pista se toca sola y se compara su ataque medido con el cuadro de la partitura."""
    import librosa
    fps = salida["fps"]
    PAD = 0.5                                             # el detector no ve un ataque en la muestra 0: medio s de silencio antes
    errores = []
    for pista in salida["por_pista"]:
        evs = [e for e in salida["eventos"] if e["pista"] == pista]
        largo = int((salida["duracion"] + 1.5 + PAD) * SR)
        y = np.zeros(largo, np.float32)
        for e in evs:
            s = afinar(muestra(INSTRUMENTOS[e["instrumento"]][0]), e["pitch"])
            i = int(round((e["t"] + PAD) * SR)); j = min(largo, i + len(s))
            y[i:j] += s[: j - i]
        # onset_detect junta golpes de la misma nota a 1–2 cuadros (Rush E): en su lugar se busca, alrededor de cada nota,
        # el máximo local del flujo espectral que sobresale de su entorno (no usa umbrales globales)
        hop = 64
        env = librosa.onset.onset_strength(y=y, sr=SR, hop_length=hop)
        tt = librosa.frames_to_time(np.arange(len(env)), sr=SR, hop_length=hop) - PAD
        pico = (env > np.roll(env, 1)) & (env >= np.roll(env, -1)) & (env > np.median(env) + 0.1 * env.std())
        ons = tt[pico]
        for e in evs:
            if len(ons) == 0:
                errores.append(1e9); continue
            errores.append(float(np.min(np.abs(ons - e["t"]))))
    err = np.array(errores) * 1000
    dentro = float(np.mean(err <= 1000 / fps / 2) * 100)
    print(f"comprobación: {len(err)} notas · error mediano {np.median(err):.1f} ms · máximo {err.max():.1f} ms · "
          f"{dentro:.1f} % dentro de medio cuadro ({1000 / fps / 2:.1f} ms)")
    return {"notas": len(err), "mediana_ms": round(float(np.median(err)), 2), "max_ms": round(float(err.max()), 2),
            "pct_medio_cuadro": round(dentro, 1)}


if __name__ == "__main__":
    if sys.argv[1:2] in (["-h"], ["--help"]):
        print(__doc__); sys.exit(0)
    if len(sys.argv) < 2 or sys.argv[1].startswith("--"):     # sin archivo: la canción de video.json
        sys.path.insert(0, str(Path(__file__).resolve().parent))
        import video as V
        sys.argv.insert(1, str(V.CANCION))
    wav, salida = generar(sys.argv[1])
    if "--comprobar" in sys.argv:
        r = comprobar(wav, salida)
        js = Path(sys.argv[1]).with_name(Path(sys.argv[1]).stem + "_comprobacion.json")
        js.write_text(json.dumps(r, indent=1), encoding="utf-8")
