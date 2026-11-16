"""Genera (o recupera de la caché) la música, los sonidos y las voces del corto del Roadster con el servidor del animador
(ElevenLabs), igual que la página al darle Play, y guarda texto → archivo en agente/roadster_audio.json (roadster.py lo usa
al armar el proyecto). Lo que ya está en la caché de audio/ (los del tráiler y del corto épico) no se vuelve a pedir."""
import json
import os
import sys
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import roadster  # noqa: E402

PUERTO = os.environ.get("MCA_PUERTO", "8793")
AQUI = os.path.dirname(os.path.abspath(__file__))
ruta = os.path.join(AQUI, "roadster_audio.json")
hechos = json.load(open(ruta, encoding="utf-8")) if os.path.exists(ruta) else {}
previos = json.load(open(os.path.join(AQUI, "epico_audio.json"), encoding="utf-8"))      # caché del corto épico
pedidos = [(roadster.MUSICA[0], roadster.MUSICA[1], "musica")]
for texto, _, dur, _, tipo in roadster.SONIDOS:
    if texto != roadster.BOOM and texto not in [p[0] for p in pedidos]:
        pedidos.append((texto, dur, tipo))
for texto, dur, tipo in pedidos:
    if texto in hechos:
        continue
    if texto in previos:
        hechos[texto] = previos[texto]
        continue
    if tipo == "voz":
        cuerpo = {"texto": texto, "voz": roadster.VOZ, "modelo": "eleven_v3"}
    else:
        cuerpo = {"texto": texto, "dur": dur if tipo == "musica" else max(0.5, min(22, dur))}
    req = urllib.request.Request(f"http://127.0.0.1:{PUERTO}/api/{tipo}", json.dumps(cuerpo).encode(), {"Content-Type": "application/json"})
    r = json.load(urllib.request.urlopen(req, timeout=300))
    print(tipo, "ok" if r.get("ok") else "FALLA " + str(r.get("error")), "|", texto[:60], flush=True)
    if r.get("ok"):
        hechos[texto] = r["archivo"]
        json.dump(hechos, open(ruta, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(len(hechos), "listos de", len(pedidos))
