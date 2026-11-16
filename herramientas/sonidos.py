"""Sonidos reales de Minecraft: copia de TU Minecraft Java instalado (%APPDATA%/.minecraft/assets, índice más nuevo) los
sonidos del juego a texturas_mc/sonidos/ (sólo para usarlos en tu PC; no se redistribuye nada) y escribe
texturas_mc/sonidos/indice.json:
  {"eventos": {"entity.ghast.scream": [{"archivo": "texturas_mc/sonidos/mob/ghast/affectionate_scream.ogg", "vol": 1.0}, …], …}}
Fuera: la música y los discos (music.*, music_disc.*): son obras con derechos aparte y dan reclamos de copyright en redes.

  python herramientas/sonidos.py
Después se usan como cualquier clip de audio del animador ({"tipo": "sfx", "archivo": "texturas_mc/sonidos/…ogg"}) y en
la máquina de TikToks como sfx "mc:entity.ghast.scream" (TIKTOK.md)."""
import glob
import json
import os
import shutil

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(os.environ.get("APPDATA", ""), ".minecraft", "assets")
DESTINO = os.path.join(RAIZ, "texturas_mc", "sonidos")
FUERA = ("music.", "music_disc.")


def main():
    indices = sorted(glob.glob(os.path.join(ASSETS, "indexes", "*.json")), key=os.path.getmtime)
    if not indices:
        raise SystemExit(f"No encontré Minecraft Java en {ASSETS}")
    objetos = json.load(open(indices[-1]))["objects"]
    obj = lambda clave: os.path.join(ASSETS, "objects", objetos[clave]["hash"][:2], objetos[clave]["hash"])
    eventos = json.load(open(obj("minecraft/sounds.json"), encoding="utf-8"))
    out, copiados, faltan = {}, 0, 0
    for ev, datos in eventos.items():
        if ev.startswith(FUERA):
            continue
        lista = []
        for s in datos.get("sounds", []):
            s = {"name": s} if isinstance(s, str) else s
            if s.get("type") == "event":                    # referencia a otro evento: se resuelve abajo
                lista.append({"evento": s["name"]})
                continue
            nombre = s["name"].split(":")[-1]
            clave = f"minecraft/sounds/{nombre}.ogg"
            if clave not in objetos:
                faltan += 1
                continue
            rel = f"texturas_mc/sonidos/{nombre}.ogg"
            dest = os.path.join(RAIZ, rel)
            if not os.path.exists(dest):
                os.makedirs(os.path.dirname(dest), exist_ok=True)
                shutil.copyfile(obj(clave), dest)
                copiados += 1
            lista.append({"archivo": rel, "vol": s.get("volume", 1.0), "tono": s.get("pitch", 1.0)})
        if lista:
            out[ev] = lista
    for ev, lista in out.items():                           # resolver {"evento": …}
        res = []
        for s in lista:
            res += out.get(s["evento"], []) if "evento" in s else [s]
        out[ev] = [s for s in res if "archivo" in s]
    out = {k: v for k, v in out.items() if v}
    json.dump({"fuente": os.path.basename(indices[-1]), "eventos": out}, open(os.path.join(DESTINO, "indice.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=0)
    print(f"{len(out)} eventos · {copiados} archivos nuevos · {faltan} faltantes → texturas_mc/sonidos/indice.json")


if __name__ == "__main__":
    main()
