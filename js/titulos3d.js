// Títulos 3D del tráiler: como en el original, las letras son geometría extruida dentro del cuadro (cara plana y saturada,
// extrusión más oscura que se ve hacia el centro de la imagen por la perspectiva), con la fuente "Minecraft Ten" de Mojang.
// La fuente la copia herramientas/packs.py de TU Minecraft Bedrock a texturas_mc/packs/fuentes (no se redistribuye);
// si no está, main.js dibuja los títulos en 2D con la fuente pixel de respaldo.
// Campos de un título (pista Títulos): texto, x, y (centro, 0..1), tam (tamaño de letra, % del alto), color (abajo),
// color2 (arriba), sombra (fondo de la extrusión), sombra2 (extrusión junto a la cara), lineasX (desfase de cada línea, em), prof (profundidad de la extrusión, en em), espaciado (em extra entre letras),
// interlinea (em), giro [rx, ry, rz] en grados, vivo (vaivén lento en grados), crece (escala por segundo), dist (bloques frente a la cámara), enEscena (lo tapan los mobs más cercanos
// y le llegan el desenfoque y el brillo de la escena), caja (etiqueta con fondo), fundido {entra, sale}.
import * as THREE from "three";
import { TTFLoader } from "three/addons/loaders/TTFLoader.js";
import { Font } from "three/addons/loaders/FontLoader.js";

const RUTA = "texturas_mc/packs/fuentes/minecraft-ten.ttf";
const D2R = Math.PI / 180;

export class Titulos3D {
  constructor(escenaPrincipal) {
    this.escena = new THREE.Scene();                   // superpuesta: se dibuja encima del cuadro ya procesado
    this.enEscena = new THREE.Group();                 // dentro de la escena (oclusión, desenfoque, brillo)
    escenaPrincipal.add(this.enEscena);
    this.cache = new Map();
    this.fuente = null;
    this.listo = new Promise(r => new TTFLoader().load(RUTA, (json) => { this.fuente = new Font(json); r(true); }, undefined, () => r(false)));
  }

  // geometría de una línea, letra por letra (para poder separar las letras), centrada en x y con la cara al frente en z = 0
  linea(texto, prof, espaciado) {
    const f = this.fuente, res = f.data.resolution, formas = [];
    let x = 0;
    for (const ch of texto) {
      const g = f.data.glyphs[ch] || f.data.glyphs["?"];
      if (!g) continue;
      if (ch !== " ") for (const s of f.generateShapes(ch, 1)) formas.push(trasladar(s, x));
      x += g.ha / res + espaciado;
    }
    const geo = new THREE.ExtrudeGeometry(formas, { depth: prof, bevelEnabled: false, curveSegments: 2 });
    geo.computeBoundingBox();
    const b = geo.boundingBox;
    geo.translate(-(b.min.x + b.max.x) / 2, 0, -prof);
    return geo;
  }

  // malla de un título (se arma una vez por texto y estilo)
  armar(x) {
    const clave = JSON.stringify([x.texto, x.prof, x.espaciado, x.interlinea, x.color, x.color2, x.sombra, x.sombra2, x.caja, x.lineasX]);
    if (this.cache.has(clave)) return this.cache.get(clave);
    const prof = x.prof ?? 0.28, esp = x.espaciado ?? 0, paso = x.interlinea ?? 0.8;
    const lineas = String(x.texto || "").split("\n");
    const cara = new THREE.Color(x.color || "#ffffff"), cara2 = new THREE.Color(x.color2 || x.color || "#ffffff");
    const lado = new THREE.Color(x.sombra || "#333333"), lado2 = x.sombra2 ? new THREE.Color(x.sombra2) : lado.clone().lerp(cara, 0.18);
    const mats = [new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, transparent: true }),
      new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, transparent: true })];
    const grupo = new THREE.Group();
    // alto de las mayúsculas (para centrar el bloque de líneas y para el degradado)
    const H = this.altoMayus();
    lineas.forEach((l, i) => {
      const geo = this.linea(l, prof, esp);
      const y0 = ((lineas.length - 1) / 2 - i) * paso - H / 2;
      geo.translate(x.lineasX?.[i] ?? 0, y0, 0);
      // colores: cara con degradado vertical (color2 arriba → color abajo); lados más claros al frente y oscuros atrás
      const pos = geo.attributes.position, col = new Float32Array(pos.count * 3), c = new THREE.Color();
      // (ExtrudeGeometry hace un par de grupos por letra: materialIndex 0 = caras, 1 = lados)
      for (const gr of geo.groups) for (let k = gr.start; k < gr.start + gr.count; k++) {
        if (gr.materialIndex === 1) c.copy(lado2).lerp(lado, Math.min(1, -pos.getZ(k) / prof));
        else c.copy(cara).lerp(cara2, Math.max(0, Math.min(1, (pos.getY(k) - y0) / H)));
        col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
      }
      geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
      grupo.add(new THREE.Mesh(geo, mats));
    });
    if (x.caja) {                                          // etiqueta con fondo (tarjeta final): caja plana detrás
      // medido en la tarjeta del original: 0.41 em a los lados, 0.27 arriba, 0.35 abajo y una franja oscura de 0.33 em
      const bb = new THREE.Box3().setFromObject(grupo), w = bb.max.x - bb.min.x + 0.82, arriba = bb.max.y + 0.27, abajo = bb.min.y - 0.35;
      const caja = new THREE.Mesh(new THREE.BoxGeometry(w, arriba - abajo, 0.3), new THREE.MeshBasicMaterial({ color: x.caja, toneMapped: false, transparent: true }));
      caja.position.set(0, (arriba + abajo) / 2, -prof - 0.15);
      const pie = new THREE.Mesh(new THREE.BoxGeometry(w, 0.33, 0.3), new THREE.MeshBasicMaterial({ color: x.cajaSombra || "#8c0d10", toneMapped: false, transparent: true }));
      pie.position.set(0, abajo - 0.165, -prof - 0.15);
      grupo.add(caja, pie);
    }
    grupo.matrixAutoUpdate = false;
    const r = { grupo, mats: [...mats, ...grupo.children.filter(m => m.material && !Array.isArray(m.material)).map(m => m.material)] };
    this.cache.set(clave, r);
    return r;
  }

  altoMayus() {
    if (this._H) return this._H;
    const pts = this.fuente.generateShapes("H", 1)[0].getPoints();
    this._H = Math.max(...pts.map(p => p.y)) - Math.min(...pts.map(p => p.y));
    return this._H;
  }

  // coloca los títulos activos (lista de main.js → textosEn) frente a la cámara
  poner(textos, camara) {
    for (const r of this.cache.values()) r.grupo.visible = false;
    if (!this.fuente) return;
    camara.updateMatrixWorld();
    const alto = 2 * Math.tan(camara.fov * D2R / 2), aspecto = camara.aspect;
    for (const x of textos) {
      const f = x.fundido || {};
      let a = 1;
      if (f.entra) a = Math.min(a, x.tau / f.entra);
      if (f.sale) a = Math.min(a, (x.dur - x.tau) / f.sale);
      if (a <= 0) continue;
      const r = this.armar(x);
      const destino = x.enEscena ? this.enEscena : this.escena;
      if (r.grupo.parent !== destino) destino.add(r.grupo);
      for (const m of r.mats) m.opacity = Math.min(1, a);
      // vivo: vaivén lento en grados (que la tarjeta nunca quede congelada) · crece: aumento de escala por segundo (acercamiento lento)
      const D = x.dist ?? 6, tamMundo = (x.tam ?? 13) / 100 * alto * D * (1 + (x.crece ?? 0) * (x.tau || 0));
      const pos = new THREE.Vector3(((x.x ?? 0.5) * 2 - 1) * D * alto / 2 * aspecto, (1 - 2 * (x.y ?? 0.5)) * D * alto / 2, -D);
      const v = x.vivo ?? 0, tt = x.tau || 0;
      const gi = (x.giro || [0, 0, 0]).map((g, j) => g + v * [Math.sin(tt * 0.9 + 0.5), 1.4 * Math.sin(tt * 0.7), 0.4 * Math.sin(tt * 1.1)][j]);
      const local = new THREE.Matrix4().compose(pos, new THREE.Quaternion().setFromEuler(new THREE.Euler(gi[0] * D2R, gi[1] * D2R, gi[2] * D2R, "YXZ")), new THREE.Vector3(tamMundo, tamMundo, tamMundo));
      r.grupo.matrix.multiplyMatrices(camara.matrixWorld, local);
      r.grupo.matrixWorldNeedsUpdate = true;
      r.grupo.visible = true;
    }
  }

  // dibuja los títulos superpuestos encima de lo que ya hay en el lienzo (sin borrar el color)
  dibujar(renderer, camara) {
    if (!this.escena.children.some(g => g.visible)) return;
    const auto = renderer.autoClear;
    renderer.autoClear = false;
    renderer.setRenderTarget(null);
    renderer.state.buffers.depth.setMask(true);         // la última pasada del post-proceso la deja apagada y no se limpiaba
    renderer.clearDepth();
    // dos pasadas: primero solo la profundidad y luego el color de la superficie más cercana. Así, en los fundidos (letras
    // semitransparentes) no se ven a través de la cara los costados y el fondo de la extrusión (se veían "deformes")
    const mats = new Set();
    this.escena.traverse(o => { if (o.isMesh && o.visible) for (const m of [].concat(o.material)) mats.add(m); });
    for (const m of mats) { m.colorWrite = false; m.depthWrite = true; m.depthFunc = THREE.LessEqualDepth; }
    renderer.render(this.escena, camara);
    for (const m of mats) { m.colorWrite = true; m.depthWrite = false; }
    renderer.render(this.escena, camara);
    for (const m of mats) m.depthWrite = true;
    renderer.autoClear = auto;
  }
}

// copia de una forma movida en x (las formas de la fuente salen en el origen)
function trasladar(s, dx) {
  const m = new THREE.Matrix3().makeTranslation(dx, 0);
  const n = new THREE.Shape(s.getPoints().map(p => p.clone().applyMatrix3(m)));
  n.holes = s.holes.map(h => new THREE.Path(h.getPoints().map(p => p.clone().applyMatrix3(m))));
  return n;
}
