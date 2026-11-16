// Minecraft Animator: estado del proyecto, interfaz y bucle de render.
import { normalizarSkin, caraDeSkin, crearPersonaje, JUNTAS, NOMBRE_JUNTA } from "./personaje.js";
import { Rostro, EXPRESIONES, ESTILOS, configPorDefecto, coloresAuto, detectarOjos, resolverExpresion } from "./rostro.js";
import { POSES, CATEGORIAS, MATICES, CAMARAS, CURVAS, espejarPose } from "./poses.js";
import { evaluar, aplicar, duracion, inicios, poseDe, tomaEn, textosEn, cortesTomas } from "./motor.js";
import { Escena, Estudio, posicionCamara, AMBIENTES } from "./escena.js";
import { tiempoSim } from "./efectos.js";
import * as THREE from "three";
import { Linea, SECUENCIA } from "./linea.js";
import { PLANTILLAS, sorprendeme, clipPose, clipOjos, clipMatiz, clipCamara, nuevoId } from "./plantillas.js";
import { BLOQUES, PALETA, B, ORIGEN, iconoBloque, ARCHIVOS_REALES, ESCENARIOS } from "./mundo.js";
import { Motor as MotorAudio } from "./audio.js";
import { clipVoz, clipSfx, VOZ_LTEZLA } from "./plantillas.js";
import { instalarAgente } from "./agente.js";
import { instalarProyectos } from "./proyectos.js";
import { objetoListo, cargarObjetos } from "./objetos.js";
import { instalarRecursos } from "./recursos.js";

const audio = new MotorAudio();

const $ = (s) => document.querySelector(s);
const R2D = 180 / Math.PI;
const CLAVE = "mcanimator.proyecto.v2";
const MIS_POSES = "mcanimator.misposes.v1";
const CATALOGO = "mcanimator.personajes.v1";

// LTezla (la skin del Simulador Vida): ojos 2x2 con el iris rojo por dentro, sin boca
const ROSTRO_LTEZLA = { ...configPorDefecto(), version: 4, estilo: "cuadrado", cejas: true, pestanas: false, miradaBase: [0, 0],
  ojos: [{ x: 1, y: 4, w: 2, h: 2 }, { x: 5, y: 4, w: 2, h: 2 }], boca: { x: 3, y: 6, w: 2, h: 1 },
  borrar: [{ x: 1, y: 6, w: 1, h: 1 }, { x: 6, y: 6, w: 1, h: 1 }] };       // marcas rojas de la skin bajo los ojos
const PELO_BASE = { fisica: true, largo: 1 };
const EFECTOS_BASE = { calidad: "cine", ao: true, dof: 0, grano: 0, aberracion: 0, vineta: 0, saturacion: 1.15, suavidad: 0.2 };

function proyectoNuevo(personaje) {
  return {
    version: 2, nombre: "Mi animación", personaje: structuredClone(personaje),
    escena: { fondo: "transparente", color: "#1d2030", sombras: true, marco: "ninguno", terreno: "colinas", cielo: "#9cc9f5", actor: { x: 0, y: 0, z: 0, rot: 0 } },
    efectos: { ...EFECTOS_BASE }, mundo: null,
    ajustes: { stop: 0, vida: true, parpadeo: true, bucle: true, formato: "1080x1080", dinamica: true },
    pistas: { audio: [], ...PLANTILLAS.saludo.crear() },
  };
}

// proyectos de la versión 1 (skin suelta) → personaje del catálogo
function migrar(p) {
  if (!p.personaje) {
    p.personaje = { id: "ltezla", nombre: "LTezla", skin: p.skin, delgado: !!p.delgado, rostro: p.rostro || structuredClone(ROSTRO_LTEZLA) };
    delete p.skin; delete p.delgado; delete p.rostro;
  }
  const r = p.personaje.rostro;
  if (!ESTILOS[r.estilo] || r.estilo === "detalle") r.estilo = "suave";
  r.delineado ??= true;
  p.escena = { terreno: "colinas", cielo: "#9cc9f5", actor: { x: 0, y: 0, z: 0, rot: 0 }, ...p.escena };
  p.efectos = { ...EFECTOS_BASE, ...p.efectos };
  p.mundo ??= null;
  p.pistas.audio ??= [];
  p.pistas.escenas ??= [];
  p.pistas.textos ??= [];
  p.ajustes.dinamica ??= true;
  p.escena.texturas ??= "minecraft";
  p.version = 2;
  return p;
}

const app = {
  proy: null, t: 0, reproduciendo: false, sel: null, posando: false, juntaSel: null, exportando: false,
  historia: [], futuro: [], construir: false, moverPj: false,
};
window.animador = app;     // para depurar desde la consola

const escena = new Escena($("#lienzo"));
const estudio = new Estudio();
const estudioRetratos = new Estudio();
const rostro = new Rostro();
const miniRostro = new Rostro();
let personaje = null, skinCanvas = null, cara8 = null, skinCargada = "", mundoCargado = null;
let miniCaras = new Map();
window.escena3d = escena;

// ───────────── catálogo de personajes ─────────────
function catalogo() { try { return JSON.parse(localStorage.getItem(CATALOGO)) || {}; } catch { return {}; } }
function guardarCatalogo(c) { try { localStorage.setItem(CATALOGO, JSON.stringify(c)); } catch { toast("No hay espacio para guardar el catálogo"); } }
function guardarEnCatalogo(pj) { const c = catalogo(); c[pj.id] = structuredClone(pj); guardarCatalogo(c); retratos.delete(pj.id); }

// ───────────── carga de skin y personaje ─────────────
const cargarImagen = (src) => new Promise((ok, mal) => { const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => ok(i); i.onerror = mal; i.src = src; });

async function reconstruir() {
  const pj = app.proy.personaje;
  if (pj.skin !== skinCargada) {
    skinCanvas = normalizarSkin(await cargarImagen(pj.skin));
    cara8 = caraDeSkin(skinCanvas);
    skinCargada = pj.skin;
  }
  const r = pj.rostro;
  rostro.configurar(cara8, r);
  miniRostro.configurar(cara8, r);
  miniCaras = new Map();
  let capa = null;                                   // capa de Minecraft (pj.capa = ruta de una textura de 64×32)
  if (pj.capa) { try { capa = await cargarImagen(pj.capa); } catch { console.warn("capa:", pj.capa); } }
  escena.ponerPersonaje(personaje = crearPersonaje(skinCanvas, rostro.textura, { delgado: pj.delgado, ojosRects: [...r.ojos, r.boca, ...(r.borrar || [])], pelo: pj.pelo || PELO_BASE, capa }));
  estudio.preparar(skinCanvas, cara8, r, pj.delgado, pj.pelo || PELO_BASE);
  $("#pj-nombre").textContent = pj.nombre;
  $("#pj-retrato").src = await retrato(pj);
  if (app.posando && app.juntaSel) escena.gizmo.attach(personaje.juntas[app.juntaSel]);
  linea.render();
  renderInspector();
}

const retratos = new Map();
async function retrato(pj) {
  const clave = pj.id + "|" + pj.skin.length + "|" + JSON.stringify(pj.rostro) + pj.delgado;
  if (retratos.get(pj.id)?.clave === clave) return retratos.get(pj.id).url;
  const sk = normalizarSkin(await cargarImagen(pj.skin));
  const url = estudioRetratos.retrato(sk, caraDeSkin(sk), pj.rostro, pj.delgado);
  retratos.set(pj.id, { clave, url });
  return url;
}

// mundo de bloques: cargar el guardado o generar el terreno elegido
function asegurarMundo() {
  const p = app.proy;
  if (p.escena.fondo !== "mundo") return;
  if (p.mundo && p.mundo.ids === mundoCargado) return;
  if (p.mundo && escena.mundo.cargar(p.mundo)) { mundoCargado = p.mundo.ids; return; }
  escena.mundo.generar(p.escena.terreno || "colinas");
  p.mundo = escena.mundo.serializar(); mundoCargado = p.mundo.ids;
}

export function miniCara(nombre) {
  if (!miniRostro.cara8) return "";
  if (!miniCaras.has(nombre)) miniCaras.set(nombre, miniRostro.miniatura(nombre, 64));
  return miniCaras.get(nombre);
}
const clavePose = (pose) => (pose.id && !pose.editada ? pose.id : JSON.stringify([pose.r, pose.p]));
const miniPose = (pose) => estudio.miniatura(clavePose(pose), pose);

// ───────────── historia y guardado ─────────────
app.commit = (opts = {}) => {
  const s = JSON.stringify(app.proy);
  if (app.historia[app.historia.length - 1] !== s) { app.historia.push(s); if (app.historia.length > 120) app.historia.shift(); app.futuro = []; }
  try { localStorage.setItem(CLAVE, s); } catch { /* sin espacio o modo privado: seguimos sin autoguardado */ }
  app.proyectos?.alCambiar();                                // autoguardado en proyectos/<id>.json
  linea.render();
  if (opts.inspector !== false) renderInspector();
  actualizarTiempo();
};
function restaurar(s) {
  app.proy = JSON.parse(s);
  if (app.sel && !buscarClip(app.sel)) app.sel = null;
  sincronizarPaneles();
  reconstruir();
  try { localStorage.setItem(CLAVE, s); } catch { /* idem */ }
}
function deshacer() { if (app.historia.length > 1) { app.futuro.push(app.historia.pop()); restaurar(app.historia[app.historia.length - 1]); } }
function rehacer() { const s = app.futuro.pop(); if (s) { app.historia.push(s); restaurar(s); } }

function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.classList.add("ver");
  clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove("ver"), 2200);
}

// ───────────── tiempo y reproducción ─────────────
app.irA = (t) => {
  app.t = Math.min(t, duracion(app.proy)); linea.cabezal(); actualizarTiempo();
  if (app.reproduciendo) { clearTimeout(app._resinc); app._resinc = setTimeout(() => audio.reproducir(app.proy.pistas.audio, app.t), 60); }
};
app.alCambiarTiempo = () => actualizarTiempo();
function actualizarTiempo() {
  $("#t-actual").textContent = app.t.toFixed(2);
  $("#t-total").textContent = duracion(app.proy).toFixed(1);
}
function reproducir(si = !app.reproduciendo) {
  app.reproduciendo = si;
  if (si && app.posando) alternarPosar(false);
  if (si && app.t >= duracion(app.proy) - 0.01) app.t = 0;
  $("#b-play").innerHTML = ico(si ? "pause" : "play");
  if (si) audio.reproducir(app.proy.pistas.audio, app.t); else audio.detener();
}

function buscarClip(sel) { return sel && app.proy.pistas[sel.pista]?.find(c => c.id === sel.id); }
app.seleccionar = (sel) => {
  const cambio = app.sel?.id !== sel?.id;
  app.sel = sel;
  if (app.posando && sel?.pista === "poses") irAPose(buscarClip(sel));
  if (app.posando && sel?.pista !== "poses") alternarPosar(false);
  if (cambio) { linea.render(); renderInspector(); }
};
app.etiqueta = (pista, c) => {
  if (pista === "poses") return { texto: poseDe(c).nombre, img: null };
  if (pista === "ojos") return { texto: EXPRESIONES[c.cara]?.nombre || c.cara, img: miniCara(c.cara) };
  if (pista === "matices") return { texto: MATICES[c.tipo]?.nombre || c.tipo };
  if (pista === "audio") return { texto: (c.texto || "").replace(/\[[^\]]*\]\s*/g, ""), icono: c.tipo === "voz" ? "mic" : c.tipo === "musica" ? "music" : "volume" };
  if (pista === "escenas") return { texto: c.nombre || (c.negro ? "Negro" : (ESCENARIOS[c.set]?.nombre || "Mundo del proyecto") + " · " + (AMBIENTES[c.ambiente]?.nombre || "")) };
  if (pista === "textos") return { texto: (c.texto || "").replace(/\n/g, " "), icono: "type" };
  return { texto: CAMARAS[c.tipo]?.nombre || c.tipo };
};

const linea = new Linea(app);

// ───────────── bucle ─────────────
let ultimo = performance.now();
let ultimaToma = -1;
function aplicarToma(t) {
  const p = app.proy, toma = tomaEn(p, t);
  escena.sincronizarEdiciones(p.ediciones || null);
  if (toma) {
    const c = toma.clip;
    escena.usarSet(c.set || null);
    escena.usarFondo(c.fondo || null, c.fondoCfg || {});
    // más allá del borde del escenario: pasto y bosque (true) o mar abierto ("agua", para mundos reales con costa)
    escena.usarSueloLejos(c.sueloInfinito || null);
    escena.ambiente(c.ambiente || null, c.cielo || null);
    escena.cielo.lunaToma = c.luna || null;
    if (c.nubes != null) escena.cielo.nubes.visible = !!c.nubes;           // nubes por toma (también de noche)
    else escena.cielo.nubes.visible = !!escena.amb?.nubes;
    // sol por toma (de dónde viene la luz): en el original muchas fachadas quedan a la sombra, con luz de cielo lila
    if (c.sol) { escena.dirSol.set(...c.sol).normalize(); } else if (escena.amb) escena.dirSol.set(...escena.amb.sol[2]).normalize();
    // niebla por toma (para ver montañas lejanas) o la del ambiente
    const nb = c.niebla || escena.amb?.niebla;
    if (nb && escena.scene.fog) { if (c.niebla?.[0]) escena.scene.fog.color.set(c.niebla[0]); else if (escena.amb) escena.scene.fog.color.set(escena.amb.niebla[0]); escena.scene.fog.near = nb[1]; escena.scene.fog.far = nb[2]; }
    // distancia de dibujo por toma (`lejos`, bloques): por defecto 900; la ciudad de bloques del can-can necesita más
    const lejos = c.lejos || 900;
    if (escena.camara.far !== lejos) { escena.camara.far = lejos; escena.camara.near = Math.max(0.05, lejos / 18000); escena.camara.updateProjectionMatrix(); }
    escena.ancla = toma.ancla;
    escena.colocarActor(toma.actor);
    // cámara lenta / congelar (campo `tiempo`): los mobs y los efectos van en tiempo simulado; cámara y LTezla, en real
    const tauSim = tiempoSim(c.tiempo, toma.tau);
    escena.mobs.actualizar(c.mobs, tauSim, toma.ancla, escena.sets[c.set] || null, c.dur, c.set || "");
    escena.fx.actualizar(c.efectos, tauSim, toma.ancla, toma.tau);
    escena.brilloToma = c.brillo ?? 1;
    escena.grupoActor.visible = !c.ocultar;
    escena.usarAntorchas(c.antorchas, toma.ancla, escena.sets[c.set] || null, toma.tau);
    escena.dofToma = c.dof ?? 1;
    // etalonaje por toma (medido con analisis_tomas.py contra el original): exposición, saturación y calidez
    escena.ajusteToma = { exp: c.exp ?? 1, sat: c.sat ?? 1, cal: c.calidez ?? 0 };
  } else if (ultimaToma !== -1) {
    escena.grupoActor.visible = true;
    escena.usarSet(null); escena.usarFondo(null); escena.ambiente(null);
    escena.colocarActor(p.escena.actor || { x: 0, y: 0, z: 0, rot: 0 });
    escena.mobs.actualizar([], 0, escena.actor);
    escena.fx.actualizar(null); escena.brilloToma = 1;
    escena.usarAntorchas(null);
    escena.dofToma = 1; escena.ajusteToma = null;
  }
  if (!toma) escena.ancla = escena.actor;
  const corte = !!toma && toma.i !== ultimaToma;
  ultimaToma = toma ? toma.i : -1;
  return { toma, corte };
}
// objeto en la mano derecha (campo `objeto` de la toma: el cuerno de cabra del jinete, o cualquier objeto de la biblioteca:
// "diamond_sword", "apple", "oak_planks"…). Ítem 3D como en el juego (js/objetos.js): un cubito por pixel opaco de su
// textura, o un cubo si es un bloque, pegado al antebrazo
function ponerObjeto(nombre) {
  const brazo = personaje?.juntas?.munecaD; if (!brazo) return;         // en el puño (la muñeca gira la espada)
  const actual = brazo.userData.objeto;
  if (actual && actual.userData.nombre !== nombre) { brazo.remove(actual); brazo.userData.objeto = null; }
  if (!nombre || brazo.userData.objeto) return;
  const o = objetoListo(nombre); if (!o) return;
  const g = o.clone(); g.userData = { ...o.userData, nombre };
  const bloque = o.userData.forma === "bloque", herramienta = o.userData.mano === "herramienta";
  g.scale.setScalar(bloque ? 0.3 : herramienta ? 0.85 : 0.62);           // 0.85 = escala de Minecraft en tercera persona
  // la muñeca está en el centro del puño; los objetos planos y los bloques quedan donde siempre (el cuerno del tráiler)
  const dx = -brazo.position.x;
  g.position.set(dx, bloque ? -5 : -4, 1.5); g.rotation.set(bloque ? 0 : -Math.PI / 2.4, bloque ? Math.PI / 4 : Math.PI / 2, 0);   // en el puño, apuntando hacia adelante
  // espadas, picos, hachas: empuñadura (abajo a la izquierda de la textura) en el puño y la hoja hacia adelante y arriba
  // el mango (pixel ≈ (3, 12) de la textura, justo bajo la guarda) queda DENTRO del puño: la espada sale de la mano como en el juego
  if (herramienta) { g.position.set(0, 0, 0); g.children[0].position.set(4.5, 4.5, 0); g.rotation.set(Math.PI / 12, -Math.PI / 2, 0); }
  brazo.add(g); brazo.userData.objeto = g;
}
function cuadro(t) {
  const p = app.proy;
  const { toma, corte } = aplicarToma(t);
  ponerObjeto(toma?.clip.objeto || null);
  if (toma && toma.negro >= 0.999) {
    escena.renderer.setClearColor(0x000000, 1); escena.renderer.clear();
    escena.titulos.poner(textosEn(p, t), escena.camara); escena.titulos.dibujar(escena.renderer, escena.camara);     // tarjeta final
    return;
  }
  let ev;
  const clip = app.posando && buscarClip(app.sel);
  if (clip && app.sel.pista === "poses") {
    ev = evaluar({ ...p, pistas: { ...p.pistas, poses: [{ ...clip, trans: 0 }] } }, 0, { sinMatices: true });
    const evOjos = evaluar(p, t);
    ev.ojos = evOjos.ojos; ev.cam = evOjos.cam;
  } else ev = evaluar(p, t);
  aplicar(personaje, ev);
  // desplazamiento del cuerpo en el mundo (para tomas que siguen al personaje)
  const a = escena.actor, rot = (a.rot || 0) * Math.PI / 180;
  const px = ev.pos.x / 16, pz = ev.pos.z / 16;
  const ofs = { x: px * Math.cos(rot) + pz * Math.sin(rot), y: ev.pos.y / 16, z: -px * Math.sin(rot) + pz * Math.cos(rot) };
  if (!app.posando) mirarCamara(ev, ofs);
  rostro.dibujar(ev.ojos);
  personaje.grupo.updateMatrixWorld(true);
  // foco: la cara de LTezla; si está oculto en la toma, el mob protagonista (antes enfocaba su cabeza invisible)
  let cabeza = new THREE.Vector3(0, 4.5, 4).applyMatrix4(personaje.juntas.cabeza.matrixWorld);
  if (toma && (toma.clip.ocultar || toma.clip.focoMob) && escena.mobs.puntoFoco) cabeza = escena.mobs.puntoFoco.clone();
  escena.render(ev.cam, { ofs, cabeza, t, corte, textos: textosEn(p, t) });
}

// ───────────── capa 2D: fundidos a negro y títulos (igual en la vista previa y en el video) ─────────────
const FUENTE_TITULO = `"Jersey 10", Silkscreen, "Pixelify Sans", monospace`;      // gruesa y condensada, como la del original
const salidaSuave = (k) => 1 - (1 - k) ** 3;
function dibujarCapa(ctx, w, h, t) {
  const p = app.proy;
  const toma = tomaEn(p, t);
  // en una toma negra el render ya limpió a negro y los títulos 3D van encima: no taparlos
  // (solo en las tarjetas negras: en un fundido a negro sí hay que tapar, si no el primer cuadro salía con destello)
  if (toma && toma.negro > 0.001 && !(toma.clip.negro && escena.titulos.fuente)) { ctx.save(); ctx.globalAlpha = Math.min(1, toma.negro); ctx.fillStyle = "#000"; ctx.fillRect(0, 0, w, h); ctx.restore(); }
  if (!escena.titulos.fuente) for (const x of textosEn(p, t)) dibujarTitulo(ctx, w, h, x);     // con Minecraft Ten van en 3D (titulos3d.js)
  else for (const x of textosEn(p, t)) if (x.halo) {          // resplandor detrás del título (el rojo de la tarjeta final)
    const f = x.fundido || {};
    let a = 1;
    if (f.entra) a = Math.min(a, x.tau / f.entra);
    if (f.sale) a = Math.min(a, (x.dur - x.tau) / f.sale);
    if (a <= 0) continue;
    const g = ctx.createRadialGradient(x.x * w, x.y * h, 0, x.x * w, x.y * h, h * 0.46);
    g.addColorStop(0, x.halo); g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.45 * Math.min(1, a); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); ctx.restore();
  }
}
function dibujarTitulo(ctx, w, h, x) {
  const u = h / 100, tam = (x.tam ?? 13) * u;
  const f = x.fundido || {};
  let a = 1;
  if (f.entra) a = Math.min(a, x.tau / f.entra);
  if (f.sale) a = Math.min(a, (x.dur - x.tau) / f.sale);
  if (a <= 0) return;
  const k = salidaSuave(Math.min(1, x.tau / (x.entrada ?? 0.14)));
  const esc = x.anim === "golpe" ? 1 + (1 - k) * 0.35 : 1;
  // los títulos del original "flotan" con la cámara: deriva lenta de unos pocos pixeles
  const dx = Math.sin(x.tau * 1.3 + (x.inicio || 0)) * u * 0.35 * (x.deriva ?? 1), dy = Math.cos(x.tau * 1.1) * u * 0.25 * (x.deriva ?? 1);
  const cx = (x.x ?? 0.5) * w + dx, cy = (x.y ?? 0.5) * h + dy;
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, a));
  ctx.translate(cx, cy); ctx.scale(esc, esc);
  const lineas = String(x.texto || "").split("\n"), alto = tam * (x.interlinea ?? 0.92);
  ctx.font = `${x.peso ?? 400} ${tam}px ${FUENTE_TITULO}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  if (x.caja) {                                          // etiqueta con fondo (tarjeta final)
    const anchoT = Math.max(...lineas.map(l => ctx.measureText(l).width)) + tam * 0.7, altoT = alto * lineas.length + tam * 0.25;
    ctx.save(); ctx.shadowColor = x.caja; ctx.shadowBlur = tam * 1.4; ctx.fillStyle = x.caja;
    ctx.fillRect(-anchoT / 2, -altoT / 2, anchoT, altoT); ctx.restore();
    ctx.fillStyle = x.cajaSombra || "rgba(0,0,0,.35)"; ctx.fillRect(-anchoT / 2, altoT / 2 - tam * 0.12, anchoT, tam * 0.12);
  }
  lineas.forEach((l, i) => {
    const y = (i - (lineas.length - 1) / 2) * alto;
    const prof = Math.round(tam * (x.relieve ?? 0.07));            // relieve 3D hacia abajo-derecha
    ctx.fillStyle = x.sombra || "#14361a";
    for (let k2 = prof; k2 >= 1; k2--) ctx.fillText(l, k2 * 0.6, y + k2);
    if (x.borde) { ctx.lineWidth = tam * 0.07; ctx.strokeStyle = x.borde; ctx.lineJoin = "round"; ctx.strokeText(l, 0, y); }
    const g = ctx.createLinearGradient(0, y - tam / 2, 0, y + tam / 2);
    g.addColorStop(0, x.color2 || x.color || "#fff"); g.addColorStop(1, x.color || "#fff");
    ctx.fillStyle = g; ctx.fillText(l, 0, y);
  });
  ctx.restore();
}
const capa = $("#capa"), capaCtx = capa.getContext("2d");
function pintarCapa() {
  const w = capa.clientWidth, h = capa.clientHeight, d = Math.min(devicePixelRatio, 2);
  if (capa.width !== Math.round(w * d) || capa.height !== Math.round(h * d)) { capa.width = Math.round(w * d); capa.height = Math.round(h * d); }
  capaCtx.clearRect(0, 0, capa.width, capa.height);
  capa.style.display = app.exportando ? "none" : "";
  dibujarCapa(capaCtx, capa.width, capa.height, app.t);
}

// La cabeza gira una parte hacia el lente y los ojos el resto: así "ve" exactamente a la cámara.
const _cam = new THREE.Object3D();
function mirarCamara(ev, ofs) {
  const w = ev.ojos.aCamara || 0;
  if (w < 0.01) return;
  let camPos;
  if (escena.vistaCamara && ev.cam) { posicionCamara(_cam, ev.cam, escena.baseCamara(ev.cam, ofs)); camPos = _cam.position; }
  else camPos = escena.camara.position;
  personaje.grupo.updateMatrixWorld(true);
  const cab = personaje.juntas.cabeza;
  const local = camPos.clone().applyMatrix4(cab.matrixWorld.clone().invert()).sub(new THREE.Vector3(0, 4.5, 4));
  const yaw = Math.atan2(local.x, local.z), pitch = Math.atan2(local.y, Math.hypot(local.x, local.z));
  if (Math.abs(yaw) > 1.6) return;                       // la cámara quedó atrás: no forzar el cuello
  const lim = (v, m) => Math.max(-m, Math.min(m, v));
  const hy = lim(yaw * 0.55, 0.5) * w, hp = lim(pitch * 0.5, 0.35) * w;
  cab.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-hp, hy, 0, "YXZ")));
  const ry = yaw - hy, rp = pitch - hp;
  ev.ojos.mx = ev.ojos.mx * (1 - w) + lim(ry / 0.42, 1) * w;
  ev.ojos.my = ev.ojos.my * (1 - w) + lim(rp / 0.35, 1) * w;
}
// cuadro de prueba guardado en Videos/<nombre> (empieza con "_p_" para borrarlo después): await animador.guardarCuadro(3.5, "_p_3.5.png", 0.5)
app.guardarCuadro = async (t, nombre, escala = 0.5) => {
  const url = await app.foto(t, escala), b = Uint8Array.from(atob(url.split(",")[1]), c => c.charCodeAt(0));
  return (await fetch("/guardar?nombre=" + encodeURIComponent(nombre), { method: "POST", body: b })).text();
};
// varios tiempos de una vez: await animador.guardarCuadros([1.4, 2.3]) → _p_1.4.png, _p_2.3.png
app.guardarCuadros = async (ts, escala = 0.5) => { for (const t of ts) await app.guardarCuadro(Number(t), `_p_${t}.png`, escala); return ts.length; };
// física de los mobs en todo el tráiler: lista de mobs metidos en bloques, flotando o hundidos (await animador.revisarFisica())
app.revisarFisica = async (paso = 0.1) => {
  await escena.mobs.precargar(app.proy.pistas.escenas);
  const malos = [], total = duracion(app.proy);
  for (let t = 0; t < total; t += paso) {
    const { toma } = aplicarToma(t);
    if (!toma?.clip.set) continue;
    for (const m of escena.mobs.revisar(escena.sets[toma.clip.set])) malos.push({ t: +t.toFixed(2), toma: toma.i + 1, ...m });
  }
  return malos;
};
// dibuja el cuadro t a tamaño de exportación (× escala) y llama fn(lienzo, W, H) con la cámara y los mobs de ese momento
async function conCuadro(t, escala, fn) {
  await escena.mobs.precargar(app.proy.pistas.escenas);
  const [W0, H0] = dims(), W = Math.round(W0 * escala), H = Math.round(H0 * escala);
  app.exportando = true;
  const antes = escena.vistaCamara;
  if (app.proy.pistas.camara.length) escena.usarVistaCamara(true);
  escena.renderer.setPixelRatio(1); escena.tamano(W, H);
  const out = document.createElement("canvas"); out.width = W; out.height = H;
  try {
    app.tExport = t; escena.tiempoEfecto = t; cuadro(t); componer(out.getContext("2d"), W, H);
    return await fn(out, W, H);
  } finally {
    app.exportando = false; escena.tiempoEfecto = undefined; escena.usarVistaCamara(antes); ajustarLienzo();
  }
}
// para revisar cuadros desde la consola: await animador.foto(3.5) → dataURL a tamaño de exportación
app.foto = (t, escala = 1) => conCuadro(t, escala, (out) => out.toDataURL("image/jpeg", 0.9));

function bucle(ahora) {
  const dt = Math.min(0.1, (ahora - ultimo) / 1000); ultimo = ahora;
  if (!app.exportando && personaje) {
    if (app.reproduciendo) {
      const total = duracion(app.proy);
      app.t += dt;
      if (app.t >= total) {
        if (app.proy.ajustes.bucle) { app.t %= total; audio.reproducir(app.proy.pistas.audio, app.t); }
        else { app.t = total; reproducir(false); }
      }
      linea.cabezal(); actualizarTiempo();
    }
    cuadro(app.t);
    pintarCapa();
  }
  requestAnimationFrame(bucle);
}

// ───────────── tamaño del lienzo según formato ─────────────
const dims = () => app.proy.ajustes.formato.split("x").map(Number);
function ajustarLienzo() {
  if (!app.proy) return;                                    // al arrancar, antes de cargar el proyecto
  const caja = $("#lienzo-caja"), marco = $("#lienzo-marco");
  const [W, H] = dims();
  const aw = caja.clientWidth - 24, ah = caja.clientHeight - 32;
  const k = Math.min(aw / W, ah / H);
  const w = Math.max(50, Math.floor(W * k)), h = Math.max(50, Math.floor(H * k));
  marco.style.width = w + "px"; marco.style.height = h + "px";
  escena.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  escena.tamano(w, h);
  linea.render();
}
new ResizeObserver(ajustarLienzo).observe($("#lienzo-caja"));

// ───────────── panel izquierdo ─────────────
function sincronizarPaneles() {
  const p = app.proy, e = p.escena, f = p.efectos;
  $("#nombre-proy").value = p.nombre;
  $("#s-fondo").value = e.fondo;
  $("#i-color").value = e.color;
  $("#campo-color").style.display = e.fondo === "color" ? "" : "none";
  $("#campo-mundo").style.display = e.fondo === "mundo" ? "" : "none";
  $("#s-terreno").value = e.terreno || "colinas";
  $("#i-cielo").value = e.cielo || "#9cc9f5";
  $("#c-sombras").checked = e.sombras;
  $("#s-marco").value = e.marco;
  $("#s-calidad").value = f.calidad;
  $("#c-ao").checked = f.ao;
  for (const k of ["dof", "grano", "aberracion", "vineta", "saturacion", "suavidad"]) $("#r-" + k).value = f[k];
  $("#c-vida").checked = p.ajustes.vida;
  $("#c-dinamica").checked = p.ajustes.dinamica !== false;
  $("#s-texturas").value = e.texturas || "minecraft";
  $("#c-parpadeo").checked = p.ajustes.parpadeo;
  $("#s-stop").value = String(p.ajustes.stop);
  $("#c-bucle").checked = p.ajustes.bucle;
  $("#s-formato").value = p.ajustes.formato;
  document.body.dataset.marco = e.marco;
  if (e.fondo !== "mundo" && app.construir) alternarConstruir(false);
  asegurarMundo();
  escena.colocarActor(e.actor || { x: 0, y: 0, z: 0, rot: 0 });
  escena.fondo(e);
  escena.efectos(f);
  ajustarLienzo();
}

function enlazar(sel, ev, fn) { $(sel).addEventListener(ev, (e) => { fn(e.target); app.commit({ inspector: false }); }); }
enlazar("#nombre-proy", "change", (el) => app.proy.nombre = el.value || "Mi animación");
enlazar("#s-fondo", "change", (el) => { app.proy.escena.fondo = el.value; sincronizarPaneles(); });
enlazar("#i-color", "input", (el) => { app.proy.escena.color = el.value; escena.fondo(app.proy.escena); });
enlazar("#i-cielo", "input", (el) => { app.proy.escena.cielo = el.value; escena.fondo(app.proy.escena); });
enlazar("#s-terreno", "change", (el) => { app.proy.escena.terreno = el.value; });
enlazar("#c-sombras", "change", (el) => { app.proy.escena.sombras = el.checked; escena.fondo(app.proy.escena); });
enlazar("#s-marco", "change", (el) => { app.proy.escena.marco = el.value; document.body.dataset.marco = el.value; });
enlazar("#s-calidad", "change", (el) => { app.proy.efectos.calidad = el.value; escena.efectos(app.proy.efectos); });
enlazar("#c-ao", "change", (el) => { app.proy.efectos.ao = el.checked; escena.efectos(app.proy.efectos); });
for (const k of ["dof", "grano", "aberracion", "vineta", "saturacion", "suavidad"]) {
  $("#r-" + k).addEventListener("input", (e) => { app.proy.efectos[k] = Number(e.target.value); escena.efectos(app.proy.efectos); });
  $("#r-" + k).addEventListener("change", () => app.commit({ inspector: false }));
}
enlazar("#c-vida", "change", (el) => app.proy.ajustes.vida = el.checked);
enlazar("#c-dinamica", "change", (el) => app.proy.ajustes.dinamica = el.checked);
enlazar("#s-texturas", "change", (el) => { app.proy.escena.texturas = el.value; aplicarTexturas(); });
$("#b-importar-tex").onclick = async () => {
  toast("Copiando texturas de tu Minecraft…");
  try {
    const j = await (await fetch("/api/texturas", { method: "POST" })).json();
    if (!j.ok) throw new Error(j.error);
    delete texturasCargadas.minecraft; delete texturasCargadas.barebones; texturasUsadas = undefined; app.proy.escena.texturas = "minecraft"; $("#s-texturas").value = "minecraft";
    await aplicarTexturas(); app.commit({ inspector: false });
    toast(`Texturas de Minecraft ${j.version} listas (${j.texturas.length})`);
  } catch (e) { toast("No pude copiar las texturas: " + e.message); }
};

// texturas reales de tu Minecraft (texturas_mc/), si ya se importaron; "barebones" = el pack Bare Bones (texturas_mc/packs,
// lo copia herramientas/packs.py): lo que no tenga se toma de tu .jar
const texturasCargadas = {};
let texturasUsadas = null;
async function cargarJuego(tipo) {
  if (texturasCargadas[tipo] !== undefined) return texturasCargadas[tipo];
  try {
    const ind = await (await fetch("texturas_mc/indice.json")).json();
    const bb = tipo === "barebones" ? await fetch("texturas_mc/packs/indice.json").then(r => r.ok ? r.json() : null).catch(() => null) : null;
    const imgs = {};
    await Promise.all(ARCHIVOS_REALES.map(async n => {
      if (bb) { try { imgs[n] = await cargarImagen(`texturas_mc/packs/barebones/block/${n}.png`); return; } catch { /* sigue con el .jar */ } }
      if (ind.texturas.includes(n)) imgs[n] = await cargarImagen(`texturas_mc/block/${n}.png`);
    }));
    texturasCargadas[tipo] = imgs;
  } catch { texturasCargadas[tipo] = false; }
  return texturasCargadas[tipo];
}
async function aplicarTexturas() {
  const tipo = app.proy.escena.texturas || "minecraft";
  const usar = tipo === "generadas" ? null : (await cargarJuego(tipo)) || null;
  escena.packTexturas = tipo;
  if (usar === texturasUsadas) { escena.reales = usar; return; }
  texturasUsadas = usar;
  escena.mundo.usarTexturas(usar);
  escena.texturasSets(usar);
  if (app.construir) armarPaleta();
}
enlazar("#c-parpadeo", "change", (el) => app.proy.ajustes.parpadeo = el.checked);
enlazar("#s-stop", "change", (el) => app.proy.ajustes.stop = Number(el.value));
enlazar("#c-bucle", "change", (el) => app.proy.ajustes.bucle = el.checked);
enlazar("#s-formato", "change", (el) => { app.proy.ajustes.formato = el.value; ajustarLienzo(); });

$("#b-generar").onclick = () => {
  const p = app.proy;
  escena.mundo.generar(p.escena.terreno || "colinas");
  p.mundo = escena.mundo.serializar(); mundoCargado = p.mundo.ids;
  p.escena.actor = { x: 0.5, y: 0, z: 0.5, rot: p.escena.actor?.rot || 0 };
  escena.colocarActor(p.escena.actor); escena.fondo(p.escena);
  app.commit({ inspector: false });
  toast("Terreno generado");
};

// ───────────── catálogo de personajes ─────────────
async function leerSkin(fuente) {
  const img = await cargarImagen(fuente);
  if (img.width !== img.height && img.width !== img.height * 2) throw new Error("Esa imagen no parece una skin (64×64 o 64×32)");
  return normalizarSkin(img);
}
async function nuevoPersonaje(nombre, fuente) {
  try {
    const sk = await leerSkin(fuente);
    const ojos = detectarOjos(caraDeSkin(sk));
    const pj = { id: "pj_" + Date.now().toString(36), nombre: nombre || "Jugador", skin: sk.toDataURL(), delgado: false,
      rostro: { ...configPorDefecto(), ...(ojos ? { ojos } : {}) } };
    guardarEnCatalogo(pj);
    await usarPersonaje(pj.id);
    $("#m-catalogo").close();
    toast(ojos ? `${pj.nombre} agregado. Revisa dónde quedaron los ojos` : `${pj.nombre} agregado. Marca dónde están los ojos`);
    abrirEditorOjos();
  } catch (e) { toast(e.message || "No pude leer esa skin"); }
}
async function usarPersonaje(id) {
  const pj = catalogo()[id];
  if (!pj) return;
  app.proy.personaje = structuredClone(pj);
  await reconstruir();
  app.commit();
}
async function abrirCatalogo() {
  const rej = $("#catalogo-rejilla"); rej.innerHTML = "";
  const c = catalogo(), actual = app.proy.personaje.id;
  for (const pj of Object.values(c)) {
    const img = h("img", { alt: "" });
    const parar = (fn) => (e) => { e.stopPropagation(); fn(); };
    const celda = h("div", { class: "celda pj-celda" + (pj.id === actual ? " activo" : "") }, img, h("b", {}, pj.nombre),
      h("div", { class: "pj-acc" },
        h("button", { html: ico("eye"), onclick: parar(async () => { await usarPersonaje(pj.id); $("#m-catalogo").close(); abrirEditorOjos(); }) }, "Cara"),
        h("button", { onclick: parar(() => renombrarPj(pj)) }, "Renombrar"),
        h("button", { onclick: parar(() => quitarPj(pj)) }, "Quitar")));
    celda.onclick = async () => { await usarPersonaje(pj.id); $("#m-catalogo").close(); toast(`Ahora animas a ${pj.nombre}`); };
    rej.append(celda);
    retrato(pj).then(u => img.src = u);
  }
  if (!$("#m-catalogo").open) $("#m-catalogo").showModal();
}
function renombrarPj(pj) {
  const n = prompt("Nombre:", pj.nombre);
  if (!n) return;
  const cc = catalogo(); cc[pj.id].nombre = n; guardarCatalogo(cc);
  if (app.proy.personaje.id === pj.id) { app.proy.personaje.nombre = n; $("#pj-nombre").textContent = n; app.commit({ inspector: false }); }
  abrirCatalogo();
}
function quitarPj(pj) {
  if (Object.keys(catalogo()).length <= 1) return toast("Deja al menos un personaje");
  if (!confirm(`¿Quitar a ${pj.nombre} del catálogo?`)) return;
  const cc = catalogo(); delete cc[pj.id]; guardarCatalogo(cc);
  abrirCatalogo();
}
$("#b-catalogo").onclick = abrirCatalogo;
$("#b-np-archivo").onclick = () => $("#f-np").click();
const comoDataURL = (blob) => new Promise(ok => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(blob); });
$("#f-np").onchange = async (e) => {
  const f = e.target.files[0]; e.target.value = "";
  if (!f) return;
  nuevoPersonaje($("#np-nombre").value.trim() || f.name.replace(/\.png$/i, ""), await comoDataURL(f));
};
$("#b-np-buscar").onclick = async () => {
  const n = $("#np-nombre").value.trim();
  if (!/^\w{2,16}$/.test(n)) return toast("Escribe un nombre de jugador válido (2-16 letras, números o _)");
  toast("Buscando la skin de " + n + "…");
  try {
    const r = await fetch(`https://mc-heads.net/skin/${encodeURIComponent(n)}`);
    if (!r.ok) throw new Error();
    nuevoPersonaje(n, await comoDataURL(await r.blob()));
  } catch { toast("No encontré esa skin. Puedes subir el .png"); }
};
addEventListener("dragover", (e) => e.preventDefault());
addEventListener("drop", async (e) => {
  e.preventDefault();
  const f = e.dataTransfer.files[0];
  if (!f) return;
  if (/json$/i.test(f.name)) return abrirProyecto(f);
  nuevoPersonaje(f.name.replace(/\.png$/i, ""), await comoDataURL(f));
});

// plantillas
for (const [id, pl] of Object.entries(PLANTILLAS)) {
  const b = document.createElement("button");
  b.className = "plantilla" + (pl.proyecto ? " especial" : ""); b.innerHTML = `<b>${pl.nombre}</b><span>${pl.desc}</span>`;
  // las plantillas grandes (tráiler, vlog) crean un proyecto nuevo; las chicas se aplican al proyecto abierto
  b.onclick = () => pl.proyecto ? app.proyectos.nuevoConNombre(pl) : aplicarPlantilla(pl);
  $("#plantillas").appendChild(b);
}
function aplicarPlantilla(pl) {
  const p = app.proy;
  p.pistas = { audio: [], ...pl.crear() }; app.sel = null; app.t = 0;
  p.ediciones = null;                                       // los bloques editados eran del proyecto anterior
  if (pl.proyecto) {
    const o = pl.proyecto;
    p.escena = { ...p.escena, ...structuredClone(o.escena) };
    p.efectos = { ...EFECTOS_BASE, ...o.efectos };          // cada plantilla parte de los efectos base
    if (o.formato) p.ajustes.formato = o.formato;
    if (o.escena?.terreno && p.escena.fondo === "mundo") { escena.mundo.generar(o.escena.terreno); p.mundo = escena.mundo.serializar(); mundoCargado = p.mundo.ids; }
    if (o.vistaCamara && $("#b-vista-cam").getAttribute("aria-pressed") !== "true") $("#b-vista-cam").click();
    sincronizarPaneles();
    aplicarTexturas();
  }
  escena.mobs.precargar(p.pistas.escenas);
  app.commit(); toast(`Plantilla "${pl.nombre}" cargada`);
  if (p.pistas.audio.length) prepararAudio().then(() => reproducir(true)); else reproducir(true);
}
$("#b-sorpresa").onclick = () => { app.proy.pistas = { audio: [], ...sorprendeme() }; app.sel = null; app.t = 0; app.commit(); reproducir(true); };
// tema claro (por defecto) u oscuro; se recuerda en este navegador
$("#b-tema").onclick = () => {
  const t = document.documentElement.dataset.theme === "oscuro" ? "claro" : "oscuro";
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem("mcanimator.tema", t); } catch { /* modo privado */ }
};
// "Nuevo" crea otro proyecto: el actual ya quedó guardado en proyectos/
$("#b-nuevo").onclick = () => app.proyectos.nuevoConNombre();

// guardar / abrir
function descargar(blob, nombre) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = nombre; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
const nombreArchivo = () => (app.proy.nombre || "animacion").replace(/[^\w\-áéíóúñ ]+/gi, "").trim().replace(/\s+/g, "_") || "animacion";
$("#b-guardar").onclick = () => descargar(new Blob([JSON.stringify(app.proy, null, 1)], { type: "application/json" }), nombreArchivo() + ".mcanim.json");
$("#b-abrir").onclick = () => $("#f-proyecto").click();
$("#f-proyecto").onchange = (e) => { abrirProyecto(e.target.files[0]); e.target.value = ""; };
async function abrirProyecto(f) {
  try {
    const p = JSON.parse(await f.text());
    if (!p.pistas || !(p.skin || p.personaje)) throw new Error("no es un proyecto");
    await app.proyectos.crear({ proyecto: migrar(p) });     // un archivo importado entra como proyecto nuevo
  } catch { toast("No pude abrir ese archivo"); }
}

// ───────────── construir y mover al personaje ─────────────
let herrBloque = "poner", bloqueSel = B.tablones;
function armarPaleta() {
  const cont = $("#paleta-bloques"); cont.innerHTML = "";
  for (const id of PALETA) {
    const b = h("button", { title: BLOQUES[id].nombre, class: id === bloqueSel ? "activo" : "", onclick: () => { bloqueSel = id; herrBloque = "poner"; marcarHerr(); armarPaleta(); } },
      h("img", { src: iconoBloque(escena.mundo.atlas, id), alt: BLOQUES[id].nombre }));
    cont.append(b);
  }
}
function marcarHerr() { document.querySelectorAll(".paleta-herr button").forEach(b => b.classList.toggle("activo", b.dataset.herr === herrBloque)); }
document.querySelectorAll(".paleta-herr button").forEach(b => b.onclick = () => { herrBloque = b.dataset.herr; marcarHerr(); });
function alternarConstruir(si = !app.construir) {
  if (si && app.proy.escena.fondo !== "mundo") { app.proy.escena.fondo = "mundo"; sincronizarPaneles(); }
  if (si && app.posando) alternarPosar(false);
  if (si && app.moverPj) alternarMoverPj(false);
  app.construir = si;
  $("#paleta").hidden = !si;
  $("#b-construir").setAttribute("aria-pressed", si);
  document.body.dataset.construir = si ? "1" : "";
  escena.cursor.visible = false;
  if (si) { armarPaleta(); reproducir(false); if ($("#b-vista-cam").getAttribute("aria-pressed") === "true") $("#b-vista-cam").click(); }
  $("#ayuda").textContent = si ? "Clic: poner · Shift+clic: quitar · Alt+clic: gotero · arrastrar: girar la vista" : "Arrastra para girar · clic derecho para mover · rueda para acercar";
}
function alternarMoverPj(si = !app.moverPj) {
  if (si && app.construir) alternarConstruir(false);
  app.moverPj = si;
  $("#b-mover-pj").setAttribute("aria-pressed", si);
  document.body.dataset.moverpj = si ? "1" : "";
  if (si) toast(app.proy.escena.fondo === "mundo" ? "Clic en un bloque para poner ahí al personaje · Q / E para girarlo" : "Q / E para girarlo (en el mundo de bloques puedes moverlo con clic)");
}
$("#b-construir").onclick = () => alternarConstruir();
$("#b-mover-pj").onclick = () => alternarMoverPj();

function objetivoBloque(e) {
  const hit = escena.bloqueEn(e);
  if (!hit) return null;
  const [x, y, z] = hit.celda, n = hit.normal;
  const quitar = herrBloque === "quitar" || e.shiftKey;
  const gotero = herrBloque === "gotero" || e.altKey;
  if (quitar || gotero || herrBloque === "puerta") return { celda: [x, y, z], modo: gotero ? "gotero" : herrBloque === "puerta" && !quitar ? "puerta" : "quitar" };
  return { celda: [x + n.x, y + n.y, z + n.z], modo: "poner", normal: n };
}
function guardarMundo() { app.proy.mundo = escena.mundo.serializar(); mundoCargado = app.proy.mundo.ids; app.commit({ inspector: false }); }

let abajoMundo = null;
$("#lienzo").addEventListener("pointerdown", (e) => { abajoMundo = [e.clientX, e.clientY]; });
$("#lienzo").addEventListener("pointermove", (e) => {
  if (!app.construir) return;
  const o = objetivoBloque(e);
  escena.cursor.visible = !!o;
  if (o) {
    const [x, y, z] = o.celda;
    escena.cursor.position.set(x - ORIGEN.x + 0.5, y - ORIGEN.y + 0.5, z - ORIGEN.z + 0.5);
    escena.cursor.material.color.set(o.modo === "quitar" ? 0xff5566 : o.modo === "poner" ? 0xffffff : 0x22c8b4);
  }
});
$("#lienzo").addEventListener("pointerup", (e) => {
  if (!abajoMundo || Math.hypot(e.clientX - abajoMundo[0], e.clientY - abajoMundo[1]) > 4 || e.button !== 0) return;
  if (app.construir) {
    const o = objetivoBloque(e);
    if (!o) return;
    const m = escena.mundo, [x, y, z] = o.celda;
    if (o.modo === "gotero") { const id = m.get(x, y, z); if (id) { bloqueSel = id; herrBloque = "poner"; marcarHerr(); armarPaleta(); } return; }
    if (o.modo === "puerta") { if (m.alternarPuerta(x, y, z)) guardarMundo(); return; }
    if (o.modo === "quitar") { m.quitar(x, y, z); guardarMundo(); return; }
    // la puerta mira hacia la cámara
    const v = escena.camara.position.clone().sub(escena.cursor.position);
    const dir = Math.abs(v.x) > Math.abs(v.z) ? (v.x > 0 ? 3 : 1) : (v.z > 0 ? 0 : 2);
    m.poner(x, y, z, bloqueSel, dir); guardarMundo();
  } else if (app.moverPj) {
    const hit = escena.bloqueEn(e);
    if (!hit || hit.normal.y < 0.5) return;
    const [x, y, z] = hit.celda;
    app.proy.escena.actor = { ...app.proy.escena.actor, x: x - ORIGEN.x + 0.5, y: y - ORIGEN.y + 1, z: z - ORIGEN.z + 0.5 };
    escena.colocarActor(app.proy.escena.actor); escena.fondo(app.proy.escena);
    app.commit({ inspector: false });
  }
});
addEventListener("keydown", (e) => {
  if (!app.moverPj || e.target.closest?.("input, textarea, select")) return;
  const k = e.key.toLowerCase();
  if (k !== "q" && k !== "e") return;
  const a = app.proy.escena.actor;
  a.rot = ((a.rot || 0) + (k === "q" ? 15 : -15) + 360) % 360;
  escena.colocarActor(a); app.commit({ inspector: false });
});

$("#b-deshacer").onclick = deshacer;
$("#b-rehacer").onclick = rehacer;
$("#b-play").onclick = () => reproducir();
$("#b-zoom-mas").onclick = () => linea.zoom(1.25);
$("#b-zoom-menos").onclick = () => linea.zoom(0.8);

// agregar clips
document.querySelectorAll("[data-agregar]").forEach(b => b.onclick = () => agregar(b.dataset.agregar));
function agregar(pista) {
  const k = app.proy.pistas;
  let c;
  if (pista === "voz" || pista === "sfx") {
    k.audio ??= [];
    c = pista === "voz" ? clipVoz("¡Hola! ¿Cómo están?", Math.round(app.t * 20) / 20) : clipSfx("footsteps on stone", Math.round(app.t * 20) / 20, 1.2);
    k.audio.push(c);
    app.sel = { pista: "audio", id: c.id };
    app.commit();
    toast("Escribe el texto en el panel de la derecha y presiona Generar");
    return;
  }
  if (pista === "escenas") c = { id: nuevoId(), dur: 3, set: "aldea", ambiente: "dia", actor: { x: 0.5, y: 0, z: 0.5, rot: 0 }, mobs: [] };
  else if (pista === "textos") {
    k.textos ??= [];
    c = { id: nuevoId(), texto: "TÍTULO", inicio: Math.round(app.t * 20) / 20, dur: 2, color: "#5bff6a", color2: "#b6ffbe", sombra: "#14361a", tam: 13, x: 0.5, y: 0.3, anim: "golpe" };
    k.textos.push(c); app.sel = { pista, id: c.id }; app.commit(); return;
  } else if (pista === "poses") c = clipPose("reposo", 1.2);
  else if (pista === "ojos") c = clipOjos("neutral", 1.2);
  else if (pista === "camara") c = clipCamara("tres_cuartos", 2);
  else c = clipMatiz("hablar", Math.round(app.t * 20) / 20, 1.5);
  k[pista] ??= [];
  if (SECUENCIA.includes(pista)) {
    // insertar después del clip que está bajo el cabezal
    const ini = inicios(k[pista]);
    let i = k[pista].findIndex((x, j) => app.t >= ini[j] && app.t < ini[j] + x.dur);
    i = i < 0 ? k[pista].length : i + 1;
    k[pista].splice(i, 0, c);
  } else k[pista].push(c);
  app.sel = { pista, id: c.id };
  app.commit();
  if (pista === "poses") abrirBiblioteca("poses");
  if (pista === "ojos") abrirBiblioteca("ojos");
}

// ───────────── inspector ─────────────
const COLOR = { poses: "var(--poses)", ojos: "var(--ojos)", matices: "var(--matices)", camara: "var(--camara)", audio: "var(--audio)", escenas: "var(--escenas)", textos: "var(--textos)" };
const TITULO = { poses: "Pose", ojos: "Expresión", matices: "Matiz", camara: "Toma de cámara", audio: "Audio", escenas: "Escenario de la toma", textos: "Título en pantalla" };

let vocesCache = null;
async function voces() {
  if (!vocesCache) { try { const j = await (await fetch("/api/voces")).json(); vocesCache = j.ok ? j.voces : []; } catch { vocesCache = []; } }
  return vocesCache;
}
// genera (o recupera de la caché) los audios que falten
async function prepararAudio(clips = app.proy.pistas.audio || []) {
  const faltan = clips.filter(c => !c.archivo || !c.durOriginal || (c.tipo === "voz" && !c.env));
  let k = 0;
  for (const c of faltan) {
    toast(`Generando audio con ElevenLabs… ${++k}/${faltan.length}`);
    try { await audio.preparar(c); } catch (e) { toast("Audio: " + e.message); }
    linea.render();
  }
  if (faltan.length) { app.commit(); toast("Audio listo"); }
}

// icono del sprite de index.html (trazos de Lucide): ico("play") → <svg class="ic">…</svg>
const ico = (n) => `<svg class="ic"><use href="#i-${n}"/></svg>`;
// botón con icono + texto
const bIco = (n, texto, attrs = {}) => h("button", { class: "btn chico", ...attrs, html: ico(n) }, texto);
function h(tag, attrs = {}, ...hijos) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) { if (k.startsWith("on")) e[k] = v; else if (k === "html") e.innerHTML = v; else e.setAttribute(k, v); }
  for (const c of hijos.flat()) if (c != null) e.append(c);
  return e;
}
function deslizador(etq, valor, min, max, paso, alMover, fmt = (v) => v.toFixed(2) + " s") {
  const b = h("b", {}, fmt(valor));
  const i = h("input", { type: "range", min, max, step: paso });
  i.value = valor;
  i.oninput = () => { const v = Number(i.value); b.textContent = fmt(v); alMover(v); linea.render(); actualizarTiempo(); };
  i.onchange = () => app.commit({ inspector: false });
  return h("div", { class: "deslizador" }, h("div", { class: "et" }, h("span", {}, etq), b), i);
}
function seleccion(etq, opciones, valor, alCambiar) {
  const s = h("select", { onchange: () => { alCambiar(s.value); app.commit(); } },
    ...Object.entries(opciones).map(([k, v]) => { const o = h("option", { value: k }, v.nombre || v); if (k === valor) o.selected = true; return o; }));
  return h("label", { class: "campo" }, etq, s);
}
function mira(x, y, alMover) {
  const el = h("div", { class: "mira", title: "Arrastra para mover la mirada" }, h("i"));
  const punto = el.firstChild;
  const pintar = (a, b) => { punto.style.left = (a + 1) * 50 + "%"; punto.style.top = (1 - b) * 50 + "%"; };
  pintar(x, y);
  el.onpointerdown = (e) => {
    el.setPointerCapture(e.pointerId);
    const mover = (ev) => {
      const r = el.getBoundingClientRect();
      const a = Math.max(-1, Math.min(1, ((ev.clientX - r.left) / r.width) * 2 - 1)), b = Math.max(-1, Math.min(1, 1 - ((ev.clientY - r.top) / r.height) * 2));
      pintar(a, b); alMover(+a.toFixed(2), +b.toFixed(2));
    };
    mover(e);
    el.onpointermove = mover;
    el.onpointerup = () => { el.onpointermove = null; app.commit({ inspector: false }); };
  };
  el.ondblclick = () => { pintar(0, 0); alMover(0, 0); app.commit({ inspector: false }); };
  return el;
}

function accionesClip(pista, clip) {
  const lista = app.proy.pistas[pista];
  return h("div", { class: "acciones-clip" },
    bIco("copy", "Duplicar", { onclick: () => { const c = { ...structuredClone(clip), id: nuevoId() }; if (pista === "matices") c.inicio = clip.inicio + clip.dur; lista.splice(lista.indexOf(clip) + 1, 0, c); app.sel = { pista, id: c.id }; app.commit(); } }),
    SECUENCIA.includes(pista) ? h("button", { class: "btn chico icono", title: "Mover antes", "aria-label": "Mover antes", html: ico("arrow-left"), onclick: () => mover(-1) }) : null,
    SECUENCIA.includes(pista) ? h("button", { class: "btn chico icono", title: "Mover después", "aria-label": "Mover después", html: ico("arrow-right"), onclick: () => mover(1) }) : null,
    bIco("trash", "Eliminar", { class: "btn chico peligro", onclick: borrarSel }));
  function mover(d) { const i = lista.indexOf(clip), j = i + d; if (j < 0 || j >= lista.length) return; lista.splice(i, 1); lista.splice(j, 0, clip); app.commit(); }
}
function borrarSel() {
  const clip = buscarClip(app.sel); if (!clip) return;
  const lista = app.proy.pistas[app.sel.pista];
  if (app.sel.pista === "poses" && lista.length === 1) return toast("Necesitas al menos una pose");
  lista.splice(lista.indexOf(clip), 1);
  app.sel = null; app.commit();
}

function renderInspector() {
  const ins = $("#inspector");
  ins.innerHTML = "";
  const clip = buscarClip(app.sel);
  if (!clip) {
    ins.append(h("div", { class: "insp-vacio" }, h("div", { class: "grande", html: ico("clapper") }),
      h("p", {}, "Selecciona un clip de la línea de tiempo para editarlo."),
      h("div", { class: "atajos", html: [["Reproducir", "Espacio"], ["Borrar clip", "Supr"], ["Duplicar", "Ctrl D"], ["Deshacer / rehacer", "Ctrl Z · Ctrl Y"], ["Zoom de la línea", "Ctrl + rueda"]].map(([a, k]) => `<span>${a}</span><kbd>${k}</kbd>`).join("") })));
    return;
  }
  const pista = app.sel.pista;
  ins.append(h("div", { class: "insp-titulo" }, h("span", { class: "punto", style: `background:${COLOR[pista]}` }), h("h2", {}, TITULO[pista])));

  if (pista === "poses") {
    const pose = poseDe(clip);
    ins.append(h("div", { class: "tarjeta-sel", onclick: () => abrirBiblioteca("poses") },
      h("img", { src: miniPose(pose), alt: "" }), h("div", {}, h("b", {}, pose.nombre), h("small", {}, "Cambiar pose…"))));
    ins.append(deslizador("Duración", clip.dur, 0.1, 6, 0.05, v => { clip.dur = v; clip.trans = Math.min(clip.trans, v); }));
    ins.append(deslizador("Transición", clip.trans, 0, 2, 0.05, v => clip.trans = Math.min(v, clip.dur)));
    ins.append(seleccion("Curva", CURVAS, clip.curva || "suave", v => clip.curva = v));
    ins.append(h("div", { class: "acciones-clip" },
      bIco("flip", "Espejar", { onclick: () => { clip.pose = espejarPose(pose); clip.pose.editada = true; app.commit(); } }),
      bIco(app.posando ? "check" : "hand", app.posando ? "Terminar de posar" : "Posar a mano", { class: "btn chico" + (app.posando ? " acento" : ""), onclick: () => alternarPosar() }),
      pose.editada ? bIco("star", "Guardar en Mis poses", { onclick: guardarMiPose }) : null));
    if (app.posando) ins.append(panelPosar(clip));
  } else if (pista === "ojos") {
    ins.append(h("div", { class: "tarjeta-sel", onclick: () => abrirBiblioteca("ojos") },
      h("img", { src: miniCara(clip.cara), alt: "" }), h("div", {}, h("b", {}, EXPRESIONES[clip.cara]?.nombre), h("small", {}, "Cambiar expresión…"))));
    ins.append(deslizador("Duración", clip.dur, 0.1, 6, 0.05, v => clip.dur = v));
    ins.append(h("h4", {}, "Mirada (doble clic = al frente)"));
    ins.append(mira(clip.mx || 0, clip.my || 0, (x, y) => { clip.mx = x; clip.my = y; }));
  } else if (pista === "matices") {
    ins.append(seleccion("Tipo", MATICES, clip.tipo, v => clip.tipo = v));
    ins.append(deslizador("Inicio", clip.inicio, 0, Math.max(10, duracion(app.proy)), 0.05, v => clip.inicio = v));
    ins.append(deslizador("Duración", clip.dur, 0.2, 10, 0.05, v => clip.dur = v));
    ins.append(deslizador("Intensidad", clip.intensidad ?? 1, 0, 2, 0.05, v => clip.intensidad = v, v => Math.round(v * 100) + " %"));
    ins.append(h("p", { class: "nota" }, "Los matices se suman encima de la pose: puedes encimar varios (por ejemplo hablar + balancearse)."));
  } else if (pista === "audio") {
    const caja = h("div", { class: "insp-audio" });
    const txt = h("textarea", { maxlength: 600 }); txt.value = clip.texto || "";
    caja.append(h("h4", {}, clip.tipo === "voz" ? "Texto que dice" : "Describe el sonido (en inglés funciona mejor)"), txt);
    if (clip.tipo === "voz") {
      caja.append(h("p", { class: "nota tags" }, "Con el modelo v3 puedes poner emociones entre corchetes: [laughs], [whispers], [excited], [sighs], [curious]…"));
      const sv = h("select", {}, h("option", { value: clip.voz }, "Cargando voces…"));
      voces().then(vs => {
        sv.innerHTML = "";
        for (const v of vs) { const o = h("option", { value: v.id }, v.nombre.split(" - ")[0] + (v.idioma ? ` (${v.idioma})` : "")); if (v.id === clip.voz) o.selected = true; sv.append(o); }
        if (!vs.length) sv.append(h("option", { value: clip.voz }, "Leo (la de tus videos)"));
      });
      sv.onchange = () => { clip.voz = sv.value; };
      caja.append(h("label", { class: "campo" }, "Voz", sv));
      caja.append(seleccion("Modelo", { eleven_v3: "v3 (emociones y risas)", eleven_multilingual_v2: "Multilingüe v2" }, clip.modelo || "eleven_v3", v => clip.modelo = v));
    } else {
      caja.append(deslizador("Duración del sonido", clip.durSfx || 1, 0.5, 22, 0.1, v => clip.durSfx = v));
    }
    const gen = h("button", { class: "btn chico primario", onclick: async () => {
      clip.texto = txt.value.trim(); delete clip.archivo; delete clip.env; delete clip.durOriginal;
      gen.disabled = true; gen.textContent = "Generando…";
      try { await audio.preparar(clip); app.commit(); toast("Audio generado"); } catch (e) { toast("Audio: " + e.message); gen.disabled = false; gen.textContent = "Generar"; }
    } }, clip.archivo ? "Volver a generar" : "Generar");
    caja.append(h("div", { class: "acciones-clip" }, gen,
      clip.archivo ? bIco("play", "Escuchar", { onclick: async () => { const b = await audio.buffer(clip.archivo); const ctx = audio.contexto(); const s = ctx.createBufferSource(); s.buffer = b; s.connect(ctx.destination); s.start(); } }) : null));
    ins.append(caja);
    ins.append(deslizador("Inicio", clip.inicio, 0, Math.max(10, duracion(app.proy)), 0.05, v => clip.inicio = v));
    ins.append(deslizador("Volumen", clip.vol ?? 1, 0, 1.5, 0.05, v => clip.vol = v, v => Math.round(v * 100) + " %"));
    if (clip.tipo === "voz") ins.append(h("p", { class: "nota" }, "La cabeza se mueve sola con las sílabas de la voz (tu skin no necesita boca)."));
  } else if (pista === "escenas") {
    ins.append(seleccion("Escenario", { "": "Mundo del proyecto", ...Object.fromEntries(Object.entries(ESCENARIOS).map(([k, v]) => [k, v.nombre])) }, clip.set || "", v => clip.set = v || null));
    ins.append(seleccion("Cielo y luz", { "": "Lo del panel Escena", ...Object.fromEntries(Object.entries(AMBIENTES).map(([k, v]) => [k, v.nombre])) }, clip.ambiente || "", v => clip.ambiente = v || null));
    ins.append(deslizador("Duración", clip.dur, 0.1, 12, 0.05, v => clip.dur = v));
    ins.append(deslizador("Fundido de entrada (negro)", clip.fundido?.entra || 0, 0, 2, 0.05, v => { clip.fundido = { ...clip.fundido, entra: v }; }));
    ins.append(deslizador("Fundido de salida (negro)", clip.fundido?.sale || 0, 0, 2, 0.05, v => { clip.fundido = { ...clip.fundido, sale: v }; }));
    const neg = h("input", { type: "checkbox" }); neg.checked = !!clip.negro; neg.onchange = () => { clip.negro = neg.checked; app.commit(); };
    ins.append(h("label", { class: "check" }, neg, " Pantalla negra (para tarjetas con títulos)"));
    ins.append(h("p", { class: "nota" }, `Personaje en (${(clip.actor?.x ?? 0).toFixed(1)}, ${(clip.actor?.z ?? 0).toFixed(1)})` + (clip.actorHasta ? " → se mueve durante la toma" : "") + ` · ${(clip.mobs || []).reduce((s, m) => s + (m.n || 1), 0)} mobs`));
    ins.append(h("div", { class: "acciones-clip" },
      bIco("pin", "Usar posición del personaje", { onclick: () => { clip.actor = { ...app.proy.escena.actor }; delete clip.actorHasta; app.commit(); toast("La toma usa la posición actual del personaje"); } }),
      h("button", { class: "btn chico", onclick: () => { clip.actorHasta = { ...app.proy.escena.actor }; app.commit(); toast("El personaje caminará hasta aquí durante la toma"); } }, "Fijar destino")));
    ins.append(h("p", { class: "nota" }, "Cada toma es un corte: escenario, cielo, posición del personaje y mobs. Con “Mover” (arriba del visor) lo pones sobre un bloque y luego lo copias aquí."));
    ins.append(app.recursos.panelToma(clip));
  } else if (pista === "textos") {
    const txt = h("textarea", { maxlength: 200 }); txt.value = clip.texto || "";
    txt.oninput = () => { clip.texto = txt.value; }; txt.onchange = () => app.commit({ inspector: false });
    ins.append(h("h4", {}, "Texto (Enter = otra línea)"), txt);
    const color = (etq, k, def) => { const i = h("input", { type: "color" }); i.value = clip[k] || def; i.oninput = () => { clip[k] = i.value; }; i.onchange = () => app.commit({ inspector: false }); return h("label", { class: "campo" }, etq, i); };
    ins.append(color("Color", "color", "#5bff6a"), color("Brillo de arriba", "color2", "#b6ffbe"), color("Relieve", "sombra", "#14361a"));
    ins.append(deslizador("Tamaño", clip.tam ?? 13, 3, 30, 0.5, v => clip.tam = v, v => v.toFixed(1)));
    ins.append(deslizador("Posición horizontal", clip.x ?? 0.5, 0, 1, 0.01, v => clip.x = v, v => Math.round(v * 100) + " %"));
    ins.append(deslizador("Posición vertical", clip.y ?? 0.5, 0, 1, 0.01, v => clip.y = v, v => Math.round(v * 100) + " %"));
    ins.append(deslizador("Inicio", clip.inicio, 0, Math.max(10, duracion(app.proy)), 0.05, v => clip.inicio = v));
    ins.append(deslizador("Duración", clip.dur, 0.2, 12, 0.05, v => clip.dur = v));
  } else if (pista === "camara") {
    ins.append(seleccion("Toma", CAMARAS, clip.tipo, v => { clip.tipo = v; delete clip.desde; delete clip.hasta; clip.curva = CAMARAS[v].curva || "suave"; }));
    ins.append(deslizador("Duración", clip.dur, 0.2, 12, 0.05, v => clip.dur = v));
    ins.append(seleccion("Curva", CURVAS, clip.curva || "suave", v => clip.curva = v));
    ins.append(deslizador("Temblor (cámara en mano)", clip.temblor ?? CAMARAS[clip.tipo]?.temblor ?? 0, 0, 2, 0.05, v => clip.temblor = v, v => v.toFixed(2)));
    ins.append(h("h4", {}, "Vista libre"));
    ins.append(h("p", { class: "nota" }, "Apaga “Vista de cámara”, acomoda la vista con el ratón y guárdala como inicio o final de esta toma."));
    ins.append(h("div", { class: "acciones-clip" },
      h("button", { class: "btn chico", onclick: () => { clip.desde = escena.vistaActual(); if (!clip.hasta) clip.hasta = clip.desde; app.commit(); toast("Vista guardada como inicio"); } }, "Fijar inicio"),
      h("button", { class: "btn chico", onclick: () => { clip.hasta = escena.vistaActual(); if (!clip.desde) clip.desde = { ...(CAMARAS[clip.tipo].desde) }; app.commit(); toast("Vista guardada como final"); } }, "Fijar final"),
      (clip.desde || clip.hasta) ? h("button", { class: "btn chico", onclick: () => { delete clip.desde; delete clip.hasta; app.commit(); } }, "Restablecer") : null));
  }
  ins.append(accionesClip(pista, clip));
}

// ───────────── posar a mano ─────────────
function irAPose(clip) {
  if (!clip) return;
  const ini = inicios(app.proy.pistas.poses)[app.proy.pistas.poses.indexOf(clip)];
  app.irA(ini + Math.min(clip.trans, clip.dur) + 0.001);
}
function alternarPosar(si = !app.posando) {
  if (si) {
    reproducir(false);
    if (app.sel?.pista !== "poses") {
      const k = app.proy.pistas.poses, ini = inicios(k);
      const c = k.find((x, j) => app.t >= ini[j] && app.t < ini[j] + x.dur) || k[k.length - 1];
      app.sel = { pista: "poses", id: c.id };
    }
    irAPose(buscarClip(app.sel));
    toast("Haz clic en una parte del cuerpo y gírala con los aros");
  } else { escena.gizmo.detach(); app.juntaSel = null; }
  app.posando = si;
  document.body.dataset.posando = si ? "1" : "";
  $("#b-posar").setAttribute("aria-pressed", si);
  linea.render(); renderInspector();
}
$("#b-posar").onclick = () => alternarPosar();

function elegirJunta(j) {
  app.juntaSel = j;
  if (j) escena.gizmo.attach(personaje.juntas[j]); else escena.gizmo.detach();
  renderInspector();
}
function poseEditable(clip) {
  if (!clip.pose.editada) { clip.pose = structuredClone(clip.pose); clip.pose.editada = true; if (!/editada/.test(clip.pose.nombre)) clip.pose.nombre += " (editada)"; }
  clip.pose.r ||= {};
  return clip.pose;
}
escena.onGizmo = () => {
  const clip = buscarClip(app.sel); const j = app.juntaSel;
  if (!clip || !j) return;
  const e = personaje.juntas[j].rotation;
  poseEditable(clip).r[j] = [e.x, e.y, e.z].map(v => Math.round(v * R2D * 10) / 10);
};
escena.onGizmoSuelto = (arrastrando) => { if (!arrastrando) app.commit(); };

// clic (sin arrastrar) sobre el personaje elige la junta
let abajo = null;
$("#lienzo").addEventListener("pointerdown", (e) => { abajo = [e.clientX, e.clientY]; });
$("#lienzo").addEventListener("pointerup", (e) => {
  if (!app.posando || !abajo || Math.hypot(e.clientX - abajo[0], e.clientY - abajo[1]) > 4 || escena.gizmo.dragging) return;
  const j = escena.juntaEn(e);
  if (j) elegirJunta(j);
});

function panelPosar(clip) {
  const pose = poseDe(clip);
  const caja = h("div", {}, h("h4", {}, "Parte del cuerpo"));
  caja.append(h("div", { class: "juntas" }, ...JUNTAS.map(j => h("button", { class: app.juntaSel === j ? "activo" : "", onclick: () => elegirJunta(j) }, NOMBRE_JUNTA[j]))));
  if (app.juntaSel) {
    const j = app.juntaSel, r = pose.r?.[j] || [0, 0, 0];
    ["X (adelante/atrás)", "Y (girar)", "Z (a los lados)"].forEach((etq, eje) => {
      caja.append(deslizador(etq, r[eje] || 0, -180, 180, 1, v => { const p = poseEditable(clip); p.r[j] = [...(p.r[j] || [0, 0, 0])]; p.r[j][eje] = v; }, v => Math.round(v) + "°"));
    });
    if (j === "raiz") {
      const p = pose.p || [0, 0, 0];
      caja.append(deslizador("Altura", p[1], -12, 12, 0.1, v => { const q = poseEditable(clip); q.p = [...(q.p || [0, 0, 0])]; q.p[1] = v; }, v => v.toFixed(1) + " px"));
      caja.append(deslizador("Adelante / atrás", p[2], -12, 12, 0.1, v => { const q = poseEditable(clip); q.p = [...(q.p || [0, 0, 0])]; q.p[2] = v; }, v => v.toFixed(1) + " px"));
    }
    caja.append(h("button", { class: "btn chico", onclick: () => { const p = poseEditable(clip); delete p.r[j]; app.commit(); } }, "Poner en cero"));
  }
  return caja;
}

function misPoses() { try { return JSON.parse(localStorage.getItem(MIS_POSES)) || {}; } catch { return {}; } }
function guardarMiPose() {
  const clip = buscarClip(app.sel); if (!clip) return;
  const nombre = prompt("Nombre de la pose:", clip.pose.nombre.replace(" (editada)", ""));
  if (!nombre) return;
  const mp = misPoses(), id = "mia_" + Date.now().toString(36);
  mp[id] = { ...structuredClone(clip.pose), nombre, cat: "Mis poses", id, editada: false };
  localStorage.setItem(MIS_POSES, JSON.stringify(mp));
  clip.pose = structuredClone(mp[id]);
  app.commit(); toast("Guardada en Mis poses");
}

// ───────────── biblioteca (poses / expresiones) ─────────────
let biblio = { tipo: "poses", cat: "Todas" };
function abrirBiblioteca(tipo) {
  biblio = { tipo, cat: "Todas" };
  $("#biblio-titulo").textContent = tipo === "poses" ? "Biblioteca de poses" : "Expresiones";
  $("#biblio-buscar").value = "";
  renderBiblioteca();
  $("#m-biblio").showModal();
}
function renderBiblioteca() {
  const clip = buscarClip(app.sel);
  const q = $("#biblio-buscar").value.toLowerCase();
  const tabs = $("#biblio-tabs"), rej = $("#biblio-rejilla");
  tabs.innerHTML = ""; rej.innerHTML = "";
  if (biblio.tipo === "poses") {
    const mias = misPoses();
    const cats = ["Todas", ...CATEGORIAS, ...(Object.keys(mias).length ? ["Mis poses"] : [])];
    for (const c of cats) tabs.append(h("button", { class: c === biblio.cat ? "activo" : "", onclick: () => { biblio.cat = c; renderBiblioteca(); } }, c));
    const todas = { ...POSES, ...mias };
    for (const [id, pose] of Object.entries(todas)) {
      if (biblio.cat !== "Todas" && pose.cat !== biblio.cat) continue;
      if (q && !pose.nombre.toLowerCase().includes(q)) continue;
      const activo = clip?.pose?.id === id && !clip.pose.editada;
      rej.append(h("div", { class: "celda" + (activo ? " activo" : ""), onclick: () => {
        if (!clip) return;
        clip.pose = structuredClone({ ...pose, id, editada: false });
        app.commit(); $("#m-biblio").close();
        if (app.posando) irAPose(clip);
      } }, h("img", { src: estudio.miniatura(id, pose), alt: "", loading: "lazy" }), pose.nombre, h("small", {}, pose.cat)));
    }
  } else {
    for (const [id, e] of Object.entries(EXPRESIONES)) {
      if (q && !e.nombre.toLowerCase().includes(q)) continue;
      rej.append(h("div", { class: "celda cara" + (clip?.cara === id ? " activo" : ""), onclick: () => {
        if (!clip) return; clip.cara = id; app.commit(); $("#m-biblio").close();
      } }, h("img", { src: miniCara(id), alt: "" }), e.nombre));
    }
  }
}
$("#biblio-buscar").oninput = renderBiblioteca;
document.querySelectorAll("[data-cerrar]").forEach(b => b.onclick = () => b.closest("dialog").close());

// ───────────── vista de cámara ─────────────
$("#b-vista-cam").onclick = (e) => {
  const si = e.currentTarget.getAttribute("aria-pressed") !== "true";
  e.currentTarget.setAttribute("aria-pressed", si);
  escena.usarVistaCamara(si);
  $("#ayuda").textContent = si ? "Viendo por la cámara de la línea de tiempo" : "Arrastra para girar · clic derecho para mover · rueda para acercar";
};

// ───────────── editor de ojos ─────────────
const ed = { cfg: null, herr: "0", previa: new Rostro(), exp: "neutral", mx: 0, my: 0, abierto: false, arr: null };
const NOMBRES_COLOR = { piel: "Piel", parpado: "Párpado", esclera: "Blanco del ojo", iris: "Iris", pupila: "Pupila", linea: "Línea / pestaña", ceja: "Cejas", boca: "Boca", rubor: "Rubor" };

function abrirEditorOjos() {
  ed.cfg = structuredClone(app.proy.personaje.rostro);
  ed.delgado = !!app.proy.personaje.delgado;
  ed.pelo = { ...PELO_BASE, ...(app.proy.personaje.pelo || {}) };
  $("#o-pelo").checked = ed.pelo.fisica !== false;
  $("#o-largo").value = ed.pelo.largo || 0;
  ed.abierto = true;
  $("#ojos-titulo").textContent = "Ojos y boca de " + app.proy.personaje.nombre;
  $("#o-delineado").checked = ed.cfg.delineado !== false;
  $("#o-delgado").checked = ed.delgado;
  $("#o-estilo").innerHTML = Object.entries(ESTILOS).map(([k, v]) => `<option value="${k}">${v.nombre}</option>`).join("");
  $("#o-estilo").value = ed.cfg.estilo;
  $("#o-cejas").checked = ed.cfg.cejas;
  $("#o-brillo").checked = ed.cfg.brillo;
  $("#o-chips").innerHTML = "";
  for (const [id, e] of Object.entries(EXPRESIONES)) {
    $("#o-chips").append(h("button", { class: id === ed.exp ? "activo" : "", onclick: (ev) => {
      ed.exp = id; document.querySelectorAll("#o-chips button").forEach(b => b.classList.remove("activo")); ev.target.classList.add("activo");
    } }, e.nombre));
  }
  const m = mira(0, 0, (x, y) => { ed.mx = x; ed.my = y; });
  m.id = "o-mira"; $("#o-mira").replaceWith(m);
  edActualizar();
  $("#m-ojos").showModal();
  requestAnimationFrame(edAnimar);
}
$("#m-ojos").addEventListener("close", () => { ed.abierto = false; });
$("#b-ojos").onclick = abrirEditorOjos;

function edActualizar() {
  ed.previa.configurar(cara8, ed.cfg);
  const auto = coloresAuto(cara8, ed.cfg);
  const cont = $("#o-colores"); cont.innerHTML = "";
  for (const [k, nombre] of Object.entries(NOMBRES_COLOR)) {
    const i = h("input", { type: "color" }); i.value = ed.cfg.colores[k] || auto[k];
    i.oninput = () => { ed.cfg.colores[k] = i.value; ed.previa.configurar(cara8, ed.cfg); };
    cont.append(h("label", { class: "campo" }, nombre, i));
  }
  edDibujarLienzo();
}
function edDibujarLienzo() {
  const c = $("#ojos-lienzo"), x = c.getContext("2d"), k = 40;
  x.imageSmoothingEnabled = false;
  x.clearRect(0, 0, 320, 320);
  x.drawImage(cara8, 0, 0, 320, 320);
  x.strokeStyle = "rgba(255,255,255,.15)"; x.lineWidth = 1;
  for (let i = 1; i < 8; i++) { x.beginPath(); x.moveTo(i * k + 0.5, 0); x.lineTo(i * k + 0.5, 320); x.moveTo(0, i * k + 0.5); x.lineTo(320, i * k + 0.5); x.stroke(); }
  const marca = (r, color, txt) => {
    if (!r) return;
    x.fillStyle = color + "33"; x.fillRect(r.x * k, r.y * k, r.w * k, r.h * k);
    x.strokeStyle = color; x.lineWidth = 3; x.strokeRect(r.x * k + 1.5, r.y * k + 1.5, r.w * k - 3, r.h * k - 3);
    x.fillStyle = color; x.font = "600 12px Inter"; x.fillText(txt, r.x * k + 5, r.y * k + 15);
  };
  marca(ed.cfg.ojos[0], "#22c8b4", "1"); marca(ed.cfg.ojos[1], "#7c6cff", "2"); marca(ed.cfg.boca, "#f5a524", "boca");
}
document.querySelectorAll("#ojos-herr button").forEach(b => b.onclick = () => {
  ed.herr = b.dataset.herr;
  document.querySelectorAll("#ojos-herr button").forEach(o => o.classList.toggle("activo", o === b));
});
$("#ojos-lienzo").addEventListener("pointerdown", (e) => {
  const c = e.currentTarget; c.setPointerCapture(e.pointerId);
  const celda = (ev) => { const r = c.getBoundingClientRect(); return [Math.max(0, Math.min(7, Math.floor((ev.clientX - r.left) / r.width * 8))), Math.max(0, Math.min(7, Math.floor((ev.clientY - r.top) / r.height * 8)))]; };
  const a = celda(e);
  const poner = (ev) => {
    const b = celda(ev);
    const rect = { x: Math.min(a[0], b[0]), y: Math.min(a[1], b[1]), w: Math.abs(a[0] - b[0]) + 1, h: Math.abs(a[1] - b[1]) + 1 };
    if (ed.herr === "boca") ed.cfg.boca = rect; else { ed.cfg.ojos[Number(ed.herr)] = rect; ed.cfg.miradaBase = null; }
    edDibujarLienzo();
  };
  poner(e);
  c.onpointermove = poner;
  c.onpointerup = () => { c.onpointermove = null; edActualizar(); };
});
$("#b-ojos-auto").onclick = () => { const o = detectarOjos(cara8); if (o) { ed.cfg.ojos = o; ed.cfg.miradaBase = null; edActualizar(); toast("Ojos detectados"); } else toast("No los encontré: márcalos a mano"); };
$("#b-sin-boca").onclick = () => { ed.cfg.boca = null; edActualizar(); };
$("#o-estilo").onchange = (e) => { ed.cfg.estilo = e.target.value; edActualizar(); };
$("#o-cejas").onchange = (e) => { ed.cfg.cejas = e.target.checked; edActualizar(); };
$("#o-brillo").onchange = (e) => { ed.cfg.brillo = e.target.checked; edActualizar(); };
$("#o-delineado").onchange = (e) => { ed.cfg.delineado = e.target.checked; edActualizar(); };
$("#o-delgado").onchange = (e) => { ed.delgado = e.target.checked; };
$("#o-pelo").onchange = (e) => { ed.pelo.fisica = e.target.checked; };
$("#o-largo").oninput = (e) => { ed.pelo.largo = Number(e.target.value); };
$("#b-colores-auto").onclick = () => { ed.cfg.colores = {}; edActualizar(); };
$("#b-ojos-ok").onclick = async () => {
  app.proy.personaje.rostro = ed.cfg;
  app.proy.personaje.delgado = ed.delgado;
  app.proy.personaje.pelo = ed.pelo;
  guardarEnCatalogo(app.proy.personaje);       // cada jugador guarda su configuración de cara
  $("#m-ojos").close();
  await reconstruir(); app.commit(); toast("Ojos aplicados");
};
function edAnimar(ahora) {
  if (!ed.abierto) return;
  const t = ahora / 1000, ciclo = t % 3.4;
  const parp = ciclo > 3.2 ? Math.sin((ciclo - 3.2) / 0.2 * Math.PI) : 0;
  ed.previa.dibujar({ exp: resolverExpresion(ed.exp), mx: ed.mx, my: ed.my, parpado: parp, boca: ed.cfg.boca ? Math.abs(Math.sin(t * 9)) * (ciclo < 1.5 ? 1 : 0) : 0, t });
  const x = $("#ojos-previa").getContext("2d");
  x.imageSmoothingEnabled = ed.previa.vector;
  x.clearRect(0, 0, 256, 256);
  x.drawImage(ed.previa.canvas, 0, 0, 256, 256);
  requestAnimationFrame(edAnimar);
}

// ───────────── exportar ─────────────
$("#b-exportar").onclick = () => { $("#e-progreso").hidden = true; $("#m-exportar").showModal(); };
const esperar = (ms) => new Promise(r => setTimeout(r, ms));
// ceder el turno sin temporizador: con el panel oculto el navegador frena setTimeout (hasta 1 s) y exportar tardaba 15× más
const ceder = () => new Promise(r => { const c = new MessageChannel(); c.port1.onmessage = () => r(); c.port2.postMessage(0); });

function componer(ctx, w, h, fuente = escena.renderer.domElement) {
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(fuente, 0, 0, w, h);
  dibujarCapa(ctx, w, h, app.tExport ?? app.t);
  const m = app.proy.escena.marco;
  if (m === "cine") { ctx.fillStyle = "#000"; ctx.fillRect(0, 0, w, h * 0.11); ctx.fillRect(0, h * 0.89, w, h * 0.11); }
  if (m === "rec") {
    // como la videocámara del video de Benly: REC, batería, cinta y esquinas
    const u = h / 100, g = Math.max(2, u * 0.5);
    ctx.save();
    ctx.strokeStyle = "#fff"; ctx.fillStyle = "#fff"; ctx.lineWidth = g; ctx.lineJoin = "round";
    ctx.shadowColor = "rgba(0,0,0,.45)"; ctx.shadowBlur = u * 0.8;
    const L = u * 6, esq = (x, y, dx, dy) => { ctx.beginPath(); ctx.moveTo(x, y + dy * L); ctx.lineTo(x, y); ctx.lineTo(x + dx * L, y); ctx.stroke(); };
    const mx = w * 0.04, my = h * 0.06;
    esq(mx, my, 1, 1); esq(w - mx, my, -1, 1); esq(mx, h - my, 1, -1); esq(w - mx, h - my, -1, -1);
    const x0 = w * 0.065, y0 = h * 0.09;
    if (Math.floor(app.tExport * 2) % 2 === 0) { ctx.fillStyle = "#ff2b2b"; ctx.beginPath(); ctx.arc(x0 + u * 1.7, y0 + u * 2.1, u * 1.7, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = "#fff"; ctx.font = `800 ${Math.round(u * 4.2)}px Inter, sans-serif`; ctx.textBaseline = "top";
    ctx.fillText("REC", x0 + u * 4.4, y0);
    const bx = w - w * 0.065 - u * 7.5, by = y0;
    ctx.strokeRect(bx, by, u * 7.5, u * 3.6); ctx.fillRect(bx + u * 7.5, by + u * 0.9, u * 0.6, u * 1.8); ctx.fillRect(bx + u * 0.9, by + u * 0.9, u * 5.7, u * 1.8);
    const cx = w - w * 0.065 - u * 7.5, cy = h - h * 0.09 - u * 4.2;
    ctx.beginPath(); ctx.roundRect(cx, cy, u * 7.5, u * 4.2, u * 0.7); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx + u * 2.5, cy + u * 2.1, u * 0.9, 0, Math.PI * 2); ctx.arc(cx + u * 5, cy + u * 2.1, u * 0.9, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

// Guarda el archivo en la carpeta Videos del programa (servidor local); si no se puede, lo descarga
async function guardarVideo(blob, nombre, destino = "") {
  try {
    const r = await fetch("/guardar?nombre=" + encodeURIComponent(nombre) + (destino === "agente" ? "&carpeta=agente" : ""), { method: "POST", body: blob });
    if (!r.ok) throw new Error();
    return await r.text();
  } catch { descargar(blob, nombre); return null; }
}

// MP4 H.264 cuadro por cuadro con WebCodecs: no depende de que el render vaya en tiempo real
async function codificarMP4(out, W, H, fps, N, alCuadro, mezcla = null, bitsPorPixel = 0.22) {
  const { Muxer, ArrayBufferTarget } = await import("https://cdn.jsdelivr.net/npm/mp4-muxer@5.1.3/build/mp4-muxer.mjs");
  const conAudio = !!mezcla && (await AudioEncoder.isConfigSupported({ codec: "mp4a.40.2", sampleRate: 48000, numberOfChannels: 2, bitrate: 192000 })).supported;
  const muxer = new Muxer({ target: new ArrayBufferTarget(), video: { codec: "avc", width: W, height: H }, fastStart: "in-memory",
    ...(conAudio ? { audio: { codec: "aac", numberOfChannels: 2, sampleRate: 48000 } } : {}) });
  if (conAudio) {
    // audio AAC: la mezcla completa en bloques de 1024 muestras
    let errA = null;
    const ae = new AudioEncoder({ output: (chunk, meta) => muxer.addAudioChunk(chunk, meta), error: (e) => { errA = e; } });
    ae.configure({ codec: "mp4a.40.2", sampleRate: 48000, numberOfChannels: 2, bitrate: 192000 });
    const L = mezcla.getChannelData(0), R = mezcla.numberOfChannels > 1 ? mezcla.getChannelData(1) : L;
    for (let i = 0; i < L.length; i += 1024) {
      const n = Math.min(1024, L.length - i), datos = new Float32Array(n * 2);
      datos.set(L.subarray(i, i + n), 0); datos.set(R.subarray(i, i + n), n);
      const ad = new AudioData({ format: "f32-planar", sampleRate: 48000, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round(i / 48000 * 1e6), data: datos });
      ae.encode(ad); ad.close();
    }
    await ae.flush();
    if (errA) throw errA;
  }
  let error = null;
  const enc = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: (e) => { error = e; } });
  const codec = W * H > 1920 * 1088 ? "avc1.640033" : "avc1.640028";
  enc.configure({ codec, width: W, height: H, bitrate: Math.round(W * H * fps * bitsPorPixel), framerate: fps });
  for (let f = 0; f < N; f++) {
    alCuadro(f);
    const frame = new VideoFrame(out, { timestamp: Math.round(f * 1e6 / fps), duration: Math.round(1e6 / fps) });
    enc.encode(frame, { keyFrame: f % (fps * 2) === 0 });
    frame.close();
    while (enc.encodeQueueSize > 6) await ceder();
    if (error) throw error;
    if (f % 3 === 0) await ceder();             // dejar respirar a la interfaz
  }
  await enc.flush();
  muxer.finalize();
  return new Blob([muxer.target.buffer], { type: "video/mp4" });
}

// Desenfoque de movimiento real: promedio de varias muestras dentro del tiempo de obturación (180°)
const acum = document.createElement("canvas").getContext("2d");
function cuadroConMovimiento(t, fps, W, H) {
  if (acum.canvas.width !== W || acum.canvas.height !== H) { acum.canvas.width = W; acum.canvas.height = H; }
  // 9 muestras (con 5 los mobs rápidos se veían "dobles"); cada toma puede acortar el obturador (obturador: 0.5 = 180°)
  const toma = tomaEn(app.proy, t);
  const muestras = app.proy.efectos.desenfoqueMov === false ? 1 : (toma?.clip.muestras ?? 9);
  const obt = (toma?.clip.obturador ?? 0.5) / fps;
  const tc = cortesTomas(app.proy).find(c => c > t + 1e-6 && c < t + obt);
  const abierto = tc ? (tc - t) * 0.98 : obt;
  acum.globalAlpha = 1; acum.clearRect(0, 0, W, H);
  for (let k = 0; k < muestras; k++) {
    cuadro(t + (k / muestras) * abierto);
    acum.globalAlpha = 1 / (k + 1);
    acum.drawImage(escena.renderer.domElement, 0, 0, W, H);
  }
  acum.globalAlpha = 1;
}

$("#b-exp-ok").onclick = () => app.exportar();
app.exportar = async (opciones = {}) => {
  if (app.exportando) return;
  const tipo = opciones.tipo || $("#e-tipo").value, fps = Number(opciones.fps || $("#e-fps").value), esc = Number(opciones.escala || $("#e-escala").value);
  const [W0, H0] = dims(), W = Math.round(W0 * esc / 2) * 2, H = Math.round(H0 * esc / 2) * 2;
  // calidad "alta" (para redes): se dibuja a 1.5× y se reduce (bordes suaves, menos parpadeo en texturas finas) y el
  // MP4 lleva más bitrate. Rango: desde/hasta en segundos (el video empieza en 0 y el audio se recorta igual)
  const alta = opciones.calidad === "alta", ss = alta ? (opciones.supermuestreo ?? 1.5) : 1;
  const RW = Math.round(W * ss / 2) * 2, RH = Math.round(H * ss / 2) * 2;
  const t0 = Math.max(0, Number(opciones.desde ?? 0)), destino = opciones.destino || "";
  const prog = $("#e-progreso"), barra = prog.querySelector("i"), txt = prog.querySelector("span");
  const out = document.createElement("canvas"); out.width = W; out.height = H;
  const ctx = out.getContext("2d");
  let carpeta = null;
  if (tipo === "secuencia") {
    if (!window.showDirectoryPicker) return toast("Tu navegador no deja elegir carpeta: usa Chrome o Edge");
    try { carpeta = await showDirectoryPicker({ mode: "readwrite" }); } catch { return; }
  }
  try { await document.fonts.load(`400 40px ${FUENTE_TITULO}`); } catch { /* sin fuente: usa la de respaldo */ }
  await escena.titulos.listo;
  await escena.mobs.precargar(app.proy.pistas.escenas);
  app.exportando = true; reproducir(false);
  const vistaAntes = escena.vistaCamara;
  if (app.proy.pistas.camara.length) escena.usarVistaCamara(true);
  escena.renderer.setPixelRatio(1); escena.tamano(RW, RH);
  prog.hidden = false;
  try {
    if (tipo === "png") {
      app.tExport = app.t; cuadro(app.t); componer(ctx, W, H);
      const blob = await new Promise(r => out.toBlob(r, "image/png"));
      const ruta = await guardarVideo(blob, `${nombreArchivo()}_${app.t.toFixed(2)}s.png`);
      barra.style.width = "100%"; txt.textContent = ruta ? "PNG guardado en " + ruta : "PNG listo";
      return ruta;
    } else if (tipo === "mp4") {
      const total = Math.min(duracion(app.proy), Number(opciones.hasta ?? Infinity)), N = Math.max(1, Math.round((total - t0) * fps));
      // audio del rango: cada clip se corre t0 hacia atrás (lo que queda antes de 0 se salta con "desde")
      const clipsAudio = (app.proy.pistas.audio || []).filter(c => c.archivo).map(c => {
        const d = { ...c, inicio: c.inicio - t0 };
        if (d.inicio < 0) { d.desde = (c.desde || 0) - d.inicio; d.dur = c.dur + d.inicio; d.entrada = 0; d.inicio = 0; }
        return d;
      }).filter(c => c.dur > 0.01);
      if (clipsAudio.length) txt.textContent = "Mezclando audio…";
      const mezcla = clipsAudio.length ? await audio.mezclar(clipsAudio, N / fps) : null;
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
      const blob = await codificarMP4(out, W, H, fps, N, (f) => {
        const t = t0 + f / fps;
        app.tExport = t; escena.tiempoEfecto = t;
        cuadroConMovimiento(t, fps, RW, RH);
        componer(ctx, W, H, acum.canvas);
        barra.style.width = ((f + 1) / N * 100).toFixed(1) + "%";
        txt.textContent = `Cuadro ${f + 1} de ${N}`;
      }, mezcla, alta ? 0.36 : 0.22);
      txt.textContent = "Guardando…";
      const ruta = await guardarVideo(blob, (opciones.nombreArchivo || nombreArchivo()) + ".mp4", destino);
      txt.textContent = ruta ? "Video guardado en " + ruta : "Video listo (descargado)";
      return ruta;
    } else {
      const total = duracion(app.proy), N = Math.max(1, Math.round(total * fps));
      let rec, partes = [], pista;
      if (tipo === "webm") {
        const stream = out.captureStream(0); pista = stream.getVideoTracks()[0];
        const mime = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find(m => MediaRecorder.isTypeSupported(m));
        rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 14e6 * esc });
        rec.ondataavailable = (e) => e.data.size && partes.push(e.data);
        rec.start();
      }
      const t0 = performance.now();
      for (let f = 0; f < N; f++) {
        const t = f / fps;
        app.tExport = t; escena.tiempoEfecto = t;
        cuadro(t); componer(ctx, W, H);
        if (rec) {
          pista.requestFrame();
          const espera = t0 + (f + 1) * 1000 / fps - performance.now();   // el grabador va en tiempo real
          if (espera > 0) await esperar(espera);
        } else {
          const blob = await new Promise(r => out.toBlob(r, "image/png"));
          const fh = await carpeta.getFileHandle(`cuadro_${String(f + 1).padStart(4, "0")}.png`, { create: true });
          const w = await fh.createWritable(); await w.write(blob); await w.close();
        }
        barra.style.width = ((f + 1) / N * 100).toFixed(1) + "%";
        txt.textContent = `Cuadro ${f + 1} de ${N}`;
      }
      if (rec) {
        await new Promise(r => { rec.onstop = r; rec.stop(); });
        const ruta = await guardarVideo(new Blob(partes, { type: "video/webm" }), nombreArchivo() + ".webm");
        txt.textContent = ruta ? "Video guardado en " + ruta : "Video listo";
      } else txt.textContent = `${N} PNG guardados`;
    }
  } catch (err) {
    console.error(err); txt.textContent = "Error al exportar: " + err.message;
  } finally {
    app.exportando = false; escena.tiempoEfecto = undefined;
    escena.usarVistaCamara(vistaAntes);
    ajustarLienzo();
  }
};

// ───────────── teclado ─────────────
addEventListener("keydown", (e) => {
  if (e.target.closest?.("input, textarea, select") && e.target.type !== "range" && e.target.type !== "checkbox") return;
  if (document.querySelector("dialog[open]") || !document.getElementById("hub").hidden) return;      // (con el hub abierto no hay atajos)
  const k = e.key.toLowerCase();
  if (k === " ") { e.preventDefault(); reproducir(); }
  else if ((e.ctrlKey || e.metaKey) && k === "z") { e.preventDefault(); e.shiftKey ? rehacer() : deshacer(); }
  else if ((e.ctrlKey || e.metaKey) && k === "y") { e.preventDefault(); rehacer(); }
  else if ((e.ctrlKey || e.metaKey) && k === "d") { e.preventDefault(); $("#inspector .acciones-clip:last-child button")?.click(); }
  else if (k === "delete" || k === "backspace") { if (app.sel) { e.preventDefault(); borrarSel(); } }
  else if (k === "arrowright") app.irA(app.t + 1 / 30);
  else if (k === "arrowleft") app.irA(Math.max(0, app.t - 1 / 30));
  else if (k === "home") app.irA(0);
  else if (k === "escape" && app.posando) alternarPosar(false);
});

// ───────────── arranque ─────────────
async function iniciar() {
  // catálogo: LTezla siempre disponible
  const cat = catalogo();
  if (!Object.keys(cat).length) {
    const img = await cargarImagen("skins/leo.png");
    guardarEnCatalogo({ id: "ltezla", nombre: "LTezla", skin: normalizarSkin(img).toDataURL(), delgado: false, rostro: structuredClone(ROSTRO_LTEZLA) });
  }
  const lt = catalogo().ltezla;
  if (lt && (lt.rostro?.version || 0) < 4) { lt.rostro = { ...structuredClone(ROSTRO_LTEZLA), colores: lt.rostro?.colores || {} }; lt.pelo = { ...PELO_BASE }; guardarEnCatalogo(lt); }
  let guardado = null;
  try { guardado = JSON.parse(localStorage.getItem(CLAVE) || localStorage.getItem("mcanimator.proyecto.v1")); } catch { guardado = null; }
  if (guardado?.pistas && (guardado.skin || guardado.personaje)) app.proy = migrar(guardado);
  if (app.proy?.personaje?.id === "ltezla" && (app.proy.personaje.rostro?.version || 0) < 4) app.proy.personaje = structuredClone(catalogo().ltezla);
  // (antes este "else" colgaba del if de arriba y tiraba siempre el proyecto autoguardado)
  if (!app.proy) app.proy = proyectoNuevo(Object.values(catalogo())[0]);
  if (!catalogo()[app.proy.personaje.id]) guardarEnCatalogo(app.proy.personaje);
  sincronizarPaneles();
  await aplicarTexturas();
  await reconstruir();
  app.historia = [JSON.stringify(app.proy)];
  await app.proyectos?.alIniciar();
  prepararAudio();
  actualizarTiempo();
  requestAnimationFrame(bucle);
}
iniciar().catch(err => { console.error(err); toast("Error al iniciar: " + err.message); });

// ───────────── API para agentes (js/agente.js): la IA controla el programa; la interfaz queda para mirar ─────────────
app.proyectos = instalarProyectos(app, { migrar, reconstruir, sincronizarPaneles, toast, proyectoNuevo, catalogo, guardarEnCatalogo, aplicarPlantilla, PLANTILLAS, escena, duracion, clipPose, clipOjos });
app.recursos = instalarRecursos(app, { h, toast, tomaEn, escena });
instalarAgente(app, { escena, aplicarToma, conCuadro, deshacer, rehacer, restaurar, aplicarPlantilla, PLANTILLAS, tomaEn, textosEn, duracion, inicios, dims, toast, exportar: (o) => app.exportar(o) });
