"""Controla Minecraft Animator desde la terminal (para agentes de IA). Guía completa: AGENTE.md.

  python herramientas/agente.py ayuda                          comandos de la página (con sus argumentos)
  python herramientas/agente.py estado
  python herramientas/agente.py mob '{"toma": 3, "j": 1, "cambios": {"vel": 2.2}}'
  python herramientas/agente.py hoja '{"toma": 3}'             → agente/salida/hoja_toma3.jpg (mirar la imagen)

Comandos locales (los hace este script con ffmpeg y Python, no la página):
  referencia '{"video": "C:/ruta/original.mp4", "desfase": 0}'   video original con el que se compara
  comparar '{"toma": 3}'  o  '{"ts": [1.2, 5.0]}'                hoja original arriba / réplica abajo, mismos tiempos
  medir '{"video": "Videos/x.mp4"}'                              color, movimiento, cámara y cortes por toma vs la referencia

  --sin-ventana    abre la página del agente SIN ventana (headless, con GPU): no aparece nada en la pantalla del humano ni le
                   roba el foco. Renderiza igual que con ventana (medido: diferencia media 0.54/255 = ruido del códec).
                   Es lo predeterminado: si no hay página del agente conectada, cualquier comando la abre así solo.
  --ventana        lo mismo pero CON ventana visible: sólo si el humano pide mirar (aparece encima y le estorba).
  --cerrar         cierra la página del agente (sólo el navegador con el perfil agente/navegador; nunca otras ventanas).
  --reiniciar      --cerrar y vuelve a abrir sin ventana (para exportaciones largas: la página acumula memoria).
  --conexion       ¿hay página conectada y en qué puerto?
  MCA_SIN_AUTO=1   no abrir la página sola (los comandos irían a la página del humano si está abierta).

Los argumentos van como JSON (o en un archivo: @args.json). Imprime JSON y sale con código 1 si falla.
Puerto: --puerto N, la variable MCA_PUERTO o el primero con página conectada entre 8790 y 8793."""
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request

CAB = {"Content-Type": "application/json", "X-Agente": "1"}
PROYECTO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SALIDA = os.path.join(PROYECTO, "agente", "salida")
REF = os.path.join(PROYECTO, "agente", "referencia.json")


def pedir(puerto, ruta, datos=None, espera=30):
    req = urllib.request.Request(f"http://127.0.0.1:{puerto}{ruta}", headers=CAB,
                                 data=None if datos is None else json.dumps(datos).encode("utf-8"))
    with urllib.request.urlopen(req, timeout=espera) as r:
        return json.loads(r.read().decode("utf-8"))


def buscar_puerto(pedido):
    if pedido:
        return int(pedido)
    candidatos = [int(os.environ["MCA_PUERTO"])] if os.environ.get("MCA_PUERTO") else [8790, 8791, 8792, 8793]
    libres = []
    for p in candidatos:
        try:
            e = pedir(p, "/api/agente/estado", espera=3)
            if e.get("pagina_conectada"):
                return p
            libres.append(p)
        except (urllib.error.URLError, OSError, ValueError):
            pass
    return libres[0] if libres else None


def comando(puerto, cmd, args, espera=300):
    try:
        return pedir(puerto, "/api/agente", {"cmd": cmd, "args": args, "espera": espera}, espera=espera + 30)
    except urllib.error.HTTPError as e:
        return {"ok": False, "error": f"HTTP {e.code}: {e.read().decode('utf-8', 'replace')[:300]}"}


# ───────────── comparar con la referencia (ffmpeg + Pillow) ─────────────
def leer_ref():
    if not os.path.isfile(REF):
        raise SystemExit(json.dumps({"ok": False, "error": "no hay referencia: usa  referencia '{\"video\": \"ruta\"}'"}, ensure_ascii=False))
    return json.load(open(REF, encoding="utf-8"))


def cuadro_ref(video, t, w=640, h=360):
    from PIL import Image
    tmp = tempfile.mktemp(suffix=".png")
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-ss", f"{max(0, t):.3f}", "-i", video, "-frames:v", "1",
                    "-vf", f"scale={w}:{h}", tmp], check=True)
    im = Image.open(tmp).convert("RGB")
    im.load()
    os.remove(tmp)
    return im


def cmd_referencia(args):
    video = os.path.abspath(args["video"])
    if not os.path.isfile(video):
        return {"ok": False, "error": "no existe " + video}
    os.makedirs(os.path.dirname(REF), exist_ok=True)
    json.dump({"video": video, "desfase": float(args.get("desfase", 0))}, open(REF, "w", encoding="utf-8"), ensure_ascii=False)
    return {"ok": True, "resultado": {"video": video, "desfase": float(args.get("desfase", 0))}}


def cmd_comparar(puerto, args):
    from PIL import Image, ImageDraw
    ref = leer_ref()
    ts = args.get("ts")
    if not ts:
        info = comando(puerto, "toma", {"toma": args["toma"]})
        if not info.get("ok"):
            return info
        ini, dur, n = info["resultado"]["inicio"], info["resultado"]["dur"], int(args.get("n", 4))
        ts = [ini + (k + 0.5) * dur / n for k in range(n)]
    W, H = 640, 360
    cols = min(len(ts), int(args.get("columnas", 4)))
    filas = (len(ts) + cols - 1) // cols
    hoja = Image.new("RGB", (W * cols, 2 * H * filas), "black")
    d = ImageDraw.Draw(hoja)
    for i, t in enumerate(ts):
        x, y = (i % cols) * W, (i // cols) * 2 * H
        hoja.paste(cuadro_ref(ref["video"], t + ref.get("desfase", 0), W, H), (x, y))
        r = comando(puerto, "cuadro", {"t": t, "escala": 0.5, "nombre": "_comparar_tmp.jpg"})
        if not r.get("ok"):
            return r
        hoja.paste(Image.open(r["resultado"]["archivo"]).convert("RGB").resize((W, H)), (x, y + H))
        for yy, et, col in [(y, f"ORIGINAL {t:.2f} s", "white"), (y + H, f"REPLICA {t:.2f} s", "yellow")]:
            d.rectangle([x, yy, x + 150, yy + 18], fill="black")
            d.text((x + 4, yy + 3), et, fill=col)
    tmp = os.path.join(SALIDA, "_comparar_tmp.jpg")
    if os.path.isfile(tmp):
        os.remove(tmp)
    nombre = args.get("nombre") or (f"comparar_toma{args['toma']}.jpg" if args.get("toma") else f"comparar_{ts[0]:.2f}.jpg")
    os.makedirs(SALIDA, exist_ok=True)
    ruta = os.path.join(SALIDA, nombre)
    hoja.save(ruta, quality=90)
    return {"ok": True, "resultado": {"archivo": ruta, "ts": [round(t, 3) for t in ts]}}


def cmd_medir(args):
    ref = leer_ref()
    video = os.path.abspath(args["video"]) if args.get("video") else None
    if not video or not os.path.isfile(video):
        return {"ok": False, "error": "da 'video' (un MP4 exportado; p. ej. el de exportar o clip)"}
    carpeta = os.path.join(SALIDA, "medir_" + os.path.splitext(os.path.basename(video))[0])
    r = subprocess.run([sys.executable, os.path.join(PROYECTO, "analisis", "analisis_tomas.py"), ref["video"], video, carpeta],
                       capture_output=True, text=True, encoding="utf-8")
    js = os.path.join(carpeta, "tomas.json")
    if not os.path.isfile(js):
        return {"ok": False, "error": (r.stderr or r.stdout)[-500:]}
    d = json.load(open(js, encoding="utf-8"))
    claves = ["luminancia", "saturacion", "temperatura", "contraste", "movimiento", "camara_pct_s"]
    por_toma = [{"ini": o["ini"], "dur": o["dur"], **{k: [o.get(k), rp.get(k)] for k in claves}}
                for o, rp in zip(d["tomas_original"], d["tomas_replica"])]
    return {"ok": True, "resultado": {
        "nota": "cada métrica = [original, réplica]; por_toma usa los cortes del original",
        "cortes_a_<=2_cuadros": d.get("cortes_a_<=2_cuadros"),
        "resumen": {k: [v.get("original"), v.get("replica"), v.get("correlacion_por_toma")] for k, v in d["resumen"].items()},
        "audio": d.get("audio"), "por_toma": por_toma, "carpeta": carpeta}}


# ───────────── ventana dedicada ─────────────
def buscar_navegador():
    for p in [r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe", r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
              r"C:\Program Files\Google\Chrome\Application\chrome.exe", r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"]:
        if os.path.isfile(p):
            return p
    return shutil.which("msedge") or shutil.which("chrome") or shutil.which("google-chrome") or shutil.which("chromium")


def cerrar_ventana():
    """cierra SOLO el navegador del agente (perfil agente/navegador); el Edge del humano no se toca"""
    if os.name == "nt":
        subprocess.run(["powershell", "-NoProfile", "-Command",
                        "Get-CimInstance Win32_Process -Filter \"Name='msedge.exe' OR Name='chrome.exe'\" | "
                        "Where-Object { $_.CommandLine -like '*agente*navegador*' } | "
                        "ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"],
                       capture_output=True, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    else:
        subprocess.run(["pkill", "-f", os.path.join("agente", "navegador")], capture_output=True)
    time.sleep(1.5)


def proceso_agente_vivo():
    """¿hay un navegador corriendo con el perfil del agente?"""
    if os.name != "nt":
        return subprocess.run(["pgrep", "-f", os.path.join("agente", "navegador")], capture_output=True).returncode == 0
    r = subprocess.run(["powershell", "-NoProfile", "-Command",
                        "@(Get-CimInstance Win32_Process -Filter \"Name='msedge.exe' OR Name='chrome.exe'\" | "
                        "Where-Object { $_.CommandLine -like '*agente*navegador*' }).Count"],
                       capture_output=True, text=True, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    return r.stdout.strip() not in ("", "0")


def asegurar_pagina(puerto):
    """si no hay página del agente conectada, abre una sin ventana (no molesta al humano)"""
    if os.environ.get("MCA_SIN_AUTO") == "1":
        return
    try:
        e = pedir(puerto, "/api/agente/estado", espera=3)
    except (urllib.error.URLError, OSError, ValueError):
        return
    vivo = proceso_agente_vivo()
    if vivo and e.get("ventana_dedicada"):
        return
    # una página del agente ocupada (exportando) deja de consultar un rato: sólo se reabre si lleva 3 min sin aparecer
    if vivo and e.get("dedicada_hace_s") is not None and e["dedicada_hace_s"] < 180:
        return
    cerrar_ventana()                                      # por si quedó una colgada con el perfil tomado
    cmd_ventana(puerto, True)


def cmd_ventana(puerto, sin_ventana):
    nav = buscar_navegador()
    if not nav:
        return {"ok": False, "error": "no encontré Edge ni Chrome"}
    perfil = os.path.join(PROYECTO, "agente", "navegador")
    args = [nav, f"--user-data-dir={perfil}", "--no-first-run", "--no-default-browser-check",
            # que no se frene detrás de otras ventanas, minimizada o en segundo plano
            "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows",
            "--autoplay-policy=no-user-gesture-required", "--window-size=1400,900"]
    if sin_ventana:
        args += ["--headless=new", "--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"]
    args.append(f"--app=http://127.0.0.1:{puerto}/?agente=1")
    subprocess.Popen(args, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                     creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0) if sin_ventana else 0)
    for _ in range(40):
        time.sleep(0.5)
        try:
            e = pedir(puerto, "/api/agente/estado", espera=3)
            if e.get("ventana_dedicada"):
                return {"ok": True, "resultado": {"puerto": puerto, "navegador": os.path.basename(nav), "sin_ventana": sin_ventana,
                                                  "nota": "proyecto propio (otro perfil): carga una plantilla o 'abrir'"}}
        except (urllib.error.URLError, OSError):
            pass
    return {"ok": False, "error": "la ventana no se conectó en 20 s"}


def main(argv):
    puerto = None
    if "--puerto" in argv:
        i = argv.index("--puerto")
        puerto = argv[i + 1]
        del argv[i:i + 2]
    if not argv or argv[0] in ("-h", "--help"):
        print(__doc__)
        return 0
    if argv[0] == "referencia" or argv[0] == "medir":
        args = json.loads(argv[1]) if len(argv) > 1 else {}
        r = cmd_referencia(args) if argv[0] == "referencia" else cmd_medir(args)
        print(json.dumps(r, ensure_ascii=False, indent=1))
        return 0 if r.get("ok") else 1
    puerto = buscar_puerto(puerto)
    if puerto is None:
        print(json.dumps({"ok": False, "error": "no hay servidor del animador (python servidor.py) en 8790-8793"}, ensure_ascii=False))
        return 1
    if argv[0] == "--conexion":
        print(json.dumps({"puerto": puerto, **pedir(puerto, "/api/agente/estado")}, ensure_ascii=False))
        return 0
    if argv[0] == "--cerrar":
        cerrar_ventana()
        print(json.dumps({"ok": True, "resultado": "página del agente cerrada"}, ensure_ascii=False))
        return 0
    if argv[0] in ("--ventana", "--sin-ventana", "--reiniciar"):
        cerrar_ventana()
        r = cmd_ventana(puerto, argv[0] != "--ventana")
        print(json.dumps(r, ensure_ascii=False, indent=1))
        return 0 if r.get("ok") else 1
    cmd = argv[0]
    args = {}
    if len(argv) > 1:
        texto = argv[1]
        if texto.startswith("@"):
            texto = open(texto[1:], encoding="utf-8").read()
        args = json.loads(texto)
    asegurar_pagina(puerto)
    if cmd == "comparar":
        r = cmd_comparar(puerto, args)
    else:
        r = comando(puerto, cmd, args, 3600 if cmd in ("exportar", "revisar", "clip") else 300)
    print(json.dumps(r, ensure_ascii=False, indent=1))
    return 0 if r.get("ok") else 1


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.exit(main(sys.argv[1:]))
