"""Elige, entre varios audios candidatos, el que más "suena" a lo que buscas, usando AST (AudioSet, MIT).
Uso: python elegir_audio.py "Giggle,Laughter,Chuckle, chortle,Snicker" a.mp3 b.mp3 c.mp3
Imprime la puntuación de cada uno (promedio del máximo por ventana de las etiquetas pedidas)."""
import subprocess
import sys

import numpy as np
import torch
from transformers import ASTFeatureExtractor, ASTForAudioClassification

buscadas = [e.strip() for e in sys.argv[1].split(",") if e.strip()]
# las etiquetas de AudioSet pueden tener coma ("Chuckle, chortle"): se vuelven a unir si hace falta
ext = ASTFeatureExtractor.from_pretrained("MIT/ast-finetuned-audioset-10-10-0.4593")
m = ASTForAudioClassification.from_pretrained("MIT/ast-finetuned-audioset-10-10-0.4593").eval()
nombres = {v: k for k, v in m.config.id2label.items()}
ids = [nombres[n] for n in nombres if any(n.lower().startswith(b.lower()) for b in buscadas)]
SR = 16000
for f in sys.argv[2:]:
    x = np.frombuffer(subprocess.run(["ffmpeg", "-v", "error", "-i", f, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                                     capture_output=True, check=True).stdout, np.float32).copy()
    puntos = []
    for ini in np.arange(0, max(len(x) / SR - 0.4, 0.01), 0.5):
        seg = x[int(ini * SR):int((ini + 1) * SR)]
        with torch.no_grad():
            p = torch.sigmoid(m(**ext(seg, sampling_rate=SR, return_tensors="pt")).logits)[0].numpy()
        puntos.append(max(p[i] for i in ids))
        top = np.argsort(-p)[:3]
    print(f"{np.mean(puntos):.3f}  max {np.max(puntos):.3f}  {f}")
