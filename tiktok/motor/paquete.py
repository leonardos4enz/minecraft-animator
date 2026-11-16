"""Entrega lista para subir a mano y registro de publicaciones/métricas.
  Videos/TikTok/<NNN>_<slug>/  <Título>.mp4 · <Título> - sin musica.mp4 · <Título> - solo musica.mp4 · portada.jpg · publicar.txt
  tiktok/publicaciones.csv     una fila por video: lo que se generó + lo que Leo anota de TikTok Studio a las 72 h"""
import csv
import datetime
import os
import re
import shutil
import subprocess

from comun import ENTREGAS, TT, carpeta, estrategia, leer

CSV = os.path.join(TT, "publicaciones.csv")
COLUMNAS = ["n", "slug", "titulo", "formato", "serie", "musica", "voz", "duracion_s", "generado", "carpeta",
            "publicado", "hora", "vistas", "tiempo_medio_s", "pct_completo", "likes", "comentarios", "compartidos", "guardados",
            "seguidores", "pct_para_ti", "notas"]


def filas():
    if not os.path.exists(CSV):
        return []
    with open(CSV, encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def guardar_filas(fs):
    with open(CSV, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, COLUMNAS)
        w.writeheader()
        for r in fs:
            w.writerow({k: r.get(k, "") for k in COLUMNAS})


def nombre_archivo(t):
    return re.sub(r'[<>:"/\\|?*]', "", t).strip()


def texto_publicar(g, T, voz_sintetica):
    est = estrategia()
    tags = " ".join(g.get("hashtags", []))
    hor = est["publicacion"]["horarios"]
    lineas = [
        "DESCRIPCIÓN (cópiala tal cual):",
        f"{g.get('descripcion', '').strip()} {tags}".strip(),
        "",
        "AL SUBIR:",
        f"- Duración {T['duracion_s']:.1f} s. Portada: portada.jpg (o el cuadro de 1 s, con el texto-gancho).",
        (f"- Súbelo HOY {g['fecha_plan']} a las {g['hora_plan']} (hora de México), según el plan del día ({g.get('serie', '')})."
         if g.get("hora_plan") and g.get("fecha_plan") else
         f"- Horario sugerido: México {' o '.join(hor['Mexico'])} · España {' o '.join(hor['Espana'])}. Deja ≥ {est['publicacion'].get('min_minutos_entre', 75)} min desde el anterior."),
        (f"- Audio del meme: {g['nota_audio']}" if g.get("nota_audio") else
         "- El sonido del trend es parte del chiste: sube la versión 'sin musica' y pon el sonido del trend en la app a volumen normal."
         if g.get("formato") == "meme" else
         "- ¿Quieres un sonido en tendencia? Sube la versión 'sin musica' y añade el sonido en la app a volumen bajo (5–10 %)."),
    ]
    if voz_sintetica:
        lineas.append("- Activa 'Contenido generado por IA' (la voz es sintética): es lo prudente según las normas de TikTok.")
    if g.get("pregunta_comentarios"):
        lineas.append(f"- Fija un comentario propio: «{g['pregunta_comentarios']}»")
    if g.get("nota_leo"):
        lineas.append(f"- Nota (no se publica): {g['nota_leo']}")
    lineas += ["", "A LAS 72 H: anota en tiktok/publicaciones.csv vistas, tiempo medio, % completo, compartidos, guardados y % 'Para ti'",
               "(TikTok Studio → Analíticas del video) y corre `python tiktok/maquina.py metricas`.", "",
               "FUENTES (lo que se dice en el video):"]
    urls = []                                            # cada fuente una vez, con las segundas fuentes
    for h in leer(os.path.join(carpeta(g["slug"]), "facts.json"), {"hechos": []})["hechos"]:
        for u in (h.get("url"), (h.get("fuente2") or {}).get("url")):
            if u and u not in urls:
                urls.append(u)
    lineas += [f"- {u}" for u in urls]
    return "\n".join(lineas) + "\n"


def entregar(slug, forzar=False):
    rev = leer(os.path.join(carpeta(slug), "revision.json"), {})
    if not rev.get("listo") and not forzar:
        raise RuntimeError(f"{slug}: la revisión no pasó (bloquean {rev.get('bloquean')}); corre `revisar` o usa --forzar")
    g = leer(os.path.join(carpeta(slug), "guion.json"))
    T = leer(os.path.join(carpeta(slug), "timing.json"))
    sal = os.path.join(carpeta(slug), "salida")
    fs = filas()
    fila = next((r for r in fs if r["slug"] == slug), None)
    n = int(fila["n"]) if fila else 1 + max([int(r["n"]) for r in fs] or [0])
    destino = os.path.join(ENTREGAS, f"{n:03d}_{slug}")
    os.makedirs(destino, exist_ok=True)
    titulo = nombre_archivo(g["titulo"])
    for src, nombre in (("final", f"{titulo}.mp4"), ("sin_musica", f"{titulo} - sin musica.mp4"), ("solo_musica", f"{titulo} - solo musica.mp4")):
        shutil.copy2(os.path.join(sal, src + ".mp4"), os.path.join(destino, nombre))
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(min(1.0, T["gancho_hasta_s"] * 0.5)), "-i", os.path.join(sal, "final.mp4"),
                    "-frames:v", "1", "-q:v", "2", os.path.join(destino, "portada.jpg")], check=True)
    voz = g.get("voz") or estrategia()["voz"]["defecto"]
    with open(os.path.join(destino, "publicar.txt"), "w", encoding="utf-8") as f:
        f.write(texto_publicar(g, T, voz.get("motor") in ("eleven", "edge")))
    datos = {"n": n, "slug": slug, "titulo": g["titulo"], "formato": g.get("formato", ""), "serie": g.get("serie", ""), "musica": g.get("musica", ""),
             "voz": f"{voz.get('motor')}:{voz.get('id')}", "duracion_s": T["duracion_s"], "generado": datetime.date.today().isoformat(),
             "carpeta": os.path.relpath(destino, os.path.dirname(TT))}
    if fila:
        fila.update(datos)
    else:
        fs.append(datos)
    guardar_filas(fs)
    if estrategia().get("almacenamiento", {}).get("borrar_intermedios_al_entregar", True):
        limpiar_intermedios(slug)
    return destino


# ───────────── espacio en disco ─────────────
def tam_mb(ruta):
    if os.path.isfile(ruta):
        return os.path.getsize(ruta) / 1e6
    return sum(os.path.getsize(os.path.join(r, f)) for r, _, fs_ in os.walk(ruta) for f in fs_) / 1e6 if os.path.isdir(ruta) else 0.0


def limpiar_intermedios(slug):
    """al entregar: todo lo que se regenera desde el proyecto tt-<slug> (tramos, wav, imagen con subtítulos, copias de salida).
    Queda render/mudo.mp4 (para remezclar sin volver a renderizar) hasta 14 días después de publicar."""
    d = carpeta(slug)
    libre = 0.0
    for sub, conservar in (("render", {"mudo.mp4"}), ("salida", set())):
        base = os.path.join(d, sub)
        if not os.path.isdir(base):
            continue
        for f in os.listdir(base):
            if f in conservar:
                continue
            ruta = os.path.join(base, f)
            if os.path.isfile(ruta):
                libre += tam_mb(ruta)
                os.remove(ruta)
    return round(libre, 1)


def limpiar_viejos(hoy=None):
    """videos publicados hace ≥ N días: se borran el mudo y las versiones 'sin musica' / 'solo musica'; queda el final"""
    dias = estrategia().get("almacenamiento", {}).get("dias_tras_publicar_para_dejar_solo_final", 14)
    hoy = hoy or datetime.date.today()
    libre, n = 0.0, 0
    for r in filas():
        try:
            pub = datetime.date.fromisoformat((r.get("publicado") or "")[:10])
        except ValueError:
            continue
        if (hoy - pub).days < dias:
            continue
        objetivos = [os.path.join(carpeta(r["slug"]), "render", "mudo.mp4")]
        dest = os.path.join(os.path.dirname(TT), r.get("carpeta", ""))
        if os.path.isdir(dest):
            objetivos += [os.path.join(dest, f) for f in os.listdir(dest) if f.endswith(("- sin musica.mp4", "- solo musica.mp4"))]
        for o in objetivos:
            if os.path.isfile(o):
                libre += tam_mb(o)
                os.remove(o)
                n += 1
    return {"archivos": n, "mb_liberados": round(libre, 1)}


def espacio():
    return {"videos_tiktok_mb": round(tam_mb(ENTREGAS), 1), "trabajo_mb": round(tam_mb(os.path.join(TT, "videos")), 1),
            "audio_cache_mb": round(tam_mb(os.path.join(os.path.dirname(TT), "audio")), 1)}


# ───────────── métricas → aprendizajes ─────────────
def num(x):
    try:
        return float(str(x).replace(",", ".").replace("%", ""))
    except ValueError:
        return None


def metricas():
    est = estrategia()["iteracion"]
    import importar
    cuenta = importar.resumen_cuenta()
    fs = [r for r in filas() if num(r.get("vistas"))]
    if not fs:
        txt = "\n".join([f"# Aprendizajes ({datetime.date.today().isoformat()})", "", *cuenta,
                         "Todavía no hay métricas por video (tiktok/publicaciones.csv: vistas, tiempo_medio_s, pct_completo…)."]) + "\n"
        with open(os.path.join(TT, "aprendizajes.md"), "w", encoding="utf-8") as f:
            f.write(txt)
        return txt
    vistas = sorted(num(r["vistas"]) for r in fs)
    p90 = vistas[min(len(vistas) - 1, int(len(vistas) * est["parte2_si_percentil"] / 100))]
    out = [f"# Aprendizajes ({datetime.date.today().isoformat()}, {len(fs)} videos con datos)", "",
           f"Mediana de vistas: {vistas[len(vistas) // 2]:.0f} · percentil {est['parte2_si_percentil']}: {p90:.0f}", "", *cuenta,
           "## Por formato", "", "| formato | videos | vistas medias | % completo medio | tiempo medio / duración | compartidos+guardados por 1k vistas |", "|---|---|---|---|---|---|"]
    por = {}
    for r in fs:
        por.setdefault(r.get("formato") or "?", []).append(r)
    for fmt, rs in sorted(por.items(), key=lambda kv: -sum(num(r["vistas"]) for r in kv[1]) / len(kv[1])):
        v = sum(num(r["vistas"]) for r in rs) / len(rs)
        pc = [num(r["pct_completo"]) for r in rs if num(r.get("pct_completo")) is not None]
        tm = [num(r["tiempo_medio_s"]) / num(r["duracion_s"]) for r in rs if num(r.get("tiempo_medio_s")) and num(r.get("duracion_s"))]
        cg = [((num(r.get("compartidos")) or 0) + (num(r.get("guardados")) or 0)) / num(r["vistas"]) * 1000 for r in rs]
        out.append(f"| {fmt} | {len(rs)} | {v:.0f} | {sum(pc) / len(pc):.1f} % |" if pc else f"| {fmt} | {len(rs)} | {v:.0f} | — |")
        out[-1] += (f" {sum(tm) / len(tm) * 100:.0f} % |" if tm else " — |") + f" {sum(cg) / len(cg):.1f} |"
    out += ["", "## Qué hacer", ""]
    for r in fs:
        pc = num(r.get("pct_completo"))
        if num(r["vistas"]) >= p90 and len(fs) >= 5:
            out.append(f"- **Parte 2 de «{r['titulo']}»** ({r['vistas']} vistas ≥ p{est['parte2_si_percentil']}): mismo formato y gancho parecido, en ≤ 7 días.")
        if pc is not None and pc < est["cambiar_gancho_si_completo_menor"] * 100:
            out.append(f"- «{r['titulo']}»: sólo {pc:.0f} % lo ve completo → el problema es el gancho o el ritmo, no el tema: rehacerlo con otro gancho (A/B, un solo cambio).")
    out.append("- Formatos con mejor % completo arriba de la tabla: el planificador ya les da más peso (aprendizajes.json).")
    # alarma de volumen: con 10 videos al día, ¿bajan las vistas por video?
    def mediana(xs):
        xs = sorted(xs)
        return xs[len(xs) // 2] if xs else None
    hoy = datetime.date.today()
    def semana(desde, hasta):
        return [num(r["vistas"]) for r in fs if r.get("publicado") and desde <= (hoy - datetime.date.fromisoformat(r["publicado"][:10])).days < hasta]
    m1, m0 = mediana(semana(0, 7)), mediana(semana(7, 14))
    if m1 is not None and m0:
        cambio = (m1 - m0) / m0 * 100
        out += ["", "## Volumen", "", f"Mediana de vistas por video: últimos 7 días {m1:.0f} · semana anterior {m0:.0f} ({cambio:+.0f} %)."]
        if cambio < -30:
            out.append("**ALARMA:** las vistas por video cayeron más de 30 %: publicar menos videos al día (estrategia.json → publicacion.por_dia) y priorizar los formatos de arriba.")
    # pesos por formato para el planificador: % completo relativo a la media (entre 0.6 y 1.6)
    pcs = {f: [num(r["pct_completo"]) for r in rs if num(r.get("pct_completo")) is not None] for f, rs in por.items()}
    media = [x for v in pcs.values() for x in v]
    if media:
        mg = sum(media) / len(media)
        from comun import escribir
        escribir(os.path.join(TT, "aprendizajes.json"), {"peso_formato": {f: round(min(1.6, max(0.6, (sum(v) / len(v)) / mg)), 2) for f, v in pcs.items() if v and mg}})
    txt = "\n".join(out) + "\n"
    with open(os.path.join(TT, "aprendizajes.md"), "w", encoding="utf-8") as f:
        f.write(txt)
    return txt
