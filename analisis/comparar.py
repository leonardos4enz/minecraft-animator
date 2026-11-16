"""Compara la réplica con el video original usando las MISMAS métricas en los dos.

Perspectivas:
  1. Cinemática (movimiento): energía de movimiento del personaje (diferencia entre cuadros, con la cámara
     compensada), su espectro, cuánto tiempo está "quieto" y la forma de los arranques/frenados.
  2. Cámara: movimiento global por correlación de fase (deriva, temblor, frecuencias).
  3. Óptica: nitidez (varianza del laplaciano) del personaje vs. el fondo → foco y profundidad de campo.
  4. Color y fotografía: luminancia, contraste, saturación, temperatura (R/B), grano.
  5. Composición: dónde está y qué tan grande se ve el personaje (centro de masa del movimiento).
  6. Audio: inicio de cada frase (Whisper), energía y brillo (centroide espectral) de la voz.
  7. Similitud global por tramo (correlación de las curvas en ventanas de 2 s).

Uso: python comparar.py original.mp4 replica.mp4 carpeta_salida
"""
import json
import os
import subprocess
import sys

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from scipy import ndimage, signal

orig, rep, sal = sys.argv[1], sys.argv[2], sys.argv[3]
os.makedirs(sal, exist_ok=True)
W, H, FPS = 568, 240, 24


def cuadros(video, color=False):
    fmt = "rgb24" if color else "gray"
    crudo = subprocess.run(["ffmpeg", "-v", "error", "-i", video, "-vf", f"fps={FPS},scale={W}:{H}", "-pix_fmt", fmt, "-f", "rawvideo", "-"],
                           capture_output=True, check=True).stdout
    c = 3 if color else 1
    return np.frombuffer(crudo, np.uint8).reshape(-1, H, W, c).astype(np.float32).squeeze()


def fase(a, b):
    A, B = np.fft.fft2(a), np.fft.fft2(b)
    R = A * np.conj(B); R /= np.abs(R) + 1e-9
    r = np.fft.fftshift(np.real(np.fft.ifft2(R)))
    y, x = np.unravel_index(np.argmax(r), r.shape)
    return x - r.shape[1] / 2, y - r.shape[0] / 2


def medir(video):
    G = cuadros(video)
    C = cuadros(video, color=True)
    n = len(G)
    vent = np.outer(np.hanning(H), np.hanning(W)).astype(np.float32)
    borde = np.ones((H, W), np.float32); borde[:, int(W * .28):int(W * .72)] = 0
    centro = np.zeros((H, W), bool); centro[int(H * .08):int(H * .95), int(W * .25):int(W * .75)] = True
    cam = np.zeros((n, 2)); energia = np.zeros(n); cx = np.zeros(n); cy = np.zeros(n); area = np.zeros(n)
    nit_p = np.zeros(n); nit_f = np.zeros(n); grano = np.zeros(n)
    Gs = [ndimage.gaussian_filter(g, 1.0) for g in G]
    for i in range(n):
        lap = ndimage.laplace(Gs[i])
        nit_p[i] = lap[centro].var(); nit_f[i] = lap[~centro].var()
        hp = G[i] - ndimage.gaussian_filter(G[i], 1.5)
        grano[i] = np.median(np.abs(hp[:H // 6, :]))            # techo (zona plana): grano
        if i == 0:
            continue
        dx, dy = fase((Gs[i] - Gs[i].mean()) * vent * borde, (Gs[i - 1] - Gs[i - 1].mean()) * vent * borde)
        cam[i] = cam[i - 1] + [dx, dy]
        prev = ndimage.shift(Gs[i - 1], (dy, dx), order=1, mode="nearest")   # compensar la cámara
        d = np.abs(Gs[i] - prev) * centro
        d[d < 6] = 0                                                        # quitar grano
        energia[i] = d.mean()
        if d.sum() > 0:
            ys, xs = np.nonzero(d)
            w = d[ys, xs]
            cx[i] = (xs * w).sum() / w.sum() / W; cy[i] = (ys * w).sum() / w.sum() / H
            area[i] = (d > 12).sum() / centro.sum()
    hsv_s = []; lum = []; temp = []; contr = []
    for c in C:
        r, g, b = c[..., 0], c[..., 1], c[..., 2]
        mx, mn = c.max(-1), c.min(-1)
        hsv_s.append(((mx - mn) / (mx + 1e-6)).mean()); l = 0.2126 * r + 0.7152 * g + 0.0722 * b
        lum.append(l.mean()); contr.append(l.std()); temp.append(r.mean() / (b.mean() + 1e-6))
    return dict(n=n, cam=cam, energia=ndimage.gaussian_filter1d(energia, 1), cx=cx, cy=cy, area=area,
                nit_p=nit_p, nit_f=nit_f, grano=grano, sat=np.array(hsv_s), lum=np.array(lum), contr=np.array(contr), temp=np.array(temp))


def audio_info(video):
    crudo = subprocess.run(["ffmpeg", "-v", "error", "-i", video, "-vn", "-ac", "1", "-ar", "16000", "-f", "f32le", "-"], capture_output=True).stdout
    x = np.frombuffer(crudo, np.float32)
    paso = 1600
    rms = np.array([np.sqrt((x[i:i + paso] ** 2).mean()) for i in range(0, len(x) - paso, paso)])
    f, t, S = signal.spectrogram(x, fs=16000, nperseg=1024, noverlap=512)
    cen = (f[:, None] * S).sum(0) / (S.sum(0) + 1e-12)
    voz = S.sum(0) > np.percentile(S.sum(0), 60)
    return dict(rms=rms, centroide=float(np.median(cen[voz])) if voz.any() else 0.0)


def whisper(video):
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        return []
    m = WhisperModel("large-v3", device="cpu", compute_type="int8")
    segs, _ = m.transcribe(video, language="es", word_timestamps=True)
    return [(w.start, w.end, w.word.strip()) for s in segs for w in s.words]


A, B = medir(orig), medir(rep)
n = min(A["n"], B["n"])
t = np.arange(n) / FPS


def corr(a, b):
    a, b = a[:n], b[:n]
    if a.std() < 1e-9 or b.std() < 1e-9:
        return 0.0
    return float(np.corrcoef(a, b)[0, 1])


def espectro(e):
    f, P = signal.welch(e - e.mean(), fs=FPS, nperseg=64)
    return f, P / (P.sum() + 1e-12)


def quieto(e):
    return float((e < np.percentile(np.concatenate([A["energia"], B["energia"]]), 25)).mean())


def tramos(e):
    # forma de los movimientos: picos de energía y su asimetría (frenado / arranque)
    pk, _ = signal.find_peaks(e, prominence=e.std() * 0.6, distance=int(0.3 * FPS))
    asim = []
    for k in pk:
        lim = e[k] * 0.35; a = k; b = k
        while a > 0 and e[a] > lim: a -= 1
        while b < len(e) - 1 and e[b] > lim: b += 1
        asim.append((b - k) / max(1, k - a))
    return len(pk), float(np.median(asim)) if asim else 0.0


camA = A["cam"] - ndimage.gaussian_filter1d(A["cam"], 8, axis=0)
camB = B["cam"] - ndimage.gaussian_filter1d(B["cam"], 8, axis=0)
fA, PA = espectro(A["energia"]); fB, PB = espectro(B["energia"])
pkA, asA = tramos(A["energia"]); pkB, asB = tramos(B["energia"])
auA, auB = audio_info(orig), audio_info(rep)
wA, wB = whisper(orig), whisper(rep)


def m(x): return float(np.mean(x[:n]))


res = {
    "movimiento": {
        "energia_media": [m(A["energia"]), m(B["energia"])],
        "energia_p90": [float(np.percentile(A["energia"], 90)), float(np.percentile(B["energia"], 90))],
        "tiempo_quieto_%": [quieto(A["energia"]) * 100, quieto(B["energia"]) * 100],
        "frec_media_Hz": [float((fA * PA).sum()), float((fB * PB).sum())],
        "picos_de_movimiento": [pkA, pkB],
        "asimetria_frenado/arranque": [asA, asB],
        "correlacion_curvas": corr(A["energia"], B["energia"]),
    },
    "camara": {
        "temblor_std_px": [float(np.std(camA)), float(np.std(camB))],
        "deriva_total_px": [A["cam"][n - 1].tolist(), B["cam"][n - 1].tolist()],
    },
    "optica": {
        "nitidez_personaje": [m(A["nit_p"]), m(B["nit_p"])],
        "nitidez_fondo": [m(A["nit_f"]), m(B["nit_f"])],
        "separacion_foco(personaje/fondo)": [m(A["nit_p"]) / (m(A["nit_f"]) + 1e-9), m(B["nit_p"]) / (m(B["nit_f"]) + 1e-9)],
        "primer_segundo_desenfocado(nitidez 0-0.3s / 1-2s)": [float(A["nit_p"][:7].mean() / (A["nit_p"][24:48].mean() + 1e-9)), float(B["nit_p"][:7].mean() / (B["nit_p"][24:48].mean() + 1e-9))],
    },
    "color": {
        "luminancia": [m(A["lum"]), m(B["lum"])], "contraste": [m(A["contr"]), m(B["contr"])],
        "saturacion": [m(A["sat"]), m(B["sat"])], "temperatura_R/B": [m(A["temp"]), m(B["temp"])],
        "grano": [m(A["grano"]), m(B["grano"])],
    },
    "composicion": {
        "x_personaje_medio": [float(np.mean(A["cx"][A["cx"] > 0])), float(np.mean(B["cx"][B["cx"] > 0]))],
        "y_personaje_medio": [float(np.mean(A["cy"][A["cy"] > 0])), float(np.mean(B["cy"][B["cy"] > 0]))],
        "area_en_movimiento": [m(A["area"]), m(B["area"])],
    },
    "audio": {
        "voz_centroide_Hz": [auA["centroide"], auB["centroide"]],
        "rms_medio": [float(auA["rms"].mean()), float(auB["rms"].mean())],
        "correlacion_volumen": float(np.corrcoef(auA["rms"][:min(len(auA["rms"]), len(auB["rms"]))], auB["rms"][:min(len(auA["rms"]), len(auB["rms"]))])[0, 1]),
        "palabras_original": [(round(a, 2), w) for a, _, w in wA], "palabras_replica": [(round(a, 2), w) for a, _, w in wB],
    },
}
# similitud por tramos de 2 s (movimiento)
tr = []
for s0 in range(0, int(n / FPS), 2):
    a, b = A["energia"][:n][s0 * FPS:(s0 + 2) * FPS], B["energia"][:n][s0 * FPS:(s0 + 2) * FPS]
    tr.append({"tramo": f"{s0}-{s0 + 2}s", "energia_orig": float(a.mean()), "energia_rep": float(b.mean()),
               "correlacion": float(np.corrcoef(a, b)[0, 1]) if a.std() > 1e-6 and b.std() > 1e-6 else 0.0})
res["tramos"] = tr
json.dump(res, open(os.path.join(sal, "comparacion.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1, default=float)

# ───── gráficas ─────
plt.rcParams.update({"figure.facecolor": "#14151d", "axes.facecolor": "#1b1d28", "axes.edgecolor": "#555", "text.color": "#ddd",
                     "axes.labelcolor": "#ddd", "xtick.color": "#aaa", "ytick.color": "#aaa", "grid.color": "#333"})
o, r_ = "#22c8b4", "#ff3d8b"
fig, ax = plt.subplots(6, 1, figsize=(13, 17))
ax[0].plot(t, A["energia"][:n], color=o, label="original"); ax[0].plot(t, B["energia"][:n], color=r_, label="réplica"); ax[0].set_title("Energía de movimiento del personaje (cámara compensada)")
ax[1].plot(t, A["nit_p"][:n], color=o, label="original personaje"); ax[1].plot(t, B["nit_p"][:n], color=r_, label="réplica personaje")
ax[1].plot(t, A["nit_f"][:n], color=o, ls="--", label="original fondo"); ax[1].plot(t, B["nit_f"][:n], color=r_, ls="--", label="réplica fondo"); ax[1].set_title("Nitidez (foco): personaje vs fondo")
ax[2].plot(t, A["cam"][:n, 1] - A["cam"][0, 1], color=o, label="original y"); ax[2].plot(t, B["cam"][:n, 1] - B["cam"][0, 1], color=r_, label="réplica y")
ax[2].plot(t, A["cam"][:n, 0], color=o, ls="--", label="original x"); ax[2].plot(t, B["cam"][:n, 0], color=r_, ls="--", label="réplica x"); ax[2].set_title("Movimiento de cámara (px)")
ax[3].plot(t, A["area"][:n], color=o, label="original"); ax[3].plot(t, B["area"][:n], color=r_, label="réplica"); ax[3].set_title("Tamaño del personaje en movimiento (fracción del centro)")
ax[4].plot(t, A["lum"][:n], color=o, label="lum orig"); ax[4].plot(t, B["lum"][:n], color=r_, label="lum réplica")
ax4 = ax[4].twinx(); ax4.plot(t, A["sat"][:n], color=o, ls=":"); ax4.plot(t, B["sat"][:n], color=r_, ls=":"); ax[4].set_title("Luminancia (línea) y saturación (punteado)")
ta = np.arange(len(auA["rms"])) / 10; tb = np.arange(len(auB["rms"])) / 10
ax[5].plot(ta, auA["rms"], color=o, label="original"); ax[5].plot(tb, auB["rms"], color=r_, label="réplica")
for a_, _, w in wA: ax[5].axvline(a_, color=o, alpha=.25)
for a_, _, w in wB: ax[5].axvline(a_, color=r_, alpha=.25)
ax[5].set_title("Volumen del audio y comienzo de cada palabra (Whisper)")
for a in ax: a.grid(True); a.legend(loc="upper right", fontsize=8); a.set_xlabel("s")
fig.tight_layout(); fig.savefig(os.path.join(sal, "comparacion.png"), dpi=95)
print(json.dumps({k: v for k, v in res.items() if k != "audio"}, ensure_ascii=False, indent=1, default=float))
print("audio:", json.dumps({k: v for k, v in res["audio"].items() if not k.startswith("palabras")}, default=float))
print("palabras orig:", res["audio"]["palabras_original"])
print("palabras rep :", res["audio"]["palabras_replica"])
