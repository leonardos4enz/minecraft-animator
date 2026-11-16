"""Después del render: subtítulos palabra por palabra (ASS con Minecraft Ten), mezcla a −14 LUFS y las tres versiones.
  videos/<slug>/subtitulos.ass
  videos/<slug>/salida/{mezcla, sin_musica, solo_musica}.wav
  videos/<slug>/salida/{final, sin_musica, solo_musica}.mp4"""
import os
import re
import subprocess

import kit_audio
from comun import RAIZ, R, carpeta, estrategia, leer, log

LUFS = -14.0
VOZ_LUFS = -18.0          # sonoridad de cada línea de voz antes de mezclar (todas las voces iguales, personajes y LTezla)
ACENTOS = {"pop", "whoosh", "ding", "brillo", "glitch", "error", "rasguno"}      # cortos: sin compresión por la voz


# ───────────── subtítulos ─────────────
def ts(t):
    t = max(0, t)
    return f"{int(t // 3600)}:{int(t % 3600 // 60):02d}:{t % 60:05.2f}"


def bloques(palabras, maxp, maxc):
    out, cur = [], []
    for w in palabras:
        texto = " ".join(x[0] for x in cur + [w])
        corta = cur and re.search(r"[.,;:!?…]$", cur[-1][0])
        if cur and (len(cur) >= maxp or len(texto) > maxc or corta or w[1] - cur[-1][2] > 0.35):
            out.append(cur)
            cur = []
        cur.append(w)
    return out + ([cur] if cur else [])


def subtitulos(slug):
    est = estrategia()["subtitulos"]
    T = leer(os.path.join(carpeta(slug), "timing.json"))
    altura = est["alto_letra_px"] / 0.5                                  # alto de mayúscula ≈ 0.5 del tamaño en Minecraft Ten (medido)
    cab = f"""[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Sub,Minecraft Ten,{altura:.0f},{est['color']},&H000000FF,&H00151515,&H64000000,0,0,0,0,100,100,2,0,1,{est['borde_px']},3,2,120,180,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    ev = []
    todas = sorted((w for v in T["voces"].values() for w in v["palabras"]), key=lambda w: w[1])
    bl = bloques(todas, est["max_palabras"], est["max_caracteres"])
    for n, b in enumerate(bl):
        fin_bloque = bl[n + 1][0][1] if n + 1 < len(bl) and bl[n + 1][0][1] - b[-1][2] < 0.4 else b[-1][2] + 0.25
        for i, w in enumerate(b):
            a = w[1]
            z = b[i + 1][1] if i + 1 < len(b) else fin_bloque
            partes = []
            for j, x in enumerate(b):
                p = x[0].upper().replace("{", "").replace("}", "")
                partes.append(f"{{\\c{est['activa']}}}{p}{{\\c{est['color']}}}" if j == i else p)
            pop = "{\\fscx112\\fscy112\\t(0,90,\\fscx100\\fscy100)}" if i == 0 else ""
            ev.append(f"Dialogue: 0,{ts(a)},{ts(z)},Sub,,0,0,0,,{{\\an2\\pos({est['centro_x']},{est['base_y']})}}{pop}{' '.join(partes)}")
    ruta = os.path.join(carpeta(slug), "subtitulos.ass")
    with open(ruta, "w", encoding="utf-8-sig") as f:
        f.write(cab + "\n".join(ev) + "\n")
    return ruta


# ───────────── mezcla ─────────────
def mezclar(slug):
    T = leer(os.path.join(carpeta(slug), "timing.json"))
    ind = kit_audio.indice()
    dur = T["duracion_s"]
    out = os.path.join(carpeta(slug), "salida")
    os.makedirs(out, exist_ok=True)
    ins, f = [], []

    def entrada(arch, bucle=False, desde=0.0):
        ins.extend((["-stream_loop", "-1"] if bucle else []) + (["-ss", f"{desde:.3f}"] if desde else []) + ["-i", R(arch)])
        return sum(1 for x in ins if x == "-i") - 1

    # "musica_desde_s" (guion): la música empieza en ese segundo de la pista, p. ej. para que su drop caiga en un corte
    desde = float(leer(os.path.join(carpeta(slug), "guion.json"), {}).get("musica_desde_s", 0))
    k = entrada(T["musica"]["archivo"], bucle=True, desde=desde)
    f.append(f"[{k}:a]aformat=channel_layouts=stereo,atrim=0:{dur},afade=t=out:st={dur - 0.6:.3f}:d=0.6,volume=0.5[mus]")
    vs = []
    for lid, v in T["voces"].items():
        k = entrada(v["archivo"])
        g = nivel_voz(v["archivo"])["ganancia"]
        f.append(f"[{k}:a]aformat=channel_layouts=stereo,aresample=48000,volume={g:.2f}dB,adelay={int(v['inicio_s'] * 1000)}:all=1,apad=whole_dur={dur}[v{lid}]")
        vs.append(f"[v{lid}]")
    f.append("".join(vs) + f"amix=inputs={len(vs)}:normalize=0,atrim=0:{dur},asplit=4[voz][vsc1][vsc2][voz2]")
    fx, ac = [], []
    for j, s in enumerate(T["sfx"]):
        k = entrada(kit_audio.archivo_sfx(s["nombre"], s.get("variante", j)))
        hp = "" if s["nombre"] in ("explosion", "golpe") or "explode" in s["nombre"] else "highpass=f=160,"
        f.append(f"[{k}:a]aformat=channel_layouts=stereo,aresample=48000,{hp}volume={s['vol'] * 0.7:.3f},adelay={int(s['t'] * 1000)}:all=1,apad=whole_dur={dur}[s{j}]")
        (ac if s["nombre"] in ACENTOS else fx).append(f"[s{j}]")
    sil = f"anullsrc=r=48000:cl=stereo,atrim=0:{dur}"
    f.append(("".join(fx) + f"amix=inputs={len(fx)}:normalize=0,atrim=0:{dur}" if fx else sil) + "[fx0]")
    f.append(("".join(ac) + f"amix=inputs={len(ac)}:normalize=0,atrim=0:{dur}" if ac else sil) + ",asplit=2[ac][ac2]")
    f.append("[mus]asplit=2[mus1][musola]")
    f.append("[mus1][vsc1]sidechaincompress=threshold=0.02:ratio=8:attack=15:release=300:makeup=1[musd]")
    f.append("[fx0][vsc2]sidechaincompress=threshold=0.05:ratio=2:attack=10:release=200:makeup=1,asplit=2[fxd][fxd2]")
    # sin loudnorm dinámico: de una pasada sube la ganancia en los primeros 3–5 s y deja las primeras voces 3–4 LU más bajas.
    # La sonoridad se lleva a −14 abajo con ganancia fija (medida) + limitador
    fin = "aresample=48000,alimiter=limit=0.84:level=false"
    f.append(f"[voz][musd][fxd][ac]amix=inputs=4:normalize=0,{fin}[mez]")
    f.append(f"[voz2][fxd2][ac2]amix=inputs=3:normalize=0,{fin}[sinm]")
    f.append(f"[musola]{fin}[msola]")
    rutas = {n: os.path.join(out, n + ".wav") for n in ("mezcla", "sin_musica", "solo_musica")}
    cmd = ["ffmpeg", "-v", "error", "-y", *ins, "-filter_complex", ";".join(f),
           "-map", "[mez]", "-t", str(dur), rutas["mezcla"], "-map", "[sinm]", "-t", str(dur), rutas["sin_musica"], "-map", "[msola]", "-t", str(dur), rutas["solo_musica"]]
    subprocess.run(cmd, check=True)
    for ruta in rutas.values():                       # loudnorm de una pasada queda corto y el limitador deja pasar picos entre
        limite = 0.84                                 # muestras: se corrige con la medida real hasta −14 LUFS y ≤ −1 dBTP
        for _ in range(8):
            s = sonoridad(ruta)
            if s["lufs"] is None or (abs(s["lufs"] - LUFS) <= 0.3 and s["true_peak"] <= -1.0):
                break
            if s["true_peak"] > -1.0:
                limite *= 10 ** ((-1.3 - s["true_peak"]) / 20)
            tmp = ruta[:-4] + "_tmp.wav"
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", ruta, "-af", f"volume={LUFS - s['lufs']:.2f}dB,alimiter=limit={limite:.3f}:level=false,aresample=48000", tmp], check=True)
            os.replace(tmp, ruta)
    return rutas


def nivel_voz(arch):
    """cada línea a la misma sonoridad (VOZ_LUFS): las voces de personajes de ElevenLabs salen 6–10 dB más bajas que la de
    LTezla. Devuelve la ganancia que aplica `mezclar` y el nivel con el que queda la línea"""
    s = sonoridad(R(arch))
    if s["lufs"] is None:
        return {"lufs": None, "ganancia": 0.0, "queda": None}
    g = max(-12.0, min(15.0, VOZ_LUFS - s["lufs"]))
    return {"lufs": s["lufs"], "ganancia": round(g, 2), "queda": round(s["lufs"] + g, 1)}


def voces_en_mezcla(wav, T, margen_sfx=0.7):
    """lo que de verdad suena cada línea en una mezcla (p. ej. sin_musica.wav): el tramo más largo de la línea sin efectos
    encima (cada efecto tapa ~0.7 s desde que entra). Línea → LUFS, o None si los efectos la tapan entera"""
    tapas = sorted((s["t"] - 0.05, s["t"] + margen_sfx) for s in T.get("sfx", []))
    out = {}
    for lid, v in T["voces"].items():
        libres, a = [], v["inicio_s"]
        for x, y in tapas:
            if y <= a or x >= v["fin_s"]:
                continue
            if x > a:
                libres.append((a, x))
            a = max(a, y)
        if a < v["fin_s"]:
            libres.append((a, v["fin_s"]))
        a, b = max(libres, key=lambda r: r[1] - r[0], default=(0, 0))
        if b - a < 0.4:
            out[lid] = None
            continue
        r = subprocess.run(["ffmpeg", "-hide_banner", "-ss", f"{a:.3f}", "-t", f"{b - a:.3f}", "-i", wav, "-af", "ebur128", "-f", "null", "-"],
                           capture_output=True, text=True)
        m = re.findall(r"I:\s+(-?[\d.]+) LUFS", r.stderr)
        out[lid] = float(m[-1]) if m else None
    return out


def sonoridad(arch):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-i", arch, "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True)
    res = r.stderr[r.stderr.rfind("Summary:"):]
    i = re.search(r"I:\s+(-?[\d.]+) LUFS", res)
    p = re.search(r"Peak:\s+(-?[\d.]+) dBFS", res)
    return {"lufs": float(i.group(1)) if i else None, "true_peak": float(p.group(1)) if p else None}


def tramos_bn(slug):
    """líneas con "bn": true en el guion → tramos [a, b] (s) en blanco y negro, del primer corte de la línea al final de su
    última toma; con "bn_hasta_fin": true sigue hasta el final del video (el "momento" de los memes de edits)"""
    g = leer(os.path.join(carpeta(slug), "guion.json"))
    T = leer(os.path.join(carpeta(slug), "timing.json"))
    tramos = []
    for ln in g["lineas"]:
        if not ln.get("bn"):
            continue
        cs = [c for c in T["cortes"] if c["linea"] == ln["id"]]
        if cs:
            a, b = cs[0]["t_s"], T["duracion_s"] if ln.get("bn_hasta_fin") else cs[-1]["t_s"] + cs[-1]["dur"]
            if tramos and a <= tramos[-1][1] + 0.05:
                tramos[-1][1] = max(tramos[-1][1], b)
            else:
                tramos.append([a, b])
    m = [c for c in T["cortes"] if c["linea"] == "M"]
    if g.get("montaje_bn") and m:                     # el montaje final de los edits (armar.py → "montaje")
        a = m[0]["t_s"]
        if tramos and a <= tramos[-1][1] + 0.05:
            tramos[-1][1] = T["duracion_s"]
        else:
            tramos.append([a, T["duracion_s"]])
    return tramos


def filtro_bn(tramos, texto=""):
    """blanco y negro de "edit": sin color, más contraste, viñeta y grano, sólo dentro de los tramos (antes de los subtítulos).
    texto (guion "texto_bn"): un letrero fijo en pantalla durante el tramo, arriba y dentro de la zona segura (Minecraft Ten)"""
    if not tramos:
        return ""
    en = "+".join(f"between(t,{a:.3f},{b:.3f})" for a, b in tramos)
    # como los edits del mentalista: negros aplastados, la cara iluminada y el fondo casi negro
    # (medido en la hoja: contraste 1.45 + gamma 0.9 de noche dejaba el pelo negro perdido en el fondo)
    f = (f"hue=s=0:enable='{en}',eq=contrast=1.3:brightness=0.03:gamma=1.15:enable='{en}',"
         f"vignette=angle=PI/4:enable='{en}',noise=alls=9:allf=t:enable='{en}',")
    for i, linea in enumerate(texto.upper().split("\n") if texto else []):
        t = linea.replace("\\", "").replace("'", "").replace(":", "\\:")
        f += (f"drawtext=fontfile=texturas_mc/packs/fuentes/minecraft-ten.ttf:text='{t}':fontsize=92:fontcolor=white:"
              f"borderw=7:bordercolor=black:x=(w-text_w)/2:y={330 + i * 112}:enable='{en}',")
    return f


def final(slug, mudo):
    ass = subtitulos(slug)
    audios = mezclar(slug)
    out = os.path.join(carpeta(slug), "salida")
    con = os.path.join(out, "imagen_con_subtitulos.mp4")
    rel = os.path.relpath(ass, RAIZ).replace(os.sep, "/")
    bn = tramos_bn(slug)
    if bn:
        log(f"  blanco y negro: {', '.join(f'{a:.2f}–{b:.2f} s' for a, b in bn)}")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", mudo, "-vf", f"{filtro_bn(bn, leer(os.path.join(carpeta(slug), 'guion.json')).get('texto_bn', ''))}ass={rel}:fontsdir=texturas_mc/packs/fuentes", "-c:v", "libx264",
                    "-preset", "slow", "-crf", "17", "-pix_fmt", "yuv420p", "-movflags", "+faststart", con], check=True, cwd=RAIZ)
    videos = {}
    for n, wav in audios.items():
        dest = os.path.join(out, ("final" if n == "mezcla" else n) + ".mp4")
        dur = leer(os.path.join(carpeta(slug), "timing.json"))["duracion_s"]
        for _ in range(4):                            # el AAC puede subir el pico real (un golpe o una explosión): se mide el mp4
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", con, "-i", wav, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-af", "apad", "-c:a", "aac",
                            "-b:a", "256k", "-t", f"{dur:.4f}", "-movflags", "+faststart", dest], check=True)      # el audio se rellena: nunca recorta cuadros
            s_mp4, s_wav = sonoridad(dest), sonoridad(wav)
            if s_mp4["true_peak"] is None or s_mp4["true_peak"] <= -1.0:
                break
            lim = 10 ** ((s_wav["true_peak"] - (s_mp4["true_peak"] + 1.3)) / 20)
            tmp = wav[:-4] + "_tmp.wav"
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", wav, "-af", f"alimiter=limit={min(lim, 0.99):.3f}:level=false,aresample=48000", tmp], check=True)
            os.replace(tmp, wav)
        videos[n] = dest
        log(f"  {os.path.basename(dest)}  {sonoridad(wav)}")
    return videos
