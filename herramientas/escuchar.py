"""Oído para Claude (y para ti): describe qué se escucha en un audio/video, con modelos abiertos y gratis.

  - AST (MIT, AudioSet): 527 tipos de sonido por ventana de 1 s (risa, habla, pasos, puerta, música…)
  - CLAP (LAION): parecido con descripciones propias ("risa nerviosa", "pasos sobre piedra", …)
  - Prosodia: tono (F0), volumen y ritmo de la voz por tramo → activación emocional
  - Whisper (faster-whisper, local): qué dice y cuándo

Todo corre en tu PC; los modelos se descargan una vez de Hugging Face.
Uso: python escuchar.py <audio_o_video> <salida.json> [--sin-whisper]
"""
import json
import subprocess
import sys

import numpy as np
import torch

archivo, salida = sys.argv[1], sys.argv[2]
SR = 16000
crudo = subprocess.run(["ffmpeg", "-v", "error", "-i", archivo, "-vn", "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True, check=True).stdout
x = np.frombuffer(crudo, np.float32).copy()
dur = len(x) / SR
res = {"archivo": archivo, "duracion": round(dur, 2)}

# ───── AST: eventos de sonido por ventana ─────
from transformers import ASTFeatureExtractor, ASTForAudioClassification
ext = ASTFeatureExtractor.from_pretrained("MIT/ast-finetuned-audioset-10-10-0.4593")
ast = ASTForAudioClassification.from_pretrained("MIT/ast-finetuned-audioset-10-10-0.4593").eval()
etiquetas = ast.config.id2label
ventanas = []
paso, largo = 0.5, 1.0
for ini in np.arange(0, max(dur - 0.25, 0.01), paso):
    seg = x[int(ini * SR):int((ini + largo) * SR)]
    if len(seg) < SR * 0.3:
        continue
    with torch.no_grad():
        p = torch.sigmoid(ast(**ext(seg, sampling_rate=SR, return_tensors="pt")).logits)[0].numpy()
    top = np.argsort(-p)[:4]
    ventanas.append({"t": round(float(ini), 2), "sonidos": [(etiquetas[int(i)], round(float(p[i]), 2)) for i in top if p[i] > 0.08]})
res["eventos"] = ventanas

# ───── CLAP: descripciones propias ─────
from transformers import ClapModel, ClapProcessor
clap = ClapModel.from_pretrained("laion/clap-htsat-unfused").eval()
proc = ClapProcessor.from_pretrained("laion/clap-htsat-unfused")
frases = ["a person talking happily", "a person talking in a surprised voice", "a person asking a question",
          "a person laughing", "a person giggling shyly", "an excited person", "a calm person speaking",
          "footsteps", "camera handling noise", "clothes rustling", "a door", "city ambience", "silence", "music"]
x48 = torch.tensor(x).unsqueeze(0)
x48 = torch.nn.functional.interpolate(x48.unsqueeze(0), scale_factor=48000 / SR, mode="linear").squeeze().numpy()
clap_v = []
for ini in np.arange(0, max(dur - 0.5, 0.01), 1.0):
    seg = x48[int(ini * 48000):int((ini + 1.5) * 48000)]
    with torch.no_grad():
        ent = proc(text=frases, audios=[seg], sampling_rate=48000, return_tensors="pt", padding=True)
        out = clap(**ent)
        pr = out.logits_per_audio.softmax(-1)[0].numpy()
    top = np.argsort(-pr)[:3]
    clap_v.append({"t": round(float(ini), 2), "parece": [(frases[i], round(float(pr[i]), 2)) for i in top]})
res["clap"] = clap_v

# ───── prosodia: tono y volumen por tramo de 1 s ─────
import torchaudio.functional as AF
pros = []
for ini in np.arange(0, dur, 1.0):
    seg = x[int(ini * SR):int((ini + 1.0) * SR)]
    if len(seg) < SR * 0.2:
        continue
    rms = float(np.sqrt((seg ** 2).mean()))
    f0 = AF.detect_pitch_frequency(torch.tensor(seg).unsqueeze(0), SR, freq_low=70, freq_high=500).numpy().ravel()
    f0 = f0[(f0 > 70) & (f0 < 500)]
    pros.append({"t": round(float(ini), 1), "volumen_db": round(20 * np.log10(rms + 1e-9), 1),
                 "tono_hz": round(float(np.median(f0)), 0) if len(f0) and rms > 0.01 else None,
                 "variacion_tono_hz": round(float(np.std(f0)), 0) if len(f0) > 3 and rms > 0.01 else None})
res["prosodia"] = pros

# ───── Whisper ─────
if "--sin-whisper" not in sys.argv:
    try:
        from faster_whisper import WhisperModel
        m = WhisperModel("large-v3", device="cpu", compute_type="int8")
        segs, _ = m.transcribe(archivo, language="es", word_timestamps=True)
        res["palabras"] = [(round(w.start, 2), round(w.end, 2), w.word.strip()) for s in segs for w in s.words]
    except Exception as e:  # sin whisper: se omite
        res["palabras_error"] = str(e)[:200]

json.dump(res, open(salida, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
for v in ventanas:
    print(f"{v['t']:5.1f}s  " + ", ".join(f"{a} {b}" for a, b in v["sonidos"]))
print("--- CLAP ---")
for v in clap_v:
    print(f"{v['t']:5.1f}s  " + " | ".join(f"{a} {b}" for a, b in v["parece"]))
print("--- prosodia ---")
for p in pros:
    print(p)
if "palabras" in res:
    print("--- palabras ---", res["palabras"])
