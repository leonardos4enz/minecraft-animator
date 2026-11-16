"""Control de calidad automático de un TikTok (antes de los críticos). Mide contra estrategia.json y timing.json y escribe
videos/<slug>/revision.json + critica/mudo_2fps.jpg (la hoja que ve el crítico sin sonido).
Cada chequeo: {"ok": bool, "valor": …, "regla": …}. "bloquea" = no se entrega así."""
import os
import subprocess

import numpy as np

import post
import voces
from comun import FPS, carpeta, estrategia, leer, escribir


def probe(v):
    r = subprocess.run(["ffprobe", "-v", "error", "-count_frames", "-select_streams", "v", "-show_entries",
                        "stream=nb_read_frames,width,height,r_frame_rate:format=duration", "-of", "default=nw=1", v], capture_output=True, text=True)
    d = dict(l.split("=", 1) for l in r.stdout.split() if "=" in l)
    num, den = d["r_frame_rate"].split("/")
    return {"w": int(d["width"]), "h": int(d["height"]), "fps": round(int(num) / int(den), 2), "cuadros": int(d["nb_read_frames"]), "dur": float(d["duration"])}


def quietud(v):
    """segundos de imagen quieta (diferencia media en gris < 0.3 a 108×192) y el tramo quieto más largo"""
    r = subprocess.run(["ffmpeg", "-v", "error", "-i", v, "-vf", "scale=108:192,format=gray", "-f", "rawvideo", "-"], capture_output=True)
    fr = np.frombuffer(r.stdout, np.uint8).reshape(-1, 192, 108).astype(np.float32)
    dif = np.abs(np.diff(fr, axis=0)).mean(axis=(1, 2))
    quieto = dif < 0.3
    largo, cur = 0, 0
    for q in quieto:
        cur = cur + 1 if q else 0
        largo = max(largo, cur)
    return round(float(quieto.sum()) / FPS, 2), round(largo / FPS, 2), round(float(fr[0].mean()), 1)


def hoja_muda(v, destino):
    os.makedirs(os.path.dirname(destino), exist_ok=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", v, "-vf", "fps=2,scale=180:-1,tile=10x8", "-frames:v", "1", destino], check=True)


def correr(slug, objetivo=None):
    est = estrategia()
    g = leer(os.path.join(carpeta(slug), "guion.json"))
    T = leer(os.path.join(carpeta(slug), "timing.json"))
    sal = os.path.join(carpeta(slug), "salida")
    final = os.path.join(sal, "final.mp4")
    objetivo = objetivo or g.get("objetivo", "crecer")
    c = {}
    p = probe(final)
    c["formato"] = {"ok": (p["w"], p["h"], p["fps"]) == (1080, 1920, FPS), "valor": f"{p['w']}x{p['h']} @ {p['fps']}", "regla": "1080x1920 @ 30", "bloquea": True}
    c["cuadros"] = {"ok": abs(p["cuadros"] - T["cuadros"]) <= 1, "valor": p["cuadros"], "regla": f"{T['cuadros']} (duración × 30)", "bloquea": True}
    lo, hi = est["duracion"][objetivo]
    c["duracion"] = {"ok": lo <= T["duracion_s"] <= hi, "valor": T["duracion_s"], "regla": f"{lo}–{hi} s ({objetivo})", "bloquea": T["duracion_s"] < est["duracion"]["minimo"]}
    s = post.sonoridad(os.path.join(sal, "mezcla.wav"))
    s_mp4 = post.sonoridad(final)                    # el pico real se mide también en el mp4 que se entrega (el AAC lo puede subir)
    if s_mp4["true_peak"] is not None:
        s["true_peak"] = max(s["true_peak"], s_mp4["true_peak"])
    c["sonoridad"] = {"ok": s["lufs"] is not None and abs(s["lufs"] - est["audio"]["lufs"]) <= 1 and s["true_peak"] <= est["audio"]["true_peak_max"],
                      "valor": s, "regla": "−14 ±1 LUFS, pico ≤ −1 dBTP", "bloquea": True}
    # todas las voces igual de fuertes (pedido de Leo, 18 oct 2026): personajes y LTezla al mismo nivel tras la ganancia de la mezcla
    # se mide lo que suena en la mezcla sin música (tramos sin efectos encima), no el nivel previsto
    niv = post.voces_en_mezcla(os.path.join(sal, "sin_musica.wav"), T)
    vals = [x for x in niv.values() if x is not None]
    rango = round(max(vals) - min(vals), 1) if vals else 0.0
    c["voces_parejas"] = {"ok": rango <= 2.0, "valor": {"rango_lu": rango, "por_linea": niv}, "regla": "ninguna línea de voz se aleja > 2 LU de las demás", "bloquea": rango > 3.0}
    voces_l = sorted(T["voces"].values(), key=lambda v: v["inicio_s"])
    c["voz_temprana"] = {"ok": voces_l[0]["inicio_s"] <= est["gancho"]["voz_empieza_antes_s"], "valor": voces_l[0]["inicio_s"], "regla": "la voz entra antes de 0.5 s"}
    c["primera_frase"] = {"ok": voces_l[0]["fin_s"] <= est["gancho"]["primera_frase_termina_antes_s"], "valor": voces_l[0]["fin_s"], "regla": "la primera frase termina antes de 3.2 s"}
    clave = (g.get("clave") or "").lower()
    if clave:
        t_clave = next((w[1] for v in voces_l for w in v["palabras"] if clave in voces.normal(w[0]) or voces.normal(clave)[0] in voces.normal(w[0])), None)
        c["clave_en_voz"] = {"ok": t_clave is not None and t_clave <= est["gancho"]["clave_en_voz_antes_s"], "valor": t_clave, "regla": f"'{clave}' dicha antes de 5 s"}
        c["clave_en_gancho"] = {"ok": voces.normal(clave)[0] in voces.normal(T["gancho"]), "valor": T["gancho"], "regla": "la palabra clave en el texto-gancho"}
    maxd = max(x["dur"] for x in T["cortes"])
    c["ritmo"] = {"ok": maxd <= est["ritmo"]["max_toma_s"] + 0.01, "valor": maxd, "regla": f"ninguna toma > {est['ritmo']['max_toma_s']} s"}
    q, largo, luma0 = quietud(final)
    c["imagen_quieta"] = {"ok": q <= T["duracion_s"] / 30 and largo <= 0.5, "valor": {"total_s": q, "mas_largo_s": largo}, "regla": "≤ 1 s cada 30 s y ningún tramo > 0.5 s"}
    c["cuadro_0"] = {"ok": luma0 > 25, "valor": luma0, "regla": "el cuadro 0 no es negro (gancho visual desde el inicio)", "bloquea": True}
    # Whisper sobre la mezcla final: que la música y los efectos no tapen la voz
    oido = voces.whisper(os.path.join(sal, "mezcla.wav"))
    guion = " ".join(voces.limpio(ln["texto"]) for ln in g["lineas"])
    sim = voces.similitud(guion, oido)
    c["voz_inteligible"] = {"ok": sim >= 0.85, "valor": {"similitud": sim, "oido": oido}, "regla": "Whisper oye el guion en la mezcla (≥ 0.85)", "bloquea": sim < 0.7}
    ppm = round(sum(len(v["palabras"]) for v in voces_l) / sum(v["fin_s"] - v["inicio_s"] for v in voces_l) * 60)
    a, b = est["ritmo"]["palabras_por_min"]
    c["velocidad_voz"] = {"ok": a <= ppm <= b, "valor": ppm, "regla": f"{a}–{b} palabras/min"}
    hechos = {h["id"] for h in leer(os.path.join(carpeta(slug), "facts.json"), {"hechos": []})["hechos"]}
    sin = [ln["id"] for ln in g["lineas"] if ln.get("afirma", True) and not ln.get("hechos")]
    afirma = any(ln.get("afirma", True) for ln in g["lineas"])
    c["hechos"] = {"ok": not sin and (bool(hechos) or not afirma), "valor": {"lineas_sin_hecho": sin}, "regla": "cada línea que afirma algo cita un hecho de facts.json", "bloquea": bool(sin)}
    desc = g.get("descripcion", "")
    tags = g.get("hashtags", [])
    ha, hb = est["descripcion"]["hashtags"]
    c["descripcion"] = {"ok": 0 < len(desc) <= est["descripcion"]["max_caracteres"] and ha <= len(tags) <= hb and not set(t.lower() for t in tags) & set(est["descripcion"]["prohibidos"]),
                        "valor": {"caracteres": len(desc), "hashtags": tags}, "regla": "≤ 150 caracteres, 2–4 hashtags, sin #fyp/#viral"}
    hoja_muda(final, os.path.join(carpeta(slug), "critica", "mudo_2fps.jpg"))
    bloq = [k for k, v in c.items() if not v["ok"] and v.get("bloquea")]
    avisos = [k for k, v in c.items() if not v["ok"] and not v.get("bloquea")]
    res = {"listo": not bloq, "bloquean": bloq, "avisos": avisos, "chequeos": c}
    escribir(os.path.join(carpeta(slug), "revision.json"), res)
    return res
