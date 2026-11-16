"""Pide (o recupera de la caché) la música, las dos tomas de cada voz y los efectos al servidor del animador y guarda
clave → archivo en agente/creeper/audio.json.   python agente/creeper/creeper_audio.py"""
import json
import os
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
import guion  # noqa: E402

PUERTO = os.environ.get("MCA_PUERTO", "8790")
RUTA = os.path.join(AQUI, "audio.json")
hechos = json.load(open(RUTA, encoding="utf-8")) if os.path.exists(RUTA) else {}

pedidos = [("musica", "musica", {"texto": guion.MUSICA[0], "dur": guion.MUSICA[1]})]
for k, (a, b) in guion.LINEAS.items():
    pedidos.append((f"{k}A", "voz", {"texto": a, "voz": guion.VOZ, "modelo": "eleven_v3"}))
    pedidos.append((f"{k}B", "voz", {"texto": b, "voz": guion.VOZ, "modelo": "eleven_multilingual_v2"}))
for k, (texto, dur) in guion.SFX.items():
    pedidos.append((k, "sfx", {"texto": texto, "dur": dur}))


def pedir(p):
    clave, tipo, cuerpo = p
    if clave in hechos:
        return clave, hechos[clave], None
    req = urllib.request.Request(f"http://127.0.0.1:{PUERTO}/api/{tipo}", json.dumps(cuerpo).encode(), {"Content-Type": "application/json"})
    try:
        r = json.load(urllib.request.urlopen(req, timeout=400))
    except Exception as e:
        return clave, None, str(e)
    return clave, (r["archivo"] if r.get("ok") else None), (None if r.get("ok") else r.get("error"))


with ThreadPoolExecutor(4) as ex:
    for clave, arch, err in ex.map(pedir, pedidos):
        print(clave, arch or ("FALLA " + str(err)), flush=True)
        if arch:
            hechos[clave] = arch
json.dump(hechos, open(RUTA, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(len(hechos), "de", len(pedidos))
