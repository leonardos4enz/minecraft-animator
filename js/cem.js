// Modelos y animaciones de Fresh Animations (formato OptiFine CEM: .jem = geometría, .jpm = animaciones) leídos de
// texturas_mc/packs/fresh (los copia herramientas/packs.py de TU zip). Sigue las reglas de EMF (Entity Model Features):
//   - cada parte "part" del .jem se cuelga como HIJA de la parte vanilla del mismo nombre (que conserva su pose vanilla);
//   - cada parte propia tiene pivote = translate invertido en x,y ("invertAxis": "xy") y rotación = rotate invertida;
//   - las cajas se invierten igual (x → −x − ancho, y → −y − alto) y usan el mapeo de UV de Minecraft;
//   - las animaciones asignan, en orden, variables (var.*, varb.*) y canales de partes (tx ty tz rx ry rz sx sy sz visible);
//     "body.rx" apunta a la parte vanilla "body" si el .jem la nombra, si no a la parte propia con ese id.
// Las expresiones se traducen a funciones de JavaScript una sola vez. Fresh Animations: © FreshLX (crédito en el README).
import * as THREE from "three";

const RAIZ = "texturas_mc/packs/";
const cache = new Map();
const traer = (ruta) => { if (!cache.has(ruta)) cache.set(ruta, fetch(RAIZ + ruta).then(r => r.ok ? r.json() : null).catch(() => null)); return cache.get(ruta); };
export const hayPacks = () => traer("indice.json");

// ───────────── expresiones ─────────────
const FUNCS = {
  sin: "Math.sin", cos: "Math.cos", tan: "Math.tan", asin: "Math.asin", acos: "Math.acos", atan: "Math.atan", atan2: "Math.atan2",
  abs: "Math.abs", floor: "Math.floor", ceil: "Math.ceil", exp: "Math.exp", log: "Math.log", pow: "Math.pow", sqrt: "Math.sqrt",
  round: "Math.round", min: "Math.min", max: "Math.max", signum: "Math.sign",
  torad: "F.torad", todeg: "F.todeg", clamp: "F.clamp", frac: "F.frac", fmod: "F.fmod", lerp: "F.lerp", if: "F.si", ifb: "F.si",
  random: "F.random", between: "F.between", equals: "F.equals", in: "F.en", print: "F.print", printb: "F.print",
};
export const F = {
  torad: (d) => d * Math.PI / 180, todeg: (r) => r * 180 / Math.PI,
  clamp: (x, a, b) => Math.min(b, Math.max(a, x)), frac: (x) => x - Math.floor(x), fmod: (a, b) => a - b * Math.floor(a / b),
  lerp: (k, a, b) => a + (b - a) * k,
  si: (...a) => { for (let i = 0; i + 1 < a.length; i += 2) if (a[i]) return a[i + 1]; return a.length % 2 ? a[a.length - 1] : 0; },
  random: (s) => { if (s === undefined) return F._rnd(); let x = Math.sin(s * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); },
  between: (x, a, b) => (x >= a && x <= b ? 1 : 0), equals: (x, y, e) => (Math.abs(x - y) <= (e ?? 1e-6) ? 1 : 0),
  en: (x, ...l) => (l.includes(x) ? 1 : 0), print: (_i, _n, v) => v,
  _rnd: Math.random,
};
// lee una expresión de CEM y la convierte en código JS (los operadores tienen la misma precedencia que en JS)
function traducir(expr, partes) {
  const s = String(expr), out = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    const num = /^(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?/.exec(s.slice(i));
    if (num) { out.push(num[0]); i += num[0].length; continue; }
    const id = /^[A-Za-z_][A-Za-z_0-9]*(\.[A-Za-z_][A-Za-z_0-9]*)*/.exec(s.slice(i));
    if (id) {
      const n = id[0]; i += n.length;
      let j = i; while (/\s/.test(s[j])) j++;
      if (s[j] === "(") { out.push(FUNCS[n] || "F.print"); continue; }
      if (n === "pi") out.push("Math.PI");
      else if (n === "true") out.push("1");
      else if (n === "false") out.push("0");
      else if (n.startsWith("var.")) out.push(`(V[${JSON.stringify(n.slice(4))}]||0)`);
      else if (n.startsWith("varb.")) out.push(`(V[${JSON.stringify("b_" + n.slice(5))}]||0)`);
      else if (n.includes(".")) {
        const k = n.lastIndexOf("."), parte = n.slice(0, k), canal = n.slice(k + 1);
        out.push(`P(${JSON.stringify(parte)},${JSON.stringify(canal)})`); partes.add(parte);
      } else out.push(`(+E[${JSON.stringify(n)}]||0)`);
      continue;
    }
    const op = /^(&&|\|\||==|!=|<=|>=|[-+*/%<>!(),])/.exec(s.slice(i));
    if (op) { out.push(op[0] === "==" ? "==" : op[0]); i += op[0].length; continue; }
    i++;                                                  // carácter desconocido: se ignora
  }
  return out.join(" ").replace(/!\s*(?=[^=])/g, "!");
}
function compilar(bloques) {
  const lineas = [], partes = new Set();
  for (const b of bloques) for (const [k, v] of Object.entries(b)) {
    const js = traducir(v, partes);
    if (k.startsWith("var.")) lineas.push(`V[${JSON.stringify(k.slice(4))}] = +(${js}) || 0;`);
    else if (k.startsWith("varb.")) lineas.push(`V[${JSON.stringify("b_" + k.slice(5))}] = (${js}) ? 1 : 0;`);
    else if (k.startsWith("render.")) continue;
    else { const p = k.lastIndexOf("."); lineas.push(`S(${JSON.stringify(k.slice(0, p))},${JSON.stringify(k.slice(p + 1))}, +(${js}) || 0);`); partes.add(k.slice(0, p)); }
  }
  try { return new Function("V", "E", "P", "S", "F", lineas.join("\n")); }
  catch (e) { console.warn("CEM: no se pudo compilar", e); return () => {}; }
}

// ───────────── geometría ─────────────
// cara con UV propia ([u1, v1, u2, v2] en pixeles) o caja con el mapeo de Minecraft
export function geoCajaCEM(c, tw, th, inflar, espejo, uvCaras) {
  const [x, y, z, w, h, d] = c, [ix, iy, iz] = inflar;
  const x0 = x - ix, y0 = y - iy, z0 = z - iz, x1 = x + w + ix, y1 = y + h + iy, z1 = z + d + iz;
  let caras;
  if (uvCaras) {
    const U = (k) => uvCaras[k] ? [uvCaras[k][0], uvCaras[k][1], uvCaras[k][2] - uvCaras[k][0], uvCaras[k][3] - uvCaras[k][1]] : null;
    caras = { frente: U("uvNorth"), atras: U("uvSouth"), der: U("uvWest"), izq: U("uvEast"), arriba: U("uvUp"), abajo: U("uvDown") };
  } else {
    const [u, v] = uvCaras === null ? [0, 0] : c.uv;
    caras = { frente: [u + d, v + d, w, h], atras: [u + 2 * d + w, v + d, w, h], der: [u, v + d, d, h], izq: [u + d + w, v + d, d, h], arriba: [u + d, v, w, d], abajo: [u + d + w, v + d, w, -d] };
    if (espejo) caras = { ...caras, der: caras.izq, izq: caras.der };
    caras.abajo = [u + d + w, v, w, d];
  }
  const L = [
    ["frente", [[x0, y0, z0], [x1, y0, z0], [x0, y1, z0], [x1, y1, z0]], [0, 0, -1]],
    ["atras", [[x1, y0, z1], [x0, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1]],
    ["der", [[x0, y0, z1], [x0, y0, z0], [x0, y1, z1], [x0, y1, z0]], [-1, 0, 0]],
    ["izq", [[x1, y0, z0], [x1, y0, z1], [x1, y1, z0], [x1, y1, z1]], [1, 0, 0]],
    ["arriba", [[x0, y0, z1], [x1, y0, z1], [x0, y0, z0], [x1, y0, z0]], [0, -1, 0]],
    ["abajo", [[x0, y1, z0], [x1, y1, z0], [x0, y1, z1], [x1, y1, z1]], [0, 1, 0]],
  ];
  const pos = [], nor = [], uv = [], idx = [];
  for (const [nombre, q, n] of L) {
    const r = caras[nombre];
    if (!r || r[2] === 0 || r[3] === 0) continue;
    let [tu, tv, tW, tH] = r, uA = tu, uB = tu + tW;
    if (espejo && !uvCaras) [uA, uB] = [uB, uA];
    const uvs = [[uA, tv], [uB, tv], [uA, tv + tH], [uB, tv + tH]];
    const b = pos.length / 3;
    for (let k = 0; k < 4; k++) { pos.push(...q[k]); nor.push(...n); uv.push(uvs[k][0] / tw, 1 - uvs[k][1] / th); }
    const a = new THREE.Vector3(...q[0]), e1 = new THREE.Vector3(...q[2]).sub(a), e2 = new THREE.Vector3(...q[1]).sub(a);
    if (e1.cross(e2).dot(new THREE.Vector3(...n)) > 0) idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
    else idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
  }
  if (!pos.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

// pose vanilla (Java) de las partes que Fresh Animations no reescribe por completo: [x, y, z, rx, ry, rz] y padre
const R90 = Math.PI / 2;
export const VANILLA = {
  wolf: { head: [-1, 13.5, -7], body: [0, 14, 2, R90], mane: [-1, 14, -3, R90], leg1: [-2.5, 16, 7], leg2: [0.5, 16, 7], leg3: [-2.5, 16, -4], leg4: [0.5, 16, -4], tail: [-1, 12, 8, 0.628] },
  chicken: { head: [0, 15, -4], body: [0, 16, 0, R90], right_leg: [-2, 19, 1], left_leg: [1, 19, 1], right_wing: [-4, 13, 0], left_wing: [4, 13, 0], bill: [0, 15, -4], chin: [0, 15, -4] },
  sheep: { head: [0, 6, -8], body: [0, 5, 2, R90], leg1: [-3, 12, 7], leg2: [3, 12, 7], leg3: [-3, 12, -5], leg4: [3, 12, -5] },
  goat: { head: [1, 14, 0], body: [0, 24, 0], leg1: [1, 14, 4], leg2: [-3, 14, 4], leg3: [1, 14, -6], leg4: [-3, 14, -6] },
  villager: { head: [0, 0, 0], headwear: [0, 0, 0, 0, 0, 0, "head"], headwear2: [0, 0, 0, -R90, 0, 0, "headwear"], nose: [0, -2, 0, 0, 0, 0, "head"], body: [0, 0, 0], bodywear: [0, 0, 0, 0, 0, 0, "body"], arms: [0, 3, -1, -0.75], right_leg: [-2, 12, 0], left_leg: [2, 12, 0] },
  glow_squid: { body: [0, 8, 0], ...Object.fromEntries(Array.from({ length: 8 }, (_, i) => { const f = i * Math.PI * 2 / 8; return ["tentacle" + (i + 1), [Math.cos(f) * 5, 15, Math.sin(f) * 5, 0, i * Math.PI * -2 / 8 + R90, 0]]; })) },
  strider: { body: [0, 1, 0], right_leg: [-4, 8, 0], left_leg: [4, 8, 0] },
  llama: { head: [0, 7, -6], body: [0, 5, 2, R90], leg1: [-3.5, 10, 6], leg2: [3.5, 10, 6], leg3: [-3.5, 10, -5], leg4: [3.5, 10, -5], chest_right: [-8.5, 3, 3, 0, R90, 0], chest_left: [5.5, 3, 3, 0, R90, 0] },
  happy_ghast: { body: [0, 16, 0], inner_body: [0, 16, 0] },
};
VANILLA.happy_ghast_baby = VANILLA.happy_ghast; VANILLA.happy_ghast_harness = VANILLA.happy_ghast;
VANILLA.wolf_armor = VANILLA.wolf; VANILLA.sheep_wool = VANILLA.sheep; VANILLA.llama_decor = VANILLA.llama;
// resto de los mobs (biblioteca): la pose vanilla de las partes que FA no anima del todo sale de la geometría de Bedrock
// (herramientas/biblioteca.py → indice.json "vanilla"); aquí van encima las relaciones padre-hijo de Java que Bedrock no
// tiene igual (sombreros, orejas, mangas, colas en dos partes…) y las poses que se conocen del código de Java
const H = (padre, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => [x, y, z, rx, ry, rz, padre];
const HUMANOIDE = { head: [0, 0, 0], headwear: H("head"), body: [0, 0, 0], right_arm: [-5, 2, 0], left_arm: [5, 2, 0], right_leg: [-1.9, 12, 0], left_leg: [1.9, 12, 0] };
const PIGLIN = { ...HUMANOIDE, left_ear: H("head", 4.5, -6, 0, 0, 0, -0.5236), right_ear: H("head", -4.5, -6, 0, 0, 0, 0.5236), jacket: H("body"),
  left_sleeve: H("left_arm"), right_sleeve: H("right_arm"), left_pants: H("left_leg"), right_pants: H("right_leg") };
const ILLAGER = { head: [0, 0, 0], hat: H("head"), nose: H("head", 0, -2, 0), body: [0, 0, 0], arms: [0, 3, -1, -0.75], right_arm: [-5, 2, 0], left_arm: [5, 2, 0], right_leg: [-2, 12, 0], left_leg: [2, 12, 0] };
const CABALLO = { body: [0, 11, 5], neck: [0, 4, -12, 0.5236], head: H("neck"), mane: H("neck"), mouth: H("neck"), left_ear: H("head"), right_ear: H("head"),
  tail: H("body", 0, -5, 2, 0.5236), left_chest: H("body", 6, -8, 0, 0, -R90, 0), right_chest: H("body", -6, -8, 0, 0, R90, 0),
  front_right_leg: [-3, 14, -10], front_left_leg: [3, 14, -10], back_right_leg: [-3, 14, 7], back_left_leg: [3, 14, 7] };
const GATO = { head: [0, 15, -9], body: [0, 12, -10, R90], tail: [0, 15, 8, 0.9], tail2: [0, 20, 14],
  back_left_leg: [1.1, 18, 5], back_right_leg: [-1.1, 18, 5], front_left_leg: [1.2, 14.1, -5], front_right_leg: [-1.2, 14.1, -5] };
const ARANA = { head: [0, 15, -3], neck: [0, 15, 0], body: [0, 15, 9] };
const GUARDIAN = { body: [0, 0, 0], eye: H("body", 0, 0, -8.25), tail1: H("body"), tail2: H("tail1", -1.5, 0.5, 14), tail3: H("tail2", 0.5, 0.5, 6),
  ...Object.fromEntries(Array.from({ length: 12 }, (_, i) => ["spine" + (i + 1), H("body")])) };
export const MANUAL = {
  zombie: HUMANOIDE, husk: HUMANOIDE, drowned: HUMANOIDE, drowned_outer: HUMANOIDE, skeleton: HUMANOIDE, stray: HUMANOIDE, stray_outer: HUMANOIDE,
  bogged: HUMANOIDE, bogged_outer: HUMANOIDE, parched: HUMANOIDE, wither_skeleton: HUMANOIDE, giant: HUMANOIDE, zombie_villager: VANILLA.villager,
  piglin: PIGLIN, piglin_brute: PIGLIN, zombified_piglin: PIGLIN,
  pillager: ILLAGER, vindicator: ILLAGER, evoker: ILLAGER, illusioner: ILLAGER,
  witch: { ...VANILLA.villager, mole: H("nose", 0, -2, 0) }, wandering_trader: VANILLA.villager, villager2: VANILLA.villager,
  horse: CABALLO, donkey: CABALLO, mule: CABALLO, skeleton_horse: CABALLO, zombie_horse: CABALLO, horse_armor: CABALLO, horse_saddle: CABALLO,
  spider: ARANA, cave_spider: ARANA, guardian: GUARDIAN, elder_guardian: GUARDIAN,
  bee: { body: [0, 19, 0], torso: H("body"), stinger: H("torso"), left_antenna: H("torso", 0, -2, -5), right_antenna: H("torso", 0, -2, -5),
    left_wing: H("body", 1.5, -4, -3), right_wing: H("body", -1.5, -4, -3), front_legs: H("body", 1.5, 3, -2), middle_legs: H("body", 1.5, 3, 0), back_legs: H("body", 1.5, 3, 2) },
  cat: GATO, cat_collar: GATO, ocelot: GATO,
  phantom: { tail2: "tail", left_wing_tip: "left_wing", right_wing_tip: "right_wing" },
  bat: { outer_left_wing: "left_wing", outer_right_wing: "right_wing" },
  hoglin: { mane: "body", left_ear: "head", right_ear: "head" }, zoglin: { mane: "body", left_ear: "head", right_ear: "head" },
  ravager: { head: "neck", jaw: "head" }, sniffer: { lower_beak: "head", nose: "head", left_ear: "head", right_ear: "head" },
  iron_golem: { head: [0, -7, -2] },
};
export const VANILLA_EXTRA = {};
// poses: {modelo: {parte: [x, y, z, rx, ry, rz, padre?]}} del índice. En MANUAL, un texto = solo el padre (la posición absoluta
// de Bedrock se vuelve relativa a la del padre); una lista = la pose completa de Java
export function registrarVanilla(poses) {
  for (const [m, tabla] of Object.entries(poses || {})) {
    if (VANILLA[m]) continue;
    const t = Object.fromEntries(Object.entries(tabla).filter(([k]) => !k.startsWith("_")));
    for (const [p, v] of Object.entries(MANUAL[m] || {})) {
      if (typeof v !== "string") { t[p] = v; continue; }
      const a = t[p] || [0, 0, 0], b = t[v] && !t[v][6] ? t[v] : [0, 0, 0];
      t[p] = [a[0] - b[0], a[1] - b[1], a[2] - b[2], a[3] || 0, a[4] || 0, a[5] || 0, v];
    }
    VANILLA_EXTRA[m] = t;
  }
}

// arma un modelo .jem con un material; devuelve {raiz, partes: {nombre: Object3D}, vanilla: Set}
function armarJem(jem, material, base) {
  const tw = jem.textureSize?.[0] || 64, th = jem.textureSize?.[1] || 32;
  const raiz = new THREE.Group(); raiz.name = "root";
  const vanilla = {}, propias = {}, especificadas = new Set();
  const pose = (g, p) => { g.position.set(p[0] || 0, p[1] || 0, p[2] || 0); g.rotation.order = "ZYX"; g.rotation.set(p[3] || 0, p[4] || 0, p[5] || 0); };
  const tabla = VANILLA[base] || VANILLA_EXTRA[base] || MANUAL[base] || {};
  const vanillaDe = (n) => {
    if (n === "root") return raiz;
    if (vanilla[n]) return vanilla[n];
    const g = new THREE.Group(); g.name = n; const p = tabla[n] || [];
    pose(g, p); (p[6] ? vanillaDe(p[6]) : raiz).add(g);
    vanilla[n] = g; return g;
  };
  for (const n of Object.keys(tabla)) vanillaDe(n);
  const propia = (d, padre, texSize) => {
    const g = new THREE.Group(); g.name = d.id || "";
    const inv = d.invertAxis || "", ix = inv.includes("x") ? -1 : 1, iy = inv.includes("y") ? -1 : 1, iz = inv.includes("z") ? -1 : 1;
    const t = d.translate || [0, 0, 0], r = d.rotate || [0, 0, 0];
    g.position.set(t[0] * ix, t[1] * iy, t[2] * iz);
    g.rotation.order = "ZYX"; g.rotation.set(r[0] * ix * Math.PI / 180, r[1] * iy * Math.PI / 180, r[2] * iz * Math.PI / 180);
    if (d.scale != null) g.scale.setScalar(d.scale);
    const [tw2, th2] = d.textureSize || texSize;
    const espejo = (d.mirrorTexture || "").includes("u");
    for (const b of d.boxes || []) {
      const c = [...b.coordinates];
      if (ix < 0) c[0] = -c[0] - c[3];
      if (iy < 0) c[1] = -c[1] - c[4];
      if (iz < 0) c[2] = -c[2] - c[5];
      const sa = b.sizesAdd || [b.sizeAddX ?? b.sizeAdd ?? 0, b.sizeAddY ?? b.sizeAdd ?? 0, b.sizeAddZ ?? b.sizeAdd ?? 0];
      let geo;
      if (b.textureOffset) { c.uv = b.textureOffset; geo = geoCajaCEM(c, tw2, th2, sa, espejo, undefined); }
      else geo = geoCajaCEM(c, tw2, th2, sa, false, b);
      if (!geo) continue;
      const m = new THREE.Mesh(geo, material); m.castShadow = true; m.receiveShadow = true;
      g.add(m);
    }
    for (const s of [...(d.submodels || []), ...(d.submodel ? [d.submodel] : [])]) propia(s, g, [tw2, th2]);
    padre.add(g);
    if (d.id && !propias[d.id]) propias[d.id] = g;
    return g;
  };
  for (const m of jem.models || []) {
    if (!m.part) continue;
    especificadas.add(m.part);
    const v = vanillaDe(m.part);
    if (m.id || m.boxes || m.submodels) propia(m, v, [tw, th]);
  }
  // mapa de nombres para las animaciones (la vanilla especificada gana a la propia del mismo nombre, como en EMF)
  const partes = { ...propias };
  for (const n of especificadas) partes[n] = n === "root" ? raiz : vanilla[n];
  for (const g of [...Object.values(vanilla), ...Object.values(propias), raiz]) g.userData.inicial = { p: g.position.clone(), r: g.rotation.clone(), s: g.scale.clone() };
  return { raiz, partes, tw, th };
}

// carga un modelo (y sus animaciones) de Fresh Animations
export async function cargarCEM(nombre) {
  const jem = await traer(`fresh/cem/${nombre}.jem`);
  if (!jem) return null;
  const bloques = [];
  for (const m of jem.models || []) {
    if (m.model) { const jpm = await traer(`fresh/cem/${m.model}`); if (jpm?.animations) bloques.push(...jpm.animations); }
    if (m.animations) bloques.push(...m.animations);
  }
  return { jem, anim: compilar(bloques) };
}

// instancia: geometría + estado de animación (variables que persisten de cuadro a cuadro, como en el juego)
export class ModeloCEM {
  constructor(def, material, base) {
    const { raiz, partes } = armarJem(def.jem, material, base);
    this.raiz = raiz; this.partes = partes; this.anim = def.anim;
    this.V = {};
  }
  reiniciar() { this.V = {}; }
  // aplica un paso de animación con las variables de la entidad E y devuelve la pose de cada parte
  paso(E, pre = null) {
    for (const g of Object.values(this.partes)) {
      if (!g?.userData.inicial) continue;
      const i = g.userData.inicial; g.position.copy(i.p); g.rotation.copy(i.r); g.scale.copy(i.s); g.visible = true;
    }
    const pa = this.partes;
    if (pre) pre(pa);
    const P = (n, c) => {
      const g = pa[n]; if (!g) return 0;
      switch (c) {
        case "tx": return g.position.x; case "ty": return g.position.y; case "tz": return g.position.z;
        case "rx": return g.rotation.x; case "ry": return g.rotation.y; case "rz": return g.rotation.z;
        case "sx": return g.scale.x; case "sy": return g.scale.y; case "sz": return g.scale.z;
        case "visible": case "visible_boxes": return g.visible ? 1 : 0;
      }
      return 0;
    };
    const S = (n, c, v) => {
      const g = pa[n]; if (!g) return;
      switch (c) {
        case "tx": g.position.x = v; break; case "ty": g.position.y = v; break; case "tz": g.position.z = v; break;
        case "rx": g.rotation.x = v; break; case "ry": g.rotation.y = v; break; case "rz": g.rotation.z = v; break;
        case "sx": g.scale.x = v; break; case "sy": g.scale.y = v; break; case "sz": g.scale.z = v; break;
        case "visible": case "visible_boxes": g.visible = !!v; break;
      }
    };
    this.anim(this.V, E, P, S, F);
  }
  // pose actual de todas las partes (para guardarla en la simulación y repetirla igual al exportar)
  foto() { const o = {}; for (const [n, g] of Object.entries(this.partes)) if (g) o[n] = [g.position.x, g.position.y, g.position.z, g.rotation.x, g.rotation.y, g.rotation.z, g.scale.x, g.scale.y, g.scale.z, g.visible ? 1 : 0]; return o; }
  poner(f, g2 = null, k = 0) {
    for (const [n, a] of Object.entries(f)) {
      const g = this.partes[n]; if (!g) continue;
      const b = g2?.[n] || a, L = (i) => a[i] + (b[i] - a[i]) * k;
      g.position.set(L(0), L(1), L(2)); g.rotation.set(L(3), L(4), L(5)); g.scale.set(L(6), L(7), L(8)); g.visible = a[9] > 0.5;
    }
  }
}
