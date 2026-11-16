"""Referencia para comparar de oído: el mismo MIDI con un piano sintético simple (no son bloques).

    python agente/orquesta/referencia_piano.py <archivo.mid> <salida.wav> [--tramos a-b,c-d]

Sólo suena la0–do8, como en un piano real. Cada nota es aditiva (6 armónicos con caída exponencial), dura lo que dura
en el MIDI (hasta 2 s) y tiene 80 ms de salida.
"""
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

sys.path.insert(0, str(Path(__file__).parent))
import midi as M

SR = 22050


def plantilla(m, largo):
    f = 440 * 2 ** ((m - 69) / 12)
    t = np.arange(largo) / SR
    y = np.zeros(largo, np.float32)
    for h in range(1, 7):
        if f * h > SR / 2:
            break
        y += (0.6 ** (h - 1)) * np.sin(2 * np.pi * f * h * t) * np.exp(-t * (1.5 + 0.8 * h) * (f / 440) ** 0.3)
    ataque = min(largo, int(0.004 * SR))
    y[:ataque] *= np.linspace(0, 1, ataque)
    return y


def main():
    a = sys.argv
    notas, _ = M.leer(a[1])
    if "--tramos" in a:
        tr = [[float(x) for x in s.split("-")] for s in a[a.index("--tramos") + 1].split(",")]
        notas = M.recortar(notas, tr)
    notas = [n for n in notas if M.PIANO[0] <= n[2] <= M.PIANO[1]]
    fin = max(t + d for t, d, *_ in notas) + 2
    y = np.zeros(int(fin * SR), np.float32)
    MAX = int(2.0 * SR)
    tpl = {m: plantilla(m, MAX + int(0.08 * SR)) for m in range(M.PIANO[0], M.PIANO[1] + 1)}
    vistos = set()
    for t, d, m, vel, _ in notas:
        clave = (round(t * 30), m)
        if clave in vistos:
            continue
        vistos.add(clave)
        n = min(MAX, max(int(d * SR), int(0.05 * SR)))
        rel = int(0.08 * SR)
        s = tpl[m][: n + rel].copy()
        s[n:] *= np.linspace(1, 0, len(s) - n)
        i = int(t * SR)
        j = min(len(y), i + len(s))
        y[i:j] += s[: j - i] * (vel / 127)
    y /= max(1e-9, np.abs(y).max()) / 10 ** (-1 / 20)
    sf.write(a[2], y, SR)
    print(f"{a[2]}: {fin - 2:.1f} s · {len(vistos)} notas")


if __name__ == "__main__":
    main()
