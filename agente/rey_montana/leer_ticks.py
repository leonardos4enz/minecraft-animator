"""Lee un MIDI en ticks: notas [(tick, dur, nota, vel, pista)], tempos [(tick, us)], compases [(tick, num, den)], división."""
import struct
from pathlib import Path


def _vlq(d, i):
    v = 0
    while True:
        b = d[i]; i += 1
        v = (v << 7) | (b & 0x7F)
        if not b & 0x80:
            return v, i


def leer(ruta):
    d = Path(ruta).read_bytes()
    _, ntrk, div = struct.unpack(">HHH", d[8:14])
    i, notas, tempos, compases = 14, [], [], []
    for ip in range(ntrk):
        while d[i:i + 4] != b"MTrk":
            i += 8 + struct.unpack(">I", d[i + 4:i + 8])[0]
        largo = struct.unpack(">I", d[i + 4:i + 8])[0]
        j, fin, tick, estado, abiertas = i + 8, i + 8 + largo, 0, 0, {}
        while j < fin:
            dt, j = _vlq(d, j); tick += dt
            b = d[j]
            if b == 0xFF:
                tipo = d[j + 1]; n, j = _vlq(d, j + 2)
                if tipo == 0x51:
                    tempos.append((tick, int.from_bytes(d[j:j + 3], "big")))
                elif tipo == 0x58:
                    compases.append((tick, d[j], 2 ** d[j + 1]))
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
                abiertas.setdefault(a, []).append((tick, v))
            elif tipo == 0x80 or tipo == 0x90:
                if abiertas.get(a):
                    t0, vel = abiertas[a].pop(0)
                    notas.append((t0, tick - t0, a, vel, ip))
        i = fin
    return sorted(notas), sorted(tempos), sorted(compases), div
