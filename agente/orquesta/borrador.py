"""Render completo de prueba en calidad baja: tramos de 20 s → unir → capa de textos → audio exacto.

    python agente/orquesta/borrador.py [vN]     → agente/orquesta/salida/borrador_<vN>.mp4 (540×960, 30 fps)

La duración, el proyecto y el audio salen de video.json (video.py).

Cada tramo se exporta con `exportar` (calidad normal) y se reintenta con la página reiniciada si se cuelga.
Los cortes van en la rejilla de cuadros (round(t·30)/30) para no perder ni repetir cuadros.
"""
import json, subprocess, sys, time
from pathlib import Path

import video as V

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parents[1]
FPS, CUADROS = V.FPS, V.CUADROS
SAL = AQUI / "salida"
TRAB = SAL / "trabajo"
AG = [sys.executable, str(RAIZ / "herramientas" / "agente.py")]


def agente(*args, timeout=600):
    try:
        r = subprocess.run(AG + list(args), capture_output=True, text=True, encoding="utf-8", timeout=timeout, cwd=RAIZ)
        return r.stdout
    except subprocess.TimeoutExpired:                  # la página se colgó: el que llama reinicia y reintenta
        return '"error": "tiempo agotado"'



def main():
    v = sys.argv[1] if len(sys.argv) > 1 else "v1"
    TRAB.mkdir(parents=True, exist_ok=True)
    cortes = list(range(0, CUADROS, 600)) + [CUADROS]
    partes = []
    for a, b in zip(cortes, cortes[1:]):
        nombre = f"_borr_{v}_{a:05d}"
        dest = TRAB / f"{nombre}.mp4"
        if not dest.exists():
            for intento in range(3):
                t0 = time.time()
                out = agente("exportar", json.dumps({"nombre": nombre, "desde": a / FPS, "hasta": b / FPS, "fps": FPS, "calidad": "normal", "escala": 0.75}))
                vid = RAIZ / "Videos" / f"{nombre}.mp4"
                if vid.exists() and '"ok": true' in out:
                    vid.replace(dest); print(f"tramo {a / FPS:6.1f}–{b / FPS:6.1f} s: {time.time() - t0:.0f} s", flush=True); break
                print(f"tramo {a}: falló ({out[-200:]!r}); reinicio la página", flush=True)
                agente("--reiniciar", timeout=300)
                agente("abrir", json.dumps({"nombre": V.PROYECTO}), timeout=600)
                for l in subprocess.run([sys.executable, str(AQUI / "rollo.py"), "personajes"], capture_output=True, text=True).stdout.splitlines():
                    (TRAB / "_per.json").write_text(l, encoding="utf-8"); agente("personaje", "@" + str(TRAB / "_per.json"))
            else:
                raise SystemExit(f"el tramo {a} no salió")
        partes.append((dest, b - a))
    # unir: cada tramo recortado a su número exacto de cuadros, escalado a 540×960
    filtros, entradas = [], []
    for i, (p, n) in enumerate(partes):
        entradas += ["-i", str(p)]
        filtros.append(f"[{i}:v]scale=540:960:flags=bicubic,fps={FPS},trim=end_frame={n},setpts=PTS-STARTPTS[v{i}]")
    k = len(partes)
    filtros.append("".join(f"[v{i}]" for i in range(k)) + f"concat=n={k}:v=1:a=0[vid]")
    entradas += ["-f", "concat", "-safe", "0", "-i", str(SAL / "textos" / "lista.txt")]
    filtros.append(f"[{k}:v]scale=540:960,format=rgba[tx];[vid][tx]overlay=0:0:shortest=1,setpts=N/{FPS}/TB[out]")
    entradas += ["-i", str(V.WAV)]
    final = SAL / f"borrador_{v}.mp4"
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *entradas, "-filter_complex", ";".join(filtros),
                    "-map", "[out]", "-map", f"{k + 1}:a", "-frames:v", str(CUADROS), "-c:v", "libx264", "-crf", "26", "-preset", "veryfast",
                    "-c:a", "aac", "-b:a", "160k", "-af", "loudnorm=I=-14:TP=-1.5", "-shortest", str(final)], check=True)
    print("listo:", final)


if __name__ == "__main__":
    main()
