// Proyectos: cada video es un archivo en proyectos/<id>.json (en tu PC, junto al programa). El proyecto abierto se
// autoguarda solo (poco después de cada cambio) y también queda en el navegador como respaldo. "Nuevo", las plantillas
// grandes (tráiler, vlog) y "Abrir archivo" crean un proyecto nuevo: el anterior nunca se pisa.
const CAB = { "X-Agente": "1" };
const ACTUAL = "mcanimator.proyectoActual";

const slug = (t) => (t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "proyecto";
const fecha = (s) => {
  const d = (Date.now() / 1000 - s) / 60;
  if (d < 1) return "hace un momento";
  if (d < 60) return `hace ${Math.round(d)} min`;
  if (d < 60 * 24) return `hace ${Math.round(d / 60)} h`;
  return new Date(s * 1000).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
};

export function instalarProyectos(app, I) {
  // I: { migrar, reconstruir, sincronizarPaneles, toast, proyectoNuevo, catalogo, guardarEnCatalogo, aplicarPlantilla, PLANTILLAS, escena, duracion, clipPose, clipOjos }
  let id = null, temporizador = null, guardando = Promise.resolve(), ultimaMini = 0;
  const leerActual = () => { try { return localStorage.getItem(ACTUAL); } catch { return null; } };
  const ponerActual = (v) => { id = v; try { localStorage.setItem(ACTUAL, v); } catch { /* modo privado */ } };

  async function lista() {
    const r = await fetch("/api/proyectos", { headers: CAB, cache: "no-store" });
    if (!r.ok) throw new Error("el servidor no tiene proyectos (¿versión vieja? reinícialo)");
    return (await r.json()).proyectos;
  }
  async function idNuevo(nombre) {
    const usados = new Set((await lista().catch(() => [])).map(p => p.id));
    const base = slug(nombre);
    let n = 1, cand = base;
    while (usados.has(cand)) cand = `${base}-${++n}`;
    return cand;
  }
  async function escribir(pid, proy) {
    const r = await fetch("/api/proyectos/guardar?id=" + encodeURIComponent(pid), { method: "POST", headers: CAB, body: JSON.stringify(proy) });
    if (!r.ok) throw new Error("no se pudo guardar el proyecto");
    return r.json();
  }
  // guarda el proyecto abierto (en serie: nunca dos escrituras a la vez)
  function guardarAhora() {
    if (!id || !app.proy || app.exportando) return guardando;
    const pid = id, s = structuredClone(app.proy);
    guardando = guardando.then(() => escribir(pid, s)).then(() => marcar("Guardado")).catch(e => { marcar("Sin guardar"); console.warn(e); });
    return guardando;
  }
  const programar = () => { clearTimeout(temporizador); marcar("Guardando…"); temporizador = setTimeout(guardarAhora, 1200); };
  function marcar(txt) { const e = document.getElementById("estado-proy"); if (e) e.textContent = txt; }

  async function miniatura(pid = id) {
    if (!pid || pid !== id || app.exportando || !app.proy) return;      // la foto tiene que ser del proyecto abierto
    try {
      const t = app.t > 0.2 ? app.t : Math.min(I.duracion(app.proy) * 0.3, 8);
      const url = await app.foto(t, 0.22), b = Uint8Array.from(atob(url.split(",")[1]), c => c.charCodeAt(0));
      await fetch("/api/proyectos/miniatura?id=" + encodeURIComponent(pid), { method: "POST", headers: CAB, body: b });
      ultimaMini = Date.now();
    } catch (e) { console.warn("miniatura", e); }
  }

  async function cargar(proy, pid) {
    app.proy = I.migrar(proy); app.sel = null; app.t = 0;
    if (!I.catalogo()[app.proy.personaje.id]) I.guardarEnCatalogo(app.proy.personaje);
    ponerActual(pid);
    I.sincronizarPaneles(); await I.reconstruir();
    app.historia = [JSON.stringify(app.proy)]; app.futuro = [];
    await I.escena.mobs.precargar(app.proy.pistas.escenas || []);
    app.commit();
  }

  const P = {
    get id() { return id; },
    lista,
    guardarAhora,
    // abre un proyecto guardado (antes guarda el actual y su miniatura)
    async abrir(pid) {
      if (pid === id) return { id };
      await guardarAhora(); await miniatura();
      const r = await fetch("proyectos/" + encodeURIComponent(pid) + ".json", { cache: "no-store" });
      if (!r.ok) throw new Error("no existe el proyecto " + pid);
      await cargar(await r.json(), pid);
      I.toast(`Proyecto "${app.proy.nombre}" abierto`);
      return { id, nombre: app.proy.nombre };
    },
    // proyecto nuevo: vacío, con una plantilla, o desde un objeto de proyecto (archivo importado)
    async crear({ nombre, plantilla, proyecto } = {}) {
      await guardarAhora(); await miniatura();
      const pl = typeof plantilla === "string" ? I.PLANTILLAS[plantilla] : plantilla;
      if (plantilla && !pl) throw new Error("plantilla desconocida: " + plantilla);
      nombre ||= proyecto?.nombre || pl?.nombre || "Proyecto nuevo";
      const pid = await idNuevo(nombre);
      let p;
      if (proyecto) p = structuredClone(proyecto);
      else {
        p = I.proyectoNuevo(app.proy?.personaje);
        p.pistas = { poses: [I.clipPose("reposo", 2)], ojos: [I.clipOjos("neutral", 2)], matices: [], camara: [], audio: [], escenas: [], textos: [] };
      }
      p.nombre = nombre;
      await cargar(p, pid);
      if (pl) { I.aplicarPlantilla(pl); app.proy.nombre = nombre; I.sincronizarPaneles(); }
      await guardarAhora();
      setTimeout(() => miniatura(pid), 1500);
      I.toast(`Proyecto nuevo: "${nombre}"`);
      return { id: pid, nombre };
    },
    // carga un proyecto (objeto) en SU PROPIO archivo proyectos/<pid>.json y lo deja abierto. Lo usa el comando del agente
    // `abrir`: así un video armado por script nunca se autoguarda encima del proyecto que la página tenía abierto
    async cargarComo(pid, proyecto) {
      pid = slug(pid);
      if (pid !== id) { await guardarAhora(); await miniatura(); }
      await cargar(structuredClone(proyecto), pid);
      await guardarAhora();
      setTimeout(() => miniatura(pid), 1500);
      return { id: pid, nombre: app.proy.nombre };
    },
    async duplicar(pid = id, nombre) {
      await guardarAhora();
      const r = await fetch("proyectos/" + encodeURIComponent(pid) + ".json", { cache: "no-store" });
      if (!r.ok) throw new Error("no existe el proyecto " + pid);
      const p = await r.json(); p.nombre = nombre || (p.nombre + " (copia)");
      const nuevo = await idNuevo(p.nombre);
      await escribir(nuevo, p);
      const mini = await fetch(`proyectos/${pid}.jpg`, { cache: "no-store" });
      if (mini.ok) await fetch("/api/proyectos/miniatura?id=" + nuevo, { method: "POST", headers: CAB, body: await mini.arrayBuffer() });
      return { id: nuevo, nombre: p.nombre };
    },
    async renombrar(pid = id, nombre) {
      if (!nombre) throw new Error("falta el nombre");
      if (pid === id) { app.proy.nombre = nombre; I.sincronizarPaneles(); app.commit(); await guardarAhora(); return { id, nombre }; }
      const r = await fetch("proyectos/" + encodeURIComponent(pid) + ".json", { cache: "no-store" });
      if (!r.ok) throw new Error("no existe el proyecto " + pid);
      const p = await r.json(); p.nombre = nombre; await escribir(pid, p);
      return { id: pid, nombre };
    },
    // a la papelera (proyectos/papelera/): no se borra nada de verdad
    async borrar(pid) {
      if (pid === id) throw new Error("es el proyecto abierto: abre otro antes de mandarlo a la papelera");
      const r = await fetch("/api/proyectos/borrar?id=" + encodeURIComponent(pid), { method: "POST", headers: CAB });
      if (!r.ok) throw new Error("no se pudo mover a la papelera");
      return { ok: true, papelera: "proyectos/papelera/" };
    },
    miniatura,
    // al arrancar: el proyecto del navegador es el del id actual; si no hay id (primera vez), se le asigna uno
    async alIniciar() {
      try {
        const pid = leerActual();
        if (pid) { ponerActual(pid); await guardarAhora(); }
        else { ponerActual(await idNuevo(app.proy.nombre || "Mi animación")); await guardarAhora(); setTimeout(() => miniatura(), 3000); }
      } catch (e) { console.warn("proyectos", e); }
      if (!new URLSearchParams(location.search).has("agente")) P.mostrarHub();      // lobby antes de entrar al editor
    },
    alCambiar: programar,
  };

  // ───────────── panel "Mis proyectos" ─────────────
  const dlg = document.getElementById("m-proyectos"), rej = document.getElementById("proyectos-rejilla");
  async function pintar() {
    rej.innerHTML = '<p class="nota pad">Cargando…</p>';
    let ls;
    try { ls = await lista(); } catch (e) { rej.innerHTML = `<p class="nota pad">${e.message}</p>`; return; }
    rej.innerHTML = "";
    for (const p of ls) {
      const c = document.createElement("div");
      c.className = "proy-tarjeta" + (p.id === id ? " actual" : "");
      const img = p.miniatura ? `<img src="${p.miniatura}?v=${Math.round(p.modificado)}" alt="">` : '<div class="proy-vacio"><svg class="ic"><use href="#i-clapper"/></svg></div>';
      c.innerHTML = `${img}<div class="proy-info"><b></b><small>${fecha(p.modificado)} · ${p.duracion} s${p.tomas ? ` · ${p.tomas} tomas` : ""}${p.id === id ? " · <em>abierto</em>" : ""}</small></div>
        <div class="proy-botones"><button class="btn chico primario" data-a="abrir">Abrir</button><button class="btn chico" data-a="duplicar"><svg class="ic"><use href="#i-copy"/></svg>Duplicar</button><button class="btn chico icono" data-a="renombrar" title="Renombrar" aria-label="Renombrar"><svg class="ic"><use href="#i-pencil"/></svg></button><button class="btn chico icono peligro" data-a="borrar" title="Mover a la papelera (proyectos/papelera)" aria-label="Mover a la papelera"><svg class="ic"><use href="#i-trash"/></svg></button></div>`;
      c.querySelector("b").textContent = p.nombre;
      c.querySelector('[data-a="abrir"]').disabled = p.id === id;
      c.querySelector('[data-a="borrar"]').disabled = p.id === id;
      c.onclick = async (e) => {
        const a = e.target.closest("button")?.dataset.a; if (!a) return;
        try {
          if (a === "abrir") { await P.abrir(p.id); dlg.close(); return; }
          if (a === "duplicar") await P.duplicar(p.id);
          if (a === "renombrar") { const n = await pedirTexto({ titulo: "Renombrar proyecto", etiqueta: "Nombre", valor: p.nombre, ok: "Guardar" }); if (!n) return; await P.renombrar(p.id, n); }
          if (a === "borrar") { if (!await confirmar({ titulo: "Mover a la papelera", texto: `"${p.nombre}" se mueve a proyectos/papelera (no se borra).`, ok: "Mover a la papelera" })) return; await P.borrar(p.id); }
          pintar();
        } catch (err) { I.toast(err.message); }
      };
      rej.appendChild(c);
    }
  }
  document.getElementById("b-proyectos").onclick = async () => {
    dlg.showModal(); await guardarAhora();
    if (Date.now() - ultimaMini > 20000) await miniatura();
    pintar();
  };
  document.getElementById("b-proy-nuevo").onclick = async () => { if (await P.nuevoConNombre()) dlg.close(); };

  // ───────────── diálogos propios (en lugar de prompt/confirm del navegador) ─────────────
  const dt = document.getElementById("m-texto"), dtValor = document.getElementById("mt-valor");
  function pedirTexto({ titulo, etiqueta = "Nombre", valor = "", ok = "Aceptar", nota = "" }) {
    return new Promise((res) => {
      document.getElementById("mt-titulo").textContent = titulo;
      document.getElementById("mt-etiqueta").textContent = etiqueta;
      document.getElementById("mt-nota").textContent = nota;
      document.getElementById("mt-ok").textContent = ok;
      dtValor.hidden = false; dtValor.value = valor; dtValor.required = true;
      dt.returnValue = "";
      dt.onclose = () => res(dt.returnValue === "ok" && dtValor.value.trim() ? dtValor.value.trim() : null);
      dt.showModal(); dtValor.select();
    });
  }
  function confirmar({ titulo, texto, ok = "Aceptar" }) {
    return new Promise((res) => {
      document.getElementById("mt-titulo").textContent = titulo;
      document.getElementById("mt-etiqueta").textContent = "";
      document.getElementById("mt-nota").textContent = texto;
      document.getElementById("mt-ok").textContent = ok;
      dtValor.hidden = true; dtValor.required = false;
      dt.returnValue = "";
      dt.onclose = () => res(dt.returnValue === "ok");
      dt.showModal();
    });
  }
  P.pedirTexto = pedirTexto; P.confirmar = confirmar;
  // "Nuevo proyecto" desde cualquier lado: pide el nombre y lo crea (devuelve true si se creó)
  P.nuevoConNombre = async (plantilla) => {
    const pl = typeof plantilla === "string" ? I.PLANTILLAS[plantilla] : plantilla;
    const n = await pedirTexto({ titulo: pl ? `Nuevo proyecto: ${pl.nombre}` : "Nuevo proyecto", etiqueta: "Nombre del video", valor: pl ? pl.nombre : "Proyecto nuevo", ok: "Crear proyecto",
      nota: "El proyecto actual queda guardado." });
    if (!n) return false;
    try { await P.crear({ nombre: n, plantilla: pl }); P.ocultarHub(); return true; } catch (e) { I.toast(e.message); return false; }
  };

  // ───────────── hub de inicio (lobby) ─────────────
  const hub = document.getElementById("hub");
  const ICONO_PLANTILLA = { trailer: "clapper", benly: "video", saludo: "hand", charla: "mic", baile: "music", susto: "sparkles", victoria: "star", triste: "smile", enojo: "waves" };
  const tarjeta = (p, grande = false) => {
    const c = document.createElement("button");
    c.className = "hub-tarjeta" + (grande ? " grande" : "");
    const img = p.miniatura ? `<img src="${p.miniatura}?v=${Math.round(p.modificado)}" alt="">` : '<div class="proy-vacio"><svg class="ic"><use href="#i-clapper"/></svg></div>';
    c.innerHTML = `<div class="hub-mini">${img}</div><div class="hub-info">${grande ? '<span class="hub-etiqueta">Continuar</span>' : ""}<b></b><small>${fecha(p.modificado)} · ${p.duracion} s${p.tomas ? ` · ${p.tomas} tomas` : ""}</small></div>${grande ? '<span class="btn primario">Abrir<svg class="ic"><use href="#i-arrow-right"/></svg></span>' : ""}`;
    c.querySelector("b").textContent = p.nombre;
    c.onclick = async () => { try { await P.abrir(p.id); P.ocultarHub(); } catch (e) { I.toast(e.message); } };
    return c;
  };
  async function pintarHub() {
    const cont = document.getElementById("hub-continuar"), rec = document.getElementById("hub-recientes"), pls = document.getElementById("hub-plantillas");
    let ls = [];
    try { ls = await lista(); } catch (e) { rec.innerHTML = `<p class="nota">${e.message}</p>`; }
    const actual = ls.find(p => p.id === id);
    cont.innerHTML = ""; if (actual) cont.append(tarjeta(actual, true));
    rec.innerHTML = "";
    const otros = ls.filter(p => p.id !== id).slice(0, 8);
    for (const p of otros) rec.append(tarjeta(p));
    if (!otros.length) rec.innerHTML = '<p class="nota hub-vacio">Aquí aparecerán tus otros videos.</p>';
    pls.innerHTML = "";
    for (const [k, pl] of Object.entries(I.PLANTILLAS)) {
      const t = document.createElement("button");
      t.className = "hub-plantilla" + (pl.proyecto ? " especial" : "");
      t.innerHTML = `<span class="hub-pl-ico"><svg class="ic"><use href="#i-${ICONO_PLANTILLA[k] || "sparkles"}"/></svg></span><span><b></b><small></small></span>`;
      t.querySelector("b").textContent = pl.nombre; t.querySelector("small").textContent = pl.desc;
      t.onclick = () => P.nuevoConNombre(pl);
      pls.append(t);
    }
  }
  P.mostrarHub = async () => {
    await guardarAhora();
    if (app.proy && Date.now() - ultimaMini > 20000) await miniatura();
    if (app.reproduciendo) document.getElementById("b-play").click();
    document.querySelectorAll("dialog[open]").forEach(d => d.close());
    hub.hidden = false; pintarHub();
  };
  P.ocultarHub = () => { hub.hidden = true; };
  document.getElementById("hub-nuevo").onclick = () => P.nuevoConNombre();
  document.getElementById("hub-importar").onclick = () => document.getElementById("f-proyecto").click();
  document.getElementById("f-proyecto").addEventListener("change", () => P.ocultarHub());
  document.getElementById("hub-todos").onclick = () => { P.ocultarHub(); document.getElementById("b-proyectos").click(); };
  document.getElementById("hub-tema").onclick = () => document.getElementById("b-tema").click();
  document.querySelector(".barra .marca").onclick = () => P.mostrarHub();
  document.querySelector(".barra .marca").title = "Inicio: todos tus proyectos";
  // (si se cierra la página antes del autoguardado, el respaldo del navegador se sube al volver a abrir: alIniciar)
  return P;
}
