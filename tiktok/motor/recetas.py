"""Recetas de tomas para video VERTICAL (1080×1920). Cada receta convierte una línea del guion en una toma del animador:
escena (mobs, efectos, escenario), cámara que SIEMPRE se mueve (la imagen quieta se castiga en TikTok y en la crítica) y,
si sale LTezla, poses/ojos/matices.

  receta(params, dur, i, ctx) → {"escena": {...}, "cams": [...], "personaje": {"poses", "ojos", "matices"} | None}
    params: lo que trae el guion en "toma" (receta, mob, plano, pose, cara, …)
    dur:    duración de la toma (s) · i: índice de la toma (alterna el sentido del movimiento)
    ctx:    {"escenario", "ambiente", "habla": [[t0, t1], …] (cuándo suena la voz dentro de la toma)}

Geometría: el sujeto queda en el origen mirando a +z y la cámara delante (az 0 = de frente). En vertical el lente de 40°
es vertical: el campo horizontal es de sólo ~23°, por eso las distancias se calculan con el ancho Y el alto del sujeto.
Zona plana en todos los escenarios usados: |x| ≤ 2, −6 ≤ z ≤ 2 (medido con `bloques alturas`)."""
import math
import os

from comun import MOTOR, leer

CAT = leer(os.path.join(MOTOR, "catalogo.json"))
MOBS = CAT["mobs"]
FOV = 40
K_V = 2 * math.tan(math.radians(FOV / 2))                  # alto visible por bloque de distancia
K_H = K_V * 1080 / 1920                                    # ancho visible por bloque de distancia
ALTO_LTEZLA = 1.8
ESCENARIOS_OK = {"pradera", "nieve", "noche", "cerezos", "nether", "aldea"}
AZ_MAX = {"aldea": 22, "cerezos": 28}                     # casas / ladera a los lados
VUELAN = {"abeja", "loro", "phantom", "allay", "vex", "ghast", "ghast_feliz", "murcielago", "blaze"}   # mobs.js los sube ~1.6 bloques
ALTURA_VUELO = 1.6
BLANCOS = {"ghast", "ghast_feliz", "golem_nieve", "oso_polar", "esqueleto", "esqueleto_glacial"}


def A(x, y, z, rot=0):
    return {"x": x, "y": y, "z": z, "rot": rot}


def V(az, el, dist, ty, **k):
    return {"az": round(az, 2), "el": round(el, 2), "dist": round(dist, 3), "ty": round(ty, 3), "fov": k.pop("fov", FOV), **k}


def tam(mob):
    m = MOBS.get(mob) or {}
    w, h = m.get("tam", [0.8, 1.0])
    return max(w, 0.3), max(h, 0.3)


def distancia(w, h, plano):
    """distancia y altura de mira para que el sujeto (ancho w, alto h) llene el plano pedido en vertical"""
    if plano == "cara":                       # primerísimo plano: sólo la cabeza (los edits de memes)
        vis_h, vis_w, ty = 0.26 * h, 0.62 * w, 0.87 * h
        d = max(vis_h / 0.5 / K_V, vis_w / 0.82 / K_H, 0.55) + 0.5 * w
        return d, ty
    if plano == "primer":                     # cabeza / parte de arriba
        vis_h, vis_w, ty = 0.42 * h, 0.9 * w, 0.84 * h
        frac = 0.42
    elif plano == "medio":
        vis_h, vis_w, ty = 0.62 * h, w, 0.68 * h
        frac = 0.7
    else:                                     # completo
        vis_h, vis_w, ty = h, w, 0.47 * h
        frac = 0.5
    d = max(vis_h / frac / K_V, vis_w / 0.82 / K_H, 0.9) + 0.5 * w       # + media profundidad: la cara de adelante está más cerca
    return d, ty


def mover(base, dur, i, ctx, empuje=0.13, barrido=14, el=6, temblor=0.05, fov=FOV):
    """cámara que se acerca y gira un poco (sentido alterno por toma): siempre hay movimiento"""
    d, ty = base
    s = 1 if i % 2 == 0 else -1
    azm = AZ_MAX.get(ctx.get("escenario"), 35)
    a0, a1 = max(-azm, -s * barrido / 2), min(azm, s * barrido / 2)
    if s < 0:
        a0, a1 = min(azm, barrido / 2), max(-azm, -barrido / 2)
    return [dict(desde=V(a0, el, d * (1 + empuje / 2), ty, fov=fov), hasta=V(a1, el + 1.5, d * (1 - empuje / 2), ty, fov=fov),
                 curva="lineal", temblor=temblor, dur=dur)]


def escena_base(ctx, **k):
    e = dict(set=ctx.get("escenario", "pradera"), ambiente=ctx.get("ambiente", "dia"), sat=1.15, calidez=3, nubes=True,
             ancla=A(0, 0, 0), dof=0.3)
    e.update(k)
    return e


def ancho_texto(n, frac):
    """tamaño máximo (en bloques por bloque de distancia) de un texto 3D de n letras para que quepa en `frac` del ancho del
    cuadro vertical. Minecraft Ten: cada letra mide ~0.8 × tam (medido en las hojas: 'PULGADAS' a 0.085 se salía)"""
    return frac * K_H / (0.8 * max(n, 1))


def mob_grupo(mob, x=0.0, z=0.0, dir=0, **k):
    g = {"tipo": mob, "n": 1, "x": x, "z": z, "dir": dir, "modo": "quieto", "fijo": True, "calmo": True, "semilla": 7, "foco": True}
    g.update({a: v for a, v in k.items() if v is not None})
    return g


def hablar(ctx, inten=0.6):
    return [["hablar", round(a, 3), round(b - a, 3), inten] for a, b in ctx.get("habla", []) if b - a > 0.15]


# ═════════════ recetas ═════════════
def presentador(p, dur, i, ctx):
    """LTezla le habla a la cámara. p: pose (presentar), cara (feliz), plano (medio), objeto, mob (a su lado), variante"""
    plano = p.get("plano", "medio")
    base = distancia(0.9 if not p.get("mob") else 2 * (0.75 + tam(p["mob"])[0]), ALTO_LTEZLA, plano)
    esc = escena_base(ctx, actor=A(0, 0, 0, 0), dof=0.35)
    if p.get("objeto"):
        esc["objeto"] = p["objeto"]
    if p.get("mob"):
        wm, _ = tam(p["mob"])
        esc["mobs"] = [mob_grupo(p["mob"], x=0.55 + wm / 2, z=0.45, dir=-12, variante=p.get("variante"), cabezaYaw=[[0, -20], [dur, 5]])]
        esc["actor"] = A(0, 0, 0, 8)
    if p.get("camina"):                                   # LTezla camina hacia la cámara: "camina": metros que avanza
        esc["actor"] = {**esc["actor"], "z": -float(p["camina"])}
        esc["actorHasta"] = {"z": 0}
    pose = p.get("pose", "presentar")
    poses = [[pose, dur]] if not p.get("pose2") else [[pose, round(dur * 0.45, 3)], [p["pose2"], round(dur * 0.55, 3), {"trans": 0.25}]]
    # "el": altura de la cámara en grados (negativa = plano bajo, p. ej. la caminata de un trend); "matices": extra, p. ej. [["caminar", 0, dur, 1]]
    if p.get("ty") is not None:                          # altura a la que apunta la cámara (0.5 = piernas, como en los trends de caminata)
        base = (base[0], p["ty"])
    return {"escena": esc, "cams": mover(base, dur, i, ctx, el=p.get("el", 6)),
            "personaje": {"poses": poses, "ojos": [[p.get("cara", "feliz"), dur, 0, 0, {"aCamara": True}]],
                          "matices": hablar(ctx) + [["balancear", 0, round(dur, 3), 0.4]] + [m if len(m) > 2 else [m[0], 0, round(dur, 3), *m[1:]] for m in p.get("matices", [])]}}


def reaccion(p, dur, i, ctx):
    """LTezla reacciona en primer plano con un empujón rápido. p: pose (sorpresa), cara (sorprendido), temblor, plano (primer | cara)"""
    base = distancia(0.9, ALTO_LTEZLA, p.get("plano", "primer"))
    cams = mover((base[0] * 1.15, base[1]), dur, i, ctx, empuje=0.35, barrido=8, temblor=p.get("temblor", 0.12))
    return {"escena": escena_base(ctx, actor=A(0, 0, 0, 0), dof=0.5), "cams": cams,
            "personaje": {"poses": [[p.get("pose", "sorpresa"), dur]], "ojos": [[p.get("cara", "sorprendido"), dur, 0, 0, {"aCamara": True}]],
                          "matices": hablar(ctx) + ([["temblar", 0, round(min(dur, 0.8), 3), 0.5]] if p.get("tiembla", True) else [])}}


def mob(p, dur, i, ctx):
    """un mob protagonista. p: mob, variante, plano (completo), modo (quieto | caminar), accion, objeto, n, bebe"""
    m = p["mob"]
    w, h = tam(m)
    plano = p.get("plano", "completo")
    d, ty = distancia(w, h, plano)
    base = (d, ty + (ALTURA_VUELO if m in VUELAN else 0))
    g = mob_grupo(m, variante=p.get("variante"), objeto=p.get("objeto"), bebe=p.get("bebe"),
                  cabezaYaw=p.get("cabezaYaw", [[0, 18 if i % 2 else -18], [dur * 0.6, 0]]))
    if p.get("accion"):
        g["accion"] = p["accion"]
        g["calmo"] = False
    if p.get("modo") == "caminar":            # camina hacia la cámara y se detiene
        g.update(modo="caminar", z=-1.2, ruta=[[0, 0.4]], vel=p.get("vel", 0.8), arranque=0.0, parar=round(dur * 0.7, 3), calmo=False)
    esc = escena_base(ctx, actor=A(0, 0, 0.0, 0), ocultar=True, mobs=[g], dof=0.4)
    if m in BLANCOS:
        esc["brillo"] = 0.55                    # el bloom quema los mobs blancos
    if p.get("extras"):
        esc["mobs"] += [mob_grupo(e["mob"], x=e.get("x", 1.5), z=e.get("z", -2.5), dir=e.get("dir", 0), foco=False,
                                  variante=e.get("variante"), modo=e.get("modo", "quieto")) for e in p["extras"]]
    sfx = []
    son = p.get("sonido", "ambient")              # sonido REAL del mob (texturas_mc/sonidos): ambient | hurt | death | false
    if son:
        import kit_audio
        ev = kit_audio.evento_mob(MOBS[m].get("java", m), son)
        if ev:
            sfx.append([f"mc:{ev}", round(min(0.35, dur * 0.2), 3), p.get("vol_sonido", 0.8)])
    return {"escena": esc, "cams": mover(base, dur, i, ctx, el=p.get("el", 8)), "personaje": None, "sfx_auto": sfx}


def versus(p, dur, i, ctx):
    """dos mobs lado a lado con etiqueta. p: a, b, etiqueta_a, etiqueta_b (texto 3D en Minecraft Ten)"""
    (wa, ha), (wb, hb) = tam(p["a"]), tam(p["b"])
    sep = (wa + wb) / 2 + 0.5
    xa, xb = -sep / 2, sep / 2                      # la cámara mira a −z: +x queda a la derecha (a = izquierda)
    h = max(ha, hb)
    d = max((sep + max(wa, wb)) / 0.86 / K_H, h * 1.9 / K_V)
    esc = escena_base(ctx, actor=A(0, 0, 0, 0), ocultar=True, dof=0.15,
                      mobs=[mob_grupo(p["a"], x=xa, variante=p.get("variante_a"), cabezaYaw=[[0, -15], [dur, 10]]),
                            mob_grupo(p["b"], x=xb, variante=p.get("variante_b"), foco=False, cabezaYaw=[[0, 15], [dur, -10]])])
    efe = []
    for x, hh, txt, col in ((xa, ha, p.get("etiqueta_a"), "#ffe14d"), (xb, hb, p.get("etiqueta_b"), "#7fe7ff")):
        if txt:
            efe.append({"tipo": "texto", "texto": txt, "pos": [x, hh + 0.45, 0], "tam": round(min(0.11, ancho_texto(len(txt), 0.5)) * d, 3), "color": col, "sombra": "#151515",
                        "encima": True, "desde": 0.1, "anim": "golpe"})
    esc["efectos"] = efe
    return {"escena": esc, "cams": mover((d, h * 0.55), dur, i, ctx, empuje=0.1, barrido=10, el=7), "personaje": None}


def horda(p, dur, i, ctx):
    """muchos mobs que vienen hacia la cámara (contrapicado). p: mob, n (8), modo (caminar | correr)"""
    m = p["mob"]
    w, h = tam(m)
    g = {"tipo": m, "n": p.get("n", 8), "x": 0, "z": -4.5, "ancho": 3.2, "prof": 3, "dir": 0, "modo": p.get("modo", "caminar"),
         "vel": p.get("vel", 0.9), "semilla": 13, "variante": p.get("variante")}
    esc = escena_base(ctx, actor=A(0, 0, -1.5, 0), ocultar=True, mobs=[{k: v for k, v in g.items() if v is not None}], dof=0.2)
    d = max(h * 3.2 / K_V, 4.2)
    return {"escena": esc, "cams": mover((d, h * 0.7), dur, i, ctx, empuje=0.2, barrido=10, el=-2, temblor=0.07), "personaje": None}


def numero(p, dur, i, ctx):
    """un número grande en 3D que cuenta (texto con {v}) sobre un mob o sobre LTezla. p: texto ("{v} BLOQUES"), desde_v,
    hasta_v, dec, mob (opcional), color"""
    sujeto = p.get("mob")
    w, h = tam(sujeto) if sujeto else (0.9, ALTO_LTEZLA)
    d, _ = distancia(w, h, "completo")
    d *= 1.25
    t_cuenta = round(min(1.4, dur * 0.6), 3)
    largo = len(p.get("texto", "{v}").replace("{v}", f"{p['hasta_v']:.{p.get('dec', 0)}f}"))
    efe = [{"tipo": "texto", "texto": p.get("texto", "{v}"), "valor": [[0.1, p.get("desde_v", 0)], [0.1 + t_cuenta, p["hasta_v"]]],
            "dec": p.get("dec", 0), "pos": [0, h + 0.55, 0], "tam": round(min(0.085, ancho_texto(largo, 0.85)) * d, 3), "color": p.get("color", "#ffe14d"),
            "sombra": "#151515", "encima": True, "desde": 0.05, "anim": "golpe"}]
    if sujeto:
        esc = escena_base(ctx, actor=A(0, 0, 0, 0), ocultar=True, mobs=[mob_grupo(sujeto, variante=p.get("variante"))], efectos=efe, brillo=1.2)
        per = None
    else:
        esc = escena_base(ctx, actor=A(0, 0, 0, 0), efectos=efe, brillo=1.2)
        per = {"poses": [[p.get("pose", "senalar_arriba"), dur]], "ojos": [[p.get("cara", "emocionado"), dur, 0, 0, {"aCamara": True}]], "matices": hablar(ctx)}
    return {"escena": esc, "cams": mover((d, h * 0.62), dur, i, ctx, empuje=0.08, barrido=8), "personaje": per}


def explosion(p, dur, i, ctx):
    """un mob (creeper) que se infla y revienta: destello, humo y polvo. p: mob (creeper), t (s dentro de la toma)"""
    m = p.get("mob", "creeper")
    w, h = tam(m)
    t = p.get("t", round(dur * 0.55, 3))
    pos = [0, h * 0.55, 0]
    efe = [{"tipo": "destello", "t": t, "pos": pos, "tam": 9, "anillo": 6, "color": [3.6, 3.3, 3.0], "dur": 0.5},
           {"tipo": "particulas", "estilo": "humo", "pos": pos, "area": [1.2, 0.8, 1.2], "rafaga": {"t": t + 0.02, "n": 220}, "vel": 4.5,
            "abre": 180, "vida": 1.6, "tam": 0.8, "crece": 2.4, "color": [0.7, 0.7, 0.7], "arrastre": 1.8},
           {"tipo": "particulas", "estilo": "polvo", "forma": "cuadro", "pos": pos, "area": [0.8, 0.4, 0.8], "rafaga": {"t": t, "n": 60}, "vel": 8,
            "abre": 160, "dir": [0, 1, 0], "vida": 1.4, "tam": 0.15, "g": 14, "suelo": True, "color": [0.35, 0.55, 0.2], "color2": [0.45, 0.3, 0.18]}]
    g = mob_grupo(m, hasta=round(t - 0.01, 3))
    esc = escena_base(ctx, actor=A(0, 0, 0, 0), ocultar=True, mobs=[g], efectos=efe, brillo=1.5)
    d, ty = distancia(w, h, "completo")
    cams = mover((d * 1.4, ty), dur, i, ctx, empuje=0.1, barrido=6, temblor=0.06)
    cams[0]["temblor"] = 0.06
    return {"escena": esc, "cams": cams, "personaje": None, "sfx_auto": [["mc:entity.generic.explode", t, 1.0]]}


def paisaje(p, dur, i, ctx):
    """plano general del escenario con mobs paseando (para ubicar). p: mobs [ids], con_ltezla"""
    mobs = [{"tipo": m, "n": 1, "x": (-1.6 + 1.6 * k) if k < 3 else 0, "z": -2.5 - k * 0.7, "dir": 20 * (k - 1), "modo": "caminar",
             "vel": 0.4, "semilla": 3 + k, "fijo": True} for k, m in enumerate(p.get("mobs", [])[:4])]
    con = p.get("con_ltezla", False)
    esc = escena_base(ctx, actor=A(0, 0, 0, 0), ocultar=not con, mobs=mobs, dof=0.1)
    per = {"poses": [[p.get("pose", "contemplar"), dur]], "ojos": [["feliz", dur]], "matices": hablar(ctx)} if con else None
    return {"escena": esc, "cams": mover((7.5, 1.2), dur, i, ctx, empuje=0.12, barrido=18, el=10), "personaje": per}


RECETAS = {"presentador": presentador, "reaccion": reaccion, "mob": mob, "versus": versus, "horda": horda, "numero": numero,
           "explosion": explosion, "paisaje": paisaje}


def validar(p):
    """errores de una toma del guion (antes de gastar en render)"""
    err = []
    r = p.get("receta")
    if r not in RECETAS:
        return [f"receta desconocida: {r} (hay: {', '.join(RECETAS)})"]
    for campo in ("mob", "a", "b"):
        if p.get(campo) and p[campo] not in MOBS:
            err.append(f"mob desconocido: {p[campo]}")
    for e in p.get("extras", []):
        if e.get("mob") not in MOBS:
            err.append(f"mob desconocido: {e.get('mob')}")
    if r == "dialogo":
        rep = p.get("reparto") or {}
        if p.get("habla") not in rep:
            err.append(f"dialogo: '{p.get('habla')}' no está en el reparto")
        for n, s in rep.items():
            if not s.get("ltezla") and s.get("mob") not in MOBS:
                err.append(f"reparto: {n} necesita 'mob' válido o 'ltezla': true")
    if r in ("mob", "horda") and not p.get("mob"):
        err.append(f"la receta {r} necesita 'mob'")
    if r == "versus" and not (p.get("a") and p.get("b")):
        err.append("versus necesita 'a' y 'b'")
    if r == "numero" and "hasta_v" not in p:
        err.append("numero necesita 'hasta_v'")
    for campo, lista in (("pose", CAT["poses"]), ("pose2", CAT["poses"]), ("cara", CAT["expresiones"])):
        if p.get(campo) and p[campo] not in lista:
            err.append(f"{campo} desconocida: {p[campo]}")
    return err


# ═════════════ diálogo (bloquenovela, sketches): personajes que se hablan ═════════════
def VW(cam, actor, ty, fov=FOV):
    """cámara en la posición del mundo `cam` [x, y, z] mirando al actor (a `ty` sobre sus pies)"""
    dx, dy, dz = cam[0] - actor["x"], cam[1] - (actor.get("y", 0) + ty), cam[2] - actor["z"]
    d = math.sqrt(dx * dx + dy * dy + dz * dz)
    return V(math.degrees(math.atan2(dx, dz)) - actor.get("rot", 0), math.degrees(math.asin(dy / d)), d, ty, fov=fov)


def VWT(cam, actor, ty, mira, fov=FOV):
    """como VW, pero apuntando a `mira` [x, y, z] (la escena mira al actor y después gira pan/tilt)"""
    v = VW(cam, actor, ty, fov)

    def ang(px, py, pz):
        dx, dy, dz = px - cam[0], py - cam[1], pz - cam[2]
        return math.degrees(math.atan2(dx, dz)), math.degrees(math.atan2(dy, math.hypot(dx, dz)))
    ha, pa = ang(actor["x"], actor.get("y", 0) + ty, actor["z"])
    hm, pm = ang(*mira)
    v["pan"] = round(((hm - ha + 180) % 360) - 180, 2)
    v["tilt"] = round(pm - pa, 2)
    return v


def alto_de(spec):
    return ALTO_LTEZLA if spec.get("ltezla") else tam(spec["mob"])[1]


def charla(ventanas, dur, base, amp=7):
    """cabeza que asiente un poco mientras habla (los mobs no tienen boca): curva de cabezaYaw"""
    k = [[0, base]]
    for a, b in ventanas:
        t = a
        while t < b - 0.12:
            k += [[round(t, 3), base], [round(t + 0.12, 3), base + amp], [round(t + 0.24, 3), base - amp * 0.4]]
            t += 0.36
        k.append([round(b, 3), base])
    k.append([round(dur, 3), base])
    return sorted(k, key=lambda x: x[0])


CUADRUPEDOS_CAT = {"animal", "mascota"}


def largo_de(spec):
    """largo del cuerpo (los animales de 4 patas son más largos que anchos: la cabeza está adelante)"""
    if spec.get("ltezla"):
        return 0.5
    m = MOBS.get(spec["mob"], {})
    w, h = tam(spec["mob"])
    return w * 1.5 if m.get("cat") in CUADRUPEDOS_CAT and h < 1.6 else w


def cabeza(spec, pos, rot):
    """punto de la cara: alto ≈ 0.85 h y, en los de 4 patas, adelante del centro"""
    h = alto_de(spec)
    adel = 0.62 * largo_de(spec) if not spec.get("ltezla") and largo_de(spec) > tam(spec["mob"])[0] else 0.0
    r = math.radians(rot)
    return [pos[0] + math.sin(r) * adel, h * (0.86 if spec.get("ltezla") else 0.8), pos[2] + math.cos(r) * adel]


def dialogo(p, dur, i, ctx):
    """dos personajes "de telenovela": a ¾ hacia la cámara, mirándose de reojo. p: reparto {nombre: {"ltezla": true |
    "mob": id, "variante", "objeto"}}, habla (quien dice la línea), con (el otro), izq (quien va a la izquierda en toda la
    escena), plano: dos | hombro | primer | zoom (zoom dramático), pose/cara (si LTezla habla), pose_otro/cara_otro"""
    rep = p["reparto"]
    a, b = p["habla"], p.get("con") or next(n for n in rep if n != p["habla"])
    izq = p.get("izq") if p.get("izq") in (a, b) else a
    lado = {izq: -1, (b if izq == a else a): 1}            # la cámara mira hacia −z: +x queda a la derecha
    sep = 0.35 + 0.5 * (largo_de(rep[a]) + largo_de(rep[b]))
    pos = {n: [lado[n] * sep / 2 + lado[n] * 0.15, 0, 0] for n in (a, b)}
    rot = {n: -lado[n] * 50 for n in (a, b)}               # ¾: hacia la cámara (+z) y hacia el otro
    hab = ctx.get("habla", [])
    mobs, actor, ocultar, per = [], None, True, None
    for n in (a, b):
        s_ = rep[n]
        if s_.get("ltezla"):
            actor, ocultar = A(pos[n][0], 0, pos[n][2], rot[n]), False
            el_habla = n == a
            per = {"poses": [[p.get("pose", "presentar") if el_habla else p.get("pose_otro", "relajado"), dur]],
                   "ojos": [[p.get("cara", "neutral") if el_habla else p.get("cara_otro", "sospecha"), dur]],
                   "matices": (hablar(ctx) if el_habla else []) + [["respirar", 0, round(dur, 3), 0.5]]}
        else:
            mira_otro = -lado[n] * 25                       # la cabeza gira hacia el otro
            mobs.append(mob_grupo(s_["mob"], x=pos[n][0], z=pos[n][2], dir=rot[n], variante=s_.get("variante"), objeto=s_.get("objeto"),
                                  foco=n == a, cabezaYaw=charla(hab, dur, mira_otro) if n == a else [[0, mira_otro], [dur, mira_otro]]))
    ca, cb = cabeza(rep[a], pos[a], rot[a]), cabeza(rep[b], pos[b], rot[b])
    if actor is None:
        actor = A(pos[a][0], 0, pos[a][2], rot[a])
    plano = p.get("plano", "dos")
    s = 1 if i % 2 == 0 else -1
    hmax = max(alto_de(rep[a]), alto_de(rep[b]))
    if plano == "dos":
        ancho = 2 * sep + 0.6
        d = max(ancho / 0.85 / K_H, hmax * 1.8 / K_V)
        cam0, cam1 = [0.3 * s, hmax * 0.75 + 0.4, d * 1.06], [-0.2 * s, hmax * 0.7 + 0.35, d * 0.94]
        mira0 = mira1 = [0, hmax * 0.55, 0]
    elif plano == "hombro":                                # desde el lado del que escucha, encuadrando al que habla
        d = max(alto_de(rep[a]) * 1.1 / K_V, 1.6)
        cam0 = [cb[0] + lado[b] * 0.35, cb[1] + 0.25, d + 0.6]
        cam1 = [cb[0] + lado[b] * 0.25, cb[1] + 0.2, d + 0.35]
        mira0 = mira1 = [ca[0], ca[1] - 0.1, ca[2]]
    else:                                                  # primer / zoom: la cara del que habla, de ¾
        ha = alto_de(rep[a])
        base = max((0.55 * ha + 0.25) / 0.75 / K_V, 1.1)   # la mitad de arriba del personaje + aire
        d0 = base * (1.8 if plano == "zoom" else 1.15)
        d1 = base * (1.0 if plano == "zoom" else 0.95)
        r = math.radians(rot[a] * 0.25)                    # casi de frente: así el otro personaje no se cruza
        cam0 = [ca[0] + math.sin(r) * d0, ca[1] + 0.12, ca[2] + math.cos(r) * d0]
        cam1 = [ca[0] + math.sin(r) * d1, ca[1] + 0.06, ca[2] + math.cos(r) * d1]
        mira0 = mira1 = ca
    ty = 1.2
    cams = [dict(desde=VWT(cam0, actor, ty, mira0), hasta=VWT(cam1, actor, ty, mira1), curva="lineal", temblor=0.04, dur=dur)]
    sfx = []
    if plano == "zoom":                                    # el zoom de telenovela: rápido, con golpe
        t_zoom = round(min(0.45, dur * 0.4), 3)
        quieto = {**cams[0]["hasta"], "dist": round(cams[0]["hasta"]["dist"] * 0.96, 3)}
        cams = [dict(desde=cams[0]["desde"], hasta=cams[0]["hasta"], curva="lineal", temblor=0.02, dur=t_zoom),
                dict(desde=cams[0]["hasta"], hasta=quieto, curva="lineal", temblor=0.03, dur=round(dur - t_zoom, 3))]
        if p.get("golpe", True):                          # "golpe": false en líneas cortas: el golpe tapaba la voz (va al "fin" de la línea)
            sfx.append(["golpe", 0.0, 0.9])
    esc = escena_base(ctx, actor=actor, ocultar=ocultar, mobs=mobs, dof=0.45 if plano in ("primer", "zoom", "hombro") else 0.2)
    return {"escena": esc, "cams": cams, "personaje": per, "sfx_auto": sfx}


RECETAS["dialogo"] = dialogo


# ═════════════ objetos a medida y cuadros (tiktok/motor/modelos.py): no sólo Minecraft vanilla ═════════════
def ruta_imagen(img):
    """'meme_bu' → 'tiktok/imagenes/meme_bu.png' (ruta del servidor); una ruta con '/' se deja igual"""
    return img if "/" in img else f"tiktok/imagenes/{img}.png"


def aspecto_imagen(img):
    from PIL import Image
    with Image.open(os.path.join(os.path.dirname(os.path.dirname(MOTOR)), ruta_imagen(img))) as im:
        return im.width / im.height


def resolver_fx(lista):
    """efectos extra de una toma (campo "fx"): {"tipo": "voxel", "modelo": "<nombre>"} trae sus cajas de la biblioteca;
    {"tipo": "cuadro", "imagen": "<nombre>"} apunta a tiktok/imagenes/. El resto pasa tal cual (cualquier efecto de efectos.js)"""
    import modelos
    out = []
    for e in lista or []:
        e = dict(e)
        if e.get("tipo") == "voxel" and e.get("modelo") and not e.get("cajas"):
            e["cajas"] = modelos.cargar(e.pop("modelo"))["cajas"]
        if e.get("tipo") == "cuadro" and e.get("imagen"):
            e["imagen"] = ruta_imagen(e["imagen"])
            e.setdefault("pixel", True)
            e.setdefault("marco", True)
        e.setdefault("pos", [0, 0, 0])
        out.append(e)
    return out


def objeto(p, dur, i, ctx):
    """un objeto de la biblioteca (tiktok/modelos/<modelo>.json) como protagonista; la cámara gira y se acerca.
    p: modelo, escala (1), giro (°), gira (°/s), flota, pop (s, 0.35), plano (completo), con_ltezla (LTezla al lado), pose, cara"""
    import modelos
    m = modelos.cargar(p["modelo"])
    k = p.get("escala", 1)
    w, h, d = (x * k for x in m["tam"])
    ancho = max(w, d) if p.get("giro") else w
    fx = {"tipo": "voxel", "cajas": m["cajas"], "escala": k, "giro": p.get("giro", 0), "gira": p.get("gira", 0),
          "flota": p.get("flota", 0), "pop": p.get("pop", 0.35), "desde": 0}
    if p.get("con_ltezla"):
        fx["pos"] = [round(0.6 + ancho / 2, 3), 0, 0.3]                  # el actor ES LTezla: queda en el centro
        dist, ty = distancia(2 * (0.6 + ancho), max(ALTO_LTEZLA, h), p.get("plano", "completo"))
        esc = escena_base(ctx, actor=A(0, 0, 0, 8), efectos=[fx], dof=0.25)
        per = {"poses": [[p.get("pose", "senalar"), dur]], "ojos": [[p.get("cara", "emocionado"), dur, 0, 0, {"aCamara": True}]], "matices": hablar(ctx)}
    else:
        fx["pos"] = [0, 0, 0]
        dist, ty = distancia(ancho, h, p.get("plano", "completo"))
        esc = escena_base(ctx, actor=A(0, 0, 0, 0), ocultar=True, efectos=[fx], dof=0.2, brillo=1.2)
        per = None
    el = p.get("el", 8 if dist < 12 else 18)              # objetos gigantes: más arriba, que no lo tapen las lomas
    return {"escena": esc, "cams": mover((dist, ty), dur, i, ctx, empuje=0.12, barrido=16, el=el), "personaje": per}


def cuadro(p, dur, i, ctx):
    """una imagen como pintura (marco de madera, pixelada) o pantalla. p: imagen (nombre en tiktok/imagenes/), ancho (2.4),
    con_ltezla (LTezla al lado señalando), plano (medio), luz (1; > 1 = pantalla que brilla), marco (true), pixel (true), pose, cara"""
    W = p.get("ancho", 2.4 if not p.get("con_ltezla") else 1.6)
    H = W / aspecto_imagen(p["imagen"])
    y = round(max(0.4, (ALTO_LTEZLA - H) / 2 + 0.25) + H / 2, 3)
    fx = {"tipo": "cuadro", "imagen": ruta_imagen(p["imagen"]), "ancho": W, "giro": 0, "marco": p.get("marco", True),
          "pixel": p.get("pixel", True), "luz": p.get("luz", 1), "pop": p.get("pop", 0.3), "desde": 0}
    if p.get("con_ltezla"):
        fx["pos"] = [round(0.6 + W / 2, 3), y, -0.2]                     # el actor ES LTezla: queda en el centro
        dist, ty = distancia(2 * (0.6 + W) * 0.85, max(ALTO_LTEZLA, y + H / 2), p.get("plano", "medio"))
        ty = max(ty, y * 0.85)
        esc = escena_base(ctx, actor=A(0, 0, 0, 10), efectos=[fx], dof=0.15)
        per = {"poses": [[p.get("pose", "senalar"), dur]], "ojos": [[p.get("cara", "emocionado"), dur, 0, 0, {"aCamara": True}]], "matices": hablar(ctx)}
    else:
        fx["pos"] = [0, y, 0]
        dist, _ = distancia(W * 1.12, H * 1.12, "completo")
        ty = y
        esc = escena_base(ctx, actor=A(0, 0, 0, 0), ocultar=True, efectos=[fx], dof=0.1)
        per = None
    return {"escena": esc, "cams": mover((dist, ty), dur, i, ctx, empuje=0.1, barrido=10, el=2), "personaje": per}


RECETAS["objeto"] = objeto
RECETAS["cuadro"] = cuadro
_validar_base = validar


def validar(p):        # noqa: F811  (amplía el validador con objetos, cuadros y fx)
    import modelos
    err = _validar_base(p)
    nombres = set(modelos.lista())
    raiz = os.path.dirname(os.path.dirname(MOTOR))
    pedidos = ([p] if p.get("receta") in ("objeto", "cuadro") else []) + [dict(e, receta=e.get("tipo")) for e in p.get("fx", [])]
    for q in pedidos:
        if q.get("receta") in ("objeto", "voxel") and q.get("modelo") not in nombres and not q.get("cajas"):
            err.append(f"modelo desconocido: {q.get('modelo')} (hay: {', '.join(sorted(nombres))})")
        if q.get("receta") == "cuadro" and not os.path.exists(os.path.join(raiz, ruta_imagen(q.get("imagen", "?")))):
            err.append(f"no existe la imagen {ruta_imagen(q.get('imagen', '?'))} (créala con modelos.py dibujo / pixelar)")
    return err
