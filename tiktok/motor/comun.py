"""Rutas y utilidades compartidas por la máquina de TikToks (tiktok/maquina.py)."""
import json
import os
import subprocess
import sys
import urllib.request

MOTOR = os.path.dirname(os.path.abspath(__file__))
TT = os.path.dirname(MOTOR)                       # tiktok/
RAIZ = os.path.dirname(TT)                        # Minecraft Animator/
VIDEOS_TT = os.path.join(TT, "videos")            # tiktok/videos/<slug>/ (guion, audio, timing, render, crítica)
ENTREGAS = os.path.join(RAIZ, "Videos", "TikTok")  # lo que Leo sube
PUERTO = os.environ.get("MCA_PUERTO", "8790")
FPS = 30
W, H = 1080, 1920


def leer(ruta, defecto=None):
    if not os.path.exists(ruta):
        return defecto
    with open(ruta, encoding="utf-8") as f:
        return json.load(f)


def escribir(ruta, datos, indent=1):
    os.makedirs(os.path.dirname(ruta), exist_ok=True)
    tmp = ruta + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(datos, f, ensure_ascii=False, indent=indent)
    os.replace(tmp, ruta)


def estrategia():
    return leer(os.path.join(TT, "estrategia.json"), {})


def carpeta(slug):
    return os.path.join(VIDEOS_TT, slug)


def R(rel):
    """ruta absoluta de un archivo relativo a la raíz del programa (audio/voz_x.mp3)"""
    return rel if os.path.isabs(rel) else os.path.join(RAIZ, rel)


def agente(cmd, args=None, timeout=900):
    """un comando de la página del agente (herramientas/agente.py: abre sola la página SIN ventana)"""
    r = subprocess.run([sys.executable, os.path.join(RAIZ, "herramientas", "agente.py"), cmd, json.dumps(args or {}, ensure_ascii=False)],
                       capture_output=True, text=True, encoding="utf-8", timeout=timeout)
    try:
        return json.loads(r.stdout)
    except json.JSONDecodeError:
        return {"ok": False, "error": (r.stdout + r.stderr)[-400:]}


def agente_local(*flags, timeout=120):
    return subprocess.run([sys.executable, os.path.join(RAIZ, "herramientas", "agente.py"), *flags], capture_output=True, text=True, timeout=timeout)


def servidor(tipo, cuerpo, timeout=400):
    """POST /api/<tipo> del servidor del animador (voz, sfx, musica con ElevenLabs; con caché por texto)"""
    req = urllib.request.Request(f"http://127.0.0.1:{PUERTO}/api/{tipo}", json.dumps(cuerpo).encode(), {"Content-Type": "application/json"})
    try:
        return json.load(urllib.request.urlopen(req, timeout=timeout))
    except Exception as e:                                   # noqa: BLE001
        return {"ok": False, "error": str(e)}


def duracion(arch):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", R(arch)], capture_output=True, text=True)
    return float(r.stdout.strip())


def ffmpeg(*args):
    subprocess.run(["ffmpeg", "-v", "error", "-y", *args], check=True)


def cuadro(t):
    """t en la rejilla de cuadros (los tramos y cortes suman exacto)"""
    return round(round(t * FPS) / FPS, 4)


def log(*a):
    print(*a, flush=True)
