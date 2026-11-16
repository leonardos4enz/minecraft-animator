// Mundo de bloques: terreno generado + construcción a mano. Malla por caras visibles con
// oclusión ambiental por vértice (la "iluminación suave" de Minecraft), texturas pixel art
// generadas aquí mismo (16x16) en un atlas, y puertas de roble que se abren.
import * as THREE from "three";

export const TAM = { x: 72, y: 48, z: 72 };
export const ORIGEN = { x: 36, y: 20, z: 36 };      // celda cuyo piso queda en y=0 de la escena

// ───────────── texturas pixel art ─────────────
function rng(semilla) { let s = semilla % 2147483647 || 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
const hexA = (h) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const varia = (h, k) => { const c = hexA(h); return `rgb(${c.map(v => Math.max(0, Math.min(255, Math.round(v * k)))).join(",")})`; };

const PINTORES = {
  pasto_top: (p, r) => p.ruido(["#5f9e3c", "#6cad45", "#548f34", "#77b84e"]),
  pasto_lado: (p, r) => { p.ruido(["#866043", "#79553a", "#966c4a", "#6c4a31"]); for (let x = 0; x < 16; x++) { const h = 3 + (r() < 0.45 ? 1 : 0) + (r() < 0.2 ? 1 : 0); for (let y = 0; y < h; y++) p.px(x, y, ["#5f9e3c", "#6cad45", "#548f34"][Math.floor(r() * 3)]); } },
  tierra: (p) => p.ruido(["#866043", "#79553a", "#966c4a", "#6c4a31"]),
  piedra: (p, r) => { p.ruido(["#7d7d7d", "#747474", "#868686", "#6c6c6c"]); for (let i = 0; i < 9; i++) { const x = Math.floor(r() * 15), y = Math.floor(r() * 15); p.px(x, y, "#5f5f5f"); p.px(x + 1, y, "#666"); } },
  adoquin: (p, r) => { p.ruido(["#7a7a7a", "#8a8a8a", "#6e6e6e"]); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if ((x + Math.floor(y / 4) * 3) % 5 === 0 || y % 4 === 0) p.px(x, y, r() < 0.5 ? "#4f4f4f" : "#5a5a5a"); },
  tablones: (p, r) => { p.ruido(["#a2834f", "#9c7c48", "#ae8e58"]); for (let y = 0; y < 16; y++) { if (y % 4 === 3) for (let x = 0; x < 16; x++) p.px(x, y, "#6d5631"); } for (let y = 0; y < 16; y += 4) { const x = (y * 5 + 3) % 16; for (let k = 0; k < 3; k++) p.px(x, y + k, "#7a6038"); } },
  tablones_oscuros: (p) => { p.ruido(["#4a3220", "#53392a", "#432c1b"]); for (let y = 3; y < 16; y += 4) for (let x = 0; x < 16; x++) p.px(x, y, "#2c1c10"); },
  tronco_lado: (p, r) => { for (let x = 0; x < 16; x++) { const b = ["#6b5034", "#5a4229", "#7a5c3c", "#4f3a24"][(x * 7 + (x > 8 ? 1 : 0)) % 4]; for (let y = 0; y < 16; y++) p.px(x, y, r() < 0.15 ? "#3f2d1b" : b); } },
  tronco_top: (p) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5)); p.px(x, y, d > 6.5 ? "#5a4229" : Math.floor(d) % 2 ? "#b8945f" : "#a68350"); } },
  hojas: (p, r) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) p.px(x, y, r() < 0.12 ? "rgba(0,0,0,0)" : ["#3f8a2c", "#357a24", "#4c9a36", "#2d6b1e"][Math.floor(r() * 4)]); },
  vidrio: (p) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const borde = x === 0 || y === 0 || x === 15 || y === 15; p.px(x, y, borde ? "rgba(220,240,250,.95)" : (x - y === 4 || x - y === 5 || x - y === -6) ? "rgba(255,255,255,.55)" : "rgba(190,225,245,.18)"); } },
  arena: (p) => p.ruido(["#dbd3a0", "#d5cb93", "#e2dbab", "#cfc48a"]),
  ladrillo: (p, r) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const fila = Math.floor(y / 4), junta = y % 4 === 3 || (x + (fila % 2) * 4) % 8 === 7; p.px(x, y, junta ? "#b5a89c" : ["#9a4b3c", "#8c4234", "#a65444"][Math.floor(r() * 3)]); } },
  concreto_blanco: (p) => p.ruido(["#d4d9da", "#cfd4d5", "#d8dddd"]),
  concreto_gris: (p) => p.ruido(["#7a7f82", "#767b7e", "#7e8386"]),
  concreto_oscuro: (p) => p.ruido(["#3a3d44", "#363940", "#3e4148"]),
  concreto_celeste: (p) => p.ruido(["#7cb6d6", "#76b0d1", "#82bcdb"]),
  concreto_azul: (p) => p.ruido(["#3b64a8", "#365e9f", "#4069ad"]),
  cuarzo: (p) => { p.ruido(["#ece6df", "#e8e1da", "#f0ebe5"]); for (let i = 0; i < 16; i++) p.px(i, 0, "#d9d1c8"); },
  piedra_lisa: (p) => { p.ruido(["#a3a3a3", "#9e9e9e", "#a8a8a8"]); for (let i = 0; i < 16; i++) { p.px(i, 0, "#8a8a8a"); p.px(i, 15, "#8a8a8a"); p.px(0, i, "#8a8a8a"); p.px(15, i, "#8a8a8a"); } },
  lana_roja: (p) => p.ruido(["#a12722", "#9a231e", "#a92b26"]),
  lana_amarilla: (p) => p.ruido(["#f8c527", "#f2bf20", "#fccb2f"]),
  nieve: (p) => p.ruido(["#f4fcfc", "#eef7f7", "#fafefe"]),
  terracota: (p) => p.ruido(["#985f45", "#925a40", "#9e644a"]),
  ladrillo_piedra: (p, r) => { p.ruido(["#7a7a7a", "#838383", "#727272"]); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (y % 8 === 7 || (x + (Math.floor(y / 8) % 2) * 8) % 16 === 15) p.px(x, y, "#5b5b5b"); },
  estanteria: (p, r) => { p.ruido(["#a2834f", "#9c7c48"]); const c = ["#7a2f2f", "#2f4f7a", "#3d6b3a", "#8a6a2a", "#5a3a6a"]; for (const y0 of [1, 9]) for (let x = 1; x < 15; x++) { const col = c[Math.floor(r() * c.length)]; for (let y = y0; y < y0 + 6; y++) p.px(x, y, col); } },
  luz: (p) => p.ruido(["#f8d48a", "#e9b45a", "#fbe7a8", "#c99442"]),
  andesita: (p) => { p.ruido(["#848786", "#7d807f", "#8b8e8d"]); for (let i = 0; i < 16; i++) { p.px(i, 0, "#6f7271"); p.px(0, i, "#6f7271"); } },
  abeto: (p) => { p.ruido(["#735532", "#6b4f2e", "#7b5b37"]); for (let y = 3; y < 16; y += 4) for (let x = 0; x < 16; x++) p.px(x, y, "#4d3820"); },
  abedul: (p) => { p.ruido(["#c5b077", "#bfa96f", "#cdb87f"]); for (let y = 3; y < 16; y += 4) for (let x = 0; x < 16; x++) p.px(x, y, "#9a8656"); },
  concreto_negro: (p) => p.ruido(["#08090d", "#0c0d12", "#101117"]),
  puerta_abajo: (p, r) => { p.ruido(["#b2834a", "#a87b44", "#ba8b50"]); for (let y = 0; y < 16; y++) { p.px(0, y, "#7d5a30"); p.px(15, y, "#7d5a30"); } for (let x = 0; x < 16; x++) p.px(x, 15, "#7d5a30"); for (let y = 2; y < 13; y++) { p.px(3, y, "#8f6838"); p.px(12, y, "#8f6838"); } for (let x = 3; x < 13; x++) { p.px(x, 2, "#8f6838"); p.px(x, 12, "#8f6838"); } p.px(13, 2, "#c9c9c9"); p.px(13, 3, "#9c9c9c"); p.px(12, 2, "#e0e0e0"); },
  cerezo_hojas: (p, r) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) p.px(x, y, r() < 0.1 ? "rgba(0,0,0,0)" : ["#f2a7c8", "#e88db8", "#f7bfd7", "#d97aa6"][Math.floor(r() * 4)]); },
  cerezo_tronco: (p, r) => { for (let x = 0; x < 16; x++) { const b = ["#3b2532", "#46303c", "#33202b"][x % 3]; for (let y = 0; y < 16; y++) p.px(x, y, r() < 0.12 ? "#2a1820" : b); } },
  cerezo_tronco_top: (p) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5)); p.px(x, y, d > 6.5 ? "#3b2532" : Math.floor(d) % 2 ? "#e3b0b9" : "#d49aa6"); } },
  netherrack: (p) => p.ruido(["#6f2a2a", "#622323", "#7b3131", "#552020"]),
  nylium_top: (p) => p.ruido(["#8f1d1d", "#a32424", "#7d1818", "#b02b2b"]),
  nylium_lado: (p, r) => { p.ruido(["#6f2a2a", "#622323", "#7b3131"]); for (let x = 0; x < 16; x++) { const h = 3 + (r() < 0.5 ? 1 : 0); for (let y = 0; y < h; y++) p.px(x, y, ["#8f1d1d", "#a32424"][Math.floor(r() * 2)]); } },
  verruga: (p) => p.ruido(["#7a0e0e", "#8a1212", "#6b0b0b", "#991818"]),
  verruga_azul: (p) => p.ruido(["#167e86", "#12707a", "#1b8f97", "#0f636b"]),
  tallo_carmesi: (p, r) => { for (let x = 0; x < 16; x++) { const b = ["#5c1a2e", "#6b2036", "#4f1527"][x % 3]; for (let y = 0; y < 16; y++) p.px(x, y, r() < 0.1 ? "#b03050" : b); } },
  tallo_carmesi_top: (p) => p.ruido(["#7a2a3e", "#6b2036", "#8a3348"]),
  brillohongo: (p) => p.ruido(["#f6a24a", "#ffbf5e", "#e98a36", "#ffd27a"]),
  abeto_tronco: (p, r) => { for (let x = 0; x < 16; x++) { const b = ["#3b2a17", "#45311b", "#33240f"][x % 3]; for (let y = 0; y < 16; y++) p.px(x, y, r() < 0.12 ? "#291c0e" : b); } },
  abeto_tronco_top: (p) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5)); p.px(x, y, d > 6.5 ? "#3b2a17" : Math.floor(d) % 2 ? "#7a5a34" : "#6a4c2a"); } },
  abeto_hojas: (p, r) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) p.px(x, y, r() < 0.1 ? "rgba(0,0,0,0)" : ["#2f5a2f", "#3a6b3a", "#284f28", "#447a44"][Math.floor(r() * 4)]); },
  pasto_nieve_lado: (p, r) => { p.ruido(["#866043", "#79553a", "#966c4a"]); for (let x = 0; x < 16; x++) { const h = 3 + (r() < 0.5 ? 1 : 0); for (let y = 0; y < h; y++) p.px(x, y, ["#f4fcfc", "#eef7f7"][Math.floor(r() * 2)]); } },
  prismarina: (p) => p.ruido(["#63a597", "#5b9a8d", "#6db1a2", "#4f8a7e"]),
  prismarina_oscura: (p) => p.ruido(["#335b4c", "#2c5243", "#3a6555"]),
  linterna_mar: (p) => p.ruido(["#d6e8e0", "#c3ddd3", "#e6f2ec", "#a9cfc3"]),
  camino_top: (p) => p.ruido(["#94753f", "#8a6c39", "#9e7e46", "#7f6334"]),
  camino_lado: (p, r) => { p.ruido(["#866043", "#79553a", "#966c4a"]); for (let x = 0; x < 16; x++) for (let y = 0; y < 2; y++) p.px(x, y, ["#94753f", "#8a6c39"][Math.floor(r() * 2)]); },
  lana_blanca: (p) => p.ruido(["#e9ecec", "#e2e5e5", "#f0f2f2"]),
  paja_lado: (p, r) => { p.ruido(["#b5970f", "#a88a0c", "#c2a419"]); for (let y = 3; y < 16; y += 6) for (let x = 0; x < 16; x++) p.px(x, y, "#8a2a1a"); },
  paja_top: (p) => p.ruido(["#b5970f", "#a88a0c", "#c2a419", "#9c7f0a"]),
  grava: (p) => p.ruido(["#837f7e", "#6f6b6a", "#958f8d", "#5e5a59"]),
  hielo: (p) => p.ruido(["#8db4f2", "#86acea", "#97bdf6"]),
  lana_lima: (p) => p.ruido(["#70b919", "#69b015", "#79c21f"]),
  concreto_rosa: (p) => p.ruido(["#d6658f", "#cf5f89", "#dc6b95"]),
  lava: (p) => p.ruido(["#e86a10", "#f08a1a", "#d45a0c", "#ffae30"]),
  pasto_corto: (p, r) => { for (let x = 0; x < 16; x++) { const h = 6 + Math.floor(r() * 9); for (let y = 16 - h; y < 16; y++) if (r() < 0.8) p.px(x, y, ["#5f9e3c", "#6cad45", "#4f8a32"][Math.floor(r() * 3)]); } },
  pasto_alto_abajo: (p, r) => { for (let x = 0; x < 16; x++) for (let y = 0; y < 16; y++) if (r() < 0.55) p.px(x, y, ["#5f9e3c", "#6cad45"][Math.floor(r() * 2)]); },
  pasto_alto_arriba: (p, r) => { for (let x = 0; x < 16; x++) { const h = 4 + Math.floor(r() * 10); for (let y = 16 - h; y < 16; y++) if (r() < 0.7) p.px(x, y, "#6cad45"); } },
  diente_leon: (p) => { for (let y = 8; y < 16; y++) p.px(7, y, "#3f8a2c"); for (const [a, b] of [[6, 5], [7, 5], [8, 5], [7, 4], [7, 6]]) p.px(a, b, "#f5d327"); },
  amapola: (p) => { for (let y = 8; y < 16; y++) p.px(7, y, "#3f8a2c"); for (const [a, b] of [[6, 5], [7, 5], [8, 5], [7, 4], [7, 6]]) p.px(a, b, "#d32a1f"); },
  margarita: (p) => { for (let y = 8; y < 16; y++) p.px(7, y, "#3f8a2c"); for (const [a, b] of [[6, 5], [8, 5], [7, 4], [7, 6]]) p.px(a, b, "#f2f2f2"); p.px(7, 5, "#f5d327"); },
  aciano: (p) => { for (let y = 8; y < 16; y++) p.px(7, y, "#3f8a2c"); for (const [a, b] of [[6, 5], [7, 5], [8, 5], [7, 4], [7, 6]]) p.px(a, b, "#4a6be0"); },
  allium: (p) => { for (let y = 8; y < 16; y++) p.px(7, y, "#3f8a2c"); for (const [a, b] of [[6, 4], [7, 4], [8, 4], [7, 3], [7, 5]]) p.px(a, b, "#b46ad8"); },
  raices: (p, r) => { for (let x = 0; x < 16; x++) { const h = 4 + Math.floor(r() * 10); for (let y = 16 - h; y < 16; y++) if (r() < 0.6) p.px(x, y, "#b0243a"); } },
  raices_azules: (p, r) => { for (let x = 0; x < 16; x++) { const h = 4 + Math.floor(r() * 10); for (let y = 16 - h; y < 16; y++) if (r() < 0.6) p.px(x, y, "#1d9a8e"); } },
  pasto_marino: (p, r) => { for (let x = 0; x < 16; x++) { const h = 6 + Math.floor(r() * 10); for (let y = 16 - h; y < 16; y++) if (r() < 0.6) p.px(x, y, "#3c8f3a"); } },
  alga: (p, r) => { for (let x = 4; x < 12; x++) for (let y = 0; y < 16; y++) if (r() < 0.7) p.px(x, y, "#4a8f2a"); },
  abedul_tronco: (p, r) => { p.ruido(["#d8d7d2", "#e3e2dc", "#cfcec8"]); for (let k = 0; k < 10; k++) { const x = Math.floor(r() * 14), y = Math.floor(r() * 16); p.px(x, y, "#2a2a28"); p.px(x + 1, y, "#3a3a36"); } },
  abedul_hojas: (p, r) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) p.px(x, y, r() < 0.12 ? "rgba(0,0,0,0)" : ["#6b9a45", "#80a755", "#5d8a3c"][Math.floor(r() * 3)]); },
  antorcha: (p) => { for (let y = 6; y < 16; y++) { p.px(7, y, "#7a5a30"); p.px(8, y, "#6b4f2a"); } p.px(7, 6, "#ffd86a"); p.px(8, 6, "#fff2b0"); p.px(7, 7, "#ffb02e"); p.px(8, 7, "#ffd86a"); },
  petalos: (p, r) => { for (let k = 0; k < 40; k++) p.px(Math.floor(r() * 16), Math.floor(r() * 16), ["#f7a8cf", "#f28dbd", "#fbc6df"][Math.floor(r() * 3)]); },
  nylium_azul_top: (p) => p.ruido(["#168a83", "#127a74", "#1d9a92"]),
  nylium_azul_lado: (p, r) => { p.ruido(["#6f2a2a", "#622323", "#7b3131"]); for (let x = 0; x < 16; x++) { const h = 3 + (r() < 0.5 ? 1 : 0); for (let y = 0; y < h; y++) p.px(x, y, "#168a83"); } },
  tallo_azul: (p) => p.ruido(["#3a6b74", "#2f5a62", "#46808a"]),
  terracota_naranja: (p) => p.ruido(["#a1531f", "#9a4e1c", "#a85824"]),
  terracota_blanca: (p) => p.ruido(["#d1b2a1", "#cbab9a", "#d6b8a8"]),
  terracota_roja: (p) => p.ruido(["#8f3d2e", "#88392b", "#963f31"]),
  terracota_gris: (p) => p.ruido(["#876a61", "#80645b", "#8d7067"]),
  tierra_gruesa: (p) => p.ruido(["#77553b", "#6b4b33", "#836043"]),
  magma: (p) => p.ruido(["#8e3a12", "#d0581a", "#5e2410"]),
  lava_cae: (p) => p.ruido(["#f08a1a", "#ffae30", "#e86a10"]),
  calcita: (p) => p.ruido(["#dfe0dc", "#e6e7e3", "#d8d9d5"]),
  ventana_luz: (p) => { p.ruido(["#ffb347", "#ffa431", "#ffc160"]); for (let i = 0; i < 16; i++) { p.px(i, 0, "#6b4f2a"); p.px(i, 15, "#6b4f2a"); p.px(0, i, "#6b4f2a"); p.px(15, i, "#6b4f2a"); p.px(7, i, "#6b4f2a"); } },
  hojas_azalea: (p) => p.ruido(["#7fb03a", "#74a534", "#8abb42"]),
  agua: (p) => p.ruido(["rgba(46,98,206,0.72)", "rgba(52,108,220,0.72)", "rgba(40,90,196,0.74)"]),
  musical: (p) => { p.ruido(["#6b4a33", "#62432e", "#734f37"]); for (let i = 1; i < 15; i += 3) for (let j = 2; j < 14; j++) p.px(i, j, "#3b2a1e"); },   // bloque musical (si no hay textura real)
  puerta_arriba: (p) => { p.ruido(["#b2834a", "#a87b44", "#ba8b50"]); for (let y = 0; y < 16; y++) { p.px(0, y, "#7d5a30"); p.px(15, y, "#7d5a30"); } for (let x = 0; x < 16; x++) p.px(x, 0, "#7d5a30"); for (let y = 3; y < 16; y++) { p.px(3, y, "#8f6838"); p.px(12, y, "#8f6838"); } for (let x = 3; x < 13; x++) p.px(x, 3, "#8f6838"); },
};

// id → {nombre, tex: {top, lado, abajo}, tipo: solido | recorte | vidrio | puerta}
export const BLOQUES = [
  null,
  { nombre: "Pasto", tex: { top: "pasto_top", lado: "pasto_lado", abajo: "tierra" } },
  { nombre: "Tierra", tex: "tierra" },
  { nombre: "Piedra", tex: "piedra" },
  { nombre: "Adoquín", tex: "adoquin" },
  { nombre: "Tablones", tex: "tablones" },
  { nombre: "Tronco", tex: { top: "tronco_top", lado: "tronco_lado", abajo: "tronco_top" } },
  { nombre: "Hojas", tex: "hojas", tipo: "recorte" },
  { nombre: "Vidrio", tex: "vidrio", tipo: "vidrio" },
  { nombre: "Arena", tex: "arena" },
  { nombre: "Ladrillo", tex: "ladrillo" },
  { nombre: "Concreto blanco", tex: "concreto_blanco" },
  { nombre: "Concreto gris", tex: "concreto_gris" },
  { nombre: "Concreto oscuro", tex: "concreto_oscuro" },
  { nombre: "Concreto celeste", tex: "concreto_celeste" },
  { nombre: "Concreto azul", tex: "concreto_azul" },
  { nombre: "Cuarzo", tex: "cuarzo" },
  { nombre: "Piedra lisa", tex: "piedra_lisa" },
  { nombre: "Lana roja", tex: "lana_roja" },
  { nombre: "Lana amarilla", tex: "lana_amarilla" },
  { nombre: "Puerta de roble", tex: { top: "puerta_arriba", lado: "puerta_abajo", abajo: "puerta_abajo" }, tipo: "puerta" },
  { nombre: "Tablones oscuros", tex: "tablones_oscuros" },
  { nombre: "Terracota", tex: "terracota" },
  { nombre: "Nieve", tex: "nieve" },
  { nombre: "Ladrillos de piedra", tex: "ladrillo_piedra" },
  { nombre: "Librero", tex: { top: "tablones", lado: "estanteria", abajo: "tablones" } },
  { nombre: "Piedra luminosa", tex: "luz", luz: true },
  { nombre: "Andesita pulida", tex: "andesita" },
  { nombre: "Tablones de abeto", tex: "abeto" },
  { nombre: "Tablones de abedul", tex: "abedul" },
  { nombre: "Concreto negro", tex: "concreto_negro" },
  // escenarios del tráiler
  { nombre: "Hojas de cerezo", tex: "cerezo_hojas", tipo: "recorte" },
  { nombre: "Tronco de cerezo", tex: { top: "cerezo_tronco_top", lado: "cerezo_tronco", abajo: "cerezo_tronco_top" } },
  { nombre: "Netherrack", tex: "netherrack" },
  { nombre: "Nylium carmesí", tex: { top: "nylium_top", lado: "nylium_lado", abajo: "netherrack" } },
  { nombre: "Bloque de verruga", tex: "verruga" },
  { nombre: "Verruga distorsionada", tex: "verruga_azul" },
  { nombre: "Tallo carmesí", tex: { top: "tallo_carmesi_top", lado: "tallo_carmesi", abajo: "tallo_carmesi_top" } },
  { nombre: "Brillohongo", tex: "brillohongo", luz: true },
  { nombre: "Tronco de abeto", tex: { top: "abeto_tronco_top", lado: "abeto_tronco", abajo: "abeto_tronco_top" } },
  { nombre: "Hojas de abeto", tex: "abeto_hojas", tipo: "recorte" },
  { nombre: "Pasto nevado", tex: { top: "nieve", lado: "pasto_nieve_lado", abajo: "tierra" } },
  { nombre: "Prismarina", tex: "prismarina" },
  { nombre: "Prismarina oscura", tex: "prismarina_oscura" },
  { nombre: "Linterna de mar", tex: "linterna_mar", luz: true },
  { nombre: "Camino de tierra", tex: { top: "camino_top", lado: "camino_lado", abajo: "tierra" } },
  { nombre: "Lana blanca", tex: "lana_blanca" },
  { nombre: "Paja", tex: { top: "paja_top", lado: "paja_lado", abajo: "paja_top" } },
  { nombre: "Grava", tex: "grava" },
  { nombre: "Hielo compacto", tex: "hielo" },
  { nombre: "Lana lima", tex: "lana_lima" },
  { nombre: "Concreto rosa", tex: "concreto_rosa" },
  { nombre: "Lava", tex: "lava", luz: true },
  // plantas en cruz
  { nombre: "Pasto", tex: "pasto_corto", tipo: "planta" },
  { nombre: "Pasto alto", tex: "pasto_alto_abajo", tipo: "planta" },
  { nombre: "Pasto alto (arriba)", tex: "pasto_alto_arriba", tipo: "planta" },
  { nombre: "Diente de león", tex: "diente_leon", tipo: "planta" },
  { nombre: "Amapola", tex: "amapola", tipo: "planta" },
  { nombre: "Margarita", tex: "margarita", tipo: "planta" },
  { nombre: "Aciano", tex: "aciano", tipo: "planta" },
  { nombre: "Allium", tex: "allium", tipo: "planta" },
  { nombre: "Raíces carmesí", tex: "raices", tipo: "planta" },
  { nombre: "Raíces distorsionadas", tex: "raices_azules", tipo: "planta" },
  { nombre: "Pasto marino", tex: "pasto_marino", tipo: "planta" },
  { nombre: "Alga", tex: "alga", tipo: "planta" },
  { nombre: "Tronco de abedul", tex: { top: "tronco_top", lado: "abedul_tronco", abajo: "tronco_top" } },
  { nombre: "Hojas de abedul", tex: "abedul_hojas", tipo: "recorte" },
  { nombre: "Capa de nieve", tex: "nieve", tipo: "capa" },
  // ronda 4 (texturas Bare Bones): escalones, antorchas, pétalos, Nether distorsionado, franjas de montaña, ventanas con luz
  { nombre: "Escalón de roble", tex: "tablones", tipo: "escalon" },
  { nombre: "Antorcha", tex: "antorcha", tipo: "antorcha", luz: true },
  { nombre: "Pétalos rosas", tex: "petalos", tipo: "alfombra" },
  { nombre: "Nylium distorsionado", tex: { top: "nylium_azul_top", lado: "nylium_azul_lado", abajo: "netherrack" } },
  { nombre: "Tallo distorsionado", tex: "tallo_azul" },
  { nombre: "Terracota naranja", tex: "terracota_naranja" },
  { nombre: "Terracota blanca", tex: "terracota_blanca" },
  { nombre: "Terracota roja", tex: "terracota_roja" },
  { nombre: "Terracota gris", tex: "terracota_gris" },
  { nombre: "Tierra gruesa", tex: "tierra_gruesa" },
  { nombre: "Magma", tex: "magma", luz: true },
  { nombre: "Lava que cae", tex: "lava_cae", luz: true },
  { nombre: "Calcita", tex: "calcita" },
  { nombre: "Ventana con luz", tex: "ventana_luz", luz: true },
  { nombre: "Hojas de azalea", tex: "hojas_azalea", tipo: "recorte" },
  { nombre: "Bloque musical", tex: "musical" },
  { nombre: "Agua", tex: "agua", tipo: "agua" },
];
// escenarios del tráiler: nombre en la interfaz y método que lo genera
export const ESCENARIOS = {
  aldea: { nombre: "Aldea (calle con casas)", fn: "aldea" },
  noche: { nombre: "Meseta y acantilado", fn: "noche" },
  nieve: { nombre: "Taiga nevada", fn: "nieve" },
  agua: { nombre: "Fondo del mar", fn: "agua" },
  cerezos: { nombre: "Bosque de cerezos", fn: "cerezos" },
  nether: { nombre: "Nether (bosque carmesí)", fn: "nether" },
  aldea_frente: { nombre: "Aldea: dos casas de frente", fn: "aldeaFrente" },
  calle: { nombre: "Aldea: callejón entre casas", fn: "calle" },
  cresta: { nombre: "Noche: cresta baja", fn: "cresta" },
  pradera: { nombre: "Pradera con arbustos", fn: "pradera" },
  pista: { nombre: "Pista de pruebas (Roadster)", fn: "pista" },
  llano: { nombre: "Llano: campo plano para el rollo de la orquesta", fn: "llano" },
  montana: { nombre: "Fondo: montaña nevada con franjas", fn: "montana", fondo: true },
  cordillera: { nombre: "Fondo: cordillera lejana", fn: "cordillera", fondo: true },
};
export const PALETA = BLOQUES.map((b, i) => i).filter(i => i);
// mundos REALES de Minecraft importados con herramientas/mundo_real.py (texturas_mc/mundos/<n>.bin + .json). En una toma:
// set "real:<n>". Se precargan con los mobs (precargarMundos) porque el escenario se arma de forma síncrona
export const MUNDOS_REALES = new Map();
export function cargarMundoReal(nombre) {
  if (!MUNDOS_REALES.has(nombre)) {
    const n = nombre.slice(5), o = { meta: null, ids: null };
    o.listo = Promise.all([fetch(`texturas_mc/mundos/${n}.json`).then(r => r.json()), fetch(`texturas_mc/mundos/${n}.bin`).then(r => r.arrayBuffer())])
      .then(([meta, buf]) => { o.meta = meta; o.ids = new Uint8Array(buf); }).catch(err => console.warn("mundo real:", nombre, err));
    MUNDOS_REALES.set(nombre, o);
  }
  return MUNDOS_REALES.get(nombre);
}
export function precargarMundos(escenas) {
  const sets = [...new Set((escenas || []).map(e => e.set).filter(s => s?.startsWith("real:")))];
  return Promise.all(sets.map(s => cargarMundoReal(s).listo));
}
// viento del modo premium (escena.js pone el tiempo de la toma y la fuerza): plantas y hojas se mecen en el shader,
// sin estado, así que sale igual en la vista previa y al exportar
export const VIENTO = { tiempo: { value: 0 }, fuerza: { value: 0 } };
const HOJAS_VIENTO = [0.22, 0.22, 0.22, 0.22];
// agua v2 (como los shaders tipo SEUS/BSL): color según la profundidad (turquesa y transparente en la orilla, azul marino
// en lo hondo; la profundidad viaja en el atributo `viento` de las caras de agua), olas en la rejilla de 1/8 de bloque
// que hacen destellar el sol, y reflejo planar de la escena (escena.js la dibuja reflejada en el nivel del agua) o,
// si no hay reflejo, del color del cielo. Todo con el tiempo de la toma.
export const AGUA = { cielo: { value: new THREE.Color("#bfe2ff") }, refl: { value: null }, matRefl: { value: new THREE.Matrix4() }, usaRefl: { value: 0 } };
function olasDeAgua(mat) {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { aTiempo: VIENTO.tiempo, aCielo: AGUA.cielo, aRefl: AGUA.refl, aMatRefl: AGUA.matRefl, aUsaRefl: AGUA.usaRefl });
    sh.vertexShader = "attribute float viento; uniform mat4 aMatRefl; varying vec3 vMundoA; varying vec4 vRefl; varying float vProf;\n" +
      sh.vertexShader.replace("#include <project_vertex>", `#include <project_vertex>
        vMundoA = (modelMatrix * vec4(transformed, 1.0)).xyz; vRefl = aMatRefl * vec4(vMundoA, 1.0); vProf = viento;`);
    sh.fragmentShader = "uniform float aTiempo, aUsaRefl; uniform vec3 aCielo; uniform sampler2D aRefl; varying vec3 vMundoA; varying vec4 vRefl; varying float vProf;\n" + sh.fragmentShader
      .replace("#include <map_fragment>", `#include <map_fragment>
        float lumA = dot(diffuseColor.rgb, vec3(0.3333));
        vec3 bajoA = vec3(0.24, 0.70, 0.74), hondoA = vec3(0.025, 0.10, 0.26);
        diffuseColor.rgb = mix(bajoA, hondoA, smoothstep(0.0, 1.0, vProf)) * (0.8 + 0.45 * lumA);
        diffuseColor.a = mix(0.38, 0.95, smoothstep(0.0, 1.0, vProf));`)
      .replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>
        vec2 pA = floor(vMundoA.xz * 8.0) / 8.0; float tA = aTiempo;
        vec2 gA = vec2(cos(pA.x * 1.1 + tA * 1.3) * 0.5 + cos(pA.x * 0.37 - pA.y * 0.52 + tA * 0.9) * 0.7 + sin(pA.x * 3.1 + pA.y * 2.3 + tA * 2.1) * 0.25,
                       sin(pA.y * 1.3 + tA * 1.1) * 0.5 + sin(pA.x * 0.45 + pA.y * 0.3 + tA * 0.8) * 0.7 + cos(pA.y * 2.9 - pA.x * 1.7 + tA * 1.9) * 0.25);
        normal = normalize(normal + (viewMatrix * vec4(gA.x * 0.2, 0.0, gA.y * 0.2, 0.0)).xyz);`)
      .replace("#include <fog_fragment>", `float fresA = mix(0.1, 1.0, pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 4.0));
        vec3 reflA = aCielo;
        if (aUsaRefl > 0.5) reflA = texture2D(aRefl, vRefl.xy / vRefl.w + gA * 0.02).rgb;
        gl_FragColor.rgb = mix(gl_FragColor.rgb, reflA, fresA * 0.85);
        gl_FragColor.a = mix(gl_FragColor.a, 1.0, fresA * 0.75);
        #include <fog_fragment>`);
  };
  mat.customProgramCacheKey = () => "agua2";
}
function mecerConViento(mat) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.vTiempo = VIENTO.tiempo; sh.uniforms.vFuerza = VIENTO.fuerza;
    sh.vertexShader = "attribute float viento; uniform float vTiempo, vFuerza;\n" + sh.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
      float vw = viento * vFuerza;
      if (vw > 0.0) {
        float fase = position.x * 0.61 + position.z * 0.43;
        float rafaga = 0.65 + 0.35 * sin(vTiempo * 0.7 + position.x * 0.05);
        transformed.x += (sin(vTiempo * 1.9 + fase) * 0.085 + sin(vTiempo * 3.7 + fase * 1.7) * 0.025) * vw * rafaga;
        transformed.z += cos(vTiempo * 1.6 + fase * 0.8) * 0.06 * vw * rafaga;
      }`);
  };
  mat.customProgramCacheKey = () => "viento";
}
// paleta del mundo (efecto `paleta` de la toma): todos los bloques pasan a dos tonos (oscuro → claro según su brillo),
// conservando la textura y la luz, como un paquete de recursos de una sola familia (Nether, End, concreto rosa…)
export const TINTE = { mezcla: { value: 0 }, oscuro: { value: new THREE.Color("#3a0b0b") }, claro: { value: new THREE.Color("#ef5d3c") } };
export function conTinte(mat) {
  const previo = mat.onBeforeCompile, clave = mat.customProgramCacheKey;
  mat.onBeforeCompile = (sh, r) => {
    if (previo && previo !== THREE.Material.prototype.onBeforeCompile) previo(sh, r);
    Object.assign(sh.uniforms, { tMezcla: TINTE.mezcla, tOscuro: TINTE.oscuro, tClaro: TINTE.claro });
    sh.fragmentShader = "uniform float tMezcla; uniform vec3 tOscuro, tClaro;\n" + sh.fragmentShader.replace("#include <color_fragment>", `#include <color_fragment>
      if (tMezcla > 0.0) {
        float lT = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
        vec3 pT = mix(tOscuro, tClaro, smoothstep(0.02, 0.6, lT));
        diffuseColor.rgb = mix(diffuseColor.rgb, pT, tMezcla);
      }`);
  };
  const k = clave && clave !== THREE.Material.prototype.customProgramCacheKey ? clave() : "";
  mat.customProgramCacheKey = () => k + "|tinte";
}
const ID = Object.fromEntries(BLOQUES.map((b, i) => [b?.nombre, i]));
export const B = {
  pasto: 1, tierra: 2, piedra: 3, adoquin: 4, tablones: 5, tronco: 6, hojas: 7, vidrio: 8, arena: 9, ladrillo: 10,
  blanco: 11, gris: 12, oscuro: 13, celeste: 14, azul: 15, cuarzo: 16, lisa: 17, rojo: 18, amarillo: 19, puerta: 20,
  tablones_oscuros: 21, terracota: 22, nieve: 23, ladrillo_piedra: 24, librero: 25, luz: 26, andesita: 27, abeto: 28,
  abedul: 29, negro: 30, cerezo_hojas: 31, cerezo: 32, netherrack: 33, nylium: 34, verruga: 35, verruga_azul: 36,
  tallo: 37, brillohongo: 38, abeto_tronco: 39, abeto_hojas: 40, pasto_nieve: 41, prismarina: 42, prismarina_oscura: 43,
  linterna_mar: 44, camino: 45, lana: 46, paja: 47, grava: 48, hielo: 49, lima: 50, rosa: 51, lava: 52,
  pasto_corto: 53, pasto_alto: 54, pasto_alto_arriba: 55, diente_leon: 56, amapola: 57, margarita: 58, aciano: 59, allium: 60,
  raices: 61, raices_azules: 62, pasto_marino: 63, alga: 64, abedul_tronco: 65, abedul_hojas: 66, capa_nieve: 67,
  escalon: 68, antorcha: 69, petalos: 70, nylium_azul: 71, tallo_azul: 72, terracota_naranja: 73, terracota_blanca: 74,
  terracota_roja: 75, terracota_gris: 76, tierra_gruesa: 77, magma: 78, lava_cae: 79, calcita: 80, ventana_luz: 81, hojas_azalea: 82,
  musical: 83, agua: 84,
};

// Texturas reales de TU Minecraft (texturas_mc/, copiadas del .jar instalado) por nombre interno.
// [archivo, tinte de bioma, capa encima, tinte de la capa]
const REALES = {
  pasto_top: ["grass_block_top", "#a6dc5a"], pasto_lado: ["grass_block_side", null, "grass_block_side_overlay", "#a6dc5a"],
  tierra: ["dirt"], piedra: ["stone"], adoquin: ["cobblestone"], tablones: ["oak_planks"], tablones_oscuros: ["dark_oak_planks"],
  tronco_lado: ["oak_log"], tronco_top: ["oak_log_top"], hojas: ["oak_leaves", "#84c23a"], vidrio: ["glass"], arena: ["sand"],
  ladrillo: ["bricks"], concreto_blanco: ["white_concrete"], concreto_gris: ["light_gray_concrete"], concreto_oscuro: ["gray_concrete"],
  concreto_celeste: ["light_blue_concrete"], concreto_azul: ["blue_concrete"], cuarzo: ["quartz_block_side"], piedra_lisa: ["smooth_stone"],
  lana_roja: ["red_wool"], lana_amarilla: ["yellow_wool"], nieve: ["snow"], terracota: ["terracotta"],
  puerta_abajo: ["oak_door_bottom"], puerta_arriba: ["oak_door_top"], ladrillo_piedra: ["stone_bricks"], estanteria: ["bookshelf"],
  luz: ["glowstone"], andesita: ["polished_andesite"], abeto: ["spruce_planks"], abedul: ["birch_planks"], concreto_negro: ["black_concrete"],
  cerezo_hojas: ["cherry_leaves"], cerezo_tronco: ["cherry_log"], cerezo_tronco_top: ["cherry_log_top"], netherrack: ["netherrack"],
  nylium_top: ["crimson_nylium"], nylium_lado: ["crimson_nylium_side"], verruga: ["nether_wart_block"], verruga_azul: ["warped_wart_block"],
  tallo_carmesi: ["crimson_stem"], tallo_carmesi_top: ["crimson_stem_top"], brillohongo: ["shroomlight"], abeto_tronco: ["spruce_log"],
  abeto_tronco_top: ["spruce_log_top"], abeto_hojas: ["spruce_leaves", "#619961"], pasto_nieve_lado: ["grass_block_snow"],
  prismarina: ["prismarine"], prismarina_oscura: ["dark_prismarine"], linterna_mar: ["sea_lantern"], camino_top: ["dirt_path_top"],
  camino_lado: ["dirt_path_side"], lana_blanca: ["white_wool"], paja_lado: ["hay_block_side"], paja_top: ["hay_block_top"],
  grava: ["gravel"], hielo: ["packed_ice"], lana_lima: ["lime_wool"], concreto_rosa: ["pink_concrete"], lava: ["lava_still"],
  pasto_corto: ["short_grass", "#a6dc5a"], pasto_alto_abajo: ["tall_grass_bottom", "#a6dc5a"], pasto_alto_arriba: ["tall_grass_top", "#a6dc5a"],
  diente_leon: ["dandelion"], amapola: ["poppy"], margarita: ["oxeye_daisy"], aciano: ["cornflower"], allium: ["allium"],
  raices: ["crimson_roots"], raices_azules: ["warped_roots"], pasto_marino: ["seagrass"], alga: ["kelp"],
  abedul_tronco: ["birch_log"], abedul_hojas: ["birch_leaves", "#80a755"],
  antorcha: ["torch"], petalos: ["pink_petals"], nylium_azul_top: ["warped_nylium"], nylium_azul_lado: ["warped_nylium_side"], tallo_azul: ["warped_stem"],
  terracota_naranja: ["orange_terracotta"], terracota_blanca: ["white_terracotta"], terracota_roja: ["red_terracotta"], terracota_gris: ["light_gray_terracotta"],
  tierra_gruesa: ["coarse_dirt"], magma: ["magma"], lava_cae: ["lava_flow"], calcita: ["calcite"], ventana_luz: ["orange_stained_glass"], hojas_azalea: ["azalea_leaves", "#9ad04a"], musical: ["note_block"], agua: ["water_still", "#3f76e4"],
};
export const ARCHIVOS_REALES = [...new Set(Object.values(REALES).flatMap(([a, , c]) => [a, c]).filter(Boolean))];

function teñir(img, color) {
  const c = document.createElement("canvas"); c.width = c.height = TILE;
  const x = c.getContext("2d"); x.imageSmoothingEnabled = false;
  x.drawImage(img, 0, 0, TILE, TILE, 0, 0, TILE, TILE);
  if (color) {
    x.globalCompositeOperation = "multiply"; x.fillStyle = color; x.fillRect(0, 0, TILE, TILE);
    x.globalCompositeOperation = "destination-in"; x.drawImage(img, 0, 0, TILE, TILE, 0, 0, TILE, TILE);
  }
  return c;
}
void ID;

const TILE = 16, ESC = 4, CELDA = TILE * ESC + 8;     // tile de 64 px + 4 px de margen por lado
const NOMBRES_TEX = Object.keys(PINTORES);
const COLS = 8;

function crearAtlas(reales = null) {
  const filas = Math.ceil(NOMBRES_TEX.length / COLS);
  const atlas = document.createElement("canvas");
  atlas.width = COLS * CELDA; atlas.height = filas * CELDA;
  const ax = atlas.getContext("2d"); ax.imageSmoothingEnabled = false;
  const uvs = {}, iconos = {};
  NOMBRES_TEX.forEach((n, i) => {
    const t = document.createElement("canvas"); t.width = t.height = TILE;
    const x = t.getContext("2d");
    const r = rng(1000 + i * 7919);
    const p = {
      px: (a, b, c) => { x.fillStyle = c; x.clearRect(a, b, 1, 1); x.fillRect(a, b, 1, 1); },
      ruido: (cols) => { for (let b = 0; b < 16; b++) for (let a = 0; a < 16; a++) p.px(a, b, cols[Math.floor(r() * cols.length)]); },
    };
    const real = reales && REALES[n] && reales[REALES[n][0]];
    if (real) {
      const [, tinte, capa, tinteCapa] = REALES[n];
      x.drawImage(teñir(real, tinte), 0, 0);
      if (capa && reales[capa]) x.drawImage(teñir(reales[capa], tinteCapa), 0, 0);
    } else PINTORES[n](p, r);
    const cx = (i % COLS) * CELDA, cy = Math.floor(i / COLS) * CELDA;
    // margen: repetir el borde para que el mipmap no mezcle tiles vecinos
    ax.drawImage(t, cx + 4, cy + 4, TILE * ESC, TILE * ESC);
    ax.drawImage(t, 0, 0, 1, 16, cx, cy + 4, 4, TILE * ESC); ax.drawImage(t, 15, 0, 1, 16, cx + 4 + TILE * ESC, cy + 4, 4, TILE * ESC);
    ax.drawImage(atlas, cx, cy + 4, CELDA, 1, cx, cy, CELDA, 4); ax.drawImage(atlas, cx, cy + 3 + TILE * ESC, CELDA, 1, cx, cy + 4 + TILE * ESC, CELDA, 4);
    uvs[n] = [(cx + 4) / atlas.width, 1 - (cy + 4) / atlas.height, (cx + 4 + TILE * ESC) / atlas.width, 1 - (cy + 4 + TILE * ESC) / atlas.height];
    iconos[n] = t;
  });
  const tex = new THREE.CanvasTexture(atlas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestMipmapLinearFilter;
  tex.anisotropy = 8;
  return { tex, uvs, iconos };
}

// icono isométrico de un bloque para la paleta
export function iconoBloque(atlas, id, tam = 40) {
  const b = BLOQUES[id], t = typeof b.tex === "string" ? { top: b.tex, lado: b.tex } : b.tex;
  const c = document.createElement("canvas"); c.width = c.height = tam;
  const x = c.getContext("2d"); x.imageSmoothingEnabled = false;
  const s = tam / 32;
  const cara = (img, m, osc) => { x.save(); x.setTransform(...m); x.drawImage(img, 0, 0, 16, 16); x.fillStyle = `rgba(0,0,0,${osc})`; x.fillRect(0, 0, 16, 16); x.restore(); };
  if (b.tipo === "puerta") { x.drawImage(atlas.iconos.puerta_arriba, 8 * s, 0, 16 * s, 16 * s); x.drawImage(atlas.iconos.puerta_abajo, 8 * s, 16 * s, 16 * s, 16 * s); return c.toDataURL(); }
  cara(atlas.iconos[t.top], [s, 0.5 * s, -s, 0.5 * s, 16 * s, 0], 0);
  cara(atlas.iconos[t.lado], [s, 0.5 * s, 0, s, 0, 8 * s], 0.25);
  cara(atlas.iconos[t.lado], [s, -0.5 * s, 0, s, 16 * s, 16 * s], 0.42);
  return c.toDataURL();
}

// ───────────── ruido para terreno ─────────────
function ruido2(semilla) {
  const h = (x, y) => { let n = x * 374761393 + y * 668265263 + semilla * 1442695; n = (n ^ (n >> 13)) * 1274126177; return ((n ^ (n >> 16)) & 0xffff) / 0xffff; };
  const s = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), fx = s(x - xi), fy = s(y - yi);
    const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
}

// ruido fractal (4 octavas): colinas suaves con detalle, como la generación natural
function fbm(semilla) {
  const o = [0, 1, 2, 3].map(k => ruido2(semilla * 13 + k * 101));
  return (x, y) => { let s = 0, a = 1, n = 0, f = 1; for (const r of o) { s += r(x * f, y * f) * a; n += a; a *= 0.5; f *= 2.03; } return s / n; };
}

// ───────────── el mundo ─────────────
const DIRS = [
  { n: [1, 0, 0], esq: [[1, 1, 1], [1, 1, 0], [1, 0, 1], [1, 0, 0]], cara: "lado" },
  { n: [-1, 0, 0], esq: [[0, 1, 0], [0, 1, 1], [0, 0, 0], [0, 0, 1]], cara: "lado" },
  { n: [0, 1, 0], esq: [[0, 1, 0], [1, 1, 0], [0, 1, 1], [1, 1, 1]], cara: "top" },
  { n: [0, -1, 0], esq: [[0, 0, 1], [1, 0, 1], [0, 0, 0], [1, 0, 0]], cara: "abajo" },
  { n: [0, 0, 1], esq: [[0, 1, 1], [1, 1, 1], [0, 0, 1], [1, 0, 1]], cara: "lado" },
  { n: [0, 0, -1], esq: [[1, 1, 0], [0, 1, 0], [1, 0, 0], [0, 0, 0]], cara: "lado" },
];
const BRILLO_AO = [0.42, 0.62, 0.8, 1];

export class Mundo {
  // tam / origen: los escenarios del tráiler usan un mundo más grande (128×128) para que no se vea el borde
  constructor(reales = null, tam = TAM, origen = ORIGEN) {
    this.T = tam; this.O = origen;
    this.grupo = new THREE.Group();
    this.atlas = crearAtlas(reales);
    this.ids = new Uint8Array(this.T.x * this.T.y * this.T.z);
    this.meta = new Uint8Array(this.T.x * this.T.y * this.T.z);     // puertas: 0-3 orientación, +4 mitad de arriba, +8 abierta
    const base = { map: this.atlas.tex, vertexColors: true, roughness: 0.95, metalness: 0 };
    this.mats = {
      solido: new THREE.MeshStandardMaterial(base),
      recorte: new THREE.MeshStandardMaterial({ ...base, alphaTest: 0.5, side: THREE.DoubleSide }),
      vidrio: new THREE.MeshStandardMaterial({ ...base, transparent: true, depthWrite: false, roughness: 0.1 }),
      // bloques que dan luz (piedra luminosa, brillohongo, linterna de mar, lava): brillan aunque estén en sombra
      luz: new THREE.MeshStandardMaterial({ ...base, emissive: 0xffffff, emissiveMap: this.atlas.tex, emissiveIntensity: 0.85 }),
      // agua: transparente, con olas animadas que reflejan el sol, oleaje en el color y reflejo del cielo según el ángulo
      agua: new THREE.MeshStandardMaterial({ ...base, transparent: true, depthWrite: false, roughness: 0.05, metalness: 0 }),
    };
    olasDeAgua(this.mats.agua);
    mecerConViento(this.mats.recorte);
    for (const k of ["solido", "recorte", "luz"]) conTinte(this.mats[k]);
    this.mallas = {};
  }

  i(x, y, z) { return (y * this.T.z + z) * this.T.x + x; }
  dentro(x, y, z) { return x >= 0 && y >= 0 && z >= 0 && x < this.T.x && y < this.T.y && z < this.T.z; }
  get(x, y, z) { return this.dentro(x, y, z) ? this.ids[this.i(x, y, z)] : 0; }
  set(x, y, z, id, meta = 0) { if (this.dentro(x, y, z)) { const k = this.i(x, y, z); this.ids[k] = id; this.meta[k] = meta; } }
  opaco(x, y, z) { const id = this.get(x, y, z); return id && !BLOQUES[id].tipo; }

  // ───── generadores
  generar(tipo = "colinas") {
    this.ids.fill(0); this.meta.fill(0);
    const oy = this.O.y;
    if (tipo === "vacio") {
      for (let x = -4; x <= 4; x++) for (let z = -4; z <= 4; z++) this.set(this.O.x + x, oy - 1, this.O.z + z, B.pasto);
    } else if (tipo === "plano") {
      for (let x = 0; x < this.T.x; x++) for (let z = 0; z < this.T.z; z++) {
        for (let y = oy - 5; y < oy - 1; y++) this.set(x, y, z, y < oy - 3 ? B.piedra : B.tierra);
        this.set(x, oy - 1, z, B.pasto);
      }
    } else if (tipo === "colinas") {
      const n = ruido2(7), r = rng(42);
      for (let x = 0; x < this.T.x; x++) for (let z = 0; z < this.T.z; z++) {
        const dx = x - this.O.x, dz = z - this.O.z, dc = Math.hypot(dx, dz);
        let h = (n(x / 14, z / 14) - 0.5) * 9 + (n(x / 5 + 50, z / 5) - 0.5) * 2.5;
        h *= THREE.MathUtils.smoothstep(dc, 5, 14);              // plano donde está el personaje
        const top = oy - 1 + Math.round(h);
        for (let y = oy - 7; y <= top; y++) this.set(x, y, z, y === top ? (top < oy - 2 ? B.arena : B.pasto) : y > top - 3 ? B.tierra : B.piedra);
      }
      for (let k = 0; k < 26; k++) {
        const x = 3 + Math.floor(r() * (this.T.x - 6)), z = 3 + Math.floor(r() * (this.T.z - 6));
        if (Math.hypot(x - this.O.x, z - this.O.z) < 7) continue;
        let y = this.T.y - 1; while (y > 0 && !this.get(x, y, z)) y--;
        if (this.get(x, y, z) !== B.pasto) continue;
        this.arbol(x, y + 1, z, 4 + Math.floor(r() * 2));
      }
    } else if (tipo === "balcon") this.balcon();
    else if (ESCENARIOS[tipo]) this[ESCENARIOS[tipo].fn]();
    else if (tipo?.startsWith("real:")) { const r = MUNDOS_REALES.get(tipo); if (r?.ids) this.ids.set(r.ids.subarray(0, this.ids.length)); }
    this.reconstruir();
  }

  arbol(x, y, z, alto) {
    for (let k = 0; k < alto; k++) this.set(x, y + k, z, B.tronco);
    for (let dy = alto - 2; dy <= alto + 1; dy++) {
      const r = dy >= alto ? 1 : 2;
      for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
        if (Math.abs(dx) === r && Math.abs(dz) === r && (dy > alto - 1 || (x + z + dy) % 2)) continue;
        if (!this.get(x + dx, y + dy, z + dz)) this.set(x + dx, y + dy, z + dz, B.hojas);
      }
    }
  }

  caja(x0, y0, z0, x1, y1, z1, id) {
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++) this.set(x, y, z, id);
  }

  // El pasillo-balcón del video de Benly: piso de piedra lisa, pared gris con puerta de roble a la
  // derecha, barandal bajo a la izquierda, techo con vigas oscuras y edificios celestes enfrente.
  balcon() {
    const ox = this.O.x, oy = this.O.y, oz = this.O.z;
    const X = (v) => ox + v, Y = (v) => oy + v, Z = (v) => oz + v;
    // calle y edificio de abajo
    this.caja(0, Y(-14), 0, this.T.x - 1, Y(-14), this.T.z - 1, B.gris);
    this.caja(X(-3), Y(-13), Z(-30), X(6), Y(-1), Z(8), B.blanco);              // el edificio donde está el balcón
    // piso del pasillo
    this.caja(X(-3), Y(-1), Z(-30), X(3), Y(-1), Z(8), B.lisa);
    // pared derecha (+x) con la puerta
    this.caja(X(3), Y(0), Z(-30), X(3), Y(3), Z(8), B.gris);
    for (const z of [-1, -9, -17, -25]) {
      this.set(X(3), Y(0), Z(z), 0); this.set(X(3), Y(1), Z(z), 0);
      this.set(X(2), Y(0), Z(z), B.puerta, 1); this.set(X(2), Y(1), Z(z), B.puerta, 1 | 4);
      this.caja(X(3), Y(0), Z(z), X(3), Y(1), Z(z), B.oscuro);                  // marco hacia adentro
    }
    // ventanas entre puertas
    for (const z of [-5, -13, -21]) this.caja(X(3), Y(1), Z(z - 1), X(3), Y(2), Z(z + 1), B.vidrio);
    // barandal bajo a la izquierda (-x) y columnas
    this.caja(X(-3), Y(0), Z(-30), X(-3), Y(0), Z(8), B.blanco);
    for (let z = -30; z <= 8; z += 9) this.caja(X(-3), Y(1), Z(z), X(-3), Y(3), Z(z), B.oscuro);
    // techo con vigas
    this.caja(X(-3), Y(4), Z(-30), X(3), Y(4), Z(8), B.oscuro);
    for (let z = -30; z <= 8; z += 9) this.caja(X(-3), Y(3), Z(z), X(2), Y(3), Z(z), B.oscuro);
    this.caja(X(-4), Y(5), Z(-31), X(6), Y(9), Z(9), B.blanco);                 // pisos de arriba
    // edificios celestes enfrente (al otro lado de la calle)
    const r = rng(9);
    for (let z = -34; z < 30; z += 11) {
      const h = 14 + Math.floor(r() * 16), x0 = X(-22 - Math.floor(r() * 4)), x1 = X(-11);
      this.caja(x0, Y(-13), Z(z), x1, Y(h), Z(z + 9), B.celeste);
      for (let y = -11; y < h - 1; y += 3) for (let zz = z + 1; zz < z + 9; zz += 2) this.caja(x1, Y(y), Z(zz), x1, Y(y + 1), Z(zz), B.vidrio);
      this.caja(x0, Y(h + 1), Z(z), x1, Y(h + 1), Z(z + 9), B.blanco);
    }
    // edificio al fondo del pasillo
    this.caja(X(-12), Y(-13), Z(-44), X(14), Y(20), Z(-38), B.azul);
    for (let y = -10; y < 19; y += 3) for (let x = -10; x < 13; x += 2) this.caja(X(x), Y(y), Z(-38), X(x), Y(y + 1), Z(-38), B.vidrio);
  }

  // ───── escenarios del tráiler (réplica del video de @benlyanimations para Bobicraft) ─────
  // Relieve con ruido fractal (como la generación natural), árboles por especie, pasto y flores en cruz.
  // Coordenadas relativas al origen: el piso del set queda en y = 0.
  rel() { const ox = this.O.x, oy = this.O.y, oz = this.O.z; return { X: (v) => ox + v, Y: (v) => oy + v, Z: (v) => oz + v }; }

  // relleno de suelo con una función de altura (en bloques sobre y = 0) y el bloque de arriba
  suelo(altura, arriba, debajo = B.tierra, fondo = B.piedra, prof = 8) {
    const oy = this.O.y;
    for (let x = 0; x < this.T.x; x++) for (let z = 0; z < this.T.z; z++) {
      const h = altura(x - this.O.x, z - this.O.z);
      if (h == null) continue;
      const top = Math.min(this.T.y - 2, oy - 1 + Math.round(h));
      const top2 = typeof arriba === "function" ? arriba(x - this.O.x, z - this.O.z, h) : arriba;
      for (let y = Math.max(0, top - prof); y <= top; y++) this.set(x, y, z, y === top ? top2 : y > top - 3 ? debajo : fondo);
    }
  }
  alturaEn(x, z) { let y = this.T.y - 1; while (y > 0 && (!this.get(x, y, z) || ["recorte", "planta", "antorcha", "alfombra"].includes(BLOQUES[this.get(x, y, z)].tipo))) y--; return y; }
  // pone plantas sobre los bloques de arriba que sean `sobre` (lista de [id, probabilidad])
  plantas(sobre, lista, r, evitar = () => false) {
    for (let x = 0; x < this.T.x; x++) for (let z = 0; z < this.T.z; z++) {
      if (evitar(x - this.O.x, z - this.O.z)) continue;
      const y = this.alturaEn(x, z);
      if (!sobre.includes(this.get(x, y, z)) || this.get(x, y + 1, z)) continue;
      let p = r();
      for (const [id, prob] of lista) { if (p < prob) { this.set(x, y + 1, z, id); if (id === B.pasto_alto) this.set(x, y + 2, z, B.pasto_alto_arriba); break; } p -= prob; }
    }
  }
  arboles(n, r, crear, sobre, evitar = () => false) {
    for (let k = 0; k < n; k++) {
      const x = 3 + Math.floor(r() * (this.T.x - 6)), z = 3 + Math.floor(r() * (this.T.z - 6));
      if (evitar(x - this.O.x, z - this.O.z)) continue;
      const y = this.alturaEn(x, z);
      if (!sobre.includes(this.get(x, y, z)) || this.get(x, y + 1, z) && BLOQUES[this.get(x, y + 1, z)].tipo !== "planta") continue;
      if (this.get(x + 1, y + 2, z) || this.get(x - 1, y + 2, z) || this.get(x, y + 2, z + 1) || this.get(x, y + 2, z - 1)) continue;
      crear(x, y + 1, z);
    }
  }

  // casa de aldea: paredes de adoquín, columnas de tronco, techo de tablones con alero y puerta hacia la calle
  casa(x0, z0, x1, z1, lado, r) {
    const { Y } = this.rel(), alto = 4;
    this.caja(x0, Y(0), z0, x1, Y(alto - 1), z1, B.adoquin);
    this.caja(x0 + 1, Y(0), z0 + 1, x1 - 1, Y(alto - 1), z1 - 1, 0);
    for (const [x, z] of [[x0, z0], [x0, z1], [x1, z0], [x1, z1]]) this.caja(x, Y(-1), z, x, Y(alto - 1), z, B.tronco);
    this.caja(x0, Y(alto - 1), z0, x1, Y(alto - 1), z1, B.tronco);
    for (let k = 0; k < 3; k++) this.caja(x0 - 1 + k, Y(alto + k), z0 - 1 + k, x1 + 1 - k, Y(alto + k), z1 + 1 - k, k === 2 ? B.tablones_oscuros : B.tablones);
    const zm = Math.round((z0 + z1) / 2), xm = Math.round((x0 + x1) / 2);
    if (lado === "x+" || lado === "x-") {
      const x = lado === "x+" ? x1 : x0, dir = lado === "x+" ? 1 : 3, fuera = lado === "x+" ? 1 : -1;
      this.set(x, Y(0), zm, B.puerta, dir); this.set(x, Y(1), zm, B.puerta, dir | 4);
      this.caja(x, Y(2), zm, x, Y(2), zm, B.tronco);
      for (const dz of [-2, 2]) this.set(x, Y(1), zm + dz, B.vidrio);
      this.set(x + fuera, Y(-1), zm, B.camino);
      this.set(x + fuera, Y(0), zm - 1, B.paja);
    } else {
      const z = lado === "z+" ? z1 : z0, dir = lado === "z+" ? 2 : 0;
      this.set(xm, Y(0), z, B.puerta, dir); this.set(xm, Y(1), z, B.puerta, dir | 4);
      for (const dx of [-2, 2]) this.set(xm + dx, Y(1), z, B.vidrio);
    }
    void r;
  }

  arbolAbedul(x, y, z, alto) {
    for (let k = 0; k < alto; k++) this.set(x, y + k, z, B.abedul_tronco);
    for (let dy = alto - 3; dy <= alto; dy++) {
      const rad = dy >= alto - 1 ? 1 : 2;
      for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
        if (Math.abs(dx) === rad && Math.abs(dz) === rad && (dy >= alto - 1 || (x + z + dy) % 2)) continue;
        if (!this.get(x + dx, y + dy, z + dz)) this.set(x + dx, y + dy, z + dz, B.abedul_hojas);
      }
    }
  }

  arbolAbeto(x, y, z, alto, nevado) {
    for (let k = 0; k < alto; k++) this.set(x, y + k, z, B.abeto_tronco);
    // capas alternadas anchas y angostas, como los abetos de la taiga
    for (let dy = 2; dy <= alto; dy++) {
      const desdeArriba = alto - dy, ancho = desdeArriba % 2 === 0 ? Math.min(3, 1 + Math.floor(desdeArriba / 2)) : Math.max(1, Math.floor(desdeArriba / 2));
      for (let dx = -ancho; dx <= ancho; dx++) for (let dz = -ancho; dz <= ancho; dz++) {
        if (Math.abs(dx) + Math.abs(dz) > ancho + (ancho > 1 ? 1 : 0)) continue;
        if (!this.get(x + dx, y + dy, z + dz)) this.set(x + dx, y + dy, z + dz, B.abeto_hojas);
      }
    }
    this.set(x, y + alto, z, B.abeto_hojas); this.set(x, y + alto + 1, z, B.abeto_hojas);
    if (nevado) for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) {
      for (let yy = y + alto + 2; yy >= y + 2; yy--) {
        const id = this.get(x + dx, yy, z + dz);
        if (id === B.abeto_hojas) { if (!this.get(x + dx, yy + 1, z + dz)) this.set(x + dx, yy + 1, z + dz, B.capa_nieve); break; }
        if (id) break;
      }
    }
  }

  arbolCerezo(x, y, z, alto, r) {
    for (let k = 0; k < alto; k++) this.set(x, y + k, z, B.cerezo);
    const ramas = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(() => r() < 0.6);
    for (const [dx, dz] of ramas) { this.set(x + dx, y + alto - 1, z + dz, B.cerezo); this.set(x + 2 * dx, y + alto, z + 2 * dz, B.cerezo); }
    for (let dy = alto - 2; dy <= alto + 2; dy++) {
      const rad = dy === alto + 2 ? 2.4 : dy === alto - 2 ? 3 : 4.3;
      for (let dx = -5; dx <= 5; dx++) for (let dz = -5; dz <= 5; dz++) {
        if (dx * dx + dz * dz > rad * rad || r() < 0.06) continue;
        if (!this.get(x + dx, y + dy, z + dz)) this.set(x + dx, y + dy, z + dz, B.cerezo_hojas);
      }
    }
    // pétalos que cuelgan
    for (let k = 0; k < 10; k++) { const dx = Math.floor(r() * 9) - 4, dz = Math.floor(r() * 9) - 4; if (!this.get(x + dx, y + alto - 3, z + dz) && this.get(x + dx, y + alto - 2, z + dz) === B.cerezo_hojas) this.set(x + dx, y + alto - 3, z + dz, B.cerezo_hojas); }
  }

  hongoCarmesi(x, y, z, alto, r) {
    for (let k = 0; k < alto; k++) this.set(x, y + k, z, B.tallo);
    for (let dy = 0; dy < 3; dy++) {
      const rad = dy === 2 ? 2 : 3;
      for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
        const borde = Math.max(Math.abs(dx), Math.abs(dz)) === rad;
        if ((dy < 2 && !borde) || (Math.abs(dx) === rad && Math.abs(dz) === rad)) continue;
        this.set(x + dx, y + alto - 2 + dy, z + dz, r() < 0.12 ? B.brillohongo : B.verruga);
      }
    }
    for (let k = 0; k < 6; k++) { const dx = Math.floor(r() * 7) - 3, dz = Math.floor(r() * 7) - 3; for (let h = 1; h <= 1 + Math.floor(r() * 2); h++) if (!this.get(x + dx, y + alto - 2 - h, z + dz)) this.set(x + dx, y + alto - 2 - h, z + dz, B.verruga); }
  }

  // Aldea de llanura: calle de tierra, casas a los lados, colinas suaves con robles y abedules
  aldea() {
    const { X, Y, Z } = this.rel(), f = fbm(31), r = rng(77);
    const lejos = (x, z) => Math.max(0, Math.abs(x) - 15) + Math.max(0, Math.abs(z) - 32);
    this.suelo((x, z) => { const l = lejos(x, z); return l > 0 ? (f(x / 30, z / 30) - 0.35) * 16 * Math.min(1, l / 12) : 0; }, B.pasto);
    this.caja(X(-2), Y(-1), Z(-38), X(2), Y(-1), Z(38), B.camino);
    for (const [z0, z1] of [[-22, -16], [-10, -4], [2, 8], [14, 20]]) this.casa(X(-10), Z(z0), X(-4), Z(z1), "x+", r);
    for (const [z0, z1] of [[-28, -22], [-16, -10], [4, 10], [16, 22]]) this.casa(X(4), Z(z0), X(10), Z(z1), "x-", r);     // hueco frente a la casa de la izquierda (toma 1)
    const fuera = (x, z) => Math.abs(x) < 13 && Math.abs(z) < 32;
    this.arboles(220, r, (x, y, z) => r() < 0.75 ? this.arbol(x, y, z, 4 + Math.floor(r() * 3)) : this.arbolAbedul(x, y, z, 5 + Math.floor(r() * 2)), [B.pasto], fuera);
    this.plantas([B.pasto], [[B.pasto_corto, 0.3], [B.pasto_alto, 0.015], [B.diente_leon, 0.012], [B.amapola, 0.01], [B.margarita, 0.006]], r, (x, z) => Math.abs(x) < 2.5 || (Math.abs(x) < 4 && Math.abs(z - 9.6) < 2));
  }

  // Noche: meseta de pasto que termina en un acantilado (z > 9) sobre un valle con bosque
  noche() {
    const f = fbm(5), r = rng(13);
    const borde = (x) => 9 + Math.round((f(x / 9, 3) - 0.5) * 6);
    this.suelo((x, z) => z > borde(x) ? -19 + f(x / 14, z / 14) * 6 : (f(x / 20, z / 20) - 0.5) * 5 * Math.min(1, Math.max(0, -z - 4) / 10), B.pasto, B.tierra, B.piedra, 26);
    this.arboles(260, r, (x, y, z) => this.arbol(x, y, z, 4 + Math.floor(r() * 3)), [B.pasto], (x, z) => z < 12 && z > -12 && Math.abs(x) < 14 && !(z > 3 && x < -8));
    this.plantas([B.pasto], [[B.pasto_corto, 0.3], [B.pasto_alto, 0.02]], r, (x, z) => (z > -3 && z < 8 && x > -12 && x < 5) || (Math.abs(x - 0.5) < 2 && Math.abs(z - 8.5) < 2));
  }

  // Taiga nevada: claro largo en el centro, montañas a los lados con abetos nevados y cumbres de piedra
  nieve() {
    const f = fbm(21), r = rng(5);
    const alt = (x, z) => { const e = Math.hypot(x / 40, z / 15); return Math.max(0, e - 1) * 9 + (f(x / 26, z / 26) - 0.4) * 10 * Math.min(1, Math.max(0, e - 0.8) * 1.5) + Math.max(0, -z - 26) * 1.1; };
    this.suelo(alt, (x, z, h) => h > 22 ? B.nieve : B.pasto_nieve, B.tierra, B.piedra, 12);
    // laderas empinadas: piedra a la vista
    for (let x = 1; x < this.T.x - 1; x++) for (let z = 1; z < this.T.z - 1; z++) {
      const y = this.alturaEn(x, z), d = Math.max(...[[1, 0], [-1, 0], [0, 1], [0, -1]].map(([a, b]) => y - this.alturaEn(x + a, z + b)));
      if (d >= 3 && this.get(x, y, z) === B.pasto_nieve) this.set(x, y, z, B.piedra);
    }
    this.arboles(1100, r, (x, y, z) => this.arbolAbeto(x, y, z, 7 + Math.floor(r() * 6), true), [B.pasto_nieve], (x, z) => Math.hypot(x / 34, z / 12) < 1);
  }

  // Fondo del mar: arena y grava, pasto marino, algas y ruinas de prismarina con linternas de mar
  agua() {
    const f = fbm(44), r = rng(3);
    this.suelo((x, z) => (f(x / 14, z / 14) - 0.5) * 7 - 2, (x, z) => f(x / 5 + 20, z / 5) > 0.66 ? B.grava : B.arena, B.arena, B.piedra, 6);
    this.arboles(40, r, (x, y, z) => {
      const h = 2 + Math.floor(r() * 6);
      for (let k = 0; k < h; k++) this.set(x, y + k, z, r() < 0.3 ? B.prismarina_oscura : B.prismarina);
      this.set(x, y + h, z, B.linterna_mar);
    }, [B.arena, B.grava], (x, z) => Math.hypot(x, z) < 6);
    this.plantas([B.arena, B.grava], [[B.pasto_marino, 0.3], [B.alga, 0.06]], r);
    for (let x = 0; x < this.T.x; x++) for (let z = 0; z < this.T.z; z++) {   // algas altas
      const y = this.alturaEn(x, z);
      if (this.get(x, y, z) === B.alga) for (let k = 1; k < 3 + Math.floor(r() * 8); k++) if (!this.get(x, y + k, z)) this.set(x, y + k, z, B.alga);
    }
  }

  // Cerezos: pradera ondulada con terrazas de tierra al fondo, bosque de cerezos y una loma para ver el atardecer
  cerezos() {
    const f = fbm(9), r = rng(17);
    this.suelo((x, z) => {
      if (Math.hypot(x - 22, z - 20) < 6.5) return 12;                       // cima plana de la loma (vista del atardecer)
      const terr = z < -10 ? Math.floor((-10 - z) / 3) * 2 + Math.round((f(x / 9, z / 9) - 0.5) * 2) : 0;
      const loma = Math.max(0, Math.min(12, 15.5 - Math.hypot(x - 22, z - 20) * 0.55));
      const lejos = Math.max(0, z - 34) * 0.5 + Math.max(0, Math.abs(x) - 45) * 0.6;
      return terr + loma + lejos + (f(x / 22, z / 22) - 0.5) * 4 * THREE.MathUtils.smoothstep(Math.hypot(x, z), 6, 16);
    }, B.pasto, B.tierra, B.piedra, 10);
    this.arboles(420, r, (x, y, z) => this.arbolCerezo(x, y, z, 4 + Math.floor(r() * 3), r), [B.pasto],
      (x, z) => Math.hypot(x, z) < 9 || Math.hypot(x - 22, z - 20) < 11 || (Math.abs(x) < 14 && z > -2 && z < 44) || (Math.abs(x - 22) < 14 && z > 20 && z < 40));
    const abierto = (x, z) => Math.hypot(x, z) < 12 || (Math.abs(x) < 14 && z > -2 && z < 30);
    this.plantas([B.pasto], [[B.pasto_corto, 0.28], [B.diente_leon, 0.02], [B.margarita, 0.02], [B.aciano, 0.01], [B.allium, 0.01]], r, (x, z) => Math.hypot(x, z) < 7.5);
    this.plantas([B.pasto], [[B.pasto_alto, 0.05]], r, abierto);
    this.plantas([B.pasto], [[B.petalos, 0.22]], r, (x, z) => Math.hypot(x + 3, z - 3) > 9);   // pétalos rosas (vista cenital)
    // arbustos lima y amarillos (como en el plano de cielo rosa)
    this.arboles(60, r, (x, y, z) => { this.set(x, y, z, r() < 0.6 ? B.hojas : B.lima); if (r() < 0.5) this.set(x + 1, y, z, B.hojas); }, [B.pasto], (x, z) => Math.hypot(x, z) < 12 || (Math.abs(x) < 14 && z > -2 && z < 30));
  }

  // Nether (tomas 19-20 del original): piso de nylium, un lago de lava a la izquierda, escalones de netherrack con tapa
  // de nylium DISTORSIONADO (turquesa) a la derecha, columnas de lava que caen del techo, hongos distorsionados y carmesí
  nether() {
    const f = fbm(66), r = rng(29), { X, Y, Z } = this.rel();
    const lago = (x, z) => (x < -3 && x > -16 && z > -9 && z < 7) || z < -26;
    this.suelo((x, z) => lago(x, z) ? -2 : (f(x / 12, z / 12) - 0.5) * 4 * THREE.MathUtils.smoothstep(Math.hypot(x, z), 7, 16),
      (x, z) => lago(x, z) ? B.lava : f(x / 6, z / 6 + 9) > 0.66 ? B.nylium_azul : B.nylium, B.netherrack, B.netherrack, 8);
    for (let x = 0; x < this.T.x; x++) for (let z = 0; z < this.T.z; z++) if (lago(x - this.O.x, z - this.O.z)) this.set(x, Y(-1), z, B.lava);
    // escalones (bloques rojos con tapa turquesa) donde se sientan los cubitos rosas
    for (const [x0, z0, h] of [[3, -1, 1], [4, -2, 2], [6, -3, 3], [5, -5, 4], [7, -6, 5], [8, -1, 2], [9, -4, 3], [3, -4, 2], [10, -7, 6], [6, 0, 1]]) {
      this.caja(X(x0), Y(0), Z(z0), X(x0 + 1), Y(h - 2), Z(z0 + 1), B.netherrack);
      this.caja(X(x0), Y(h - 1), Z(z0), X(x0 + 1), Y(h - 1), Z(z0 + 1), B.nylium_azul);
    }
    // columnas de lava que caen (brillan): una detrás del strider y otra al fondo
    for (const [x, z] of [[-1, -9], [5, -16], [-8, -20]]) for (let y = -1; y < 34; y++) this.set(X(x), Y(y), Z(z), B.lava_cae);
    // hongos: distorsionados (turquesa) a la izquierda y carmesí al fondo
    this.arboles(70, r, (x, y, z) => {
      const azul = x - this.O.x < -2, alto = 5 + Math.floor(r() * 8);
      for (let k = 0; k < alto; k++) this.set(x, y + k, z, azul ? B.tallo_azul : B.tallo);
      for (let dy = 0; dy < 3; dy++) { const rad = dy === 2 ? 2 : 3; for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) { const borde = Math.max(Math.abs(dx), Math.abs(dz)) === rad; if ((dy < 2 && !borde) || (Math.abs(dx) === rad && Math.abs(dz) === rad)) continue; this.set(x + dx, y + alto - 2 + dy, z + dz, r() < 0.1 ? B.brillohongo : azul ? B.verruga_azul : B.verruga); } }
    }, [B.nylium, B.nylium_azul], (x, z) => Math.hypot(x, z) < 12 || lago(x, z));
    this.plantas([B.nylium], [[B.raices, 0.12]], r, (x, z) => Math.hypot(x, z) < 3);
    this.plantas([B.nylium_azul], [[B.raices_azules, 0.25]], r);
    this.netherFondo(r);
  }
  // Fondo del Nether (tomas 19-20): en el original no hay cielo vacío. Terrazas escalonadas de netherrack con tapa de nylium
  // distorsionado a los lados y al fondo, pilares hasta el techo, hongos gigantes y, a lo lejos, paredes y techo de netherrack
  // con brillohongos encendidos (la niebla morada los vuelve silueta)
  netherFondo(r) {
    const { X, Y, Z } = this.rel(), f = fbm(67);
    const terraza = (cx, cz, rad, alto, paso = 2) => {
      for (let k = 0; k * paso < alto; k++) {
        const a = rad - k - Math.floor(r() * 2), b = rad - k - Math.floor(r() * 2), c = rad - k - Math.floor(r() * 2), d = rad - k - Math.floor(r() * 2);
        if (Math.min(a, b, c, d) < 1) break;
        const y1 = Math.min(alto, (k + 1) * paso) - 1;
        this.caja(X(cx - a), Y(-3), Z(cz - c), X(cx + b), Y(y1 - 1), Z(cz + d), B.netherrack);
        this.caja(X(cx - a), Y(y1), Z(cz - c), X(cx + b), Y(y1), Z(cz + d), B.nylium_azul);
        for (let i = 0; i < 2; i++) if (r() < 0.6) this.set(X(cx - a + Math.floor(r() * (a + b + 1))), Y(y1 + 1), Z(cz + d), B.raices_azules);
      }
    };
    for (const [cx, cz, rad, alto] of [[14, -8, 5, 8], [18, -18, 7, 14], [9, -25, 6, 10], [-22, -12, 5, 8], [-15, -32, 7, 12], [2, -38, 9, 18], [26, -32, 8, 20], [-30, -24, 6, 14]]) terraza(cx, cz, rad, alto);
    // pilares de netherrack que suben al techo (con vetas de magma)
    for (const [x, z] of [[-6, -42], [12, -46], [-20, -40], [22, -24], [-28, -14], [6, -30]]) {
      for (let y = -3; y < 34; y++) {
        const ancho = y > 24 ? 2 : 1;
        this.caja(X(x), Y(y), Z(z), X(x + ancho), Y(y), Z(z + ancho), (y * 7 + x) % 11 === 0 ? B.magma : B.netherrack);
      }
    }
    // hongos gigantes (tallo de 2×2, sombrero ancho con brillohongos)
    for (const [x, z, alto, rad, azul] of [[21, -11, 15, 5, true], [-11, -21, 13, 4, true], [-24, -30, 17, 5, false], [7, -44, 16, 5, true], [30, -20, 12, 4, false]]) {
      const y0 = this.alturaEn(X(x), Z(z)) + 1 - this.O.y;
      this.caja(X(x), Y(y0), Z(z), X(x + 1), Y(y0 + alto), Z(z + 1), azul ? B.tallo_azul : B.tallo);
      for (let dy = 0; dy < 4; dy++) {
        const rr = rad - (dy === 3 ? 2 : 0);
        for (let dx = -rr; dx <= rr + 1; dx++) for (let dz = -rr; dz <= rr + 1; dz++) {
          const borde = dx === -rr || dx === rr + 1 || dz === -rr || dz === rr + 1;
          if (dy < 3 && !borde) continue;
          if ((dx === -rr || dx === rr + 1) && (dz === -rr || dz === rr + 1)) continue;
          this.set(X(x + dx), Y(y0 + alto - 3 + dy), Z(z + dz), r() < 0.12 ? B.brillohongo : azul ? B.verruga_azul : B.verruga);
        }
      }
    }
    // paredes y techo lejanos, irregulares, con brillohongos
    for (let x = -64; x < 64; x++) for (let z = -64; z < -26; z++) {
      const techo = 24 + Math.round(f(x / 9, z / 9) * 8 - (z + 26) * -0.15);        // baja hacia el fondo
      if (techo < 33) for (let y = Math.max(techo, -3); y < 34; y++) this.set(X(x), Y(y), Z(z), y === techo && r() < 0.06 ? B.brillohongo : B.netherrack);
      if (z < -54 || Math.abs(x) > 52) {
        const alto = 33 - Math.round(f(x / 7 + 3, z / 7) * 10);
        for (let y = -3; y < alto; y++) this.set(X(x), Y(y), Z(z), r() < 0.015 ? B.brillohongo : B.netherrack);
      }
    }
  }

  // ───── escenarios por toma (ronda 4: composiciones medidas en los cuadros del original) ─────
  // casa vista de frente (fachada en z = zf, hacia +z): cimiento de adoquín, piso 1 bloque arriba, puerta con escalón y
  // antorcha encima, columnas de tronco, viga y alero de tablones que sale 1 bloque
  casaFrente(x0, x1, zf, prof, puertaX, conVentanas = false) {
    const { Y } = this.rel(), alto = 5, zb = zf - prof;
    this.caja(x0, Y(0), zb, x1, Y(alto - 1), zf, B.adoquin);
    this.caja(x0 + 1, Y(1), zb + 1, x1 - 1, Y(alto - 1), zf - 1, 0);
    for (const [x, z] of [[x0, zf], [x1, zf], [x0, zb], [x1, zb]]) this.caja(x, Y(-1), z, x, Y(alto), z, B.tronco);
    this.caja(x0, Y(alto), zb, x1, Y(alto), zf, B.tronco);
    for (let k = 0; k < 3; k++) this.caja(x0 - 1 + k, Y(alto + 1 + k), zb - 1 + k, x1 + 1 - k, Y(alto + 1 + k), zf + 1 - k, k === 2 ? B.tablones_oscuros : B.tablones);
    for (let x = x0 - 1; x <= x1 + 1; x++) this.set(x, Y(alto + 1), zf + 1, B.escalon, 0);       // borde del alero
    this.set(puertaX, Y(1), zf, B.puerta, 2); this.set(puertaX, Y(2), zf, B.puerta, 2 | 4);
    this.set(puertaX, Y(0), zf + 1, B.escalon, 0);                                               // escalón de tablones
    this.set(puertaX, Y(4), zf + 1, B.antorcha, 1);                                              // antorcha en la pared
    if (conVentanas) for (const dx of [-2, 2]) if (puertaX + dx > x0 && puertaX + dx < x1) this.set(puertaX + dx, Y(2), zf, B.vidrio);
  }
  // casa con la pared larga hacia el callejón (paredX) y ventanas encendidas
  casaLado(x0, x1, z0, z1, paredX, conLuz = true) {
    const { Y } = this.rel(), alto = 5;
    this.caja(x0, Y(0), z0, x1, Y(alto - 1), z1, B.adoquin);
    for (const [x, z] of [[x0, z0], [x0, z1], [x1, z0], [x1, z1]]) this.caja(x, Y(-1), z, x, Y(alto), z, B.tronco);
    for (let z = z0; z <= z1; z += 4) this.caja(paredX, Y(-1), z, paredX, Y(alto), z, B.tronco);
    this.caja(x0, Y(alto), z0, x1, Y(alto), z1, B.tronco);
    for (let k = 0; k < 3; k++) this.caja(x0 - 1 + k, Y(alto + 1 + k), z0 - 1 + k, x1 + 1 - k, Y(alto + 1 + k), z1 + 1 - k, k === 2 ? B.tablones_oscuros : B.tablones);
    if (conLuz) for (let z = z0 + 2; z < z1 - 1; z += 4) { this.set(paredX, Y(2), z, B.ventana_luz); this.set(paredX, Y(3), z, B.ventana_luz); }
  }
  // árbol "de tráiler": tronco corto y copa grande casi cúbica (las copas lisas de Bare Bones)
  arbolBola(x, y, z, alto, rad, hojas = B.hojas) {
    for (let k = 0; k < alto; k++) this.set(x, y + k, z, B.tronco);
    for (let dy = -1; dy <= rad + 1; dy++) for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
      if (Math.abs(dx) === rad && Math.abs(dz) === rad && (dy < 0 || dy > rad)) continue;
      if (!this.get(x + dx, y + alto + dy, z + dz)) this.set(x + dx, y + alto + dy, z + dz, hojas);
    }
  }

  // Toma 1-2 del original: dos casas de frente con escalones y antorcha sobre la puerta, hueco al centro con colinas
  aldeaFrente() {
    const { X, Y, Z } = this.rel(), f = fbm(41), r = rng(23);
    this.suelo((x, z) => z < -16 ? Math.max(0, (-16 - z) * 0.45 + (f(x / 11, z / 11) - 0.45) * 8) : 0, B.pasto);
    this.caja(X(-14), Y(-1), Z(1), X(14), Y(-1), Z(1), B.camino);
    this.casaFrente(X(-11), X(-3), Z(0), 7, X(-6));            // hueco de 4 bloques (x de −2 a 2), puertas en x = ±5.5
    this.casaFrente(X(2), X(10), Z(0), 7, X(5));
    this.set(X(3), Y(3), Z(1), B.antorcha, 1);                  // antorcha de la esquina (primer plano del aldeano)
    for (const [x, z, a, rr] of [[-9, -22, 3, 3], [8, -24, 4, 4], [-6, -34, 4, 4], [12, -30, 3, 3], [3, -46, 5, 5], [-14, -26, 3, 3], [17, -36, 4, 4], [-4, -52, 6, 5], [9, -56, 6, 5]])
      this.arbolBola(X(x), this.alturaEn(X(x), Z(z)) + 1, Z(z), a, rr);
    this.arboles(160, r, (x, y, z) => this.arbolBola(x, y, z, 3 + Math.floor(r() * 2), 3 + Math.floor(r() * 2)), [B.pasto], (x, z) => (z > -30 && Math.abs(x) < 30) || Math.abs(x) < 7);
    this.plantas([B.pasto], [[B.pasto_corto, 0.08], [B.pasto_alto, 0.01]], r, (x, z) => z > -3 || Math.abs(x) < 3);
    for (const [x, z] of [[-11, 2], [-10, 2], [-8, 2], [10, 2], [11, 2], [8, 2], [-12, 3], [12, 3]]) { this.set(X(x), Y(0), Z(z), B.pasto_alto); this.set(X(x), Y(1), Z(z), B.pasto_alto_arriba); }
    for (const [x, z] of [[-2, -1], [1, -1], [-1, -2], [0, -3], [1, -2], [-2, -3], [0, -1], [-1, -4]]) this.set(X(x), Y(0), Z(z), B.pasto_corto);
    for (const [x, z] of [[-2, -2], [1, -3]]) { this.set(X(x), Y(0), Z(z), B.pasto_alto); this.set(X(x), Y(1), Z(z), B.pasto_alto_arriba); }
  }

  // Tomas 17-18: callejón angosto entre dos casas con ventanas encendidas; al fondo, pradera con más casas
  calle() {
    const { X, Y, Z } = this.rel(), f = fbm(57), r = rng(31);
    this.suelo((x, z) => z < -22 ? (-22 - z) * 0.6 + (f(x / 10, z / 10) - 0.4) * 6 : 0, B.pasto);
    this.casaLado(X(-11), X(-3), Z(3), Z(16), X(-3));
    this.casaLado(X(3), X(11), Z(3), Z(16), X(3));
    this.caja(X(-14), Y(-1), Z(-3), X(14), Y(-1), Z(-3), B.camino);
    for (const [x0, x1, z] of [[-14, -6, -16], [-3, 5, -19], [8, 16, -15]]) this.casaFrente(X(x0), X(x1), Z(z), 6, X(Math.round((x0 + x1) / 2)), true);
    this.arboles(180, r, (x, y, z) => this.arbolBola(x, y, z, 2 + Math.floor(r() * 2), 2, r() < 0.4 ? B.hojas_azalea : B.hojas), [B.pasto], (x, z) => z > -12 && Math.abs(x) < 25);
    this.plantas([B.pasto], [[B.pasto_corto, 0.12], [B.pasto_alto, 0.03]], r, (x, z) => Math.abs(z + 3) < 1 || (Math.abs(x) < 4 && z > -9));
    // pasto del primer plano solo a los lados (al centro tapaba al aldeano que cruza, como en las esquinas del original)
    for (const [x, z] of [[-2, 4], [-2, 6], [2, 5], [2, 6], [-2, 7]]) this.set(X(x), Y(0), Z(z), B.pasto_corto);
  }

  // Toma 3: cresta de pasto con el cielo de fondo (horizonte muy bajo), más allá un valle profundo
  cresta() {
    const f = fbm(71), r = rng(9);
    // toma 4: meseta en x ≥ 44 con el borde cortado a pico (visto desde −z queda a la izquierda y la luna pegada a su orilla);
    // los animales corren por arriba hacia −x y saltan al vacío
    const prom = (x, z) => x >= 44 && z > -10 && z < 12 ? 13 + Math.round((f(x / 6, z / 6) - 0.5) * 1.2) * (x > 47 ? 1 : 0) : null;
    // toma 3: suelo plano donde aúlla el lobo y donde va la cámara baja (antes el relieve y el pasto alto tapaban la lente)
    const plano = (x, z) => x > -10 && x < 1 && z > -2 && z < 6;
    this.suelo((x, z) => prom(x, z) ?? (plano(x, z) ? 0 : z > -3 && z < 8 ? (f(x / 7, z / 7) - 0.5) * 1.2 : -24 + f(x / 20, z / 20) * 8), B.pasto, B.tierra, B.piedra, 44);
    this.plantas([B.pasto], [[B.pasto_corto, 0.25], [B.pasto_alto, 0.02]], r, (x, z) => Math.abs(z) < 1.5 || plano(x, z));
    const { X, Z } = this.rel();
    for (const [x, z, a, rr] of [[53, 5, 3, 2], [57, 8, 4, 2], [50, 9, 2, 1], [60, 3, 3, 2], [48, 7, 2, 1]]) this.arbolBola(X(x), this.alturaEn(X(x), Z(z)) + 1, Z(z), a, rr);
  }

  // Tomas 21-22: pradera abierta con arbustos lima y amarillos, escalones de tierra y árboles de copa grande al fondo
  pradera() {
    const f = fbm(88), r = rng(51);
    this.suelo((x, z) => { const d = Math.hypot(x, z); return d < 14 ? 0 : Math.floor((d - 14) / 6) + Math.round((f(x / 12, z / 12) - 0.5) * 3); }, B.pasto, B.tierra, B.piedra, 10);
    this.arboles(70, r, (x, y, z) => { this.caja(x, y, z, x + (r() < 0.5 ? 1 : 0), y + Math.floor(r() * 2), z, r() < 0.55 ? B.hojas_azalea : B.lima); }, [B.pasto], (x, z) => Math.hypot(x, z) < 5);
    this.arboles(120, r, (x, y, z) => this.arbolBola(x, y, z, 3 + Math.floor(r() * 3), 3 + Math.floor(r() * 2)), [B.pasto], (x, z) => Math.hypot(x, z) < 26);
    this.plantas([B.pasto], [[B.pasto_corto, 0.14], [B.diente_leon, 0.01], [B.margarita, 0.01]], r, (x, z) => Math.hypot(x, z) < 2.5);
    this.plantas([B.pasto], [[B.pasto_alto, 0.03]], r, (x, z) => Math.hypot(x, z) < 12);
  }

  // Llano (La orquesta de bloques): pasto plano en |x| ≤ 44 a todo lo largo, con lomas y árboles a los lados que
  // enmarcan el rollo de bloques musicales (que es un efecto `notas` y avanza en +z)
  llano() {
    const f = fbm(41), r = rng(17);
    // lomas a los lados que vuelven a bajar a y = 0 antes del borde del mundo (|x| = 64): ahí sigue el suelo lejano
    // (escena.sueloLejos) sin acantilado, y el paisaje no se ve "sin cargar"
    this.suelo((x, z) => { const ax = Math.abs(x), d = ax - 44; if (d <= 0) return 0;
      const h = Math.floor(Math.min(d, 62 - ax) / 2.5) + Math.round((f(x / 10, z / 10) - 0.5) * 3); return ax >= 61 ? 0 : Math.max(0, h); }, B.pasto, B.tierra, B.piedra, 10);
    // a los lados del rollo: bosque y arbustos (nada alto en |x| ≤ 40, donde caen los bloques)
    this.arboles(260, r, (x, y, z) => this.arbolBola(x, y, z, 2 + Math.floor(r() * 3), 2 + Math.floor(r() * 2), r() < 0.4 ? B.hojas_azalea : B.hojas), [B.pasto], (x) => Math.abs(x) < 46);
    this.arboles(160, r, (x, y, z) => this.caja(x, y, z, x + (r() < 0.5 ? 1 : 0), y + Math.floor(r() * 2), z, r() < 0.55 ? B.hojas_azalea : B.lima), [B.pasto], (x) => Math.abs(x) < 41);
    // en el campo: pasto corto y flores (de un bloque de alto: si cae un bloque musical encima, lo tapa)
    this.plantas([B.pasto], [[B.pasto_corto, 0.14], [B.diente_leon, 0.055], [B.amapola, 0.05], [B.margarita, 0.05], [B.aciano, 0.04], [B.allium, 0.025]], r, (x) => Math.abs(x) > 41);
    // afuera, además, pasto alto
    this.plantas([B.pasto], [[B.pasto_alto, 0.12], [B.pasto_corto, 0.3], [B.amapola, 0.02], [B.diente_leon, 0.02]], r, (x) => Math.abs(x) <= 41);
  }

  // Pista de pruebas (corto del Roadster): asfalto a lo largo de z (x de −4 a 4) con línea central y orillas amarillas,
  // explanada de piedra lisa, muro blanco para manejar de lado (cara en x = 24, z de −60 a −28), pacas de paja en
  // (10, 8), hangar gris y un cohete al fondo; lomas con árboles a partir de |x| > 30
  pista() {
    const f = fbm(23), r = rng(31), { X, Y, Z } = this.rel();
    this.suelo((x, z) => { const d = Math.max(0, Math.abs(x) - 30, z - 52, -z - 62); return d > 0 ? Math.floor(d / 4) + Math.round((f(x / 12, z / 12) - 0.5) * 3) : 0; }, B.pasto, B.tierra, B.piedra, 10);
    for (let z = -62; z <= 52; z++) for (let x = -9; x <= 9; x++) {
      const ax = Math.abs(x);
      this.set(X(x), Y(-1), Z(z), ax <= 3 ? (x === 0 && ((z % 6) + 6) % 6 < 3 ? B.blanco : B.oscuro) : ax === 4 ? B.amarillo : B.lisa);
    }
    // muro para manejar de lado, con franjas
    for (let z = -60; z <= -28; z++) for (let y = 0; y < 11; y++) this.set(X(24), Y(y), Z(z), y % 4 === 3 ? B.gris : B.blanco);
    this.caja(X(25), Y(0), Z(-60), X(26), Y(10), Z(-28), B.gris);
    // pacas de paja (el aterrizaje del final)
    for (let x = 8; x <= 12; x++) for (let z = 6; z <= 10; z++) for (let y = 0; y < (Math.abs(x - 10) + Math.abs(z - 8) < 3 ? 2 : 1); y++) this.set(X(x), Y(y), Z(z), B.paja);
    // hangar con la puerta abierta hacia la pista
    this.caja(X(-30), Y(0), Z(-44), X(-16), Y(11), Z(-28), B.gris);
    this.caja(X(-29), Y(0), Z(-43), X(-17), Y(10), Z(-29), 0);
    this.caja(X(-16), Y(0), Z(-41), X(-16), Y(8), Z(-31), 0);
    this.caja(X(-31), Y(12), Z(-45), X(-15), Y(12), Z(-27), B.oscuro);
    for (let x = -29; x <= -17; x += 2) this.caja(X(x), Y(0), Z(-43), X(x), Y(0), Z(-29), B.amarillo);
    // cohete con su torre al fondo
    const cx = 34, cz = -40;
    for (let y = 0; y < 30; y++) for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) {
      if (Math.abs(x) === 2 && Math.abs(z) === 2) continue;
      if (y > 25 && Math.max(Math.abs(x), Math.abs(z)) > 30 - y - 2) continue;              // punta
      this.set(X(cx + x), Y(y), Z(cz + z), y % 9 === 4 ? B.negro : B.blanco);
    }
    for (let y = 0; y < 31; y++) for (const [x, z] of [[4, -3], [4, 3], [7, -3], [7, 3]]) this.set(X(cx + x), Y(y), Z(cz + z), B.oscuro);
    for (let y = 2; y < 31; y += 4) this.caja(X(cx + 4), Y(y), Z(cz - 3), X(cx + 7), Y(y), Z(cz + 3), B.oscuro);
    this.arboles(160, r, (x, y, z) => this.arbolBola(x, y, z, 3 + Math.floor(r() * 3), 2 + Math.floor(r() * 2)), [B.pasto], (x, z) => Math.abs(x) < 33 && Math.abs(z) < 55);
    this.plantas([B.pasto], [[B.pasto_corto, 0.16], [B.diente_leon, 0.01]], r, (x, z) => (Math.abs(x) < 12 && Math.abs(z) < 30) || (x > 12 && x < 30 && z < -24));
  }

  // fondo de la toma 6-7: una montaña nevada con franjas de terracota y abetos abajo (se dibuja escalada y lejos)
  montana() {
    const f = fbm(19), r = rng(77);
    const alt = (x, z) => Math.max(0, 52 - Math.hypot(x * 0.9, z * 1.2) * 1.05 + (f(x / 11, z / 11) - 0.5) * 14);
    this.suelo(alt, (x, z, h) => h > 14 ? B.nieve : B.pasto_nieve, B.piedra, B.piedra, 60);
    for (let x = 0; x < this.T.x; x++) for (let z = 0; z < this.T.z; z++) {
      const y = this.alturaEn(x, z), h = y - this.O.y, k = Math.floor(h + f(x / 6, z / 6) * 4) % 7;
      if (h > 10 && k === 0) this.set(x, y, z, B.terracota_roja);
      else if (h > 10 && k === 1) this.set(x, y, z, B.terracota_blanca);
    }
    this.arboles(500, r, (x, y, z) => this.arbolAbeto(x, y, z, 6 + Math.floor(r() * 4), false), [B.pasto_nieve], () => false);
  }
  // fondo de la toma 23: cordillera ancha (el sol se pone detrás); la niebla del atardecer la vuelve morada
  cordillera() {
    const f = fbm(61), r = rng(13);
    this.suelo((x, z) => 6 + Math.max(0, (f(x / 18, z / 18) - 0.3) * 60), (x, z, h) => h > 30 ? B.nieve : h > 18 ? B.piedra : B.pasto, B.piedra, B.piedra, 60);
    this.arboles(500, r, (x, y, z) => this.arbolBola(x, y, z, 2, 2, r() < 0.5 ? B.hojas_azalea : B.hojas), [B.pasto], () => false);
  }

  // ───── malla
  // cambia a las texturas reales (o vuelve a las generadas con null)
  usarTexturas(reales) {
    const viejo = this.atlas.tex;
    this.atlas = crearAtlas(reales);
    for (const m of Object.values(this.mats)) { m.map = this.atlas.tex; if (m.emissiveMap) m.emissiveMap = this.atlas.tex; m.needsUpdate = true; }
    viejo.dispose();
    this.reconstruir();
  }

  reconstruir() {
    const buf = { solido: nuevoBuf(), recorte: nuevoBuf(), vidrio: nuevoBuf(), luz: nuevoBuf(), agua: nuevoBuf() };
    const uvs = this.atlas.uvs;
    for (let y = 0; y < this.T.y; y++) for (let z = 0; z < this.T.z; z++) for (let x = 0; x < this.T.x; x++) {
      const id = this.ids[this.i(x, y, z)];
      if (!id) continue;
      const b = BLOQUES[id];
      if (b.tipo === "puerta") { this.mallaPuerta(buf.solido, x, y, z, this.meta[this.i(x, y, z)]); continue; }
      if (b.tipo === "capa") {                          // capa delgada (nieve sobre hojas y pasto): 2/16 de alto
        const uv = uvs[typeof b.tex === "string" ? b.tex : b.tex.top], ox = x - this.O.x, oy = y - this.O.y, oz = z - this.O.z, h = 2 / 16;
        const P = (a, hh, c) => [ox + a, oy + hh, oz + c];
        cara(buf.solido, [P(0, h, 0), P(1, h, 0), P(0, h, 1), P(1, h, 1)], [0, 1, 0], uv, [1, 1, 1, 1]);
        for (const [a, c, n] of [[[0, 1], [1, 1], [0, 0, 1]], [[1, 0], [0, 0], [0, 0, -1]], [[1, 1], [1, 0], [1, 0, 0]], [[0, 0], [0, 1], [-1, 0, 0]]])
          cara(buf.solido, [P(a[0], h, a[1]), P(c[0], h, c[1]), P(a[0], 0, a[1]), P(c[0], 0, c[1])], n, uv, [1, 1, 1, 1]);
        continue;
      }
      if (b.tipo === "escalon" || b.tipo === "antorcha" || b.tipo === "alfombra") { this.mallaForma(buf, x, y, z, b, this.meta[this.i(x, y, z)]); continue; }
      if (b.tipo === "planta") {
        const uv = uvs[b.tex], ox = x - this.O.x, oy = y - this.O.y, oz = z - this.O.z, k = 0.15;
        const P = (a, h, c) => [ox + a, oy + h, oz + c];
        // viento: la base queda fija y la punta se mece (el pasto alto se dobla en sus dos mitades)
        const vi = id === B.pasto_alto ? [0.5, 0.5, 0, 0] : id === B.pasto_alto_arriba ? [1, 1, 0.5, 0.5] : [1, 1, 0, 0];
        cara(buf.recorte, [P(k, 1, k), P(1 - k, 1, 1 - k), P(k, 0, k), P(1 - k, 0, 1 - k)], [0, 1, 0], uv, [1, 1, 1, 1], vi);
        cara(buf.recorte, [P(k, 1, 1 - k), P(1 - k, 1, k), P(k, 0, 1 - k), P(1 - k, 0, k)], [0, 1, 0], uv, [1, 1, 1, 1], vi);
        continue;
      }
      const t = typeof b.tex === "string" ? { top: b.tex, lado: b.tex, abajo: b.tex } : b.tex;
      const destino = buf[b.luz ? "luz" : b.tipo || "solido"];
      for (const d of DIRS) {
        const nx = x + d.n[0], ny = y + d.n[1], nz = z + d.n[2];
        const vec = this.get(nx, ny, nz);
        if (vec && (!BLOQUES[vec].tipo || (vec === id && b.tipo))) continue;          // cara tapada
        const uv = uvs[t[d.cara]];
        const ao = d.esq.map(c => this.ao(x, y, z, d.n, c));
        const bajar = b.tipo === "agua" && this.get(x, y + 1, z) !== id ? 0.125 : 0;      // la superficie del agua queda 2/16 abajo, como en el juego
        let vi = b.tipo === "recorte" ? HOJAS_VIENTO : null;
        if (b.tipo === "agua") {                        // profundidad del agua en esta columna (0 orilla … 1 = 6+ bloques)
          let k = 0; while (k < 8 && this.get(x, y - k, z) === id) k++;
          const pr = Math.min(1, (k - 1) / 5); vi = [pr, pr, pr, pr];
        }
        cara(destino, d.esq.map(c => [x + c[0] - this.O.x, y + c[1] - (c[1] === 1 ? bajar : 0) - this.O.y, z + c[2] - this.O.z]), d.n, uv, ao, vi);
      }
    }
    for (const k of Object.keys(buf)) {
      if (this.mallas[k]) { this.grupo.remove(this.mallas[k]); this.mallas[k].geometry.dispose(); }
      const m = new THREE.Mesh(geoDe(buf[k]), this.mats[k]);
      m.receiveShadow = true; m.castShadow = k !== "vidrio" && k !== "agua";
      m.renderOrder = k === "vidrio" || k === "agua" ? 2 : 0;
      this.grupo.add(m); this.mallas[k] = m;
    }
  }

  ao(x, y, z, n, c) {
    // los dos vecinos laterales y el de la esquina, del lado de la normal
    const t = [0, 1, 2].filter(k => !n[k]);
    const s = t.map(k => (c[k] ? 1 : -1));
    const p = [x + n[0], y + n[1], z + n[2]];
    const off = (a, b) => { const q = [...p]; q[t[0]] += a; q[t[1]] += b; return this.opaco(...q) ? 1 : 0; };
    const l1 = off(s[0], 0), l2 = off(0, s[1]), es = off(s[0], s[1]);
    return BRILLO_AO[l1 && l2 ? 0 : 3 - (l1 + l2 + es)];
  }

  // formas que no son cubos: escalón (meta 0-3: lado alto hacia −z, +x, +z, −x), antorcha (meta 0 = de pie, 1-4 = en la
  // pared −z, +x, +z, −x, inclinada 22.5° como en el juego) y alfombra de pétalos (1/16 de alto)
  mallaForma(buf, x, y, z, b, meta) {
    const uvs = this.atlas.uvs, t = typeof b.tex === "string" ? { top: b.tex, lado: b.tex, abajo: b.tex } : b.tex;
    const ox = x - this.O.x, oy = y - this.O.y, oz = z - this.O.z;
    const sub = (uv, a0, b0, a1, b1) => [uv[0] + (uv[2] - uv[0]) * a0, uv[1] + (uv[3] - uv[1]) * b0, uv[0] + (uv[2] - uv[0]) * a1, uv[1] + (uv[3] - uv[1]) * b1];
    const caja = (destino, [x0, y0, z0, x1, y1, z1], f = (p) => p, sinAbajo = false) => {
      const P = (a, h, c) => { const q = f([a, h, c]); return [ox + q[0], oy + q[1], oz + q[2]]; };
      const L = uvs[t.lado], T = uvs[t.top], A = uvs[t.abajo || t.top];
      cara(destino, [P(x0, y1, z0), P(x1, y1, z0), P(x0, y1, z1), P(x1, y1, z1)], [0, 1, 0], sub(T, x0, z0, x1, z1), [1, 1, 1, 1]);
      if (!sinAbajo) cara(destino, [P(x0, y0, z1), P(x1, y0, z1), P(x0, y0, z0), P(x1, y0, z0)], [0, -1, 0], sub(A, x0, z0, x1, z1), [1, 1, 1, 1]);
      cara(destino, [P(x0, y1, z1), P(x1, y1, z1), P(x0, y0, z1), P(x1, y0, z1)], [0, 0, 1], sub(L, x0, 1 - y1, x1, 1 - y0), [1, 1, 1, 1]);
      cara(destino, [P(x1, y1, z0), P(x0, y1, z0), P(x1, y0, z0), P(x0, y0, z0)], [0, 0, -1], sub(L, 1 - x1, 1 - y1, 1 - x0, 1 - y0), [1, 1, 1, 1]);
      cara(destino, [P(x1, y1, z1), P(x1, y1, z0), P(x1, y0, z1), P(x1, y0, z0)], [1, 0, 0], sub(L, 1 - z1, 1 - y1, 1 - z0, 1 - y0), [1, 1, 1, 1]);
      cara(destino, [P(x0, y1, z0), P(x0, y1, z1), P(x0, y0, z0), P(x0, y0, z1)], [-1, 0, 0], sub(L, z0, 1 - y1, z1, 1 - y0), [1, 1, 1, 1]);
    };
    if (b.tipo === "escalon") {
      caja(buf.solido, [0, 0, 0, 1, 0.5, 1]);
      caja(buf.solido, [[0, 0.5, 0, 1, 1, 0.5], [0.5, 0.5, 0, 1, 1, 1], [0, 0.5, 0.5, 1, 1, 1], [0, 0.5, 0, 0.5, 1, 1]][meta & 3]);
    } else if (b.tipo === "alfombra") {
      const P = (a, h, c) => [ox + a, oy + h, oz + c], T = uvs[t.top];
      cara(buf.recorte, [P(0, 1 / 16, 0), P(1, 1 / 16, 0), P(0, 1 / 16, 1), P(1, 1 / 16, 1)], [0, 1, 0], T, [1, 1, 1, 1]);
    } else {
      const k = 1 / 16, d = meta & 7;
      if (!d) caja(buf.luz, [7 * k, 0, 7 * k, 9 * k, 10 * k, 9 * k]);
      else {
        // en la pared: la base pegada al muro, 3.5 px arriba, inclinada hacia afuera
        const ang = 22.5 * Math.PI / 180, sn = Math.sin(ang), cs = Math.cos(ang);
        const giro = ([a, h, c]) => {                      // pared en −z; luego se gira 90° por cada lado
          let q = [a, 3.5 * k + (h - 3.5 * k) * cs - (c - 8 * k) * sn, 2 * k + (c - 8 * k) * cs + (h - 3.5 * k) * sn];
          for (let i = 0; i < d - 1; i++) q = [1 - q[2], q[1], q[0]];
          return q;
        };
        caja(buf.luz, [7 * k, 3.5 * k, 7 * k, 9 * k, 13.5 * k, 9 * k], giro);
      }
    }
  }

  mallaPuerta(buf, x, y, z, meta) {
    const dir = meta & 3, arriba = meta & 4, abierta = meta & 8;
    const g = 3 / 16;
    // orientación: 0 = pegada a -z, 1 = a +x, 2 = a +z, 3 = a -x (abierta gira 90°)
    const d = (dir + (abierta ? 1 : 0)) % 4;
    const b = [[0, 0, 0, 1, 1, g], [1 - g, 0, 0, 1, 1, 1], [0, 0, 1 - g, 1, 1, 1], [0, 0, 0, g, 1, 1]][d];
    const ox = x - this.O.x, oy = y - this.O.y, oz = z - this.O.z;
    const uv = this.atlas.uvs[arriba ? "puerta_arriba" : "puerta_abajo"];
    const [x0, y0, z0, x1, y1, z1] = b;
    const P = (a, bb, cc) => [ox + a, oy + bb, oz + cc];
    const quads = [
      [[P(x1, y1, z1), P(x1, y1, z0), P(x1, y0, z1), P(x1, y0, z0)], [1, 0, 0]],
      [[P(x0, y1, z0), P(x0, y1, z1), P(x0, y0, z0), P(x0, y0, z1)], [-1, 0, 0]],
      [[P(x0, y1, z0), P(x1, y1, z0), P(x0, y1, z1), P(x1, y1, z1)], [0, 1, 0]],
      [[P(x0, y0, z1), P(x1, y0, z1), P(x0, y0, z0), P(x1, y0, z0)], [0, -1, 0]],
      [[P(x0, y1, z1), P(x1, y1, z1), P(x0, y0, z1), P(x1, y0, z1)], [0, 0, 1]],
      [[P(x1, y1, z0), P(x0, y1, z0), P(x1, y0, z0), P(x0, y0, z0)], [0, 0, -1]],
    ];
    for (const [v, n] of quads) cara(buf, v, n, uv, [1, 1, 1, 1]);
  }

  // ───── edición
  alternarPuerta(x, y, z) {
    if (this.get(x, y, z) !== B.puerta) return false;
    const m = this.meta[this.i(x, y, z)];
    const otraY = m & 4 ? y - 1 : y + 1;
    this.meta[this.i(x, y, z)] ^= 8;
    if (this.get(x, otraY, z) === B.puerta) this.meta[this.i(x, otraY, z)] ^= 8;
    this.reconstruir();
    return true;
  }

  poner(x, y, z, id, dir = 0) {
    if (!this.dentro(x, y, z)) return;
    if (id === B.puerta) {
      if (this.get(x, y + 1, z)) return;
      this.set(x, y, z, id, dir); this.set(x, y + 1, z, id, dir | 4);
    } else this.set(x, y, z, id);
    this.reconstruir();
  }
  quitar(x, y, z) {
    const id = this.get(x, y, z);
    if (!id) return;
    if (id === B.puerta) { const m = this.meta[this.i(x, y, z)]; const otra = m & 4 ? y - 1 : y + 1; if (this.get(x, otra, z) === B.puerta) this.set(x, otra, z, 0); }
    this.set(x, y, z, 0);
    this.reconstruir();
  }

  // celda (en coordenadas del mundo) desde un punto de la escena
  celda(p) { return [Math.floor(p.x + this.O.x), Math.floor(p.y + this.O.y), Math.floor(p.z + this.O.z)]; }

  // ───── guardar (RLE en base64)
  serializar() {
    const rle = (arr) => {
      const out = [];
      for (let k = 0; k < arr.length;) { const v = arr[k]; let n = 1; while (k + n < arr.length && arr[k + n] === v && n < 255) n++; out.push(n, v); k += n; }
      let s = ""; for (let k = 0; k < out.length; k += 8192) s += String.fromCharCode(...out.slice(k, k + 8192));
      return btoa(s);
    };
    return { v: 1, tam: [this.T.x, this.T.y, this.T.z], ids: rle(this.ids), meta: rle(this.meta) };
  }
  cargar(d) {
    const des = (b64, arr) => { const s = atob(b64); let k = 0; for (let j = 0; j < s.length; j += 2) { const n = s.charCodeAt(j), v = s.charCodeAt(j + 1); arr.fill(v, k, k + n); k += n; } };
    if (!d || d.tam?.join() !== [this.T.x, this.T.y, this.T.z].join()) return false;
    des(d.ids, this.ids); des(d.meta, this.meta);
    this.reconstruir();
    return true;
  }
}

function nuevoBuf() { return { pos: [], nor: [], uv: [], col: [], vi: [], idx: [] }; }
// v: 4 vértices [arriba-izq, arriba-der, abajo-izq, abajo-der]
function cara(buf, v, n, uv, ao, vi = null) {
  const b = buf.pos.length / 3;
  const [u0, v0, u1, v1] = uv;
  const uvs = [[u0, v0], [u1, v0], [u0, v1], [u1, v1]];
  for (let k = 0; k < 4; k++) {
    buf.pos.push(...v[k]); buf.nor.push(...n); buf.uv.push(...uvs[k]);
    buf.col.push(ao[k], ao[k], ao[k]);
    buf.vi.push(vi ? vi[k] : 0);                       // cuánto lo mueve el viento (modo premium): 0 = fijo, 1 = punta de planta
  }
  // girar la diagonal según el AO para evitar el "corte" feo (anisotropía)
  if (ao[0] + ao[3] > ao[1] + ao[2]) buf.idx.push(b, b + 2, b + 3, b, b + 3, b + 1);
  else buf.idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
}
function geoDe(b) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(b.pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(b.nor, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(b.uv, 2));
  g.setAttribute("color", new THREE.Float32BufferAttribute(b.col, 3));
  g.setAttribute("viento", new THREE.Float32BufferAttribute(b.vi, 1));
  g.setIndex(b.idx);
  g.computeBoundingSphere();
  return g;
}
