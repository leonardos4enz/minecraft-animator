"""Render vertical por tramos (la exportación de una sola vez cuelga la página): en cada tramo se reinicia la página del
agente SIN ventana, se abre la instantánea tt-<slug> y se exporta [a, b) en la rejilla de cuadros. Luego se unen sin perder
cuadros (setpts=N/30/TB) → videos/<slug>/render/mudo.mp4. `faltan=True` sólo exporta los tramos que no existen."""
import os
import shutil

from comun import FPS, RAIZ, agente, agente_local, carpeta, cuadro, ffmpeg, leer, log

TRAMO_S = 6.0


def tramos(timing):
    fin = timing["duracion_s"]
    cortes = [c["t_s"] for c in timing["cortes"]] + [fin]
    out, a = [], 0.0
    while a < fin - 1e-3:
        objetivo = a + TRAMO_S
        # cortar el tramo en un corte de toma si hay uno cerca (menos estado que arrastrar)
        cand = [c for c in cortes if a + 2.5 <= c <= objetivo + 0.01]
        b = max(cand) if cand and objetivo < fin else min(objetivo, fin)
        b = cuadro(b)
        out.append((cuadro(a), b))
        a = b
    return out


def correr(slug, faltan=False, supermuestreo=1.5):
    dirv = carpeta(slug)
    timing = leer(os.path.join(dirv, "timing.json"))
    dren = os.path.join(dirv, "render")
    os.makedirs(dren, exist_ok=True)
    partes = []
    gancho_hasta = timing.get("gancho_hasta_s", 0)
    for a, b in tramos(timing):
        nombre = f"_tt_{slug}_{round(a * 100):05d}"
        destino = os.path.join(dren, nombre[len(f"_tt_{slug}_"):] + ".mp4")
        partes.append(destino)
        if faltan and os.path.exists(destino):
            continue
        for intento in range(2):
            agente_local("--reiniciar")
            r = agente("abrir", {"nombre": f"tt-{slug}"})
            args = {"nombre": nombre, "calidad": "alta", "escala": 1, "fps": FPS, "desde": a, "hasta": b,
                    "supermuestreo": 1 if a < gancho_hasta else supermuestreo}            # títulos 3D + supermuestreo cuelgan la página
            r = agente("exportar", args, timeout=1500)
            origen = os.path.join(RAIZ, "Videos", nombre + ".mp4")
            if r.get("ok") and os.path.exists(origen):
                shutil.move(origen, destino)
                break
            log(f"  tramo {a}-{b} falló ({r.get('error')}); reintento")
        else:
            raise RuntimeError(f"no pude exportar el tramo {a}-{b}")
        log(f"  tramo {a:6.2f}–{b:6.2f} ok")
    with open(os.path.join(dren, "tramos.txt"), "w") as f:
        f.write("".join(f"file '{p.replace(os.sep, '/')}'\n" for p in partes))
    # filtro concat (decodifica cada tramo): el demuxer concat perdía 1 cuadro en algunas uniones
    mudo = os.path.join(dren, "mudo.mp4")
    entradas = [x for p in partes for x in ("-i", p)]
    filtro = "".join(f"[{k}:v]" for k in range(len(partes))) + f"concat=n={len(partes)}:v=1:a=0,setpts=N/{FPS}/TB[v]"
    ffmpeg(*entradas, "-filter_complex", filtro, "-map", "[v]", "-r", str(FPS), "-c:v", "libx264", "-preset", "slow",
           "-crf", "16", "-pix_fmt", "yuv420p", mudo)
    return mudo
