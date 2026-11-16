"""Voces de los TikToks, con motor intercambiable. Todas dejan lo mismo:
  audio/<motor>_<hash>.mp3            la voz
  audio/<motor>_<hash>.json           marcas por letra con el formato de ElevenLabs (la página arma el lip-sync de LTezla)
  audio/<motor>_<hash>.palabras.json  [[palabra, t0, t1], …] (subtítulos palabra por palabra y cortes anclados a palabras)

Motores (campo "voz" del guion):
  {"motor": "eleven", "id": "<voice_id>", "modelo": "eleven_multilingual_v2" | "eleven_v3"}   la voz de LTezla (de pago)
  {"motor": "edge", "id": "es-MX-JorgeNeural", "velocidad": "+12%", "tono": "+0Hz"}           voces neuronales de Microsoft (gratis)
La "voz de TikTok" no tiene API oficial: ver TIKTOK.md (modo "voz en la app").

Cada línea se verifica con Whisper: el texto oído tiene que coincidir con el guion (similitud ≥ 0.85)."""
import asyncio
import difflib
import hashlib
import json
import os
import re
import unicodedata

from comun import R, escribir, leer, servidor

ETIQUETA = re.compile(r"\[[^\]]*\]")          # [whispers], [laughs]… (sólo eleven_v3)


def limpio(texto):
    return re.sub(r"\s+", " ", ETIQUETA.sub("", texto)).strip()


def normal(s):
    s = unicodedata.normalize("NFD", limpio(s).lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9ñ ]+", " ", s).split()


# ───────────── marcas de tiempo ─────────────
def palabras_de_letras(al):
    """[[palabra, t0, t1]] a partir de las marcas por letra de ElevenLabs (sin las etiquetas [..])"""
    ch, t0, t1 = al["characters"], al["character_start_times_seconds"], al["character_end_times_seconds"]
    out, cur, a, b, dentro = [], "", None, None, False
    for c, s, e in zip(ch, t0, t1):
        if c == "[":
            dentro = True
        if dentro:
            dentro = c != "]"
            continue
        if c.isspace():
            if cur.strip():
                out.append([cur, a, b])
            cur, a = "", None
            continue
        if a is None:
            a = s
        cur, b = cur + c, e
    if cur.strip():
        out.append([cur, a, b])
    return [[w, round(x, 3), round(y, 3)] for w, x, y in out if re.search(r"\w", w)]


def letras_de_palabras(texto, palabras, fin):
    """marcas por letra (formato ElevenLabs) repartiendo cada palabra del motor entre sus letras del texto original"""
    chars, t0, t1 = list(texto), [0.0] * len(texto), [0.0] * len(texto)
    cursor, ult = 0, 0.0
    for w, a, b in palabras:
        i = texto.find(w, cursor)
        if i < 0:
            continue
        for k in range(cursor, i):                     # espacios y signos entre palabras: el hueco
            t0[k], t1[k] = ult, a
        n = len(w)
        for k in range(n):
            t0[i + k] = a + (b - a) * k / n
            t1[i + k] = a + (b - a) * (k + 1) / n
        cursor, ult = i + n, b
    for k in range(cursor, len(texto)):
        t0[k], t1[k] = ult, fin
    return {"characters": chars, "character_start_times_seconds": [round(x, 3) for x in t0], "character_end_times_seconds": [round(x, 3) for x in t1]}


# ───────────── motores ─────────────
def eleven(texto, voz):
    r = servidor("voz", {"texto": texto, "voz": voz["id"], "modelo": voz.get("modelo", "eleven_multilingual_v2")})
    if not r.get("ok"):
        raise RuntimeError("ElevenLabs: " + str(r.get("error")))
    arch = r["archivo"]
    al = leer(R(arch[:-4] + ".json"))
    if not al:
        raise RuntimeError("ElevenLabs no devolvió marcas de tiempo para " + arch)
    pal = palabras_de_letras(al)
    escribir(R(arch[:-4] + ".palabras.json"), pal, indent=None)
    return arch


async def _edge(texto, voz, ruta):
    import edge_tts
    c = edge_tts.Communicate(texto, voz["id"], rate=voz.get("velocidad", "+10%"), pitch=voz.get("tono", "+0Hz"), boundary="WordBoundary")
    pal = []
    with open(ruta + ".tmp", "wb") as f:
        async for ch in c.stream():
            if ch["type"] == "audio":
                f.write(ch["data"])
            elif ch["type"] == "WordBoundary":
                a = ch["offset"] / 1e7
                pal.append([ch["text"], round(a, 3), round(a + ch["duration"] / 1e7, 3)])
    os.replace(ruta + ".tmp", ruta)
    return pal


def edge(texto, voz):
    texto = limpio(texto)
    firma = json.dumps(["edge", texto, voz.get("id"), voz.get("velocidad"), voz.get("tono")], ensure_ascii=False)
    arch = f"audio/edge_{hashlib.sha1(firma.encode()).hexdigest()[:12]}.mp3"
    if not (os.path.exists(R(arch)) and os.path.exists(R(arch[:-4] + ".palabras.json"))):
        pal = asyncio.run(_edge(texto, voz, R(arch)))
        from comun import duracion
        escribir(R(arch[:-4] + ".json"), letras_de_palabras(texto, pal, duracion(arch)), indent=None)
        escribir(R(arch[:-4] + ".palabras.json"), pal, indent=None)
    return arch


MOTORES = {"eleven": eleven, "edge": edge}


def generar(texto, voz):
    return MOTORES[voz.get("motor", "edge")](texto, voz)


# ───────────── verificación con Whisper ─────────────
_modelo = None


def whisper(arch):
    global _modelo
    if _modelo is None:
        from faster_whisper import WhisperModel
        _modelo = WhisperModel("small", device="cpu", compute_type="int8")
    seg, _ = _modelo.transcribe(R(arch), language="es", beam_size=5)
    return " ".join(s.text for s in seg).strip()


def similitud(a, b):
    return round(difflib.SequenceMatcher(None, normal(a), normal(b)).ratio(), 3)


def verificar(texto, arch):
    oido = whisper(arch)
    return {"oido": oido, "similitud": similitud(texto, oido)}
