"""Exporta la película por tramos (la exportación completa de una sola vez cuelga la ventana en el título con
supermuestreo), los une sin perder cuadros y pone la mezcla de mezcla.py.

  python agente/creeper/ensamblar.py v2            → Videos/El_creeper_era_un_cerdo_v2.mp4
  python agente/creeper/ensamblar.py v2 --unir     → sólo une los tramos que ya están (sin exportar)"""
import json
import os
import subprocess
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(os.path.dirname(AQUI))
VID = os.path.join(RAIZ, "Videos")
T = json.load(open(os.path.join(AQUI, "timing.json"), encoding="utf-8"))
TITULO = next(c["t_s"] for c in T["cortes"] if c["toma"] == "Título")
TRAS = next(c["t_s"] for c in T["cortes"] if c["t_s"] > TITULO)
TITULO, TRAS = round(TITULO * 30) / 30, round(TRAS * 30) / 30          # en la rejilla de cuadros: los tramos suman exacto
TRAMOS = [(0, 7), (7, 14), (14, 21), (21, 28), (28, TITULO), (TITULO, TRAS), (TRAS, T["duracion_s"])]
ver = sys.argv[1]


def agente(cmd, args):
    r = subprocess.run([sys.executable, os.path.join(RAIZ, "herramientas", "agente.py"), cmd, json.dumps(args)], capture_output=True, text=True, encoding="utf-8", timeout=400)
    return json.loads(r.stdout)


def reiniciar_ventana():
    """reinicia la página del agente SIN ventana (no aparece nada en la pantalla del humano) y vuelve a abrir el proyecto"""
    subprocess.run([sys.executable, os.path.join(RAIZ, "herramientas", "agente.py"), "--reiniciar"], capture_output=True, timeout=90)
    subprocess.run([sys.executable, os.path.join(AQUI, "creeper.py"), "aplicar"], capture_output=True, timeout=300)


partes = []
for a, b in TRAMOS:
    nombre = f"_tramo_{round(a * 100):04d}"              # sin puntos: el exportador los quita del nombre
    partes.append(os.path.join(VID, nombre + ".mp4"))
    if "--unir" in sys.argv or ("--faltan" in sys.argv and os.path.exists(partes[-1])):
        continue
    args = {"nombre": nombre, "calidad": "alta", "fps": 30, "desde": a, "hasta": b}
    if a == TITULO:
        args["supermuestreo"] = 1                  # los títulos 3D con supermuestreo tiran la ventana
    reiniciar_ventana()
    r = agente("exportar", args)
    print(nombre, r.get("ok"), r.get("resultado", r.get("error")), flush=True)
lista = os.path.join(VID, "_tramos.txt")
open(lista, "w").write("".join(f"file '{p}'\n" for p in partes))
mudo = os.path.join(VID, f"_mudo_{ver}.mp4")
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", lista, "-an", "-vf", "setpts=N/30/TB", "-r", "30", "-c:v", "libx264", "-preset", "slow", "-crf", "16",
                "-pix_fmt", "yuv420p", mudo], check=True)
final = os.path.join(VID, f"El_creeper_era_un_cerdo_{ver}.mp4")
subprocess.run([sys.executable, os.path.join(AQUI, "mezcla.py"), mudo, final], check=True)
r = subprocess.run(["ffprobe", "-v", "error", "-count_frames", "-select_streams", "v", "-show_entries", "stream=nb_read_frames,width,height,r_frame_rate:format=duration",
                    "-of", "compact", final], capture_output=True, text=True)
print(final, r.stdout.strip())
