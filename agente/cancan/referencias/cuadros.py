"""Huella cuadro a cuadro de un video en una sola pasada de decodificación.

Salida en <out>/<nombre>_*:
  mosaico_N.png  TODOS los cuadros en miniatura (24 por fila = 1 s por fila a 24 fps), con su número
  slit.png       slit-scan: columna central y fila central de cada cuadro, una al lado de otra (tiempo → x)
  senales.png    luma, movimiento, flash, saturación, bordes y audio (onsets) en el mismo eje de cuadros
  senales.json   las señales por cuadro + cortes, flashes, inversiones y onsets detectados
Uso: python -I cuadros.py video.mp4 out_dir nombre
"""
import json, subprocess, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw

src, out, nombre = Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3]
out.mkdir(parents=True, exist_ok=True)
W, H = 160, 90
fps = 24.0

raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(src), "-vf", f"scale={W}:{H}:flags=area",
                      "-pix_fmt", "rgb24", "-f", "rawvideo", "-"], capture_output=True, check=True).stdout
F = np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3)
n = len(F)
f = F.astype(np.float32) / 255
luma = (f @ np.array([.299, .587, .114], np.float32))
mx, mn = f.max(-1), f.min(-1)
sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0).mean((1, 2))
lm = luma.mean((1, 2))
diff = np.r_[0, np.abs(np.diff(luma, axis=0)).mean((1, 2))]
gx = np.abs(np.diff(luma, axis=2)).mean((1, 2)); gy = np.abs(np.diff(luma, axis=1)).mean((1, 2))
edges = gx + gy
# inversión: el cuadro se parece más al negativo del anterior que al anterior
inv = np.zeros(n)
for i in range(1, n):
    a, b = luma[i] - luma[i].mean(), luma[i - 1] - luma[i - 1].mean()
    d = np.sqrt((a * a).sum() * (b * b).sum()) + 1e-9
    inv[i] = -(a * b).sum() / d          # >0.3 = probable negativo / impact frame
# contraste extremo (impact frame en blanco y negro): mucha masa en 0 y 1
bw = ((luma < .12) | (luma > .88)).mean((1, 2)) * (1 - np.clip(sat * 3, 0, 1))
dom = []
for i in range(n):                       # color dominante (media de los píxeles saturados)
    m = (mx[i] - mn[i]) > .25
    dom.append((f[i][m].mean(0) * 255).astype(int).tolist() if m.sum() > 50 else (f[i].mean((0, 1)) * 255).astype(int).tolist())

# audio
wav = subprocess.run(["ffmpeg", "-v", "error", "-i", str(src), "-ac", "1", "-ar", "22050", "-f", "f32le", "-"],
                     capture_output=True).stdout
onsets, env_f = [], np.zeros(n)
if wav:
    import librosa
    y = np.frombuffer(wav, np.float32)
    hop = int(22050 / fps)
    env = librosa.onset.onset_strength(y=y, sr=22050, hop_length=hop)
    env_f[:min(n, len(env))] = env[:n]
    onsets = librosa.onset.onset_detect(onset_envelope=env, sr=22050, hop_length=hop, units="frames").tolist()
    tempo, beats = librosa.beat.beat_track(onset_envelope=env, sr=22050, hop_length=hop)
    beats = beats.tolist(); tempo = float(np.atleast_1d(tempo)[0])
else:
    beats, tempo = [], 0

thr = np.median(diff) + 4 * np.median(np.abs(diff - np.median(diff)))
cortes = [i for i in range(1, n) if diff[i] > max(thr, .08) and diff[i] >= diff[max(0, i - 1)] and diff[i] >= diff[min(n - 1, i + 1)]]
flash = [i for i in range(1, n) if lm[i] - lm[i - 1] > .12]
inversiones = [i for i in range(1, n) if inv[i] > .3]
bn = [i for i in range(n) if bw[i] > .55]

# mosaico de todos los cuadros
TW, TH, COLS = 96, 54, 24
filas_por_img = 13
d = ImageDraw.Draw
for k in range(0, n, COLS * filas_por_img):
    lote = F[k:k + COLS * filas_por_img]
    rows = (len(lote) + COLS - 1) // COLS
    im = Image.new("RGB", (COLS * TW, rows * (TH + 11)), (20, 20, 20))
    dr = d(im)
    for j, fr in enumerate(lote):
        i = k + j
        x, yy = (j % COLS) * TW, (j // COLS) * (TH + 11)
        im.paste(Image.fromarray(fr).resize((TW, TH)), (x, yy + 11))
        col = (255, 60, 60) if i in cortes else (255, 255, 0) if (i in inversiones or i in bn) else (200, 200, 200)
        dr.text((x + 2, yy), f"{i}" + (" C" if i in cortes else "") + (" I" if i in inversiones else "") + (" B" if i in bn else ""), fill=col)
        if i in onsets:
            dr.rectangle([x, yy + 11, x + TW - 1, yy + 11 + TH - 1], outline=(0, 255, 255))
    im.save(out / f"{nombre}_mosaico_{k // (COLS * filas_por_img)}.png")

# slit-scan
sl = np.concatenate([F[:, :, W // 2, :][:, :, None, :].transpose(1, 0, 2, 3).reshape(H, n, 3),
                     np.full((4, n, 3), 255, np.uint8),
                     F[:, H // 2, :, :].transpose(1, 0, 2)], 0)
Image.fromarray(sl).resize((n * 3, sl.shape[0] * 2), Image.NEAREST).save(out / f"{nombre}_slit.png")

# señales
PW, ROW = max(n * 3, 600), 60
names = [("luma", lm), ("movimiento", diff / max(diff.max(), 1e-6)), ("negativo", np.clip(inv, 0, 1)),
         ("blanco/negro", bw), ("saturacion", sat), ("bordes", edges / max(edges.max(), 1e-6)),
         ("audio onset", env_f / max(env_f.max(), 1e-6))]
im = Image.new("RGB", (PW + 90, ROW * len(names) + 20), (16, 16, 16)); dr = d(im)
for r, (nm, s) in enumerate(names):
    y0 = 10 + r * ROW
    dr.text((2, y0 + 20), nm, fill=(220, 220, 220))
    pts = [(90 + i * PW / n, y0 + ROW - 6 - float(s[i]) * (ROW - 12)) for i in range(n)]
    dr.line(pts, fill=(120, 200, 255), width=1)
for i in cortes: dr.line([(90 + i * PW / n, 0), (90 + i * PW / n, 8)], fill=(255, 60, 60), width=2)
for b in beats: dr.line([(90 + b * PW / n, im.height - 8), (90 + b * PW / n, im.height)], fill=(0, 255, 120), width=2)
for s in range(0, int(n / fps) + 1): dr.text((90 + s * fps * PW / n, im.height - 10), str(s), fill=(150, 150, 150))
im.save(out / f"{nombre}_senales.png")

res = dict(cuadros=n, fps=fps, tempo=tempo, beats=beats, onsets=onsets, cortes=cortes, flashes=flash,
           inversiones=inversiones, blanco_negro=bn,
           por_cuadro=[dict(i=i, luma=round(float(lm[i]), 3), mov=round(float(diff[i]), 3), sat=round(float(sat[i]), 3),
                            neg=round(float(inv[i]), 2), bn=round(float(bw[i]), 2), color=dom[i]) for i in range(n)])
(out / f"{nombre}_senales.json").write_text(json.dumps(res), encoding="utf-8")
print(nombre, "cuadros", n, "tempo", round(tempo, 1), "cortes", len(cortes), "flashes", len(flash),
      "negativos", len(inversiones), "b/n", len(bn), "onsets", len(onsets))
print("cortes", cortes); print("negativos", inversiones); print("b/n", bn); print("flashes", flash)
print("beats", beats)
