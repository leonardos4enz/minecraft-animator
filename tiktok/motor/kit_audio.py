"""Biblioteca reutilizable de música (por ánimo) y efectos para todos los TikToks. Se pide una vez a ElevenLabs por el
servidor (caché por texto) y se mide con librosa (bpm, beats, pico) → tiktok/kit/indice.json.

  python tiktok/maquina.py kit            genera/mide lo que falte
Música original de ElevenLabs = sin copyright de terceros. El sonido en tendencia se pone en la app (versión sin música)."""
import os
import subprocess

from comun import R, TT, escribir, leer, log, servidor

INDICE = os.path.join(TT, "kit", "indice.json")
DUR_MUSICA = 48

MUSICA = {
    "misterio": "Curious sneaky mysterious cue for a short animated explainer, 100 bpm, pizzicato strings, celesta, ticking woodwinds, light percussion, steady groove, loopable, no vocals",
    "comedia": "Bouncy playful cartoon comedy groove, 110 bpm, plucky marimba, bassoon, snappy snare, whimsical and upbeat, steady loopable groove, no vocals",
    "epico": "Epic heroic adventure cue for a blocky video game short, 120 bpm, driving taiko drums, brass stabs, strings ostinato, energetic, loopable, no vocals",
    "terror": "Creepy suspense underscore for a spooky cave story, 90 bpm, low drones, ticking clock, eerie music box, heartbeat kick, tense but steady, no vocals",
    "chill": "Calm cozy lofi game ambience, 85 bpm, soft piano, gentle chiptune arpeggio, warm bass, relaxed steady beat, loopable, no vocals",
    "noticia": "Fast energetic news intro groove for a gaming update, 128 bpm, punchy electronic drums, synth bass, chiptune lead stabs, exciting, loopable, no vocals",
    # los edits de personajes (p. ej. el del mentalista): slowed + reverb; intro suave y un drop con bajo hacia la mitad
    "edit_slowed": "Slowed and reverb dark melancholic character edit music, 75 bpm, soft distant echoing piano melody, airy synth pad, "
                   "vinyl crackle, quiet tense intro for the first 15 seconds, then a heavy deep 808 bass drop with slow hard-hitting drums, "
                   "confident mysterious detective mood, dreamy, no vocals",
}

SFX = {
    "whoosh": ("fast airy whoosh transition, short and clean", 0.6),
    "pop": ("bright cartoon pop, short punchy click", 0.5),
    "golpe": ("deep cinematic boom hit with sub bass, dramatic reveal impact", 1.2),
    "glitch": ("short digital glitch stutter, retro computer error", 0.6),
    "ding": ("light bulb idea ding, sparkly bright chime", 0.8),
    "error": ("wrong answer buzzer, cartoon game show, short", 0.8),
    "tictac": ("clock ticking suspense, fast ticks", 1.5),
    "subida": ("rising suspense riser whoosh building tension", 1.5),
    "explosion": ("big blocky explosion boom with debris, game style", 2.0),
    "risa": ("cartoon crowd laugh short, sitcom style", 1.5),
    "brillo": ("magical sparkle shimmer with tiny pixel ticks", 1.2),
    "rasguno": ("record scratch stop, comedic freeze", 0.8),
    "aplauso": ("short enthusiastic applause, a few hands clapping fast, close, no crowd cheering", 1.4),
}


def medir(arch):
    import librosa
    import numpy as np
    y, sr = librosa.load(R(arch), sr=22050, mono=True)
    tempo, frames = librosa.beat.beat_track(y=y, sr=sr)
    beats = librosa.frames_to_time(frames, sr=sr)
    pico = float(20 * np.log10(np.max(np.abs(y)) + 1e-9))
    return {"bpm": round(float(np.atleast_1d(tempo)[0]), 1), "beats": [round(float(b), 3) for b in beats], "dur": round(len(y) / sr, 3), "pico_db": round(pico, 1)}


def pico_db(arch):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-i", R(arch), "-af", "volumedetect", "-f", "null", "-"], capture_output=True, text=True)
    for l in r.stderr.splitlines():
        if "max_volume" in l:
            return float(l.split(":")[1].split()[0])
    return -99.0


def asegurar():
    ind = leer(INDICE, {"musica": {}, "sfx": {}})
    for k, prompt in MUSICA.items():
        if k in ind["musica"]:
            continue
        r = servidor("musica", {"texto": prompt, "dur": DUR_MUSICA}, timeout=600)
        if not r.get("ok"):
            log("música", k, "FALLA", r.get("error"))
            continue
        ind["musica"][k] = {"archivo": r["archivo"], "prompt": prompt, **medir(r["archivo"])}
        log("música", k, ind["musica"][k]["bpm"], "bpm", len(ind["musica"][k]["beats"]), "beats")
        escribir(INDICE, ind)
    for k, (prompt, dur) in SFX.items():
        if k in ind["sfx"] and ind["sfx"][k]["pico_db"] > -30:
            continue
        r = servidor("sfx", {"texto": prompt, "dur": dur})
        if not r.get("ok"):
            log("sfx", k, "FALLA", r.get("error"))
            continue
        p = pico_db(r["archivo"])
        ind["sfx"][k] = {"archivo": r["archivo"], "prompt": prompt, "pico_db": p}
        log("sfx", k, p, "dB" + ("  ⚠ casi mudo: cambia el prompt" if p < -30 else ""))
        escribir(INDICE, ind)
    return ind


def indice():
    return leer(INDICE, {"musica": {}, "sfx": {}})


# ───────────── sonidos reales de Minecraft (herramientas/sonidos.py → texturas_mc/sonidos/) ─────────────
_mc = None


def mc():
    global _mc
    if _mc is None:
        from comun import RAIZ
        _mc = leer(os.path.join(RAIZ, "texturas_mc", "sonidos", "indice.json"), {"eventos": {}})["eventos"]
    return _mc


def archivo_sfx(nombre, variante=0):
    """'pop' (kit de ElevenLabs) o 'mc:entity.ghast.scream' (sonido real del juego; `variante` elige entre sus versiones)"""
    if nombre.startswith("mc:"):
        lista = mc().get(nombre[3:])
        if not lista:
            raise KeyError(f"no hay sonido de Minecraft '{nombre[3:]}' (corre herramientas/sonidos.py; busca en texturas_mc/sonidos/indice.json)")
        return lista[variante % len(lista)]["archivo"]
    return indice()["sfx"][nombre]["archivo"]


def evento_mob(java, tipo="ambient"):
    """evento del juego para un mob: entity.<java>.<tipo> (ambient, hurt, death…) si existe"""
    for ev in (f"entity.{java}.{tipo}", f"entity.{java}.ambient", f"entity.{java}.idle"):
        if ev in mc():
            return ev
    return None
