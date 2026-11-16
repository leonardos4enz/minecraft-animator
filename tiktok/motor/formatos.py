"""Formatos (series) del canal y borradores de guion a partir de un dato del banco (tiktok/hechos/banco.json).
El borrador es un punto de partida válido; quien escribe (Claude o Leo) lo afina siguiendo la estructura del formato."""
import os

from comun import TT, carpeta, escribir, leer
from recetas import MOBS

FORMATOS = {
    "sabias_que": {
        "nombre": "¿Sabías que…? (LTezla explica)", "musica": "misterio", "duracion": "22–35 s",
        "estructura": ["GANCHO (≤ 3 s): contradicción o pregunta, con el mob en pantalla desde el cuadro 0",
                       "CONTEXTO (1 línea): por qué importa / qué creías",
                       "DATO (1–2 líneas): la frase de la fuente, contada fácil",
                       "GIRO (1 línea): consecuencia sorprendente o 'y eso no es todo'",
                       "REMATE / LOOP (≤ 2 s): frase que vuelve a enganchar con la primera"]},
    "mito": {
        "nombre": "¿Mito o verdad?", "musica": "comedia", "duracion": "20–30 s",
        "estructura": ["GANCHO: '¿Es verdad que …?' con el mob", "LTezla duda (reaccion pensar)", "VEREDICTO con sonido (ding / error)",
                       "La prueba: el dato de la fuente", "Remate: '¿Cuál quieres que pruebe ahora? Comenta'"]},
    "versus": {
        "nombre": "¿Quién gana? / ¿Cuál es más…?", "musica": "epico", "duracion": "20–30 s",
        "estructura": ["GANCHO: los dos lado a lado + pregunta", "Dato de A (número)", "Dato de B (número)", "Resultado con reacción", "Pregunta a los comentarios"]},
    "noticia": {
        "nombre": "Llegó a Minecraft (drop nuevo)", "musica": "noticia", "duracion": "25–40 s",
        "estructura": ["GANCHO: 'Esto acaba de llegar a Minecraft'", "Qué es (mob/objeto en pantalla)", "2 cosas que hace", "Cuándo/versión", "Remate"]},
    "historia": {
        "nombre": "Mini historia de LTezla (sketch)", "musica": "comedia", "duracion": "25–45 s",
        "estructura": ["GANCHO: clímax o situación absurda en el cuadro 0", "Planteamiento", "Problema que escala", "Giro", "Remate que hace loop"]},
}


def mob_valido(m):
    return m if m in MOBS else None


def borrador(hecho_id, formato="sabias_que", slug=None, voz=None, fecha=None, hora=None):
    banco = {h["id"]: h for h in leer(os.path.join(TT, "hechos", "banco.json"), [])}
    h = banco.get(hecho_id) or (_ for _ in ()).throw(KeyError(f"no hay '{hecho_id}' en tiktok/hechos/banco.json"))
    slug = slug or hecho_id.replace("_", "-")
    mobs = [m for m in (mob_valido(x) for x in h.get("mobs", [])) if m] or ["creeper"]
    m1, m2 = mobs[0], (mobs[1] if len(mobs) > 1 else mobs[0])
    fmt = FORMATOS[formato]
    clave = MOBS[m1]["nombre"].lower()
    gancho = h["gancho_es"].rstrip(".")
    guion = {
        "slug": slug, "titulo": gancho, "formato": formato, "serie": fmt["nombre"], "objetivo": "crecer",
        "musica": fmt["musica"], "escenario": "pradera", "ambiente": "dia", "clave": clave,
        "gancho_pantalla": " ".join(gancho.upper().split()[:7]),
        "lineas": [
            {"id": "L1", "texto": h["gancho_es"], "hechos": [h["id"]], "tomas": [{"receta": "mob", "mob": m1, "plano": "medio"}], "sfx": [["golpe", "inicio", 0.8]]},
            {"id": "L2", "texto": "¿Y sabes por qué?", "afirma": False, "tomas": [{"receta": "reaccion", "pose": "pensar", "cara": "pensativo"}]},
            {"id": "L3", "texto": h["dato_es"], "hechos": [h["id"]],
             "tomas": [{"receta": "presentador", "pose": "senalar", "cara": "emocionado", "mob": m2, "plano": "completo"}], "sfx": [["whoosh", "inicio", 0.8]]},
            {"id": "L4", "texto": "Síguenme para más secretos de Minecraft.", "afirma": False,
             "tomas": [{"receta": "presentador", "pose": "pulgar", "cara": "feliz", "plano": "medio"}]},
        ],
        "descripcion": f"{h['gancho_es']} ¿Lo sabías?",
        "hashtags": ["#minecraft", f"#{m1.replace('_', '')}", "#curiosidadesminecraft"],
        "pregunta_comentarios": "¿Qué otro secreto de Minecraft quieres que explique?",
        "_notas": {"formato": fmt["estructura"], "visual_sugerido": h.get("visual"), "no_afirmar": h.get("no_afirmar")},
    }
    guion["fecha_plan"] = fecha or ""
    guion["hora_plan"] = hora or ""
    guion["mobs_tema"] = mobs[:1]
    if voz:
        guion["voz"] = voz
    facts = {"hechos": [{"id": h["id"], "frase_fuente": h["cita"], "url": h["url"], "consultado": h["consultado"], "uso": h["dato_es"]}],
             "no_se_afirma": [h.get("no_afirmar", "")]}
    escribir(os.path.join(carpeta(slug), "guion.json"), guion)
    escribir(os.path.join(carpeta(slug), "facts.json"), facts)
    return slug


# ═════════════ pilares (estrategia.json → pilares): borrador con el material de cada video ═════════════
FORMATOS.update({
    "sketch": {"nombre": "Latam en bloques", "musica": "comedia", "duracion": "20–35 s",
               "estructura": ["GANCHO: la situación reconocible en el cuadro 0 ('Cuando tu mamá…')", "escalada en 2–3 golpes, cada uno más absurdo",
                              "remate visual (zoom dramático, cámara lenta, golpe)", "loop o pregunta: '¿en tu casa también?'"]},
    "curiosidad": {"nombre": "Curiosidad a escala", "musica": "misterio", "duracion": "22–35 s",
                   "estructura": ["GANCHO: el número o la comparación imposible", "1 bloque = 1 metro: construir / medir con mobs o LTezla",
                                  "el dato con su fuente", "giro: comparación todavía más loca", "remate"]},
    "debate": {"nombre": "Debate / ¿Quién ganaría?", "musica": "epico", "duracion": "20–30 s",
               "estructura": ["GANCHO: los dos lados en pantalla + pregunta", "dato del lado A", "dato del lado B", "'¿Tú qué opinas? Comenta A o B' (sin dar ganador o con giro)"]},
    "meme": {"nombre": "Meme del momento", "musica": "comedia", "duracion": "10–25 s",
             "estructura": ["la plantilla del meme recreada con bloques en el cuadro 0", "LTezla o mobs la cumplen con un giro propio (de Minecraft o latino)",
                            "remate en ≤ 2 s. El audio del meme NO se incrusta: va en publicar.txt para ponerlo en la app"]},
    "novela": {"nombre": "Bloquenovela", "musica": "terror", "duracion": "28–45 s",
               "estructura": ["GANCHO: la frase más dramática (zoom)", "'Anteriormente…' sólo si hace falta (≤ 3 s)", "3–5 intercambios cortos",
                              "giro absurdo", "cliffhanger + cierre de LTezla: '¿…? Descúbrelo en el próximo capítulo'"]},
})


def borrador_pilar(v, fecha):
    """guion inicial de un video del plan, con todo el material que necesita quien lo escribe (no está "afinado")"""
    from plan import fuente
    est_pil = {p["id"]: p for p in __import__("comun").estrategia()["pilares"]}
    pil = est_pil[v["pilar"]]
    fmt = FORMATOS.get(v["formato"], FORMATOS["sabias_que"])
    guion = {"slug": v["slug"], "titulo": v.get("gancho") or v["slug"], "formato": v["formato"], "pilar": v["pilar"], "serie": pil["nombre"],
             "origen": {"pilar": v["pilar"], "id": v["hecho"]}, "objetivo": "crecer", "musica": v.get("musica", fmt["musica"]),
             "escenario": "pradera", "ambiente": "dia", "clave": "", "gancho_pantalla": "", "lineas": [],
             "descripcion": "", "hashtags": [], "pregunta_comentarios": "", "fecha_plan": fecha, "hora_plan": v["hora"], "afinado": False,
             "_notas": {"estructura": fmt["estructura"], "duracion": fmt["duracion"], "pilar": pil.get("nota", "")}}
    facts = {"hechos": [], "no_se_afirma": []}
    if v["pilar"] in ("lo_nuevo", "rotativo"):
        item = next(x for x in fuente(pil["fuente"]) if x["id"] == v["hecho"])
        guion["_notas"]["material"] = item
        facts["hechos"].append({"id": item["id"], "frase_fuente": item["cita"], "url": item["url"], "fuente": item.get("fuente"),
                                "consultado": item.get("consultado"), "uso": item.get("dato_es")})
        facts["no_se_afirma"].append(item.get("no_afirmar", ""))
        facts["_regla"] = "noticias: agrega una 2.ª fuente (idealmente primaria) antes de afirmar cifras"
    elif v["pilar"] in ("latam", "meme"):
        item = next(x for x in fuente(pil["fuente"]) if x["id"] == v["hecho"])
        guion["_notas"]["material"] = item
        facts["no_se_afirma"].append("ficción/humor: no afirmar hechos reales sin fuente")
    elif v["pilar"] == "novela":
        b = fuente(pil["fuente"])
        guion["reparto"] = {k: {x: s[x] for x in ("mob", "variante", "voz", "ltezla") if x in s} for k, s in b["personajes"].items()}
        guion["escenario"] = b.get("escenario", "pradera")
        guion["_notas"]["biblia"] = {k: b[k] for k in ("titulo", "tono", "formato_capitulo", "arcos", "aprendido_de_frutinovelas") if k in b}
        guion["_notas"]["capitulos_anteriores"] = b.get("capitulos", [])[-5:]
        guion["_notas"]["al_terminar"] = "agrega {n, slug, resumen, cliffhanger, fecha} a tiktok/novela/biblia.json → capitulos"
        facts["no_se_afirma"].append("ficción")
    escribir(os.path.join(carpeta(v["slug"]), "guion.json"), guion)
    escribir(os.path.join(carpeta(v["slug"]), "facts.json"), facts)
    return v["slug"]
