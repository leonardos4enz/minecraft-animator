"""Del guion al proyecto del animador. Primero el audio y después la imagen:
  1. voces (motor del guion o de estrategia.json) verificadas con Whisper → videos/<slug>/voces.json
  2. línea de tiempo: cada voz va detrás de la anterior; los cortes caen en el beat más cercano a la entrada de cada voz,
     y las tomas extra se anclan a una palabra ("en": "palabra"); ninguna toma pasa de ritmo.max_toma_s
  3. cada toma sale de una receta (recetas.py) → agente/proyectos/tt-<slug>.json + videos/<slug>/timing.json
  4. aplicar: lo abre en la página del agente (sin ventana), pone poses y ojos de LTezla y guarda la instantánea"""
import copy
import json
import os
import re

import kit_audio
import recetas
import voces
from comun import FPS, RAIZ, R, agente, carpeta, cuadro, duracion, escribir, estrategia, leer, log

ORDEN_SFX = ("inicio", "fin")


class ErrorGuion(Exception):
    pass


# ───────────── validación ─────────────
def validar(g):
    err = []
    for campo in ("slug", "titulo", "lineas", "gancho_pantalla"):
        if not g.get(campo):
            err.append(f"falta '{campo}'")
    if g.get("escenario", "pradera") not in recetas.ESCENARIOS_OK:
        err.append(f"escenario no probado en vertical: {g.get('escenario')} (usa {sorted(recetas.ESCENARIOS_OK)})")
    hechos = {h["id"] for h in leer(os.path.join(carpeta(g.get("slug", "")), "facts.json"), {"hechos": []}).get("hechos", [])}
    for ln in g.get("lineas", []):
        tomas = ln.get("tomas") or []
        if not tomas:
            err.append(f"{ln.get('id')}: sin tomas")
        if ln.get("quien") and ln["quien"] not in g.get("reparto", {}):
            err.append(f"{ln.get('id')}: '{ln['quien']}' no está en el reparto")
        for t in tomas:
            err += [f"{ln.get('id')}: {e}" for e in recetas.validar(params_toma(g, ln, t))]
            if t.get("en") and t["en"].lower() not in ln["texto"].lower():
                err.append(f"{ln['id']}: la palabra de corte '{t['en']}' no está en el texto")
        for h in ln.get("hechos", []):
            if h not in hechos:
                err.append(f"{ln['id']}: el hecho '{h}' no está en facts.json")
    if len(g.get("gancho_pantalla", "").split()) > estrategia()["gancho"]["texto_max_palabras"]:
        err.append("gancho_pantalla con demasiadas palabras")
    return err


# ───────────── voces ─────────────
def voz_de(g, ln):
    """la voz de una línea: la del personaje que habla (reparto → "voz": clave de estrategia.voz.personajes o dict), la del
    guion o la de por defecto"""
    est = estrategia()["voz"]
    v = (g.get("reparto", {}).get(ln.get("quien"), {}) or {}).get("voz") if ln.get("quien") else None
    v = v or g.get("voz") or est["defecto"]
    return est["personajes"][v] if isinstance(v, str) else v


def es_ltezla(g, ln):
    """¿esta línea la dice LTezla? (sólo entonces su boca se mueve con la voz)"""
    if not ln.get("quien"):
        return True
    return bool(g.get("reparto", {}).get(ln["quien"], {}).get("ltezla"))


def params_toma(g, ln, tm):
    """los parámetros de una toma, con el reparto y quién habla para las de diálogo"""
    p = dict(tm)
    if p.get("receta") == "dialogo":
        p.setdefault("reparto", g.get("reparto", {}))
        p.setdefault("habla", ln.get("quien"))
    return p


def generar_voces(g, forzar=False):
    ruta = os.path.join(carpeta(g["slug"]), "voces.json")
    hecho = {} if forzar else leer(ruta, {})
    for ln in g["lineas"]:
        voz = voz_de(g, ln)
        firma = json.dumps([ln["texto"], voz], ensure_ascii=False, sort_keys=True)
        if hecho.get(ln["id"], {}).get("firma") == firma:
            continue
        arch = voces.generar(ln["texto"], voz)
        ver = voces.verificar(ln["texto"], arch)
        dur = duracion(arch)
        pal = leer(R(arch[:-4] + ".palabras.json"))
        ppm = round(len(pal) / max(dur, 0.1) * 60)
        hecho[ln["id"]] = {"firma": firma, "archivo": arch, "dur": round(dur, 3), "palabras_por_min": ppm, **ver}
        log(f"  {ln['id']} {dur:5.2f}s {ppm} ppm  similitud {ver['similitud']}  «{ver['oido']}»")
        escribir(ruta, hecho)
    malas = [k for k, v in hecho.items() if v["similitud"] < 0.85]
    if malas:
        log("  ⚠ Whisper no oye el texto exacto en:", malas, "→ reescribe la línea (o cambia de voz) y vuelve a correr")
    return hecho


# ───────────── línea de tiempo ─────────────
def snap(t, beats, izq, der):
    cand = [b for b in beats if t - izq <= b <= t + der]
    return min(cand, key=lambda b: abs(b - t)) if cand else t


def palabra_t(pal, w):
    w = voces.normal(w)
    for p, a, _ in pal:
        if voces.normal(p) == w:
            return a
    for p, a, _ in pal:                             # prefijo ("creeper," / "creepers")
        if voces.normal(p) and w and voces.normal(p)[0].startswith(w[0]):
            return a
    raise ErrorGuion(f"no encontré la palabra '{w}' en la voz")


def linea_de_tiempo(g, vz, musica):
    est = estrategia()
    beats = [b + n * musica["dur"] for n in range(4) for b in musica["beats"]]     # la música se repite si el video es más largo
    t = 0.12
    voz_t, tomas = {}, []
    for k, ln in enumerate(g["lineas"]):
        v = vz[ln["id"]]
        pal = leer(R(v["archivo"][:-4] + ".palabras.json"))
        voz_t[ln["id"]] = {"inicio": round(t, 3), "fin": round(t + v["dur"], 3), "archivo": v["archivo"], "palabras": pal}
        corte0 = 0.0 if k == 0 else snap(t - 0.05, beats, 0.22, 0.04)
        for j, tm in enumerate(ln["tomas"]):
            c = corte0 if j == 0 else snap(t + palabra_t(pal, tm["en"]) - 0.04, beats, 0.1, 0.06) if tm.get("en") else None
            if c is None:
                raise ErrorGuion(f"{ln['id']}: la toma {j + 1} necesita 'en' (palabra donde entra)")
            tomas.append({"linea": ln["id"], "inicio": cuadro(c), "params": params_toma(g, ln, tm)})
        t += v["dur"] + ln.get("pausa", est["ritmo"]["pausa_entre_lineas_s"])
    fin = cuadro(t - est["ritmo"]["pausa_entre_lineas_s"] + g.get("cola", 0.45))
    # "montaje": tomas sin voz al final, cada una con su "dur" (los edits de memes: cortes rápidos sobre la canción que Leo
    # pone en la app). Se marcan con la línea "M" en los cortes; "montaje_bn": true las pasa a blanco y negro (post.py)
    if g.get("montaje"):
        c = fin
        for m in g["montaje"]:
            tomas.append({"linea": "M", "inicio": cuadro(c), "params": params_toma(g, {}, m)})
            c += m.get("dur", 0.8)
        fin = cuadro(c)
    for a, b in zip(tomas, tomas[1:] + [{"inicio": fin}]):
        a["dur"] = round(b["inicio"] - a["inicio"], 4)
    # ninguna toma larga: se parte en dos ángulos del mismo sujeto (en un beat cerca de la mitad)
    maxd, out = est["ritmo"]["max_toma_s"], []
    for tm in tomas:
        partes = [tm]
        while partes[-1]["dur"] > maxd:
            p = partes.pop()
            m = cuadro(snap(p["inicio"] + p["dur"] / 2, beats, 0.3, 0.3))
            partes += [{**p, "dur": round(m - p["inicio"], 4)}, {**p, "inicio": m, "dur": round(p["inicio"] + p["dur"] - m, 4), "angulo2": True}]
        out += partes
    for tm in out:
        if tm["dur"] <= 0.3:
            raise ErrorGuion(f"toma de {tm['dur']} s en {tm['linea']}: separa más las palabras 'en'")
    return voz_t, out, fin


def ventanas_habla(voz_t, a, b):
    """dónde suena la voz dentro de [a, b] (relativo a la toma), uniendo palabras cercanas"""
    vent = []
    for v in voz_t.values():
        for _, x, y in v["palabras"]:
            x, y = v["inicio"] + x - a, v["inicio"] + y - a
            if y <= 0 or x >= b - a:
                continue
            x, y = max(0, x), min(b - a, y)
            if vent and x - vent[-1][1] < 0.25:
                vent[-1][1] = y
            else:
                vent.append([x, y])
    return vent


# ───────────── el proyecto ─────────────
_n = [0]


def nid():
    _n[0] += 1
    return f"tt{_n[0]:04d}"


def partir_gancho(texto, maxc):
    out, cur = [], ""
    for w in texto.upper().split():
        if cur and len(cur) + 1 + len(w) > maxc:
            out.append(cur)
            cur = w
        else:
            cur = (cur + " " + w).strip()
    return out + [cur]


def textos_gancho(g, dur):
    est = estrategia()
    lineas = partir_gancho(g["gancho_pantalla"], est["texto_gancho"]["max_caracteres_linea"])
    n = max(len(l) for l in lineas)
    tam = round(min(6.2, 740 / (n * 0.72 * 19.2)), 2)
    col = g.get("color_gancho", {"color": "#ffe14d", "color2": "#fff6b0", "sombra": "#3a2a00", "sombra2": "#7a5a10"})
    return [{"texto": "\n".join(lineas), "x": 0.5, "y": est["texto_gancho"]["centro_y"], "tam": tam, "prof": 0.3, "relieve": 0.06, "espaciado": -0.03,
             "interlinea": 1.08, "dur": round(dur, 3), "inicio": 0.0, "anim": "golpe", "vivo": 4.0, "crece": 0.06, **col}]


def armar(g, vz):
    ind = kit_audio.indice()
    musica = ind["musica"].get(g.get("musica", "misterio"))
    if not musica:
        raise ErrorGuion(f"no hay música '{g.get('musica')}' en el kit: corre `maquina.py kit`")
    voz_t, tomas, fin = linea_de_tiempo(g, vz, musica)
    ctx0 = {"escenario": g.get("escenario", "pradera"), "ambiente": g.get("ambiente", "dia")}
    base = leer(os.path.join(RAIZ, "agente", "proyectos", "epico_base.json"))
    trailer = leer(os.path.join(RAIZ, "proyectos", "trailer-bobicraft-ltezla.json"))      # sólo lectura
    reposo = copy.deepcopy(base["pistas"]["poses"][0]["pose"])
    p = copy.deepcopy(base)
    p["nombre"] = "TikTok · " + g["titulo"]
    p["escena"] = copy.deepcopy(trailer["escena"])
    p["efectos"] = {**copy.deepcopy(trailer["efectos"]), "vineta": 0.2, "grano": 0.015, "brillo": 0.4}
    p["ajustes"] = {**trailer["ajustes"], "formato": "1080x1920"}
    p["mundo"] = None
    p["ediciones"] = g.get("ediciones", {})
    k = {"escenas": [], "camara": [], "poses": [], "ojos": [], "matices": [], "textos": [], "audio": []}
    personajes, sfx = [], []
    for i, tm in enumerate(tomas):
        a, d = tm["inicio"], tm["dur"]
        ctx = {**ctx0, "escenario": tm["params"].get("escenario", ctx0["escenario"]), "ambiente": tm["params"].get("ambiente", ctx0["ambiente"]), "habla": ventanas_habla(voz_t, a, a + d)}
        params = tm["params"]
        if tm.get("angulo2") and params["receta"] == "dialogo":     # en el diálogo, el segundo ángulo es otro plano
            params = {**params, "plano": {"zoom": "primer", "primer": "hombro", "hombro": "dos", "dos": "primer"}[params.get("plano", "dos")]}
        r = recetas.RECETAS[params["receta"]](params, d, i + (1 if tm.get("angulo2") else 0), ctx)
        if params.get("fx"):                                         # objetos / cuadros / efectos extra en cualquier toma
            r["escena"]["efectos"] = list(r["escena"].get("efectos", [])) + recetas.resolver_fx(params["fx"])
        if tm.get("angulo2") and params["receta"] != "dialogo":     # segundo ángulo: otra distancia
            for c in r["cams"]:
                for lado in ("desde", "hasta"):
                    c[lado] = {**c[lado], "dist": round(c[lado]["dist"] * 0.78, 3), "az": round(-c[lado]["az"] * 1.4, 2)}
        k["escenas"].append({"id": nid(), "dur": d, "nombre": f"{tm['linea']} · {tm['params']['receta']}", "mobs": [], **r["escena"]})
        for c in r["cams"]:
            c = dict(c)
            k["camara"].append({"id": nid(), "tipo": "libre", "dur": c.pop("dur", d), "desde": c["desde"], "hasta": c.pop("hasta", c["desde"]),
                                "curva": c.pop("curva", "lineal"), **{x: v for x, v in c.items() if x != "desde"}})
        k["poses"].append({"id": nid(), "pose": copy.deepcopy(reposo), "dur": d, "trans": 0, "curva": "natural", "corte": True})
        k["ojos"].append({"id": nid(), "cara": "neutral", "dur": d, "mx": 0, "my": 0})
        personajes.append(r.get("personaje"))
        for nombre, t, *vol in r.get("sfx_auto", []):
            sfx.append({"nombre": nombre, "t": round(a + t, 3), "vol": vol[0] if vol else 1.0, "variante": i})
    # sonido de cada línea: ["pop", "inicio" | "fin" | "palabra:<w>" | segundos, vol]
    for ln in g["lineas"]:
        v = voz_t[ln["id"]]
        for s in ln.get("sfx", []):
            nombre, cuando, vol = (list(s) + [1.0])[:3]
            if cuando == "inicio":
                t = v["inicio"] - 0.08
            elif cuando == "fin":
                t = v["fin"]
            elif isinstance(cuando, str) and cuando.startswith("palabra:"):
                t = v["inicio"] + palabra_t(v["palabras"], cuando[8:])
            else:
                t = v["inicio"] + float(cuando)
            sfx.append({"nombre": nombre, "t": round(max(0, t), 3), "vol": vol})
    sfx.append({"nombre": "pop", "t": 0.02, "vol": 0.7})                       # el texto-gancho entra con un pop
    k["textos"] = [{"id": nid(), **x} for x in textos_gancho(g, min(estrategia()["gancho"]["texto_hasta_s"], tomas[0]["dur"] + (tomas[1]["dur"] if len(tomas) > 1 else 0)))]
    # audio en el proyecto (para la vista previa y el lip-sync; la mezcla final la hace mezcla.py)
    k["audio"].append({"id": nid(), "tipo": "musica", "texto": musica["prompt"], "durSfx": 48, "archivo": musica["archivo"], "inicio": 0, "desde": 0,
                       "dur": round(min(fin, musica["dur"]), 3), "vol": 0.3, "salida": 0.3})
    for ln in g["lineas"]:
        v = voz_t[ln["id"]]
        clip = {"id": nid(), "tipo": "voz", "texto": voces.limpio(ln["texto"]), "inicio": v["inicio"], "dur": round(v["fin"] - v["inicio"] + 0.05, 3),
                "vol": 1.0, "archivo": v["archivo"], "alineacion": v["archivo"][:-4] + ".json"}
        if not es_ltezla(g, ln):                   # otro personaje: entra como sonido (la boca de LTezla no se mueve)
            clip.update(tipo="sfx", texto=f"{ln.get('quien')}: {clip['texto']}")
            clip.pop("alineacion")
        k["audio"].append(clip)
    for s in sfx:
        arch = kit_audio.archivo_sfx(s["nombre"], s.get("variante", 0))
        k["audio"].append({"id": nid(), "tipo": "sfx", "texto": s["nombre"], "inicio": s["t"], "dur": round(duracion(arch), 3), "vol": s["vol"], "archivo": arch})
    p["pistas"] = k
    timing = {"fps": FPS, "duracion_s": fin, "cuadros": round(fin * FPS), "musica": {"nombre": g.get("musica", "misterio"), **{x: musica[x] for x in ("archivo", "bpm", "dur")}},
              "beats_s": [b for b in musica["beats"] if b <= fin],
              "cortes": [{"t_s": tm["inicio"], "cuadro": round(tm["inicio"] * FPS), "dur": tm["dur"], "linea": tm["linea"], "receta": tm["params"]["receta"]} for tm in tomas],
              "voces": {lid: {"archivo": v["archivo"], "inicio_s": v["inicio"], "fin_s": v["fin"], "palabras": [[w, round(v["inicio"] + x, 3), round(v["inicio"] + y, 3)] for w, x, y in v["palabras"]]}
                        for lid, v in voz_t.items()},
              "sfx": sorted(sfx, key=lambda s: s["t"]), "gancho": k["textos"][0]["texto"], "gancho_hasta_s": k["textos"][0]["dur"]}
    return p, timing, personajes


def aplicar(slug, personajes):
    """abre la instantánea en la página del agente, pone poses/ojos/matices y guarda la instantánea con todo"""
    r = agente("abrir", {"nombre": f"tt-{slug}"})
    if not r.get("ok"):
        raise ErrorGuion("abrir: " + str(r.get("error")))
    for j, per in enumerate(personajes, 1):
        if per:
            r = agente("personaje", {"toma": j, **per})
            if not r.get("ok"):
                raise ErrorGuion(f"personaje toma {j}: {r.get('error')}")
    r = agente("guardar", {"nombre": f"tt-{slug}"})
    if not r.get("ok"):
        raise ErrorGuion("guardar: " + str(r.get("error")))


def correr(slug, aplicar_en_pagina=True, forzar_voces=False):
    g = leer(os.path.join(carpeta(slug), "guion.json"))
    if not g:
        raise ErrorGuion(f"no existe tiktok/videos/{slug}/guion.json")
    err = validar(g)
    if err:
        raise ErrorGuion("guion inválido:\n  - " + "\n  - ".join(err))
    log("voces…")
    vz = generar_voces(g, forzar_voces)
    p, timing, personajes = armar(g, vz)
    escribir(os.path.join(RAIZ, "agente", "proyectos", f"tt-{slug}.json"), p, indent=None)
    escribir(os.path.join(carpeta(slug), "timing.json"), timing)
    for c in timing["cortes"]:
        log(f"  {c['t_s']:6.2f}  {c['dur']:5.2f}s  {c['linea']:4} {c['receta']}")
    log(f"  total {timing['duracion_s']} s · {len(timing['cortes'])} tomas")
    if aplicar_en_pagina:
        aplicar(slug, personajes)
    return timing


def slug_de(texto):
    import unicodedata
    s = unicodedata.normalize("NFD", texto.lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")[:40]
