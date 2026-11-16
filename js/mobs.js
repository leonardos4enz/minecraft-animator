// Mobs con los modelos y texturas de TU Minecraft (texturas_mc/entity, copiadas del .jar instalado).
// Geometría en coordenadas de modelo de Minecraft (pixeles, y hacia abajo, frente hacia −z) con el mismo
// mapeo de UV por caja que el juego; la raíz los gira 180° en X para que queden de pie mirando a +z.
//
// Cada escena del tráiler pide grupos: {tipo, n, x, z, ancho, prof, dir, vel, modo, semilla, escala, y, retraso, escalonado}
//   tipo: pollito | oveja | cordero | cabra | cabrito | aldeano | granjero | aldeanito | lobo | calamar | strider | llama | cubito
//     y TODOS los de la biblioteca (texturas_mc/biblioteca/indice.json, herramientas/biblioteca.py): zombi, esqueleto, creeper,
//     cerdo, vaca, gato, caballo, enderman, warden… (también vale el id de Java: "zombie", "pig"). Con Fresh Animations + Bare
//     Bones si FA lo trae; si no, la geometría de tu Bedrock con animación básica (caminar, correr, quieto, cabeza que mira)
//   objeto: id de un objeto de Minecraft en la mano derecha (como LTezla: "diamond_sword", "apple"…) · bebe: true = cría
//   variante: textura del mob ("siames", "negro", "fria", "rojo"…; ver `variantes` en el índice). Se combina con los extras
//     usando "+": aldeano zombi "desierto+librero" (bioma + profesión), caballo "negro+patas_blancas". Sin variante = la primera
//     (los del tráiler quedan como en el video); también vale el nombre ("Siamés") o el de Java ("siamese")
//   x, z: centro del grupo relativo al ancla de la escena · ancho / prof: dispersión · dir: grados (0 = +z)
//   modo: caminar | correr | quieto | caer | lanzar | flotar · fijo: true = sin dispersión (para un solo mob)
//     caer: altura (bloques, 6) · gira: false = cae derecho y aterriza de pie (gólems que llegan del cielo), sin dar vueltas
//   arranque / parar: segundos en que empieza a moverse / se detiene (con anticipación y rebote)
//   ruta: [[x, z], ...] puntos por donde pasa (relativos al ancla) · suelo: false = no pisar el terreno
//   accion: {tipo: aullar | embestir | chocar | rodar | saltitos | picotear | pastar | sacudirse | atacar, en, dur, cada}
//     tiempos: [s, …] (saltitos y atacar): el salto aterriza / el golpe pega en cada instante (músicos en la nota exacta)
//     atacar: golpes cada `cada` s (0.8), `veces` (3): animación de ataque de Fresh Animations (swing_progress), brazos del
//     gólem como en Java, embestida corta hacia adelante; en los de Bedrock (warden) los brazos suben y bajan
//     aullar: sentarse (se sienta antes de aullar), fuerza (1 = 60°) · chocar: punto [x, z] de encuentro, empuja (1 / −1)
//   cancan: {tiempos: [s, …], par, patada (rad, 1.75), alterna, brazos, giros: [s…] (vuelta entera), cae: s (dominó)}: patada al frente con pico en cada tiempo, pierna
//     alterna (los vecinos al revés con `par`), saltito y brazos arriba (clásicos, CEM y Bedrock). Ej.: agente/cancan/rollo.py
//   calmo: true = quieto de verdad (sin pastar, sin sacudirse, miradas suaves) · rumbo: [[t, grados], ...] hacia dónde mira el cuerpo en cada momento (0 = +z) · saltaBorde: impulso hacia arriba (bloques/s) al llegar a una orilla alta (saltan del risco)
//   foco: true = la cámara enfoca a este mob · baul: true (llama con baúl) · color (cubito: verde | morado | rosa)
//
// ANIMACIÓN (estilo Actions & Stuff / Fresh Animations, ver analisis/investigacion_estilo_mojang.md): cada mob se
// SIMULA una vez por toma a 60 Hz, como el jugador en motor.js: velocidad con aceleración y frenado, ciclo de patas que
// avanza con la distancia recorrida (como el vanilla), cuerpo que sube/baja e inclina con resortes masa-resorte
// (x'' = ω²(objetivo − x) − 2ζω·x', los mismos RESORTES del jugador), cabeza, orejas y cola con retraso, miradas con
// "holds", y acciones por mob. El terreno se lee del escenario (bloque por bloque): pisan el suelo real, suben
// escalones de 1 bloque y esquivan paredes, casas, troncos y hongos. Todo es determinista (semilla): sale igual en
// la vista previa y al exportar.
import * as THREE from "three";
import { RESORTES } from "./motor.js";
import { BLOQUES, precargarMundos } from "./mundo.js";
import { cargarCEM, ModeloCEM, registrarVanilla, geoCajaCEM } from "./cem.js";
import { objetoListo, crearObjeto } from "./objetos.js";
import { precargarEfectos } from "./efectos.js";

const RUTA = "texturas_mc/entity/";
function rng(s) { let x = (Math.abs(Math.round(s)) * 9301 + 49297) % 233280 || 1; return () => (x = (x * 16807) % 2147483647) / 2147483647; }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const suave = (u) => u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u);
// pulso suave 0 → 1 → 0 entre a y b con subida/bajada de `r` segundos
const pulso = (t, a, b, r = 0.12) => Math.min(suave((t - a) / r), 1 - suave((t - b + r) / r));

// ───────────── texturas (capas que se combinan, como el aldeano: base + bioma + profesión) ─────────────
const cacheTex = new Map();
function lienzoTex(c) {
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace; t.generateMipmaps = false;
  return t;
}
function textura(capas, ancho, alto, tinte = null) {
  const clave = capas.join("+") + (tinte || "");
  if (cacheTex.has(clave)) return cacheTex.get(clave);
  const c = document.createElement("canvas"); c.width = ancho; c.height = alto;
  const x = c.getContext("2d"); x.imageSmoothingEnabled = false;
  const t = lienzoTex(c);
  capas = capas.map(n => n.startsWith("@@") ? n.slice(1) : n);
  if (capas[0].startsWith("@") && !capas[0].startsWith("@bib:")) {   // textura dibujada aquí (mobs sin textura en el .jar)
    PINTAR[capas[0].slice(1)](x, ancho, alto);
    t.listo = Promise.resolve(); t.needsUpdate = true;
    cacheTex.set(clave, t); return t;
  }
  const extra = capas.filter(n => n.startsWith("@") && !n.startsWith("@bib:")); capas = capas.filter(n => !n.startsWith("@") || n.startsWith("@bib:"));
  const imgs = capas.map(n => { const i = new Image(); i.src = n.startsWith("pack:") ? "texturas_mc/packs/mezcla/entity/" + n.slice(5) + ".png" : n.startsWith("@bib:") ? "texturas_mc/biblioteca/" + n.slice(5) + ".png" : RUTA + n + ".png"; return i; });
  t.listo = Promise.all(imgs.map(i => new Promise(r => { i.onload = r; i.onerror = r; }))).then(() => {
    for (const i of imgs) if (i.naturalWidth) x.drawImage(i, 0, 0, ancho, alto);
    if (tinte) {                                      // armadura teñida: multiplicar conservando la transparencia
      x.globalCompositeOperation = "multiply"; x.fillStyle = tinte; x.fillRect(0, 0, ancho, alto);
      x.globalCompositeOperation = "destination-in"; for (const i of imgs) if (i.naturalWidth) x.drawImage(i, 0, 0, ancho, alto);
      x.globalCompositeOperation = "source-over";
    }
    for (const n of extra) PINTAR[n.slice(1)]?.(x, ancho, alto);
    t.needsUpdate = true;
  });
  cacheTex.set(clave, t);
  return t;
}
export const texturasMobsListas = () => Promise.all([...cacheTex.values()].map(t => t.listo));

// "cubito": los mobs cúbicos con arnés rojo de los cerezos y el Nether del original (no están en el .jar: se
// dibujan aquí con la paleta medida en los cuadros). Caja de 10 px con cara, orejitas, patas, arnés y control.
const COLORES_CUBITO = {
  verde: ["#93d4a4", "#7cc28f", "#3f8f4e", "#2e6b3a"], morado: ["#a77cf0", "#9568e3", "#d4c1fa", "#6f45c9"],
  rosa: ["#d97fb4", "#c96ba3", "#f6e6ee", "#9a3f74"],
};
const PINTAR = {
  // correa roja de los cubitos (caja de 16 px de la cría de happy ghast, textura 64×64): cruza arriba, baja por los lados
  // y en el lado derecho lleva un control oscuro con 4 botones de colores (como en el original, 18.9 s)
  correa: (x) => {
    x.fillStyle = "#e0262d";
    x.fillRect(16, 6, 16, 2);                       // arriba
    x.fillRect(0, 22, 16, 2); x.fillRect(32, 22, 16, 2); x.fillRect(48, 22, 16, 2);   // vuelta por los lados y atrás
    x.fillStyle = "#26262e"; x.fillRect(36, 25, 8, 6);
    for (const [u, v, c] of [[37, 26, "#ff3b3b"], [39, 26, "#ffd43b"], [41, 28, "#3bdc6b"], [37, 28, "#3b8bff"]]) { x.fillStyle = c; x.fillRect(u, v, 1, 1); }
  },
};
// Easter egg: Clawd, la mascota de Claude Code (el bichito naranja de la pantalla de bienvenida), en voxel. Textura 32×32:
// cuerpo terracota con poco ruido, dos ojitos negros verticales arriba al frente; brazos y patas del mismo naranja
PINTAR.clawd = (x) => {
  const r = rng(77);
  for (let v = 0; v < 32; v++) for (let u = 0; u < 32; u++) { x.fillStyle = r() < 0.15 ? "#cc6b4c" : "#d97757"; x.fillRect(u, v, 1, 1); }
  x.fillStyle = "#c2603f"; x.fillRect(0, 10, 28, 1);                         // borde de abajo un poco más oscuro
  x.fillStyle = "#141414"; x.fillRect(8, 6, 1, 2); x.fillRect(11, 6, 1, 2);   // ojos (cara del frente: u 6..14, v 6..11)
};
for (const [nombre, [base, sombra, claro, oscuro]] of Object.entries(COLORES_CUBITO)) {
  PINTAR["cubito_" + nombre] = (x) => {
    const r = rng(nombre.length * 17 + 3);
    for (let v = 0; v < 32; v++) for (let u = 0; u < 64; u++) { x.fillStyle = r() < 0.22 ? sombra : base; x.fillRect(u, v, 1, 1); }
    // manchas oscuras arriba (como el musgo/pelo del original) y en las orejas
    for (let k = 0; k < 26; k++) { x.fillStyle = r() < 0.5 ? oscuro : sombra; x.fillRect(10 + Math.floor(r() * 10), Math.floor(r() * 10), 1 + Math.floor(r() * 2), 1); }
    x.fillStyle = oscuro; x.fillRect(10, 10, 10, 1); x.fillRect(40, 0, 12, 4);
    // cara (frente: u 10..20, v 10..20): ojos con brillo, boca chiquita
    x.fillStyle = "#1c1c24"; x.fillRect(12, 13, 2, 2); x.fillRect(16, 13, 2, 2);
    x.fillStyle = claro; x.fillRect(11, 13, 1, 1); x.fillRect(15, 13, 1, 1);
    x.fillStyle = "#1c1c24"; x.fillRect(14, 16, 1, 1); x.fillRect(15, 17, 1, 1); x.fillRect(16, 16, 1, 1);
    // patas
    x.fillStyle = sombra; x.fillRect(40, 10, 8, 5);
    // arnés rojo (v 24..26) y control con botones (u 48..56, v 20..24)
    x.fillStyle = "#e02a2a"; x.fillRect(0, 15, 10, 2); x.fillRect(20, 15, 20, 2); x.fillRect(10, 4, 10, 2); x.fillRect(19, 10, 1, 7);
    x.fillStyle = "#2b2b33"; x.fillRect(48, 20, 8, 6);
    for (const [u, c] of [[49, "#e83a3a"], [51, "#f3d53a"], [53, "#3bd16a"], [55, "#3a8be8"]]) { x.fillStyle = c; x.fillRect(u, 21 + (u % 2), 1, 1); }
    if (nombre === "rosa") { x.fillStyle = claro; for (let u = 40; u < 52; u += 2) x.fillRect(u, 4, 1, 3); }
  };
}

// ───────────── caja con UV de Minecraft ─────────────
// (x, y, z) esquina mínima en pixeles de modelo · (u, v) origen en la textura · tw, th tamaño de la textura
function geoCaja([x, y, z, w, h, d], [u, v], tw, th, inflar = 0, espejo = false) {
  const x0 = x - inflar, y0 = y - inflar, z0 = z - inflar, x1 = x + w + inflar, y1 = y + h + inflar, z1 = z + d + inflar;
  const R = (a, b, c, e) => [a, b, c, e];
  let rr = {                                          // [u, v, ancho, alto] de cada cara
    frente: R(u + d, v + d, w, h), atras: R(u + 2 * d + w, v + d, w, h),
    der: R(u, v + d, d, h), izq: R(u + d + w, v + d, d, h),
    arriba: R(u + d, v, w, d), abajo: R(u + d + w, v, w, d),
  };
  if (espejo) rr = { ...rr, der: rr.izq, izq: rr.der };
  // cada cara: 4 esquinas (arriba-izq, arriba-der, abajo-izq, abajo-der de la textura) y su normal
  const caras = [
    [rr.frente, [[x0, y0, z0], [x1, y0, z0], [x0, y1, z0], [x1, y1, z0]], [0, 0, -1]],
    [rr.atras, [[x1, y0, z1], [x0, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1]],
    [rr.der, [[x0, y0, z1], [x0, y0, z0], [x0, y1, z1], [x0, y1, z0]], [-1, 0, 0]],
    [rr.izq, [[x1, y0, z0], [x1, y0, z1], [x1, y1, z0], [x1, y1, z1]], [1, 0, 0]],
    [rr.arriba, [[x0, y0, z1], [x1, y0, z1], [x0, y0, z0], [x1, y0, z0]], [0, -1, 0]],
    [rr.abajo, [[x0, y1, z0], [x1, y1, z0], [x0, y1, z1], [x1, y1, z1]], [0, 1, 0]],
  ];
  const pos = [], nor = [], uv = [], idx = [];
  for (const [[tu, tv, tW, tH], q, n] of caras) {
    if (tW <= 0 || tH <= 0) continue;
    let uA = tu, uB = tu + tW;
    if (espejo) [uA, uB] = [uB, uA];
    const uvs = [[uA, tv], [uB, tv], [uA, tv + tH], [uB, tv + tH]];
    const b = pos.length / 3;
    for (let k = 0; k < 4; k++) { pos.push(...q[k]); nor.push(...n); uv.push(uvs[k][0] / tw, 1 - uvs[k][1] / th); }
    // orden de los triángulos según la normal hacia afuera
    const a = new THREE.Vector3(...q[0]), e1 = new THREE.Vector3(...q[2]).sub(a), e2 = new THREE.Vector3(...q[1]).sub(a);
    if (e1.cross(e2).dot(new THREE.Vector3(...n)) > 0) idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
    else idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

// nodo: {n: nombre, p: pivote, r: rotación (rad, orden ZYX como Minecraft), c: [[uv, caja, inflar, espejo, capa]], h: hijos}
function armar(def, mats, tw, th, nodos) {
  const g = new THREE.Group();
  g.position.set(...(def.p || [0, 0, 0]));
  g.rotation.order = "ZYX"; g.rotation.set(...(def.r || [0, 0, 0]));
  g.userData.base = g.rotation.clone();
  for (const [uv, caja, inflar = 0, espejo = false, capa = 0] of def.c || []) {
    if (!mats[capa]) continue;
    const m = new THREE.Mesh(geoCaja(caja, uv, tw, th, inflar, espejo), mats[capa]);
    m.castShadow = true; m.receiveShadow = true;
    g.add(m);
  }
  for (const h of def.h || []) g.add(armar(h, mats, tw, th, nodos));
  if (def.n) nodos[def.n] = g;
  return g;
}

const mat = (tex, extra = {}) => new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92, metalness: 0, alphaTest: 0.1, side: THREE.DoubleSide, ...extra });

// ───────────── modelos (Java Edition) ─────────────
const PI = Math.PI;
const piernasCuad = (lista, y, uv, caja, extra = []) => lista.map(([n, x, z, espejo]) => ({ n, p: [x, y, z], c: [[uv, caja, 0, !!espejo], ...extra] }));
const MODELOS = {
  aldeano: { tw: 64, th: 64, capas: () => [["villager__villager", "villager__type__plains"]],
    def: { h: [
      { n: "cabeza", c: [[[0, 0], [-4, -10, -4, 8, 10, 8]]], h: [{ p: [0, -2, 0], c: [[[24, 0], [-1, -1, -6, 2, 4, 2]]] }] },
      { n: "cuerpo", c: [[[16, 20], [-4, 0, -3, 8, 12, 6]], [[0, 38], [-4, 0, -3, 8, 20, 6], 0.5]] },
      { n: "brazos", p: [0, 3, -1], r: [-0.75, 0, 0], c: [[[44, 22], [-8, -2, -2, 4, 8, 4]], [[44, 22], [4, -2, -2, 4, 8, 4], 0, true], [[40, 38], [-4, 2, -2, 8, 4, 4]]] },
      { n: "piernaD", p: [-2, 12, 0], c: [[[0, 22], [-2, 0, -2, 4, 12, 4]]] },
      { n: "piernaI", p: [2, 12, 0], c: [[[0, 22], [-2, 0, -2, 4, 12, 4], 0, true]] },
    ] } },
  // granjero: mismo aldeano + sombrero de paja (corona inflada y ala de 16×16)
  granjero: { tw: 64, th: 64, capas: () => [["villager__villager", "villager__type__plains", "villager__profession__farmer"]],
    def: { h: [
      { n: "cabeza", c: [[[0, 0], [-4, -10, -4, 8, 10, 8]], [[32, 0], [-4, -10, -4, 8, 10, 8], 0.51]],
        h: [{ p: [0, -2, 0], c: [[[24, 0], [-1, -1, -6, 2, 4, 2]]] }, { r: [-PI / 2, 0, 0], c: [[[30, 47], [-8, -8, -6, 16, 16, 1]]] }] },
      { n: "cuerpo", c: [[[16, 20], [-4, 0, -3, 8, 12, 6]], [[0, 38], [-4, 0, -3, 8, 20, 6], 0.5]] },
      { n: "brazos", p: [0, 3, -1], r: [-0.75, 0, 0], c: [[[44, 22], [-8, -2, -2, 4, 8, 4]], [[44, 22], [4, -2, -2, 4, 8, 4], 0, true], [[40, 38], [-4, 2, -2, 8, 4, 4]]] },
      { n: "piernaD", p: [-2, 12, 0], c: [[[0, 22], [-2, 0, -2, 4, 12, 4]]] },
      { n: "piernaI", p: [2, 12, 0], c: [[[0, 22], [-2, 0, -2, 4, 12, 4], 0, true]] },
    ] } },
  // pollito (modelo nuevo de bebé: cubo de 4 px con pico, alitas y patas)
  pollito: { tw: 16, th: 16, capas: () => [["chicken__chicken_temperate_baby"]],
    def: { h: [
      { n: "cuerpo", p: [0, 22, 0], c: [[[0, 0], [-2, -4, -2, 4, 4, 4]], [[10, 8], [-1, -2, -3, 2, 1, 1]]],
        h: [{ n: "alaD", p: [-2, -2.5, 0], c: [[[5, 7], [-0.5, 0, -0.5, 1, 2, 1]]] }, { n: "alaI", p: [2, -2.5, 0], c: [[[5, 7], [-0.5, 0, -0.5, 1, 2, 1], 0, true]] }] },
      { n: "piernaD", p: [-1, 22, 0], c: [[[0, 1], [-0.5, 0, -0.5, 1, 2, 1]]] },
      { n: "piernaI", p: [1, 22, 0], c: [[[0, 1], [-0.5, 0, -0.5, 1, 2, 1], 0, true]] },
    ] }, escala: 1.4 },
  oveja: { tw: 64, th: 32, capas: () => [["sheep__sheep"], ["sheep__sheep_wool"]],
    def: { h: [
      { n: "cabeza", p: [0, 6, -8], c: [[[0, 0], [-3, -4, -6, 6, 6, 8]], [[0, 0], [-3, -4, -4, 6, 6, 6], 0.6, false, 1]] },
      { n: "cuerpo", p: [0, 5, 2], r: [PI / 2, 0, 0], c: [[[28, 8], [-4, -10, -7, 8, 16, 6]], [[28, 8], [-4, -10, -7, 8, 16, 6], 1.75, false, 1]] },
      ...[["piernaDT", -3, 7], ["piernaIT", 3, 7], ["piernaDF", -3, -5], ["piernaIF", 3, -5]].map(([n, x, z]) => ({ n, p: [x, 12, z], c: [[[0, 16], [-2, 0, -2, 4, 12, 4]], [[0, 16], [-2, 0, -2, 4, 6, 4], 0.5, false, 1]] })),
    ] } },
  cabra: { tw: 64, th: 64, capas: () => [["goat__goat"]],
    def: { h: [
      { n: "cabeza", p: [1, 14, 0], c: [[[2, 61], [-6, -11, -10, 3, 2, 1]], [[2, 61], [2, -11, -10, 3, 2, 1], 0, true], [[23, 52], [-0.5, -3, -14, 0, 7, 5]], [[12, 55], [-0.01, -16, -10, 2, 7, 2]], [[12, 55], [-2.99, -16, -10, 2, 7, 2]]],
        h: [{ p: [0, -8, -8], r: [0.9599, 0, 0], c: [[[34, 46], [-3, -4, -8, 5, 7, 10]]] }] },
      { n: "cuerpo", p: [0, 24, 0], c: [[[1, 1], [-4, -17, -7, 9, 11, 16]], [[0, 28], [-5, -18, -8, 11, 14, 11]]] },
      { n: "piernaIT", p: [1, 14, 4], c: [[[36, 29], [0, 4, 0, 3, 6, 3]]] },
      { n: "piernaDT", p: [-3, 14, 4], c: [[[49, 29], [0, 4, 0, 3, 6, 3]]] },
      { n: "piernaIF", p: [1, 14, -6], c: [[[49, 2], [0, 0, 0, 3, 10, 3]]] },
      { n: "piernaDF", p: [-3, 14, -6], c: [[[35, 2], [0, 0, 0, 3, 10, 3]]] },
    ] } },
  // lobo: orejas como huesos propios (se sacuden con inercia) y armadura en cabeza, cuerpo, melena, patas y cola
  lobo: { tw: 64, th: 32, capas: (g) => [["wolf__wolf"], ...(g.armadura ? [["armadillo_scute__wolfbody", g.armadura]] : [])],
    def: { h: [
      { n: "cabeza", p: [-1, 13.5, -7], c: [[[0, 0], [-2, -3, -2, 6, 6, 4]], [[0, 10], [-0.5, -0.001, -5, 3, 3, 4]], [[0, 0], [-2, -3, -2, 6, 6, 4], 0.2, false, 1], [[0, 10], [-0.5, -0.001, -5, 3, 3, 4], 0.2, false, 1]],
        h: [{ n: "orejaD", p: [-1, -3, 0.5], c: [[[16, 14], [-1, -2, -0.5, 2, 2, 1]], [[16, 14], [-1, -2, -0.5, 2, 2, 1], 0.15, false, 1]] },
          { n: "orejaI", p: [3, -3, 0.5], c: [[[16, 14], [-1, -2, -0.5, 2, 2, 1]], [[16, 14], [-1, -2, -0.5, 2, 2, 1], 0.15, false, 1]] }] },
      { n: "cuerpo", p: [0, 14, 2], r: [PI / 2, 0, 0], c: [[[18, 14], [-3, -2, -3, 6, 9, 6]], [[18, 14], [-3, -2, -3, 6, 9, 6], 0.2, false, 1]] },
      { n: "melena", p: [-1, 14, -3], r: [PI / 2, 0, 0], c: [[[21, 0], [-3, -3, -3, 8, 6, 7]], [[21, 0], [-3, -3, -3, 8, 6, 7], 0.2, false, 1]] },
      ...[["piernaDT", -2.5, 7], ["piernaIT", 0.5, 7], ["piernaDF", -2.5, -4], ["piernaIF", 0.5, -4]].map(([n, x, z]) => ({ n, p: [x, 16, z], c: [[[0, 18], [0, 0, -1, 2, 8, 2]], [[0, 18], [0, 0, -1, 2, 8, 2], 0.2, false, 1]] })),
      { n: "cola", p: [-1, 12, 8], r: [0.75, 0, 0], c: [[[9, 18], [0, 0, -1, 2, 8, 2]], [[9, 18], [0, 0, -1, 2, 8, 2], 0.2, false, 1]] },
    ] } },
  calamar: { tw: 64, th: 32, capas: () => [["squid__glow_squid"]], brillo: true,
    def: { h: [
      { n: "cuerpo", p: [0, 8, 0], c: [[[0, 0], [-6, -8, -6, 12, 16, 12]]] },
      ...Array.from({ length: 8 }, (_, i) => { const a = i * PI * 2 / 8 + PI / 2; return { n: "tent" + i, p: [Math.cos(a) * 5, 15, Math.sin(a) * 5], r: [0, -a + PI / 2, 0], c: [[[48, 0], [-1, 0, -1, 2, 18, 2]]] }; }),
    ] } },
  // strider: cuerpo con 6 pelos (planos) que se mueven, y patas largas
  strider: { tw: 64, th: 128, capas: () => [["strider__strider"]],
    def: { h: [
      { n: "cuerpo", p: [0, 1, 0], c: [[[0, 0], [-8, -6, -8, 16, 14, 16]]],
        h: [{ n: "pelo0", p: [-8, 4, -8], r: [0, 0, 1.0472], c: [[[16, 65], [-12, 0, 0, 12, 0, 16]]] }, { n: "pelo1", p: [-8, -1, -8], r: [0, 0, 1.0472], c: [[[16, 49], [-12, 0, 0, 12, 0, 16]]] },
          { n: "pelo2", p: [-8, -5, -8], r: [0, 0, 1.0472], c: [[[16, 33], [-12, 0, 0, 12, 0, 16]]] }, { n: "pelo3", p: [8, -6, -8], r: [0, 0, -1.0472], c: [[[16, 33], [0, 0, 0, 12, 0, 16], 0, true]] },
          { n: "pelo4", p: [8, -2, -8], r: [0, 0, -1.0472], c: [[[16, 49], [0, 0, 0, 12, 0, 16], 0, true]] }, { n: "pelo5", p: [8, 3, -8], r: [0, 0, -1.0472], c: [[[16, 65], [0, 0, 0, 12, 0, 16], 0, true]] }] },
      { n: "piernaD", p: [-4, 8, 0], c: [[[0, 32], [-2, 0, -2, 4, 16, 4]]] },
      { n: "piernaI", p: [4, 8, 0], c: [[[0, 55], [-2, 0, -2, 4, 16, 4]]] },
    ] } },
  llama: { tw: 128, th: 64, capas: () => [["llama__llama_creamy"]],
    def: (g) => ({ h: [
      { n: "cabeza", p: [0, 7, -6], c: [[[0, 0], [-2, -14, -10, 4, 4, 9]], [[0, 14], [-4, -16, -6, 8, 18, 6]], [[17, 0], [-4, -19, -4, 3, 3, 2]], [[17, 0], [1, -19, -4, 3, 3, 2]]] },
      { n: "cuerpo", p: [0, 5, 2], r: [PI / 2, 0, 0], c: [[[29, 0], [-6, -10, -7, 12, 18, 10]]] },
      ...(g.baul ? [{ n: "baulD", p: [-8.5, 3, 3], r: [0, PI / 2, 0], c: [[[45, 28], [-3, 0, 0, 8, 8, 3]]] }, { n: "baulI", p: [5.5, 3, 3], r: [0, PI / 2, 0], c: [[[45, 41], [-3, 0, 0, 8, 8, 3]]] }] : []),
      ...[["piernaDT", -3.5, 6], ["piernaIT", 3.5, 6], ["piernaDF", -3.5, -5], ["piernaIF", 3.5, -5]].map(([n, x, z]) => ({ n, p: [x, 10, z], c: [[[29, 29], [-2, 0, -2, 4, 14, 4]]] })),
    ] }) },
  cubito: { tw: 64, th: 32, capas: (g) => [["@cubito_" + (g.color || "verde")]],
    def: { h: [
      { n: "cuerpo", p: [0, 21, 0], c: [[[0, 0], [-5, -10, -5, 10, 10, 10]], [[48, 20], [5.1, -8, -2, 0.6, 4, 4]]],
        h: [{ n: "orejaD", p: [-3.5, -10, 0], c: [[[40, 0], [-1, -2, -1, 2, 2, 2]]] }, { n: "orejaI", p: [3.5, -10, 0], c: [[[40, 0], [-1, -2, -1, 2, 2, 2]]] }] },
      ...piernasCuad([["piernaDF", -3, -3], ["piernaIF", 3, -3], ["piernaDT", -3, 3], ["piernaIT", 3, 3]], 21, [40, 10], [-1, 0, -1, 2, 3, 2]),
    ] } },
};
// Clawd (easter egg): cuerpo de 8×5×6 px, bracitos a los lados y cuatro patitas; camina como los cubitos
MODELOS.clawd = { tw: 32, th: 32, capas: () => [["@clawd"]], escala: 1.15,
  def: { h: [
    { n: "cuerpo", p: [0, 22, 0], c: [[[0, 0], [-4, -5, -3, 8, 5, 6]], [[0, 14], [-6, -3, -1, 2, 1, 2]], [[0, 14], [4, -3, -1, 2, 1, 2]]] },
    ...piernasCuad([["piernaDF", -2.5, -1.5], ["piernaIF", 2.5, -1.5], ["piernaDT", -2.5, 1.5], ["piernaIT", 2.5, 1.5]], 22, [0, 20], [-0.5, 0, -0.5, 1, 2, 1]),
  ] } };
// cerdo_error ("El creeper nació de un error"): el cerdo vanilla con su cuerpo de 10×16×8. Campos del grupo (curvas
// [[t, valor], …] en tiempo de la toma): error (0 = cerdo, 1 = cuerpo de pie como creeper; > 1 pasa de largo),
// verde (0..1: los pixeles cambian uno a uno de la piel de cerdo a la del creeper), mecha [t0, t1] (se infla y parpadea
// en blanco como un creeper a punto de explotar), hasta (s: desaparece). Ver posarError.
MODELOS.cerdo_error = { tw: 64, th: 64, capas: () => [["@@cerdo_error"]], error: true,
  def: { h: [
    { n: "cabeza", p: [0, 12, -6], c: [[[0, 0], [-4, -4, -8, 8, 8, 8]]], h: [{ n: "hocico", p: [0, 0, -8], c: [[[16, 16], [-2, 0, -1, 4, 3, 1]]] }] },
    { n: "cuerpo", p: [0, 11, 2], r: [PI / 2, 0, 0], c: [[[28, 8], [-5, -10, -7, 10, 16, 8]]] },
    ...piernasCuad([["piernaDT", -3, 7], ["piernaIT", 3, 7, true], ["piernaDF", -3, -5], ["piernaIF", 3, -5, true]], 18, [0, 16], [-2, 0, -2, 4, 6, 4]),
  ] } };
MODELOS.cordero = { ...MODELOS.oveja, capas: () => [["sheep__sheep_baby"], ["sheep__sheep_wool_baby"]], escala: 0.55, cabeza: 1.5 };
MODELOS.cabrito = { ...MODELOS.cabra, escala: 0.55, cabeza: 1.4 };
MODELOS.aldeanito = { ...MODELOS.aldeano, escala: 0.55, cabeza: 1.35 };

export const TIPOS_MOB = () => Object.keys(MODELOS);          // incluye la biblioteca una vez cargada (cargarBiblioteca)
const crearObjetoMano = (id) => crearObjeto(id).then(g => { objetoListo(id); return g; });
// física por tipo: marcha, zancada (bloques por ciclo de patas), ancho y alto (bloques, sin escala),
// centro (px de modelo: alrededor de dónde se inclina el cuerpo), velocidad de referencia
const FISICA = {
  aldeano: { marcha: "bipedo", zancada: 1.0, ancho: 0.6, alto: 1.95, centro: 2, vRef: 1.6 },
  pollito: { marcha: "pollito", zancada: 0.42, ancho: 0.3, alto: 0.4, centro: 1, vRef: 1.2 },
  oveja: { marcha: "cuadrupedo", zancada: 1.05, ancho: 0.9, alto: 1.3, centro: 13, vRef: 1.5 },
  cabra: { marcha: "cuadrupedo", zancada: 1.1, ancho: 0.9, alto: 1.3, centro: 12, vRef: 1.6 },
  lobo: { marcha: "cuadrupedo", zancada: 0.9, ancho: 0.6, alto: 0.85, centro: 10, vRef: 1.4 },
  calamar: { marcha: "calamar", zancada: 1, ancho: 0.8, alto: 0.8, centro: 8, vRef: 1 },
  strider: { marcha: "strider", zancada: 1.3, ancho: 0.9, alto: 1.7, centro: 16, vRef: 1.2 },
  llama: { marcha: "cuadrupedo", zancada: 1.2, ancho: 0.9, alto: 1.87, centro: 14, vRef: 1.5 },
  cubito: { marcha: "cubito", zancada: 0.6, ancho: 0.62, alto: 0.7, centro: 1, vRef: 1.2 },
  clawd: { marcha: "cubito", zancada: 0.4, ancho: 0.6, alto: 0.45, centro: 3, vRef: 1.2 },
};
FISICA.granjero = FISICA.aldeanito = FISICA.aldeano; FISICA.cordero = FISICA.oveja; FISICA.cabrito = FISICA.cabra;
FISICA.cerdo_error = { marcha: "cuadrupedo", zancada: 0.9, ancho: 0.9, alto: 0.9, centro: 14, vRef: 1.3 };

// ───────────── cerdo_error: la piel de cerdo y la del creeper reacomodada al molde del cerdo ─────────────
// cabeza (0,0) y patas (0,16) tienen el mismo molde en los dos; el cuerpo del creeper (8×12×4 en 16,16) se estira a cada
// cara del cuerpo del cerdo (10×16×8 en 28,8). El hocico no existe en el creeper: se encoge con `verde`.
const ERR = { pig: new Image(), cre: new Image(), A: null, B: null };
ERR.pig.src = "texturas_mc/packs/mezcla/entity/pig__temperate_pig.png";
ERR.cre.src = "texturas_mc/packs/mezcla/entity/creeper__creeper.png";
ERR.listo = Promise.all([ERR.pig, ERR.cre].map(i => new Promise(r => { if (i.complete && i.naturalWidth) r(); else { i.onload = r; i.onerror = r; } }))).then(() => {
  const c = document.createElement("canvas"); c.width = 64; c.height = 64;
  const x = c.getContext("2d", { willReadFrequently: true }); x.imageSmoothingEnabled = false;
  x.drawImage(ERR.pig, 0, 0, 64, 64); ERR.A = x.getImageData(0, 0, 64, 64);
  x.clearRect(0, 0, 64, 64);
  const s = ERR.cre.naturalWidth / 64;                                          // 64×32 (o el doble en packs HD)
  const cp = (sx, sy, sw, sh, dx, dy, dw, dh) => x.drawImage(ERR.cre, sx * s, sy * s, sw * s, sh * s, dx, dy, dw, dh);
  cp(0, 0, 32, 16, 0, 0, 32, 16);                                               // cabeza (misma posición)
  cp(0, 16, 16, 10, 0, 16, 16, 10);                                             // patas
  const caras = (u, v, w, h, d) => [[u + d, v, w, d], [u + d + w, v, w, d], [u, v + d, d, h], [u + d, v + d, w, h], [u + d + w, v + d, d, h], [u + d + w + d, v + d, w, h]];
  const de = caras(16, 16, 8, 12, 4), a = caras(28, 8, 10, 16, 8);
  de.forEach((f, i) => cp(...f, ...a[i]));
  cp(8, 8, 4, 3, 17, 17, 4, 3);                                                 // donde estaba el hocico: un pedazo de cara verde
  ERR.B = x.getImageData(0, 0, 64, 64);
});
cacheTex.set("cerdo_error#listo", { listo: ERR.listo });
PINTAR.cerdo_error = (x) => { if (ERR.A) x.putImageData(ERR.A, 0, 0); };
// curva [[t, v], …] con interpolación suave entre claves
const curvaT = (k, t, def = 0) => {
  if (k == null) return def;
  if (typeof k === "number") return k;
  if (t <= k[0][0]) return k[0][1];
  for (let i = 1; i < k.length; i++) if (t < k[i][0]) { const u = suave((t - k[i - 1][0]) / Math.max(1e-3, k[i][0] - k[i - 1][0])); return k[i - 1][1] + (k[i][1] - k[i - 1][1]) * u; }
  return k[k.length - 1][1];
};
const hashPx = (i) => { let h = (i * 2654435761) >>> 0; h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0; h ^= h >>> 13; return (h >>> 0) / 4294967296; };
function posarError(m, g, t) {
  const N = m.nodos, e = curvaT(g.error, t), v = Math.max(0, Math.min(1, curvaT(g.verde, t)));
  const lerp = (a, b, u) => a + (b - a) * u;
  if (N.cuerpo) N.cuerpo.rotation.x = PI / 2 * (1 - e);
  const eh = Math.max(0, Math.min(1.1, e)), arco = Math.sin(Math.min(1, eh) * PI) * 4;   // la cabeza sube en arco
  if (N.cabeza) N.cabeza.position.set(0, lerp(12, -3, eh) - arco, lerp(-6, 3, eh));
  for (const [n, z0, z1] of [["piernaDT", 7, 2.5], ["piernaIT", 7, 2.5], ["piernaDF", -5, -4.5], ["piernaIF", -5, -4.5]]) if (N[n]) N[n].position.z = lerp(z0, z1, Math.min(1, eh));
  if (N.hocico) N.hocico.scale.setScalar(Math.max(0.001, 1 - suave(v / 0.6)));
  // textura: cada pixel cambia cuando su número (fijo) queda debajo de `verde`
  if (!m.err && ERR.B) {
    const c = document.createElement("canvas"); c.width = 64; c.height = 64;
    const tex = lienzoTex(c);
    m.err = { c, x: c.getContext("2d"), tex, img: new ImageData(64, 64), nivel: -1 };
    m.raiz.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.map = tex; o.material.emissive = new THREE.Color(1, 1, 1); o.material.emissiveIntensity = 0; } });
  }
  if (m.err) {
    const nivel = Math.round(v * 400);
    if (nivel !== m.err.nivel) {
      const D = m.err.img.data, A = ERR.A.data, B = ERR.B.data, u = nivel / 400;
      for (let i = 0; i < 4096; i++) { const src = hashPx(i + 7) < u && B[i * 4 + 3] > 0 ? B : A; for (let j = 0; j < 4; j++) D[i * 4 + j] = src[i * 4 + j]; }
      m.err.x.putImageData(m.err.img, 0, 0); m.err.tex.needsUpdate = true; m.err.nivel = nivel;
    }
    // mecha: se infla y parpadea en blanco cada vez más rápido (como el creeper en el juego)
    let fl = 0, inf = 0;
    if (g.mecha && t >= g.mecha[0]) {
      const u = Math.min(1, (t - g.mecha[0]) / Math.max(0.05, g.mecha[1] - g.mecha[0]));
      fl = Math.max(0, Math.sin(PI * (2 + 2 * u) * (t - g.mecha[0]))) ** 2 * (0.4 + 0.6 * u); inf = u * u * 0.38;   // ≤ 2 destellos/s (seguro para fotosensibles)
    }
    m.raiz.traverse(o => { if (o.isMesh) o.material.emissiveIntensity = fl * 0.6; });
    m.escala.scale.multiply(new THREE.Vector3(1 + inf, 1 + inf * 0.7, 1 + inf));
  }
  if (g.hasta != null && t >= g.hasta) m.raiz.visible = false;
}

// ───────────── Fresh Animations + Bare Bones (modelos .jem y animaciones .jpm de texturas_mc/packs) ─────────────
// por tipo: capas [modelo CEM, texturas de texturas_mc/packs/mezcla/entity (se pintan una sobre otra), tinte]
const CAPAS_CEM = {
  // armadura de lobo: como en el juego, la base de escamas va sin teñir y el "overlay" lleva el color del tinte
  lobo: (g) => [["wolf", ["wolf"]], ...(g.armadura ? [["wolf_armor", ["wolf_armor"]], ["wolf_armor", ["wolf_armor_overlay"], g.armadura]] : [])],
  // el pollito NO usa Fresh Animations: Bare Bones (1.21.11) no trae el pollito bebé nuevo (cubo amarillo) que sale en el
  // original, así que se queda el modelo bebé de tu .jar con la animación propia (saltitos, aleteo, picoteo)
  // variante de la oveja = color de la lana (tinte como en Java); sin variante, la blanca del tráiler
  oveja: (g) => [["sheep", ["sheep"]], ["sheep_wool", ["sheep_wool"], partesVariante(CATALOGO.porId.oveja, g.variante).v?.tinte]],
  cabra: () => [["goat", ["goat"]]],
  aldeano: () => [["villager", ["villager", "villager_plains"]]],
  granjero: () => [["villager", ["villager", "villager_plains", "villager_farmer"]]],
  calamar: () => [["glow_squid", ["glow_squid"]]],
  strider: () => [["strider", ["strider"]]],
  llama: (g) => [["llama", [partesVariante(CATALOGO.porId.llama, g.variante).v?.tex || "llama_creamy"]]],
  // los "cubitos" del original: crías de happy ghast teñidas, con la correa roja y el control lateral dibujados encima
  cubito: (g) => [["happy_ghast_baby", ["happy_ghast_baby", "@correa"], { verde: "#9fe0a8", morado: "#b48af5", rosa: "#e58cc0" }[g.color || "verde"]]],
};
CAPAS_CEM.cordero = CAPAS_CEM.oveja; CAPAS_CEM.cabrito = CAPAS_CEM.cabra; CAPAS_CEM.aldeanito = CAPAS_CEM.aldeano;
const NINOS = new Set(["pollito", "cordero", "cabrito", "aldeanito", "cubito"]);
const DEFS_CEM = {};
let cemListo = null;
export function cargarModelosCEM() {
  cemListo ??= Promise.all([...new Set(Object.values(CAPAS_CEM).flatMap(f => f({ armadura: "#fff" }).map(c => c[0])))].map(async n => { DEFS_CEM[n] = await cargarCEM(n); }))
    .then(() => Object.keys(DEFS_CEM).filter(n => DEFS_CEM[n]).length);
  return cemListo;
}
const texPack = (lista, tw, th, tinte) => textura(lista.map(n => n.startsWith("@") ? n : "pack:" + n), tw, th, tinte);
const CEM_BASE = new Set(Object.keys(CAPAS_CEM));         // los del tráiler se cargan al abrir; los de la biblioteca, al usarlos

// ───────────── biblioteca: todos los mobs del índice (herramientas/biblioteca.py → texturas_mc/biblioteca/indice.json) ─────────────
// fuente "fresh": modelos y animaciones de Fresh Animations con texturas de Bare Bones (como los del tráiler)
// fuente "bedrock": geometría de tu Minecraft Bedrock (.geo.json) con animación básica hecha aquí (patas, brazos, cabeza, alas, cola)
const sinAcentos = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
export const CATALOGO = { mobs: [], porId: {}, alias: {}, resumen: null };
let bibListo = null;
const MARCHAS = { bipedo: "bipedo", cuadrupedo: "cuadrupedo", volar: "volar", flotar: "volar", nadar: "nadar", saltar: "saltar", quieto: "cuadrupedo" };
function registrarTipo(e) {
  const esc = e.escala || 1, marcha = MARCHAS[e.marcha] || "cuadrupedo";
  const ancho = (e.tam?.[0] || 0.6) / esc, alto = (e.tam?.[1] || 1) / esc;
  FISICA[e.id] = { marcha, zancada: clamp(alto * 0.5 + ancho * 0.45, 0.45, 2.4), ancho, alto, centro: Math.round(alto * 8), vRef: marcha === "bipedo" ? 1.6 : 1.4 };
  MODELOS[e.id] = { escala: esc, generico: e };
  if (e.fuente === "fresh") CAPAS_CEM[e.id] = (g) => {
    const { v, extras } = partesVariante(e, g.variante);
    const capas = (v || e.variantes?.[0])?.capas || e.capas.map(([jem, clave]) => [jem, [clave]]);
    const out = capas.map(([jem, cs]) => [jem, [...cs]]);
    for (const x of extras) out[x.capa ?? 0]?.[1].push(x.tex);          // profesión, marcas del caballo: encima
    return out;
  };
}
// variante del grupo ("siames", "Siamés", "siamese", "desierto+librero") → { v: la variante, extras: […], malas: [partes que no existen] }
function partesVariante(e, txt) {
  const out = { v: null, extras: [], malas: [] };
  if (!e || txt == null || txt === "") return out;
  // sin acentos y sin importar el género ("fria" = "frio", "blanca" = "blanco")
  const igual = (a, b) => { a = sinAcentos(a); b = sinAcentos(b); return a === b || (a.length > 3 && a.replace(/[ao]$/, "") === b.replace(/[ao]$/, "")); };
  for (const p of String(txt).split(/[+,]/).map(s => s.trim()).filter(Boolean)) {
    const de = (l) => (l || []).find(x => [x.id, x.nombre, x.java].some(n => n && igual(n, p)));
    const v = de(e.variantes), x = !v && de(e.extras);
    if (v) out.v = v; else if (x) out.extras.push(x); else out.malas.push(p);
  }
  return out;
}
// para la interfaz y el agente: la variante escrita como la guarda el proyecto ("desierto+librero"), o error con las opciones
export function leerVariante(tipo, txt) {
  const e = CATALOGO.porId[tipo];
  const { v, extras, malas } = partesVariante(e, txt);
  const opciones = [...(e?.variantes || []).map(x => x.id), ...(e?.extras || []).map(x => "+" + x.id)];
  if (malas.length) return { error: opciones.length ? `${tipo} no tiene la variante "${malas.join("+")}" (opciones: ${opciones.join(", ")})` : `${tipo} no tiene variantes`, opciones };
  return { variante: [v?.id, ...extras.map(x => x.id)].filter(Boolean).join("+") || null, opciones };
}
export function cargarBiblioteca() {
  bibListo ??= fetch("texturas_mc/biblioteca/indice.json").then(r => r.ok ? r.json() : null).catch(() => null).then(ind => {
    if (!ind) return CATALOGO;
    registrarVanilla(ind.vanilla);
    CATALOGO.resumen = ind.resumen;
    CATALOGO.mobs = ind.mobs.filter(e => e.fuente === "propio" ? MODELOS[e.id] : true);
    for (const e of CATALOGO.mobs) { CATALOGO.porId[e.id] = e; if (e.fuente !== "propio") registrarTipo(e); }
    // alias: id de Java y nombre en español / inglés (los de la biblioteca antes que los propios: "chicken" = gallina adulta)
    for (const propio of [false, true]) for (const e of CATALOGO.mobs) if ((e.fuente === "propio") === propio)
      for (const a of [e.java, sinAcentos(e.nombre), sinAcentos(e.nombre_en)]) if (a && !CATALOGO.alias[a] && !MODELOS[a]) CATALOGO.alias[a] = e.id;
    return CATALOGO;
  });
  return bibListo;
}
// nombre que escribe el usuario o el agente → tipo del animador (o undefined si no existe)
export function resolverTipo(t) {
  if (!t) return undefined;
  if (MODELOS[t]) return t;
  return CATALOGO.alias[t] || CATALOGO.alias[sinAcentos(t)] || (MODELOS[sinAcentos(t)] ? sinAcentos(t) : undefined);
}

// ── geometría de Bedrock → partes en el espacio de modelo de Java (y hacia abajo, 24 = piso), como MODELOS
const DEFS_BE = {}, PROM_BE = {};
function cargarBE(id) {
  PROM_BE[id] ??= fetch(`texturas_mc/biblioteca/bedrock/${id}.json`).then(r => r.ok ? r.json() : null).catch(() => null).then(d => (DEFS_BE[id] = d));
  return PROM_BE[id];
}
const GRAD = PI / 180;
function armarBedrock(geo, material) {
  const raiz = new THREE.Group(), grupos = {}, pivJ = {};
  const piv = (b) => { const p = b.pivot || [0, 0, 0]; return [p[0], 24 - p[1], p[2]]; };
  for (const b of geo.huesos) {
    const g = new THREE.Group(); g.name = b.name; g.rotation.order = "ZYX";
    const r = b.rotation || [0, 0, 0];
    g.rotation.set(r[0] * GRAD, -r[1] * GRAD, -r[2] * GRAD);                  // reflejar y (Bedrock y arriba → Java y abajo)
    g.userData.base = g.rotation.clone();
    grupos[b.name] = g; pivJ[b.name] = piv(b);
  }
  for (const b of geo.huesos) {
    const g = grupos[b.name], p = pivJ[b.name], padre = b.parent && grupos[b.parent] ? b.parent : null, pp = padre ? pivJ[padre] : [0, 0, 0];
    const mv = b.mover || [0, 0, 0];                                           // desplazamiento de la pose de reposo (y arriba)
    g.position.set(p[0] - pp[0] + mv[0], p[1] - pp[1] - mv[1], p[2] - pp[2] + mv[2]);
    (padre ? grupos[padre] : raiz).add(g);
    // bind_pose_rotation: gira solo los cubos de este hueso, alrededor de su pivote (los hijos no)
    let destino = g;
    if (b.bind) { destino = new THREE.Group(); destino.rotation.order = "ZYX"; destino.rotation.set(b.bind[0] * GRAD, -b.bind[1] * GRAD, -b.bind[2] * GRAD); g.add(destino); }
    for (const c of b.cubes || []) {
      const s = c.size || [0, 0, 0], o = c.origin || [0, 0, 0], inf = c.inflate ?? b.inflate ?? 0;
      const caja = [o[0] - p[0], 24 - o[1] - s[1] - p[1], o[2] - p[2], s[0], s[1], s[2]];
      let geom;
      if (c.uv && !Array.isArray(c.uv)) {
        const U = {}, nom = { north: "uvNorth", south: "uvSouth", east: "uvEast", west: "uvWest", up: "uvUp", down: "uvDown" };
        for (const [cara, k] of Object.entries(nom)) { const f = c.uv[cara]; if (f?.uv) { const [w, hh] = f.uv_size || [0, 0]; U[k] = [f.uv[0], f.uv[1], f.uv[0] + w, f.uv[1] + hh]; } }
        geom = geoCajaCEM(caja, geo.tw, geo.th, [inf, inf, inf], false, U);
      } else { caja.uv = c.uv || [0, 0]; geom = geoCajaCEM(caja, geo.tw, geo.th, [inf, inf, inf], !!(c.mirror ?? b.mirror), undefined); }
      if (!geom) continue;
      const malla = new THREE.Mesh(geom, material); malla.castShadow = true; malla.receiveShadow = true;
      if (c.rotation) {                                                        // cubo girado sobre su propio pivote
        const cp = c.pivot ? [c.pivot[0], 24 - c.pivot[1], c.pivot[2]] : p, sub = new THREE.Group();
        sub.position.set(cp[0] - p[0], cp[1] - p[1], cp[2] - p[2]); sub.rotation.order = "ZYX";
        sub.rotation.set(c.rotation[0] * GRAD, -c.rotation[1] * GRAD, -c.rotation[2] * GRAD);
        malla.position.set(-(cp[0] - p[0]), -(cp[1] - p[1]), -(cp[2] - p[2]));
        sub.add(malla); destino.add(sub);
      } else destino.add(malla);
    }
  }
  // papeles de cada hueso para la animación básica (por nombre, como los nombra Mojang)
  const n = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const roles = { cabeza: null, piernas: [], brazos: [], alas: [], colas: [] };
  for (const b of geo.huesos) {
    const k = n(b.name), g = grupos[b.name], p = pivJ[b.name];
    if (!roles.cabeza && (k === "head" || k === "head0")) roles.cabeza = g;
    else if (/leg/.test(k) && !/legs$|armor|item/.test(k)) roles.piernas.push({ g, x: p[0], z: p[2] });
    else if (/arm/.test(k) && !/armor|item|arms$/.test(k)) roles.brazos.push({ g, x: p[0] });
    else if (/wing/.test(k)) roles.alas.push({ g, x: p[0] });
    else if (/tail/.test(k)) roles.colas.push(g);
  }
  if (!roles.cabeza) roles.cabeza = Object.values(grupos).find(g => /head/i.test(g.name)) || null;
  return { raiz, grupos, roles };
}
function crearMobBedrock(tipo, g) {
  const geo = DEFS_BE[tipo];
  if (!geo) return null;
  const tex = textura([`@@bib:${partesVariante(CATALOGO.porId[tipo], g.variante).v?.tex || "bedrock/" + tipo}`], geo.tw, geo.th);
  const m = mat(tex);
  const { raiz: modelo, grupos, roles } = armarBedrock(geo, m);
  tex.listo.then(() => podarTransparentes(modelo, tex.image));
  const F = FISICA[tipo];
  const raiz = new THREE.Group(), escala = new THREE.Group(), pivote = new THREE.Group();
  pivote.position.y = F.centro;
  modelo.rotation.x = PI; modelo.position.y = 24 - F.centro; escala.scale.setScalar(1 / 16);
  pivote.add(modelo); escala.add(pivote); raiz.add(escala);
  return { raiz, escala, pivote, nodos: { cabeza: roles.cabeza }, tipo, M: MODELOS[tipo], F, be: roles, grupos, nino: !!g.bebe };
}
// la parte donde va el objeto de la mano derecha (y el punto de agarre, en px del modelo, eje y hacia abajo)
function manoDe(m) {
  if (m.cem) for (const c of m.cem) for (const n of ["right_arm", "arms", "right_hand"]) if (c.partes[n]) return { g: c.partes[n], p: n === "arms" ? [0, 4, -5] : [-1, 10, -1] };
  if (m.grupos) for (const [n, g] of Object.entries(m.grupos)) if (/^(right_?arm|arm0|rightitem|right_item)$/i.test(n)) return { g, p: [-1, 10, -1] };
  if (m.nodos.brazos) return { g: m.nodos.brazos, p: [0, 4, -5] };
  return null;
}
function ponerObjetoMob(m, id) {
  const actual = m.objeto;
  if (actual && actual.userData.id === id) return;
  if (actual) { actual.parent?.remove(actual); m.objeto = null; }
  if (!id) return;
  const base = objetoListo(id), mano = manoDe(m);
  if (!base || !mano) return;
  const o = base.clone(); o.userData = { ...base.userData, id };
  const bloque = base.userData.forma === "bloque";
  o.scale.setScalar(bloque ? 0.32 : 0.62);
  o.position.set(...mano.p);
  // en el espacio de Java (y hacia abajo): el ítem cuelga del puño apuntando hacia adelante, como en tercera persona
  o.rotation.set(bloque ? 0 : PI / 2 + 0.35, bloque ? 0.78 : PI / 2, bloque ? 0 : PI);
  mano.g.add(o); m.objeto = o;
}

// quita de la malla las caras cuya zona de textura es 100 % transparente (p. ej. el ala del sombrero de paja en un aldeano
// sin profesión): las pasadas de profundidad del desenfoque y de la oclusión ambiental dibujan con su propio material, sin
// alphaTest, y esas caras salían como un "sombrero transparente"
function podarTransparentes(raiz, lienzo) {
  const W = lienzo.width, H = lienzo.height, a = lienzo.getContext("2d").getImageData(0, 0, W, H).data;
  const opaca = (x0, y0, x1, y1) => {
    for (let y = Math.max(0, y0); y < Math.min(H, y1); y++) for (let x = Math.max(0, x0); x < Math.min(W, x1); x++) if (a[(y * W + x) * 4 + 3] > 25) return true;
    return false;
  };
  // cara en parte transparente (p. ej. la ceja de FA: plano de 8×2 px con la fila de arriba vacía): se recorta la cara al
  // rectángulo de pixeles opacos, posición y UV juntas; si no, esa fila salía como una franja borrosa sobre la ceja
  const recortar = (geo, b, u0, u1, v0, v1) => {
    const U0 = Math.round(u0), U1 = Math.round(u1), V0 = Math.round(v0), V1 = Math.round(v1);
    if (U1 - U0 < 1 || V1 - V0 < 1 || Math.abs(u0 - U0) > 1e-3 || Math.abs(v0 - V0) > 1e-3) return;
    let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1;
    for (let y = V0; y < V1; y++) for (let x = U0; x < U1; x++) if (a[(y * W + x) * 4 + 3] > 25) { x0 = Math.min(x0, x); x1 = Math.max(x1, x + 1); y0 = Math.min(y0, y); y1 = Math.max(y1, y + 1); }
    if (x1 < 0 || (x0 === U0 && x1 === U1 && y0 === V0 && y1 === V1)) return;
    const pos = geo.attributes.position, uv = geo.attributes.uv, P = {};
    const ab = (k) => [Math.round((uv.getX(k) * W - u0) / (u1 - u0)), Math.round(((1 - uv.getY(k)) * H - v0) / (v1 - v0))];
    for (let k = b; k < b + 4; k++) { const [i, j] = ab(k); P[i + "" + j] = [pos.getX(k), pos.getY(k), pos.getZ(k)]; }
    if (Object.keys(P).length !== 4) return;
    const fa = [(x0 - u0) / (u1 - u0), (x1 - u0) / (u1 - u0)], fb = [(y0 - v0) / (v1 - v0), (y1 - v0) / (v1 - v0)];
    for (let k = b; k < b + 4; k++) {
      const [i, j] = ab(k), s = fa[i], t = fb[j];
      for (let c = 0; c < 3; c++) {
        const top = P["00"][c] + (P["10"][c] - P["00"][c]) * s, bot = P["01"][c] + (P["11"][c] - P["01"][c]) * s;
        pos.setComponent(k, c, top + (bot - top) * t);
      }
      uv.setXY(k, (u0 + s * (u1 - u0)) / W, 1 - (v0 + t * (v1 - v0)) / H);
    }
    pos.needsUpdate = uv.needsUpdate = true;
  };
  raiz.traverse(o => {
    if (!o.isMesh || o.userData.podada) return;
    o.userData.podada = true;
    const uv = o.geometry.attributes.uv, idx = o.geometry.index.array, quedan = [];
    for (let f = 0; f < idx.length; f += 6) {
      const b = Math.min(idx[f], idx[f + 1], idx[f + 2], idx[f + 3], idx[f + 4], idx[f + 5]);
      let u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9;
      for (let k = b; k < b + 4; k++) { const u = uv.getX(k) * W, v = (1 - uv.getY(k)) * H; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
      if (opaca(Math.floor(u0 + 1e-4), Math.floor(v0 + 1e-4), Math.ceil(u1 - 1e-4), Math.ceil(v1 - 1e-4))) {
        for (let k = f; k < f + 6; k++) quedan.push(idx[k]);
        recortar(o.geometry, b, u0, u1, v0, v1);
      }
    }
    if (!quedan.length) o.visible = false;
    else if (quedan.length < idx.length) o.geometry.setIndex(quedan);
  });
}

function crearMobCEM(tipo, g) {
  const capas = CAPAS_CEM[tipo]?.(g);
  if (!capas || !capas.every(c => DEFS_CEM[c[0]])) return null;
  const F = FISICA[tipo];
  const modelos = capas.map(([n, texs, tinte]) => {
    const def = DEFS_CEM[n], [tw, th] = def.jem.textureSize || [64, 32];
    const tex = texPack(texs, tw, th, tinte);
    // la capa de afuera del slime es translúcida en el juego (se ve el núcleo y los ojos adentro)
    const m = mat(tex, tipo === "calamar" ? { emissive: 0xffffff, emissiveIntensity: 0.9, emissiveMap: tex } : n === "slime_outer" ? { transparent: true, alphaTest: 0.01, depthWrite: false } : {});
    if (n === "wolf_armor" || n === "sheep_wool" || n === "happy_ghast_harness") m.polygonOffset = true, m.polygonOffsetFactor = -1;
    const modeloCEM = new ModeloCEM(def, m, n);
    tex.listo.then(() => podarTransparentes(modeloCEM.raiz, tex.image));
    return modeloCEM;
  });
  const raiz = new THREE.Group(), escala = new THREE.Group(), pivote = new THREE.Group(), modelo = new THREE.Group();
  pivote.position.y = F.centro;
  modelo.rotation.x = PI; modelo.position.y = 24 - F.centro; escala.scale.setScalar(1 / 16);
  for (const c of modelos) modelo.add(c.raiz);
  pivote.add(modelo); escala.add(pivote); raiz.add(escala);
  return { raiz, escala, pivote, nodos: {}, tipo, F, M: MODELOS[tipo], cem: modelos, nino: NINOS.has(tipo) || !!g.bebe };
}

function crearMob(tipo, g) {
  const conCEM = crearMobCEM(tipo, g);
  if (conCEM) return conCEM;
  const M = MODELOS[tipo], F = FISICA[tipo];
  if (M.generico) return crearMobBedrock(tipo, g);          // null mientras no se haya cargado (ver Mobs.asegurar)
  const mats = M.capas(g).map(([...cs]) => {
    const tinte = cs.length > 1 && cs[cs.length - 1].startsWith("#") ? cs.pop() : null;
    return mat(textura(cs, M.tw, M.th, tinte), M.brillo ? { emissive: 0xffffff, emissiveIntensity: 0.9, emissiveMap: textura(cs, M.tw, M.th) } : {});
  });
  const nodos = {};
  const modelo = armar(typeof M.def === "function" ? M.def(g) : M.def, mats, M.tw, M.th, nodos);
  // raíz (posición y rumbo) → escala → pivote (inclinación, rebote y "squash" alrededor del centro del cuerpo) → modelo
  const raiz = new THREE.Group(), escala = new THREE.Group(), pivote = new THREE.Group();
  pivote.position.y = F.centro;
  modelo.rotation.x = PI; modelo.position.y = 24 - F.centro; escala.scale.setScalar(1 / 16);
  pivote.add(modelo); escala.add(pivote); raiz.add(escala);
  if (M.cabeza && nodos.cabeza) nodos.cabeza.scale.setScalar(M.cabeza);
  return { raiz, escala, pivote, nodos, tipo, M, F };
}

// ───────────── terreno del escenario ─────────────
// sólido para pisar y chocar: todo menos aire, plantas en cruz y capas finas (las hojas sí cuentan, como en el juego)
const solidoId = (id) => id && BLOQUES[id] && !["planta", "capa", "antorcha", "alfombra"].includes(BLOQUES[id].tipo);
// en (x, z) de la escena y con los pies a la altura y: ¿dónde queda el piso (puede subir 1 bloque)? null = pared
function piso(mundo, x, z, y, alto) {
  if (!mundo) return 0;
  const O = mundo.O, cx = Math.floor(x + O.x), cz = Math.floor(z + O.z);
  if (cx < 0 || cz < 0 || cx >= mundo.T.x || cz >= mundo.T.z) return null;
  const s = (cy) => solidoId(mundo.get(cx, cy, cz));
  const base = Math.floor(y + O.y + 0.02);
  let k = s(base) ? base : -1;                        // bloque a la altura de los pies: escalón de 1
  if (k < 0) for (let c = base - 1; c >= Math.max(0, base - 12); c--) if (s(c)) { k = c; break; }
  if (k < 0) return y - 12;
  for (let c = k + 1; c <= k + Math.max(1, Math.ceil(alto - 0.05)); c++) if (s(c)) return null;     // sin espacio: pared/techo
  return k + 1 - O.y;
}
// piso bajo toda la huella del mob (centro y 4 esquinas), girada con el rumbo
function pisoHuella(mundo, x, z, y, yaw, w, l, alto) {
  const s = Math.sin(yaw), c = Math.cos(yaw);
  let max = -1e9;
  for (const [a, b] of [[0, 0], [-w, -l], [w, -l], [-w, l], [w, l]]) {
    const p = piso(mundo, x + c * a + s * b, z - s * a + c * b, y, alto);
    if (p == null) return null;
    max = Math.max(max, p);
  }
  return max;
}

// ───────────── simulación de un mob durante una toma (60 Hz, determinista) ─────────────
// cabeza con tiempos [[t, grados], ...] (suave entre claves): para que un aldeano voltee a la cámara
function claveYaw(k, tau) {
  let a = k[0][1];
  for (let i = 1; i < k.length; i++) if (tau >= k[i - 1][0]) { const u = Math.min(1, (tau - k[i - 1][0]) / Math.max(0.01, k[i][0] - k[i - 1][0])); a = k[i - 1][1] + (k[i][1] - k[i - 1][1]) * (u * u * (3 - 2 * u)); }
  return a;
}
const HZ = 60;
const R = (j) => RESORTES[j];                          // [ω, ζ] de las articulaciones del jugador
// resorte con amortiguamiento implícito (estable): el mismo integrador que motor.js
function paso(st, obj, [om, z], h) { st.v = (st.v + om * om * (obj - st.x) * h) / (1 + 2 * z * om * h); st.x += st.v * h; return st.x; }
const res = (x = 0) => ({ x, v: 0 });

function simular(m, g, k, base, mundo, dur) {
  const F = m.F, tipo = m.tipo, marcha = F.marcha, esc = base.esc;
  const r = rng((g.semilla ?? 1) * 31 + k * 7 + 11), fase = base.fase;
  const n = Math.ceil((dur + 0.6) * HZ) + 1, h = 1 / HZ;
  const out = new Array(n);
  const modo = g.modo || "caminar", acc = g.accion || null;
  const w = F.ancho * esc * 0.5 * 0.9, l = (marcha === "cuadrupedo" || marcha === "strider" ? F.ancho * 0.75 : F.ancho * 0.5) * esc * 0.9, alto = F.alto * esc;
  const conSuelo = g.suelo !== false && !!mundo && !["flotar", "lanzar"].includes(modo) && !["calamar", "volar", "nadar"].includes(marcha);
  const vel = base.vel, mueve = modo === "caminar" || modo === "correr";
  // rumbo deseado: hacia el siguiente punto de la ruta, o la dirección del grupo
  const ruta = (g.ruta || []).map(([a, b]) => [a + base.dx, b + base.dz]);
  let wp = 0, lado = r() < 0.5 ? 1 : -1;
  // estado
  let x = base.x, z = base.z, yaw = base.yaw, s = 0, fi = fase * 3, yv = 0;
  let y = base.y;
  if (conSuelo) {                                     // si nace dentro de un bloque, buscar el lugar libre más cercano
    let p = pisoHuella(mundo, x, z, y + 1, yaw, w, l, alto);
    for (let i = 1; p == null && i < 40; i++) { const a = i * 2.39996, d = 0.25 * Math.sqrt(i); const xx = x + Math.cos(a) * d, zz = z + Math.sin(a) * d; const q = pisoHuella(mundo, xx, zz, y + 1, yaw, w, l, alto); if (q != null) { x = xx; z = zz; p = q; } }
    y = p ?? y;
  }
  const yawS = res(yaw), cab = res(), cabY = res(), cabZ = res(), roll = res(), cola = res(), colaY = res(), oreja = res(), brazos = res(), yS = res(y), sq = res(1);
  // objetivo de velocidad (anticipación al arrancar, frenado con rebote)
  // aullido sentado: frena, se sienta (pose de Fresh Animations) y después aúlla
  const tSentar = acc?.tipo === "aullar" && acc.sentarse ? acc.en - 0.38 : null;
  const arranque = g.arranque ?? (mueve ? 0 : 1e9), parar = g.parar ?? (acc?.tipo === "aullar" ? (tSentar ?? acc.en) - (tSentar != null ? 0.12 : 0) : 1e9);
  const vObj = (t) => {
    if (!mueve) return 0;
    if (acc?.tipo === "embestir" && t >= acc.en && t < acc.en + 0.38) return Math.max(vel, 4.5);
    return t >= arranque && t < parar ? vel : 0;
  };
  s = arranque <= 0 ? vObj(0) : 0;
  // miradas con "holds": gira rápido hacia un punto, se queda, y vuelve a mirar a otro lado
  const miradas = []; for (let t = -0.3 + r() * 0.6; t < dur + 1; t += 0.9 + r() * 1.6) miradas.push([t, (r() - 0.5) * 1.3 * (g.calmo ? 0.08 : 1), (r() - 0.5) * 0.35 * (g.calmo ? 0.15 : 1)]);
  const mirada = (t) => { let a = [0, 0]; for (const [tm, yw, pt] of miradas) if (t >= tm) a = [yw, pt]; return a; };
  // eventos de idle por mob (picotear, pastar, sacudirse, saltitos): tiempos sembrados
  const eventos = (cada, dura) => { const l2 = []; for (let t = 0.2 + r() * cada; t < dur + 1; t += cada * (0.6 + r() * 0.8)) l2.push([t, t + dura]); return l2; };
  const enEv = (lista, t) => { for (const [a, b] of lista) if (t >= a && t < b) return (t - a) / (b - a); return -1; };
  const accTipo = acc?.tipo;
  const picoteos = tipo === "pollito" ? eventos(acc?.cada ?? 1.4, 0.32) : [];
  const pastoreo = (tipo === "oveja" || tipo === "cordero") && modo === "quieto" && !g.calmo ? eventos(3.2, 1.3) : [];      // calmo: sin pastar ni sacudirse
  const sacudidas = accTipo === "sacudirse" ? [[acc.en, acc.en + (acc.dur ?? 0.7)]] : (tipo === "oveja" && modo === "quieto" && !g.calmo ? eventos(5, 0.6) : []);
  // accion.tiempos: el salto ATERRIZA en cada instante de la lista (músicos que tocan en la nota exacta)
  const saltos = accTipo === "saltitos" && acc.tiempos ? acc.tiempos.map(tm => [tm - (acc.dur ?? 0.26), tm])
    : (tipo === "pollito" && (accTipo === "saltitos" || modo === "correr")) || (accTipo === "saltitos") || (tipo === "cubito" && modo !== "flotar")
    ? eventos(acc?.cada ?? (modo === "correr" ? 0.75 : 0.9), tipo === "cubito" ? 0.36 : 0.26)
    : marcha === "saltar" && mueve ? eventos(acc?.cada ?? 0.62, 0.42) : [];                  // conejo, rana, slime: avanzan a saltos
  // atacar: instantes de cada golpe; el golpe dura 0.35 s (en el juego, 6 ticks de swing)
  const ataques = accTipo === "atacar" ? (acc.tiempos ? acc.tiempos.map(tm => tm - 0.12) : Array.from({ length: acc.veces ?? 3 }, (_, k) => (acc.en ?? 0) + k * (acc.cada ?? 0.8))) : [];
  const golpeEn = (t) => { for (const a of ataques) if (t >= a && t < a + 0.35) return (t - a) / 0.35; return 0; };
  const rodadas = accTipo === "rodar" ? eventos(acc.cada ?? 1.1, acc.dur ?? 0.62).map(([a, b]) => [a + (acc.en ?? 0), b + (acc.en ?? 0)]) : [];
  let tAnt = null, sAnt = s, yawAnt = yaw, rollAc = 0, rodLado = r() < 0.5 ? 1 : -1, salto = false, iSentado = -1;
  // chocar: dos cabritos frente a frente (cada uno con esta acción, el mismo punto y los mismos tiempos). Cada ciclo:
  // paso atrás (anticipación) → carga acelerando → choque de cabezas en el punto medio → rebote hacia atrás con saltito →
  // regresan. En los ciclos impares uno empuja al otro (empuja: 1 / −1) sin separarse. Ninguno pasa de la distancia de
  // contacto, así que nunca se atraviesan.
  let choque = null;
  if (accTipo === "chocar") {
    const M = [acc.punto[0] + base.dx, acc.punto[1] + base.dz], contacto = acc.contacto ?? l * 1.6;     // con la cabeza abajo sobresale más
    choque = { M, contacto, yaw0: Math.atan2(M[0] - x, M[1] - z), d0: Math.max(0.3, Math.hypot(M[0] - x, M[1] - z) - contacto), qAnt: null };
    yaw = yawAnt = yawS.x = choque.yaw0;
  }
  const qChoque = (t) => {
    const T = acc.cada ?? 1.25, d0 = choque.d0, tc = t - (acc.en ?? 0);
    if (tc < 0) return { q: d0, cab: 0, golpe: -1 };
    const n = Math.floor(tc / T), u = (tc - n * T) / T, emp = n % 2 === 1 ? (acc.empuja ?? 0) : 0;
    if (u < 0.18) return { q: d0 + 0.18 * Math.sin(u / 0.18 * PI), cab: suave(u / 0.18) * 0.5, golpe: -1 };
    if (u < 0.42) { const k = (u - 0.18) / 0.24; return { q: d0 * (1 - k * k), cab: 0.5 + 0.55 * k, golpe: -1 }; }
    if (emp) {                                                   // empujón: los dos se desplazan juntos, sin separarse
      if (u < 0.72) { const k = (u - 0.42) / 0.3; return { q: -0.4 * emp * suave(k), cab: 1.05, golpe: k < 0.25 ? k / 0.25 : -1 }; }
      const k = (u - 0.72) / 0.28; return { q: -0.4 * emp + (d0 + 0.4 * emp) * suave(k), cab: 1.05 * (1 - suave(k)), golpe: -1 };
    }
    if (u < 0.7) { const k = (u - 0.42) / 0.28; return { q: 0.5 * (1 - Math.exp(-k * 6)), cab: 1.05 * (1 - k * 0.6), golpe: k }; }
    const k = (u - 0.7) / 0.3; return { q: 0.5 + (d0 - 0.5) * suave(k), cab: 0.42 * (1 - suave(k)), golpe: -1 };
  };
  // Fresh Animations: estado de la entidad como lo ve el juego (20 ticks/s), evaluado a 60 Hz
  if (m.cem) for (const c of m.cem) c.reiniciar();
  let limbSpeed = s / 5 > 1 ? 1 : Math.min(1, s / 5), limbSwing = fase * 7, yAnt = y;
  const E = { is_child: m.nino || g.bebe ? 1 : 0, is_alive: 1, health: 20, max_health: 20, id: (g.semilla ?? 1) * 97 + k * 13, frame_time: h,
    is_in_water: tipo === "calamar" || marcha === "nadar" ? 1 : 0, is_ridden: g.montado ? 1 : 0, rule_index: 1, player_pos_x: 9999, player_pos_y: 9999, player_pos_z: 9999 };
  for (let i = 0; i < n; i++) {
    const t = i * h;
    // ── velocidad
    const vo = vObj(t), kA = vo > s ? 7 : 6.5;
    s += (vo - s) * (1 - Math.exp(-kA * h));
    const a = (s - sAnt) / h; sAnt = s;
    // ── rumbo y ruta (esquivar lo que estorba)
    let deseo = yawS.x;
    if (ruta.length && wp < ruta.length) {
      const [tx, tz] = ruta[wp];
      if (Math.hypot(tx - x, tz - z) < 0.6) wp++;
      if (wp < ruta.length) deseo = Math.atan2(ruta[wp][0] - x, ruta[wp][1] - z);
    } else if (mueve) deseo = base.yaw + Math.sin(t * 1.3 + fase) * 0.06;
    if (g.rumbo) deseo = claveYaw(g.rumbo, t) * PI / 180;          // rumbo por tiempos [[t, grados]] (p. ej. voltear a la cámara)
    if (conSuelo && s > 0.05) {
      const libre = (ang) => { for (const d of [0.3, 0.65, 1.0]) { const dd = d * (0.8 + s * 0.18); const p = pisoHuella(mundo, x + Math.sin(ang) * dd, z + Math.cos(ang) * dd, y, ang, w, l, alto); if (p == null || p - y > 1.05) return false; } return true; };
      if (!libre(deseo)) {
        let elegido = null;
        for (const da of [0.35, 0.7, 1.05, 1.4, 1.9, 2.4]) { for (const sg of [lado, -lado]) if (elegido == null && libre(deseo + sg * da)) { elegido = deseo + sg * da; lado = sg; } if (elegido != null) break; }
        deseo = elegido ?? deseo;
        if (elegido == null) s *= 0.7;              // encerrado: frena
      }
    }
    let dYaw = Math.atan2(Math.sin(deseo - yawS.x), Math.cos(deseo - yawS.x));
    paso(yawS, yawS.x + dYaw, [9, 0.9], h);
    yaw = yawS.x;
    const yawRate = (yaw - yawAnt) / h; yawAnt = yaw;
    // ── avanzar
    let nx = x + Math.sin(yaw) * s * h, nz = z + Math.cos(yaw) * s * h;
    const ch = choque ? qChoque(t) : null;
    if (ch) {                                          // posición sobre la línea hacia el punto de choque (ver qChoque)
      yaw = choque.yaw0;
      const d = choque.contacto + ch.q;
      nx = choque.M[0] - Math.sin(yaw) * d; nz = choque.M[1] - Math.cos(yaw) * d;
      s = choque.qAnt == null ? 0 : Math.abs(ch.q - choque.qAnt) / h; choque.qAnt = ch.q;
    }
    if (marcha === "cubito" || (tipo === "cabrito" && rodadas.length)) {       // ruedan/saltan de lado
      const u = enEv(rodadas, t); if (u >= 0) { nx += Math.cos(yaw) * rodLado * 1.1 * h; nz -= Math.sin(yaw) * rodLado * 1.1 * h; }
    }
    if (conSuelo) {
      const p = pisoHuella(mundo, nx, nz, y, yaw, w, l, alto);
      if (p != null && p - y <= 1.05) { x = nx; z = nz; } else s *= 0.5;
    } else { x = nx; z = nz; }
    // ── altura: suelo real (sube escalones con un saltito, baja con gravedad), o modos sin suelo
    let piso0 = y, yExtra = 0;
    if (conSuelo) {
      const p = pisoHuella(mundo, x, z, y, yaw, w, l, alto) ?? y;
      piso0 = p;
      if (p > y + 0.01) { y = Math.min(p, y + 7 * h); yv = 0; if (p - y < 0.02) y = p; }     // sube (≈0.15 s por bloque)
      else if (p < y - 0.01) {
        // saltaBorde: al llegar a una orilla alta se impulsa hacia arriba y adelante (los animales que saltan del risco)
        if (g.saltaBorde && !salto && yv === 0 && p < y - 1.5) { yv = g.saltaBorde; salto = true; }
        yv -= 22 * h; y = Math.max(p, y + yv * h); if (y <= p) yv = 0;
      }
      else { y = p; yv = 0; }
    } else y = base.y;
    // ── ciclo de patas: avanza con la distancia recorrida (como el vanilla)
    fi += s / F.zancada * 2 * PI * h;
    const amp = clamp(s / F.vRef, 0, marcha === "pollito" ? 1.3 : 1.15);
    const corre = s > F.vRef * 1.25 ? 1 : s / (F.vRef * 1.25);
    // ── cuerpo: inclinación por aceleración (anticipa y rebota al frenar) + vaivén del paso
    let incl, bob, giroZ = 0, giroX = 0;
    if (marcha === "bipedo") {
      incl = clamp(0.015 * a + 0.05 * s / F.vRef, -0.2, 0.32);              // se inclina hacia adelante al correr
      bob = 0.05 * amp * (0.5 - 0.5 * Math.cos(2 * fi)) * (1 + corre);
      giroZ = 0.06 * amp * Math.sin(fi);
    } else if (marcha === "pollito" || marcha === "cubito") {
      incl = clamp(0.03 * a, -0.35, 0.35) + 0.12 * amp * Math.sin(2 * fi);    // cabeceo del pollito al correr
      bob = 0.04 * amp * (0.5 - 0.5 * Math.cos(2 * fi));
      giroZ = 0.1 * amp * Math.sin(fi);
    } else if (marcha === "strider") {
      incl = clamp(0.02 * a, -0.15, 0.15);
      bob = -0.06 * Math.cos(2 * fi) * Math.max(amp, 0.2);
      giroZ = 0.3 * Math.max(amp, 0.25) * Math.sin(fi) + Math.sin(t * 2.1 + fase) * 0.05;   // se tambalea (vanilla ≈ 23°)
    } else if (marcha === "calamar" || marcha === "volar" || marcha === "nadar") {
      incl = marcha === "calamar" ? 0 : clamp(0.02 * a, -0.2, 0.2);                       // vuela/nada: se inclina al acelerar
      bob = marcha === "volar" ? Math.sin(t * 2.4 + fase) * 0.12 : marcha === "nadar" ? Math.sin(t * 1.6 + fase) * 0.05 : 0;
    } else {
      incl = clamp(-0.022 * a, -0.28, 0.28) + (0.05 + 0.09 * corre) * amp * Math.sin(fi);  // frena: se va de nariz; arranca: se sienta
      bob = (0.025 + 0.07 * corre) * amp * (0.5 - 0.5 * Math.cos(2 * fi));
      giroZ = 0.04 * amp * Math.sin(fi);
    }
    giroZ += clamp(-0.12 * yawRate * Math.min(1, s), -0.25, 0.25);           // se inclina hacia la curva
    // ── saltitos y rodadas
    const us = enEv(saltos, t);
    if (us >= 0) { yExtra += Math.sin(us * PI) * (tipo === "clawd" ? 0.1 : marcha === "cubito" ? 0.35 : marcha === "saltar" ? 0.32 : 0.2) * esc * 1.6; }
    const ur = enEv(rodadas, t);
    if (ur >= 0) {
      rollAc = rodLado * 2 * PI * suave(ur);
      yExtra += Math.sin(ur * PI) * 0.25 * esc;
    } else rollAc = 0;
    if (ur < 0 && rodadas.length && rodadas.some(([, b]) => t >= b && t < b + 0.12)) rodLado = -rodLado;
    // ── acciones con el cuerpo
    let cabObj = -0.7 * incl, cabYObj = 0, cabZObj = 0;
    const [my, mp] = mirada(t), quietud = 1 - Math.min(1, s / F.vRef);
    cabYObj += my * (0.35 + 0.65 * quietud); cabObj += mp * quietud;
    cabYObj += clamp(yawRate * 0.18, -0.4, 0.4);                              // mira hacia donde gira
    if (marcha === "cuadrupedo") cabObj += 0.06 * amp * Math.sin(2 * fi - 0.9);
    const up = enEv(picoteos, t);
    if (up >= 0 && s < 0.5) incl += Math.sin(Math.min(1, up * 1.6) * PI) * 0.75;         // picotea el suelo
    const ug = enEv(pastoreo, t);
    if (ug >= 0) cabObj += pulso(ug, 0, 1, 0.2) * (1.0 + Math.sin(t * 16) * 0.06);       // baja a comer pasto
    const ush = enEv(sacudidas, t);
    if (ush >= 0) giroZ += Math.sin(ush * PI * 9) * 0.22 * (1 - ush);                   // sacudida rápida que se apaga
    if (accTipo === "embestir") {
      const e0 = acc.en;
      cabObj += pulso(t, e0 - 0.28, e0 + 0.55, 0.12) * 1.05;                              // baja la cabeza (vanilla: 60°)
      incl += pulso(t, e0 - 0.28, e0 + 0.02, 0.1) * 0.18;                                 // anticipación: se agacha adelante
      if (t > e0 + 0.38 && t < e0 + 0.52) incl -= 0.25;                                  // choque: rebote hacia atrás
    }
    if (ch) {                                                                             // choque de cabritos
      if (!m.cem) cabObj += ch.cab;                                                       // cabeza abajo al cargar (con FA va como embestida)
      if (ch.golpe >= 0) {                                                                // impacto: se van de espaldas, saltito y sacudida
        incl -= Math.sin(Math.min(1, ch.golpe * 3) * PI) * 0.3;
        yExtra += Math.sin(Math.min(1, ch.golpe * 2) * PI) * 0.12 * esc * 1.6;
        giroZ += Math.sin(ch.golpe * PI * 6) * 0.12 * (1 - ch.golpe);
      }
    }
    let aullido = 0;
    if (accTipo === "aullar") {
      const e0 = acc.en, e1 = e0 + (acc.dur ?? 1.4), f = acc.fuerza ?? 1;
      aullido = pulso(t, e0 + 0.12, e1, 0.28);
      cabObj += pulso(t, e0 - 0.16, e0 + 0.2, 0.08) * 0.22 * f;                          // anticipación: baja la cabeza antes de subir
      // hocico al cielo (fuerza 1.35 ≈ 77°), pecho arriba y vibrato del aullido (más fuerte a la mitad)
      const vib = Math.sin((t - e0) * 2 * PI * 7.5) * 0.045 * f * pulso(t, e0 + 0.35, e1 - 0.1, 0.2);
      cabObj -= aullido * 1.05 * f + vib; incl -= aullido * 0.16 * f; cabYObj *= 1 - aullido; cabZObj += aullido * 0.08;
    }
    const enAireY = conSuelo && y > piso0 + 0.05;                                         // saltando o cayendo (del risco)
    // ── resortes (cabeza y orejas con retraso; cola floja)
    const pitch = paso(roll, incl, marcha === "bipedo" ? R("torso") : [9, 0.38], h);   // (reusa `roll` como canal de inclinación)
    const cabX = paso(cab, cabObj, R("cabeza"), h), cY = paso(cabY, cabYObj, [11, 0.6], h), cZ = paso(cabZ, cabZObj, [10, 0.5], h);
    const bobT = bob + yExtra;
    const dBob = tAnt == null ? 0 : (bobT - tAnt) / h; tAnt = bobT;
    const ore = paso(oreja, clamp(-dBob * 0.9 - cabX * 0.3, -0.7, 0.7), [14, 0.25], h);
    const colaX = paso(cola, (accTipo === "aullar" ? -0.25 * aullido : 0) + 0.35 * corre + clamp(-dBob * 0.6, -0.5, 0.5), [8, 0.3], h);
    const colaZ = paso(colaY, clamp(-yawRate * 0.25, -0.6, 0.6), [7, 0.3], h);
    const brz = paso(brazos, marcha === "bipedo" ? 0.16 * amp * corre * Math.sin(2 * fi + 0.4) : 0, [14, 0.3], h);
    const ySuave = paso(yS, y, [26, 0.85], h);
    const aterriza = saltos.some(([, b]) => t >= b && t < b + 0.15) ? 1 : 0;
    const sqY = paso(sq, 1 - aterriza * 0.16, [18, 0.35], h);
    const yFin = Math.max(ySuave, piso0) + bobT;
    let pose = null;
    if (m.cem) {
      // la caminata vanilla: velocidad de las patas → hacia min(distancia por tick × 4, 1) y el ciclo avanza con ella
      const objetivo = Math.min(1, s / 20 * 4);
      limbSpeed += (objetivo - limbSpeed) * (1 - Math.pow(0.6, 20 * h));
      limbSwing += limbSpeed * 20 * h * (m.nino ? 3 : 1);
      const enAire = us >= 0 || enAireY || (modo === "caer") || ["flotar", "lanzar"].includes(modo) && marcha !== "calamar" || tipo === "cubito" || marcha === "volar";
      E.is_sitting = tSentar != null && t >= tSentar ? 1 : 0;
      if (E.is_sitting && iSentado < 0) iSentado = i;
      // calmo: el reloj de reposo de FA (age) va a 30 %: respira tranquilo y no le tocan eventos de mirar/sacudirse/cambiar el peso
      const edad = t * 20 * (g.calmo ? 0.3 : 1) + fase * 40;
      Object.assign(E, { limb_swing: limbSwing, limb_speed: limbSpeed, age: edad, time: 6000 + edad, frame_counter: i + 1,
        head_yaw: g.cabezaYaw ? -claveYaw(g.cabezaYaw, t) : -cY * 180 / PI, head_pitch: cabX * 180 / PI, is_on_ground: enAire ? 0 : 1, pos_x: x, pos_y: yFin, pos_z: z,
        // rot_y: FA lo espera en radianes (detecta la vuelta con pi*2). Los mobs del tráiler se afinaron recibiéndolo en grados
        // y se dejan así para no cambiar el video; los de la biblioteca van en radianes
        rot_y: MODELOS[tipo].generico ? -yaw : -yaw * 180 / PI,
        swing_progress: golpeEn(t),
        is_aggressive: (accTipo === "embestir" && t > acc.en - 0.4 && t < acc.en + 0.6) || (ch && ch.cab > 0.4) || (ataques.length && t > ataques[0] - 0.5 && t < ataques[ataques.length - 1] + 0.8) ? 1 : 0, rule_index: tipo === "pollito" && modo === "quieto" ? 2 : 1 });
      // lo que el setupAnim vanilla escribe y Fresh Animations lee (embestida de la cabra, la oveja que come)
      const embiste = accTipo === "embestir" ? pulso(t, acc.en - 0.3, acc.en + 0.5, 0.15) * 1.05 : ch ? ch.cab : 0;
      const come = ug >= 0 ? pulso(ug, 0, 1, 0.2) : 0;
      const pre = (P) => {
        // gólem de hierro: el golpe vanilla (attackAnimationTick de 10 ticks: los dos brazos suben y caen); FA lo lee de right_arm.rx
        const gp = golpeEn(t);
        if (gp > 0 && tipo === "golem_hierro") { const k = 10 * (1 - gp), tri = (Math.abs(k % 10 - 5) - 2.5) / 2.5; for (const b of [P.right_arm, P.left_arm]) if (b) b.rotation.x = -2 + 1.5 * tri; }
        if (P.head) { P.head.rotation.x += E.head_pitch * PI / 180 + embiste + come * 0.9; P.head.rotation.y += E.head_yaw * PI / 180; }
        if (P.head && (tipo === "oveja" || tipo === "cordero")) P.head.position.y = 6 + come * 9;
        // calamar: el ángulo vanilla de los tentáculos (sube a 45° y se suelta, cada ~2 s) empuja el nado de Fresh Animations
        if (P.tentacle1 && !MODELOS[tipo].generico) { const ph = (t * PI + fase * 3) % (2 * PI); P.tentacle1.rotation.x = ph < PI ? Math.sin(ph) ** 2 * PI / 4 : 0; }
        if (P.stick1 && tipo === "blaze") vanillaBlaze(P, E.age);
        if (P.spine1 && (tipo === "guardian" || tipo === "guardian_anciano")) vanillaGuardian(P, E.age);
        if (P.tentacle1 && (tipo === "ghast")) for (let j = 1; j <= 9; j++) if (P["tentacle" + j]) P["tentacle" + j].rotation.x = 0.2 * Math.sin(E.age * 0.3 + j) + 0.4;
      };
      pose = m.cem.map(c => { c.paso(E, pre); return c.foto(); });
      yAnt = yFin;
    }
    // atacar: embestida corta hacia adelante y el cuerpo se inclina con el golpe
    const gp = golpeEn(t), lunge = Math.sin(PI * gp);
    out[i] = { x: x + Math.sin(yaw) * lunge * 0.28, z: z + Math.cos(yaw) * lunge * 0.28, y: yFin, yaw, pitch: pitch + lunge * 0.32, roll: giroZ, ataque: gp, rollAc, fi, amp, cabX, cY, cZ, ore, colaX, colaZ, brz, sqY, s, salto: us >= 0 || enAireY ? 1 : 0, aullido, tumbar: 0, pose };
  }
  // en el juego sentarse es instantáneo: aquí la pose pasa de parado a sentado en 0.3 s (mezcla de las dos poses)
  if (iSentado > 0 && out[iSentado - 1].pose) {
    const B = Math.round(0.3 * HZ), A = out[iSentado - 1].pose, Z = out[Math.min(n - 1, iSentado + B)].pose;
    for (let i = iSentado; i < Math.min(n, iSentado + B); i++) {
      const u = suave((i - iSentado) / B);
      out[i].pose = A.map((fa, c) => Object.fromEntries(Object.entries(fa).map(([p, v]) => [p, v.map((q, j) => j === 9 ? (u < 0.5 ? q : Z[c][p]?.[9] ?? q) : q + ((Z[c][p]?.[j] ?? q) - q) * u)])));
    }
  }
  return out;
}

// ───────────── aplicar el estado a los huesos ─────────────
// blaze: el setupAnim vanilla mueve las 12 varas en tres anillos que giran (Fresh Animations solo les agrega el vaivén)
function vanillaBlaze(P, age) {
  let f = age * PI * -0.1;
  for (let i = 0; i < 4; i++, f++) { const s = P["stick" + (i + 1)]; if (s) s.position.set(Math.cos(f) * 9, -2 + Math.cos((i * 2 + age) * 0.25), Math.sin(f) * 9); }
  f = PI / 4 + age * PI * 0.03;
  for (let i = 4; i < 8; i++, f++) { const s = P["stick" + (i + 1)]; if (s) s.position.set(Math.cos(f) * 7, 2 + Math.cos((i * 2 + age) * 0.25), Math.sin(f) * 7); }
  f = 0.47123894 + age * PI * -0.05;
  for (let i = 8; i < 12; i++, f++) { const s = P["stick" + (i + 1)]; if (s) s.position.set(Math.cos(f) * 5, 11 + Math.cos((i * 1.5 + age) * 0.5), Math.sin(f) * 5); }
}

// guardián: el setupAnim vanilla coloca las 12 púas alrededor del cuerpo (y las "respira" un poco)
const PUAS = { rx: [1.75, 0.25, 0, 0, 0.5, 0.5, 0.5, 0.5, 1.25, 0.75, 0, 0], ry: [0, 0, 0, 0, 0.25, 1.75, 1.25, 0.75, 0, 0, 0, 0],
  rz: [0, 0, 0.25, 1.75, 0, 0, 0, 0, 0, 0, 0.75, 1.25], x: [0, 0, 8, -8, -8, 8, 8, -8, 0, 0, 8, -8], y: [-8, -8, -8, -8, 0, 0, 0, 0, 8, 8, 8, 8],
  z: [8, -8, 0, 0, -8, -8, 8, 8, 8, -8, 0, 0] };
function vanillaGuardian(P, age) {
  for (let i = 0; i < 12; i++) {
    const s = P["spine" + (i + 1)]; if (!s) continue;
    const f = 1 + Math.cos(age * 1.5 + i) * 0.01 - 0.55 * 0;                  // púas afuera (no está atacando)
    s.position.set(PUAS.x[i] * f, 16 + PUAS.y[i] * f, PUAS.z[i] * f);
    s.rotation.set(PI * PUAS.rx[i], PI * PUAS.ry[i], PI * PUAS.rz[i]);
  }
}

// modelos de Bedrock: animación básica como el vanilla (patas en pares diagonales o alternadas, brazos al revés que las
// piernas, cabeza que mira, alas que aletean, cola que se mece)
function posarBedrock(m, e, t, g, fase) {
  const R = m.be, sw = Math.sin(e.fi), marcha = m.F.marcha;
  const resp = 1 + Math.sin(t * 2.2 + fase) * 0.012;
  m.pivote.scale.set(1 / Math.sqrt(e.sqY) * (2 - resp), e.sqY * resp, 1 / Math.sqrt(e.sqY) * (2 - resp));
  m.pivote.rotation.order = "YXZ";
  m.pivote.rotation.set(e.pitch, 0, e.roll + (e.rollAc || 0));
  const base = (gr) => gr.userData.base;
  const cuad = R.piernas.length >= 4;
  for (const { g: p, x, z } of R.piernas) {
    const lado = x < 0 ? 1 : -1, frente = z < 0 ? 1 : -1;
    const s = cuad ? lado * frente : lado;                                   // cuadrúpedos: pares diagonales
    p.rotation.x = base(p).x + s * sw * 0.9 * e.amp;
  }
  const golpe = e.ataque > 0 ? Math.sin(Math.PI * e.ataque) : 0;                  // atacar: los brazos suben y caen
  for (const { g: b, x } of R.brazos) b.rotation.x = base(b).x - (x < 0 ? 1 : -1) * sw * 0.7 * e.amp * (1 - golpe) + Math.sin(t * 1.3 + fase) * 0.03 - golpe * 2.1;
  const aleteo = marcha === "volar" ? Math.sin(t * (m.F.alto > 2 ? 4 : 18) + fase) : 0;
  for (const { g: a, x } of R.alas) a.rotation.z = base(a).z + (x < 0 ? -1 : 1) * aleteo * 0.6;
  R.colas.forEach((c, i) => { c.rotation.y = base(c).y + Math.sin(t * 2.5 + fase + i) * 0.15 * (1 + e.amp); });
  if (R.cabeza) {
    R.cabeza.rotation.x = base(R.cabeza).x + e.cabX;
    R.cabeza.rotation.y = base(R.cabeza).y + e.cY; R.cabeza.rotation.z = base(R.cabeza).z + e.cZ;
  }
}

// can-can: {tiempos: [s, …] (tiempo de la toma), patada (rad, 1.75), alterna (true), brazos (true)}. En cada tiempo la
// pierna sube al frente (pico en el instante exacto: los mobs patean EN la nota) y vuelve; las patadas alternan derecha e
// izquierda y los vecinos de la fila van al revés (k par / impar), como una línea de can-can. Saltito sobre la pierna de
// apoyo y brazos arriba. Devuelve cuánto sube el cuerpo (bloques). Sirve para los modelos clásicos, CEM y Bedrock.
function cancan(m, g, t, k) {
  const C = g.cancan, ts = C.tiempos || [];
  let lo = 0, hi = ts.length;
  while (lo < hi) { const md = (lo + hi) >> 1; if (ts[md] < t - 0.3) lo = md + 1; else hi = md; }
  let patD = 0, patI = 0, salto = 0;
  for (let i = lo; i < ts.length && ts[i] <= t + 0.18; i++) {
    const u = t - ts[i];                                            // −0.18 … 0.3 alrededor del tiempo
    const f = u < 0 ? Math.sin((1 + u / 0.18) * PI / 2) ** 2 : Math.max(0, 1 - u / 0.3) ** 1.6;
    const derecha = ((i + (C.alterna === false ? 0 : (C.par ?? k))) % 2) === 0;   // par: lugar en la fila (vecinos al revés)
    if (derecha) patD = Math.max(patD, f); else patI = Math.max(patI, f);
    salto = Math.max(salto, Math.sin(Math.min(1, Math.max(0, (u + 0.18) / 0.4)) * PI) * 0.12);
  }
  const A = -(C.patada ?? 1.75);                                    // negativo = al frente (modelo de Minecraft, y hacia abajo)
  const brazo = C.brazos === false ? 0 : 1;
  if (m.cem) {
    for (const c of m.cem) {
      const P = c.partes;
      if (P.right_leg) P.right_leg.rotation.x += A * patD;
      if (P.left_leg) P.left_leg.rotation.x += A * patI;
      if (brazo && P.right_arm) { P.right_arm.rotation.x = -0.25; P.right_arm.rotation.z = 2.3; }
      if (brazo && P.left_arm) { P.left_arm.rotation.x = -0.25; P.left_arm.rotation.z = -2.3; }
    }
  } else if (m.be) {
    for (const { g: p, x } of m.be.roles?.piernas || m.be.piernas || []) p.rotation.x += A * (x < 0 ? patD : patI);
  } else {
    const N = m.nodos;
    if (N.piernaD) N.piernaD.rotation.x += A * patD;
    if (N.piernaI) N.piernaI.rotation.x += A * patI;
    if (brazo && N.brazoD) { N.brazoD.rotation.x = -0.25; N.brazoD.rotation.z = 2.3; }
    if (brazo && N.brazoI) { N.brazoI.rotation.x = -0.25; N.brazoI.rotation.z = -2.3; }
  }
  // giros: [t, …] → una vuelta entera en 0,4 s que termina en t (cae en el tiempo) · cae: t → se va de boca (dominó)
  for (const tg of C.giros || []) {
    const u = (t - (tg - 0.4)) / 0.4;
    if (u > 0 && u < 1) m.raiz.rotation.y += 2 * PI * (u * u * (3 - 2 * u));
  }
  if (C.cae != null && t > C.cae) {
    const u = Math.min(1, (t - C.cae) / 0.35);
    m.pivote.rotation.x += (PI / 2) * u * u;                         // acelera al caer, como una ficha
    salto = -0.4 * u;
  }
  return salto;
}

function posar(m, e, t, g, fase) {
  if (m.be) return posarBedrock(m, e, t, g, fase);
  if (m.cem) {                       // Fresh Animations ya movió las partes: aquí solo el peso del cuerpo y las rodadas
    m.pivote.scale.set(1 / Math.sqrt(e.sqY), e.sqY, 1 / Math.sqrt(e.sqY));
    m.pivote.rotation.order = "YXZ";
    m.pivote.rotation.set(e.pitch * 0.45, 0, e.roll * 0.35 + (e.rollAc || 0));
    return;
  }
  const N = m.nodos, b = (n) => N[n]?.userData.base;
  const rotX = (n, v) => { if (N[n]) N[n].rotation.x = b(n).x + v; };
  const marcha = m.F.marcha, sw = Math.sin(e.fi), sw2 = Math.sin(e.fi + PI);
  // respirar: el cuerpo se expande muy poco (nunca está congelado)
  const resp = 1 + Math.sin(t * 2.2 + fase) * 0.012;
  m.pivote.scale.set(1 / Math.sqrt(e.sqY) * (2 - resp), e.sqY * resp, 1 / Math.sqrt(e.sqY) * (2 - resp));
  m.pivote.rotation.order = "YXZ";
  m.pivote.rotation.set(e.pitch, 0, e.roll + (e.rollAc || 0));
  if (marcha === "bipedo") {
    rotX("piernaD", sw * 0.85 * e.amp); rotX("piernaI", sw2 * 0.85 * e.amp);
    rotX("brazos", e.brz);
    if (N.brazos) N.brazos.position.y = 3 - e.brz * 3;
  } else if (marcha === "pollito") {
    rotX("piernaD", sw * 1.0 * e.amp); rotX("piernaI", sw2 * 1.0 * e.amp);
    const aleteo = Math.max(e.salto, e.s > 1.6 ? 0.7 : 0, g.modo === "flotar" || g.modo === "lanzar" || g.modo === "caer" ? 1 : 0);
    const ala = aleteo > 0 ? (0.55 + 0.55 * Math.sin(t * 34 + fase)) * aleteo : 0.05 * Math.sin(t * 3 + fase);
    if (N.alaD) N.alaD.rotation.z = ala; if (N.alaI) N.alaI.rotation.z = -ala;
  } else if (marcha === "calamar") {
    const p = Math.max(0, Math.sin(t * 2.6 + fase)) ** 2;                   // un solo pulso para los 8 tentáculos (vanilla)
    for (let i = 0; i < 8; i++) rotX("tent" + i, -0.15 - p * 0.75);
  } else if (marcha === "strider") {
    rotX("piernaD", sw * 0.9 * Math.max(e.amp, 0.15)); rotX("piernaI", sw2 * 0.9 * Math.max(e.amp, 0.15));
    for (let i = 0; i < 6; i++) if (N["pelo" + i]) N["pelo" + i].rotation.z = b("pelo" + i).z * (1 + 0.25 * e.amp) + Math.sin(t * (3 + i * 0.7) + fase + i) * 0.08;
  } else {                                                                     // cuadrúpedos y cubito: pares diagonales
    const A = marcha === "cubito" ? 1.1 : 0.9;
    rotX("piernaDT", sw * A * e.amp); rotX("piernaIF", sw * A * e.amp); rotX("piernaIT", sw2 * A * e.amp); rotX("piernaDF", sw2 * A * e.amp);
    if (e.rollAc) { const p = Math.sin(t * 15 + fase) * 0.5; rotX("piernaDT", p); rotX("piernaIF", -p); rotX("piernaIT", -p); rotX("piernaDF", p); }   // patalean al rodar
    if (e.aullido > 0.01) { rotX("piernaDF", -0.12 * e.aullido); rotX("piernaIF", -0.12 * e.aullido); rotX("piernaDT", 0.18 * e.aullido); rotX("piernaIT", 0.18 * e.aullido); }
  }
  if (N.cabeza) {
    N.cabeza.rotation.x = (b("cabeza")?.x || 0) + e.cabX + (e.aullido > 0.5 ? Math.sin(t * 38) * 0.015 : 0);
    N.cabeza.rotation.y = e.cY; N.cabeza.rotation.z = e.cZ;
  }
  if (N.orejaD) { N.orejaD.rotation.x = e.ore; N.orejaD.rotation.z = -0.1 - e.ore * 0.3; }
  if (N.orejaI) { N.orejaI.rotation.x = e.ore * 0.9; N.orejaI.rotation.z = 0.1 + e.ore * 0.3; }
  if (N.cola) {
    const menea = m.tipo === "lobo" && e.aullido < 0.3 ? Math.sin(t * 13 + fase) * 0.35 * (1 - Math.min(1, e.s / 2)) : 0;
    N.cola.rotation.x = b("cola").x + e.colaX; N.cola.rotation.z = e.colaZ + menea;
  }
  if (N.cuerpo && marcha === "cubito") N.cuerpo.rotation.z = Math.sin(e.fi) * 0.08 * e.amp;
}

export class Mobs {
  constructor(scene) {
    this.grupo = new THREE.Group();
    scene.add(this.grupo);
    this.pool = {};
    this.sims = new Map();
    this.puntoFoco = null;
    // al llegar los modelos de Fresh Animations se rehacen los mobs (los que se crearon antes eran los vanilla)
    this.cem = cargarModelosCEM().then(() => { for (const l of Object.values(this.pool)) for (const m of l) this.grupo.remove(m.raiz); this.pool = {}; this.sims.clear(); });
    this.biblioteca = cargarBiblioteca();
    this.listos = new Set();                               // tipos de la biblioteca ya cargados (modelo + animaciones)
    this.cargando = {};
  }

  // carga lo que necesitan estos tipos (modelos de FA o geometría de Bedrock); los del tráiler ya vienen cargados
  async asegurar(tipos) {
    await this.biblioteca; await this.cem;
    await Promise.all([...new Set(tipos)].map(tipo => {
      const M = MODELOS[tipo];
      if (!M?.generico || this.listos.has(tipo)) return null;
      this.cargando[tipo] ??= (async () => {
        if (CAPAS_CEM[tipo]) {
          const capas = CAPAS_CEM[tipo]({});
          // también los modelos de sus variantes (la vaca fría usa cold_cow)
          const jems = new Set([...capas.map(c => c[0]), ...(M.generico.variantes || []).flatMap(v => (v.capas || []).map(c => c[0]))]);
          await Promise.all([...jems].map(async (n) => { if (!(n in DEFS_CEM)) DEFS_CEM[n] = await cargarCEM(n); }));
          if (!capas.every(c => DEFS_CEM[c[0]])) await cargarBE(tipo);    // sin FA: geometría de Bedrock (si la hay)
        } else await cargarBE(tipo);
        this.listos.add(tipo);
      })();
      return this.cargando[tipo];
    }));
  }

  tomar(tipo, i, g) {
    const clave = this.clave({ ...g, tipo });
    const lista = (this.pool[clave] ??= []);
    while (lista.length <= i) { const m = crearMob(tipo, g); if (!m) return null; lista.push(m); this.grupo.add(m.raiz); }
    return lista[i];
  }
  clave(g) { return g.tipo + (g.armadura || "") + (g.color || "") + (g.baul ? "b" : "") + (g.bebe ? "n" : "") + (g.variante ? "~" + g.variante : ""); }
  // el grupo con el tipo ya resuelto (acepta ids de Java y nombres en español: "zombie", "Esqueleto")
  normal(g) { if (MODELOS[g.tipo]) return g; const t = resolverTipo(g.tipo); return t ? { ...g, tipo: t } : g; }

  // crea de antemano todos los mobs de las tomas y espera sus texturas (si no, el primer cuadro sale vacío)
  async precargar(escenas) {
    await this.cem; await this.biblioteca;
    const grupos = (escenas || []).flatMap(e => (e.mobs || []).map(g => this.normal(g)));
    await this.asegurar(grupos.map(g => g.tipo));
    await Promise.all(grupos.filter(g => g.objeto).map(g => crearObjetoMano(g.objeto)));
    await precargarEfectos(escenas);                       // imágenes de los cuadros (efectos.js)
    await precargarMundos(escenas);                        // mundos reales importados (mundo_real.py)
    const max = {};
    for (const e of escenas || []) {
      const cuenta = {};
      for (const g0 of e.mobs || []) {
        const g = this.normal(g0);
        if (!MODELOS[g.tipo]) continue;
        const clave = this.clave(g);
        for (let k = 0; k < (g.n ?? 1); k++) { cuenta[clave] = (cuenta[clave] || 0) + 1; if (cuenta[clave] > (max[clave] || 0)) { max[clave] = cuenta[clave]; const m = this.tomar(g.tipo, cuenta[clave] - 1, g); if (m) m.raiz.visible = false; } }
      }
    }
    return texturasMobsListas();
  }

  // posición inicial de cada mob del grupo (dispersión sin encimarse)
  bases(g) {
    g = this.normal(g);
    const r = rng((g.semilla ?? 1) * 7 + 3), dir = (g.dir ?? 0) * PI / 180;
    const esc = (g.escala ?? 1) * (MODELOS[g.tipo].escala ?? 1), F = FISICA[g.tipo];
    const fx = Math.sin(dir), fz = Math.cos(dir), n = g.n ?? 1;
    const fijo = g.fijo || n === 1 && g.ancho === 0;
    const out = [];
    for (let k = 0; k < n; k++) {
      let lado = 0, fondo = 0;
      for (let intento = 0; intento < 10; intento++) {
        lado = fijo ? 0 : (r() - 0.5) * (g.ancho ?? 2); fondo = fijo ? 0 : (r() - 0.5) * (g.prof ?? 2);
        const x = fz * lado + fx * fondo, z = -fx * lado + fz * fondo;
        if (fijo || out.every(o => Math.hypot(o.dx0 - x, o.dz0 - z) > F.ancho * esc * 0.95)) break;
      }
      const fase = r() * 10, vel = (g.vel ?? 1) * (fijo ? 1 : 0.85 + r() * 0.3), atraso = r() * (g.escalonado ?? 0), giro = fijo ? 0 : (r() - 0.5) * 0.35;
      const dx0 = fx * fondo + fz * lado, dz0 = fz * fondo - fx * lado;
      // vuelan / nadan a una altura (g.y la cambia); las crías, a la mitad
      const yBase = g.y ?? (F.marcha === "volar" ? 1.6 : F.marcha === "nadar" ? 0.6 : 0);
      out.push({ dx0, dz0, x: (g.x ?? 0) + dx0, z: (g.z ?? 0) + dz0, dx: 0, dz: 0, y: yBase, yaw: dir + giro, fase, vel, atraso, esc: esc * (g.bebe && !NINOS.has(g.tipo) ? 0.5 : 1) });
    }
    return out;
  }

  // grupos: lista de specs · tau: tiempo dentro de la escena · ancla: {x, y, z} · mundo: escenario (terreno) · dur: duración de la toma
  actualizar(grupos, tau, ancla, mundo = null, dur = 3, nombreSet = "") {
    const usados = {};
    this.puntoFoco = null;
    let primero = null;
    grupos?.forEach((g0, gi) => {
      const g = this.normal(g0);
      if (!MODELOS[g.tipo]) return;
      if (MODELOS[g.tipo].generico && !this.listos.has(g.tipo)) { this.asegurar([g.tipo]); return; }   // aparece en cuanto carga
      const clave = this.clave(g);
      const bases = this.bases(g);
      bases.forEach((bs, k) => {
        usados[clave] ??= 0;
        const m = this.tomar(g.tipo, usados[clave]++, g);
        if (!m) return;
        const t = Math.max(0, tau - (g.retraso ?? 0) - bs.atraso);
        const modo = g.modo || "caminar";
        // las coordenadas del grupo son relativas al ancla: la simulación trabaja en coordenadas de la escena
        const b2 = { ...bs, x: ancla.x + bs.x, z: ancla.z + bs.z, y: (ancla.y || 0) + bs.y, dx: ancla.x, dz: ancla.z };
        const ck = [nombreSet, gi, k, dur, JSON.stringify(g), ancla.x, ancla.y, ancla.z].join("|");
        let sim = this.sims.get(ck);
        if (!sim) { sim = simular(m, g, k, b2, mundo, dur); this.sims.set(ck, sim); if (this.sims.size > 900) this.sims.delete(this.sims.keys().next().value); }
        const xi = Math.min(sim.length - 1.001, t * HZ), i0 = Math.floor(xi), f = xi - i0;
        const A = sim[i0], Bn = sim[i0 + 1] || A, L = (c) => A[c] + (Bn[c] - A[c]) * f;
        const e = {}; for (const c in A) if (c !== "pose") e[c] = L(c);
        if (m.cem && A.pose) m.cem.forEach((c, j) => c.poner(A.pose[j], Bn.pose?.[j], f));
        let px = e.x, py = e.y, pz = e.z, extraX = 0, extraZ = 0;
        // modos sin suelo (analíticos, como antes) con la misma vida encima
        const r = rng((g.semilla ?? 1) * 13 + k * 5);
        const fx = Math.sin(bs.yaw), fz = Math.cos(bs.yaw);
        if (modo === "caer") {
          const h0 = g.altura ?? 6, tc = Math.sqrt(2 * h0 / 9.8);
          if (t < tc) { py += h0 - 0.5 * 9.8 * t * t; extraX = t * (3 + r() * 3); extraZ = t * (2 + r() * 2); }
          else { const tb = t - tc; py += Math.max(0, Math.sin(tb * 7) * 0.3 * Math.exp(-tb * 3)); extraX = tc * 4 * Math.exp(-tb * 4); }
          if (g.gira === false) {                         // cae derecho, aterriza de pie y se agacha con el golpe
            extraX = extraZ = 0;
            if (t >= tc) { const tb = t - tc; py = e.y - Math.sin(Math.min(1, tb / 0.35) * PI) * 0.18; }
          }
        } else if (modo === "lanzar") {
          const vy = g.vy ?? 10; py += Math.max(0, vy * t - 4.9 * t * t); extraX = t * (2 + r() * 3); extraZ = t * (1 + r() * 2);
          px += (r() - 0.5) * t * 1.5; pz += (r() - 0.5) * t * 1.5;
        } else if (modo === "flotar") {
          px += fx * bs.vel * t; pz += fz * bs.vel * t; py += Math.sin(t * 1.2 + bs.fase) * 0.25 + (g.sube ?? 0) * t;
          if (m.F.marcha === "calamar") py += Math.max(0, Math.sin(t * 2.6 + bs.fase - 0.6)) * 0.12;       // empuje de cada pulso
          extraX = Math.sin(t * 0.8 + bs.fase) * 0.3;
        }
        m.raiz.position.set(px, py, pz);
        m.raiz.rotation.set(0, e.yaw, 0);
        m.escala.scale.setScalar(bs.esc / 16 * (m.cem && m.nino && NINOS.has(g.tipo) ? (g.tipo === "pollito" ? 0.5 / 1.4 : g.tipo === "cubito" ? 0.3 : 0.5 / (MODELOS[g.tipo].escala ?? 1)) : 1));
        posar(m, e, t, g, bs.fase);
        if (g.cancan) py += cancan(m, g, t, k);
        if (g.cancan) m.raiz.position.y = py;
        ponerObjetoMob(m, g.objeto || null);
        if (extraX || extraZ) { m.pivote.rotation.x += extraX; m.pivote.rotation.z += extraZ; }
        // cabeza con tiempos: [[t, grados], ...] (para que un aldeano voltee a la cámara)
        if (g.cabezaYaw && m.nodos.cabeza) {
          const kk = g.cabezaYaw; let a = kk[0][1];
          for (let i = 1; i < kk.length; i++) if (tau >= kk[i - 1][0]) { const u = Math.min(1, (tau - kk[i - 1][0]) / Math.max(0.01, kk[i][0] - kk[i - 1][0])); a = kk[i - 1][1] + (kk[i][1] - kk[i - 1][1]) * (u * u * (3 - 2 * u)); }
          m.nodos.cabeza.rotation.y = -a * PI / 180;
        }
        m.raiz.visible = true;
        if (m.M?.error) posarError(m, g, t);
        m.raiz.userData.spec = { grupo: gi, k, g };          // para la API del agente (qué mob de la toma es)
        // en el aire a propósito (flotar, lanzado, cayendo, saltito, rodada): el diagnóstico de física no lo cuenta
        m.raiz.userData.libre = ["flotar", "lanzar", "caer"].includes(modo) || e.salto > 0.01 || Math.abs(e.rollAc || 0) > 0.01 || g.suelo === false || ["volar", "nadar"].includes(m.F.marcha);
        // punto de foco: la cabeza del mob marcado con foco (o el primero de la toma)
        const cab = new THREE.Vector3(px, py + m.F.alto * bs.esc * 0.82, pz);
        if (g.foco && !this.puntoFoco) this.puntoFoco = cab;
        if (!primero) primero = cab;
      });
    });
    if (!this.puntoFoco) this.puntoFoco = primero;
    for (const [clave, lista] of Object.entries(this.pool)) for (let i = usados[clave] || 0; i < lista.length; i++) lista[i].raiz.visible = false;
  }

  // diagnóstico: mobs metidos en bloques o flotando (para revisar la física de cada toma desde la consola)
  revisar(mundo) {
    const malos = [];
    if (!mundo) return malos;
    for (const lista of Object.values(this.pool)) for (const m of lista) {
      if (!m.raiz.visible || m.raiz.userData.libre) continue;
      const p = m.raiz.position, alto = m.F.alto * (m.escala.scale.x * 16);
      const piso0 = piso(mundo, p.x, p.z, p.y + 0.4, Math.min(alto, 0.9));
      if (piso0 == null) malos.push({ tipo: m.tipo, x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2), problema: "dentro de un bloque" });
      else if (p.y - piso0 > 0.35) malos.push({ tipo: m.tipo, x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2), problema: "flotando " + (p.y - piso0).toFixed(2) });
      else if (piso0 - p.y > 0.08) malos.push({ tipo: m.tipo, x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2), problema: "hundido " + (piso0 - p.y).toFixed(2) });
    }
    return malos;
  }
}
