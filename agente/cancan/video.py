"""La configuración de un video musical: lee `video.json` de esta carpeta (lo propio de la canción y del video).

    import video as V          → V.C (el JSON), V.DUR, V.CUADROS, V.FPS, V.TOMAS y las rutas de los archivos
    python agente/orquesta/video.py   → muestra el resumen y comprueba que las secciones cubran el video sin huecos

Las rutas de video.json son relativas a esta carpeta, salvo `destino` (relativo a la raíz del programa). Así, al copiar
la carpeta a agente/<video>/ cada copia lee su propio video.json.
"""
import json, math
from pathlib import Path

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parents[1]
REL = AQUI.relative_to(RAIZ).as_posix()                   # "agente/orquesta": así lo leen los efectos del motor
FPS = 30
C = json.loads((AQUI / "video.json").read_text(encoding="utf-8"))

BASE = C["base"]
CANCION = AQUI / f"{BASE}.json"                           # midi.py → partitura.py
WAV = AQUI / f"{BASE}.wav"
EVENTOS = AQUI / f"{BASE}_eventos.json"
ESCUCHAR = AQUI / f"{BASE}_escuchar.mp3"
MIDI = AQUI / C["midi"]["archivo"]
PROYECTO = C["proyecto"]["archivo"]                       # agente/proyectos/<PROYECTO>.json y `abrir {"nombre": …}`
DESTINO = RAIZ / C.get("destino", f"Videos/{C['titulo']} (LTezla).mp4")


def _duracion():
    if C.get("duracion"):
        return C["duracion"]
    d = json.loads(EVENTOS.read_text(encoding="utf-8"))["duracion"]       # la partitura, hasta el cuadro de arriba
    return round(math.ceil(d * FPS - 1e-6) / FPS, 4)


DUR = _duracion()
CUADROS = round(DUR * FPS)
T_CLIMAX = C["ecualizador"]["desde"]

# las secciones como las lee rollo.py: (inicio, fin, nombre, cámara, opciones)
_NO_OP = ("desde", "hasta", "nombre", "camara")
TOMAS = [(s["desde"], DUR if s["hasta"] == "fin" else s["hasta"], s["nombre"], s["camara"],
          {k: v for k, v in s.items() if k not in _NO_OP and not k.startswith("_")}) for s in C["secciones"]]


def comprobar():
    """las secciones van de 0 a la duración, una detrás de otra"""
    errores, t = [], 0.0
    for a, b, nombre, camara, op in TOMAS:
        if abs(a - t) > 1e-6:
            errores.append(f"«{nombre}» empieza en {a} y la anterior termina en {t}")
        if b <= a:
            errores.append(f"«{nombre}» dura {b - a:.2f} s")
        if not any(k in camara for k in ("plan", "dron", "fija", "claves")):
            errores.append(f"«{nombre}»: la cámara necesita plan, dron, fija o claves")
        t = b
    if abs(t - DUR) > 1e-6:
        errores.append(f"las secciones terminan en {t} y el video dura {DUR}")
    return errores


if __name__ == "__main__":
    print(f"{C['titulo']} · {C['cancion']} · {DUR} s = {CUADROS} cuadros · {len(TOMAS)} secciones · "
          f"ecualizador desde {T_CLIMAX} s · proyecto {PROYECTO} · {DESTINO.relative_to(RAIZ)}")
    for a, b, nombre, camara, op in TOMAS:
        print(f"  {a:7.2f}–{b:7.2f}  {nombre:<20} {next(iter(camara))}")
    e = comprobar()
    print("\n".join(e) if e else "secciones: bien")
