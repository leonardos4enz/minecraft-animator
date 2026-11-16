"""Análisis por tomas para videos con cortes (tráilers): compara original y réplica toma por toma.

  python analisis/analisis_tomas.py <original.mp4> <replica.mp4> <carpeta_salida>

Mide (NumPy/SciPy, sin IA):
- Cortes: diferencia de histogramas de color entre cuadros + fundidos (luminancia → negro).
- Ritmo: duración de cada toma y qué tan cerca cae cada corte de la réplica del corte del original.
- Cámara: traslación por correlación de fase dentro de cada toma (no cruza cortes) → velocidad en % del ancho/s.
- Movimiento: energía de diferencia entre cuadros ya compensada la cámara (lo que se mueve en el cuadro).
- Imagen: luminancia, saturación, temperatura (R/B), contraste y nitidez (varianza del laplaciano).
- Audio: volumen (RMS) cada 0.1 s, tempo por autocorrelación, golpes de bajo y su distancia a los cortes.
La réplica se mide en las MISMAS ventanas de tiempo que las tomas del original (toma a toma).
Escribe tomas.json y tomas.png en la carpeta de salida."""
import json
import os
import subprocess
import sys

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from scipy import ndimage, signal

FPS, W, H = 24, 320, 180


def cuadros(video):
    crudo = subprocess.run(["ffmpeg", "-v", "error", "-i", video, "-vf", f"fps={FPS},scale={W}:{H}", "-pix_fmt", "rgb24", "-f", "rawvideo", "-"],
                           capture_output=True, check=True).stdout
    return np.frombuffer(crudo, np.uint8).reshape(-1, H, W, 3).astype(np.float32)


def fase(a, b):
    A, B = np.fft.fft2(a), np.fft.fft2(b)
    R = A * np.conj(B); R /= np.abs(R) + 1e-9
    r = np.fft.fftshift(np.real(np.fft.ifft2(R)))
    y, x = np.unravel_index(np.argmax(r), r.shape)
    return x - r.shape[1] / 2, y - r.shape[0] / 2


def medir(video):
    C = cuadros(video)
    n = len(C)
    G = C.mean(-1)
    hist = np.stack([np.concatenate([np.histogram(c[..., k], 24, (0, 255))[0] for k in range(3)]) for c in C]).astype(np.float32)
    hist /= hist.sum(1, keepdims=True)
    dh = np.zeros(n); dh[1:] = 0.5 * np.abs(np.diff(hist, axis=0)).sum(1)
    lum = np.zeros(n); sat = np.zeros(n); temp = np.zeros(n); contr = np.zeros(n); nit = np.zeros(n)
    for i, c in enumerate(C):
        mx, mn = c.max(-1), c.min(-1)
        sat[i] = ((mx - mn) / (mx + 1e-6)).mean()
        l = 0.2126 * c[..., 0] + 0.7152 * c[..., 1] + 0.0722 * c[..., 2]
        lum[i] = l.mean(); contr[i] = l.std(); temp[i] = c[..., 0].mean() / (c[..., 2].mean() + 1e-6)
        nit[i] = ndimage.laplace(ndimage.gaussian_filter(l, 0.7)).var()
    # cortes: salto aislado (no un paneo) en el histograma de color o en los pixeles
    pd = np.zeros(n); pd[1:] = np.abs(np.diff(G, axis=0)).mean((1, 2)) / 255
    cortes = []
    for i in range(1, n):
        vec = slice(max(0, i - 6), i + 6)
        salto_h = dh[i] > 0.2 and dh[i] > 3 * np.median(dh[vec])
        salto_p = pd[i] > 0.07 and pd[i] > 3 * np.median(pd[vec])
        if (salto_h or salto_p) and not lum[i] < 6 and (not cortes or i - cortes[-1] >= 4):
            cortes.append(i)
    # fundidos a negro: entrada/salida de luminancia casi cero
    negro = lum < 6
    bordes = [i for i in range(1, n) if negro[i] != negro[i - 1]]
    for i in bordes:
        if not any(abs(i - c) < 4 for c in cortes):
            cortes.append(i)
    cortes.sort()
    # cámara y movimiento dentro de cada toma
    vent = np.outer(np.hanning(H), np.hanning(W)).astype(np.float32)
    cam = np.zeros((n, 2)); ener = np.zeros(n)
    Gs = [ndimage.gaussian_filter(g, 1.0) for g in G]
    corteSet = set(cortes)
    for i in range(1, n):
        if i in corteSet or negro[i]:
            continue
        dx, dy = fase((Gs[i] - Gs[i].mean()) * vent, (Gs[i - 1] - Gs[i - 1].mean()) * vent)
        if abs(dx) > W / 4 or abs(dy) > H / 4:
            continue
        cam[i] = [dx, dy]
        prev = ndimage.shift(Gs[i - 1], (dy, dx), order=1, mode="nearest")
        d = np.abs(Gs[i] - prev); d[d < 6] = 0
        ener[i] = d[8:-8, 8:-8].mean()
    return dict(n=n, cortes=cortes, dh=dh, lum=lum, sat=sat, temp=temp, contr=contr, nit=nit, cam=cam, ener=ener, negro=negro)


def audio(video):
    sr = 16000
    x = np.frombuffer(subprocess.run(["ffmpeg", "-v", "error", "-i", video, "-vn", "-ac", "1", "-ar", str(sr), "-f", "f32le", "-"],
                                     capture_output=True).stdout, np.float32)
    if len(x) < sr:
        return None
    paso = sr // 10
    rms = np.array([np.sqrt((x[i:i + paso] ** 2).mean()) for i in range(0, len(x) - paso, paso)])
    f, t, S = signal.stft(x, fs=sr, nperseg=1024, noverlap=1024 - 160)
    M = np.log1p(np.abs(S) * 100)
    flux = np.maximum(0, np.diff(M, axis=1)).sum(0); flux = (flux - flux.mean()) / (flux.std() + 1e-9)
    hop = 160 / sr
    ac = np.correlate(flux, flux, "full")[len(flux) - 1:]
    lags = np.arange(len(ac)) * hop
    r = (lags > 60 / 200) & (lags < 60 / 70)
    bpm = 60 / lags[r][np.argmax(ac[r])]
    bajo = np.maximum(0, np.diff(M[(f > 30) & (f < 150)].sum(0))); bajo /= bajo.max() + 1e-9
    pk, _ = signal.find_peaks(bajo, height=0.35, distance=int(0.2 / hop))
    cen = (f[:, None] * np.abs(S)).sum(0) / (np.abs(S).sum(0) + 1e-9)
    return dict(rms=rms, bpm=float(bpm), golpes=t[1:][pk], centroide=float(np.median(cen[np.abs(S).sum(0) > np.percentile(np.abs(S).sum(0), 40)])))


def por_toma(m, ventanas):
    out = []
    for a, b in ventanas:
        s = slice(a, max(a + 1, b))
        vel = np.hypot(*m["cam"][s].T) * FPS / W * 100
        out.append(dict(ini=round(a / FPS, 3), dur=round((b - a) / FPS, 3), camara_pct_s=round(float(np.median(vel)), 1),
                        movimiento=round(float(m["ener"][s].mean()), 2), luminancia=round(float(m["lum"][s].mean()), 1),
                        saturacion=round(float(m["sat"][s].mean()), 3), temperatura=round(float(m["temp"][s].mean()), 2),
                        contraste=round(float(m["contr"][s].mean()), 1), nitidez=round(float(m["nit"][s].mean()), 1)))
    return out


def main():
    orig, rep, sal = sys.argv[1:4]
    os.makedirs(sal, exist_ok=True)
    A, B = medir(orig), medir(rep)
    n = min(A["n"], B["n"])
    va = [0] + A["cortes"] + [A["n"]]
    ventanas = [(va[i], va[i + 1]) for i in range(len(va) - 1)]
    tA, tB = por_toma(A, ventanas), por_toma(B, [(a, min(b, B["n"])) for a, b in ventanas if a < B["n"]])
    # cortes: el corte de la réplica más cercano a cada corte del original
    dif = []
    for c in A["cortes"]:
        cerca = min(B["cortes"], key=lambda x: abs(x - c)) if B["cortes"] else None
        dif.append(None if cerca is None else round((cerca - c) / FPS, 3))
    acertados = sum(1 for d in dif if d is not None and abs(d) <= 2 / FPS)
    auA, auB = audio(orig), audio(rep)
    k = lambda key: ([t[key] for t in tA[:len(tB)]], [t[key] for t in tB])
    corr = lambda a, b: float(np.corrcoef(a, b)[0, 1]) if len(a) > 2 and np.std(a) > 0 and np.std(b) > 0 else 0.0
    resumen = {}
    for key in ["camara_pct_s", "movimiento", "luminancia", "saturacion", "temperatura", "contraste", "nitidez"]:
        a, b = k(key)
        resumen[key] = {"original": round(float(np.mean(a)), 3), "replica": round(float(np.mean(b)), 3), "correlacion_por_toma": round(corr(a, b), 2)}
    golpe_corte = {}
    for nombre, au, m in [("original", auA, A), ("replica", auB, B)]:
        if au is None:
            continue
        cs = np.array(m["cortes"]) / FPS
        d = [float(np.min(np.abs(au["golpes"] - c))) for c in cs] if len(au["golpes"]) else []
        golpe_corte[nombre] = {"bpm": round(au["bpm"], 1), "centroide_hz": round(au["centroide"]), "cortes_con_golpe_a_<0.1s": int(sum(x < 0.1 for x in d)), "cortes": len(cs),
                               "rms_medio": round(float(au["rms"].mean()), 4)}
    if auA is not None and auB is not None:
        m2 = min(len(auA["rms"]), len(auB["rms"]))
        golpe_corte["correlacion_volumen"] = round(corr(auA["rms"][:m2], auB["rms"][:m2]), 2)
    res = {"cortes_original_s": [round(c / FPS, 3) for c in A["cortes"]], "cortes_replica_s": [round(c / FPS, 3) for c in B["cortes"]],
           "desfase_corte_replica_s": dif, "cortes_a_<=2_cuadros": f"{acertados}/{len(A['cortes'])}",
           "resumen": resumen, "audio": golpe_corte, "tomas_original": tA, "tomas_replica": tB}
    json.dump(res, open(os.path.join(sal, "tomas.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)

    t = np.arange(n) / FPS
    fig, ax = plt.subplots(5, 1, figsize=(14, 13), sharex=True)
    for c in A["cortes"]: [a.axvline(c / FPS, color="#c33", lw=0.6, alpha=0.5) for a in ax]
    for c in B["cortes"]: ax[0].axvline(c / FPS, color="#36c", lw=0.8, ls="--", ymax=0.5)
    ax[0].plot(t, A["dh"][:n], color="#c33", lw=0.8, label="original"); ax[0].plot(t, B["dh"][:n], color="#36c", lw=0.8, label="réplica")
    ax[0].set_ylabel("cambio de\nhistograma"); ax[0].legend(loc="upper right"); ax[0].set_title("Cortes: rojo = original, azul punteado = réplica")
    sm = lambda x: ndimage.gaussian_filter1d(x[:n], 2)
    ax[1].plot(t, sm(A["ener"]), color="#c33"); ax[1].plot(t, sm(B["ener"]), color="#36c"); ax[1].set_ylabel("movimiento\n(sin cámara)")
    ax[2].plot(t, sm(np.hypot(*A["cam"].T)), color="#c33"); ax[2].plot(t, sm(np.hypot(*B["cam"].T)), color="#36c"); ax[2].set_ylabel("cámara\npx/cuadro")
    ax[3].plot(t, sm(A["sat"]), color="#c33"); ax[3].plot(t, sm(B["sat"]), color="#36c")
    ax3 = ax[3].twinx(); ax3.plot(t, sm(A["lum"]), color="#c33", ls=":"); ax3.plot(t, sm(B["lum"]), color="#36c", ls=":")
    ax[3].set_ylabel("saturación (—)\nluminancia (···)")
    if auA is not None and auB is not None:
        ta = np.arange(len(auA["rms"])) / 10; tb = np.arange(len(auB["rms"])) / 10
        ax[4].plot(ta, 20 * np.log10(auA["rms"] + 1e-5), color="#c33"); ax[4].plot(tb, 20 * np.log10(auB["rms"] + 1e-5), color="#36c")
    ax[4].set_ylabel("audio dB"); ax[4].set_xlabel("segundos")
    plt.tight_layout(); plt.savefig(os.path.join(sal, "tomas.png"), dpi=90)
    print(json.dumps({k2: res[k2] for k2 in ["cortes_a_<=2_cuadros", "resumen", "audio"]}, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
