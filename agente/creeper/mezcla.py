"""Mezcla final desde timing.json (no desde el audio del navegador): música en dos tramos, voces, efectos; la música baja
bajo la voz (sidechain), los efectos van detrás de la voz, todo a −14 LUFS y pico verdadero ≤ −1 dBTP.

  python agente/creeper/mezcla.py <video.mp4> <salida.mp4>
Escribe también agente/creeper/salida/{mezcla.wav, musica_sola.wav} y mide el resultado (ebur128)."""
import json
import os
import subprocess
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(os.path.dirname(AQUI))
T = json.load(open(os.path.join(AQUI, "timing.json"), encoding="utf-8"))
OUT = os.path.join(AQUI, "salida")
os.makedirs(OUT, exist_ok=True)
DUR = T["duracion_s"]
R = lambda a: os.path.join(RAIZ, a)

ins, f = [], []


def entrada(arch):
    ins.extend(["-i", R(arch)])
    return len(ins) // 2 - 1


# música: dos tramos (antes de la parada y después de la explosión)
mus = []
for j, tr in enumerate(T["musica"]["tramos"]):
    k = entrada(T["musica"]["archivo"])
    p0, p1 = tr["pelicula"]
    m0 = tr["musica"][0]
    d = p1 - p0
    fade = f"afade=t=out:st={d - 0.12:.3f}:d=0.12" if j == 0 else f"afade=t=out:st={d - 0.8:.3f}:d=0.8"
    f.append(f"[{k}:a]atrim={m0:.3f}:{m0 + d:.3f},asetpts=PTS-STARTPTS,{fade},adelay={int(p0 * 1000)}:all=1,apad=whole_dur={DUR}[m{j}]")
    mus.append(f"[m{j}]")
f.append("".join(mus) + f"amix=inputs={len(mus)}:normalize=0,volume=0.55,atrim=0:{DUR}[mus]")
# voces
vs = []
for lid, v in T["voces"].items():
    k = entrada(v["archivo"])
    f.append(f"[{k}:a]aformat=channel_layouts=stereo,adelay={int(v['inicio_s'] * 1000)}:all=1,apad=whole_dur={DUR}[v{lid}]")
    vs.append(f"[v{lid}]")
f.append("".join(vs) + f"amix=inputs={len(vs)}:normalize=0,atrim=0:{DUR},asplit=3[voz][vozsc][vozsc2]")
# efectos: un paso alto suave para que no peleen con el grave de la música (salvo la explosión)
fx, acentos = [], []
ACENTO = {"pop", "idea", "whoosh", "hojas"}      # acentos cortos: no se comprimen con la voz (si no, desaparecen bajo ella)
for j, s in enumerate(T["sfx"]):
    k = entrada(json.load(open(os.path.join(AQUI, "audio.json"), encoding="utf-8"))[s["nombre"]])
    hp = "" if s["nombre"] == "explosion" else "highpass=f=180,"
    f.append(f"[{k}:a]aformat=channel_layouts=stereo,{hp}volume={s['vol'] * 0.6:.3f},adelay={int(s['t_s'] * 1000)}:all=1,apad=whole_dur={DUR}[s{j}]")
    (acentos if s["nombre"] in ACENTO else fx).append(f"[s{j}]")
f.append("".join(fx) + f"amix=inputs={len(fx)}:normalize=0,atrim=0:{DUR}[fx0]")
# la música y los efectos bajan cuando habla la voz
f.append("[mus]asplit=2[mus1][musola]")
f.append("[mus1][vozsc]sidechaincompress=threshold=0.02:ratio=6:attack=20:release=350:makeup=1[musd]")
f.append("[fx0][vozsc2]sidechaincompress=threshold=0.05:ratio=2:attack=10:release=200:makeup=1[fxd]")
f.append("".join(acentos) + f"amix=inputs={len(acentos)}:normalize=0,atrim=0:{DUR}[acd]")
f.append("[voz][musd][fxd][acd]amix=inputs=4:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000,alimiter=limit=0.84:level=false[mez]")
f.append("[musola]loudnorm=I=-14:TP=-1.5,aresample=48000,alimiter=limit=0.84:level=false[msola]")

mezcla, sola = os.path.join(OUT, "mezcla.wav"), os.path.join(OUT, "musica_sola.wav")
cmd = ["ffmpeg", "-v", "error", "-y", *ins, "-filter_complex", ";".join(f), "-map", "[mez]", "-t", str(DUR), mezcla, "-map", "[msola]", "-t", str(DUR), sola]
subprocess.run(cmd, check=True)
if len(sys.argv) > 2:
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", sys.argv[1], "-i", mezcla, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "256k",
                    "-t", str(DUR), sys.argv[2]], check=True)
for a in (mezcla, sola):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-i", a, "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True)
    res = r.stderr[r.stderr.rfind("Summary:"):]
    print(os.path.basename(a), " ".join(l.strip() for l in res.splitlines() if l.strip().startswith(("I:", "Peak:", "LRA:"))))
