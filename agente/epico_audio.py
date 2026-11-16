"""Genera (o recupera de la caché) los sonidos y voces del corto épico con el servidor del animador (ElevenLabs), igual que
la página al darle Play, y guarda texto → archivo en agente/epico_audio.json (epico.py lo usa al armar el proyecto)."""
import json
import os
import sys
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import epico  # noqa: E402

PUERTO = os.environ.get("MCA_PUERTO", "8793")
ruta = os.path.join(os.path.dirname(os.path.abspath(__file__)), "epico_audio.json")
hechos = json.load(open(ruta, encoding="utf-8")) if os.path.exists(ruta) else {}
for texto, _, dur, _, tipo in epico.SONIDOS:
    if texto in hechos:
        continue
    cuerpo = {"texto": texto, "voz": epico.VOZ, "modelo": "eleven_v3"} if tipo == "voz" else {"texto": texto, "dur": max(0.5, min(22, dur))}
    req = urllib.request.Request(f"http://127.0.0.1:{PUERTO}/api/{tipo}", json.dumps(cuerpo).encode(), {"Content-Type": "application/json"})
    r = json.load(urllib.request.urlopen(req, timeout=180))
    print(tipo, "ok" if r.get("ok") else "FALLA " + str(r.get("error")), "|", texto[:60], flush=True)
    if r.get("ok"):
        hechos[texto] = r["archivo"]
        json.dump(hechos, open(ruta, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(len(hechos), "listos")
