"""La máquina de TikToks de LTezla (Minecraft Animator). Todo sin ventanas: usa la página del agente headless.

  python tiktok/maquina.py kit                         música por ánimo + efectos (una vez; caché)
  python tiktok/maquina.py ideas [tema]                datos del banco aún sin video, por potencial
  python tiktok/maquina.py nuevo <hecho> [formato]     borrador tiktok/videos/<slug>/{guion,facts}.json (formatos: sabias_que, mito, versus, noticia, historia)
  python tiktok/maquina.py validar <slug>              revisa el guion sin gastar nada
  python tiktok/maquina.py armar <slug>                voces (Whisper) + línea de tiempo + proyecto + poses
  python tiktok/maquina.py hojas <slug>                un cuadro por toma → videos/<slug>/critica/hoja_tomas.jpg
  python tiktok/maquina.py render <slug> [--faltan]    exporta por tramos (vertical) y une
  python tiktok/maquina.py final <slug>                subtítulos + mezcla −14 LUFS + 3 versiones
  python tiktok/maquina.py revisar <slug>              control de calidad automático → revision.json
  python tiktok/maquina.py entregar <slug>             Videos/TikTok/NNN_<slug>/ + publicaciones.csv
  python tiktok/maquina.py todo <slug>                 armar → render → final → revisar → entregar (si no hay bloqueos)
  python tiktok/maquina.py lote <slug> <slug> …        `todo` para varios, uno detrás de otro
  python tiktok/maquina.py plan [fecha] [n]            plan del día (por defecto mañana, estrategia.publicacion.por_dia) sin repetir temas
  python tiktok/maquina.py plan <fecha> --ronda 2      agrega otra vuelta de pilares al plan de ese día (horas desde ahora)
  python tiktok/maquina.py preparar [fecha]            borrador de guion para cada video del plan (luego se afinan)
  python tiktok/maquina.py dia [fecha]                 `todo` para cada video del plan que tenga guion afinado ("afinado": true)
  python tiktok/maquina.py limpiar                     borra intermedios regenerables y, a los 14 días de subido, las versiones extra
  python tiktok/maquina.py importar                    lee los exports de TikTok Studio (Videos/TikTok/metricas/tiktok_studio_exports)
  python tiktok/maquina.py metricas                    lee publicaciones.csv + la cuenta → tiktok/aprendizajes.md
  python tiktok/maquina.py estado                      en qué paso va cada video
Guía completa: TIKTOK.md"""
import json
import os
import sys
import time
import traceback

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "motor"))
sys.stdout.reconfigure(encoding="utf-8")

import armar  # noqa: E402
import formatos  # noqa: E402
import importar  # noqa: E402
import kit_audio  # noqa: E402
import paquete  # noqa: E402
import plan as planes  # noqa: E402
import post  # noqa: E402
import render  # noqa: E402
import revisar  # noqa: E402
from comun import TT, VIDEOS_TT, agente, carpeta, leer, log  # noqa: E402


def c_hojas(slug):
    T = leer(os.path.join(carpeta(slug), "timing.json"))
    agente("abrir", {"nombre": f"tt-{slug}"})
    ts = [round(c["t_s"] + c["dur"] * 0.5, 2) for c in T["cortes"]]
    r = agente("hoja", {"ts": ts, "columnas": min(6, len(ts)), "escala": 0.3})
    log(json.dumps(r, ensure_ascii=False)[:400])


def c_ideas(tema=None):
    banco = leer(os.path.join(TT, "hechos", "banco.json"), [])
    hechos = set(os.listdir(VIDEOS_TT)) if os.path.isdir(VIDEOS_TT) else set()
    for h in sorted(banco, key=lambda h: -h.get("potencial", 0)):
        if tema and tema not in (h.get("tema"), *h.get("mobs", [])):
            continue
        marca = "✓" if h["id"].replace("_", "-") in hechos else " "
        log(f"{marca} {h.get('potencial', 0)}  {h['id']:24} {h['gancho_es']}")


def c_todo(slug, faltan=False):
    t0 = time.time()
    log(f"■ {slug}: armar")
    armar.correr(slug)
    log(f"■ {slug}: render")
    mudo = render.correr(slug, faltan=faltan)
    log(f"■ {slug}: final")
    post.final(slug, mudo)
    log(f"■ {slug}: revisar")
    r = revisar.correr(slug)
    for k, v in r["chequeos"].items():
        log(f"  {'✓' if v['ok'] else ('✗' if v.get('bloquea') else '!')} {k:16} {json.dumps(v['valor'], ensure_ascii=False)[:110]}   ({v['regla']})")
    if r["listo"]:
        log(f"■ {slug}: entregado en {paquete.entregar(slug)}")
    else:
        log(f"■ {slug}: NO se entrega: bloquean {r['bloquean']}")
    log(f"  ({(time.time() - t0) / 60:.1f} min)")
    return r


def c_estado():
    if not os.path.isdir(VIDEOS_TT):
        return log("no hay videos todavía")
    pasos = [("guion.json", "guion"), ("timing.json", "armado"), ("render/mudo.mp4", "render"), ("salida/final.mp4", "final"), ("revision.json", "revisado")]
    entregados = {r["slug"] for r in paquete.filas()}
    for slug in sorted(os.listdir(VIDEOS_TT)):
        hecho = [n for f, n in pasos if os.path.exists(os.path.join(VIDEOS_TT, slug, f))]
        rev = leer(os.path.join(VIDEOS_TT, slug, "revision.json"), {})
        extra = (" · listo" if rev.get("listo") else f" · bloquean {rev.get('bloquean')}") if rev else ""
        log(f"{slug:28} {' > '.join(hecho)}{extra}{' · ENTREGADO' if slug in entregados else ''}")


def main(a):
    if not a or a[0] in ("-h", "--help", "ayuda"):
        return print(__doc__)
    cmd, resto = a[0], a[1:]
    if cmd == "kit":
        kit_audio.asegurar()
    elif cmd == "ideas":
        c_ideas(resto[0] if resto else None)
    elif cmd == "nuevo":
        slug = formatos.borrador(resto[0], resto[1] if len(resto) > 1 else "sabias_que")
        log(f"borrador en tiktok/videos/{slug}/guion.json — afínalo (TIKTOK.md) y luego: maquina.py todo {slug}")
    elif cmd == "validar":
        g = leer(os.path.join(carpeta(resto[0]), "guion.json"))
        err = armar.validar(g)
        log("guion válido" if not err else "\n".join("- " + e for e in err))
    elif cmd == "armar":
        armar.correr(resto[0], forzar_voces="--voces" in resto)
    elif cmd == "hojas":
        c_hojas(resto[0])
    elif cmd == "render":
        log(render.correr(resto[0], faltan="--faltan" in resto))
    elif cmd == "final":
        post.final(resto[0], os.path.join(carpeta(resto[0]), "render", "mudo.mp4"))
    elif cmd == "revisar":
        log(json.dumps(revisar.correr(resto[0]), ensure_ascii=False, indent=1))
    elif cmd == "entregar":
        log(paquete.entregar(resto[0], forzar="--forzar" in resto))
    elif cmd == "todo":
        c_todo(resto[0], faltan="--faltan" in resto)
    elif cmd == "lote":
        for slug in [s for s in resto if not s.startswith("--")]:
            try:
                c_todo(slug, faltan="--faltan" in resto)
            except Exception:                                  # noqa: BLE001  (un video roto no frena el lote)
                log(f"■ {slug}: ERROR\n{traceback.format_exc()[-1500:]}")
    elif cmd == "plan":
        args = [x for x in resto if not x.startswith("--")]
        ronda = int(resto[resto.index("--ronda") + 1]) if "--ronda" in resto else 1
        args = [x for x in args if x != str(ronda) or "--ronda" not in resto]
        p = planes.planificar(args[0] if args else None, int(args[1]) if len(args) > 1 else None, forzar="--rehacer" in resto, ronda=ronda)
        for v in p["videos"]:
            log(f"{v['hora']}  {v.get('pilar', ''):9} {v['formato']:10} {v['hecho']:26} {str(v.get('gancho'))[:60]}")
        if p.get("aviso"):
            log("⚠", p["aviso"])
    elif cmd == "preparar":
        p = planes.planificar(resto[0] if resto else None)
        for v in p["videos"]:
            if os.path.exists(os.path.join(carpeta(v["slug"]), "guion.json")):
                log(f"ya existe: {v['slug']}")
                continue
            formatos.borrador_pilar(v, p["fecha"])
            log(f"borrador: tiktok/videos/{v['slug']}/guion.json")
    elif cmd == "dia":
        p = planes.planificar(resto[0] if resto else None)
        cola = [v["slug"] for v in p["videos"] if leer(os.path.join(carpeta(v["slug"]), "guion.json"), {}).get("afinado")
                and not leer(os.path.join(carpeta(v["slug"]), "revision.json"), {}).get("listo")]
        log(f"{p['fecha']}: {len(cola)} videos para producir")
        for slug in cola:
            try:
                c_todo(slug)
            except Exception:                                  # noqa: BLE001
                log(f"■ {slug}: ERROR\n{traceback.format_exc()[-1500:]}")
        log(json.dumps(paquete.limpiar_viejos(), ensure_ascii=False))
    elif cmd == "limpiar":
        if os.path.isdir(VIDEOS_TT):
            for slug in os.listdir(VIDEOS_TT):
                if any(r["slug"] == slug for r in paquete.filas()):
                    paquete.limpiar_intermedios(slug)
        log(json.dumps({**paquete.limpiar_viejos(), **paquete.espacio()}, ensure_ascii=False))
    elif cmd == "importar":
        log(json.dumps(importar.correr(), ensure_ascii=False, indent=1))
    elif cmd == "metricas":
        log(paquete.metricas())
    elif cmd == "estado":
        c_estado()
    else:
        print(__doc__)


if __name__ == "__main__":
    try:
        main(sys.argv[1:])
    except armar.ErrorGuion as e:
        log("✗", e)
        sys.exit(1)
