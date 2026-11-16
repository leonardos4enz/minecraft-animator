// Biblioteca de recursos (interfaz): todos los mobs y objetos de Minecraft con buscador, categorías y miniaturas.
//   - Mobs: clic = se agrega a la toma que está bajo el cabezal, al lado de LTezla (luego se ajusta en el inspector).
//   - Objetos: clic = LTezla lo tiene en la mano en esa toma (o el mob elegido, si se abrió desde su fila).
// Las miniaturas de los mobs se dibujan aquí con el mismo modelo que el video (Fresh Animations / Bedrock), una por una
// con un renderer chico aparte; las de los objetos son su textura. El catálogo sale de texturas_mc/biblioteca/indice.json
// (herramientas/biblioteca.py).
import * as THREE from "three";
import { Mobs, CATALOGO, cargarBiblioteca, leerVariante } from "./mobs.js";
import { cargarObjetos, listaObjetos, objetoInfo } from "./objetos.js";

const CATS_MOB = { todos: "Todos", animal: "Animales", mascota: "Mascotas", aldeano: "Aldeanos", monstruo: "Monstruos", acuatico: "Acuáticos", golem: "Gólems", jefe: "Jefes" };
const CATS_OBJ = { todos: "Todos", arma: "Armas", herramienta: "Herramientas", armadura: "Armadura", comida: "Comida", bloque: "Bloques", objeto: "Otros" };
const FUENTE = { fresh: "Fresh Animations", bedrock: "Bedrock", propio: "Del tráiler" };
const MAX_CELDAS = 240;
const sinAcentos = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// ── miniaturas de mobs: escena chica con su propia luz y un Mobs aparte (mismo código que el video)
let mini = null;
const miniaturas = new Map();
let cola = Promise.resolve();
function prepararMini() {
  if (mini) return mini;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setSize(160, 160, false); renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8a8a, 2.2));
  const sol = new THREE.DirectionalLight(0xffffff, 2.2); sol.position.set(3, 6, 5); scene.add(sol);
  const camara = new THREE.PerspectiveCamera(28, 1, 0.05, 400);
  mini = { renderer, scene, camara, mobs: new Mobs(scene) };
  return mini;
}
export function miniaturaMob(tipo, variante) {
  const clave = tipo + (variante ? "~" + variante : "");
  if (miniaturas.has(clave)) return miniaturas.get(clave);
  const p = (cola = cola.then(async () => {
    const { renderer, scene, camara, mobs } = prepararMini();
    const g = { tipo, n: 1, fijo: true, modo: "quieto", calmo: true, dir: 0, semilla: 3, ...(variante ? { variante } : {}) };
    await mobs.precargar([{ mobs: [g] }]);
    mobs.actualizar([g], 1.2, { x: 0, y: 0, z: 0 }, null, 3);
    const caja = new THREE.Box3();
    for (const l of Object.values(mobs.pool)) for (const m of l) if (m.raiz.visible) caja.expandByObject(m.raiz);
    if (caja.isEmpty()) return null;
    const c = caja.getCenter(new THREE.Vector3()), t = caja.getSize(new THREE.Vector3());
    const r = Math.max(t.x, t.y, t.z) * 0.62, d = r / Math.tan(THREE.MathUtils.degToRad(14)) * 1.05;
    const az = THREE.MathUtils.degToRad(32), el = THREE.MathUtils.degToRad(14);
    camara.position.set(c.x + Math.sin(az) * Math.cos(el) * d, c.y + Math.sin(el) * d, c.z + Math.cos(az) * Math.cos(el) * d);
    camara.lookAt(c);
    renderer.render(scene, camara);
    return renderer.domElement.toDataURL("image/png");
  }).catch(() => null));
  miniaturas.set(clave, p);
  return p;
}

export function instalarRecursos(app, I) {
  const { h, toast, tomaEn } = I;
  const $ = (s) => document.querySelector(s);
  const dlg = $("#m-recursos");
  let estado = { tab: "mobs", cat: "todos", destino: null };

  // toma bajo el cabezal (donde se agrega lo que se elija)
  const tomaActual = () => tomaEn(app.proy, app.t);
  const nombreMob = (id) => CATALOGO.porId[id]?.nombre || id;

  function agregarMob(tipo, clip) {
    const T = clip ? { clip } : tomaActual();
    if (!T) { toast("Primero agrega una toma en la pista Escenarios (+ Escenario)"); return false; }
    const lista = (T.clip.mobs ??= []);
    const k = lista.length;
    lista.push({ tipo, n: 1, fijo: true, modo: "quieto", x: +(1.6 + 1.3 * (k % 4)).toFixed(2), z: +(0.6 + 1.4 * Math.floor(k / 4)).toFixed(2), dir: 0, semilla: (k + 1) * 17 });
    app.commit();
    I.escena.mobs.precargar(app.proy.pistas.escenas);
    toast(`${nombreMob(tipo)} agregado a la toma`);
    return true;
  }
  function darObjeto(id, destino) {
    const T = destino?.clip ? { clip: destino.clip } : tomaActual();
    if (!T) { toast("Primero agrega una toma en la pista Escenarios (+ Escenario)"); return false; }
    const quien = destino?.mob ?? T.clip;
    if (id) quien.objeto = id; else delete quien.objeto;
    app.commit();
    toast(id ? `${objetoInfo(id)?.nombre || id} en la mano` + (destino?.mob ? ` de ${nombreMob(destino.mob.tipo)}` : " de LTezla") : "Mano vacía");
    return true;
  }

  async function abrir(tab = "mobs", destino = null) {
    estado = { tab, cat: "todos", destino };
    $("#rec-buscar").value = "";
    await Promise.all([cargarBiblioteca(), cargarObjetos()]);
    pintar();
    if (!dlg.open) dlg.showModal();
    $("#rec-buscar").focus();
  }

  function pintar() {
    const q = sinAcentos($("#rec-buscar").value.trim());
    const tabs = $("#rec-tabs"), cats = $("#rec-cats"), rej = $("#rec-rejilla");
    tabs.innerHTML = ""; cats.innerHTML = ""; rej.innerHTML = "";
    const mobs = CATALOGO.mobs, objs = listaObjetos();
    for (const [k, t, n] of [["mobs", "Mobs", mobs.length], ["objetos", "Objetos", objs.length]])
      tabs.append(h("button", { class: k === estado.tab ? "activo" : "", onclick: () => { estado.tab = k; estado.cat = "todos"; pintar(); } }, `${t} · ${n}`));
    const CATS = estado.tab === "mobs" ? CATS_MOB : CATS_OBJ;
    for (const [k, t] of Object.entries(CATS)) cats.append(h("button", { class: k === estado.cat ? "activo" : "", onclick: () => { estado.cat = k; pintar(); } }, t));
    const pasa = (e) => (estado.cat === "todos" || e.cat === estado.cat) && (!q || [e.id, e.nombre, e.nombre_en, e.java].some(x => x && sinAcentos(x).includes(q)));
    const T = estado.destino?.clip ? null : tomaActual();
    const dest = $("#rec-destino");
    if (estado.tab === "mobs") {
      dest.innerHTML = T || estado.destino ? `Clic en un mob para agregarlo a la <b>toma ${T ? T.i + 1 : ""}</b> junto a LTezla. Luego cambia en el inspector si camina, corre o se queda quieto.`
        : "Mueve el cabezal a una toma (pista Escenarios) para agregarle mobs.";
      for (const e of mobs.filter(pasa)) {
        const img = h("img", { alt: "" });
        const celda = h("div", { class: "celda", title: `${e.nombre} (${e.java || e.id}) · ${FUENTE[e.fuente] || ""}` + (e.nota ? ` · ${e.nota}` : ""), onclick: () => { if (agregarMob(e.id, estado.destino?.clip)) dlg.close(); } },
          img, h("b", {}, e.nombre), h("small", {}, `${FUENTE[e.fuente] || ""} · ${e.tam ? e.tam[1].toFixed(1) + " bloques" : ""}` + (e.nota ? " · aproximado" : "")));
        rej.append(celda);
        observar(celda, () => miniaturaMob(e.id).then(src => { if (src) img.src = src; }));
      }
    } else {
      const quien = estado.destino?.mob ? nombreMob(estado.destino.mob.tipo) : "LTezla";
      dest.innerHTML = T || estado.destino ? `Clic en un objeto para ponerlo en la mano de <b>${quien}</b>` + (T ? ` en la toma ${T.i + 1}.` : ".")
        : "Mueve el cabezal a una toma (pista Escenarios) para dar objetos.";
      const lista = objs.filter(pasa);
      if (estado.destino || T) rej.append(h("div", { class: "celda", onclick: () => { if (darObjeto(null, estado.destino)) dlg.close(); } },
        h("div", { class: "rec-vacio", html: '<svg class="ic"><use href="#i-hand"/></svg>' }), h("b", {}, "Mano vacía"), h("small", {}, "quitar objeto")));
      for (const o of lista.slice(0, MAX_CELDAS))
        rej.append(h("div", { class: "celda", title: `${o.nombre} (${o.id})`, onclick: () => { if (darObjeto(o.id, estado.destino)) dlg.close(); } },
          h("img", { src: o.tex, alt: "", loading: "lazy" }), h("b", {}, o.nombre), h("small", {}, CATS_OBJ[o.cat] || o.cat)));
      if (lista.length > MAX_CELDAS) rej.append(h("p", { class: "nota rec-mas" }, `Mostrando ${MAX_CELDAS} de ${lista.length}: escribe en el buscador para encontrar el resto.`));
    }
    if (!mobs.length && !objs.length) rej.append(h("p", { class: "nota rec-mas" }, "Falta el índice de la biblioteca: corre ", h("b", {}, "python herramientas/biblioteca.py"), " (copia de tu Minecraft, Bare Bones y Fresh Animations)."));
    else if (!rej.children.length) rej.append(h("p", { class: "nota rec-mas" }, "No hay nada con ese nombre."));
  }
  // dibuja la miniatura cuando la celda se ve (las de los mobs cuestan: se hacen de a una)
  const io = new IntersectionObserver((es) => { for (const e of es) if (e.isIntersecting) { io.unobserve(e.target); e.target._ver?.(); } }, { root: $("#rec-rejilla") });
  function observar(el, fn) { el._ver = fn; io.observe(el); }

  $("#rec-buscar").oninput = pintar;
  $("#b-recursos").onclick = () => abrir("mobs");
  $("#b-recursos-obj").onclick = () => abrir("objetos");

  // variante (color, raza, bioma…) y, si el mob tiene, un extra encima (profesión del aldeano zombi, marcas del caballo)
  function selectorVariante(g) {
    const e = CATALOGO.porId[g.tipo];
    if (!e?.variantes?.length) return [];
    const { variante } = leerVariante(g.tipo, g.variante);
    const [vSel, ...xSel] = (variante || "").split("+");
    const esVar = e.variantes.some(v => v.id === vSel);
    const actual = esVar ? vSel : e.variantes[0].id, extra = (esVar ? xSel : [vSel, ...xSel]).filter(Boolean)[0] || "";
    const opcion = (k, t, sel) => { const o = h("option", { value: k }, t); if (sel) o.selected = true; return o; };
    const guardar = () => {
      const v = [sv.value, sx?.value].filter(Boolean).join("+");
      if (v === e.variantes[0].id) delete g.variante; else g.variante = v;      // la primera = sin variante (como antes)
      app.commit();
    };
    const sv = h("select", { title: "Variante", onchange: guardar }, ...e.variantes.map(v => opcion(v.id, v.nombre, v.id === actual)));
    const sx = e.extras?.length ? h("select", { title: g.tipo === "caballo" ? "Marcas" : "Profesión", onchange: guardar },
      opcion("", g.tipo === "caballo" ? "Sin marcas" : "Sin profesión", !extra), ...e.extras.map(x => opcion(x.id, x.nombre, x.id === extra))) : null;
    return [h("div", { class: "rec-ctrl rec-var" }, sv, ...(sx ? [sx] : []))];
  }

  // ── inspector de la toma: sus mobs (qué hacen, cuántos, qué tienen en la mano) y el objeto de LTezla
  function panelToma(clip) {
    const caja = h("div", { class: "rec-panel" });
    caja.append(h("h4", {}, "Mobs de la toma"));
    const MODOS = { quieto: "Quieto", caminar: "Camina", correr: "Corre", flotar: "Flota" };
    (clip.mobs || []).forEach((g, j) => {
      const img = h("img", { alt: "" });
      miniaturaMob(g.tipo, g.variante).then(src => { if (src) img.src = src; });
      const modo = h("select", { title: "Qué hace", onchange: () => { g.modo = modo.value; if (g.modo !== "quieto" && g.dir == null) g.dir = 90; app.commit(); } },
        ...Object.entries({ ...MODOS, ...(MODOS[g.modo || "caminar"] ? {} : { [g.modo]: g.modo[0].toUpperCase() + g.modo.slice(1) }) })
          .map(([k, v]) => { const o = h("option", { value: k }, v); if ((g.modo || "caminar") === k) o.selected = true; return o; }));
      const n = h("input", { type: "number", min: 1, max: 30, value: g.n ?? 1, title: "Cuántos", onchange: () => { g.n = Math.max(1, Math.min(30, Number(n.value) || 1)); if (g.n > 1) { delete g.fijo; g.ancho ??= 3; g.prof ??= 2; } app.commit(); } });
      const obj = g.objeto ? objetoInfo(g.objeto)?.nombre || g.objeto : "Mano vacía";
      caja.append(h("div", { class: "rec-fila" }, img,
        h("div", { class: "rec-info" }, h("b", { title: nombreMob(g.tipo) }, nombreMob(g.tipo)), h("small", { title: obj }, `en (${(g.x ?? 0).toFixed(1)}, ${(g.z ?? 0).toFixed(1)}) · ${obj}`)),
        h("div", { class: "rec-acc" },
          h("button", { class: "btn icono chico", title: "Objeto en la mano", "aria-label": "Objeto en la mano", html: '<svg class="ic"><use href="#i-hand"/></svg>', onclick: () => abrir("objetos", { clip, mob: g }) }),
          h("button", { class: "btn icono chico", title: "Quitar de la toma", "aria-label": "Quitar", html: '<svg class="ic"><use href="#i-trash"/></svg>', onclick: () => { clip.mobs.splice(j, 1); app.commit(); } })),
        h("div", { class: "rec-ctrl" }, modo, h("span", {}, "×"), n),
        ...selectorVariante(g)));
    });
    if (!clip.mobs?.length) caja.append(h("p", { class: "nota" }, "Sin mobs. Agrega cualquiera de Minecraft desde la biblioteca."));
    const objL = clip.objeto ? objetoInfo(clip.objeto)?.nombre || clip.objeto : "nada";
    caja.append(h("div", { class: "acciones-clip" },
      h("button", { class: "btn chico", html: '<svg class="ic"><use href="#i-plus"/></svg>Agregar mob', onclick: () => abrir("mobs", { clip }) }),
      h("button", { class: "btn chico", title: `LTezla tiene en la mano: ${objL}`, html: '<svg class="ic"><use href="#i-hand"/></svg>Mano de LTezla', onclick: () => abrir("objetos", { clip }) })));
    caja.append(h("p", { class: "nota" }, "LTezla tiene en la mano: ", h("b", {}, objL)));
    return caja;
  }
  return { abrir, panelToma, agregarMob, darObjeto };
}
