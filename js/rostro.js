// Rig de la cara: se configura DÓNDE están los ojos (y la boca, si la skin tiene) sobre la cara de 8x8
// y se dibujan encima ojos animables: párpados, iris que mira, pupila, brillo, cejas opcionales,
// rubor, lágrimas y sudor. Funciona con cualquier skin: los colores se sacan de la propia skin.
import * as THREE from "three";

import * as suave from "./rostro-suave.js";

export const ESTILOS = {
  cuadrado: { nombre: "Animación (pupila cuadrada, como Benly)", s: 32, vector: true },
  suave: { nombre: "Suave HD (iris redondo)", s: 32, vector: true },
  detalle: { nombre: "Pixel fino (x4)", s: 4 },
  pixel: { nombre: "Pixel clásico (x2)", s: 2 },
};

// Parámetros numéricos (se interpolan) y de forma (cambian a la mitad de la transición).
//  abre: párpado de arriba 0 abierto..1 cerrado · incl: + enojado (cae por dentro) / − triste (cae por fuera)
//  inf: párpado de abajo · iris: tamaño del iris · mx,my: mirada extra · cejaY: subir cejas · cejaAng: + enojado
//  forma: normal | arco (^ ^) | linea (cerrado) | apretado (> <) | corazon | estrella
//  boca: linea | sonrisa | sonrisa_abierta | triste | o | ondulada | apretada | gato
const BASE = { abre: 0, incl: 0, inf: 0, iris: 1, mx: 0, my: 0, cejaY: 0, cejaAng: 0, rubor: 0, temblor: 0,
  forma: "normal", boca: "linea", lagrimas: false, sudor: false, brillo: false };

export const EXPRESIONES = {
  neutral:     { nombre: "Neutral" },
  feliz:       { nombre: "Feliz", inf: 0.28, abre: 0.05, cejaY: 0.25, boca: "sonrisa" },
  muy_feliz:   { nombre: "Muy feliz", forma: "arco", cejaY: 0.45, boca: "sonrisa_abierta" },
  ilusionado:  { nombre: "Ilusionado (ojos grandes)", iris: 1.08, cejaY: 0.75, inf: 0.1, boca: "sonrisa_abierta", brillo: true },
  emocionado:  { nombre: "Emocionado (estrellas)", forma: "estrella", iris: 1.1, cejaY: 0.6, boca: "sonrisa_abierta", brillo: true },
  riendo:      { nombre: "Riendo", forma: "apretado", cejaY: 0.3, boca: "sonrisa_abierta", lagrimas: true },
  triste:      { nombre: "Triste", abre: 0.28, incl: -0.85, my: -0.35, cejaY: 0.15, cejaAng: -1, boca: "triste" },
  llorando:    { nombre: "Llorando", abre: 0.35, incl: -0.9, my: -0.4, cejaAng: -1, boca: "ondulada", lagrimas: true },
  enojado:     { nombre: "Enojado", abre: 0.28, incl: 0.95, iris: 0.85, cejaY: -0.4, cejaAng: 1, boca: "apretada" },
  furioso:     { nombre: "Furioso", abre: 0.15, incl: 1, iris: 0.55, cejaY: -0.6, cejaAng: 1, boca: "apretada", temblor: 0.5 },
  sorprendido: { nombre: "Sorprendido", iris: 0.6, cejaY: 0.9, boca: "o" },
  asustado:    { nombre: "Asustado", iris: 0.5, incl: -0.3, cejaY: 0.7, cejaAng: -0.8, boca: "ondulada", sudor: true, temblor: 0.6 },
  sospecha:    { nombre: "Sospecha", abre: 0.45, inf: 0.22, incl: 0.3, mx: 0.6, cejaAng: 0.5, boca: "linea" },
  determinado: { nombre: "Determinado", abre: 0.18, incl: 0.45, cejaAng: 0.6, cejaY: -0.2, boca: "linea" },
  pensativo:   { nombre: "Pensativo", abre: 0.1, mx: 0.55, my: 0.75, cejaY: 0.2, cejaAng: 0.3, boca: "linea" },
  confundido:  { nombre: "Confundido", ojos: [{ abre: 0.32, cejaY: -0.35 }, { iris: 0.8, cejaY: 0.6 }], boca: "ondulada" },
  cansado:     { nombre: "Con sueño", abre: 0.62, incl: -0.25, inf: 0.1, my: -0.2, boca: "linea" },
  aburrido:    { nombre: "Aburrido", abre: 0.5, my: -0.15, mx: -0.4, boca: "linea" },
  avergonzado: { nombre: "Avergonzado", abre: 0.25, incl: -0.45, my: -0.65, mx: -0.3, rubor: 1, cejaAng: -0.6, boca: "ondulada" },
  enamorado:   { nombre: "Enamorado", forma: "corazon", rubor: 1, cejaY: 0.3, boca: "sonrisa" },
  guino:       { nombre: "Guiño", ojos: [{}, { forma: "arco" }], inf: 0.15, boca: "gato" },
  ojos_cerrados: { nombre: "Ojos cerrados", forma: "linea", boca: "linea" },
  dormido:     { nombre: "Dormido", forma: "linea", incl: -0.3, my: -0.3, boca: "o" },
  picaro:      { nombre: "Pícaro", abre: 0.3, inf: 0.25, mx: 0.5, cejaAng: 0.5, ojos: [{ cejaY: 0.4 }, {}], boca: "gato" },
};

export const NUMERICOS = ["abre", "incl", "inf", "iris", "mx", "my", "cejaY", "cejaAng", "rubor", "temblor"];

// Expresión completa por ojo: [ojo 0 (izquierda de la imagen), ojo 1]
export function resolverExpresion(nombre) {
  const e = EXPRESIONES[nombre] || EXPRESIONES.neutral;
  const comun = { ...BASE, ...e };
  delete comun.ojos; delete comun.nombre;
  const ojos = [0, 1].map(i => ({ ...comun, ...(e.ojos?.[i] || {}) }));
  return { ojos, boca: comun.boca, rubor: comun.rubor, lagrimas: comun.lagrimas, sudor: comun.sudor, temblor: comun.temblor };
}

export function mezclarExpresion(a, b, k) {
  const ojos = a.ojos.map((oa, i) => {
    const ob = b.ojos[i], o = {};
    for (const n of NUMERICOS) o[n] = oa[n] + (ob[n] - oa[n]) * k;
    for (const n of ["forma", "lagrimas", "sudor", "brillo", "boca"]) o[n] = k < 0.5 ? oa[n] : ob[n];
    // pasar entre formas distintas cerrando el ojo a la mitad (se ve natural)
    if (oa.forma !== ob.forma) o.abre = Math.max(o.abre, 1 - Math.abs(k - 0.5) * 2);
    return o;
  });
  return {
    ojos, boca: k < 0.5 ? a.boca : b.boca, rubor: a.rubor + (b.rubor - a.rubor) * k,
    lagrimas: k < 0.5 ? a.lagrimas : b.lagrimas, sudor: k < 0.5 ? a.sudor : b.sudor,
    temblor: a.temblor + (b.temblor - a.temblor) * k,
  };
}

// ───────────── configuración y colores automáticos ─────────────
export function configPorDefecto() {
  return {
    ojos: [{ x: 1, y: 4, w: 2, h: 1 }, { x: 5, y: 4, w: 2, h: 1 }],
    boca: null,
    cejas: false,
    brillo: true,
    estilo: "suave",
    delineado: true,
    miradaBase: null,      // null = calculada de la skin
    colores: {},           // vacíos = automáticos
  };
}

const hex = (r, g, b) => "#" + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, "0")).join("");
const rgb = (h) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const luz = ([r, g, b]) => 0.299 * r + 0.587 * g + 0.114 * b;
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const oscurecer = (h, f) => { const c = rgb(h); return hex(c[0] * f, c[1] * f, c[2] * f); };

function pixeles(cara8) {
  const d = cara8.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, 8, 8).data;
  const p = [];
  for (let y = 0; y < 8; y++) { p[y] = []; for (let x = 0; x < 8; x++) { const k = (y * 8 + x) * 4; p[y][x] = [d[k], d[k + 1], d[k + 2], d[k + 3]]; } }
  return p;
}
const dentro = (r, x, y) => r && x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;

// Intenta encontrar los ojos: pixeles que contrastan con la piel en las filas 3-5, una caja por mitad
export function detectarOjos(cara8) {
  const p = pixeles(cara8);
  // piel = color más común en frente y mejillas (filas 1-4, sin las orillas)
  const cuenta = new Map();
  for (let y = 1; y < 5; y++) for (let x = 1; x < 7; x++) { const k = p[y][x].slice(0, 3).join(","); cuenta.set(k, (cuenta.get(k) || 0) + 1); }
  const piel = [...cuenta.entries()].sort((a, b) => b[1] - a[1])[0][0].split(",").map(Number);
  const contraste = (x, y) => p[y]?.[x] && dist(p[y][x], piel) > 60;
  const filaLlena = (y) => [1, 2, 3, 4, 5, 6].every(x => contraste(x, y));      // barba / pelo, no ojos
  const ojos = [[1, 2, 3], [4, 5, 6]].map(cols => {
    let mejor = null;
    for (let y = 2; y <= 5; y++) {
      const px = cols.filter(x => contraste(x, y));
      if (!px.length) continue;
      const claros = px.filter(x => luz(p[y][x]) > 170).length;
      const puntos = px.length + claros * 2 - (filaLlena(y) ? 4 : 0);
      if (!mejor || puntos > mejor.puntos) mejor = { puntos, y, x0: Math.min(...px), x1: Math.max(...px) };
    }
    if (!mejor || mejor.puntos <= 0) return null;
    const { y, x0, x1 } = mejor;
    const cols2 = cols.filter(x => x >= x0 && x <= x1);
    const abajo = y < 6 && cols2.every(x => contraste(x, y + 1)) && !cols2.every(x => contraste(x, y + 2));
    return { x: x0, y, w: x1 - x0 + 1, h: abajo ? 2 : 1 };
  });
  return ojos[0] && ojos[1] ? ojos : null;
}

export function coloresAuto(cara8, cfg) {
  const p = pixeles(cara8);
  const fuera = (x, y) => !cfg.ojos.some(o => dentro(o, x, y)) && !dentro(cfg.boca, x, y);
  const cuenta = new Map();
  for (let y = 2; y < 8; y++) for (let x = 1; x < 7; x++) if (fuera(x, y) && p[y][x][3] > 0) {
    const k = p[y][x].slice(0, 3).join(","); cuenta.set(k, (cuenta.get(k) || 0) + 1);
  }
  const piel = [...cuenta.entries()].sort((a, b) => b[1] - a[1])[0]?.[0].split(",").map(Number) || [240, 200, 170];
  const ojoPx = [];
  for (const o of cfg.ojos) for (let y = o.y; y < o.y + o.h; y++) for (let x = o.x; x < o.x + o.w; x++) ojoPx.push(p[y]?.[x] || [0, 0, 0]);
  const porLuz = [...ojoPx].sort((a, b) => luz(b) - luz(a));
  const claro = porLuz[0], oscuro = porLuz[porLuz.length - 1];
  const hayEsclera = luz(claro) > 170 && luz(claro) - luz(oscuro) > 60;
  const esclera = hayEsclera ? claro : [245, 245, 245];
  const iris = hayEsclera ? oscuro : porLuz[Math.floor(porLuz.length / 2)];
  let pelo = [30, 20, 20];
  for (let y = 0; y < 2; y++) for (let x = 0; x < 8; x++) if (luz(p[y][x]) < luz(pelo) + 200 && p[y][x][3] > 0) { pelo = p[y][x]; y = 9; break; }
  const pielH = hex(...piel);
  return {
    piel: pielH, parpado: oscurecer(pielH, 0.9), esclera: hex(...esclera), iris: hex(...iris),
    pupila: oscurecer(hex(...iris), 0.45), linea: "#1c1718", ceja: oscurecer(hex(...pelo.slice(0, 3)), 0.8),
    boca: "#5a1a1a", rubor: "#ff6f7f",
  };
}

// De qué lado está el iris en la skin original (-1 izquierda .. 1 derecha), por ojo
export function miradaDeSkin(cara8, cfg, colores) {
  const p = pixeles(cara8), es = rgb(colores.esclera);
  return cfg.ojos.map(o => {
    let suma = 0, n = 0;
    for (let y = o.y; y < o.y + o.h; y++) for (let x = o.x; x < o.x + o.w; x++) {
      if (dist(p[y][x], es) > 60) { suma += (x + 0.5 - o.x) / o.w; n++; }
    }
    if (!n || o.w < 2) return 0;
    return Math.max(-1, Math.min(1, (suma / n - 0.5) * 4));
  });
}

// ───────────── el rig ─────────────
const CORAZON = [".X.X.", "XXXXX", "XXXXX", ".XXX.", "..X.."];
const ESTRELLA = ["..X..", ".XXX.", "XXXXX", ".XXX.", "..X.."];
// estrella con volumen (Leo: "rojas y con volumen; así se ven simples"): 7×7 con contorno, luz, sombra y brillo
const ESTRELLA7 = ["...X...", "..XXX..", "XXXXXXX", ".XXXXX.", "..XXX..", ".XX.XX.", "XX...XX"];
function colorEstrella(m, fx, fy) {
  const lleno = (x, y) => m[y]?.[x] === "X";
  if (!lleno(fx - 1, fy) || !lleno(fx + 1, fy) || !lleno(fx, fy - 1) || !lleno(fx, fy + 1)) {
    return fx + fy <= 5 ? "#c4162c" : "#6e0914";                 // contorno: más claro arriba-izquierda, oscuro abajo-derecha
  }
  if (fx === 3 && fy === 2) return "#fff4f0";                      // brillo
  if (fx + fy <= 5) return "#ff5a5f";                              // cara con luz
  if (fx + fy >= 8) return "#a3101f";                              // cara en sombra
  return "#e8213a";
}

export class Rostro {
  constructor() {
    this.canvas = document.createElement("canvas");
    this.ctx = this.canvas.getContext("2d");
    this.textura = new THREE.CanvasTexture(this.canvas);
    this.textura.magFilter = THREE.NearestFilter;
    this.textura.minFilter = THREE.NearestFilter;
    this.textura.generateMipmaps = false;
    this.textura.colorSpace = THREE.SRGBColorSpace;
  }

  configurar(cara8, cfg) {
    this.cara8 = cara8;
    this.cfg = cfg;
    this.col = { ...coloresAuto(cara8, cfg), ...Object.fromEntries(Object.entries(cfg.colores || {}).filter(([, v]) => v)) };
    this.miradaBase = cfg.miradaBase || miradaDeSkin(cara8, cfg, this.col);
    const est = ESTILOS[cfg.estilo] || ESTILOS.suave;
    this.S = est.s;
    this.vector = !!est.vector;
    const firma = this.S + "|" + this.vector;
    if (this._firma !== firma) {
      this._firma = firma;
      this.canvas.width = this.canvas.height = 8 * this.S;
      this.textura.dispose();               // el tamaño cambió: three necesita una textura nueva
      const t = new THREE.CanvasTexture(this.canvas);
      t.colorSpace = THREE.SRGBColorSpace;
      if (this.vector) { t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.anisotropy = 8; }
      else { t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; }
      this.textura = t;
    }
  }

  // estado: {exp (de resolverExpresion/mezclarExpresion), mx, my, parpado 0..1, boca 0..1 (hablar), t}
  dibujar(estado) {
    const { ctx, S } = this, e = estado.exp;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, 8 * S, 8 * S);
    ctx.drawImage(this.cara8, 0, 0, 8 * S, 8 * S);
    for (const r of this.cfg.borrar || []) { ctx.fillStyle = this.col.piel; ctx.fillRect(r.x * S, r.y * S, r.w * S, r.h * S); }
    const t = estado.t || 0;
    const tiembla = e.temblor > 0.05 ? (Math.sin(t * 61) + Math.sin(t * 37)) * 0.5 * e.temblor : 0;
    const v = this.vector ? suave : this;

    this.cfg.ojos.forEach((o, i) => {
      const interior = (o.x + o.w / 2) < 4 ? 1 : -1;            // hacia dónde queda el centro de la cara
      const oe = e.ojos[i];
      v.ojo.call(this, o, oe, interior, {
        mx: THREE.MathUtils.clamp((this.cfg.estilo === "cuadrado" ? 0 : this.miradaBase[i]) + oe.mx + (estado.mx || 0) + tiembla * 0.15, -1, 1),
        my: THREE.MathUtils.clamp(oe.my + (estado.my || 0), -1, 1),
        parpado: estado.parpado || 0,
      });
      if (this.cfg.cejas) v.ceja.call(this, o, oe, interior);
    });
    if (e.rubor > 0.02) v.rubor.call(this, e.rubor);
    if (this.cfg.boca) v.boca.call(this, this.cfg.boca, estado.hablando ? "linea" : e.boca, estado.boca || 0, estado.hablando ? (estado.visema || "M") : null);
    if (e.lagrimas) v.lagrimas.call(this, t);
    if (e.sudor) v.sudor.call(this, t);
    this.textura.needsUpdate = true;
  }

  // rectángulo en unidades de pixel de la skin, redondeado a la rejilla de S
  r(x, y, w, h, color, alfa = 1) {
    const S = this.S;
    const X = Math.round(x * S), Y = Math.round(y * S), W = Math.round((x + w) * S) - X, H = Math.round((y + h) * S) - Y;
    if (W <= 0 || H <= 0) return;
    this.ctx.globalAlpha = alfa;
    this.ctx.fillStyle = color;
    this.ctx.fillRect(X, Y, W, H);
    this.ctx.globalAlpha = 1;
  }

  ojo(o, p, interior, { mx, my, parpado }) {
    const { ctx, S } = this, c = this.col;
    const X = o.x * S, Y = o.y * S, W = o.w * S, H = o.h * S;
    const grueso = Math.max(1, Math.round(S * 0.22));
    ctx.save();
    ctx.beginPath(); ctx.rect(X, Y, W, H); ctx.clip();
    const pielFill = () => { ctx.fillStyle = c.piel; ctx.fillRect(X, Y, W, H); };
    let forma = p.forma;
    const cierre = Math.min(1, p.abre + parpado * (1 - p.abre));
    if (!["arco", "apretado", "linea"].includes(forma) && cierre >= 0.97) forma = "linea";

    if (forma === "linea") {
      pielFill();
      ctx.fillStyle = c.linea;
      const yl = Y + Math.min(H - grueso, Math.round(H * 0.6));
      ctx.fillRect(X, yl, W, grueso);
    } else if (forma === "arco") {
      pielFill();
      ctx.fillStyle = c.linea;
      for (let i = 0; i < W; i++) {
        const u = (i + 0.5) / W, k = 1 - (2 * u - 1) ** 2;
        ctx.fillRect(X + i, Y + Math.round((H - grueso) * (1 - k * 0.9)), 1, grueso);
      }
    } else if (forma === "apretado") {
      pielFill();
      ctx.fillStyle = c.linea;
      const yc = Y + (H - grueso) / 2;
      for (let i = 0; i < W; i++) {
        let u = (i + 0.5) / W; if (interior < 0) u = 1 - u;     // la punta del > < apunta al centro
        const abre = (1 - u) * (H - grueso) / 2;
        ctx.fillRect(X + i, Math.round(yc - abre), 1, grueso);
        ctx.fillRect(X + i, Math.round(yc + abre), 1, grueso);
      }
    } else {
      // esclera
      ctx.fillStyle = c.esclera; ctx.fillRect(X, Y, W, H);
      // iris
      const esc = Math.max(0.3, p.iris);
      const iw = Math.max(1, Math.round(W * (o.w >= 2 ? 0.5 : 0.7) * esc)), ih = Math.max(1, Math.round(H * (o.h >= 2 ? 0.75 : 0.9) * esc));
      const ix = Math.round(X + (W - iw) / 2 + mx * (W - iw) / 2), iy = Math.round(Y + (H - ih) / 2 - my * (H - ih) / 2);
      if (forma === "corazon" || forma === "estrella") {
        const m = forma === "corazon" ? CORAZON : ESTRELLA7, n = m.length;
        const tam = Math.min(W, H + S * 0.6);
        const px = tam / n, x0 = X + (W - tam) / 2 + mx * S * 0.2, y0 = Y + (H - tam) / 2;
        m.forEach((fila, fy) => [...fila].forEach((ch, fx) => {
          if (ch !== "X") return;
          ctx.fillStyle = forma === "corazon" ? "#ff3b5c" : colorEstrella(m, fx, fy);
          ctx.fillRect(Math.round(x0 + fx * px), Math.round(y0 + fy * px), Math.ceil(px), Math.ceil(px));
        }));
      } else {
        ctx.fillStyle = c.iris; ctx.fillRect(ix, iy, iw, ih);
        if (iw >= 3 && ih >= 3) {
          const pw = Math.max(1, Math.round(iw * 0.45)), ph = Math.max(1, Math.round(ih * 0.5));
          ctx.fillStyle = c.pupila; ctx.fillRect(ix + Math.round((iw - pw) / 2), iy + Math.round((ih - ph) / 2), pw, ph);
        }
        if (this.cfg.brillo && iw >= 2 && ih >= 2) {
          const b = Math.max(1, Math.round(Math.min(iw, ih) * (p.brillo ? 0.42 : 0.3)));
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(interior > 0 ? ix + iw - b - (iw > 3 ? 1 : 0) : ix + (iw > 3 ? 1 : 0), iy + (ih > 3 ? 1 : 0), b, b);
          if (p.brillo && iw >= 4) ctx.fillRect(interior > 0 ? ix + 1 : ix + iw - 2, iy + ih - 2, 1, 1);
        }
      }
      // párpados (columna por columna: permite inclinarlos y curvarlos)
      const arriba = [], abajo = [];
      for (let i = 0; i < W; i++) {
        const u = interior > 0 ? (i + 0.5) / W : 1 - (i + 0.5) / W;     // 0 = lado de afuera, 1 = lado de adentro
        const inc = p.incl > 0 ? p.incl * 0.6 * u : -p.incl * 0.6 * (1 - u);
        arriba.push(Math.round(H * THREE.MathUtils.clamp(cierre + (cierre > 0.01 || p.incl ? inc : 0), 0, 1)));
        const curva = p.inf * (0.6 + 0.4 * (1 - (2 * ((i + 0.5) / W) - 1) ** 2));
        abajo.push(Math.round(H * THREE.MathUtils.clamp(curva, 0, 1)));
      }
      for (let i = 0; i < W; i++) {
        const a = arriba[i], b = abajo[i];
        if (a > 0) { ctx.fillStyle = c.parpado; ctx.fillRect(X + i, Y, 1, a); }
        if (b > 0) { ctx.fillStyle = c.parpado; ctx.fillRect(X + i, Y + H - b, 1, b); }
        if (a + b >= H) { ctx.fillStyle = c.linea; ctx.fillRect(X + i, Y + Math.min(H - grueso, a), 1, grueso); continue; }
        if (a > 0) { ctx.fillStyle = c.linea; ctx.fillRect(X + i, Y + a - Math.min(grueso, a), 1, Math.min(grueso, a)); }
      }
    }
    ctx.restore();
  }

  ceja(o, p, interior) {
    const { ctx, S } = this, c = this.col;
    const grueso = Math.max(1, Math.round(S * 0.4));
    const X = o.x * S, W = o.w * S;
    const yBase = o.y * S - grueso - Math.round(S * 0.25) - Math.round(p.cejaY * S * 0.45);
    ctx.fillStyle = c.ceja;
    for (let i = 0; i < W; i++) {
      const u = interior > 0 ? (i + 0.5) / W : 1 - (i + 0.5) / W;
      const y = yBase + Math.round(p.cejaAng * (u - 0.5) * S * 0.7);
      ctx.fillRect(X + i, y, 1, grueso);
    }
  }

  rubor(k) {
    for (const o of this.cfg.ojos) this.r(o.x - 0.15, o.y + o.h + 0.5, o.w + 0.3, 0.5, this.col.rubor, 0.55 * k);
  }

  lagrimas(t) {
    for (const o of this.cfg.ojos) {
      const x = o.x + o.w / 2 - 0.25;
      for (let k = 0; k < 2; k++) {
        const f = ((t * 1.3 + k * 0.5) % 1);
        this.r(x, o.y + o.h + f * (7.6 - o.y - o.h), 0.5, 0.6, "#6fd3ff", 1 - f * 0.6);
      }
      this.r(x, o.y + o.h - 0.1, 0.5, 0.4, "#bdeeff");
    }
  }

  sudor(t) {
    const f = (t * 0.7) % 1;
    this.r(6.6, 1.2 + f * 2.2, 0.5, 0.7, "#8fdcff", 1 - f * 0.5);
    this.r(6.7, 1.1 + f * 2.2, 0.3, 0.3, "#e6f8ff", 1 - f * 0.5);
  }

  boca(b, forma, abierta) {
    const { ctx, S } = this, c = this.col;
    const X = b.x * S, Y = b.y * S, W = b.w * S, H = b.h * S;
    const g = Math.max(1, Math.round(S * 0.3));
    ctx.save();
    ctx.fillStyle = c.piel; ctx.fillRect(X, Y, W, H);
    const yc = Y + Math.round(H / 2 - g / 2);
    const curva = (fn) => { ctx.fillStyle = c.linea; for (let i = 0; i < W; i++) { const u = (i + 0.5) / W; ctx.fillRect(X + i, Math.round(yc + fn(u)), 1, g); } };
    const amp = Math.max(1, H * 0.35);
    if (abierta > 0.12 && forma !== "o") {
      const h = Math.max(g * 2, Math.round(H * Math.min(1, 0.35 + abierta * 0.65)));
      const w = Math.round(W * (forma === "sonrisa_abierta" || forma === "sonrisa" ? 0.8 : 0.6));
      const x0 = X + Math.round((W - w) / 2), y0 = Y + Math.round((H - h) / 2);
      ctx.fillStyle = c.boca; ctx.fillRect(x0, y0, w, h);
      if (h > g * 3) { ctx.fillStyle = "#d9686a"; ctx.fillRect(x0 + Math.round(w * 0.25), y0 + h - g * 1.5, Math.round(w * 0.5), Math.round(g * 1.5)); }
      if (forma === "sonrisa_abierta" || forma === "apretada") { ctx.fillStyle = "#fbf3ec"; ctx.fillRect(x0, y0, w, g); }
      ctx.restore(); return;
    }
    switch (forma) {
      case "linea": ctx.fillStyle = c.linea; ctx.fillRect(X + Math.round(W * 0.2), yc, Math.round(W * 0.6), g); break;
      case "sonrisa": curva(u => -amp * (2 * u - 1) ** 2 + amp / 2); break;
      case "triste": curva(u => amp * (2 * u - 1) ** 2 - amp / 2); break;
      case "ondulada": curva(u => Math.sin(u * Math.PI * 3) * amp * 0.45); break;
      case "gato": curva(u => -Math.abs(Math.sin(u * Math.PI * 2)) * amp * 0.7 + amp * 0.3); break;
      case "sonrisa_abierta": {
        const w = Math.round(W * 0.8), h = Math.max(g * 2, Math.round(H * 0.7));
        const x0 = X + Math.round((W - w) / 2), y0 = Y + Math.round((H - h) / 2);
        ctx.fillStyle = c.boca; ctx.fillRect(x0, y0, w, h);
        ctx.fillStyle = "#fbf3ec"; ctx.fillRect(x0, y0, w, g);
        break;
      }
      case "o": {
        const t = Math.max(g * 2, Math.round(Math.min(W, H) * (0.5 + abierta * 0.4)));
        const x0 = X + Math.round((W - t) / 2), y0 = Y + Math.round((H - t) / 2);
        ctx.fillStyle = c.linea; ctx.fillRect(x0, y0, t, t);
        ctx.fillStyle = c.boca; ctx.fillRect(x0 + g, y0 + g, t - 2 * g, t - 2 * g);
        break;
      }
      case "apretada": {
        const w = Math.round(W * 0.7), x0 = X + Math.round((W - w) / 2);
        ctx.fillStyle = c.linea; ctx.fillRect(x0, yc - g, w, g * 3);
        ctx.fillStyle = "#fbf3ec"; ctx.fillRect(x0 + g, yc, w - 2 * g, g);
        break;
      }
    }
    ctx.restore();
  }

  // miniatura (dataURL) de una expresión
  miniatura(nombre, tam = 64) {
    this.dibujar({ exp: resolverExpresion(nombre), t: 0.3 });
    const out = document.createElement("canvas");
    out.width = out.height = tam;
    const x = out.getContext("2d");
    x.imageSmoothingEnabled = this.vector;
    x.imageSmoothingQuality = "high";
    x.drawImage(this.canvas, 0, 0, tam, tam);
    return out.toDataURL();
  }
}
