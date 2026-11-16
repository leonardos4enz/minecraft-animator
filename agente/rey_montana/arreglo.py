"""Arreglo virtuoso de "En la gruta del rey de la montaña" (Grieg) para piano, escrito por nosotros sobre el MIDI de Mutopia.

    python agente/rey_montana/arreglo.py            → rey_montana_virtuoso.mid

La base es rey_montana.mid (Mutopia-2013/12/07-1888, dominio público, 88 compases de 4/4, 384 ticks por negra).
No se cambia ninguna nota de Grieg: sólo se le suma encima, y todo lo que se suma sale de las notas que ya suenan en ese
tiempo (octavas, arpegios del acorde del tiempo, trémolos del bajo) o de la escala de si menor armónica (escalas rápidas
entre secciones). Además lleva el acelerando del original (el MIDI de Mutopia sólo salta de 138 a 154).

Secciones del MIDI (compases, desde 1):
  1 llamada de trompas · 2–25 tema bajo (si menor, fa# mayor, si menor) · 26–41 tema con acordes · 42–49 bajo en tresillos
  50–73 fortissimo · 74–85 coda (golpes con apoyaturas) · 86–88 trémolo y acorde final
"""
import struct
from pathlib import Path

import leer_ticks as L

AQUI = Path(__file__).parent
BASE, SALIDA = AQUI / "rey_montana.mid", AQUI / "rey_montana_virtuoso.mid"

NOTAS, _, _, DIV = L.leer(BASE)
COMPAS = DIV * 4
SEMI = DIV // 4                                   # semicorchea
BAJO_MIN, ALTO_MAX = 30, 102                      # fa#1–fa#7: lo que tocan los bloques sin doblar de octava
ESCALA = {11, 1, 2, 4, 6, 7, 10}                  # si menor armónica: si do# re mi fa# sol la#

# pista 1 = mano derecha (Grieg), 2 = mano izquierda (Grieg), 3 = adornos (nuestros)
extra = []


def t(c, tiempo=0.0):
    """tick del compás c (desde 1) y el tiempo (en negras, desde 0)."""
    return (c - 1) * COMPAS + round(tiempo * DIV)


def poner(tick, nota, vel, dur=SEMI, pista=3):
    if BAJO_MIN <= nota <= ALTO_MAX:
        extra.append((tick, dur, nota, max(1, min(127, vel)), pista))


def de(c0, c1, pista=None):
    """notas originales de los compases c0..c1 (inclusive)."""
    return [n for n in NOTAS if t(c0) <= n[0] < t(c1 + 1) and (pista is None or n[4] == pista)]


def suenan(tick):
    """alturas de Grieg que suenan en ese tick (empiezan antes y no han terminado)."""
    return sorted({n[2] for n in NOTAS if n[0] <= tick < n[0] + max(n[1], DIV // 2)})


def octavas(c0, c1, pista, salto, dvel=-10):
    for tk, d, m, v, _ in de(c0, c1, pista):
        poner(tk, m + salto, v + dvel, d)


def arpegios(c0, c1, lo, hi, vel, por_tiempo=4, subir=True):
    """semicorcheas (o tresillos con por_tiempo=3) con las notas del acorde que suena en cada tiempo, en [lo, hi]."""
    paso = DIV // por_tiempo
    for c in range(c0, c1 + 1):
        for b in range(4):
            tk = t(c, b)
            clases = {m % 12 for m in suenan(tk)}
            if len(clases) < 2:
                continue
            notas = [m for m in range(lo, hi + 1) if m % 12 in clases]
            if not subir:
                notas = notas[::-1]
            for k in range(por_tiempo):
                poner(tk + k * paso, notas[(b * por_tiempo + k) % len(notas)], vel + (6 if k == 0 else 0), paso)


def tremolo_bajo(c0, c1, vel):
    """semicorcheas alternando la nota más grave de cada tiempo y su octava."""
    for c in range(c0, c1 + 1):
        for b in range(4):
            tk = t(c, b)
            graves = [m for m in suenan(tk) if m < 60]
            if not graves:
                continue
            g = min(graves)
            while g < BAJO_MIN:
                g += 12
            for k in range(4):
                poner(tk + k * SEMI, g + (12 if k % 2 else 0), vel + (8 if k == 0 else 0))


def escala(fin_tick, hasta, n, dur_total, vel0, vel1, bajar=False):
    """n notas de si menor armónica que llegan (por arriba o por abajo) a `hasta` justo en fin_tick."""
    notas, m = [], hasta
    while len(notas) < n:
        m += 1 if bajar else -1
        if m % 12 in ESCALA:
            notas.append(m)
    notas = notas[::-1]
    for k, m in enumerate(notas):
        poner(fin_tick - dur_total + k * dur_total // n, m, round(vel0 + (vel1 - vel0) * k / n), dur_total // n)


def acorde(tick, clases, lo, hi, vel, dur=DIV):
    for m in range(lo, hi + 1):
        if m % 12 in clases:
            poner(tick, m, vel, dur)


# --- 2–25: el tema entra solo; a partir del 10 un eco dos octavas arriba, y en el 18 la mano izquierda en octavas
octavas(10, 17, 1, +24, dvel=-22)
octavas(18, 25, 1, +12, dvel=-12)
octavas(18, 25, 2, +12, dvel=-12)
escala(t(26), 71, 12, DIV, 50, 80)                                    # sube hasta si4

# --- 26–41: tema con acordes, melodía en octavas; en el 34 empiezan los arpegios
octavas(26, 41, 1, +12, dvel=-8)
arpegios(34, 41, 54, 78, 52)
escala(t(42), 83, 16, DIV, 60, 95)                                    # sube hasta si5

# --- 42–49: bajo en tresillos de Grieg; arriba tresillos agudos y melodía en tres octavas
octavas(42, 49, 1, +12, dvel=-6)
octavas(42, 49, 1, -12, dvel=-14)
arpegios(42, 49, 79, 98, 58, por_tiempo=3)
escala(t(50), 95, 24, 2 * DIV, 70, 110)                               # dos octavas hasta si6

# --- 50–73: fortissimo. Trémolo en el bajo, arpegios en el medio y octavas abajo
octavas(50, 73, 1, -12, dvel=-6)
tremolo_bajo(50, 73, 78)
arpegios(50, 57, 54, 78, 64)
arpegios(58, 65, 54, 78, 68, subir=False)
arpegios(66, 73, 54, 78, 72)
escala(t(74), 47, 22, 2 * DIV, 110, 70, bajar=True)                   # cascada de si6 a si2 en el silencio del 73

# --- 74–85: coda. Cada golpe con su acorde en tres octavas y la apoyatura convertida en escala cromática
for tk, d, m, v, p in de(74, 85):
    if p == 2 and m >= 50:                                            # acorde de la izquierda (re fa sol# si)
        poner(tk, m + 12, v + 20, d)
        poner(tk, m + 24, v + 15, d)
    if p == 2 and m < 50:
        poner(tk, m + 12 if m < BAJO_MIN else m, v + 25, d)
    if p == 1 and m == 92:                                            # sol#6: la apoyatura arranca más abajo
        for k, x in enumerate(range(85, 92)):
            poner(tk - (7 - k) * 12, x, 70 + 5 * k, 12)
octavas(76, 77, 1, -12, dvel=+10)
octavas(80, 81, 1, -12, dvel=+15)
octavas(80, 81, 1, -24, dvel=+5)

# --- 86–88: trémolo de si con el acorde arriba, arpegio que sube todo el teclado y el acorde final
for c in (86, 87):
    for k in range(16):
        tk = t(c) + k * SEMI
        if c == 86 and tk < t(86, 2):
            continue
        sube = (tk - t(86, 2)) / (t(88) - t(86, 2))
        poner(tk, [71, 74, 78, 74][k % 4], round(60 + 50 * sube))
arp = [m for m in range(47, 100) if m % 12 in {11, 2, 6}]             # si2 → si6
for k, m in enumerate(arp):
    poner(t(87) + k * (COMPAS // len(arp)), m, 70 + 3 * k, COMPAS // len(arp))
golpe = next(n[0] for n in de(88, 88, 1) if n[2] == 95)               # el si6 del último golpe
acorde(golpe, {11, 2, 6}, 35, 95, 120, 2 * DIV)


# --- tempo: acelerando por tiempo, de 112 a 216 negras/min (exponencial del 10 al 73), coda a 216
def bpm(c):
    if c <= 9:
        return 112
    if c <= 73:
        return 112 * (216 / 112) ** ((c - 9) / 64)
    return 216


tempos = []
for c in range(1, 89):
    for b in range(4):
        x = bpm(c) if c <= 9 or c > 73 else 112 * (216 / 112) ** ((c - 9 + b / 4) / 64)
        tempos.append((t(c, b), round(60e6 / x)))


# --- escribir
def vlq(v):
    b = [v & 0x7F]
    v >>= 7
    while v:
        b.append(0x80 | (v & 0x7F)); v >>= 7
    return bytes(b[::-1])


def pista(eventos, nombre):
    """eventos [(tick, orden, bytes)] → bloque MTrk."""
    datos, ahora = bytearray(), 0
    n = nombre.encode("utf-8")
    datos += b"\x00\xff\x03" + vlq(len(n)) + n
    for tk, _, ev in sorted(eventos):
        datos += vlq(tk - ahora) + ev
        ahora = tk
    datos += b"\x00\xff\x2f\x00"
    return b"MTrk" + struct.pack(">I", len(datos)) + datos


def notas_a_eventos(notas, canal):
    evs = []
    for tk, d, m, v, _ in notas:
        evs.append((tk, 1, bytes([0x90 | canal, m, v])))
        evs.append((tk + max(1, d), 0, bytes([0x80 | canal, m, 0])))
    return evs + [(0, -1, bytes([0xC0 | canal, 0]))]               # piano


def limpiar(notas):
    """la misma altura en el mismo tick una sola vez (la más fuerte)."""
    vistas = {}
    for n in notas:
        k = (n[0], n[2])
        if k not in vistas or n[3] > vistas[k][3]:
            vistas[k] = n
    return sorted(vistas.values())


def main():
    originales = set((n[0], n[2]) for n in NOTAS)
    nuevas = limpiar([n for n in extra if (n[0], n[2]) not in originales])
    cab = b"MThd" + struct.pack(">IHHH", 6, 1, 4, DIV)
    t0 = [(0, -2, b"\xff\x58\x04\x04\x02\x18\x08")] + [(tk, -1, b"\xff\x51\x03" + us.to_bytes(3, "big")) for tk, us in tempos]
    texto = "Grieg, Op. 46 No. 4 (dominio publico, Mutopia 1888). Arreglo virtuoso: LTezla".encode()
    t0.append((0, -3, b"\xff\x01" + vlq(len(texto)) + texto))
    SALIDA.write_bytes(cab
                       + pista(t0, "En la gruta del rey de la montana")
                       + pista(notas_a_eventos([n for n in NOTAS if n[4] == 1], 0), "Mano derecha (Grieg)")
                       + pista(notas_a_eventos([n for n in NOTAS if n[4] == 2], 1), "Mano izquierda (Grieg)")
                       + pista(notas_a_eventos(nuevas, 2), "Adornos (arreglo)"))
    print(f"{SALIDA.name}: {len(NOTAS)} notas de Grieg + {len(nuevas)} del arreglo = {len(NOTAS) + len(nuevas)}")


if __name__ == "__main__":
    main()
