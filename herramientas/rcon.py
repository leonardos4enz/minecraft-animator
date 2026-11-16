"""Manda comandos a un servidor de Minecraft local por RCON (el generador de agente/mundo_real/servidor).

    python herramientas/rcon.py "locate biome minecraft:flower_forest" ["otro comando" …]

Lee el puerto de server.properties y la contraseña de .rcon (la carpeta del servidor por defecto).
"""
import socket, struct, sys
from pathlib import Path

SERV = Path(__file__).resolve().parents[1] / "agente" / "mundo_real" / "servidor"


def _paquete(i, tipo, cuerpo):
    b = cuerpo.encode("utf-8") + b"\x00\x00"
    return struct.pack("<iii", len(b) + 8, i, tipo) + b


def _leer(s):
    n = struct.unpack("<i", s.recv(4))[0]
    d = b""
    while len(d) < n:
        d += s.recv(n - len(d))
    i, tipo = struct.unpack("<ii", d[:8])
    return i, d[8:-2].decode("utf-8", "replace")


def comandos(lista, carpeta=SERV):
    props = dict(l.split("=", 1) for l in (carpeta / "server.properties").read_text().splitlines() if "=" in l and not l.startswith("#"))
    s = socket.create_connection(("127.0.0.1", int(props["rcon.port"])), timeout=120)
    s.sendall(_paquete(1, 3, (carpeta / ".rcon").read_text().strip()))
    i, _ = _leer(s)
    if i == -1:
        raise SystemExit("RCON: contraseña rechazada")
    out = []
    for k, c in enumerate(lista, start=2):
        s.sendall(_paquete(k, 2, c))
        out.append(_leer(s)[1])
    s.close()
    return out


if __name__ == "__main__":
    for c, r in zip(sys.argv[1:], comandos(sys.argv[1:])):
        print(f"> {c}\n{r}")
