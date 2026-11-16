"""Render FINAL del video de video.json: calidad alta por tramos de 10 s, con la página reiniciada antes de cada tramo.

    python agente/orquesta/final.py v6     → "destino" de video.json (Rush E: Videos/Rush E en bloques (LTezla).mp4),
                                             1080×1920, 30 fps, −14 LUFS, ≤ −1 dBTP

- Tramos en la rejilla de cuadros (300 cuadros); un tramo ya hecho no se repite (se puede relanzar si algo falla).
- Antes de cada tramo: `--reiniciar` + `abrir` + LTezla (`rollo.py personajes`). Así la página no acumula memoria (en los
  borradores se colgó un tramo en v2, v3, v4 y v5).
- Unión: cada tramo a 1080×1920 (lanczos) y recortado a su número exacto de cuadros + capa de textos + `<base>.wav`
  con loudnorm de DOS pasadas (−14 LUFS, TP −1.5: el AAC sube ~0.3 dB los picos; medido −0.7 con −1.0).
- El audio es sólo música (no hay voz), así que la versión principal ya es la "sólo música" que pide CLAUDE.md.
"""
import json, re, subprocess, sys, time
from pathlib import Path

import video as V

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parents[1]
FPS, CUADROS, PASO = V.FPS, V.CUADROS, 300
SAL = AQUI / "salida"
TRAB = SAL / "final"
AG = [sys.executable, str(RAIZ / "herramientas" / "agente.py")]
DESTINO = V.DESTINO


def agente(*args, timeout=900):
    try:
        r = subprocess.run(AG + list(args), capture_output=True, text=True, encoding="utf-8", timeout=timeout, cwd=RAIZ)
        return r.stdout
    except subprocess.TimeoutExpired:
        return '"error": "tiempo agotado"'


def preparar():
    agente("--reiniciar", timeout=300)
    agente("abrir", json.dumps({"nombre": V.PROYECTO}), timeout=900)
    for l in subprocess.run([sys.executable, str(AQUI / "rollo.py"), "personajes"], capture_output=True, text=True, cwd=RAIZ).stdout.splitlines():
        (TRAB / "_per.json").write_text(l, encoding="utf-8"); agente("personaje", "@" + str(TRAB / "_per.json"), timeout=300)


def main():
    v = sys.argv[1] if len(sys.argv) > 1 else "v6"
    TRAB.mkdir(parents=True, exist_ok=True)
    cortes = list(range(0, CUADROS, PASO)) + [CUADROS]
    partes = []
    for a, b in zip(cortes, cortes[1:]):
        nombre = f"_final_{v}_{a:05d}"
        dest = TRAB / f"{nombre}.mp4"
        if not dest.exists():
            for intento in range(3):
                preparar()
                t0 = time.time()
                out = agente("exportar", json.dumps({"nombre": nombre, "desde": a / FPS, "hasta": b / FPS, "fps": FPS, "calidad": "alta"}), timeout=1500)
                vid = RAIZ / "Videos" / f"{nombre}.mp4"
                if vid.exists() and '"ok": true' in out:
                    vid.replace(dest); print(f"tramo {a / FPS:6.1f}–{b / FPS:6.1f} s: {time.time() - t0:.0f} s", flush=True); break
                print(f"tramo {a}: falló ({out[-160:]!r}); reintento", flush=True)
            else:
                raise SystemExit(f"el tramo {a} no salió")
        partes.append((dest, b - a))
    # mezcla: loudnorm en dos pasadas sobre la música
    wav = V.WAV
    m = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(wav), "-af", "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"],
                       capture_output=True, text=True).stderr
    j = json.loads(m[m.rindex("{"):m.rindex("}") + 1])
    norm = (f"loudnorm=I=-14:TP=-1.5:LRA=11:measured_I={j['input_i']}:measured_TP={j['input_tp']}:measured_LRA={j['input_lra']}:"
            f"measured_thresh={j['input_thresh']}:offset={j['target_offset']}:linear=true")
    mezcla = TRAB / "mezcla.wav"
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(wav), "-af", norm + ",aresample=48000,apad",
                    "-t", f"{CUADROS / FPS:.4f}", str(mezcla)], check=True)
    # video: tramos → 1080×1920, textos encima, mezcla
    filtros, entradas = [], []
    for i, (p, n) in enumerate(partes):
        entradas += ["-i", str(p)]
        filtros.append(f"[{i}:v]scale=1080:1920:flags=lanczos,fps={FPS},trim=end_frame={n},setpts=PTS-STARTPTS[v{i}]")
    k = len(partes)
    filtros.append("".join(f"[v{i}]" for i in range(k)) + f"concat=n={k}:v=1:a=0[vid]")
    entradas += ["-f", "concat", "-safe", "0", "-i", str(SAL / "textos" / "lista.txt")]
    filtros.append(f"[{k}:v]format=rgba[tx];[vid][tx]overlay=0:0:shortest=1,setpts=N/{FPS}/TB,format=yuv420p[out]")
    entradas += ["-i", str(mezcla)]
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *entradas, "-filter_complex", ";".join(filtros),
                    "-map", "[out]", "-map", f"{k + 1}:a", "-frames:v", str(CUADROS), "-c:v", "libx264", "-crf", "16", "-preset", "slow",
                    "-profile:v", "high", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-c:a", "aac", "-b:a", "320k", "-t", f"{CUADROS / FPS:.4f}",
                    str(DESTINO)], check=True)
    print("listo:", DESTINO)


if __name__ == "__main__":
    main()
