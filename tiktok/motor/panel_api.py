"""API del panel de TikToks (tiktok/panel.html), la usa servidor.py. Sin dependencias pesadas: sólo lee/escribe JSON y CSV.
  GET  /api/tiktok/estado?fecha=AAAA-MM-DD   el día (plan + estado de cada video), resumen, espacio, aprendizajes
  POST /api/tiktok/publicado {slug, publicado}  marca un video como subido (publicado = "AAAA-MM-DD HH:MM" o "" para desmarcar)
  POST /api/tiktok/metricas  {slug, campos}     anota las métricas de TikTok Studio (72 h)
  POST /api/tiktok/idea      {texto}            idea de Leo (o "content gap" de Creator Search Insights) para la máquina
  POST /api/tiktok/planificar {fecha, n}        arma (o rehace) el plan de un día
  POST /api/tiktok/abrir     {slug}             abre la carpeta de entrega en el Explorador, con el video seleccionado"""
import datetime
import os
import subprocess
import urllib.parse

import paquete
import plan
from comun import ENTREGAS, RAIZ, TT, VIDEOS_TT, carpeta, estrategia, leer

IDEAS = os.path.join(TT, "ideas_leo.md")
CAMPOS_METRICAS = ["vistas", "tiempo_medio_s", "pct_completo", "likes", "comentarios", "compartidos", "guardados", "seguidores", "pct_para_ti", "notas"]


def url_archivo(ruta):
    rel = os.path.relpath(ruta, RAIZ).replace(os.sep, "/")
    return "/" + urllib.parse.quote(rel)


def estado_video(slug, filas):
    d = carpeta(slug)
    g = leer(os.path.join(d, "guion.json"), {})
    rev = leer(os.path.join(d, "revision.json"), {})
    fila = filas.get(slug)
    paso = "idea"
    for archivo, nombre in (("guion.json", "guion"), ("timing.json", "armado"), ("revision.json", "revisado")):
        if os.path.exists(os.path.join(d, archivo)):
            paso = nombre
    v = {"slug": slug, "titulo": g.get("titulo"), "formato": g.get("formato"), "paso": paso, "listo": bool(rev.get("listo")),
         "bloquean": rev.get("bloquean", []), "avisos": rev.get("avisos", []),
         "comentario": g.get("pregunta_comentarios", ""), "nota_leo": g.get("nota_leo", ""), "sin_musica_subir": bool(g.get("subir_sin_musica"))}
    if fila:
        dest = os.path.join(RAIZ, fila.get("carpeta", ""))
        v.update(paso="entregado", n=fila.get("n"), publicado=fila.get("publicado", ""), duracion=fila.get("duracion_s"),
                 metricas={k: fila.get(k, "") for k in CAMPOS_METRICAS})
        if os.path.isdir(dest):
            arch = sorted(os.listdir(dest))
            final = next((a for a in arch if a.endswith(".mp4") and " - " not in a), None)
            v["video"] = url_archivo(os.path.join(dest, final)) if final else None
            v["sin_musica"] = next((url_archivo(os.path.join(dest, a)) for a in arch if a.endswith("- sin musica.mp4")), None)
            v["portada"] = url_archivo(os.path.join(dest, "portada.jpg")) if "portada.jpg" in arch else None
            v["carpeta"] = dest
            pub = os.path.join(dest, "publicar.txt")
            if os.path.exists(pub):
                txt = open(pub, encoding="utf-8").read()
                v["descripcion"] = txt.split("\n")[1] if txt.startswith("DESCRIPCIÓN") else ""
                v["publicar"] = txt
        if v.get("publicado"):
            v["paso"] = "publicado"
    return v


def estado(fecha=None):
    fecha = fecha or datetime.date.today().isoformat()
    filas = {r["slug"]: r for r in paquete.filas()}
    p = leer(os.path.join(plan.PLAN, f"{fecha}.json"))
    videos = []
    if p:
        for s in p["videos"]:
            v = estado_video(s["slug"], filas)
            v.update(hora=s["hora"], gancho=s.get("gancho"), hecho=s["hecho"], mobs=s.get("mobs", []), motivo=s.get("motivo"),
                     pilar=s.get("pilar_nombre") or s.get("pilar"))
            v["titulo"] = v["titulo"] or s.get("gancho")
            v["formato"] = v["formato"] or s.get("formato")
            videos.append(v)
    planeados = {s["slug"] for f in os.listdir(plan.PLAN) for s in leer(os.path.join(plan.PLAN, f), {}).get("videos", [])} if os.path.isdir(plan.PLAN) else set()
    sueltos = [estado_video(slug, filas) for slug in sorted(os.listdir(VIDEOS_TT)) if slug not in planeados] if os.path.isdir(VIDEOS_TT) else []
    fechas = sorted(f[:-5] for f in os.listdir(plan.PLAN)) if os.path.isdir(plan.PLAN) else []
    est = estrategia()
    disp = plan.disponibles()                      # {pilar: material sin usar}; cada pilar gasta 1 por día
    por_dia = est["publicacion"]["por_dia"]
    return {"ok": True, "fecha": fecha, "hoy": datetime.date.today().isoformat(), "plan": bool(p), "aviso": (p or {}).get("aviso", ""),
            "videos": videos, "sueltos": [v for v in sueltos if v["paso"] in ("entregado", "publicado", "revisado")],
            "fechas_con_plan": fechas, "por_dia": por_dia,
            "datos": {"disponibles": sum(disp.values()), "por_pilar": disp, "dias_de_datos": min(disp.values()) if disp else 0},
            "espacio": paquete.espacio(), "ideas": open(IDEAS, encoding="utf-8").read() if os.path.exists(IDEAS) else "",
            "aprendizajes": open(os.path.join(TT, "aprendizajes.md"), encoding="utf-8").read() if os.path.exists(os.path.join(TT, "aprendizajes.md")) else "",
            "tendencias": ultima_tendencia()}


def ultima_tendencia():
    d = os.path.join(TT, "tendencias")
    if not os.path.isdir(d):
        return ""
    fs = sorted(f for f in os.listdir(d) if f.endswith(".md"))
    return open(os.path.join(d, fs[-1]), encoding="utf-8").read() if fs else ""


def marcar_publicado(slug, publicado):
    fs = paquete.filas()
    for r in fs:
        if r["slug"] == slug:
            r["publicado"] = publicado
            paquete.guardar_filas(fs)
            return {"ok": True}
    return {"ok": False, "error": f"{slug} no está entregado"}


def guardar_metricas(slug, campos):
    fs = paquete.filas()
    for r in fs:
        if r["slug"] == slug:
            for k, v in campos.items():
                if k in CAMPOS_METRICAS:
                    r[k] = str(v).strip()
            paquete.guardar_filas(fs)
            return {"ok": True}
    return {"ok": False, "error": f"{slug} no está entregado"}


def abrir_carpeta(slug, abrir=True):
    """abre la carpeta de entrega en el Explorador con el video final seleccionado. Sólo carpetas dentro de Videos/TikTok
    (la ruta sale de publicaciones.csv, nunca del navegador). abrir=False sólo devuelve la ruta (para probar sin ventanas)"""
    fila = next((r for r in paquete.filas() if r["slug"] == slug), None)
    if not fila:
        return {"ok": False, "error": f"{slug} no está entregado"}
    dest = os.path.realpath(os.path.join(RAIZ, fila.get("carpeta", "")))
    base = os.path.realpath(ENTREGAS)
    if os.path.commonpath([dest, base]) != base or not os.path.isdir(dest):
        return {"ok": False, "error": "no encuentro la carpeta de entrega"}
    arch = sorted(os.listdir(dest))
    final = next((a for a in arch if a.endswith(".mp4") and " - " not in a), None)
    if leer(os.path.join(carpeta(slug), "guion.json"), {}).get("subir_sin_musica"):   # memes: la canción la pone Leo en la app
        final = next((a for a in arch if a.endswith("- sin musica.mp4")), final)
    archivo = os.path.join(dest, final) if final else None
    if abrir:
        if archivo:
            subprocess.Popen(f'explorer /select,"{archivo}"')   # la ventana del Explorador con el mp4 ya marcado
        else:
            os.startfile(dest)
    return {"ok": True, "carpeta": dest, "archivo": archivo}


def agregar_idea(texto):
    texto = " ".join(str(texto).split())[:500]
    if not texto:
        return {"ok": False, "error": "idea vacía"}
    with open(IDEAS, "a", encoding="utf-8") as f:
        f.write(f"- [ ] {datetime.date.today().isoformat()} · {texto}\n")
    return {"ok": True}


def planificar(fecha, n=None, forzar=False):
    return {"ok": True, "plan": plan.planificar(fecha, n, forzar=forzar)}
