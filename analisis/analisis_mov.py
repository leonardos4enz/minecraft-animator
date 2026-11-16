"""Análisis cuantitativo del movimiento del video de referencia (Benly).
- Cámara: correlación de fase entre cuadros (traslación global) → trayectoria y espectro del temblor.
- Cabeza y torso: seguimiento por correlación cruzada normalizada (template matching) con plantilla adaptativa.
- Dinámica: perfiles de velocidad, picos, simetría aceleración/frenado, sobrepaso, desfase cabeza-torso,
  y ajuste de un sistema masa-resorte-amortiguador (frecuencia natural y razón de amortiguamiento).
Uso: python analisis_mov.py <video> <carpeta_salida>"""
import json
import os
import subprocess
import sys

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from scipy import signal, ndimage

video, sal = sys.argv[1], sys.argv[2]
os.makedirs(sal, exist_ok=True)
W, H, FPS = 568, 240, 24
crudo = subprocess.run(["ffmpeg", "-v", "error", "-i", video, "-vf", f"scale={W}:{H},format=gray", "-f", "rawvideo", "-"],
                       capture_output=True, check=True).stdout
F = np.frombuffer(crudo, np.uint8).reshape(-1, H, W).astype(np.float32)
N = len(F)
t = np.arange(N) / FPS
# quitar grano: suavizado espacial ligero
Fs = np.stack([ndimage.gaussian_filter(f, 1.2) for f in F])

# ───────── cámara: correlación de fase sobre los bordes (fuera del personaje) ─────────
def fase(a, b):
    A, B = np.fft.fft2(a), np.fft.fft2(b)
    R = A * np.conj(B); R /= np.abs(R) + 1e-9
    r = np.real(np.fft.ifft2(R)); r = np.fft.fftshift(r)
    y, x = np.unravel_index(np.argmax(r), r.shape)
    # refinamiento subpixel (parábola)
    def sub(v, i, n):
        if 0 < i < n - 1:
            d = v[i - 1] - 2 * v[i] + v[i + 1]
            return i + (0.5 * (v[i - 1] - v[i + 1]) / d if d else 0)
        return i
    xs = sub(r[y, :], x, r.shape[1]); ys = sub(r[:, x], y, r.shape[0])
    return xs - r.shape[1] / 2, ys - r.shape[0] / 2

ventana = np.outer(np.hanning(H), np.hanning(W)).astype(np.float32)
mascara = np.ones((H, W), np.float32); mascara[:, int(W * 0.3):int(W * 0.68)] = 0      # tapar el centro (personaje)
cam = np.zeros((N, 2))
for i in range(1, N):
    a = (Fs[i] - Fs[i].mean()) * ventana * mascara
    b = (Fs[i - 1] - Fs[i - 1].mean()) * ventana * mascara
    dx, dy = fase(a, b)
    cam[i] = cam[i - 1] + [dx, dy]
cam_v = np.diff(cam, axis=0, prepend=cam[:1])

# ───────── seguimiento por template matching ─────────
def ncc_buscar(img, tpl, cx, cy, radio):
    th, tw = tpl.shape
    x0, y0 = int(max(0, cx - tw / 2 - radio)), int(max(0, cy - th / 2 - radio))
    x1, y1 = int(min(W, cx + tw / 2 + radio)), int(min(H, cy + th / 2 + radio))
    zona = img[y0:y1, x0:x1]
    if zona.shape[0] < th or zona.shape[1] < tw:
        return cx, cy, 0
    tz = (tpl - tpl.mean()) / (tpl.std() + 1e-6)
    num = signal.correlate(zona, tz, mode="valid")
    s1 = signal.correlate(zona, np.ones_like(tpl), mode="valid")
    s2 = signal.correlate(zona ** 2, np.ones_like(tpl), mode="valid")
    n = tpl.size
    den = np.sqrt(np.maximum(s2 - s1 ** 2 / n, 1e-6))
    c = num / den
    y, x = np.unravel_index(np.argmax(c), c.shape)
    return x0 + x + tw / 2, y0 + y + th / 2, c[y, x] / n

def seguir(cx, cy, tw, th, radio=22, mezcla=0.15):
    pos = np.zeros((N, 2)); calidad = np.zeros(N)
    tpl = Fs[0][int(cy - th / 2):int(cy + th / 2), int(cx - tw / 2):int(cx + tw / 2)].copy()
    for i in range(N):
        if i:
            cx, cy, q = ncc_buscar(Fs[i], tpl, cx, cy, radio)
            calidad[i] = q
            nuevo = Fs[i][int(cy - th / 2):int(cy + th / 2), int(cx - tw / 2):int(cx + tw / 2)]
            if nuevo.shape == tpl.shape:
                tpl = (1 - mezcla) * tpl + mezcla * nuevo
        pos[i] = cx, cy
    return pos, calidad

# posiciones iniciales (cuadro 0, escala 568x240): cabeza y pecho del personaje
cabeza, qc = seguir(300, 92, 64, 64)
torso, qt = seguir(300, 175, 50, 44)

def suav(x, s=1.0):
    return ndimage.gaussian_filter1d(x, s, axis=0)

# posición relativa a la cámara (aprox.: se resta el movimiento global)
cab_rel = suav(cabeza - cam)
tor_rel = suav(torso - cam)
v_cab = np.linalg.norm(np.gradient(cab_rel, axis=0), axis=1) * FPS     # px/s (en 568 px de ancho)
v_tor = np.linalg.norm(np.gradient(tor_rel, axis=0), axis=1) * FPS
v_cam = np.linalg.norm(suav(cam_v, 0.8), axis=1) * FPS

# ───────── métricas ─────────
def picos_mov(v, umbral):
    p, _ = signal.find_peaks(v, height=umbral, distance=int(0.35 * FPS), prominence=umbral * 0.5)
    eventos = []
    for k in p:
        # inicio y fin: donde la velocidad cae bajo 25 % del pico
        lim = v[k] * 0.25
        a = k
        while a > 0 and v[a] > lim: a -= 1
        b = k
        while b < len(v) - 1 and v[b] > lim: b += 1
        sube, baja = (k - a) / FPS, (b - k) / FPS
        eventos.append({"t": round(k / FPS, 2), "pico_px_s": round(float(v[k]), 1), "acelera_s": round(sube, 3), "frena_s": round(baja, 3),
                        "asimetria_frenado/acelerado": round(baja / max(sube, 1e-3), 2)})
    return eventos

ev_cab = picos_mov(v_cab, np.percentile(v_cab, 75))
ev_tor = picos_mov(v_tor, np.percentile(v_tor, 75))

# desfase cabeza vs torso (correlación cruzada de velocidades)
def desfase(a, b, max_lag=10):
    a = (a - a.mean()) / (a.std() + 1e-9); b = (b - b.mean()) / (b.std() + 1e-9)
    lags = range(-max_lag, max_lag + 1)
    c = [np.mean(a[max(0, l):len(a) + min(0, l)] * b[max(0, -l):len(b) - max(0, l)]) for l in lags]
    k = int(np.argmax(c))
    return list(lags)[k] / FPS, float(c[k])
lag_s, lag_c = desfase(v_cab, v_tor)

# sobrepaso: en cada frenado de la cabeza, ¿la velocidad en X cambia de signo (rebote) después del pico?
vx = np.gradient(cab_rel[:, 0]) * FPS
sobrepasos = []
for e in ev_cab:
    k = int(e["t"] * FPS)
    tramo = vx[k:k + int(0.6 * FPS)]
    if len(tramo) > 3 and abs(vx[k]) > 1e-3:
        signo = np.sign(vx[k])
        reb = tramo[np.sign(tramo) == -signo]
        if len(reb):
            sobrepasos.append(round(float(np.abs(reb).max() / abs(vx[k])), 2))

# ajuste masa-resorte-amortiguador a la respuesta de la cabeza: estimar ζ con el decremento logarítmico
zetas = [ (lambda d: d / np.sqrt(4 * np.pi ** 2 + d ** 2))(np.log(1 / max(r, 1e-3))) for r in sobrepasos if 0 < r < 1]

# micro-movimiento en reposo: velocidad residual en los tramos más quietos
quieto = v_cab < np.percentile(v_cab, 30)
micro = float(np.median(v_cab[quieto]))

# espectro del temblor de cámara (posición sin la deriva lenta)
cam_alta = cam - ndimage.gaussian_filter1d(cam, 6, axis=0)
f, P = signal.welch(cam_alta[:, 0], fs=FPS, nperseg=64)
f2, P2 = signal.welch(cam_alta[:, 1], fs=FPS, nperseg=64)
fpico = float(f[np.argmax(P[1:]) + 1]); fpico_y = float(f2[np.argmax(P2[1:]) + 1])
amp_cam = (np.std(cam_alta, axis=0) / W * 100).tolist()     # % del ancho del cuadro

# espectro de la cabeza (ritmo de los movimientos)
fc, Pc = signal.welch(cab_rel[:, 1] - ndimage.gaussian_filter1d(cab_rel[:, 1], 12), fs=FPS, nperseg=64)

res = {
    "cuadros": N, "fps": FPS,
    "calidad_seguimiento": {"cabeza": round(float(np.median(qc[1:])), 3), "torso": round(float(np.median(qt[1:])), 3)},
    "camara": {"temblor_std_%ancho": [round(a, 3) for a in amp_cam], "frec_dominante_x_Hz": round(fpico, 2), "frec_dominante_y_Hz": round(fpico_y, 2),
               "deriva_total_px": [round(float(v), 1) for v in cam[-1]]},
    "cabeza": {"eventos": ev_cab, "micro_mov_reposo_px_s": round(micro, 2), "sobrepasos_relativos": sobrepasos,
               "zeta_estimado": [round(z, 2) for z in zetas],
               "asimetria_media": round(float(np.mean([e["asimetria_frenado/acelerado"] for e in ev_cab])), 2) if ev_cab else None},
    "torso": {"eventos": ev_tor},
    "desfase_cabeza_vs_torso_s": round(lag_s, 3), "correlacion": round(lag_c, 2),
}
json.dump(res, open(os.path.join(sal, "metricas.json"), "w"), ensure_ascii=False, indent=1)
print(json.dumps(res, ensure_ascii=False, indent=1))

# ───────── gráficas ─────────
plt.rcParams.update({"figure.facecolor": "#14151d", "axes.facecolor": "#1b1d28", "axes.edgecolor": "#555", "text.color": "#ddd",
                     "axes.labelcolor": "#ddd", "xtick.color": "#aaa", "ytick.color": "#aaa", "grid.color": "#333"})
fig, ax = plt.subplots(4, 1, figsize=(12, 11), sharex=False)
ax[0].plot(t, v_cab, color="#ff3d8b", label="cabeza"); ax[0].plot(t, v_tor, color="#22c8b4", label="torso", alpha=.8)
ax[0].plot(t, v_cam, color="#f5a524", label="cámara", alpha=.6); ax[0].set_ylabel("velocidad (px/s)"); ax[0].legend(); ax[0].grid(True)
ax[0].set_title("Velocidad en pantalla (relativa a la cámara)")
ax[1].plot(t, cab_rel[:, 0] - cab_rel[0, 0], color="#ff3d8b", label="cabeza x"); ax[1].plot(t, cab_rel[:, 1] - cab_rel[0, 1], color="#ff77ad", ls="--", label="cabeza y")
ax[1].plot(t, tor_rel[:, 0] - tor_rel[0, 0], color="#22c8b4", label="torso x"); ax[1].set_ylabel("desplazamiento (px)"); ax[1].legend(); ax[1].grid(True)
ax[1].set_title("Trayectorias (arcos y sobrepasos)")
ax[2].plot(t, cam[:, 0], color="#f5a524", label="cámara x"); ax[2].plot(t, cam[:, 1], color="#7c6cff", label="cámara y")
ax[2].set_ylabel("px acumulados"); ax[2].set_xlabel("s"); ax[2].legend(); ax[2].grid(True); ax[2].set_title("Movimiento de la cámara en mano")
ax[3].semilogy(f, P, color="#f5a524", label="temblor cámara x"); ax[3].semilogy(f2, P2, color="#7c6cff", label="temblor cámara y")
ax[3].semilogy(fc, Pc, color="#ff3d8b", label="cabeza (alta frec.)"); ax[3].set_xlabel("Hz"); ax[3].legend(); ax[3].grid(True)
ax[3].set_title("Espectro de potencia")
fig.tight_layout(); fig.savefig(os.path.join(sal, "graficas.png"), dpi=110)

# hoja de seguimiento: cuadros con la caja de la cabeza
fig2, axs = plt.subplots(3, 4, figsize=(16, 7))
for k, a in enumerate(axs.flat):
    i = int(k * (N - 1) / 11)
    a.imshow(F[i], cmap="gray"); a.set_axis_off(); a.set_title(f"{t[i]:.2f}s", fontsize=9)
    for (p, c, s) in ((cabeza, "#ff3d8b", 64), (torso, "#22c8b4", 50)):
        a.add_patch(plt.Rectangle((p[i, 0] - s / 2, p[i, 1] - s / 2), s, s, fill=False, color=c, lw=1.5))
fig2.tight_layout(); fig2.savefig(os.path.join(sal, "seguimiento.png"), dpi=90)
