"""Elige la toma de cada línea (Whisper: que diga exactamente el texto; luego la más expresiva y que no se pase de 145 ppm)
y detecta el pulso de la música. Escribe agente/creeper/audio_analisis.json.   python agente/creeper/analizar_audio.py"""
import difflib
import json
import os
import re
import subprocess
import sys

import numpy as np

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(os.path.dirname(AQUI))
sys.path.insert(0, AQUI)
import guion  # noqa: E402

AUD = json.load(open(os.path.join(AQUI, "audio.json"), encoding="utf-8"))


def pcm(arch, sr=16000):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", os.path.join(RAIZ, arch), "-ac", "1", "-ar", str(sr), "-f", "f32le", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).copy()


def norm(s):
    s = re.sub(r"\[[^\]]*\]", "", s.lower())
    s = s.translate(str.maketrans("áéíóúü", "aeiouu"))
    return re.sub(r"[^a-zñ ]", "", s).split()


def voz_rango(x, sr=16000):
    """inicio y fin de la voz (envolvente RMS de 10 ms sobre −40 dB del pico)"""
    w = sr // 100
    e = np.sqrt(np.convolve(x * x, np.ones(w) / w, "same"))
    th = e.max() * 10 ** (-40 / 20)
    idx = np.where(e > th)[0]
    return (idx[0] / sr, idx[-1] / sr) if len(idx) else (0, len(x) / sr)


from faster_whisper import WhisperModel  # noqa: E402
modelo = WhisperModel("small", device="cpu", compute_type="int8")
res = {"lineas": {}}
for k, textos in guion.LINEAS.items():
    tomas = {}
    for lado, texto in zip("AB", textos):
        arch = AUD[f"{k}{lado}"]
        x = pcm(arch)
        segs, _ = modelo.transcribe(os.path.join(RAIZ, arch), language="es", beam_size=5)
        oido = " ".join(s.text for s in segs).strip()
        sim = difflib.SequenceMatcher(None, norm(texto), norm(oido)).ratio()
        a, b = voz_rango(x)
        palabras = len(norm(texto))
        ppm = palabras / max(0.1, b - a) * 60
        tomas[lado] = {"archivo": arch, "oido": oido, "parecido": round(sim, 3), "voz_in": round(a, 3), "voz_out": round(b, 3),
                       "dur": round(len(x) / 16000, 3), "ppm": round(ppm, 1)}
    # regla: texto exacto primero (parecido ≥ 0.9); entre las que cumplen, v3 (más actuada) si no pasa de 160 ppm
    ok = [l for l in "AB" if tomas[l]["parecido"] >= 0.9]
    elegida = "A" if "A" in ok and tomas["A"]["ppm"] <= 160 else ("B" if "B" in ok else max("AB", key=lambda l: tomas[l]["parecido"]))
    res["lineas"][k] = {"tomas": tomas, "elegida": elegida}
    print(k, elegida, {l: (t["parecido"], t["ppm"], round(t["voz_out"] - t["voz_in"], 2)) for l, t in tomas.items()}, "|", tomas[elegida]["oido"], flush=True)

# ───── música: pulso, compases y golpes ─────
import librosa  # noqa: E402
y, sr = librosa.load(os.path.join(RAIZ, AUD["musica"]), sr=22050, mono=True)
tempo, beats = librosa.beat.beat_track(y=y, sr=sr, units="time")
onset = librosa.onset.onset_strength(y=y, sr=sr)
tiempos = librosa.times_like(onset, sr=sr)
rms = librosa.feature.rms(y=y)[0]
t_rms = librosa.times_like(rms, sr=sr)
# energía por segundo (para ver la parada y la entrada del final)
seg = [round(float(rms[(t_rms >= s) & (t_rms < s + 1)].mean()), 4) for s in range(int(len(y) / sr))]
fuertes = tiempos[np.argsort(-onset)[:25]]
res["musica"] = {"archivo": AUD["musica"], "dur": round(len(y) / sr, 3), "bpm": round(float(np.atleast_1d(tempo)[0]), 2),
                 "beats": [round(float(b), 3) for b in beats], "rms_por_segundo": seg,
                 "golpes_fuertes": sorted(round(float(t), 3) for t in fuertes)}
print("bpm", res["musica"]["bpm"], "beats", len(beats), "dur", res["musica"]["dur"])
print("rms/s", seg)
print("golpes", res["musica"]["golpes_fuertes"])
json.dump(res, open(os.path.join(AQUI, "audio_analisis.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
