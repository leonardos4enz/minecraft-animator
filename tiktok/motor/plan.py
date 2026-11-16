"""Plan del día por PILARES (estrategia.json → pilares): un video de cada uno, a su hora, sin empalmar con lo anterior.
  tiktok/plan/<AAAA-MM-DD>.json  {"fecha", "videos": [{"hora", "pilar", "formato", "hecho", "slug", "gancho", "categoria", "motivo"}]}

Pilares y de dónde sale cada video (tiktok/hechos/):
  lo_nuevo   banco_mundo.json (tipo noticia, sin caducar, la más fresca: ≤ frescura_h desde fecha_evento)
  latam      latam.json (premisas de humor; ninguna se repite)
  rotativo   banco_mundo.json (tipo curiosidad): días pares curiosidad a escala, impares debate
  meme       memes.json (estado "subiendo" o "en su pico", riesgo "ninguno"; el mismo meme no antes de 7 días)
  novela     tiktok/novela/biblia.json: el siguiente capítulo
Variedad: un dato o premisa no se repite nunca; la categoría (espacio, autos…) de un pilar no se repite en 2 días; lo_nuevo y
rotativo no comparten categoría el mismo día."""
import datetime
import os
import re

from comun import TT, VIDEOS_TT, escribir, estrategia, leer

PLAN = os.path.join(TT, "plan")
HECHOS = os.path.join(TT, "hechos")


def fuente(nombre):
    """una lista de material (o la biblia de la novela). Acepta la lista sola o {"memes" | "items" | "hechos": [...]}"""
    ruta = os.path.normpath(os.path.join(HECHOS, nombre))
    if "biblia" in nombre:
        return leer(ruta, {})
    d = leer(ruta, [])
    if isinstance(d, dict):
        d = next((v for v in d.values() if isinstance(v, list)), [])
    return d


def planes(excluir=None):
    if not os.path.isdir(PLAN):
        return []
    out = [leer(os.path.join(PLAN, f), {}) for f in sorted(os.listdir(PLAN)) if f.endswith(".json")]
    return [p for p in out if p.get("fecha") != excluir]


def historial(excluir_fecha=None):
    """(pilar, id) ya usados → fecha; y (pilar, fecha) → categorías. Lee los planes y los guiones (por si se hizo algo a mano)"""
    usados, cats = {}, {}
    for p in planes(excluir_fecha):
        for v in p.get("videos", []):
            usados.setdefault((v.get("pilar"), v["hecho"]), p["fecha"])
            cats.setdefault((v.get("pilar"), p["fecha"]), set()).add(v.get("categoria"))
    if os.path.isdir(VIDEOS_TT):
        for slug in os.listdir(VIDEOS_TT):
            g = leer(os.path.join(VIDEOS_TT, slug, "guion.json"), {})
            o = g.get("origen") or {}
            if o.get("id"):
                usados.setdefault((o.get("pilar"), o["id"]), g.get("fecha_plan", ""))
    return usados, cats


def slug_de(texto):
    import unicodedata
    s = unicodedata.normalize("NFD", str(texto).lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")[:40]


def horas_ronda(fecha, n, est):
    """horas para una ronda extra: desde ~1 h 45 min después de ahora (lo que tarda la corrida) hasta el fin de la ventana"""
    fin = datetime.datetime.combine(datetime.date.fromisoformat(fecha), datetime.time.fromisoformat(est["publicacion"]["ventana_dia"][1]))
    ahora = datetime.datetime.now()
    ini = max(ahora + datetime.timedelta(minutes=105), datetime.datetime.combine(fin.date(), datetime.time.fromisoformat(est["publicacion"]["ventana_dia"][0])))
    ini = ini.replace(second=0, microsecond=0) + datetime.timedelta(minutes=(15 - ini.minute % 15) % 15)
    paso = max(30, int((fin - ini).total_seconds() / 60 / max(1, n - 1)) // 5 * 5) if fin > ini else 30
    return [(ini + datetime.timedelta(minutes=paso * k)).strftime("%H:%M") for k in range(n)]


def planificar(fecha=None, n=None, forzar=False, ronda=1):
    """ronda > 1: agrega otra vuelta de pilares al plan que ya existe (sin repetir nada de las rondas anteriores), con
    horas desde ahora hasta el fin de la ventana del día"""
    est = estrategia()
    fecha = fecha or (datetime.date.today() + datetime.timedelta(days=1)).isoformat()
    ruta = os.path.join(PLAN, f"{fecha}.json")
    previo = leer(ruta) if os.path.exists(ruta) else None
    rondas_hechas = (previo or {}).get("rondas", 1 if previo else 0)
    if previo and not forzar and ronda <= rondas_hechas:
        return previo
    hoy = datetime.date.fromisoformat(fecha)
    usados, cats = historial(excluir_fecha=fecha)
    var = est["variedad"]
    negra = [w.lower() for w in var.get("lista_negra", [])]
    videos, avisos, cats_hoy = [], [], set()
    anteriores = [v for v in (previo or {}).get("videos", []) if v.get("ronda", 1) < ronda] if ronda > 1 else []
    for v in anteriores:                                  # lo de las rondas anteriores de hoy cuenta como usado
        usados.setdefault((v.get("pilar"), v["hecho"]), fecha)
        if v.get("pilar") != "novela":
            cats_hoy.add(v.get("categoria"))
    horas = horas_ronda(fecha, len(est["pilares"][: n or len(est["pilares"])]), est) if ronda > 1 else None

    def reciente(pilar, cat):
        return any(cat in cats.get((pilar, (hoy - datetime.timedelta(days=d)).isoformat()), set())
                   for d in range(1, var["dias_sin_repetir_categoria_por_pilar"] + 1))

    def limpio(item):
        texto = " ".join(str(item.get(k, "")) for k in ("dato_es", "gancho_es", "premisa", "que_es")).lower()
        return not any(w in texto for w in negra)

    for pil in est["pilares"][: n or len(est["pilares"])]:
        pid, elegido, motivo = pil["id"], None, ""
        fmt = pil["formato"]
        if isinstance(fmt, list):
            fmt = fmt[(hoy.toordinal() + ronda - 1) % len(fmt)]
        if pid == "novela":
            b = fuente(pil["fuente"])
            hechos = [v for p in planes(fecha) for v in p.get("videos", []) if v.get("pilar") == "novela"] +                      [v for v in anteriores if v.get("pilar") == "novela"]
            cap = max([c["n"] for c in b.get("capitulos", [])] + [int(v["hecho"][3:]) for v in hechos if v["hecho"].startswith("cap")] + [0]) + 1
            serie = slug_de(b.get("titulo", "novela"))
            elegido = {"id": f"cap{cap:02d}", "gancho_es": f"{b.get('titulo', 'Bloquenovela')} · Capítulo {cap}", "categoria": "novela"}
            motivo = f"capítulo {cap} (arco: {next((a for a in b.get('arcos', []) if True), '')[:60]})"
            slug = f"novela-{serie}-cap{cap:02d}"
        else:
            items = fuente(pil["fuente"]) or []
            filtro = pil.get("filtro", {})
            cand = [x for x in items if all(x.get(k) == v for k, v in filtro.items()) and (pid, x["id"]) not in usados and limpio(x)
                    and x.get("caduca", "9999") >= fecha]
            if pid == "meme":
                dias = pil.get("repetir_meme_dias", 7)
                cand = [x for x in cand if str(x.get("estado", "")).startswith(("subiendo", "en su pico"))       # texto libre: "en su pico (evidencia …)"
                        and str(x.get("riesgo", "ninguno")).startswith("ninguno")]
                usados_meme = {k[1] for k, f in usados.items() if k[0] == "meme" and f and (hoy - datetime.date.fromisoformat(f[:10])).days < dias}
                cand = [x for x in cand if x["id"] not in usados_meme]
            if pid == "lo_nuevo":
                def fresco(x):
                    try:
                        return (hoy - datetime.date.fromisoformat(x.get("fecha_evento", "2000-01-01"))).days * 24 <= pil.get("frescura_h", 48)
                    except ValueError:
                        return False
                frescos = [x for x in cand if fresco(x)]
                if not frescos and cand:
                    avisos.append("lo_nuevo: no hay noticias de ≤ 48 h; se usa la más reciente con un ángulo '¿por qué?' (la rutina debe buscar noticias frescas)")
                cand = frescos or sorted(cand, key=lambda x: x.get("fecha_evento", ""), reverse=True)
            cand = [x for x in cand if not (x.get("categoria") and (reciente(pid, x["categoria"]) or x["categoria"] in cats_hoy))] or cand
            cand.sort(key=lambda x: (x.get("potencial", 3), x.get("fecha_evento", "")), reverse=True)
            if not cand:
                avisos.append(f"{pid}: no hay material sin usar en {pil['fuente']} → la rutina tiene que sumar ideas")
                continue
            elegido = cand[0]
            if elegido.get("categoria"):
                cats_hoy.add(elegido["categoria"])
            motivo = f"potencial {elegido.get('potencial', '?')}" + (f" · {elegido.get('fecha_evento')}" if elegido.get("fecha_evento") else "") + \
                     (f" · {elegido.get('estado')}" if elegido.get("estado") else "")
            slug = slug_de(f"{pid}-{elegido['id']}")
        videos.append({"hora": horas[len(videos)] if horas else pil["hora"], "ronda": ronda, "pilar": pid, "pilar_nombre": pil["nombre"], "formato": fmt, "hecho": elegido["id"], "slug": slug,
                       "gancho": elegido.get("gancho_es") or elegido.get("premisa") or elegido.get("nombre"),
                       "categoria": elegido.get("categoria") or pid, "mobs": elegido.get("mobs", []), "motivo": motivo,
                       "musica": pil.get("musica", ["misterio"])[(hoy.toordinal() + ronda - 1) % len(pil.get("musica", ["misterio"]))]})
    pedidos = len(est["pilares"])
    plan = {"fecha": fecha, "rondas": ronda, "pedidos": pedidos * ronda if anteriores else pedidos, "videos": anteriores + videos,
            "faltan": pedidos - len(videos), "aviso": " · ".join(avisos)}
    escribir(ruta, plan)
    return plan


def disponibles():
    """cuánto material sin usar queda por pilar"""
    usados, _ = historial()
    out = {}
    for pil in estrategia()["pilares"]:
        if pil["id"] == "novela":
            continue
        items = fuente(pil["fuente"]) or []
        filtro = pil.get("filtro", {})
        out[pil["id"]] = sum(1 for x in items if all(x.get(k) == v for k, v in filtro.items()) and (pil["id"], x["id"]) not in usados)
    return out
