"""Importa lo que Leo exporta de TikTok Studio (Estadísticas → pestaña → "Descargar datos").
  Entrada: Videos/TikTok/metricas/tiktok_studio_exports/*.zip | *.csv  (Resumen_/Overview_, Contenido_/Content_, …)
  Salida:  tiktok/metricas/cuenta.csv        serie diaria de la cuenta (pestaña Resumen); una fila por fecha, la última gana
           tiktok/metricas/crudo/<archivo>/   los CSV tal cual (nunca se borran)
           tiktok/metricas/importados.json    qué se importó, cuándo y con qué columnas
           tiktok/publicaciones.csv           vistas/likes/comentarios/compartidos por video (pestaña Contenido), si el
                                              título del export coincide con la descripción de un video entregado
Las fechas del Resumen vienen en español y sin año ("19 de septiembre"): el año sale del nombre del archivo
(Overview_2026-09-19_…, que es el primer día del rango)."""
import csv
import datetime
import io
import os
import re
import unicodedata
import zipfile

import paquete
from comun import ENTREGAS, TT, carpeta, escribir, leer

EXPORTS = os.path.join(ENTREGAS, "metricas", "tiktok_studio_exports")
MET = os.path.join(TT, "metricas")
CUENTA = os.path.join(MET, "cuenta.csv")
REGISTRO = os.path.join(MET, "importados.json")
CAMPOS_CUENTA = ["fecha", "vistas_video", "vistas_perfil", "likes", "comentarios", "compartidos"]
MESES = {m: i + 1 for i, m in enumerate(["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto",
                                          "septiembre", "octubre", "noviembre", "diciembre"])}
MESES.update({m: i + 1 for i, m in enumerate(["january", "february", "march", "april", "may", "june", "july", "august",
                                               "september", "october", "november", "december"])})
# columnas posibles (inglés y español) → campo nuestro. Se compara sin acentos y en minúsculas, por inclusión.
COLS = {"vistas_video": ["video views", "visualizaciones de videos", "visualizaciones de video"],
        "vistas_perfil": ["profile views", "visualizaciones de perfil"],
        "likes": ["likes", "me gusta"], "comentarios": ["comments", "comentarios"], "compartidos": ["shares", "veces compartido", "compartid"],
        "fecha": ["date", "fecha"], "titulo": ["video title", "titulo", "title", "publicacion", "post"],
        "vistas": ["total views", "todas las visualizaciones", "video views", "visualizaciones"],
        "guardados": ["saves", "favorit", "guardad"], "publicado": ["post time", "fecha de publicacion", "publish"]}


def norm(s):
    s = unicodedata.normalize("NFD", str(s).lower())
    return " ".join("".join(c for c in s if unicodedata.category(c) != "Mn").split())


def columna(cabeza, campo):
    """la primera columna que contiene la primera palabra clave que aparezca (el orden de COLS manda: 'todas las
    visualizaciones' gana a 'visualizaciones en los últimos 7 días')"""
    for k in COLS[campo]:
        for c in cabeza:
            if k in norm(c):
                return c
    return None


def numero(x):
    x = str(x or "").replace(",", "").replace("%", "").strip()
    try:
        return float(x)
    except ValueError:
        return None


def fecha_es(txt, inicio):
    """'19 de septiembre' (o 'Sep 19', o ya ISO) → date, con el año del inicio del rango (y +1 si el mes ya dio la vuelta)"""
    t = norm(txt)
    if re.match(r"\d{4}-\d{2}-\d{2}", t):
        return datetime.date.fromisoformat(t[:10])
    m = re.match(r"(\d{1,2}) de ([a-z]+)", t) or re.match(r"([a-z]+) (\d{1,2})", t)
    if not m:
        return None
    dia, mes = (m.group(1), m.group(2)) if m.group(1).isdigit() else (m.group(2), m.group(1))
    mes = MESES.get(mes) or next((v for k, v in MESES.items() if k.startswith(mes[:3])), None)
    if not mes:
        return None
    anio = inicio.year + (1 if mes < inicio.month else 0)
    return datetime.date(anio, mes, int(dia))


def leer_cuenta():
    if not os.path.exists(CUENTA):
        return {}
    with open(CUENTA, encoding="utf-8") as f:
        return {r["fecha"]: r for r in csv.DictReader(f)}


def guardar_cuenta(d):
    os.makedirs(MET, exist_ok=True)
    with open(CUENTA, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, CAMPOS_CUENTA)
        w.writeheader()
        for k in sorted(d):
            w.writerow({c: d[k].get(c, "") for c in CAMPOS_CUENTA})


def csvs_de(ruta):
    """[(nombre, texto)] de un .zip (sólo los .csv, por nombre base) o de un .csv suelto"""
    if ruta.lower().endswith(".zip"):
        with zipfile.ZipFile(ruta) as z:
            return [(os.path.basename(i.filename), z.read(i).decode("utf-8-sig", "replace"))
                    for i in z.infolist() if i.filename.lower().endswith(".csv") and not i.is_dir()]
    if ruta.lower().endswith(".csv"):
        with open(ruta, encoding="utf-8-sig", errors="replace") as f:
            return [(os.path.basename(ruta), f.read())]
    return []


def importar_resumen(filas, inicio):
    cab = list(filas[0].keys()) if filas else []
    cf = columna(cab, "fecha")
    if not cf:
        return 0
    cuenta, n = leer_cuenta(), 0
    for r in filas:
        f = fecha_es(r[cf], inicio)
        if not f:
            continue
        cuenta[f.isoformat()] = {"fecha": f.isoformat(), **{c: r.get(columna(cab, c) or "", "") for c in CAMPOS_CUENTA[1:]}}
        n += 1
    guardar_cuenta(cuenta)
    return n


def importar_contenido(filas):
    """una fila por video: se busca el video entregado cuya descripción empiece igual que el título del export"""
    cab = list(filas[0].keys()) if filas else []
    ct = columna(cab, "titulo")
    if not ct:
        return [], []
    fs = paquete.filas()
    descs = {}
    for r in fs:
        g = leer(os.path.join(carpeta(r["slug"]), "guion.json"), {})
        if g.get("descripcion"):
            descs[r["slug"]] = norm(g["descripcion"])[:40]
    ok, sin = [], []
    for row in filas:
        t = norm(row[ct])[:40]
        slug = next((s for s, d in descs.items() if t and (t.startswith(d[:25]) or d.startswith(t[:25]))), None)
        if not slug:
            sin.append(row[ct][:60])
            continue
        fila = next(r for r in fs if r["slug"] == slug)
        for campo in ("vistas", "likes", "comentarios", "compartidos", "guardados"):
            c = columna(cab, campo)
            if c and numero(row.get(c)) is not None:
                fila[campo] = str(int(numero(row[c])))
        ok.append(slug)
    paquete.guardar_filas(fs)
    return ok, sin


def correr():
    reg = leer(REGISTRO, {})
    if not os.path.isdir(EXPORTS):
        return {"aviso": f"no existe {EXPORTS}: Leo deja ahí lo que exporta de TikTok Studio"}
    out = {"nuevos": [], "formatos_nuevos": []}
    for nombre in sorted(os.listdir(EXPORTS)):
        ruta = os.path.join(EXPORTS, nombre)
        clave = f"{nombre}|{os.path.getsize(ruta)}"
        if clave in reg or not os.path.isfile(ruta):
            continue
        m = re.search(r"(\d{4}-\d{2}-\d{2})", nombre)
        inicio = datetime.date.fromisoformat(m.group(1)) if m else datetime.date.today()
        info = {"importado": datetime.datetime.now().isoformat(timespec="minutes"), "csv": {}}
        for csvn, texto in csvs_de(ruta):
            dest = os.path.join(MET, "crudo", os.path.splitext(nombre)[0])
            os.makedirs(dest, exist_ok=True)
            with open(os.path.join(dest, csvn), "w", encoding="utf-8") as f:
                f.write(texto)
            filas = list(csv.DictReader(io.StringIO(texto)))
            cab = list(filas[0].keys()) if filas else []
            tipo = norm(nombre + " " + csvn)
            if "overview" in tipo or "resumen" in tipo:
                info["csv"][csvn] = {"tipo": "resumen", "filas": importar_resumen(filas, inicio), "columnas": cab}
            elif "content" in tipo or "contenido" in tipo:
                ok, sin = importar_contenido(filas)
                info["csv"][csvn] = {"tipo": "contenido", "videos": ok, "sin_video": sin, "columnas": cab}
            else:
                info["csv"][csvn] = {"tipo": "desconocido", "columnas": cab}
                out["formatos_nuevos"].append(f"{nombre}/{csvn}: {cab}")
        reg[clave] = info
        out["nuevos"].append({nombre: info["csv"]})
    escribir(REGISTRO, reg)
    return out


def resumen_cuenta(hoy=None):
    """líneas para aprendizajes.md: la cuenta semana contra semana (de cuenta.csv)"""
    c = leer_cuenta()
    if not c:
        return []
    ult = max(datetime.date.fromisoformat(k) for k in c)
    hoy = hoy or ult

    def suma(campo, d0, d1):
        return sum(numero(r.get(campo)) or 0 for k, r in c.items() if d0 <= (hoy - datetime.date.fromisoformat(k)).days < d1)
    out = ["## La cuenta (export de Resumen)", "", f"Datos hasta el {ult.isoformat()} (TikTok Studio va ~1 día atrasado).", "",
           "| | últimos 7 días | 7 días antes | cambio |", "|---|---|---|---|"]
    for campo, nombre in (("vistas_video", "vistas de video"), ("vistas_perfil", "vistas de perfil"), ("likes", "me gusta"),
                          ("comentarios", "comentarios"), ("compartidos", "compartidos")):
        a, b = suma(campo, 0, 7), suma(campo, 7, 14)
        cambio = f"{(a - b) / b * 100:+.0f} %" if b else ("nuevo" if a else "—")
        out.append(f"| {nombre} | {a:.0f} | {b:.0f} | {cambio} |")
    dias = (datetime.date.today() - ult).days
    if dias > 8:
        out += ["", f"**Export viejo ({dias} días):** pedirle a Leo que exporte Resumen y Contenido (60 días)."]
    return out + [""]
