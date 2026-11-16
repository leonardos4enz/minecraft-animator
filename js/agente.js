// API para agentes de IA: el programa entero se maneja con comandos JSON (la interfaz queda para que el humano mire).
//   - En la consola del navegador: await agente.ejecutar("estado")  ·  await agente.ejecutar("hoja", { toma: 3 })
//   - Desde la terminal (sin herramientas de navegador): python herramientas/agente.py estado
//     El servidor guarda los comandos en una cola (/api/agente); esta página los toma, los ejecuta y devuelve el resultado.
// Tomas, mobs y títulos se numeran desde 1, como en la documentación. Las imágenes se guardan en agente/salida/.
// Lista completa de comandos con sus argumentos: comando "ayuda" (y AGENTE.md).
import * as THREE from "three";
import { POSES, MATICES, CAMARAS } from "./poses.js";
import { EXPRESIONES } from "./rostro.js";
import { clipPose, clipPoseObj, clipOjos, clipMatiz, nuevoId } from "./plantillas.js";
import { ESCENARIOS, B, BLOQUES } from "./mundo.js";
import { AMBIENTES } from "./escena.js";
import { TIPOS_MOB, CATALOGO, cargarBiblioteca, resolverTipo, leerVariante } from "./mobs.js";
import { cargarObjetos, listaObjetos, objetoInfo } from "./objetos.js";

// umbrales de "sacudida" (ver traza): por encima se nota en pantalla
const UMBRAL_QUIETO = 1.5, UMBRAL_MOVIENDO = 12;      // oveja quieta que se tambaleaba: 4.8; con "calmo": 0.06; caminar: 1.4–6
const CAB = { "Content-Type": "application/json", "X-Agente": "1" };       // el servidor exige este encabezado

// ───────────── utilidades ─────────────
const esObj = (v) => v && typeof v === "object" && !Array.isArray(v);
// mezcla profunda: objetos se combinan, listas se reemplazan, null borra la clave
function mezclar(base, cambios) {
  for (const [k, v] of Object.entries(cambios || {})) {
    if (v === null) delete base[k];
    else if (esObj(v) && esObj(base[k])) mezclar(base[k], v);
    else base[k] = structuredClone(v);
  }
  return base;
}
const r3 = (x) => Math.round(x * 1000) / 1000;
const sinAcentos = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
// nombre de mob u objeto que manda el agente → id válido (o error con sugerencias parecidas)
async function tipoValido(t) {
  await cargarBiblioteca();
  const id = resolverTipo(t);
  if (id) return id;
  const q = sinAcentos(t), cerca = CATALOGO.mobs.filter(e => [e.id, e.nombre, e.java].some(x => x && (sinAcentos(x).includes(q) || q.includes(sinAcentos(x))))).map(e => e.id);
  error(`no conozco el mob "${t}"` + (cerca.length ? ` (¿${cerca.slice(0, 6).join(", ")}?)` : " (ver catalogo {seccion: \"mobs\"})"));
}
// variante del mob ("Siamés", "fria", "desierto+librero") → como se guarda ("siames"), o error con las opciones
function varianteValida(tipo, v) {
  const r = leerVariante(tipo, v);
  if (r.error) error(r.error);
  return r.variante;
}
async function objetoValido(t) {
  await cargarObjetos();
  const o = objetoInfo(t);
  if (o) return o.id;
  if (t === "goat_horn") return t;
  const q = sinAcentos(t), cerca = listaObjetos().filter(e => sinAcentos(e.nombre).includes(q) || e.id.includes(q)).map(e => e.id);
  error(`no conozco el objeto "${t}"` + (cerca.length ? ` (¿${cerca.slice(0, 8).join(", ")}?)` : " (ver catalogo {seccion: \"objetos\", buscar: …})"));
}
const error = (msg) => { throw new Error(msg); };

async function guardarArchivo(nombre, cuerpo) {
  const r = await fetch("/api/agente/archivo?nombre=" + encodeURIComponent(nombre), { method: "POST", headers: { "X-Agente": "1" }, body: cuerpo });
  if (!r.ok) error("no se pudo guardar " + nombre + " (" + r.status + ")");
  return (await r.json()).archivo;
}
const lienzoABlob = (c, tipo = "image/png", q) => new Promise(r => c.toBlob(r, tipo, q));

// ───────────── línea de tiempo: pistas secuenciales (un clip tras otro) y absolutas (con inicio) ─────────────
const SECUENCIALES = ["escenas", "camara", "poses", "ojos"], ABSOLUTAS = ["matices", "textos", "audio"];
const iniciosDe = (lista) => { let t = 0; return lista.map(c => { const a = t; t += c.dur; return a; }); };
const totalDe = (lista) => lista.reduce((s, c) => s + c.dur, 0);
// interpola dos vistas de cámara {az, el, dist, ty, fov, pan, tilt, roll}
const mezclaVista = (a, b, u) => Object.fromEntries(Object.keys({ ...a, ...b }).map(k => [k, typeof a[k] === "number" && typeof b[k] === "number" ? a[k] + (b[k] - a[k]) * u : a[k] ?? b[k]]));
// asegura que haya un borde de clip en t; devuelve el índice del clip que empieza en t (o lista.length si t es el final)
function partir(lista, t, pista) {
  const ini = iniciosDe(lista);
  for (let i = 0; i < lista.length; i++) {
    const a = ini[i], b = a + lista[i].dur;
    if (Math.abs(a - t) < 1e-6) return i;
    if (t > a + 1e-6 && t < b - 1e-6) {
      const c1 = lista[i], c2 = structuredClone(c1), u = (t - a) / c1.dur;
      c2.id = nuevoId(); c2.dur = b - t; c1.dur = t - a; delete c2.corte; if ("trans" in c2) c2.trans = 0;
      if (pista === "camara" && c1.desde) { const m = mezclaVista(c1.desde, c1.hasta || c1.desde, u); c1.hasta = m; c2.desde = structuredClone(m); }
      lista.splice(i + 1, 0, c2);
      return i + 1;
    }
  }
  return lista.length;
}
// la ventana [a, b] pasa a durar L (L = 0 la quita); todo lo que viene después se corre
function deformar(pistas, a, b, L) {
  const f = (t) => t <= a ? t : t >= b ? t - (b - a) + L : a + (t - a) * (b > a ? L / (b - a) : 0);
  for (const n of SECUENCIALES) {
    const lista = pistas[n]; if (!lista?.length || totalDe(lista) <= a + 1e-6) continue;
    const i0 = partir(lista, a, n), i1 = partir(lista, Math.min(b, totalDe(lista)), n);
    for (let i = i1 - 1; i >= i0; i--) { if (L <= 0) lista.splice(i, 1); else lista[i].dur *= L / (b - a); }
  }
  for (const n of ABSOLUTAS) {
    const lista = pistas[n]; if (!lista) continue;
    for (let i = lista.length - 1; i >= 0; i--) {
      const c = lista[i], s = f(c.inicio), e = f(c.inicio + c.dur);
      if (e - s < 1e-3) lista.splice(i, 1); else { c.inicio = s; c.dur = e - s; }
    }
  }
}
// reemplaza los clips de una pista secuencial dentro de [a, b] por "nuevos" (sus duraciones se escalan a b − a)
function reemplazarVentana(lista, a, b, nuevos, relleno) {
  if (totalDe(lista) < a - 1e-6) lista.push({ ...relleno(a - totalDe(lista)) });
  const i0 = partir(lista, a), i1 = partir(lista, b);
  const suma = nuevos.reduce((s, c) => s + c.dur, 0) || 1;
  for (const c of nuevos) c.dur *= (b - a) / suma;
  lista.splice(i0, i1 - i0, ...nuevos);
}

// ───────────── la API ─────────────
export function instalarAgente(app, I) {
  const { escena } = I;
  const P = () => { if (!app.proy) error("todavía no hay proyecto cargado"); return app.proy.pistas; };

  // tiempos de inicio de cada toma y qué clips de cámara / títulos le tocan
  function tomas() {
    const esc = P().escenas || [], ini = I.inicios(esc);
    let tc = 0;
    const cams = P().camara.map(c => { const r = { c, ini: tc }; tc += c.dur; return r; });
    return esc.map((clip, i) => {
      const a = ini[i], b = a + clip.dur;
      return { i: i + 1, clip, ini: a, fin: b,
        cams: cams.filter(x => x.ini >= a - 1e-6 && x.ini < b - 1e-6).map(x => x.c),
        textos: (P().textos || []).filter(x => x.inicio >= a - 1e-6 && x.inicio < b - 1e-6) };
    });
  }
  const tomaN = (n) => tomas()[Number(n) - 1] || error(`no existe la toma ${n} (hay ${tomas().length})`);
  const listo = async (mobs = false) => { if (mobs) await escena.mobs.precargar(P().escenas); app.commit(); };

  const resumenMob = (g, j) => ({ j, tipo: g.tipo, n: g.n ?? 1, x: g.x, z: g.z, ...(g.y != null ? { y: g.y } : {}), modo: g.modo || "caminar", ...(g.accion ? { accion: g.accion.tipo } : {}), ...(g.foco ? { foco: true } : {}) });
  const resumenToma = (T, detalle = false) => ({
    toma: T.i, nombre: T.clip.nombre, inicio: r3(T.ini), dur: r3(T.clip.dur), set: T.clip.set ?? null, ambiente: T.clip.ambiente ?? null,
    ...(T.clip.negro ? { negro: true } : {}), ...(T.clip.ocultar ? { personajeOculto: true } : {}),
    mobs: (T.clip.mobs || []).map((g, j) => detalle ? { j: j + 1, ...g } : resumenMob(g, j + 1)),
    titulos: T.textos.map((x, k) => detalle ? { k: k + 1, ...x, inicio: r3(x.inicio - T.ini) } : { k: k + 1, texto: x.texto, inicio: r3(x.inicio - T.ini), dur: r3(x.dur) }),
    ...(detalle ? { escena: Object.fromEntries(Object.entries(T.clip).filter(([k]) => !["mobs", "id"].includes(k))), camaras: T.cams.map((c, k) => ({ k: k + 1, ...c })) } : { camaras: T.cams.length }),
  });

  // ── medir lo que se ve en el cuadro actual (cámara y mobs ya puestos por conCuadro)
  const ray = new THREE.Raycaster(), caja = new THREE.Box3(), v = new THREE.Vector3();
  function rectPantalla(b) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, detras = 0;
    for (let k = 0; k < 8; k++) {
      v.set(k & 1 ? b.max.x : b.min.x, k & 2 ? b.max.y : b.min.y, k & 4 ? b.max.z : b.min.z).project(escena.camara);
      if (v.z > 1) detras++;
      const sx = (v.x + 1) / 2, sy = (1 - v.y) / 2;
      x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
    }
    return detras === 8 ? null : [x0, y0, x1, y1];
  }
  const area = (r) => Math.max(0, r[2] - r[0]) * Math.max(0, r[3] - r[1]);
  const inter = (a, b) => [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.min(a[2], b[2]), Math.min(a[3], b[3])];
  function medir() {
    const toma = I.tomaEn(app.proy, app.tExport ?? app.t);
    const set = toma?.clip.set ? escena.sets[toma.clip.set] : null;
    const mallas = set ? Object.values(set.mallas) : [];
    const cam = escena.camara.position;
    // títulos 3D visibles (rectángulo en pantalla)
    const titulos = [];
    for (const g of escena.titulos.escena.children) if (g.visible) { caja.setFromObject(g); const r = rectPantalla(caja); if (r) titulos.push(r); }
    const mobs = [];
    for (const lista of Object.values(escena.mobs.pool)) for (const m of lista) {
      const sp = m.raiz.userData.spec;
      if (!m.raiz.visible || !sp) continue;
      caja.setFromObject(m.raiz);
      const r = rectPantalla(caja), a = r ? area(r) : 0;
      const enCuadro = r && a > 0 ? area(inter(r, [0, 0, 1, 1])) / a : 0;
      // oclusión: 9 rayos de la cámara a puntos del mob; tapado = fracción que choca antes con un bloque del escenario
      let tapados = 0, n = 0;
      if (enCuadro > 0 && mallas.length) {
        const c = caja.getCenter(new THREE.Vector3()), s = caja.getSize(new THREE.Vector3());
        for (const fx of [-0.3, 0, 0.3]) for (const fy of [-0.3, 0, 0.3]) {
          const p = new THREE.Vector3(c.x + fx * s.x, c.y + fy * s.y, c.z), d = p.distanceTo(cam);
          ray.set(cam, p.clone().sub(cam).normalize()); ray.far = d - 0.05;
          if (ray.intersectObjects(mallas, false).length) tapados++;
          n++;
        }
      }
      const bajoTitulo = r && a > 0 ? Math.min(1, titulos.reduce((s2, tr) => s2 + area(inter(r, tr)), 0) / a) : 0;
      mobs.push({ toma: toma ? toma.i + 1 : null, j: sp.grupo + 1, k: sp.k + 1, tipo: m.tipo, pantalla: r ? r.map(r3) : null, tam: r3(r ? r[3] - r[1] : 0),
        enCuadro: r3(enCuadro), tapado: n ? r3(tapados / n) : 0, bajoTitulo: r3(bajoTitulo), pos: [m.raiz.position.x, m.raiz.position.y, m.raiz.position.z].map(r3) });
    }
    return { toma: toma ? toma.i + 1 : null, tau: toma ? r3(toma.tau) : null, camara: { pos: [cam.x, cam.y, cam.z].map(r3), fov: escena.camara.fov }, mobs, titulos: titulos.map(t => t.map(r3)) };
  }
  // durante revisiones largas se renderiza en calidad rápida (sin post-proceso): la geometría y la cámara son las mismas
  async function rapido(fn) { const c = escena.cfg; escena.cfg = { ...c, calidad: "rapida" }; try { return await fn(); } finally { escena.cfg = c; } }

  // trayectoria de cada mob de la toma (sin render): centro y tamaño de su caja (incluye cómo se mueven sus partes)
  function trazar(T, soloJ, paso, conSeries) {
    const datos = new Map();
    for (let t = T.ini + 0.001; t < T.fin - 1e-3; t += paso) {
      I.aplicarToma(t);
      for (const lista of Object.values(escena.mobs.pool)) for (const m of lista) {
        const sp = m.raiz.userData.spec;
        if (!m.raiz.visible || !sp || (soloJ && sp.grupo + 1 !== soloJ)) continue;
        m.raiz.updateMatrixWorld(true);
        caja.setFromObject(m.raiz);
        const c = caja.getCenter(new THREE.Vector3()), s = caja.getSize(new THREE.Vector3()), clave = sp.grupo + 1 + "." + (sp.k + 1);
        if (!datos.has(clave)) datos.set(clave, { j: sp.grupo + 1, k: sp.k + 1, tipo: m.tipo, modo: sp.g.modo || "caminar", t: [], c: [], s: [], yaw: [] });
        const d = datos.get(clave); d.t.push(t); d.c.push([c.x, c.y, c.z]); d.s.push([s.x, s.y, s.z]); d.yaw.push(m.raiz.rotation.y);
      }
    }
    const out = [];
    for (const d of datos.values()) {
      const n = d.t.length; if (n < 3) continue;
      const alto = d.s.reduce((a, s) => a + s[1], 0) / n || 1;
      // sacudida: segunda diferencia del centro y del tamaño de la caja (cm por cuadro²) relativa al alto del mob.
      // Caminar parejo da valores bajos; temblores, tambaleos y saltos de pose dan picos.
      const sac = [];
      for (let i = 1; i < n - 1; i++) {
        let s2 = 0;
        for (const arr of [d.c, d.s]) for (let e = 0; e < 3; e++) s2 += (arr[i + 1][e] - 2 * arr[i][e] + arr[i - 1][e]) ** 2;
        sac.push(Math.sqrt(s2) / alto * 100);
      }
      const ord = [...sac].sort((a, b2) => a - b2), p95 = ord[Math.floor(ord.length * 0.95)], max = ord[ord.length - 1];
      const iMax = sac.indexOf(max) + 1, dist = d.c.slice(1).reduce((a, c, i) => a + Math.hypot(c[0] - d.c[i][0], c[2] - d.c[i][2]), 0);
      const giro = d.yaw.slice(1).reduce((a, y, i) => a + Math.abs(y - d.yaw[i]), 0) * 180 / Math.PI;
      const r = { toma: T.i, j: d.j, k: d.k, tipo: d.tipo, modo: d.modo, alto: r3(alto), velocidad: r3(dist / (d.t[n - 1] - d.t[0])), giro_grados: Math.round(giro),
        sacudida_p95: r3(p95), sacudida_max: r3(max), t_max: r3(d.t[iMax]) };
      if (conSeries) Object.assign(r, { t: d.t.map(r3), centro: d.c.map(c => c.map(r3)), tam: d.s.map(s => s.map(r3)), sacudida: sac.map(r3) });
      out.push(r);
    }
    return out;
  }

  const COMANDOS = {
    ayuda: { desc: "Lista de comandos y sus argumentos.", fn: () => Object.fromEntries(Object.entries(COMANDOS).map(([k, c]) => [k, { desc: c.desc, ...(c.args ? { args: c.args } : {}) }])) },

    estado: { desc: "Resumen del proyecto: duración, tomas (inicio, dur, escenario, mobs, títulos), plantillas, conexión.",
      fn: () => ({ proyecto: app.proyectos?.id ?? null, nombre: app.proy?.nombre ?? null, duracion: app.proy ? r3(I.duracion(app.proy)) : 0, formato: app.proy?.ajustes.formato, t: r3(app.t),
        exportando: app.exportando, panelOculto: document.hidden, plantillas: Object.entries(I.PLANTILLAS).map(([id, p]) => ({ id, nombre: p.nombre })),
        tomas: app.proy ? tomas().map(T => resumenToma(T)) : [] }) },

    plantilla: { desc: "Carga una plantilla (borra la animación actual; se puede deshacer).", args: { id: "trailer | benly | saludo | …" },
      fn: async ({ id }) => {
        const pl = I.PLANTILLAS[id] || error("plantilla desconocida: " + id + " (ver estado.plantillas)");
        I.aplicarPlantilla(pl); await new Promise(r => setTimeout(r, 300)); app.reproduciendo && document.querySelector("#b-play")?.click();
        await escena.mobs.precargar(P().escenas); await escena.titulos.listo;
        return { ok: true, tomas: tomas().length, duracion: r3(I.duracion(app.proy)) };
      } },

    toma: { desc: "Todo lo de una toma en JSON: escena (escenario, cielo, luz, etalonaje…), mobs, cámaras y títulos (inicio relativo a la toma).", args: { toma: "número (desde 1)" },
      fn: ({ toma }) => resumenToma(tomaN(toma), true) },

    editarToma: { desc: "Cambia campos de la escena de una toma (mezcla profunda; null borra). No cambia la duración.", args: { toma: "n", cambios: "{ambiente, cielo, luna, exp, sat, calidez, dof, niebla, sol, actor, fondo, …}" },
      fn: async ({ toma, cambios }) => {
        const T = tomaN(toma);
        if ("dur" in (cambios || {}) || "mobs" in (cambios || {})) error("dur no se cambia aquí (desfasaría cámaras y títulos); para mobs usa mob/agregarMob/quitarMob");
        mezclar(T.clip, cambios); await listo(); return resumenToma(tomaN(toma), true).escena;
      } },

    mob: { desc: "Cambia un grupo de mobs de una toma (mezcla profunda; null borra un campo). variante: textura del mob (ver catalogo: gato \"siames\", rana \"fria\", aldeano zombi \"desierto+librero\"); null = la de siempre.", args: { toma: "n", j: "número del mob en la toma", cambios: "{x, z, y, dir, vel, modo, accion, ruta, rumbo, retraso, calmo, foco, variante, …}" },
      fn: async ({ toma, j, cambios }) => {
        const T = tomaN(toma), g = T.clip.mobs?.[j - 1] || error(`la toma ${toma} no tiene mob ${j}`);
        const nuevo = { ...g, ...(cambios?.tipo ? { tipo: await tipoValido(cambios.tipo) } : {}) };
        const v = cambios?.variante != null ? varianteValida(nuevo.tipo, cambios.variante) : undefined;     // antes de tocar nada
        mezclar(g, cambios);
        if (cambios?.tipo) g.tipo = nuevo.tipo;
        if (v !== undefined) { if (v) g.variante = v; else delete g.variante; }
        await listo(true); return { j, ...g };
      } },

    agregarMob: { desc: "Agrega un grupo de mobs a una toma. Devuelve su número. tipo: cualquier mob de la biblioteca (id del animador, nombre en español o inglés, o id de Java: \"zombi\", \"Esqueleto\", \"pig\"; ver catalogo). objeto: lo que tiene en la mano. variante: textura (gato \"siames\", caballo \"negro+patas_blancas\", oveja \"rosa\"; ver catalogo).", args: { toma: "n", mob: "{tipo, n, x, z, dir, vel, modo, fijo, objeto, bebe, variante, …} (ver js/mobs.js)" },
      fn: async ({ toma, mob }) => {
        const T = tomaN(toma); if (!mob?.tipo) error("falta mob.tipo");
        const g = { n: 1, fijo: true, semilla: (T.clip.mobs?.length ?? 0) * 17 + 17, ...structuredClone(mob), tipo: await tipoValido(mob.tipo) };
        if (g.objeto) g.objeto = await objetoValido(g.objeto);
        if (g.variante != null) { const v = varianteValida(g.tipo, g.variante); if (v) g.variante = v; else delete g.variante; }
        (T.clip.mobs ??= []).push(g);
        await listo(true); return { j: T.clip.mobs.length, tipo: g.tipo, nombre: CATALOGO.porId[g.tipo]?.nombre, ...(g.variante ? { variante: g.variante } : {}) };
      } },

    darObjeto: { desc: "Pone un objeto de Minecraft en la mano derecha de LTezla (sin j) o de un grupo de mobs (j). objeto: id de Java o nombre (\"diamond_sword\", \"manzana\", \"oak_planks\"); null lo quita. Ver catalogo {seccion: \"objetos\"}.", args: { toma: "n", j: "mob opcional", objeto: "id o nombre, o null" },
      fn: async ({ toma, j, objeto }) => {
        const T = tomaN(toma), id = objeto == null ? null : await objetoValido(objeto);
        const destino = j ? (T.clip.mobs?.[j - 1] || error(`la toma ${toma} no tiene mob ${j}`)) : T.clip;
        if (id) destino.objeto = id; else delete destino.objeto;
        await listo(true); return { toma, ...(j ? { j } : { quien: "LTezla" }), objeto: id, nombre: id ? objetoInfo(id)?.nombre : null };
      } },

    quitarMob: { desc: "Quita un grupo de mobs de una toma.", args: { toma: "n", j: "n" },
      fn: async ({ toma, j }) => { const T = tomaN(toma); if (!T.clip.mobs?.[j - 1]) error("no existe ese mob"); const [g] = T.clip.mobs.splice(j - 1, 1); await listo(); return { quitado: g.tipo }; } },

    camara: { desc: "Cambia un clip de cámara de la toma: desde/hasta {az, el, dist, ty, fov, pan, tilt, roll}, curva, temblor, fija, foco. Lente máx. ~42°.", args: { toma: "n", k: "número de clip (1 por defecto)", cambios: "{desde:{…}, hasta:{…}, …}" },
      fn: async ({ toma, k = 1, cambios }) => {
        const T = tomaN(toma), c = T.cams[k - 1] || error(`la toma ${toma} tiene ${T.cams.length} clip(s) de cámara`);
        if ("dur" in (cambios || {})) error("dur no se cambia aquí");
        for (const lado of ["desde", "hasta"]) if (cambios?.[lado]?.fov > 42) error("fov máximo ~42° (regla del proyecto)");
        mezclar(c, cambios); await listo(); return { k, ...c };
      } },

    titulo: { desc: "Cambia un título de la toma (texto, x, y, tam, color, color2, sombra, sombra2, prof, espaciado, interlinea, giro, enEscena, inicio relativo, dur…).", args: { toma: "n", k: "n", cambios: "{…}" },
      fn: async ({ toma, k, cambios }) => {
        const T = tomaN(toma), x = T.textos[k - 1] || error(`la toma ${toma} tiene ${T.textos.length} título(s)`);
        const c = structuredClone(cambios || {}); if ("inicio" in c) c.inicio = T.ini + Number(c.inicio);
        mezclar(x, c); await listo(); return { k, ...x, inicio: r3(x.inicio - T.ini) };
      } },

    agregarTitulo: { desc: "Agrega un título 3D a la toma (inicio relativo; dur = lo que resta de la toma si no se da).", args: { toma: "n", titulo: "{texto, x, y, tam, color, …}" },
      fn: async ({ toma, titulo }) => {
        const T = tomaN(toma); if (!titulo?.texto) error("falta titulo.texto");
        const ini = T.ini + (titulo.inicio || 0);
        P().textos.push({ id: "c" + Date.now().toString(36), anim: "golpe", dur: T.fin - ini, ...structuredClone(titulo), inicio: ini });
        await listo(); return { k: tomaN(toma).textos.length };
      } },

    quitarTitulo: { desc: "Quita un título de la toma.", args: { toma: "n", k: "n" },
      fn: async ({ toma, k }) => { const T = tomaN(toma), x = T.textos[k - 1] || error("no existe ese título"); P().textos.splice(P().textos.indexOf(x), 1); await listo(); return { quitado: x.texto }; } },

    // ── proyectos (cada video es proyectos/<id>.json; el abierto se autoguarda)
    proyectos: { desc: "Lista de proyectos guardados (id, nombre, fecha, duración, tomas) y cuál está abierto.", fn: async () => ({ abierto: app.proyectos.id, proyectos: await app.proyectos.lista() }) },
    nuevoProyecto: { desc: "Crea un proyecto nuevo (vacío o con una plantilla) y lo abre. El anterior queda guardado.", args: { nombre: "texto", plantilla: "id opcional (trailer, benly…)" },
      fn: async ({ nombre, plantilla }) => { const r = await app.proyectos.crear({ nombre, plantilla }); await escena.titulos.listo; return { ...r, tomas: tomas().length }; } },
    abrirProyecto: { desc: "Abre un proyecto guardado por su id (guarda antes el actual).", args: { id: "id (ver proyectos)" }, fn: ({ id }) => app.proyectos.abrir(id) },
    duplicarProyecto: { desc: "Copia un proyecto (por defecto el abierto) con otro nombre; no lo abre.", args: { id: "opcional", nombre: "texto" }, fn: ({ id, nombre }) => app.proyectos.duplicar(id, nombre) },
    renombrarProyecto: { desc: "Cambia el nombre (el id/archivo no cambia).", args: { id: "opcional", nombre: "texto" }, fn: ({ id, nombre }) => app.proyectos.renombrar(id, nombre) },
    borrarProyecto: { desc: "Manda un proyecto (que no esté abierto) a proyectos/papelera/.", args: { id: "id" }, fn: ({ id }) => app.proyectos.borrar(id) },

    recargar: { desc: "Recarga la página (para tomar código nuevo de js/). El proyecto se conserva (autoguardado).", fn: () => { setTimeout(() => location.reload(), 300); return { ok: true }; } },
    deshacer: { desc: "Deshace el último cambio.", fn: () => { I.deshacer(); return { ok: true }; } },
    rehacer: { desc: "Rehace el último cambio deshecho.", fn: () => { I.rehacer(); return { ok: true }; } },

    ir: { desc: "Mueve el cabezal de la interfaz al tiempo t (para que el humano lo vea).", args: { t: "segundos" },
      fn: ({ t }) => { app.irA(Number(t)); return { t: r3(app.t) }; } },

    cuadro: { desc: "Renderiza el cuadro t con la calidad final y lo guarda en agente/salida/. Devuelve la ruta.", args: { t: "segundos", escala: "0.5 por defecto (1 = 1280×720)", nombre: "opcional" },
      fn: async ({ t, escala = 0.5, nombre }) => {
        const blob = await I.conCuadro(Number(t), escala, (c) => lienzoABlob(c, "image/jpeg", 0.92));
        return { archivo: await guardarArchivo(nombre || `cuadro_${Number(t).toFixed(2)}.jpg`, blob) };
      } },

    hoja: { desc: "Hoja de contactos: varios cuadros en una sola imagen con el tiempo de cada uno (la forma más barata de mirar una toma).", args: { toma: "n (reparte los cuadros en la toma)", ts: "o lista de tiempos", n: "cuadros (6)", columnas: "3", escala: "0.35", nombre: "opcional" },
      fn: async ({ toma, ts, n = 6, columnas = 3, escala = 0.35, nombre }) => {
        let lista = ts?.map(Number);
        if (!lista) { const T = tomaN(toma ?? error("da toma o ts")); lista = Array.from({ length: n }, (_, k) => T.ini + (k + 0.5) * T.clip.dur / n); }
        const cuadros = [];
        for (const t of lista) cuadros.push(await I.conCuadro(t, escala, (c) => { const k = document.createElement("canvas"); k.width = c.width; k.height = c.height; k.getContext("2d").drawImage(c, 0, 0); return k; }));
        const w = cuadros[0].width, h = cuadros[0].height, cols = Math.min(columnas, cuadros.length), filas = Math.ceil(cuadros.length / cols);
        const H = document.createElement("canvas"); H.width = w * cols; H.height = h * filas;
        const x = H.getContext("2d"); x.fillStyle = "#000"; x.fillRect(0, 0, H.width, H.height);
        cuadros.forEach((c, k) => {
          const px = (k % cols) * w, py = Math.floor(k / cols) * h; x.drawImage(c, px, py);
          const tm = I.tomaEn(app.proy, lista[k]), et = `${lista[k].toFixed(2)} s · toma ${tm ? tm.i + 1 : "-"}`;
          x.font = "bold 14px monospace"; const ancho = x.measureText(et).width;
          x.fillStyle = "rgba(0,0,0,.65)"; x.fillRect(px, py, ancho + 10, 20); x.fillStyle = "#ffe14d"; x.fillText(et, px + 5, py + 15);
        });
        const etiqueta = nombre || (toma ? `hoja_toma${toma}.jpg` : `hoja_${lista[0].toFixed(2)}.jpg`);
        return { archivo: await guardarArchivo(etiqueta, await lienzoABlob(H, "image/jpeg", 0.9)), ts: lista.map(r3) };
      } },

    inspeccionar: { desc: "Qué se ve en el tiempo t: cámara, y por mob su rectángulo en pantalla (0..1), alto relativo, fracción en cuadro, tapado por bloques y bajo títulos.", args: { t: "segundos" },
      fn: ({ t }) => rapido(() => I.conCuadro(Number(t), 0.25, () => medir())) },

    revisar: { desc: "Revisión automática: física (metidos en bloques, flotando) y visibilidad (mob protagonista que no se ve, mobs tapados, bajo títulos, a media pantalla en el corte).", args: { tomas: "lista opcional de tomas", paso: "segundos entre muestras (0.2)" },
      fn: async ({ tomas: sel, paso = 0.2 } = {}) => {
        const avisos = [], resumen = [];
        await escena.mobs.precargar(P().escenas);
        for (const T of tomas()) {
          if (sel && !sel.includes(T.i)) continue;
          if (T.clip.negro || !(T.clip.mobs || []).length) continue;
          const datos = new Map();                       // "j" → muestras
          const ts = []; for (let t = T.ini + 0.02; t < T.fin - 0.02; t += paso) ts.push(t); ts.push(T.fin - 0.03);
          for (const t of ts) {
            const med = await rapido(() => I.conCuadro(t, 0.2, () => medir()));
            for (const m of med.mobs) { const k2 = m.j + "." + m.k; if (!datos.has(k2)) datos.set(k2, []); datos.get(k2).push({ t, ...m }); }
            // física en el mismo cuadro
            const set = T.clip.set ? escena.sets[T.clip.set] : null;
            for (const f of escena.mobs.revisar(set)) avisos.push({ toma: T.i, t: r3(t), tipo: f.tipo, problema: f.problema, nivel: "fisica" });
          }
          (T.clip.mobs || []).forEach((g, gj) => {
            const muestras = [...datos.entries()].filter(([k2]) => k2.startsWith(gj + 1 + ".")).flatMap(([, l]) => l);
            if (!muestras.length) return;
            const N = muestras.length, prom = (f) => muestras.reduce((s, m) => s + f(m), 0) / N;
            const visible = prom(m => (m.enCuadro > 0.5 && m.tapado < 0.5 ? 1 : 0)), tapado = prom(m => m.enCuadro > 0.3 ? m.tapado : 0), titulo = prom(m => m.bajoTitulo);
            resumen.push({ toma: T.i, j: gj + 1, tipo: g.tipo, visible: r3(visible), tapado: r3(tapado), bajoTitulo: r3(titulo), alto: r3(prom(m => m.tam)) });
            if (g.foco && visible < 0.4) avisos.push({ toma: T.i, j: gj + 1, tipo: g.tipo, nivel: "visibilidad", problema: `el protagonista (foco) solo se ve ${Math.round(visible * 100)} % del tiempo` });
            if (tapado > 0.35) avisos.push({ toma: T.i, j: gj + 1, tipo: g.tipo, nivel: "visibilidad", problema: `tapado por bloques ${Math.round(tapado * 100)} % del tiempo que está en cuadro` });
            if (titulo > 0.3) avisos.push({ toma: T.i, j: gj + 1, tipo: g.tipo, nivel: "composicion", problema: `${Math.round(titulo * 100)} % del mob queda bajo un título` });
            // a media pantalla y en movimiento justo al corte: "desaparece" con el corte (el caso del aldeano del callejón)
            const ult = muestras.filter(m => Math.abs(m.t - (T.fin - 0.03)) < 1e-3);
            const mueve = ["caminar", "correr"].includes(g.modo || "caminar") && (g.vel ?? 1) > 1.5;
            for (const m of ult) if (mueve && m.enCuadro > 0.95 && m.pantalla && m.pantalla[0] > 0.15 && m.pantalla[2] < 0.85)
              avisos.push({ toma: T.i, j: gj + 1, tipo: g.tipo, nivel: "aviso", problema: "sigue a media pantalla corriendo cuando llega el corte (puede parecer que desaparece)" });
          });
        }
        // sacudidas: un mob quieto con temblor/tambaleo visible (umbral calibrado con la oveja de la toma 23 sin "calmo")
        for (const T of tomas()) {
          if (sel && !sel.includes(T.i)) continue;
          if (T.clip.negro || !(T.clip.mobs || []).length) continue;
          for (const r of trazar(T, null, 1 / 24, false)) {
            const umbral = r.modo === "quieto" ? UMBRAL_QUIETO : UMBRAL_MOVIENDO;
            if (r.tipo !== "pollito" && r.sacudida_p95 > umbral) avisos.push(      // los pollitos dan saltitos y picotean a propósito
             { toma: T.i, j: r.j, tipo: r.tipo, nivel: "movimiento", problema: `se sacude/tambalea (sacudida p95 ${r.sacudida_p95}, máx. en ${r.t_max} s)` });
          }
        }
        // los avisos de física repetidos (mismo mob y problema) se resumen
        const vistos = new Set(), unicos = avisos.filter(a => { const k = [a.toma, a.j, a.tipo, a.nivel, a.nivel === "fisica" ? a.problema.split(" ")[0] : a.problema].join("|"); if (vistos.has(k)) return false; vistos.add(k); return true; });
        return { avisos: unicos, mobs: resumen };
      } },

    exportar: { desc: "Exporta el video MP4 a Videos/<nombre>.mp4 (720p ≈2 min; calidad 'alta' = 1080p, supermuestreo 1.5× y más bitrate, ≈4× más lento). Con la página oculta se frena ~15× (usar la ventana dedicada: agente.py --ventana).", args: { nombre: "sin extensión", fps: "24", escala: "1 (alta: 1.5 → 1920×1080)", calidad: "normal | alta", supermuestreo: "alta: 1.5 (2 = se dibuja a 4K)", desde: "s", hasta: "s" },
      fn: async ({ nombre, fps = 24, escala, calidad = "normal", supermuestreo, desde, hasta } = {}) => {
        if (nombre) app.proy.nombre = nombre;
        const oculto = document.hidden, t0 = performance.now();
        const ruta = await I.exportar({ tipo: "mp4", fps, escala: escala ?? (calidad === "alta" ? 1.5 : 1), calidad, supermuestreo, desde, hasta });
        return { archivo: ruta, segundos: Math.round((performance.now() - t0) / 1000), ...(oculto ? { aviso: "el panel estaba oculto: la exportación se frena" } : {}) };
      } },

    catalogo: { desc: "Nombres válidos: poses, expresiones (ojos), matices, cámaras, mobs (TODOS los de la biblioteca: id, nombre, categoría, de dónde sale el modelo y tamaño en bloques), objetos (por categoría), escenarios, ambientes y bloques del mundo. Los mobs con varias texturas traen variantes (la primera = sin variante) y extras (se suman con +: \"desierto+librero\"). Con seccion = mobs | objetos y buscar / cat filtra (los objetos solo se listan completos con filtro).", args: { seccion: "opcional: mobs | objetos", buscar: "texto opcional", cat: "categoría opcional (mobs: animal, mascota, aldeano, monstruo, acuatico, jefe, golem · objetos: arma, herramienta, armadura, comida, bloque, objeto)" },
      fn: async ({ seccion, buscar, cat } = {}) => {
        await cargarBiblioteca(); await cargarObjetos();
        const q = buscar ? sinAcentos(buscar) : null;
        const pasa = (e) => (!cat || e.cat === cat) && (!q || [e.id, e.nombre, e.nombre_en, e.java].some(x => x && sinAcentos(x).includes(q)));
        const mobs = CATALOGO.mobs.filter(pasa).map(e => ({ id: e.id, nombre: e.nombre, cat: e.cat, fuente: e.fuente, tam: e.tam, ...(e.java ? { java: e.java } : {}), ...(e.nota ? { nota: e.nota } : {}),
          ...(e.variantes?.length ? { variantes: e.variantes.map(v => v.id) } : {}), ...(e.extras?.length ? { extras: e.extras.map(x => x.id) } : {}) }));
        const objs = listaObjetos().filter(pasa);
        const porCat = {}; for (const o of listaObjetos()) porCat[o.cat] = (porCat[o.cat] || 0) + 1;
        const objetos = q || cat ? objs.map(o => ({ id: o.id, nombre: o.nombre, cat: o.cat, forma: o.forma })) : { total: objs.length, porCategoria: porCat, nota: "usa buscar o cat para listarlos" };
        if (seccion === "mobs") return { total: mobs.length, mobs };
        if (seccion === "objetos") return { total: objs.length, objetos };
        return { poses: Object.fromEntries(Object.entries(POSES).map(([k, v]) => [k, v.nombre])), expresiones: Object.keys(EXPRESIONES),
          matices: Object.keys(MATICES), camaras: Object.keys(CAMARAS), mobs, objetos, escenarios: Object.keys(ESCENARIOS), ambientes: Object.keys(AMBIENTES),
          bloques: Object.keys(B).filter(k => BLOQUES[B[k]]) };
      } },

    // ── estructura: tomas nuevas, borrar, cambiar duración (todo lo que viene después se corre: cámaras, poses, ojos,
    //    matices, títulos y audio)
    duracionToma: { desc: "Cambia la duración de una toma; lo de adentro se estira o encoge y lo de después se corre (cámaras, poses, ojos, matices, títulos, audio). Los tiempos internos de los mobs (accion.en…) no se escalan.", args: { toma: "n", dur: "segundos" },
      fn: async ({ toma, dur }) => {
        const T = tomaN(toma); if (!(dur > 0.05)) error("dur debe ser > 0.05 s");
        deformar(P(), T.ini, T.fin, Number(dur)); await listo(); return { toma, dur: r3(tomaN(toma).clip.dur), duracion: r3(I.duracion(app.proy)) };
      } },
    quitarToma: { desc: "Borra una toma y todo lo que cae dentro (cámaras, poses, ojos, títulos, matices); lo de después se recorre.", args: { toma: "n" },
      fn: async ({ toma }) => { const T = tomaN(toma); deformar(P(), T.ini, T.fin, 0); await listo(); return { tomas: tomas().length, duracion: r3(I.duracion(app.proy)) }; } },
    agregarToma: { desc: "Inserta una toma nueva después de la toma 'despues' (0 = al inicio). Copia escena y cámara de 'copiar' si se da; si no, una toma vacía de día.", args: { despues: "n", dur: "segundos", nombre: "texto", copiar: "n opcional", escena: "{set, ambiente, mobs, …}", camara: "{desde, hasta, …}" },
      fn: async ({ despues = tomas().length, dur = 2, nombre = "Toma nueva", copiar, escena: esc = {}, camara: cam = {} }) => {
        const lista = tomas(), a = despues > 0 ? (lista[despues - 1] || error("no existe la toma " + despues)).fin : 0, L = Number(dur);
        const base = copiar ? tomaN(copiar) : null;
        // correr lo absoluto y abrir el hueco en cada pista secuencial
        for (const n of ABSOLUTAS) for (const c of P()[n] || []) { if (c.inicio >= a - 1e-6) c.inicio += L; else if (c.inicio + c.dur > a + 1e-6) c.dur += L; }      // lo que cruza el punto se alarga
        const escClip = { ...(base ? Object.fromEntries(Object.entries(structuredClone(base.clip)).filter(([k]) => k !== "id")) : { set: "aldea", ambiente: "dia", ocultar: true, mobs: [], actor: { x: 0, y: 0, z: 0, rot: 0 } }), ...structuredClone(esc), id: nuevoId(), dur: L, nombre };
        P().escenas.splice(partir(P().escenas, a, "escenas"), 0, escClip);
        const camBase = base?.cams[0] ? structuredClone(base.cams[0]) : { tipo: "libre", desde: { az: 0, el: 5, dist: 6, ty: 1, fov: 40 }, curva: "lineal" };
        const camClip = mezclar({ ...camBase, id: nuevoId(), dur: L }, cam); camClip.hasta ??= structuredClone(camClip.desde);
        if (totalDe(P().camara) >= a - 1e-6) P().camara.splice(partir(P().camara, a, "camara"), 0, camClip);
        if (totalDe(P().poses) >= a - 1e-6) P().poses.splice(partir(P().poses, a), 0, clipPose("reposo", L, { corte: true, trans: 0 }));
        if (totalDe(P().ojos) >= a - 1e-6) P().ojos.splice(partir(P().ojos, a), 0, clipOjos("feliz", L));
        await listo(true); return { toma: P().escenas.indexOf(escClip) + 1, inicio: r3(a), duracion: r3(I.duracion(app.proy)) };
      } },

    // ── el personaje (LTezla): poses, ojos y matices dentro de una toma
    personaje: { desc: "Lo que hace LTezla en una toma. poses: [[id o {nombre, r, p}, dur, {trans, curva}]…], ojos: [[expresión, dur, mx, my, {aCamara}]…], matices: [[tipo, inicio relativo, dur, intensidad]…]; las duraciones se escalan a la toma. actor {x,y,z,rot} y ocultar van a la escena. Ver 'catalogo'.", args: { toma: "n", poses: "lista", ojos: "lista", matices: "lista", actor: "{…}", ocultar: "bool" },
      fn: async ({ toma, poses, ojos, matices, actor, ocultar }) => {
        const T = tomaN(toma), a = T.ini, b = T.fin;
        if (poses) {
          const nuevos = poses.map(([pose, dur = 1, extra = {}], i) => {
            if (typeof pose === "string") { if (!POSES[pose]) error("pose desconocida: " + pose + " (ver catalogo)"); return clipPose(pose, dur, { trans: i ? 0.35 : 0, curva: "natural", ...(i ? {} : { corte: true }), ...extra }); }
            return clipPoseObj(pose, dur, { trans: i ? 0.35 : 0, curva: "natural", ...(i ? {} : { corte: true }), ...extra });
          });
          reemplazarVentana(P().poses, a, b, nuevos, (d) => clipPose("reposo", d));
        }
        if (ojos) {
          for (const [cara] of ojos) if (!EXPRESIONES[cara]) error("expresión desconocida: " + cara + " (ver catalogo)");
          reemplazarVentana(P().ojos, a, b, ojos.map(([cara, dur = 1, mx = 0, my = 0, extra = {}]) => clipOjos(cara, dur, mx, my, extra)), (d) => clipOjos("feliz", d));
        }
        if (matices) {
          P().matices = P().matices.filter(m => m.inicio < a - 1e-6 || m.inicio >= b - 1e-6);
          for (const [tipo, ini = 0, dur = T.clip.dur, inten = 1] of matices) { if (!MATICES[tipo]) error("matiz desconocido: " + tipo); P().matices.push(clipMatiz(tipo, a + ini, dur, inten)); }
        }
        if (actor) mezclar(T.clip.actor ??= {}, actor);
        if (ocultar !== undefined) T.clip.ocultar = !!ocultar;
        await listo(); return { toma, poses: P().poses.length, ojos: P().ojos.length };
      } },

    // ── bloques del escenario (se guardan en el proyecto: proyecto.ediciones)
    bloques: { desc: "Pone, quita o consulta bloques de un escenario (coordenadas de la escena; y = 0 es el piso). Con toma + relativo:true, x/z se miden desde el ancla de la toma (como los mobs). op: poner | quitar | consultar | alturas | limpiar (borra todas las ediciones del escenario).", args: { escenario: "nombre o toma", toma: "n", op: "poner…", desde: "[x,y,z]", hasta: "[x,y,z] (caja)", bloque: "nombre (ver catalogo.bloques)", relativo: "bool" },
      fn: async ({ escenario, toma, op = "consultar", desde = [0, 0, 0], hasta, bloque, relativo = false }) => {
        const T = toma ? tomaN(toma) : null, set = escenario || T?.clip.set || error("da escenario o toma");
        if (!ESCENARIOS[set]) error("escenario desconocido: " + set);
        let off = [0, 0, 0];
        if (relativo) { const an = I.tomaEn(app.proy, (T || error("relativo necesita toma")).ini + 0.01).ancla; off = [Math.floor(an.x), Math.floor(an.y || 0), Math.floor(an.z)]; }      // al bloque del ancla
        const h = hasta || desde, rango = [0, 1, 2].map(i => [Math.min(desde[i], h[i]) + off[i], Math.max(desde[i], h[i]) + off[i]].map(Math.floor));
        const celdas = (rango[0][1] - rango[0][0] + 1) * (rango[1][1] - rango[1][0] + 1) * (rango[2][1] - rango[2][0] + 1);
        if (op === "limpiar") { const ed = structuredClone(app.proy.ediciones || {}); delete ed[set]; app.proy.ediciones = ed; await listo(); return { ok: true }; }
        if (op === "poner" || op === "quitar") {
          if (celdas > 20000) error("máximo 20 000 bloques por comando");
          const id = op === "quitar" ? "aire" : bloque; if (id !== "aire" && !(id in B)) error("bloque desconocido: " + id + " (ver catalogo.bloques)");
          const ed = structuredClone(app.proy.ediciones || {}), mapa = new Map((ed[set] || []).map(e => [e.slice(0, 3).join(","), e]));
          for (let x = rango[0][0]; x <= rango[0][1]; x++) for (let y = rango[1][0]; y <= rango[1][1]; y++) for (let z = rango[2][0]; z <= rango[2][1]; z++) mapa.set([x, y, z].join(","), [x, y, z, id]);
          ed[set] = [...mapa.values()]; app.proy.ediciones = ed; await listo();
          return { ok: true, bloques: celdas, ediciones: ed[set].length };
        }
        // consultar / alturas: el escenario tiene que existir (se genera si hace falta)
        if (!escena.sets[set]) { const antes = escena.setActual; escena.usarSet(set); escena.usarSet(antes); }
        escena.sincronizarEdiciones(app.proy.ediciones || null);
        const m = escena.sets[set], nombre = Object.fromEntries(Object.entries(B).map(([k, v]) => [v, k]));
        if (op === "alturas") {
          const out = [];
          for (let z = rango[2][0]; z <= rango[2][1]; z++) { const fila = []; for (let x = rango[0][0]; x <= rango[0][1]; x++) fila.push(m.alturaEn(m.O.x + x, m.O.z + z) - m.O.y + 1); out.push(fila); }
          return { nota: "altura del piso (y del primer bloque libre) por fila z, columna x", x: rango[0], z: rango[2], alturas: out };
        }
        if (celdas > 4000) error("consulta máx. 4000 celdas");
        const out = [];
        for (let x = rango[0][0]; x <= rango[0][1]; x++) for (let y = rango[1][0]; y <= rango[1][1]; y++) for (let z = rango[2][0]; z <= rango[2][1]; z++) {
          const id = m.get(m.O.x + x, m.O.y + y, m.O.z + z); if (id) out.push([x - off[0], y - off[1], z - off[2], nombre[id] ?? id]);
        }
        return { bloques: out };
      } },

    // ── movimiento: trayectoria y sacudidas de cada mob (sin renderizar: solo la simulación)
    traza: { desc: "Movimiento de los mobs de una toma cuadro a cuadro: velocidad, giro y 'sacudida' (temblor del cuerpo y sus partes respecto a su tamaño; > 1 se nota en pantalla). series:true devuelve las curvas.", args: { toma: "n", j: "mob opcional", paso: "1/24", series: "bool" },
      fn: async ({ toma, j, paso = 1 / 24, series = false }) => {
        await escena.mobs.precargar(P().escenas);
        return trazar(tomaN(toma), j, paso, series);
      } },

    clip: { desc: "Video corto de una toma o rango (sin abrir la interfaz de exportar) → agente/salida/clip_*.mp4. Útil para que el humano vea el movimiento o para analizarlo con ffmpeg.", args: { toma: "n", desde: "s", hasta: "s", escala: "0.5", fps: "24", calidad: "normal | alta" },
      fn: async ({ toma, desde, hasta, escala = 0.5, fps = 24, calidad = "normal" }) => {
        if (toma) { const T = tomaN(toma); desde = T.ini; hasta = T.fin; }
        if (desde == null || hasta == null) error("da toma o desde/hasta");
        const nombre = toma ? `clip_toma${toma}` : `clip_${Number(desde).toFixed(2)}-${Number(hasta).toFixed(2)}`;
        return { archivo: await I.exportar({ tipo: "mp4", fps, escala, desde, hasta, destino: "agente", nombreArchivo: nombre, calidad }) };
      } },

    guardar: { desc: "Guarda el proyecto completo en agente/proyectos/<nombre>.json.", args: { nombre: "sin extensión" },
      fn: async ({ nombre }) => ({ archivo: await guardarArchivo((nombre || "proyecto") + ".json", JSON.stringify(app.proy)) }) },

    abrir: { desc: "Abre agente/proyectos/<nombre>.json (lo que escribe 'guardar' o un script) en SU PROPIO proyecto proyectos/agente-<nombre>.json: nunca pisa el proyecto que estaba abierto.", args: { nombre: "sin extensión" },
      fn: async ({ nombre }) => {
        const r = await fetch("agente/proyectos/" + encodeURIComponent(nombre) + ".json", { cache: "no-store" }); if (!r.ok) error("no existe agente/proyectos/" + nombre + ".json");
        const proy = JSON.parse(await r.text());
        const res = await app.proyectos.cargarComo("agente-" + nombre, proy);
        await escena.mobs.precargar(P().escenas); return { ok: true, proyecto: res.id, tomas: tomas().length };
      } },
  };

  // ───────────── ejecutor e indicador para el humano ─────────────
  const chip = document.createElement("div");
  chip.className = "chip-agente";
  document.body.appendChild(chip);
  let ultimoContacto = 0;
  const DEDICADA = new URLSearchParams(location.search).has("agente");      // ventana abierta con agente.py --ventana
  const mostrar = (txt, ocupado = false) => { chip.innerHTML = `<svg class="ic"><use href="#i-${ocupado ? "loader" : "bot"}"/></svg>`; chip.append(txt); chip.classList.toggle("ocupado", ocupado); chip.classList.add("ver"); };

  let cola = Promise.resolve();
  async function ejecutar(cmd, args = {}) {
    const c = COMANDOS[cmd] || error(`comando desconocido: ${cmd} (usa "ayuda")`);
    const tarea = cola.then(async () => {
      mostrar("Agente: " + cmd + "…", true);
      try { return await c.fn(args || {}); }
      finally { mostrar("Agente conectado · " + cmd); }
    });
    cola = tarea.catch(() => {});
    return tarea;
  }
  window.agente = { ejecutar, comandos: COMANDOS };

  // puente con el servidor: espera comandos (espera larga) y devuelve el resultado
  (async function puente() {
    let fallos = 0;
    for (;;) {
      try {
        const r = await fetch("/api/agente/siguiente" + (DEDICADA ? "?dedicada=1" : ""), { headers: CAB });
        if (r.status === 404) { await new Promise(s => setTimeout(s, 30000)); continue; }      // servidor viejo sin puente
        const pedido = await r.json(); fallos = 0;
        if (!ultimoContacto) mostrar("Agente conectado");
        ultimoContacto = Date.now();
        if (!pedido?.id) continue;
        fetch("/api/agente/recibido", { method: "POST", headers: CAB, body: JSON.stringify({ id: pedido.id }) }).catch(() => {});
        let respuesta;
        try { respuesta = { id: pedido.id, ok: true, resultado: await ejecutar(pedido.cmd, pedido.args) }; }
        catch (e) { respuesta = { id: pedido.id, ok: false, error: String(e?.message || e) }; }
        await fetch("/api/agente/resultado", { method: "POST", headers: CAB, body: JSON.stringify(respuesta) });
      } catch { fallos++; await new Promise(s => setTimeout(s, Math.min(10000, 500 * fallos))); }
    }
  })();
}
