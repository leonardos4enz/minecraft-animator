"""Destellos por segundo (pares de cambios opuestos > 0.1 de luminancia relativa, el más oscuro < 0.8) en pantalla
completa, mitades y cuadrantes. Uso: python -P destellos.py video.mp4"""
import subprocess, sys, numpy as np
W, H = 96, 170
raw = subprocess.run(["ffmpeg", "-v", "error", "-i", sys.argv[1], "-vf", f"scale={W}:{H}", "-pix_fmt", "rgb24", "-f", "rawvideo", "-"], capture_output=True).stdout
F = np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3).astype(np.float32) / 255
Y = np.where(F <= 0.04045, F / 12.92, ((F + 0.055) / 1.055) ** 2.4) @ np.array([0.2126, 0.7152, 0.0722], np.float32)
def maximo(s):
    c = []
    for i in range(1, len(s)):
        d = s[i] - s[i - 1]
        if abs(d) > 0.1 and min(s[i], s[i - 1]) < 0.8:
            sg = 1 if d > 0 else -1
            if not c or c[-1][1] != sg: c.append((i, sg))
    idx = np.array([i for i, _ in c] or [-99])
    return max((((idx >= a) & (idx < a + 30)).sum() / 2, a) for a in range(len(s)))
h, w = H // 2, W // 2
zonas = {"completa": Y, "arriba": Y[:, :h], "abajo": Y[:, h:], "izq": Y[:, :, :w], "der": Y[:, :, w:],
         "cuad1": Y[:, :h, :w], "cuad2": Y[:, :h, w:], "cuad3": Y[:, h:, :w], "cuad4": Y[:, h:, w:]}
for k, z in zonas.items():
    n, a = maximo(z.mean((1, 2))); print(f"{k:9s} máx {n:.1f}/s en {a / 30:.1f} s")
