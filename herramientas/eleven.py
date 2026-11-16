"""Puente con ElevenLabs para Minecraft Animator.

La API key NO está en este proyecto: se carga con `mente.config.secreto("ELEVENLABS_API_KEY")` del proyecto
Simulador Vida (el mismo mecanismo que usan sus videos). Nunca se imprime ni se manda al navegador.
Lo ejecuta servidor.py con el Python del venv de Simulador Vida.

  python eleven.py voz '{"texto": "...", "voz": "<voice_id>", "modelo": "eleven_v3"}' <salida.mp3>
  python eleven.py sfx '{"texto": "footsteps on concrete", "dur": 2}' <salida.mp3>
  python eleven.py musica '{"texto": "upbeat electronic game music", "dur": 40}' <salida.mp3>
  python eleven.py voces
Imprime una línea JSON con el resultado.
"""
import json
import sys

import httpx
from mente.config import secreto

API = "https://api.elevenlabs.io"


def clave() -> dict:
    return {"xi-api-key": secreto("ELEVENLABS_API_KEY").revelar()}


def voz(args: dict, salida: str) -> dict:
    modelo = args.get("modelo") or "eleven_multilingual_v2"
    ajustes = {"stability": 0.4, "similarity_boost": 0.8, "style": 0.5, "use_speaker_boost": True}
    if modelo == "eleven_v3":                     # v3 solo acepta estabilidad 0, 0.5 o 1
        ajustes = {"stability": 0.5, "similarity_boost": 0.8}
    cuerpo = {"text": args["texto"], "model_id": modelo, "voice_settings": ajustes}
    # con marcas de tiempo por letra → la página arma el lip-sync (formas de boca)
    r = httpx.post(f"{API}/v1/text-to-speech/{args['voz']}/with-timestamps?output_format=mp3_44100_128", headers=clave(), timeout=120, json=cuerpo)
    if r.status_code == 200:
        import base64
        j = r.json()
        open(salida, "wb").write(base64.b64decode(j["audio_base64"]))
        alin = j.get("alignment") or j.get("normalized_alignment")
        if alin:
            json.dump(alin, open(salida[:-4] + ".json", "w", encoding="utf-8"), ensure_ascii=False)
        return {"ok": True, "archivo": salida, "modelo": modelo, "alineacion": bool(alin)}
    r = httpx.post(f"{API}/v1/text-to-speech/{args['voz']}?output_format=mp3_44100_128", headers=clave(), timeout=120, json=cuerpo)
    if r.status_code != 200:
        return {"ok": False, "estado": r.status_code, "error": r.text[:300]}
    open(salida, "wb").write(r.content)
    return {"ok": True, "archivo": salida, "modelo": modelo}


def sfx(args: dict, salida: str) -> dict:
    cuerpo = {"text": args["texto"]}
    if args.get("dur"):
        cuerpo["duration_seconds"] = float(args["dur"])
    r = httpx.post(f"{API}/v1/sound-generation?output_format=mp3_44100_128", headers=clave(), timeout=120, json=cuerpo)
    if r.status_code != 200:
        return {"ok": False, "estado": r.status_code, "error": r.text[:300]}
    open(salida, "wb").write(r.content)
    return {"ok": True, "archivo": salida}


def musica(args: dict, salida: str) -> dict:
    cuerpo = {"prompt": args["texto"], "music_length_ms": int(float(args.get("dur") or 30) * 1000), "model_id": "music_v1"}
    if args.get("instrumental", True):
        cuerpo["force_instrumental"] = True
    r = httpx.post(f"{API}/v1/music?output_format=mp3_44100_128", headers=clave(), timeout=300, json=cuerpo)
    if r.status_code != 200:
        return {"ok": False, "estado": r.status_code, "error": r.text[:300]}
    open(salida, "wb").write(r.content)
    return {"ok": True, "archivo": salida}


def voces() -> dict:
    r = httpx.get(f"{API}/v2/voices?page_size=100", headers=clave(), timeout=60)
    if r.status_code != 200:
        return {"ok": False, "estado": r.status_code, "error": r.text[:300]}
    vs = [{"id": v["voice_id"], "nombre": v["name"], "idioma": (v.get("labels") or {}).get("accent", ""),
           "genero": (v.get("labels") or {}).get("gender", "")} for v in r.json().get("voices", [])]
    return {"ok": True, "voces": vs}


def biblioteca(args: dict) -> dict:
    """busca en la biblioteca pública de voces (sólo lectura; no agrega nada a la cuenta). args: search, language, age, gender, accent"""
    q = {"page_size": args.get("n", 30), **{k: v for k, v in args.items() if k in ("search", "language", "age", "gender", "accent", "use_cases") and v}}
    r = httpx.get(f"{API}/v1/shared-voices", headers=clave(), params=q, timeout=60)
    if r.status_code != 200:
        return {"ok": False, "estado": r.status_code, "error": r.text[:300]}
    vs = [{"id": v["voice_id"], "dueno": v.get("public_owner_id"), "nombre": v["name"], "acento": v.get("accent"), "edad": v.get("age"),
           "genero": v.get("gender"), "uso": v.get("use_case"), "descripcion": (v.get("description") or "")[:160],
           "muestra": v.get("preview_url"), "usos_1a": v.get("usage_character_count_1y")} for v in r.json().get("voices", [])]
    return {"ok": True, "voces": vs}


def agregar(args: dict) -> dict:
    """agrega una voz de la biblioteca pública a la cuenta (pedir permiso al humano antes). args: dueno, id, nombre"""
    r = httpx.post(f"{API}/v1/voices/add/{args['dueno']}/{args['id']}", headers=clave(), timeout=60, json={"new_name": args["nombre"]})
    if r.status_code != 200:
        return {"ok": False, "estado": r.status_code, "error": r.text[:300]}
    return {"ok": True, "voz": r.json().get("voice_id")}


if __name__ == "__main__":
    cmd = sys.argv[1]
    try:
        if cmd == "voz":
            res = voz(json.loads(sys.argv[2]), sys.argv[3])
        elif cmd == "sfx":
            res = sfx(json.loads(sys.argv[2]), sys.argv[3])
        elif cmd == "musica":
            res = musica(json.loads(sys.argv[2]), sys.argv[3])
        elif cmd == "voces":
            res = voces()
        elif cmd == "agregar":
            res = agregar(json.loads(sys.argv[2]))
        elif cmd == "biblioteca":
            res = biblioteca(json.loads(sys.argv[2]))
        else:
            res = {"ok": False, "error": "comando desconocido"}
    except Exception as e:  # el error nunca incluye la key: httpx no la pone en el mensaje
        res = {"ok": False, "error": f"{type(e).__name__}: {e}"[:300]}
    print(json.dumps(res, ensure_ascii=False))
