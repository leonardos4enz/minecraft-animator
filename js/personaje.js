// Personaje de Minecraft construido desde cualquier skin (64x64 o la antigua 64x32).
// - Rig con huesos (SkinnedMesh): brazos y piernas se DOBLAN suave en codo y rodilla, sin huecos.
// - Capa exterior en 3D (como el mod "3D Skin Layers"): cada pixel de la segunda capa es un
//   cubito pegado al cuerpo, así el pelo, mangas y chaqueta tienen grosor y no flotan separados.
// - La skin se escala x8 y se filtra suave: los pixeles se ven nítidos de cerca y sin "serrucho" de lejos.
// Unidades: 1 = 1 pixel de la skin; el grupo escala a 1/16 (el personaje mide 2 unidades).
import * as THREE from "three";

// munecaD: no deforma la piel; gira lo que tiene en la mano (la espada) alrededor del puño
export const JUNTAS = ["raiz", "torso", "cabeza", "brazoD", "codoD", "brazoI", "codoI", "piernaD", "rodillaD", "piernaI", "rodillaI", "munecaD"];
export const NOMBRE_JUNTA = {
  raiz: "Cuerpo entero", torso: "Torso", cabeza: "Cabeza",
  brazoD: "Brazo derecho", codoD: "Codo derecho", brazoI: "Brazo izquierdo", codoI: "Codo izquierdo",
  piernaD: "Pierna derecha", rodillaD: "Rodilla derecha", piernaI: "Pierna izquierda", rodillaI: "Rodilla izquierda",
  munecaD: "Muñeca derecha (objeto)",
};
const IDX = Object.fromEntries(JUNTAS.map((n, i) => [n, i]));

// Rectángulos de textura de una caja de Minecraft (u, v = esquina del bloque en la skin)
export function rectsCaja(u, v, w, h, d) {
  return {
    front: [u + d, v + d, w, h], back: [u + 2 * d + w, v + d, w, h],
    right: [u, v + d, d, h], left: [u + d + w, v + d, d, h],
    top: [u + d, v, w, d], bottom: [u + d + w, v, w, d],
  };
}

// ───────────── skin ─────────────
export function normalizarSkin(img) {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const x = c.getContext("2d", { willReadFrequently: true });
  x.imageSmoothingEnabled = false;
  if (img.height * 2 === img.width) {             // skin antigua 64x32: espejar brazo y pierna
    x.drawImage(img, 0, 0, 64, 32);
    espejarExtremidad(x, 0, 16, 16, 48);
    espejarExtremidad(x, 40, 16, 32, 48);
    // como Minecraft: si la zona del sombrero no tiene ningún pixel transparente, se ignora
    const d = x.getImageData(32, 0, 32, 16).data;
    let opaca = true;
    for (let k = 3; k < d.length; k += 4) if (d[k] < 128) { opaca = false; break; }
    if (opaca) x.clearRect(32, 0, 32, 16);
  } else x.drawImage(img, 0, 0, 64, 64);
  return c;
}

function espejarExtremidad(ctx, su, sv, du, dv) {
  const tmp = document.createElement("canvas");
  tmp.width = tmp.height = 64;
  tmp.getContext("2d").drawImage(ctx.canvas, 0, 0);
  const s = rectsCaja(su, sv, 4, 12, 4), d = rectsCaja(du, dv, 4, 12, 4);
  const pares = [["top", "top"], ["bottom", "bottom"], ["front", "front"], ["back", "back"], ["right", "left"], ["left", "right"]];
  for (const [a, b] of pares) {
    const [sx, sy, sw, sh] = s[a], [dx, dy, dw, dh] = d[b];
    ctx.save(); ctx.translate(dx + dw, dy); ctx.scale(-1, 1);
    ctx.drawImage(tmp, sx, sy, sw, sh, 0, 0, dw, dh);
    ctx.restore();
  }
}

// La cara de 8x8 con la capa del sombrero encima (lo que se ve de frente)
export function caraDeSkin(skin, { conSombrero = true } = {}) {
  const c = document.createElement("canvas");
  c.width = c.height = 8;
  const x = c.getContext("2d", { willReadFrequently: true });
  x.drawImage(skin, 8, 8, 8, 8, 0, 0, 8, 8);
  if (conSombrero) x.drawImage(skin, 40, 8, 8, 8, 0, 0, 8, 8);
  return c;
}

// ───────────── constructor de geometría con pesos de huesos ─────────────
class Constructor {
  constructor(tw = 64, th = 64) { this.pos = []; this.nor = []; this.uv = []; this.si = []; this.sw = []; this.idx = []; this.grupos = []; this.tw = tw; this.th = th; }
  // quad: o = esquina sup-izq, r = vector derecha, d = vector abajo, uvr = [u0,v0,u1,v1] en pixeles de textura
  quad(o, r, d, uvr, pesos, tam = [this.tw, this.th]) {
    const n = new THREE.Vector3(...d).cross(new THREE.Vector3(...r)).normalize();
    const b = this.pos.length / 3;
    const [TW, TH] = tam;
    const vs = [[0, 0], [1, 0], [0, 1], [1, 1]];
    for (const [a, c] of vs) {
      const p = [o[0] + r[0] * a + d[0] * c, o[1] + r[1] * a + d[1] * c, o[2] + r[2] * a + d[2] * c];
      this.pos.push(...p);
      this.nor.push(n.x, n.y, n.z);
      this.uv.push((uvr[0] + (uvr[2] - uvr[0]) * a) / TW, 1 - (uvr[1] + (uvr[3] - uvr[1]) * c) / TH);
      const w = pesos(p);
      this.si.push(w[0][0], w[1]?.[0] ?? 0, 0, 0);
      this.sw.push(w[0][1], w[1]?.[1] ?? 0, 0, 0);
    }
    this.idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
  }
  marcar(mat) {   // agrupar los triángulos agregados desde la última marca con el material `mat`
    const ini = this.grupos.length ? this.grupos[this.grupos.length - 1].fin : 0;
    if (this.idx.length > ini) this.grupos.push({ ini, fin: this.idx.length, mat });
  }
  geometria() {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(this.si, 4));
    g.setAttribute("skinWeight", new THREE.Float32BufferAttribute(this.sw, 4));
    g.setIndex(this.idx);
    for (const gr of this.grupos) g.addGroup(gr.ini, gr.fin - gr.ini, gr.mat);
    return g;
  }
}

// Caras de una caja: [esquina, derecha, abajo]
function carasCaja(x0, y0, z0, x1, y1, z1) {
  const W = x1 - x0, H = y1 - y0, D = z1 - z0;
  return {
    front: [[x0, y1, z1], [W, 0, 0], [0, -H, 0]],
    back: [[x1, y1, z0], [-W, 0, 0], [0, -H, 0]],
    right: [[x0, y1, z0], [0, 0, D], [0, -H, 0]],
    left: [[x1, y1, z1], [0, 0, -D], [0, -H, 0]],
    top: [[x0, y1, z0], [W, 0, 0], [0, 0, D]],
    bottom: [[x0, y0, z1], [W, 0, 0], [0, 0, -D]],
  };
}
const ORDEN = ["front", "back", "right", "left", "top", "bottom"];

// Pesos de una extremidad: arriba del doblez = hueso superior, abajo = inferior, mezcla suave en medio
function pesosExtremidad(sup, inf, yJunta, ancho = 1.6) {
  return ([, y]) => {
    const t = THREE.MathUtils.smoothstep(y, yJunta - ancho, yJunta + ancho);   // 0 abajo .. 1 arriba
    if (t >= 0.999) return [[IDX[sup], 1]];
    if (t <= 0.001) return [[IDX[inf], 1]];
    return [[IDX[sup], t], [IDX[inf], 1 - t]];
  };
}
const pesoFijo = (n) => () => [[IDX[n], 1]];
const IDX_PELO = JUNTAS.length;          // hueso extra (no se posa: lo mueve la física)
function pesosPelo([x, y, z]) {
  // arriba de la cabeza (y=32) casi fijo; abajo y atrás cuelga más; el flequillo de enfrente se mueve poco
  let w = Math.pow(THREE.MathUtils.clamp((32.5 - y) / 9, 0, 1), 1.25);
  if (z > 3.5 && Math.abs(x) < 3.5) w *= 0.35;
  w = Math.min(0.95, w);
  return w < 0.02 ? [[IDX.cabeza, 1]] : [[IDX_PELO, w], [IDX.cabeza, 1 - w]];
}

// Caja base: los lados se parten en filas de 1 pixel para que el doblez sea suave
function cajaBase(cons, b, rects, pesos, { caraFrente = null } = {}) {
  const caras = carasCaja(...b);
  for (const nombre of ORDEN) {
    const [o, r, d] = caras[nombre];
    const [tx, ty, tw, th] = rects[nombre];
    const vertical = Math.abs(d[1]) > 0;
    if (nombre === "front" && caraFrente) {       // la cara animada usa su propia textura (material 1)
      cons.marcar(0);
      cons.quad(o, r, d, [0, 0, 8, 8], pesos, [8, 8]);
      cons.marcar(1);
      continue;
    }
    const filas = vertical ? Math.round(Math.abs(d[1])) : 1;
    for (let f = 0; f < filas; f++) {
      const o2 = [o[0] + d[0] * f / filas, o[1] + d[1] * f / filas, o[2] + d[2] * f / filas];
      const d2 = d.map(v => v / filas);
      cons.quad(o2, r, d2, [tx, ty + th * f / filas, tx + tw, ty + th * (f + 1) / filas], pesos);
    }
  }
  cons.marcar(0);
}

// Capa exterior en voxeles: cada pixel opaco de la capa 2 es un cubito de grosor `g` sobre la superficie
function capaVoxel(cons, b, rects, pesos, datos, g, { saltar = null, largo = 0, esPelo = null, pesosFijos = null } = {}) {
  const caras = carasCaja(...b);
  const opaco = (u, v) => datos[(v * 64 + u) * 4 + 3] > 25;
  for (const nombre of ORDEN) {
    const [o, r, d] = caras[nombre];
    const [tx, ty, tw, th] = rects[nombre];
    const n = new THREE.Vector3(...d).cross(new THREE.Vector3(...r)).normalize();
    const R = new THREE.Vector3(...r).divideScalar(tw), Dd = new THREE.Vector3(...d).divideScalar(th);
    const lado = nombre === "front" || nombre === "back", tapa = nombre === "top" || nombre === "bottom";
    for (let j = 0; j < th; j++) for (let i = 0; i < tw; i++) {
      const u = tx + i, v = ty + j;
      if (!opaco(u, v)) continue;
      if (saltar && saltar(nombre, i, j)) continue;
      const pelo = !esPelo || esPelo(u, v);
      const pw = pelo ? pesos : pesosFijos;
      // celda sobre la cara, extendida en los bordes para tapar las esquinas sin huecos
      let a0 = i, a1 = i + 1, c0 = j, c1 = j + 1;
      const ext = g / Math.max(R.length(), 1e-6);
      if ((lado || tapa) && i === 0) a0 -= ext;
      if ((lado || tapa) && i === tw - 1) a1 += ext;
      if (tapa && j === 0) c0 -= g / Dd.length();
      if (tapa && j === th - 1) c1 += g / Dd.length();
      const base = new THREE.Vector3(...o);
      const P = (a, c, h) => base.clone().addScaledVector(R, a).addScaledVector(Dd, c).addScaledVector(n, h);
      const uvc = [u + 0.5, v + 0.5, u + 0.5, v + 0.5];       // los lados del cubito: color sólido del pixel
      const uvf = [u + 0.06, v + 0.06, u + 0.94, v + 0.94];
      // cara de afuera
      const tl = P(a0, c0, g);
      cons.quad(tl.toArray(), P(a1, c0, g).sub(tl).toArray(), P(a0, c1, g).sub(tl).toArray(), uvf, pw);
      // lados (solo si el vecino de la misma cara no es opaco)
      const vecino = (di, dj) => { const ii = i + di, jj = j + dj; return ii >= 0 && ii < tw && jj >= 0 && jj < th && opaco(tx + ii, ty + jj) && !(saltar && saltar(nombre, ii, jj)); };
      const lados = [
        [!vecino(0, -1), P(a1, c0, g), P(a0, c0, g)],     // arriba (en la cara)
        [!vecino(0, 1), P(a0, c1, g), P(a1, c1, g)],      // abajo
        [!vecino(-1, 0), P(a0, c0, g), P(a0, c1, g)],     // izquierda
        [!vecino(1, 0), P(a1, c1, g), P(a1, c0, g)],      // derecha
      ];
      for (const [ver, A, B] of lados) {
        if (!ver) continue;
        const abajo = n.clone().multiplyScalar(-g);
        cons.quad(A.toArray(), B.clone().sub(A).toArray(), abajo.toArray(), uvc, pw);
      }
      // mechón: el último renglón de atrás (y de los lados, solo su parte trasera) baja `largo` pixeles
      const esAtras = nombre === "back" || ((nombre === "left" || nombre === "right") && P(a0 + 0.5, c0, 0).z < -1.5);
      if (largo > 0 && j === th - 1 && esAtras && pelo && esPelo) {
        const base0 = P(a0, c1, 0), alto = Math.max(1, Math.round(largo * (0.6 + 0.4 * ((i * 7 + tw) % 3) / 2)));
        const caja = new THREE.Box3().setFromPoints([base0, P(a1, c1, 0).addScaledVector(n, g), P(a1, c1, 0).add(new THREE.Vector3(0, -alto, 0))]);
        voxelCaja(cons, caja, uvc, pw);
      }
    }
  }
  cons.marcar(0);
}

function voxelCaja(cons, c, uv, pesos) {
  const [x0, y0, z0] = c.min.toArray(), [x1, y1, z1] = c.max.toArray();
  const cs = carasCaja(x0, y0, z0, x1, y1, z1);
  for (const n of ORDEN) { const [o, r, d] = cs[n]; cons.quad(o, r, d, uv, pesos); }
}

export function texturaSuave(fuente, escala = 8) {
  const c = document.createElement("canvas");
  c.width = fuente.width * escala; c.height = fuente.height * escala;
  const x = c.getContext("2d"); x.imageSmoothingEnabled = false;
  x.drawImage(fuente, 0, 0, c.width, c.height);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.anisotropy = 8;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// skin: canvas 64x64 normalizado; texturaCara: textura de la cara animada (rostro.js)
// ojosRects: zonas de ojos/boca (8x8) donde NO se ponen voxeles del sombrero (ahí manda el rig de la cara)
export function crearPersonaje(skin, texturaCara, { delgado = false, ojosRects = [], capa3D = true, pelo = { fisica: true, largo: 0 }, capa = null } = {}) {
  const texSkin = texturaSuave(skin);
  const datos = skin.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, 64, 64).data;
  const mat = (o = {}) => new THREE.MeshStandardMaterial({ map: texSkin, roughness: 0.92, metalness: 0, ...o });
  const matBase = mat(), matCapa = mat({ alphaTest: 0.1 });
  const matCara = new THREE.MeshStandardMaterial({ map: texturaCara, roughness: 0.85, metalness: 0 });

  const grupo = new THREE.Group();
  grupo.scale.setScalar(1 / 16);
  const j = {};
  const hueso = (nombre, padre, x, y, z) => { const b = new THREE.Bone(); b.name = nombre; b.position.set(x, y, z); (padre || grupo).add(b); j[nombre] = b; return b; };
  hueso("raiz", null, 0, 12, 0);
  hueso("torso", j.raiz, 0, 0, 0);
  hueso("cabeza", j.torso, 0, 12, 0);
  hueso("brazoD", j.torso, -5, 10, 0); hueso("codoD", j.brazoD, 0, -4, 0); hueso("munecaD", j.codoD, delgado ? -0.5 : -1, -4.5, 0);   // centro del puño (el brazo termina 8 px bajo el codo)
  hueso("brazoI", j.torso, 5, 10, 0); hueso("codoI", j.brazoI, 0, -4, 0);
  hueso("piernaD", j.raiz, -2, 0, 0); hueso("rodillaD", j.piernaD, 0, -6, 0);
  hueso("piernaI", j.raiz, 2, 0, 0); hueso("rodillaI", j.piernaI, 0, -6, 0);
  hueso("pelo", j.cabeza, 0, 8, 0);
  grupo.updateMatrixWorld(true);
  const esqueleto = new THREE.Skeleton([...JUNTAS.map(n => j[n]), j.pelo]);

  // color del pelo: el más común arriba de la cabeza (capa del sombrero, o la base si no hay)
  const colorEn = (u, v) => [datos[(v * 64 + u) * 4], datos[(v * 64 + u) * 4 + 1], datos[(v * 64 + u) * 4 + 2], datos[(v * 64 + u) * 4 + 3]];
  const cuenta = new Map();
  for (const [u0, v0] of [[40, 0], [8, 0]]) {
    for (let v = v0; v < v0 + 8; v++) for (let u = u0; u < u0 + 8; u++) {
      const c = colorEn(u, v); if (c[3] < 128) continue;
      const k = c.slice(0, 3).map(x => x >> 4).join(","); cuenta.set(k, (cuenta.get(k) || 0) + 1);
    }
    if (cuenta.size) break;
  }
  const tonos = [...cuenta.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k.split(",").map(x => +x * 16 + 8));
  const esColorPelo = (u, v) => {
    const c = colorEn(u, v);
    return tonos.some(t => Math.hypot(c[0] - t[0], c[1] - t[1], c[2] - t[2]) < 48);
  };

  const aw = delgado ? 3 : 4;
  const partes = [
    { b: [-4, 12, -2, 4, 24, 2], uv: [16, 16], uvc: [16, 32], d: [8, 12, 4], pesos: pesoFijo("torso"), g: 0.5 },
    { b: [-4, 24, -4, 4, 32, 4], uv: [0, 0], uvc: [32, 0], d: [8, 8, 8], pesos: pesoFijo("cabeza"), g: 0.55, cabeza: true },
    { b: [-4 - aw, 12, -2, -4, 24, 2], uv: [40, 16], uvc: [40, 32], d: [aw, 12, 4], pesos: pesosExtremidad("brazoD", "codoD", 18), g: 0.45 },
    { b: [4, 12, -2, 4 + aw, 24, 2], uv: [32, 48], uvc: [48, 48], d: [aw, 12, 4], pesos: pesosExtremidad("brazoI", "codoI", 18), g: 0.45 },
    { b: [-4, 0, -2, 0, 12, 2], uv: [0, 16], uvc: [0, 32], d: [4, 12, 4], pesos: pesosExtremidad("piernaD", "rodillaD", 6), g: 0.45 },
    { b: [0, 0, -2, 4, 12, 2], uv: [16, 48], uvc: [0, 48], d: [4, 12, 4], pesos: pesosExtremidad("piernaI", "rodillaI", 6), g: 0.45 },
  ];
  const piezas = [];
  const dentro = (r, x, y) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
  for (const p of partes) {
    const cb = new Constructor();
    cajaBase(cb, p.b, rectsCaja(...p.uv, ...p.d), p.pesos, { caraFrente: p.cabeza });
    const base = new THREE.SkinnedMesh(cb.geometria(), p.cabeza ? [matBase, matCara] : matBase);
    const cc = new Constructor();
    const rc = rectsCaja(...p.uvc, ...p.d);
    const conFisica = p.cabeza && pelo?.fisica !== false;
    const pesosCapa = conFisica ? pesosPelo : p.pesos;
    if (capa3D) capaVoxel(cc, p.b, rc, pesosCapa, datos, p.g, {
      saltar: p.cabeza ? (cara, i, k) => cara === "front" && ojosRects.some(r => r && dentro(r, i, k)) : null,
      largo: p.cabeza ? (pelo?.largo || 0) : 0,
      esPelo: conFisica ? esColorPelo : null, pesosFijos: pesoFijo("cabeza"),
    });
    else cajaBase(cc, p.b.map((v, i) => v + (i < 3 ? -p.g / 2 : p.g / 2)), rc, pesosCapa);
    const capa = new THREE.SkinnedMesh(cc.geometria(), matCapa);
    for (const m of [base, capa]) {
      m.bind(esqueleto, grupo.matrixWorld.clone());
      m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;
      grupo.add(m); piezas.push(m);
    }
  }

  // capa de Minecraft (textura de 64×32, como las de NameMC): caja de 10×16×1 que cuelga de los hombros, en la espalda.
  // El pivote está arriba; motor.js decide cuánto se levanta (quieto, caminando, corriendo) y la hace ondear
  let pivoteCapa = null, matCapaMC = null;
  if (capa) {
    const tx = new THREE.CanvasTexture(capa); tx.magFilter = THREE.NearestFilter; tx.minFilter = THREE.NearestFilter;
    tx.generateMipmaps = false; tx.colorSpace = THREE.SRGBColorSpace;
    const g = new THREE.BoxGeometry(10, 16, 1);
    const W = capa.width, H = capa.height, k = W / 64;            // escala del texel (hay capas de 64×32 y de 22×17 ×n)
    const reg = (x0, y0, x1, y1) => [x0 * k / W, 1 - y0 * k / H, x1 * k / W, 1 - y1 * k / H];
    // caras de BoxGeometry: +x, −x, +y, −y, +z (hacia el cuerpo), −z (hacia afuera: el diseño)
    const caras = [reg(11, 1, 12, 17), reg(0, 1, 1, 17), reg(1, 0, 11, 1), reg(11, 0, 21, 1), reg(12, 1, 22, 17), reg(1, 1, 11, 17)];
    const uv = g.attributes.uv;
    caras.forEach(([u0, v0, u1, v1], f) => { uv.setXY(f * 4, u0, v0); uv.setXY(f * 4 + 1, u1, v0); uv.setXY(f * 4 + 2, u0, v1); uv.setXY(f * 4 + 3, u1, v1); });
    uv.needsUpdate = true;
    g.translate(0, -8, -0.5);
    matCapaMC = new THREE.MeshStandardMaterial({ map: tx, roughness: 0.9, alphaTest: 0.1 });
    const m = new THREE.Mesh(g, matCapaMC); m.castShadow = true; m.receiveShadow = true;
    pivoteCapa = new THREE.Object3D(); pivoteCapa.position.set(0, 12, -2.05); pivoteCapa.rotation.x = 0.12;
    pivoteCapa.add(m); j.torso.add(pivoteCapa);
  }

  const reposo = {};
  for (const n of [...JUNTAS, "pelo"]) reposo[n] = j[n].position.clone();

  return {
    grupo, juntas: j, piezas, reposo, esqueleto, capa: pivoteCapa,
    // junta (hueso) dominante en un punto de impacto del raycaster
    juntaDe(hit) {
      const g = hit.object.geometry, a = hit.face.a;
      const si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
      const n = JUNTAS[sw.getX(a) >= sw.getY(a) ? si.getX(a) : si.getY(a)];
      return n || "cabeza";                      // el pelo se posa con la cabeza
    },
    dispose() {
      for (const m of piezas) m.geometry.dispose();
      texSkin.dispose();
      [matBase, matCapa, matCara, matCapaMC].forEach(m => m?.dispose());
    },
  };
}
