"""Servidor local de Minecraft Animator (solo 127.0.0.1). Sin caché: los cambios se ven al recargar.

Además de servir la página:
  POST /guardar?nombre=x.mp4   guarda un video/imagen exportado en Videos/
  GET  /api/tiktok/estado · POST /api/tiktok/{publicado,metricas,idea,planificar,abrir}   panel tiktok/panel.html (tiktok/motor/panel_api.py)
  POST /api/voz   {texto, voz, modelo}   voz con ElevenLabs → audio/voz_<hash>.mp3 (caché por texto)
  POST /api/sfx   {texto, dur}           efecto de sonido con ElevenLabs → audio/sfx_<hash>.mp3
  POST /api/musica {texto, dur}          música instrumental con ElevenLabs → audio/musica_<hash>.mp3
  GET  /api/voces                        voces de tu cuenta de ElevenLabs
  POST /api/texturas                     copia las texturas de bloques de tu Minecraft a texturas_mc/
Proyectos (un archivo por video en proyectos/, con autoguardado desde la página; también exigen "X-Agente: 1"):
  GET  /api/proyectos                    lista: id, nombre, fecha, duración, tomas, miniatura
  POST /api/proyectos/guardar?id=x       guarda proyectos/x.json (escritura atómica) y su ficha proyectos/x.meta.json
  POST /api/proyectos/miniatura?id=x     proyectos/x.jpg
  POST /api/proyectos/borrar?id=x        mueve el proyecto a proyectos/papelera/ (no se borra nada)
Puente para agentes de IA (ver AGENTE.md y herramientas/agente.py); todo exige el encabezado "X-Agente: 1":
  POST /api/agente {cmd, args, espera}   encola un comando, espera a que la página lo ejecute y devuelve el resultado
  GET  /api/agente/estado                ¿hay una página conectada? (la página consulta la cola cada pocos segundos)
  GET  /api/agente/siguiente             (la página) espera el siguiente comando · POST /api/agente/resultado (la página)
  POST /api/agente/archivo?nombre=x      (la página) guarda imágenes en agente/salida/ y proyectos en agente/proyectos/
La key de ElevenLabs la carga Simulador Vida (mente.config.secreto); nunca pasa por el navegador.
"""
import functools
import hashlib
import http.server
import json
import os
import re
import subprocess
import sys
import threading
import time
import uuid
import urllib.parse

PUERTO = int(sys.argv[1]) if len(sys.argv) > 1 else 8790
CARPETA = os.path.dirname(os.path.abspath(__file__))
SIM_VIDA = os.path.join(os.path.expanduser("~"), "Desktop", "Simulador Vida")
PY_SIM = os.path.join(SIM_VIDA, ".venv", "Scripts", "python.exe")
ELEVEN = os.path.join(CARPETA, "herramientas", "eleven.py")


def eleven(*args) -> dict:
    if not os.path.isfile(PY_SIM):
        return {"ok": False, "error": "No encontré el proyecto Simulador Vida (necesario para la key de ElevenLabs)"}
    env = {**os.environ, "PYTHONPATH": os.path.join(SIM_VIDA, "src"), "PYTHONIOENCODING": "utf-8"}
    r = subprocess.run([PY_SIM, ELEVEN, *args], cwd=SIM_VIDA, env=env, capture_output=True, text=True, encoding="utf-8", timeout=360)
    lineas = [l for l in r.stdout.strip().splitlines() if l.startswith("{")]
    return json.loads(lineas[-1]) if lineas else {"ok": False, "error": (r.stderr or "sin respuesta")[-300:]}


def panel_api():
    """tiktok/motor/panel_api.py (se importa al primer uso: el animador funciona igual sin la carpeta tiktok/)"""
    motor = os.path.join(CARPETA, "tiktok", "motor")
    if motor not in sys.path:
        sys.path.insert(0, motor)
    import panel_api as api  # noqa: E402
    return api


# ───────────── proyectos: proyectos/<id>.json + <id>.meta.json (ficha chica para listar) + <id>.jpg (miniatura) ─────────────
PROYECTOS = os.path.join(CARPETA, "proyectos")


def id_proyecto(texto):
    t = re.sub(r"[^a-z0-9_-]+", "-", (texto or "").lower()).strip("-")[:60]
    return t or None


def listar_proyectos():
    out = []
    if os.path.isdir(PROYECTOS):
        for n in os.listdir(PROYECTOS):
            if not n.endswith(".meta.json"):
                continue
            pid = n[:-len(".meta.json")]
            try:
                meta = json.load(open(os.path.join(PROYECTOS, n), encoding="utf-8"))
            except (OSError, ValueError):
                continue
            if not os.path.isfile(os.path.join(PROYECTOS, pid + ".json")):
                continue
            meta["id"] = pid
            meta["miniatura"] = f"proyectos/{pid}.jpg" if os.path.isfile(os.path.join(PROYECTOS, pid + ".jpg")) else None
            out.append(meta)
    return sorted(out, key=lambda m: m.get("modificado", 0), reverse=True)


# ───────────── puente de agentes: cola de comandos entre la terminal (POST /api/agente) y la página ─────────────
class Puente:
    def __init__(self):
        self.cv = threading.Condition()
        self.cola = []              # pedidos pendientes [{id, cmd, args}]
        self.resultados = {}        # id → respuesta de la página
        self.entregados = {}        # id → (pedido, hora): entregados a una página que aún no confirma recibo
        self.ultimo_contacto = 0.0
        self.ultima_dedicada = 0.0   # ventana abierta por herramientas/agente.py --ventana (tiene prioridad)

    def pedir(self, cmd, args, espera):
        pid = uuid.uuid4().hex[:12]
        with self.cv:
            self.cola.append({"id": pid, "cmd": cmd, "args": args})
            self.cv.notify_all()
            fin = time.time() + espera
            while pid not in self.resultados:
                resto = fin - time.time()
                if resto <= 0:
                    self.cola = [x for x in self.cola if x["id"] != pid]
                    self.entregados.pop(pid, None)
                    return {"ok": False, "error": "tiempo agotado: ¿está abierta la página del animador? (GET /api/agente/estado)"}
                # entregado a una página que no confirmó en 3 s (p. ej. la espera de una página que se recargó): reencolar
                e = self.entregados.get(pid)
                if e and time.time() - e[1] > 3:
                    del self.entregados[pid]
                    self.cola.insert(0, e[0])
                    self.cv.notify_all()
                self.cv.wait(min(resto, 1))
            return self.resultados.pop(pid)

    def siguiente(self, espera=20, dedicada=False):
        with self.cv:
            self.ultimo_contacto = time.time()
            if dedicada:
                self.ultima_dedicada = time.time()
            fin = time.time() + espera
            # con una ventana dedicada viva, las demás páginas (la del humano) no toman comandos
            while not self.cola or (not dedicada and time.time() - self.ultima_dedicada < 30):
                resto = fin - time.time()
                if resto <= 0:
                    return {}
                self.cv.wait(resto)
            self.ultimo_contacto = time.time()
            pedido = self.cola.pop(0)
            self.entregados[pedido["id"]] = (pedido, time.time())
            return pedido

    def recibido(self, pid):
        with self.cv:
            self.entregados.pop(pid, None)

    def resultado(self, datos):
        with self.cv:
            self.resultados[datos.get("id")] = datos
            self.ultimo_contacto = time.time()
            self.cv.notify_all()


PUENTE = Puente()


class Manejador(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, *args):
        pass

    def responder(self, datos: dict, estado: int = 200):
        cuerpo = json.dumps(datos, ensure_ascii=False).encode("utf-8")
        self.send_response(estado)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(cuerpo)))
        self.end_headers()
        self.wfile.write(cuerpo)

    def leer(self) -> bytes:
        return self.rfile.read(int(self.headers.get("Content-Length", 0)))

    def agente_ok(self) -> bool:
        # encabezado propio: un sitio web cualquiera no puede mandarlo sin permiso CORS, así que no puede mandar comandos
        if self.headers.get("X-Agente") != "1":
            self.responder({"ok": False, "error": "falta el encabezado X-Agente: 1"}, 403)
            return False
        return True

    def do_GET(self):
        if self.path.startswith("/api/proyectos"):
            if not self.agente_ok():
                return
            return self.responder({"ok": True, "proyectos": listar_proyectos()})
        if self.path.startswith("/api/agente/"):
            if not self.agente_ok():
                return
            if self.path.startswith("/api/agente/siguiente"):
                return self.responder(PUENTE.siguiente(dedicada="dedicada=1" in self.path))
            if self.path.startswith("/api/agente/estado"):
                hace = time.time() - PUENTE.ultimo_contacto
                return self.responder({"ok": True, "pagina_conectada": hace < 30, "hace_s": round(hace, 1), "pendientes": len(PUENTE.cola),
                                       "ventana_dedicada": time.time() - PUENTE.ultima_dedicada < 30,
                                       "dedicada_hace_s": round(time.time() - PUENTE.ultima_dedicada, 1)})
            return self.send_error(404)
        if self.path.startswith("/api/tiktok/"):
            return self.tiktok_get()
        if self.path.startswith("/api/voces"):
            cache = os.path.join(CARPETA, "audio", "voces.json")
            if os.path.isfile(cache):
                return self.responder(json.load(open(cache, encoding="utf-8")))
            r = eleven("voces")
            if r.get("ok"):
                os.makedirs(os.path.dirname(cache), exist_ok=True)
                json.dump(r, open(cache, "w", encoding="utf-8"), ensure_ascii=False)
            return self.responder(r)
        return super().do_GET()

    def do_POST(self):
        url = urllib.parse.urlparse(self.path)
        if url.path == "/guardar":
            return self.guardar(url)
        if url.path.startswith("/api/tiktok/"):
            return self.tiktok_post(url.path)
        if url.path in ("/api/voz", "/api/sfx", "/api/musica"):
            return self.audio(url.path.split("/")[-1])
        if url.path.startswith("/api/proyectos/"):
            if not self.agente_ok():
                return
            return self.proyecto(url)
        if url.path.startswith("/api/agente"):
            if not self.agente_ok():
                return
            if url.path == "/api/agente/recibido":
                PUENTE.recibido(json.loads(self.leer() or b"{}").get("id"))
                return self.responder({"ok": True})
            if url.path == "/api/agente/resultado":
                PUENTE.resultado(json.loads(self.leer() or b"{}"))
                return self.responder({"ok": True})
            if url.path == "/api/agente/archivo":
                return self.archivo_agente(url)
            if url.path == "/api/agente":
                try:
                    datos = json.loads(self.leer() or b"{}")
                except json.JSONDecodeError:
                    return self.responder({"ok": False, "error": "JSON inválido"}, 400)
                if not datos.get("cmd"):
                    return self.responder({"ok": False, "error": "falta cmd"}, 400)
                espera = min(float(datos.get("espera", 900)), 3600)
                return self.responder(PUENTE.pedir(str(datos["cmd"]), datos.get("args") or {}, espera))
            return self.send_error(404)
        if url.path == "/api/texturas":
            r = subprocess.run([sys.executable, os.path.join(CARPETA, "herramientas", "texturas.py"), CARPETA],
                               capture_output=True, text=True, encoding="utf-8", timeout=120)
            lineas = [l for l in r.stdout.splitlines() if l.startswith("{")]
            return self.responder(json.loads(lineas[-1]) if lineas else {"ok": False, "error": r.stderr[-300:]})
        self.send_error(404)

    def audio(self, tipo: str):
        try:
            datos = json.loads(self.leer() or b"{}")
        except json.JSONDecodeError:
            return self.responder({"ok": False, "error": "JSON inválido"}, 400)
        texto = str(datos.get("texto", "")).strip()[:600]
        if not texto:
            return self.responder({"ok": False, "error": "falta el texto"}, 400)
        firma = json.dumps([tipo, texto, datos.get("voz"), datos.get("modelo"), datos.get("dur")], ensure_ascii=False)
        nombre = f"{tipo}_{hashlib.sha1(firma.encode()).hexdigest()[:12]}.mp3"
        ruta = os.path.join(CARPETA, "audio", nombre)
        os.makedirs(os.path.dirname(ruta), exist_ok=True)
        alin = ruta[:-4] + ".json"
        if tipo == "voz" and os.path.isfile(ruta) and not os.path.isfile(alin):
            os.remove(ruta)                                # voz vieja sin marcas de tiempo: se regenera una vez
        if not os.path.isfile(ruta):                       # caché: solo se pide a ElevenLabs si cambia el texto
            args = {"texto": texto, "voz": datos.get("voz"), "modelo": datos.get("modelo"), "dur": datos.get("dur")}
            r = eleven(tipo, json.dumps(args, ensure_ascii=False), ruta)
            if not r.get("ok"):
                return self.responder(r, 502)
        res = {"ok": True, "archivo": "audio/" + nombre}
        if os.path.isfile(alin):
            res["alineacion"] = "audio/" + nombre[:-4] + ".json"
        return self.responder(res)

    def proyecto(self, url):
        pid = id_proyecto(urllib.parse.parse_qs(url.query).get("id", [""])[0])
        if not pid:
            return self.responder({"ok": False, "error": "falta id"}, 400)
        os.makedirs(PROYECTOS, exist_ok=True)
        base = os.path.join(PROYECTOS, pid)
        accion = url.path.rsplit("/", 1)[-1]
        if accion == "guardar":
            datos = self.leer()
            try:
                proy = json.loads(datos)
            except ValueError:
                return self.responder({"ok": False, "error": "JSON inválido"}, 400)
            tmp = base + ".json.tmp"                       # atómico: si algo falla a medias, el archivo anterior sigue intacto
            with open(tmp, "wb") as f:
                f.write(datos)
            os.replace(tmp, base + ".json")
            pistas = proy.get("pistas", {})
            dur = max([sum(c.get("dur", 0) for c in pistas.get(k, [])) for k in ("poses", "escenas", "camara")] or [0])
            meta = {"nombre": proy.get("nombre") or pid, "modificado": time.time(), "duracion": round(dur, 2),
                    "tomas": len(pistas.get("escenas", [])), "formato": proy.get("ajustes", {}).get("formato")}
            json.dump(meta, open(base + ".meta.json", "w", encoding="utf-8"), ensure_ascii=False)
            return self.responder({"ok": True, "id": pid, "archivo": base + ".json"})
        if accion == "miniatura":
            with open(base + ".jpg", "wb") as f:
                f.write(self.leer())
            return self.responder({"ok": True})
        if accion == "borrar":
            papelera = os.path.join(PROYECTOS, "papelera")
            os.makedirs(papelera, exist_ok=True)
            marca = time.strftime("%Y%m%d-%H%M%S")
            for ext in (".json", ".meta.json", ".jpg"):
                if os.path.isfile(base + ext):
                    os.replace(base + ext, os.path.join(papelera, f"{pid}_{marca}{ext}"))
            return self.responder({"ok": True, "papelera": papelera})
        return self.send_error(404)

    def archivo_agente(self, url):
        nombre = urllib.parse.parse_qs(url.query).get("nombre", ["salida.png"])[0]
        nombre = re.sub(r"[^\w\-. ]", "", os.path.basename(nombre)).strip() or "salida.png"
        ext = os.path.splitext(nombre)[1].lower()
        if ext not in (".png", ".jpg", ".json"):
            return self.responder({"ok": False, "error": "tipo no permitido"}, 400)
        carpeta = os.path.join(CARPETA, "agente", "proyectos" if ext == ".json" else "salida")
        os.makedirs(carpeta, exist_ok=True)
        ruta = os.path.join(carpeta, nombre)
        with open(ruta, "wb") as f:
            f.write(self.leer())
        return self.responder({"ok": True, "archivo": ruta})

    # ───── panel de TikToks (tiktok/panel.html → tiktok/motor/panel_api.py) ─────
    def tiktok_get(self):
        url = urllib.parse.urlparse(self.path)
        if url.path != "/api/tiktok/estado":
            return self.send_error(404)
        try:
            return self.responder(panel_api().estado(urllib.parse.parse_qs(url.query).get("fecha", [None])[0]))
        except Exception as e:                          # noqa: BLE001
            return self.responder({"ok": False, "error": f"{type(e).__name__}: {e}"}, 500)

    def tiktok_post(self, ruta):
        if self.headers.get("X-Panel") != "1":         # como X-Agente: una página ajena no puede mandarlo sin CORS
            return self.responder({"ok": False, "error": "falta el encabezado X-Panel: 1"}, 403)
        try:
            d = json.loads(self.leer() or b"{}")
            api = panel_api()
            if ruta == "/api/tiktok/publicado":
                return self.responder(api.marcar_publicado(d["slug"], d.get("publicado", "")))
            if ruta == "/api/tiktok/metricas":
                return self.responder(api.guardar_metricas(d["slug"], d.get("campos", {})))
            if ruta == "/api/tiktok/idea":
                return self.responder(api.agregar_idea(d.get("texto", "")))
            if ruta == "/api/tiktok/planificar":
                return self.responder(api.planificar(d["fecha"], d.get("n"), forzar=bool(d.get("forzar"))))
            if ruta == "/api/tiktok/abrir":
                return self.responder(api.abrir_carpeta(d["slug"], abrir=d.get("abrir", True) is not False))
            return self.send_error(404)
        except Exception as e:                          # noqa: BLE001
            return self.responder({"ok": False, "error": f"{type(e).__name__}: {e}"}, 500)

    def guardar(self, url):
        nombre = urllib.parse.parse_qs(url.query).get("nombre", ["video.mp4"])[0]
        nombre = re.sub(r"[^\w\-. áéíóúñÁÉÍÓÚÑ()]", "", os.path.basename(nombre)).strip() or "video.mp4"
        if not re.search(r"\.(mp4|webm|png)$", nombre, re.I):
            self.send_error(400, "tipo no permitido")
            return
        destino = urllib.parse.parse_qs(url.query).get("carpeta", [""])[0]
        carpeta = os.path.join(CARPETA, "agente", "salida") if destino == "agente" else os.path.join(CARPETA, "Videos")
        os.makedirs(carpeta, exist_ok=True)
        ruta = os.path.join(carpeta, nombre)
        largo = int(self.headers.get("Content-Length", 0))
        with open(ruta, "wb") as f:
            while largo > 0:
                bloque = self.rfile.read(min(largo, 1 << 20))
                if not bloque:
                    break
                f.write(bloque)
                largo -= len(bloque)
        cuerpo = ruta.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(cuerpo)))
        self.end_headers()
        self.wfile.write(cuerpo)


if __name__ == "__main__":
    manejador = functools.partial(Manejador, directory=CARPETA)
    # en Windows SO_REUSEADDR deja que dos servidores escuchen el MISMO puerto (respondía uno al azar): mejor fallar claro
    http.server.ThreadingHTTPServer.allow_reuse_address = os.name != "nt"
    with http.server.ThreadingHTTPServer(("127.0.0.1", PUERTO), manejador) as srv:
        print(f"Minecraft Animator en http://127.0.0.1:{PUERTO}/")
        srv.serve_forever()
