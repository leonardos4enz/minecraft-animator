// Efectos visuales por toma (divulgación, tráileres): partículas, flechas de fuerza, trayectorias, rejillas, barras,
// etiquetas 3D con Minecraft Ten, destellos con bloom, cámara lenta y un Tesla Roadster de bloques con propulsores.
// Todo es función del tiempo de la toma (sin estado guardado entre cuadros): sale igual en la vista previa, en `hoja` y
// al exportar (las 9 muestras del desenfoque de movimiento caen en el mismo lugar).
//
// Campo `efectos` de la toma: lista de {tipo, …}. Posiciones [x, y, z] en bloques, relativas al ancla de la toma (como los
// mobs; y = 0 es el piso del escenario). Colores: "#rrggbb" o [r, g, b] lineal (más de 1 = brilla con el bloom).
// Campos comunes: desde / hasta (s de la toma), entra / sale (fundido, s), sigue: "auto" (pos y dir en el marco del Roadster:
// +z adelante, +y arriba, +x a su izquierda).
//   roadster   claves [[t, x, y, z, rumbo, cabeceo, alabeo], …] (grados; rumbo 0 = hacia +z; cabeceo + = nariz arriba;
//              alabeo + = gira hacia la izquierda). chorros [[t0, t1, grupo, fuerza]] (grupos: atras, abajo, abajo_izq,
//              abajo_der, frente), succion [[t0, t1]] (ventiladores), humo [[t0, t1]] (llantas que patinan),
//              giroRuedas [[t0, t1, rad/s]], chispas [t, …], polvo (true), estela [{punto, color, largo, ancho}],
//              color, sinTecho, ala (alerón: 0..1 o [[t, v]]), modelo ("ruta.glb": un modelo glTF en lugar del de bloques),
//              camara {retraso, ofs, rot} (la cámara de la toma apunta al auto), conActor {pos, rot} (LTezla sentado en el auto)
//   particulas estilo (gas, chispas, polvo, humo, destellos, estela, nucleo, aire), forma (pixel = sprite de 8×8 que se
//              encoge como las partículas de Minecraft · cuadro · suave), pos, area [ax, ay, az], dir, abre (°),
//              vel, tasa (/s), vida, tam, crece, g, arrastre, color, color2, alfa, suelo, rafaga {t, n} (todas a la vez)
//   flecha     pos, dir, largo (número o [[t, v], …]), color, grosor, crece (s), texto, tamTexto, colorTexto
//   trayectoria puntos [[x, y, z], …] o auto [t0, t1] (camino del Roadster), punto (en el auto), color, ancho,
//              dibuja [t0, t1] (se traza de a poco), punteado (cubitos), cabeza (punto brillante al final)
//   rejilla    pos, tam [w, h], paso, plano (xz | xy | zy), color, grosor, giro (°)
//   barra      pos, ancho, alto, valor (0..1 o [[t, v], …]), color, giro (°; sin giro queda de frente a la cámara)
//   texto      texto (con {v} para un número que cambia: valor [[t, v]], dec), pos, tam (bloques), color, color2, sombra,
//              sombra2, prof, giro (° fijo; sin giro mira a la cámara), encima (true: no lo tapa nada), anim (golpe)
//   destello   t, pos, tam, color, dur, anillo (radio de una onda en el piso)
//   rampa      pos, rumbo, radio, angulo, ancho (cuarto de tubo para saltar: mismo arco que usa agente/roadster.py)
//   voxel      un objeto hecho de bloques (lo que sea: teléfono, ballena, cohete, trofeo…). cajas [[x, y, z, w, h, d, color,
//              brilla?], …] en bloques (x, z centrados en el origen del objeto, y = 0 su base; brilla > 0 = no recibe luz y
//              brilla con el bloom), pos, giro (° o [[t, °]]), gira (°/s), escala, flota (amplitud en bloques), pop (s: entra
//              creciendo con rebote), sombra (true). Los arma tiktok/motor/modelos.py (biblioteca en tiktok/modelos/).
//   notas      bloques musicales que suenan: golpes [[t, x, y, z, clics], …] ordenados por t (x, y, z = el bloque, enteros
//              relativos al ancla redondeada, como `bloques` con relativo; clics 0–24 = el tono, null = percusión blanca).
//              Cada golpe: destello del bloque (pulso, 0.2 s) + la nota de Minecraft con el color de su tono (vida 0.7 s, tam).
//              construye: true = además deja el bloque musical puesto desde su cuadro (pop de 2 cuadros, brillo `tenue` 0.18).
//              archivo: "ruta.json" con {golpes: [...]} en lugar de `golpes` (miles de golpes sin inflar el proyecto)
//   ecualizador pilas de bloques musicales por columna que suben y bajan con las notas recientes (ver ecualizador()).
//              archivo | golpes, desfase, z, prof, ventana, escala, max, tam
//              desfase: s que se suman al tiempo de la toma (golpes en el tiempo de la canción: desfase = inicio de la toma)
//   cuadro     una imagen en el mundo (pintura, pantalla, cartel): imagen ("tiktok/imagenes/x.png", ruta del servidor),
//              pos (centro), ancho (bloques; el alto sale de la imagen), giro (° fijo; sin giro mira a la cámara), marco
//              (true | "#color": marco de madera como las pinturas de Minecraft), pixel (true: sin suavizado), luz (1: sin
//              sombras, se lee siempre; > 1 brilla como pantalla), pop (s). Se precarga con precargarEfectos (sale en hoja y export).
//   filtro     filtros de Minecraft sobre toda la imagen (los Super Secret Settings de la 1.8 y estados del juego): modo
//              (invert, creeper, spider, sobel, pencil, bits, deconverge, wobble, ntsc, flip, nausea, oscuridad, nieve, vision)
//              con desde/hasta, o cambios [[t, modo | null, fuerza?], …] (vale el último con t ≤ tiempo). fuerza (0..1)
//   impacto    impact frames: golpes [t | [t, color, cx, cy], …]; en cada golpe `cuadros` (2) cuadros a 30 fps: el primero
//              silueta negra sobre blanco con líneas radiales de pixeles, el segundo invertido con la silueta del color.
//              fases ([1, 2]), color, centro [u, v] (0..1 en pantalla, de donde salen las líneas; sin centro, desde LTezla),
//              pixel (6 px por celda), soloActor (true: la silueta es LTezla y los mobs; false: también los efectos)
//   paleta     el mundo cambia de familia de bloques: cambios [[t, nombre | [oscuro, claro] | null], …] (nombres en PALETAS:
//              nether, end, rosa, azul, verde, oro, prismarina, roja, hielo, obsidiana, naranja, lila). mezcla (1)
//   fragmentos pedazos de bloque que saltan (como al romper un bloque en Minecraft): golpes [[t, x, y, z, n?], …],
//              textura (ruta del servidor; por defecto el bloque musical), vel, vida, tam, g, color
//   sacude    sacudida de cámara y golpe de zoom: golpes [[t, fuerza?], …] (fuerza 1 = fuerte; decae en `dura` 0.35 s),
//              zoom (0.12: el fov se cierra un 12 % y vuelve), giro (° de ladeo máximo). Va con el impacto en el mundo
//   notas: además anillo (radio: una onda del color de la nota sobre el bloque), rayo (alto: un haz de luz que sale del
//              bloque hacia arriba) y chispas (n: pixeles brillantes que saltan del bloque), en cada golpe
//   real: true en cualquier efecto = usa el tiempo real de la toma aunque `tiempo` la congele (las notas siguen sonando
//              y poniendo bloques mientras la explosión queda suspendida y la cámara gira)
//   (filtro, impacto, paleta y fragmentos aceptan `desfase`: s que se suman al tiempo de la toma, para usar tiempos de la canción)
// Campos de la toma: `tiempo` [[real, simulado], …] = cámara lenta o congelar (los mobs y los efectos usan el tiempo
// simulado; la cámara y LTezla siguen en tiempo real) · `brillo` = multiplica el bloom de la toma.
import * as THREE from "three";

const D2R = Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const suave = (u) => u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u);
function azar(a, b) {                      // hash entero → [0, 1)
  let h = Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
// número o curva [[t, v], …] (lineal por tramos)
export function valor(v, t, def = 0) {
  if (v == null) return def;
  if (!Array.isArray(v) || !Array.isArray(v[0])) return v;
  if (t <= v[0][0]) return v[0][1];
  for (let i = 1; i < v.length; i++) if (t < v[i][0]) { const [a, x] = v[i - 1], [b, y] = v[i]; return x + (y - x) * (t - a) / (b - a); }
  return v[v.length - 1][1];
}
// tiempo simulado de la toma (cámara lenta / congelar): [[real, simulado], …]; fuera de la lista corre a velocidad normal
export function tiempoSim(lista, tau) {
  if (!lista?.length) return tau;
  if (tau <= lista[0][0]) return lista[0][1] + (tau - lista[0][0]);
  for (let i = 1; i < lista.length; i++) if (tau < lista[i][0]) { const [a, x] = lista[i - 1], [b, y] = lista[i]; return x + (y - x) * (tau - a) / (b - a); }
  const [a, x] = lista[lista.length - 1]; return x + (tau - a);
}
// ── imágenes de los cuadros: se cargan antes de dibujar (precargarEfectos, desde mobs.precargar) para que la hoja y la
// exportación nunca saquen un cuadro vacío
const IMAGENES = new Map();                // ruta → {tex, aspecto, listo}
function imagenCuadro(ruta, pixel) {
  const clave = ruta + (pixel ? "|p" : "");
  if (!IMAGENES.has(clave)) {
    const o = { tex: null, aspecto: 1 };
    o.listo = new THREE.TextureLoader().loadAsync(ruta).then((tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      if (pixel) { tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false; }
      o.tex = tex; o.aspecto = tex.image.width / tex.image.height;
    }).catch((err) => console.warn("cuadro:", ruta, err));
    IMAGENES.set(clave, o);
  }
  return IMAGENES.get(clave);
}
// un golpe de `notas` construido: [t, x, y, z, clics, w?, h?, d?, color?, hasta?]. Sin w/h/d es un bloque; con ellos, una
// figura de w×h×d bloques (x, y, z = su esquina de abajo). color: 0xRRGGBB que tiñe la textura (null = sin teñir);
// hasta: segundo en que desaparece (el creeper que explota). s = escala del pop (crece desde la base)
const M_GOLPE = new THREE.Matrix4();
function ponGolpe(m, i, gi, s) {
  const x = gi[1], y = gi[2], z = gi[3], w = gi[5] ?? 1, h = gi[6] ?? 1, d = gi[7] ?? 1;
  m.setMatrixAt(i, M_GOLPE.makeScale(s * w, s * h, s * d).setPosition(x + w / 2, y + s * h / 2, z + d / 2));
}
const TEX_MUSICAL = "texturas_mc/packs/barebones/block/note_block.png";
// golpes de `notas` guardados en un archivo ({golpes: [...]}): miles de golpes sin inflar el proyecto
const ARCH_GOLPES = new Map();
function golpesArchivo(ruta) {
  if (!ARCH_GOLPES.has(ruta)) {
    const o = { golpes: null };
    o.listo = fetch(ruta).then(r => r.json()).then(d => { o.golpes = d.golpes; }).catch(err => console.warn("notas:", ruta, err));
    ARCH_GOLPES.set(ruta, o);
  }
  return ARCH_GOLPES.get(ruta);
}
export function precargarEfectos(escenas) {
  const todos = (escenas || []).flatMap(e => e.efectos || []);
  const lista = todos.filter(e => (e.tipo === "cuadro" && e.imagen) || e.tipo === "fragmentos").map(e => e.tipo === "fragmentos" ? { imagen: e.textura || TEX_MUSICAL, pixel: true } : e);
  const notas = todos.filter(e => e.tipo === "notas" || e.tipo === "ecualizador");
  const musical = notas.some(e => e.construye || e.tipo === "ecualizador") ? [imagenCuadro(TEX_MUSICAL, true).listo] : [];
  const archivos = [...new Set(notas.filter(e => e.archivo).map(e => e.archivo))].map(r => golpesArchivo(r).listo);
  return Promise.all([...lista.map(e => imagenCuadro(e.imagen, e.pixel).listo), ...musical, ...archivos]);
}
// geometría de un objeto de bloques: una malla con color por vértice (lo que brilla va en otra, sin luz)
function geoVoxel(cajas, brillan) {
  const pos = [], nor = [], col = [], c = new THREE.Color();
  const caras = [[[1, 0, 0], [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]]], [[-1, 0, 0], [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]]],
    [[0, 1, 0], [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]]], [[0, -1, 0], [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]]],
    [[0, 0, 1], [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]]], [[0, 0, -1], [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]]]];
  for (const [x, y, z, w, h, d, colr = "#cccccc", br = 0] of cajas) {
    if ((br > 0) !== brillan) continue;
    c.set(colr); if (br > 0) c.multiplyScalar(br);
    for (const [n, q] of caras) {
      const v = q.map(([a, b, e]) => [x - w / 2 + a * w, y + b * h, z - d / 2 + e * d]);
      for (const k of [0, 1, 2, 0, 2, 3]) { pos.push(...v[k]); nor.push(...n); col.push(c.r, c.g, c.b); }
    }
  }
  if (!pos.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  return g;
}
function huella(x) {                       // hash corto de un JSON (las cajas pueden ser miles)
  const s = JSON.stringify(x); let h = 0;
  for (let i = 0; i < s.length; i++) h = Math.imul(h, 31) + s.charCodeAt(i) | 0;
  return s.length + ":" + h;
}
// entrar creciendo con rebote (pop) desde `desde`
function escalaPop(e, t) {
  if (!e.pop) return 1;
  const u = clamp((t - (e.desde ?? 0)) / e.pop, 0, 1), c1 = 1.70158;          // "ease out back": pasa de 1 y vuelve
  return Math.max(0.001, 1 + (c1 + 1) * (u - 1) ** 3 + c1 * (u - 1) ** 2);
}

function visible(e, t) {
  const d = e.desde ?? -1e9, h = e.hasta ?? 1e9;
  if (t < d || t > h) return 0;
  let a = 1;
  if (e.entra) a = Math.min(a, (t - d) / e.entra);
  if (e.sale && e.hasta != null) a = Math.min(a, (h - t) / e.sale);
  return clamp(a, 0, 1);
}
// dirección que cambia: [[t, [x, y, z]], …] (gira suave de una a otra)
function vecCurva(v, t) {
  if (t <= v[0][0]) return v3(v[0][1]);
  for (let i = 1; i < v.length; i++) if (t < v[i][0]) { const u = suave((t - v[i - 1][0]) / (v[i][0] - v[i - 1][0])); return v3(v[i - 1][1]).normalize().lerp(v3(v[i][1]).normalize(), u); }
  return v3(v[v.length - 1][1]);
}
const color = (c, k = 1) => Array.isArray(c) ? new THREE.Color(c[0] * k, c[1] * k, c[2] * k) : new THREE.Color(c || "#ffffff").multiplyScalar(k);
const v3 = (a, d = [0, 0, 0]) => new THREE.Vector3(...(a || d));

// ───────────── partículas: cuatro nubes compartidas (aditiva/normal × cuadrada/suave) que se llenan en cada cuadro ─────────────
const VS_P = `attribute vec3 col; attribute float alfa; attribute float tam; attribute float fr; uniform float escala; varying vec3 vC; varying float vA; varying float vF;
  void main(){ vC = col; vA = alfa; vF = fr; vec4 mv = modelViewMatrix * vec4(position, 1.); gl_Position = projectionMatrix * mv; gl_PointSize = tam * escala / max(0.05, -mv.z); }`;
const FS_P = `uniform float cuadro; uniform sampler2D atlas; varying vec3 vC; varying float vA; varying float vF;
  void main(){ vec2 d = gl_PointCoord - 0.5; vec3 c = vC; float a;
    if (cuadro > 2.5) { vec2 o = vec2(mod(vF, 4.), floor(vF / 4.)) / 4.; vec4 px = texture2D(atlas, o + vec2(gl_PointCoord.x, 1. - gl_PointCoord.y) * 0.25); if (px.a < 0.5) discard; c *= px.rgb; a = 1.; }
    else if (cuadro > 1.5) { vec4 px = texture2D(atlas, vec2((vF + gl_PointCoord.x) / 8., 1. - gl_PointCoord.y)); if (px.a < 0.5) discard; c *= px.rgb; a = 1.; }
    else a = cuadro > 0.5 ? 1. - smoothstep(0.36, 0.5, max(abs(d.x), abs(d.y))) : exp(-dot(d, d) * 13.);
    a *= vA; if (a < 0.004) discard; gl_FragColor = vec4(c, a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;
// atlas de 8 cuadros de 8×8 (como generic_0..7 de Minecraft): una mancha de pixeles blancos con sombra gris que se encoge
function atlasPixel() {
  const c = document.createElement("canvas"); c.width = 64; c.height = 8;
  const x = c.getContext("2d");
  for (let f = 0; f < 8; f++) {
    const r = 0.9 + f * 0.45;
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
      const dx = i + 0.5 - 4, dy = j + 0.5 - 4, d = Math.hypot(dx, dy) + (azar(i * 7 + f, j * 3) - 0.5) * 0.7;
      if (d > r) continue;
      const luz = dx + dy < -r * 0.4 ? 255 : dx + dy > r * 0.55 ? 178 : 226;           // arriba a la izquierda más claro
      x.fillStyle = `rgb(${luz},${luz},${luz})`; x.fillRect(f * 8 + i, j, 1, 1);
    }
  }
  const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
let ATLAS = null;
// partícula de nota de los bloques musicales (la corchea de Minecraft, 8×8 en blanco: se tiñe con el color del tono)
function atlasNota() {
  const c = document.createElement("canvas"); c.width = 64; c.height = 8;
  const x = c.getContext("2d");
  const forma = ["...###..", "...#.##.", "...#..#.", "...#....", ".###....", "####....", "####....", ".##....."];
  forma.forEach((fila, j) => [...fila].forEach((ch, i) => { if (ch === "#") { x.fillStyle = "#fff"; x.fillRect(i, j, 1, 1); } }));
  const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
// color de la nota según los clics del bloque (0–24), la fórmula de NoteParticle de Minecraft
function colorNota(clics) {
  const f = clics / 24, k = (o) => Math.max(0, Math.sin((f + o) * Math.PI * 2) * 0.65 + 0.35);
  return [k(0), k(1 / 3), k(2 / 3)];
}
class Nube {
  constructor(max, aditiva, cuadrada, escala, atlas = null) {
    this.max = max; this.n = 0;
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 3); this.alfa = new Float32Array(max); this.tam = new Float32Array(max); this.fr = new Float32Array(max);
    g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("col", new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("alfa", new THREE.BufferAttribute(this.alfa, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("tam", new THREE.BufferAttribute(this.tam, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("fr", new THREE.BufferAttribute(this.fr, 1).setUsage(THREE.DynamicDrawUsage));
    ATLAS ||= atlasPixel();
    this.obj = new THREE.Points(g, new THREE.ShaderMaterial({ uniforms: { escala, atlas: { value: atlas || ATLAS }, cuadro: { value: cuadrada === "trozo" ? 3 : cuadrada === "pixel" ? 2 : cuadrada ? 1 : 0 } }, vertexShader: VS_P, fragmentShader: FS_P,
      transparent: true, depthWrite: false, blending: aditiva ? THREE.AdditiveBlending : THREE.NormalBlending }));
    this.obj.frustumCulled = false; this.obj.renderOrder = aditiva ? 6 : 5;
  }
  poner(x, y, z, r, g, b, a, s, fr = 0) {
    if (this.n >= this.max || a < 0.004) return;
    const i = this.n++;
    this.fr[i] = fr;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.col[i * 3] = r; this.col[i * 3 + 1] = g; this.col[i * 3 + 2] = b; this.alfa[i] = a; this.tam[i] = s;
  }
  fin() {
    const g = this.obj.geometry;
    for (const k of ["position", "col", "alfa", "tam", "fr"]) g.attributes[k].needsUpdate = true;
    g.setDrawRange(0, this.n);
    this.obj.visible = this.n > 0;
  }
}

// estilos de partículas (cada campo se puede cambiar en el efecto)
const ESTILOS = {
  gas: { color: [1, 1, 1], color2: [0.92, 0.94, 0.97], alfa: 0.9, tam: 0.42, crece: 2.6, vida: 1.3, vel: 16, abre: 11, arrastre: 3.0, g: 0.3, tasa: 55, aditivo: false, forma: "pixel", grises: 0.22 },
  nucleo: { color: [1.6, 2.6, 3.4], color2: [0.8, 1.6, 2.8], alfa: 1, tam: 0.2, crece: 0.8, vida: 0.1, vel: 30, abre: 5, arrastre: 0, g: 0, tasa: 260, aditivo: true, forma: "cuadro" },
  chispas: { color: [5, 2.6, 0.7], color2: [2.2, 0.5, 0.1], alfa: 1, tam: 0.07, crece: 0.6, vida: 0.55, vel: 7, abre: 70, arrastre: 0.6, g: -14, tasa: 90, aditivo: true, forma: "cuadro" },
  polvo: { color: [0.66, 0.57, 0.44], color2: [0.74, 0.67, 0.56], alfa: 0.9, tam: 0.3, crece: 1.8, vida: 1.3, vel: 2.2, abre: 50, arrastre: 2.2, g: 0.25, tasa: 40, aditivo: false, forma: "pixel" },
  humo: { color: [0.9, 0.9, 0.9], color2: [0.55, 0.55, 0.57], alfa: 0.9, tam: 0.45, crece: 2.4, vida: 2.0, vel: 2.5, abre: 45, arrastre: 1.6, g: 0.6, tasa: 45, aditivo: false, forma: "pixel" },
  destellos: { color: [3, 2.8, 1.6], color2: [2, 1.2, 3], alfa: 1, tam: 0.12, crece: 0.3, vida: 0.9, vel: 0.6, abre: 180, arrastre: 1, g: 0.3, tasa: 30, aditivo: true, forma: "cuadro", titila: true },
  estela: { color: [2.5, 0.5, 0.3], color2: [1, 0.1, 0.1], alfa: 0.9, tam: 0.18, crece: 0.2, vida: 0.5, vel: 0.2, abre: 180, arrastre: 1, g: 0, tasa: 120, aditivo: true, forma: "suave" },
  aire: { color: [0.6, 2.2, 3], color2: [0.3, 1.2, 2.4], alfa: 0.8, tam: 0.07, crece: 0.4, vida: 0.4, vel: 4, abre: 10, arrastre: 0, g: 0, tasa: 140, aditivo: true, forma: "cuadro" },
};

// ───────────── Roadster 2026 (presentado el 15 oct 2026): blanco "de nave espacial", todo planos y ángulos (estilo
// Cybertruck / SR-71), vidrio cobrizo como visor de traje espacial, faros triangulares, barra de luz atrás, alerón activo
// y cuatro toberas en el difusor. ≈ 4.5 × 1.96 × 1.12 bloques. Con `modelo: "ruta.glb"` usa un modelo glTF en su lugar.
const TOBERAS = {
  atras: [[0.26, 0.31, -2.29], [-0.26, 0.31, -2.29], [0.62, 0.31, -2.29], [-0.62, 0.31, -2.29]].map(p => [p, [0, 0, -1]]),
  abajo_izq: [[0.66, 0.17, 1.92], [0.66, 0.17, -1.92]].map(p => [p, [0, -1, 0]]),
  abajo_der: [[-0.66, 0.17, 1.92], [-0.66, 0.17, -1.92]].map(p => [p, [0, -1, 0]]),
  frente: [[0.78, 0.31, 2.26], [-0.78, 0.31, 2.26]].map(p => [p, [0, 0, 1]]),
};
TOBERAS.abajo = [...TOBERAS.abajo_izq, ...TOBERAS.abajo_der];
const VENTILADORES = [[0.45, 0.16, 0.6], [-0.45, 0.16, 0.6], [0.45, 0.16, -0.6], [-0.45, 0.16, -0.6]];
const RUEDA = 0.36;

function texturaPixel(base, varia, n = 16, semilla = 1) {
  const c = document.createElement("canvas"); c.width = c.height = n;
  const x = c.getContext("2d"), b = new THREE.Color(base);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const k = 1 + (azar(i * 31 + semilla, j * 17) - 0.5) * varia;
    x.fillStyle = `rgb(${clamp(b.r * 255 * k, 0, 255) | 0},${clamp(b.g * 255 * k, 0, 255) | 0},${clamp(b.b * 255 * k, 0, 255) | 0})`; x.fillRect(i, j, 1, 1);
  }
  const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace; t.generateMipmaps = false;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
// perfil lateral [[z, y], …] extruido a lo ancho (x), con las aristas biseladas en un solo plano
function geoPerfil(perfil, ancho, bisel = 0.05) {
  const s = new THREE.Shape(perfil.map(([z, y]) => new THREE.Vector2(z, y)));
  const g = new THREE.ExtrudeGeometry(s, { depth: ancho - 2 * bisel, bevelEnabled: bisel > 0, bevelThickness: bisel, bevelSize: bisel, bevelSegments: 1, curveSegments: 1 });
  g.applyMatrix4(new THREE.Matrix4().set(0, 0, -1, ancho / 2 - bisel, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1));
  const p = g.attributes.position, uv = g.attributes.uv;           // textura pixel proyectada de lado (16 px por bloque)
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getZ(i) + p.getX(i), p.getY(i));
  g.computeVertexNormals();
  return g;
}

class Roadster {
  constructor() {
    const g = this.grupo = new THREE.Group();
    this.cuerpo = new THREE.Group(); g.add(this.cuerpo);
    const pintura = this.pintura = new THREE.MeshStandardMaterial({ color: "#d5d9de", map: texturaPixel("#ffffff", 0.08, 16, 3), metalness: 0.15, roughness: 0.4, flatShading: true });
    const titanio = new THREE.MeshStandardMaterial({ color: "#80868e", map: texturaPixel("#ffffff", 0.1, 16, 5), metalness: 0.7, roughness: 0.34, flatShading: true });
    const oscuro = new THREE.MeshStandardMaterial({ color: "#1b1d21", roughness: 0.6, flatShading: true });
    const vidrio = new THREE.MeshStandardMaterial({ color: "#b06a30", metalness: 0.9, roughness: 0.14, flatShading: true });      // visor cobrizo
    const goma = new THREE.MeshStandardMaterial({ color: "#151515", roughness: 0.92, flatShading: true });
    const rin = new THREE.MeshStandardMaterial({ color: "#5b6169", metalness: 0.85, roughness: 0.3, flatShading: true });
    this.luzFrente = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.4, 3.4, 3.6), side: THREE.DoubleSide });
    this.luzAtras = new THREE.MeshBasicMaterial({ color: new THREE.Color(4.5, 0.18, 0.14) });
    const sombra = (m) => { m.castShadow = m.receiveShadow = true; return m; };
    const caja = (w, h, l, x, y, z, m, padre = this.cuerpo) => { const k = sombra(new THREE.Mesh(new THREE.BoxGeometry(w, h, l), m)); k.position.set(x, y, z); padre.add(k); return k; };
    // carrocería: cuña de planos rectos (nariz baja, cofre recto hasta el parabrisas, cintura que sube hacia atrás)
    this.cuerpo.add(sombra(new THREE.Mesh(geoPerfil([[2.26, 0.22], [2.29, 0.38], [0.95, 0.68], [-0.5, 0.79], [-2.05, 0.86], [-2.27, 0.8], [-2.29, 0.28], [-2.0, 0.2], [1.95, 0.2]], 1.96, 0.06), pintura)));
    // cabina: un solo visor de vidrio cobrizo, con el techo targa blanco al centro
    this.cuerpo.add(sombra(new THREE.Mesh(geoPerfil([[1.05, 0.64], [-0.12, 1.08], [-0.95, 1.07], [-1.8, 0.86], [-1.6, 0.7]], 1.44, 0.05), vidrio)));
    this.techo = sombra(new THREE.Mesh(geoPerfil([[0.12, 1.03], [-0.1, 1.12], [-0.92, 1.11], [-0.98, 1.03]], 0.86, 0.02), pintura));
    this.cuerpo.add(this.techo);
    // estribo y difusor de titanio, tomas de aire oscuras a los lados, barra de luz atrás
    caja(2.0, 0.16, 3.1, 0, 0.27, 0.05, oscuro); caja(2.01, 0.04, 3.1, 0, 0.37, 0.05, titanio);
    caja(1.76, 0.16, 0.22, 0, 0.3, -2.19, titanio);
    caja(0.06, 0.15, 0.9, 0.985, 0.5, -0.7, oscuro); caja(0.06, 0.15, 0.9, -0.985, 0.5, -0.7, oscuro);
    caja(1.84, 0.045, 0.03, 0, 0.78, -2.265, this.luzAtras);
    // faros triangulares "entrecerrados", pegados al plano de la nariz
    const tri = new THREE.Shape([new THREE.Vector2(-0.27, 0), new THREE.Vector2(0.27, 0), new THREE.Vector2(0.2, 0.1)]);
    const incl = Math.atan2(0.3, 1.34);
    for (const lado of [1, -1]) {
      const f = new THREE.Mesh(new THREE.ShapeGeometry(tri), this.luzFrente);
      f.scale.x = lado; f.rotation.set(-Math.PI / 2 + incl, 0, 0);
      f.position.set(lado * 0.56, 0.38 + 0.012, 2.25);
      this.cuerpo.add(f);
    }
    // alerón activo: la parte de atrás se levanta (campo `ala`: 0 guardado … 1 arriba)
    this.ala = new THREE.Group(); this.ala.position.set(0, 0.87, -1.75); this.cuerpo.add(this.ala);
    caja(1.84, 0.05, 0.5, 0, 0.03, -0.25, pintura, this.ala);
    this.patas = [caja(0.05, 0.3, 0.05, 0.6, -0.13, -0.3, titanio, this.ala), caja(0.05, 0.3, 0.05, -0.6, -0.13, -0.3, titanio, this.ala)];
    // toberas (el interior brilla cuando sopla)
    this.brillos = {};
    for (const [nombre, lista] of Object.entries(TOBERAS)) {
      if (nombre === "abajo") continue;
      for (const [p, d] of lista) {
        const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.05, 0.05, 0.06) });
        const lado = d[1] ? [0.16, 0.06, 0.16] : [0.17, 0.11, 0.06], dentro = d[1] ? [0.1, 0.02, 0.1] : [0.11, 0.07, 0.02];
        caja(...lado, p[0] - d[0] * 0.03, p[1] - d[1] * 0.03, p[2] - d[2] * 0.03, titanio);
        caja(...dentro, p[0] + d[0] * 0.01, p[1] + d[1] * 0.01, p[2] + d[2] * 0.01, m);
        (this.brillos[nombre] ||= []).push(m);
      }
    }
    // ventiladores de succión debajo
    this.matVent = new THREE.MeshBasicMaterial({ color: new THREE.Color(0, 0, 0) });
    for (const [x, y, z] of VENTILADORES) { const v = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.02, 12), this.matVent); v.position.set(x, y, z); this.cuerpo.add(v); }
    // ruedas (con rayos para que se vea que giran)
    this.ruedas = [];
    for (const [x, z] of [[0.86, 1.42], [-0.86, 1.42], [0.86, -1.42], [-0.86, -1.42]]) {
      const r = new THREE.Group(); r.position.set(x, RUEDA, z);
      const llanta = new THREE.Mesh(new THREE.CylinderGeometry(RUEDA, RUEDA, 0.3, 12), goma); llanta.rotation.z = Math.PI / 2; llanta.castShadow = true;
      const centro = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.31, 12), rin); centro.rotation.z = Math.PI / 2;
      const rayo = new THREE.Mesh(new THREE.BoxGeometry(0.315, 0.06, 0.46), oscuro), rayo2 = rayo.clone(); rayo2.rotation.x = Math.PI / 2;
      r.add(llanta, centro, rayo, rayo2);
      this.cuerpo.add(r); this.ruedas.push(r);
    }
    g.visible = false;
  }
  // modelo glTF opcional (campo `modelo` del efecto, p. ej. "texturas_mc/modelos/roadster.glb"): se escala al largo del
  // auto, se para en el piso y reemplaza la carrocería de bloques (ruedas, toberas y ventiladores siguen siendo del motor)
  usarModelo(ruta) {
    if (ruta === this._modelo) return;
    this._modelo = ruta;
    if (this.glb) { this.grupo.remove(this.glb); this.glb = null; }
    for (const c of this.cuerpo.children) c.visible = true;
    if (!ruta) return;
    import("three/addons/loaders/GLTFLoader.js").then(({ GLTFLoader }) => new GLTFLoader().load(ruta, (gl) => {
      if (this._modelo !== ruta) return;
      const m = gl.scene, tam = new THREE.Box3().setFromObject(m).getSize(new THREE.Vector3());
      if (tam.x > tam.z) m.rotation.y = -Math.PI / 2;
      m.scale.setScalar(4.5 / Math.max(tam.x, tam.z));
      const b = new THREE.Box3().setFromObject(m), c = b.getCenter(new THREE.Vector3());
      m.position.set(-c.x, -b.min.y, -c.z);
      m.traverse(o => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
      this.glb = new THREE.Group(); this.glb.add(m); this.grupo.add(this.glb);
      for (const c of this.cuerpo.children) if (!this.ruedas.includes(c)) c.visible = false;
    }, undefined, (err) => console.warn("modelo del Roadster:", err)));
  }

  // claves → posición, giro y velocidad en el tiempo t (en el marco del ancla)
  preparar(e) {
    if (this._e === e) return;
    this._e = e;
    const k = (e.claves?.length ? e.claves : [[0, 0, 0, 0, 0, 0, 0]]).map(c => [c[0], c[1] || 0, c[2] || 0, c[3] || 0, c[4] || 0, c[5] || 0, c[6] || 0]);
    this.k = k;
    // distancia rodada (para girar las ruedas): avance sobre el piso a lo largo del frente del auto
    this.s = [0];
    for (let i = 1; i < k.length; i++) {
      const a = k[i - 1], b = k[i], rb = b[4] * D2R, piso = a[2] < 0.12 && b[2] < 0.12 && Math.abs(b[6]) < 60;
      const ds = (b[1] - a[1]) * Math.sin(rb) + (b[3] - a[3]) * Math.cos(rb);
      this.s.push(this.s[i - 1] + (piso || e.ruedasSiempre ? ds : 0));
    }
  }
  estado(e, t) {
    this.preparar(e);
    const k = this.k;
    let i = 0;
    while (i < k.length - 2 && t >= k[i + 1][0]) i++;
    const a = k[i], b = k[Math.min(i + 1, k.length - 1)];
    const u = b[0] > a[0] ? clamp((t - a[0]) / (b[0] - a[0]), 0, 1) : 0;
    const L = (j) => a[j] + (b[j] - a[j]) * u;
    const s = this.s[i] + (this.s[Math.min(i + 1, k.length - 1)] - this.s[i]) * u;
    return { p: new THREE.Vector3(L(1), L(2), L(3)), q: new THREE.Quaternion().setFromEuler(new THREE.Euler(-L(5) * D2R, L(4) * D2R, -L(6) * D2R, "YXZ")), s };
  }
  // del marco del auto al del mundo
  aMundo(e, t, local, ancla) {
    const st = this.estado(e, t);
    return v3(local).applyQuaternion(st.q).add(st.p).add(ancla);
  }
  velocidad(e, t, local, ancla) {
    const h = 1 / 120;
    return this.aMundo(e, t + h, local, ancla).sub(this.aMundo(e, t - h, local, ancla)).multiplyScalar(1 / (2 * h));
  }
  poner(e, t, ancla) {
    const st = this.estado(e, t), g = this.grupo;
    g.visible = true;
    g.position.copy(st.p).add(ancla); g.quaternion.copy(st.q);
    if (e.color && e.color !== this._color) { this.pintura.color.set(e.color); this._color = e.color; }
    this.usarModelo(e.modelo || null);
    const ala = clamp(valor(e.ala, t, 0), 0, 1);                 // alerón activo: sube y se inclina
    this.ala.position.y = 0.87 + 0.32 * ala; this.ala.rotation.x = -0.22 * ala;
    for (const p of this.patas) { p.scale.y = 0.05 + ala; p.position.y = -0.04 - 0.15 * ala; }
    this.techo.visible = !e.sinTecho;
    // ruedas: lo rodado más lo que patinan
    let extra = 0;
    for (const [a, b, w] of e.giroRuedas || []) extra += clamp(t - a, 0, b - a) * w;
    for (const r of this.ruedas) r.rotation.x = st.s / RUEDA + extra;
    // toberas y ventiladores encendidos
    for (const [nombre, mats] of Object.entries(this.brillos)) {
      let f = 0;
      for (const [a, b, grupo, fuerza = 1] of e.chorros || []) if ((grupo === nombre || (grupo === "abajo" && nombre.startsWith("abajo"))) && t >= a && t <= b) f = Math.max(f, fuerza * Math.min(1, (t - a) / 0.05, (b - t) / 0.05));
      for (const m of mats) m.color.setRGB(0.05 + 2.4 * f, 0.05 + 3 * f, 0.06 + 3.6 * f);
    }
    let fv = 0;
    for (const [a, b] of e.succion || []) if (t >= a && t <= b) fv = Math.max(fv, Math.min(1, (t - a) / 0.3, (b - t) / 0.2));
    this.matVent.color.setRGB(0.25 * fv, 2.2 * fv, 3.2 * fv);
    this.fv = fv;
    return st;
  }
}

// rampa (cuarto de tubo): arco de radio R que sale tangente al piso y sube hasta `angulo`
function geoRampa(R, ang, ancho) {
  const N = 24, th = ang * D2R, pos = [], uv = [], idx = [];
  const perfil = Array.from({ length: N + 1 }, (_, i) => { const a = th * i / N; return [R * Math.sin(a), R * (1 - Math.cos(a))]; });
  const quad = (a, b, c, d, ua, ub) => { const n = pos.length / 3; pos.push(...a, ...b, ...c, ...d); uv.push(...ua, ...ub); idx.push(n, n + 1, n + 2, n + 2, n + 1, n + 3); };
  const w = ancho / 2;
  for (let i = 0; i < N; i++) {
    const [z0, y0] = perfil[i], [z1, y1] = perfil[i + 1], l0 = R * th * i / N, l1 = R * th * (i + 1) / N;
    quad([w, y0, z0], [-w, y0, z0], [w, y1, z1], [-w, y1, z1], [0, l0, ancho, l0], [0, l1, ancho, l1]);              // arriba
    quad([w, 0, z0], [w, y0, z0], [w, 0, z1], [w, y1, z1], [z0, 0, z0, y0], [z1, 0, z1, y1]);                       // costados
    quad([-w, y0, z0], [-w, 0, z0], [-w, y1, z1], [-w, 0, z1], [z0, y0, z0, 0], [z1, y1, z1, 0]);
  }
  const [zf, yf] = perfil[N];
  quad([-w, 0, zf], [w, 0, zf], [-w, yf, zf], [w, yf, zf], [0, 0, ancho, 0], [0, yf, ancho, yf]);                   // atrás
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
function texturaRampa() {
  const c = document.createElement("canvas"); c.width = c.height = 32;
  const x = c.getContext("2d");
  for (let i = 0; i < 32; i++) for (let j = 0; j < 32; j++) { const k = 150 + (azar(i, j * 7) - 0.5) * 26; x.fillStyle = `rgb(${k},${k + 2},${k + 6})`; x.fillRect(i, j, 1, 1); }
  for (let j = 0; j < 32; j++) for (const i of [0, 1, 30, 31]) { x.fillStyle = (Math.floor(j / 4) % 2) ? "#f2c31a" : "#1d1d1f"; x.fillRect(i, j, 1, 1); }
  const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.generateMipmaps = false;
  return t;
}

function texturaHalo() {
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const x = c.getContext("2d"), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.18, "rgba(255,255,255,0.7)"); g.addColorStop(0.45, "rgba(255,255,255,0.15)"); g.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

// familias de bloques para el efecto `paleta` (el mundo entero pasa a esos dos tonos, conservando la textura)
export const PALETAS = {
  nether: ["#3a0b0b", "#ef5d3c"], end: ["#2a2140", "#f1efb4"], rosa: ["#5c1a3d", "#ff9bd0"], azul: ["#101f5c", "#71aaff"],
  verde: ["#0c3b1e", "#82e38c"], oro: ["#5a3a00", "#ffe04a"], prismarina: ["#0a3a3a", "#7cf0d6"], roja: ["#3b0606", "#ff5a48"],
  hielo: ["#284a7c", "#e8f6ff"], obsidiana: ["#0a0614", "#8053d6"], naranja: ["#5a2400", "#ffab3d"], lila: ["#2e1648", "#d6a6ff"],
};
const FILTROS = { invert: 1, creeper: 2, spider: 3, sobel: 4, pencil: 5, bits: 6, deconverge: 7, wobble: 8, ntsc: 9, flip: 10, nausea: 11, oscuridad: 12, nieve: 13, vision: 14 };
const ultimoCambio = (cambios, t) => { let r = null; for (const c of cambios || []) { if (c[0] <= t + 1e-6) r = c; else break; } return r; };

export class Efectos {
  constructor(escena) {
    this.escena = escena;
    this.grupo = new THREE.Group();           // sólidos (auto, rampa): llevan sombra y oclusión ambiental
    this.sinAO = new THREE.Group();           // brillos, partículas, flechas, textos: fuera de la pasada de oclusión
    escena.scene.add(this.grupo, this.sinAO);
    this.escala = { value: 600 };
    this.nubes = { as: new Nube(24000, true, false, this.escala), ac: new Nube(12000, true, true, this.escala), ns: new Nube(24000, false, false, this.escala), nc: new Nube(12000, false, true, this.escala),
      np: new Nube(24000, false, "pixel", this.escala), ap: new Nube(12000, true, "pixel", this.escala) };
    for (const n of Object.values(this.nubes)) this.sinAO.add(n.obj);
    // bloques musicales: partícula de nota + destello del bloque en cada golpe (efecto `notas`)
    this.nubeNota = new Nube(12000, false, "pixel", this.escala, atlasNota()); this.sinAO.add(this.nubeNota.obj);
    this.pulsos = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false }), 8000);
    this.pulsos.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.pulsos.frustumCulled = false; this.pulsos.renderOrder = 6; this.pulsos.count = 0;
    this.pulsos.setColorAt(0, new THREE.Color(0, 0, 0)); this.sinAO.add(this.pulsos);
    this.auto = new Roadster(); this.grupo.add(this.auto.grupo);
    this.brilloPiso = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
    this.brilloPiso.rotation.x = -Math.PI / 2; this.brilloPiso.renderOrder = 3; this.sinAO.add(this.brilloPiso);
    this.matRampa = new THREE.MeshStandardMaterial({ map: texturaRampa(), roughness: 0.85 });
    this.halo = texturaHalo();
    this.brilloPiso.material.map = this.halo;
    this.cubo = new THREE.BoxGeometry(1, 1, 1);
    this.punta = new THREE.ConeGeometry(1, 1, 4); this.punta.rotateY(Math.PI / 4); this.punta.translate(0, 0.5, 0);
    this.anillo = new THREE.RingGeometry(0.86, 1, 48); this.anillo.rotateX(-Math.PI / 2);
    this.cintas = { a: this.nuevaCinta(true), n: this.nuevaCinta(false) };
    this.piscinas = {};                       // objetos reutilizables por tipo (flechas, rejillas, textos…)
    this.textos = new Map();
    this.lista = null; this.tau = 0; this.ancla = new THREE.Vector3();
  }

  // cinta que mira a la cámara (trayectorias y estelas): triángulos con color y alfa por vértice
  nuevaCinta(aditiva) {
    const max = 6000, g = new THREE.BufferGeometry();
    const c = { max, n: 0, pos: new Float32Array(max * 6), col: new Float32Array(max * 6), alfa: new Float32Array(max * 2), idx: [] };
    g.setAttribute("position", new THREE.BufferAttribute(c.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("col", new THREE.BufferAttribute(c.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("alfa", new THREE.BufferAttribute(c.alfa, 1).setUsage(THREE.DynamicDrawUsage));
    const idx = new Uint32Array(max * 6);
    for (let i = 0; i < max - 1; i++) idx.set([i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 2, i * 2 + 1, i * 2 + 3], i * 6);
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    c.obj = new THREE.Mesh(g, new THREE.ShaderMaterial({
      vertexShader: `attribute vec3 col; attribute float alfa; varying vec3 vC; varying float vA; void main(){ vC = col; vA = alfa; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
      fragmentShader: `varying vec3 vC; varying float vA; void main(){ if (vA < 0.004) discard; gl_FragColor = vec4(vC, vA);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: aditiva ? THREE.AdditiveBlending : THREE.NormalBlending }));
    c.obj.frustumCulled = false; c.obj.renderOrder = 7; c.tiras = [];
    this.sinAO.add(c.obj);
    return c;
  }
  // una tira: puntos (Vector3 del mundo), ancho, color (Color) y alfa por punto
  tira(cinta, pts, ancho, col, alfas, cam) {
    if (pts.length < 2) return;
    const ini = cinta.n;
    if (ini + pts.length + 2 > cinta.max) return;
    if (ini > 0) { this.vertice(cinta, pts[0], new THREE.Vector3(), 0, col, 0); this.vertice(cinta, pts[0], new THREE.Vector3(), 0, col, 0); }   // separador (triángulos sin área)
    const lado = new THREE.Vector3(), tan = new THREE.Vector3(), vista = new THREE.Vector3();
    for (let i = 0; i < pts.length; i++) {
      tan.subVectors(pts[Math.min(i + 1, pts.length - 1)], pts[Math.max(i - 1, 0)]).normalize();
      vista.subVectors(cam.position, pts[i]).normalize();
      lado.crossVectors(tan, vista).normalize();
      const w = typeof ancho === "function" ? ancho(i / (pts.length - 1)) : ancho;
      this.vertice(cinta, pts[i], lado, w / 2, col, alfas[i]);
    }
  }
  vertice(c, p, lado, w, col, a) {
    const i = c.n++;
    c.pos.set([p.x + lado.x * w, p.y + lado.y * w, p.z + lado.z * w, p.x - lado.x * w, p.y - lado.y * w, p.z - lado.z * w], i * 6);
    c.col.set([col.r, col.g, col.b, col.r, col.g, col.b], i * 6);
    c.alfa[i * 2] = c.alfa[i * 2 + 1] = a;
  }

  // objeto reutilizable: n-ésimo de su tipo en este cuadro (se esconden los que sobran)
  tomar(tipo, crear) {
    const p = this.piscinas[tipo] ||= { lista: [], usados: 0 };
    if (p.usados >= p.lista.length) { const o = crear(); p.lista.push(o); this.sinAO.add(o.obj || o); }
    return p.lista[p.usados++];
  }

  // ── por toma: lo llama aplicarToma (main.js) con el tiempo simulado
  actualizar(lista, tau = 0, ancla = null, tauReal = tau) {
    this.lista = lista?.length ? lista : null;
    this.tau = tau; this.tauReal = tauReal;
    this.ancla.set(ancla?.x || 0, ancla?.y || 0, ancla?.z || 0);
    const auto = this.lista?.find(e => e.tipo === "roadster");
    this.autoE = auto || null;
    this.auto.grupo.visible = false; this.brilloPiso.visible = false;
    if (auto && visible(auto, tau) > 0) {
      const st0 = this.auto.poner(auto, tau, this.ancla);
      if (this.auto.fv > 0.01 && st0.p.y < 0.6) {                // luz celeste en el piso bajo los ventiladores
        const bp = this.brilloPiso;
        bp.visible = true; bp.position.copy(st0.p).add(this.ancla); bp.position.y = this.ancla.y + 0.03;
        bp.rotation.set(-Math.PI / 2, 0, new THREE.Euler().setFromQuaternion(st0.q, "YXZ").y);
        bp.scale.set(3.4, 5.6, 1); bp.material.color.setRGB(0.25 * this.auto.fv, 1.5 * this.auto.fv, 2.2 * this.auto.fv);
      }
      if (auto.camara) {                                          // la cámara apunta al auto (con retraso: se le escapa)
        const c = auto.camara, p = this.auto.estado(auto, tau - (c.retraso || 0)).p.add(this.ancla).add(v3(c.ofs));
        Object.assign(this.escena.actor, { x: p.x, y: p.y, z: p.z, rot: c.rot ?? 0 });
      }
      if (auto.conActor) {                     // LTezla sentado en el auto: se mueve y gira con él
        const ca = auto.conActor, ga = this.escena.grupoActor, st = this.auto.estado(auto, tau);
        ga.position.copy(v3(ca.pos, [0.38, 0.3, -0.1]).applyQuaternion(st.q).add(st.p).add(this.ancla));
        ga.quaternion.copy(st.q).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (ca.rot || 0) * D2R));
      }
    }
    // rampas (sólidas, con sombra)
    const rampas = this.lista?.filter(e => e.tipo === "rampa") || [];
    this.rampas ||= [];
    rampas.forEach((e, i) => {
      const clave = JSON.stringify([e.radio, e.angulo, e.ancho]);
      let m = this.rampas[i];
      if (!m) { m = new THREE.Mesh(new THREE.BufferGeometry(), this.matRampa); m.castShadow = m.receiveShadow = true; this.grupo.add(m); this.rampas[i] = m; }
      if (m.userData.clave !== clave) { m.geometry.dispose(); m.geometry = geoRampa(e.radio ?? 6, e.angulo ?? 35, e.ancho ?? 3); m.userData.clave = clave; }
      m.position.copy(v3(e.pos)).add(this.ancla); m.rotation.y = (e.rumbo || 0) * D2R; m.visible = true;
    });
    for (let i = rampas.length; i < this.rampas.length; i++) this.rampas[i].visible = false;
    this.post = this.calcularPost(tau);
  }

  // filtros de Minecraft, impact frames y paleta del mundo en este instante (los aplica escena.js)
  calcularPost(tau) {
    const post = { modo: 0, fuerza: 1, impacto: 0, color: new THREE.Color(1, 0.3, 0.5), centro: [0.5, 0.5], semilla: 0, pixel: 6, paleta: null, t: tau,
      sacude: null };
    for (const e of this.lista || []) {
      const t = (e.real ? this.tauReal : tau) + (e.desfase || 0);
      if (e.tipo === "sacude") {
        const dura = e.dura ?? 0.35;
        for (const g of e.golpes || []) {
          const tg = Array.isArray(g) ? g[0] : g, f = (Array.isArray(g) ? g[1] : null) ?? 1, x = t - tg;
          if (x < 0 || x > dura) continue;
          const k = f * Math.exp(-x * 9 / dura) * (1 - x / dura), w = x * 60;      // temblor a 60 Hz que se apaga
          const s = post.sacude ||= { x: 0, y: 0, giro: 0, zoom: 1 };
          s.x += k * 0.35 * Math.sin(w * 1.7 + tg * 13); s.y += k * 0.35 * Math.sin(w * 2.3 + tg * 7);
          s.giro += k * (e.giro ?? 4) * Math.sin(w * 1.1 + tg * 3);
          s.zoom *= 1 - (e.zoom ?? 0.12) * f * Math.exp(-x * 7 / dura);
        }
      }
      if (e.tipo === "filtro") {
        if (e.cambios) {
          const c = ultimoCambio(e.cambios, t);
          if (c && c[1]) { post.modo = FILTROS[c[1]] || 0; post.fuerza = c[2] ?? e.fuerza ?? 1; }
        } else if (visible(e, tau) > 0) { post.modo = FILTROS[e.modo] || 0; post.fuerza = valor(e.fuerza, tau, 1) * visible(e, tau); }
      } else if (e.tipo === "paleta") {
        const c = ultimoCambio(e.cambios, t);
        if (c && c[1]) { const par = Array.isArray(c[1]) ? c[1] : PALETAS[c[1]]; if (par) post.paleta = { oscuro: new THREE.Color(par[0]), claro: new THREE.Color(par[1]), mezcla: c[2] ?? e.mezcla ?? 1 }; }
      } else if (e.tipo === "impacto") {
        const n = e.cuadros || 2, fases = e.fases || [1, 2];
        for (let j = 0; j < (e.golpes || []).length; j++) {
          const g = e.golpes[j], tg = Array.isArray(g) ? g[0] : g;
          const k = Math.floor((t - tg) * 30 + 1e-3);
          if (k < 0 || k >= n) continue;
          post.impacto = fases[Math.min(fases.length - 1, Math.floor(k * fases.length / n))];
          post.color = color((Array.isArray(g) && g[1]) || e.color || "#ff4f9a");
          post.centro = Array.isArray(g) && g[2] != null ? [g[2], g[3]] : (e.centro || null);     // null = desde LTezla
          post.soloActor = e.soloActor ?? true;
          post.semilla = j * 3.17 + 1; post.pixel = e.pixel ?? 6;
        }
      }
    }
    return post;
  }

  // posición / dirección de un efecto (en el mundo), con `sigue: "auto"`
  pos(e, local, t = this.tau) {
    if (e.sigue === "auto" && this.autoE) return this.auto.aMundo(this.autoE, t, local || [0, 0, 0], this.ancla);
    return v3(local).add(this.ancla);
  }
  dir(e, d, t = this.tau) {
    const v = Array.isArray(d?.[0]) ? vecCurva(d, t) : v3(d, [0, 1, 0]);
    if (e.sigue === "auto" && this.autoE && !e.dirMundo) v.applyQuaternion(this.auto.estado(this.autoE, t).q);
    return v.normalize();
  }

  // ── justo antes de dibujar (la cámara ya está puesta): llena partículas, cintas y objetos que miran a la cámara
  antesDeRender(cam, renderer) {
    this.camPos = cam.position;
    const tam = renderer.getDrawingBufferSize(new THREE.Vector2());
    this.escala.value = tam.y / (2 * Math.tan(cam.fov * D2R / 2));
    for (const n of Object.values(this.nubes)) n.n = 0;
    for (const n of Object.values(this.nubesTrozo || {})) n.n = 0;
    this.nubeNota.n = 0; this.pulsos.count = 0;
    for (const c of Object.values(this.cintas)) c.n = 0;
    for (const p of Object.values(this.piscinas)) p.usados = 0;
    if (this.lista) {
      for (let i = 0; i < this.lista.length; i++) {
        const e = this.lista[i], t = e.real ? this.tauReal : this.tau, a = visible(e, t);
        if (e.tipo === "roadster") { if (a > 0) this.efectosAuto(e, t, i, cam); continue; }
        if (a <= 0) continue;
        if (e.tipo === "particulas") this.particulas(e, t, a, i);
        else if (e.tipo === "flecha") this.flecha(e, t, a, cam);
        else if (e.tipo === "trayectoria") this.trayectoria(e, t, a, cam);
        else if (e.tipo === "rejilla") this.rejilla(e, t, a);
        else if (e.tipo === "barra") this.barra(e, t, a, cam);
        else if (e.tipo === "texto") this.texto(e, t, a, cam);
        else if (e.tipo === "destello") this.destello(e, t, a, cam);
        else if (e.tipo === "voxel") this.voxel(e, t, a);
        else if (e.tipo === "cuadro") this.cuadro(e, t, a, cam);
        else if (e.tipo === "notas") this.notas(e, t, a);
        else if (e.tipo === "ecualizador") this.ecualizador(e, t, a);
        else if (e.tipo === "fragmentos") this.fragmentos(e, t);
      }
    }
    for (const n of Object.values(this.nubes)) n.fin();
    this.nubeNota.fin();
    for (const n of Object.values(this.nubesTrozo || {})) n.fin();
    this.pulsos.visible = this.pulsos.count > 0;
    if (this.pulsos.count) { this.pulsos.instanceMatrix.needsUpdate = true; this.pulsos.instanceColor.needsUpdate = true; }
    for (const c of Object.values(this.cintas)) {
      const g = c.obj.geometry;
      for (const k of ["position", "col", "alfa"]) g.attributes[k].needsUpdate = true;
      g.setDrawRange(0, Math.max(0, (c.n - 1) * 6)); c.obj.visible = c.n > 1;
    }
    for (const p of Object.values(this.piscinas)) p.lista.forEach((o, k) => { (o.obj || o).visible = k < p.usados; });
    this.terminar();
  }

  // ── partículas sin estado: la partícula k nace en desde + k/tasa y su posición sale de la fórmula del movimiento
  // (velocidad inicial con arrastre + gravedad). `origen(b)` da dónde y hacia dónde sale la que nace en b.
  emitir(cfg, t, rangos, origen, semilla, alfaGlobal = 1) {
    const S = { ...ESTILOS[cfg.estilo || "gas"], ...cfg };
    const nube = this.nubes[(S.aditivo ? "a" : "n") + (S.forma === "pixel" ? "p" : S.forma === "cuadro" ? "c" : "s")];
    const c1 = color(S.color), c2 = color(S.color2 ?? S.color);
    const abre = (S.abre ?? 20) * D2R, k = S.arrastre || 0, vida = S.vida;
    const base = new THREE.Vector3(), d = new THREE.Vector3(), u = new THREE.Vector3(), w = new THREE.Vector3(), p = new THREE.Vector3(), cc = new THREE.Color();
    for (const [a, b, fuerza = 1] of rangos) {
      if (t < a) continue;
      const k0 = Math.max(0, Math.ceil((t - vida - a) * S.tasa)), k1 = Math.floor((Math.min(t, b) - a) * S.tasa);
      for (let n = k0; n <= k1; n++) {
        const nac = a + n / S.tasa, edad = t - nac;
        if (edad < 0 || edad > vida) continue;
        const o = origen(nac, n);
        if (!o) continue;
        const r1 = azar(semilla + n, 1), r2 = azar(semilla + n, 2), r3 = azar(semilla + n, 3), r4 = azar(semilla + n, 4);
        // dirección dentro de un cono alrededor de o.dir
        d.copy(o.dir);
        u.set(Math.abs(d.y) < 0.9 ? 0 : 1, Math.abs(d.y) < 0.9 ? 1 : 0, 0).cross(d).normalize(); w.crossVectors(d, u);
        const ang = abre * Math.sqrt(r1), giro = r2 * Math.PI * 2;
        d.multiplyScalar(Math.cos(ang)).addScaledVector(u, Math.sin(ang) * Math.cos(giro)).addScaledVector(w, Math.sin(ang) * Math.sin(giro));
        const vel = S.vel * fuerza * (1 - 0.35 * (r3 - 0.5) * 2 * (S.varVel ?? 0.6));
        const f = k > 0 ? (1 - Math.exp(-k * edad)) / k : edad;
        p.copy(o.pos);
        if (S.area) p.add(base.set((r3 - 0.5) * S.area[0], (r4 - 0.5) * S.area[1], (azar(semilla + n, 5) - 0.5) * S.area[2]));
        p.addScaledVector(d, vel * f);
        if (o.vel) p.addScaledVector(o.vel, (k > 0 ? (1 - Math.exp(-k * 0.6 * edad)) / (k * 0.6) : edad) * (S.hereda ?? 1));
        p.y += 0.5 * S.g * edad * edad;
        // contra el piso: el chorro se abre hacia los lados
        if (S.suelo !== false && o.piso != null && p.y < o.piso + 0.05) {
          const hundido = o.piso + 0.05 - p.y;
          const rx = p.x - o.pos.x, rz = p.z - o.pos.z, rl = Math.hypot(rx, rz) || 1;
          const ex = rl < 0.01 ? Math.cos(giro) : rx / rl, ez = rl < 0.01 ? Math.sin(giro) : rz / rl;
          p.x += ex * hundido * 0.9; p.z += ez * hundido * 0.9; p.y = o.piso + 0.05 + hundido * 0.12;
        }
        const x = edad / vida;
        let al = S.alfa * Math.min(1, edad / 0.05) * (1 - x) ** 1.3 * (o.alfa ?? 1) * alfaGlobal * Math.min(1, fuerza);
        if (S.titila) al *= 0.5 + 0.5 * Math.sin(edad * 40 + r4 * 20);
        cc.copy(c1).lerp(c2, x);
        if (S.forma === "pixel") {
          const gris = 1 - (S.grises ?? 0.25) * azar(semilla + n, 6);
          nube.poner(p.x, p.y, p.z, cc.r * gris, cc.g * gris, cc.b * gris, Math.min(1, al * 1.6), S.tam * (1 + (S.crece - 1) * x) * (0.8 + 0.4 * r4), 7 - Math.min(7, Math.floor(x * 8 * (S.encoge ?? 1))));
        } else nube.poner(p.x, p.y, p.z, cc.r, cc.g, cc.b, al, S.tam * (1 + (S.crece - 1) * x) * (0.7 + 0.6 * r4));
      }
    }
  }

  // pedazos de bloque (como al romperlo en Minecraft): cada uno es un cuarto de la textura (4×4 de 16×16) que sale volando
  // con gravedad desde el centro del bloque. Sin estado: la posición sale del tiempo desde el golpe
  fragmentos(e, t0) {
    const ruta = e.textura || TEX_MUSICAL, img = imagenCuadro(ruta, true);
    if (!img.tex) return;
    this.nubesTrozo ||= {};
    let nube = this.nubesTrozo[ruta];
    if (!nube) { nube = this.nubesTrozo[ruta] = new Nube(16000, false, "trozo", this.escala, img.tex); this.sinAO.add(nube.obj); }
    const t = t0 + (e.desfase || 0), vida = e.vida ?? 0.9, vel = e.vel ?? 5, g = e.g ?? -18, tam = e.tam ?? 0.16;
    const col = color(e.color || [1, 1, 1]), an = this.ancla, gs = e.golpes || [];
    let lo = 0, hi = gs.length;                                 // golpes ordenados: sólo los de la última `vida`
    while (lo < hi) { const m = (lo + hi) >> 1; if (gs[m][0] < t - vida) lo = m + 1; else hi = m; }
    for (let j = lo; j < gs.length && gs[j][0] <= t; j++) {
      const [tg, x, y, z, n = 12] = gs[j], edad = t - tg;
      for (let k = 0; k < n; k++) {
        const r1 = azar(j * 131 + k, 11), r2 = azar(j * 131 + k, 12), r3 = azar(j * 131 + k, 13), r4 = azar(j * 131 + k, 14);
        const ang = r1 * Math.PI * 2, sube = 0.35 + 0.65 * r2, v = vel * (0.5 + 0.7 * r3);
        const hx = Math.cos(ang) * Math.sqrt(1 - sube * sube), hz = Math.sin(ang) * Math.sqrt(1 - sube * sube);
        const px = an.x + x + 0.5 + hx * v * edad, pz = an.z + z + 0.5 + hz * v * edad;
        const py = Math.max(an.y + 0.05, an.y + y + 0.5 + sube * v * edad + 0.5 * g * edad * edad);
        const al = 1 - suave((edad / vida - 0.75) / 0.25);
        nube.poner(px, py, pz, col.r, col.g, col.b, al, tam * (0.7 + 0.6 * r4), Math.floor(r4 * 16) % 16);
      }
    }
  }

  particulas(e, t, a, i) {
    const raf = e.rafaga;
    const rangos = raf ? [[raf.t ?? e.desde ?? 0, (raf.t ?? e.desde ?? 0) + (raf.n ?? 60) / 1e4, 1]] : (e.rangos || [[e.desde ?? 0, e.hasta ?? 1e9, 1]]);
    const cfg = raf ? { ...e, tasa: 1e4 } : e;
    const piso = e.suelo ? this.ancla.y + (e.piso || 0) : null;
    this.emitir(cfg, t, rangos, (b) => ({ pos: this.pos(e, e.pos, b), dir: this.dir(e, e.dir || [0, 1, 0], b), piso }), (e.semilla ?? i * 977) * 131, a);
  }

  efectosAuto(e, t, i, cam) {
    const A = this.auto, an = this.ancla, piso = an.y;
    const sem = (e.semilla ?? 7) * 1000;
    // chorros de aire comprimido: niebla blanca + núcleo brillante por tobera
    (e.chorros || []).forEach(([a, b, grupo, fuerza = 1], j) => {
      (TOBERAS[grupo] || []).forEach(([pl, dl], m) => {
        const origen = (nac) => {
          const st = A.estado(e, nac);
          return { pos: v3(pl).applyQuaternion(st.q).add(st.p).add(an), dir: v3(dl).applyQuaternion(st.q), vel: A.velocidad(e, nac, pl, an).multiplyScalar(0.8), piso };
        };
        this.emitir({ estilo: "gas", ...(e.gas || {}) }, t, [[a, b, fuerza]], origen, sem + j * 101 + m * 13);
        this.emitir({ estilo: "nucleo", ...(e.nucleo || {}) }, t, [[a, b, fuerza]], origen, sem + 50000 + j * 101 + m * 13);
      });
    });
    // ventiladores: aire que se mete por debajo (motitas celestes que van hacia los ventiladores)
    for (const [a, b] of e.succion || []) {
      VENTILADORES.forEach((pv, m) => {
        this.emitir({ estilo: "aire", tasa: 90, vida: 0.32, vel: 0, arrastre: 0 }, t, [[a, b, 1]], (nac, n) => {
          const st = A.estado(e, nac), ang = azar(n, m * 7 + 3) * Math.PI * 2, r = 0.9 + azar(n, m + 11) * 0.7;
          const desde = v3([pv[0] + Math.cos(ang) * r, 0.03, pv[2] + Math.sin(ang) * r]), hasta = v3(pv);
          const dd = hasta.clone().sub(desde);
          return { pos: desde.applyQuaternion(st.q).add(st.p).add(an), dir: dd.clone().normalize().applyQuaternion(st.q), vel: dd.applyQuaternion(st.q).multiplyScalar(1 / 0.32) };
        }, sem + 70000 + m * 31);
      });
    }
    // humo de llantas que patinan y polvo cuando corre por el piso
    for (const [a, b] of e.humo || []) for (const x of [0.86, -0.86]) this.emitir({ estilo: "humo", ...(e.humoCfg || {}) }, t, [[a, b, 1]], (nac) => {
      const st = A.estado(e, nac);
      return { pos: v3([x, 0.1, -1.38]).applyQuaternion(st.q).add(st.p).add(an), dir: v3([x > 0 ? 0.4 : -0.4, 0.5, -1]).normalize().applyQuaternion(st.q), piso };
    }, sem + 80000 + (x > 0 ? 1 : 2) * 77);
    if (e.polvo) for (const x of [0.86, -0.86]) this.emitir({ estilo: "polvo", tasa: 60, ...(typeof e.polvo === "object" ? e.polvo : {}) }, t, [[-10, 1e9, 1]], (nac) => {
      const st = A.estado(e, nac);
      if (st.p.y > 0.15) return null;
      const v = A.velocidad(e, nac, [0, 0, 0], an).length();
      if (v < 2) return null;
      return { pos: v3([x, 0.08, -1.6]).applyQuaternion(st.q).add(st.p).add(an), dir: v3([x > 0 ? 0.5 : -0.5, 0.6, -0.4]).normalize().applyQuaternion(st.q), alfa: clamp((v - 2) / 10, 0, 1), piso };
    }, sem + 90000 + (x > 0 ? 1 : 2) * 55);
    // chispas al aterrizar
    (e.chispas || []).forEach((tc, j) => {
      for (const z of [1.38, -1.38]) this.emitir({ estilo: "chispas", tasa: 1e4, vida: 0.6, vel: 6, abre: 75 }, t, [[tc, tc + 0.004, 1]], (nac) => {
        const st = A.estado(e, tc);
        return { pos: v3([0, 0.05, z]).applyQuaternion(st.q).add(st.p).add(an), dir: v3([0, 0.35, z > 0 ? 1 : -1]).normalize().applyQuaternion(st.q), vel: A.velocidad(e, tc, [0, 0, 0], an).multiplyScalar(0.4), piso };
      }, sem + 95000 + j * 211 + (z > 0 ? 3 : 0));
    });
    // estelas brillantes (la luz trasera dibuja el camino)
    for (const es of e.estela || []) {
      const largo = es.largo ?? 0.8, N = 40, pts = [], al = [];
      for (let k = 0; k <= N; k++) { const tk = t - largo * (1 - k / N); pts.push(A.aMundo(e, tk, es.punto || [0, 0.73, -2.17], an)); al.push((k / N) ** 1.6 * (es.alfa ?? 0.9)); }
      this.tira(this.cintas.a, pts, (u) => (es.ancho ?? 0.12) * (0.3 + 0.7 * u), color(es.color || [4, 0.25, 0.2]), al, cam);
    }
  }

  flecha(e, t, a, cam) {
    const o = this.tomar("flecha", () => {
      const g = new THREE.Group(), mat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }), borde = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, depthWrite: false });
      const cuerpo = new THREE.Mesh(this.cubo, mat), punta = new THREE.Mesh(this.punta, mat);
      const cuerpo2 = new THREE.Mesh(this.cubo, borde), punta2 = new THREE.Mesh(this.punta, borde);
      cuerpo2.renderOrder = punta2.renderOrder = 8; cuerpo.renderOrder = punta.renderOrder = 9;
      g.add(cuerpo2, punta2, cuerpo, punta);
      return { obj: g, mat, borde, cuerpo, punta, cuerpo2, punta2 };
    });
    const crece = e.crece ?? 0.35, k = e.crece === 0 ? 1 : suave((t - (e.desde ?? 0)) / crece);
    const largo = Math.max(0.001, valor(e.largo, t, 1.5) * (0.15 + 0.85 * k));
    const gr = e.grosor ?? 0.1, pt = Math.min(largo * 0.5, e.punta ?? gr * 3.4), cuello = largo - pt;
    const p = this.pos(e, e.pos), d = this.dir(e, e.dir || [0, 1, 0]);
    o.obj.position.copy(p); o.obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
    o.cuerpo.scale.set(gr, cuello, gr); o.cuerpo.position.y = cuello / 2;
    o.punta.scale.set(gr * 2.3, pt, gr * 2.3); o.punta.position.y = cuello;
    const b = 1.35;                                        // contorno oscuro (se lee contra el cielo y el pasto)
    o.cuerpo2.scale.set(gr * b, cuello, gr * b); o.cuerpo2.position.y = cuello / 2;
    o.punta2.scale.set(gr * 2.3 * 1.18, pt * 1.12, gr * 2.3 * 1.18); o.punta2.position.y = cuello - pt * 0.06;
    o.mat.color.copy(color(e.color || [3, 0.6, 0.3])); o.mat.opacity = a; o.borde.opacity = a * (e.borde ?? 0.55);
    const encima = e.encima ?? false;
    for (const m of [o.mat, o.borde]) { m.depthTest = !encima; }
    if (e.texto) {
      const fin = p.clone().addScaledVector(d, largo + (e.sepTexto ?? 0.45));
      this.texto({ texto: e.texto, tam: e.tamTexto ?? 0.42, color: e.colorTexto || "#ffffff", color2: e.colorTexto2, sombra: e.sombraTexto || "#202020", valor: e.valor, dec: e.dec, encima: true, ofs: e.ofsTexto },
        t, a * suave((t - (e.desde ?? 0) - crece * 0.6) / 0.2), cam, fin);
    }
  }

  trayectoria(e, t, a, cam) {
    let pts;
    if (e.auto && this.autoE) {
      const [t0, t1] = e.auto, N = e.n ?? 60;
      pts = Array.from({ length: N + 1 }, (_, k) => this.auto.aMundo(this.autoE, t0 + (t1 - t0) * k / N, e.punto || [0, 0.5, 0], this.ancla));
    } else pts = (e.puntos || []).map(p => this.pos(e, p));
    if (pts.length < 2) return;
    // cuánto se ha dibujado
    let u = 1;
    if (e.dibuja) u = clamp((t - e.dibuja[0]) / (e.dibuja[1] - e.dibuja[0]), 0, 1);
    const n = Math.max(2, Math.ceil(u * (pts.length - 1)) + 1);
    const vis = pts.slice(0, n);
    if (u < 1 && n >= 2) { const f = u * (pts.length - 1) - (n - 2); vis[n - 1] = pts[n - 2].clone().lerp(pts[n - 1], clamp(f, 0, 1)); }
    const col = color(e.color || [2.4, 2.4, 2.6]);
    if (e.punteado) {
      // cubitos a distancia fija (como una trayectoria de partículas de Minecraft)
      const paso = e.paso ?? 0.35, cubos = [];
      let resto = 0;
      for (let k = 1; k < vis.length; k++) {
        const A = vis[k - 1], B = vis[k], L = A.distanceTo(B);
        let s = resto;
        while (s < L) { cubos.push(A.clone().lerp(B, s / L)); s += paso; }
        resto = s - L;
      }
      const nube = this.nubes[(e.aditivo === false ? "n" : "a") + "c"];
      for (const c of cubos) nube.poner(c.x, c.y, c.z, col.r, col.g, col.b, a * (e.alfa ?? 1), e.tamPunto ?? 0.13);
    } else {
      this.tira(this.cintas[e.aditivo === false ? "n" : "a"], vis, e.ancho ?? 0.07, col, vis.map(() => a * (e.alfa ?? 0.9)), cam);
    }
    if (e.cabeza !== false && u < 1) {
      const c = vis[vis.length - 1], nube = this.nubes.as;
      nube.poner(c.x, c.y, c.z, col.r * 1.4, col.g * 1.4, col.b * 1.4, a, (e.ancho ?? 0.07) * 5);
    }
  }

  rejilla(e, t, a) {
    const clave = JSON.stringify([e.tam, e.paso, e.plano, e.grosor]);
    const o = this.tomar("rejilla:" + clave, () => {
      const [W, H] = e.tam || [10, 10], paso = e.paso ?? 1, gr = e.grosor ?? 0.025;
      const lineas = [];
      for (let x = -W / 2; x <= W / 2 + 1e-6; x += paso) lineas.push([x, 0, gr, H]);
      for (let y = -H / 2; y <= H / 2 + 1e-6; y += paso) lineas.push([0, y, W, gr]);
      const mat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
      const m = new THREE.InstancedMesh(this.cubo, mat, lineas.length), M = new THREE.Matrix4();
      lineas.forEach(([x, y, w, h], i) => {
        const pl = e.plano || "xz";
        if (pl === "xz") M.compose(new THREE.Vector3(x, 0, y), new THREE.Quaternion(), new THREE.Vector3(w, gr, h));
        else if (pl === "xy") M.compose(new THREE.Vector3(x, y, 0), new THREE.Quaternion(), new THREE.Vector3(w, h, gr));
        else M.compose(new THREE.Vector3(0, y, x), new THREE.Quaternion(), new THREE.Vector3(gr, h, w));
        m.setMatrixAt(i, M);
      });
      m.frustumCulled = false; m.renderOrder = 4;
      return { obj: m, mat };
    });
    o.obj.position.copy(this.pos(e, e.pos)); o.obj.rotation.set(0, (e.giro || 0) * D2R, 0);
    o.mat.color.copy(color(e.color || [0.3, 1.4, 2.2])); o.mat.opacity = a * (e.alfa ?? 0.8);
  }

  barra(e, t, a, cam) {
    const o = this.tomar("barra", () => {
      const g = new THREE.Group(), relleno = new THREE.MeshBasicMaterial({ transparent: true }), marco = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true }), fondo = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true });
      const r = new THREE.Mesh(this.cubo, relleno), f = new THREE.Mesh(this.cubo, fondo), lados = [0, 1, 2, 3].map(() => new THREE.Mesh(this.cubo, marco));
      g.add(f, r, ...lados);
      return { obj: g, relleno, marco, fondo, r, f, lados };
    });
    const W = e.ancho ?? 0.6, H = e.alto ?? 3, D = e.prof ?? 0.25, v = clamp(valor(e.valor, t, 1), 0, 1.2), gr = 0.06;
    const pb = this.pos(e, e.pos);
    o.obj.position.copy(pb); o.obj.rotation.set(0, e.giro != null ? e.giro * D2R : Math.atan2(cam.position.x - pb.x, cam.position.z - pb.z), 0);   // sin giro: de frente a la cámara
    o.f.scale.set(W, H, D * 0.5); o.f.position.set(0, H / 2, -D * 0.3);
    o.r.scale.set(W - gr * 2, Math.max(0.001, (H - gr * 2) * v), D); o.r.position.set(0, gr + (H - gr * 2) * v / 2, 0);
    const [l, r, ab, ar] = o.lados;
    l.scale.set(gr, H, D * 1.1); l.position.set(-W / 2, H / 2, 0); r.scale.set(gr, H, D * 1.1); r.position.set(W / 2, H / 2, 0);
    ab.scale.set(W, gr, D * 1.1); ab.position.set(0, gr / 2, 0); ar.scale.set(W, gr, D * 1.1); ar.position.set(0, H - gr / 2, 0);
    o.relleno.color.copy(color(e.color || [0.4, 2.2, 0.6])); o.relleno.opacity = a; o.marco.opacity = a * 0.9; o.fondo.opacity = a * 0.45;
  }

  // malla de texto (Minecraft Ten extruida, de titulos3d.js), una por texto y estilo, con sus propios materiales
  mallaTexto(x) {
    const tit = this.escena.titulos;
    if (!tit.fuente) return null;
    const clave = JSON.stringify([x.texto, x.color, x.color2, x.sombra, x.sombra2, x.prof, x.espaciado]);
    if (this.textos.has(clave)) return this.textos.get(clave);
    const r = tit.armar({ texto: x.texto, color: x.color || "#ffffff", color2: x.color2, sombra: x.sombra || "#2a2a2a", sombra2: x.sombra2, prof: x.prof ?? 0.22, espaciado: x.espaciado ?? 0.02, interlinea: 1.05 });
    const g = r.grupo.clone(true);
    g.matrixAutoUpdate = true;
    const mats = [];
    g.traverse(m => { if (m.isMesh) { m.material = [].concat(m.material).map(k => { const c = k.clone(); mats.push(c); return c; }); m.renderOrder = 10; } });
    const o = { obj: g, mats };
    this.sinAO.add(g); g.visible = false;
    this.textos.set(clave, o);
    return o;
  }
  texto(e, t, a, cam, posMundo = null) {
    let s = String(e.texto ?? "");
    if (s.includes("{v}")) { const v = valor(e.valor, t, 0); s = s.replace("{v}", (e.paso ? Math.round(v / e.paso) * e.paso : v).toFixed(e.dec ?? 0)); }
    const o = this.mallaTexto({ ...e, texto: s });
    if (!o) return;
    (this.usadosTexto ||= new Set()).add(o);
    const p = posMundo || this.pos(e, e.pos);
    if (e.ofs) p.add(v3(e.ofs));
    o.obj.position.copy(p);
    if (e.giro != null) o.obj.quaternion.setFromEuler(new THREE.Euler(0, (Array.isArray(e.giro) ? e.giro[1] : e.giro) * D2R, 0));
    else o.obj.quaternion.copy(cam.quaternion);
    const k = e.anim === "golpe" ? 1 + (1 - suave((t - (e.desde ?? 0)) / 0.16)) * 0.4 : 1;
    o.obj.scale.setScalar((e.tam ?? 0.6) * k);
    const encima = e.encima ?? true;
    for (const m of o.mats) { m.opacity = a; m.depthTest = !encima; m.transparent = true; }
    o.obj.visible = true;
  }

  destello(e, t, a, cam) {
    const t0 = e.t ?? e.desde ?? 0, dur = e.dur ?? 0.45, x = (t - t0) / dur;
    if (x < 0 || x > 1) return;
    const o = this.tomar("destello", () => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.halo, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      s.renderOrder = 7;
      return s;
    });
    const p = this.pos(e, e.pos), tam = e.tam ?? 3;
    o.position.copy(p); o.scale.setScalar(tam * (0.35 + 0.65 * Math.sqrt(x)));
    o.material.color.copy(color(e.color || [3, 2.6, 2])); o.material.opacity = a * (1 - x) ** 1.5;
    if (e.anillo) {
      const r = this.tomar("anillo", () => { const m = new THREE.Mesh(this.anillo, new THREE.MeshBasicMaterial({ blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide })); m.renderOrder = 7; return m; });
      r.position.copy(p); r.position.y = this.ancla.y + (e.pisoAnillo ?? 0.06);
      r.scale.setScalar(Math.max(0.01, e.anillo * Math.sqrt(x)));
      r.material.color.copy(color(e.colorAnillo || e.color || [2, 2, 2.4])); r.material.opacity = a * (1 - x) ** 1.2;
    }
  }

  // objeto de bloques (con sombra, en el grupo de sólidos). Uno por modelo distinto; se reusa entre cuadros
  voxel(e, t, a) {
    if (!e.cajas?.length) return;
    this.voxeles ||= new Map();
    const clave = huella(e.cajas);
    let o = this.voxeles.get(clave);
    if (!o) {
      o = { obj: new THREE.Group() };
      const gl = geoVoxel(e.cajas, false), gb = geoVoxel(e.cajas, true);
      if (gl) { const m = new THREE.Mesh(gl, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.05 })); m.castShadow = m.receiveShadow = true; o.obj.add(m); }
      if (gb) { const m = new THREE.Mesh(gb, new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: true })); o.obj.add(m); }
      this.grupo.add(o.obj); this.voxeles.set(clave, o);
    }
    (this.usadosVoxel ||= new Set()).add(o);
    const p = this.pos(e, e.pos);
    if (e.flota) p.y += Math.sin(t * 2.2) * e.flota;
    o.obj.position.copy(p);
    o.obj.rotation.set(0, (valor(e.giro, t, 0) + (e.gira || 0) * (t - (e.desde ?? 0))) * D2R, 0);
    o.obj.scale.setScalar((e.escala ?? 1) * escalaPop(e, t) * (a < 1 ? 0.6 + 0.4 * a : 1));
    o.obj.visible = true;
  }

  // imagen en el mundo (pintura / pantalla): plano con la textura + marco de madera opcional
  cuadro(e, t, a, cam) {
    const img = imagenCuadro(e.imagen, e.pixel);
    if (!img.tex) return;
    this.cuadros ||= new Map();
    const clave = JSON.stringify([e.imagen, e.pixel, e.marco, e.luz]);
    let o = this.cuadros.get(clave);
    if (!o) {
      const luz = e.luz ?? 1;
      const mat = new THREE.MeshBasicMaterial({ map: img.tex, transparent: true, side: THREE.DoubleSide, toneMapped: luz <= 1 });
      mat.color.setScalar(luz);
      const lienzo = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
      const g = new THREE.Group(); g.add(lienzo);
      const lados = [];
      if (e.marco) {
        const mm = new THREE.MeshStandardMaterial({ color: typeof e.marco === "string" ? e.marco : "#7a5230", roughness: 0.9 });
        for (let k = 0; k < 4; k++) { const m = new THREE.Mesh(this.cubo, mm); m.castShadow = true; g.add(m); lados.push(m); }
        const fondo = new THREE.Mesh(this.cubo, mm); g.add(fondo); lados.push(fondo);
      }
      o = { obj: g, lienzo, lados, mat };
      this.grupo.add(g); this.cuadros.set(clave, o);
    }
    (this.usadosCuadro ||= new Set()).add(o);
    const W = e.ancho ?? 2, H = W / img.aspecto, m = W * 0.06;
    const p = this.pos(e, e.pos);
    o.obj.position.copy(p);
    if (e.giro != null) o.obj.rotation.set(0, valor(e.giro, t, 0) * D2R, 0);
    else o.obj.rotation.set(0, Math.atan2(cam.position.x - p.x, cam.position.z - p.z), 0);
    o.obj.scale.setScalar(escalaPop(e, t));
    o.lienzo.scale.set(W, H, 1); o.lienzo.position.z = 0.012;
    if (o.lados.length) {
      const [ar, ab, iz, de, fondo] = o.lados, prof = 0.12;
      ar.scale.set(W + 2 * m, m, prof); ar.position.set(0, H / 2 + m / 2, 0);
      ab.scale.set(W + 2 * m, m, prof); ab.position.set(0, -H / 2 - m / 2, 0);
      iz.scale.set(m, H, prof); iz.position.set(-W / 2 - m / 2, 0, 0);
      de.scale.set(m, H, prof); de.position.set(W / 2 + m / 2, 0, 0);
      fondo.scale.set(W, H, 0.04); fondo.position.set(0, 0, -0.03);
    }
    o.mat.opacity = a;
    o.obj.visible = true;
  }

  // bloques musicales: golpes [[t, x, y, z, clics], …] ordenados por t; x, y, z = el bloque (enteros, relativos al ancla
  // redondeada hacia abajo, como `bloques` con relativo). En cada golpe el bloque destella `pulso` s y sale la nota
  // de Minecraft con el color de su tono, que sube y se desvanece en `vida` s. clics = null → nota blanca (percusión)
  notas(e, t, a) {
    const g = e.golpes || (e.archivo && golpesArchivo(e.archivo).golpes); if (!g?.length) return;
    t += e.desfase || 0;                                          // golpes en tiempo de la canción: desfase = inicio de la toma
    const vida = e.vida ?? 0.7, pulso = e.pulso ?? 0.2, tam = e.tam ?? 0.42;
    const primero = (tt) => { let lo = 0, hi = g.length; while (lo < hi) { const m = (lo + hi) >> 1; if (g[m][0] < tt) lo = m + 1; else hi = m; } return lo; };
    const lo = primero(t - vida);                                 // primer golpe con t0 >= t − vida
    const ax = Math.floor(this.ancla.x), ay = Math.floor(this.ancla.y), az = Math.floor(this.ancla.z);
    if (e.construye) this.construir(g, e, t, primero, ax, ay, az);
    const M = new THREE.Matrix4(), C = new THREE.Color();
    for (let i = lo; i < g.length && g[i][0] <= t; i++) {
      const [t0, x, y, z, clics] = g[i], edad = t - t0, fw = g[i][5] ?? 1, fh = g[i][6] ?? 1, fd = g[i][7] ?? 1;
      const [r, gg, b] = clics == null ? [1, 1, 1] : colorNota(clics);
      const cx = ax + x + fw / 2, cy = ay + y + fh - 1, cz = az + z + fd / 2, k1 = Math.cbrt(fw * fh * fd) ** 0.5;   // la nota sale de arriba de la figura
      const u = edad / vida, sube = 0.55 * (1 - (1 - u) ** 2), ladeo = (azar(i, 7) - 0.5) * 0.25;
      const pop = Math.min(1, edad / 0.05);
      // cerca de la cámara, o entre la cámara y LTezla, la corchea y los brillos se apagan (rondas 4 y 5: notas gigantes y
      // haces de luz tapaban la cara de LTezla en las tomas cercanas)
      const lejos = this.noTapa(cx, cy + 1.25 * k1, cz);
      this.nubeNota.poner(cx + ladeo * k1, cy + 1.25 * k1 + sube * k1, cz, r * 1.3, gg * 1.3, b * 1.3, lejos * a * (u < 0.55 ? 1 : 1 - (u - 0.55) / 0.45), tam * k1 * (0.6 + 0.4 * pop));
      if (lejos < 0.05) continue;
      if (e.anillo && edad < 0.4) {                              // onda del color de la nota sobre el bloque
        const q = edad / 0.4, o = this.tomar("anilloNota", () => { const m = new THREE.Mesh(this.anillo, new THREE.MeshBasicMaterial({ blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })); m.renderOrder = 7; return m; });
        o.position.set(cx, ay + y + fh + 0.04, cz); o.scale.setScalar(0.4 + e.anillo * Math.sqrt(q));
        o.material.color.setRGB(r * 2.2, gg * 2.2, b * 2.2); o.material.opacity = lejos * a * (1 - q) ** 1.5;
      }
      if (e.rayo && edad < 0.3 && this.pulsos.count < this.pulsos.instanceMatrix.count) {     // haz de luz hacia arriba
        const q = edad / 0.3, h = e.rayo * (0.3 + 0.7 * Math.sqrt(q)), w = 0.32 * (1 - q * 0.6);
        M.makeScale(w, h, w).setPosition(cx, ay + y + fh + h / 2, cz);
        this.pulsos.setMatrixAt(this.pulsos.count, M);
        const lz = 1.6 * (1 - q) ** 2 * a * lejos;
        this.pulsos.setColorAt(this.pulsos.count, C.setRGB(r * lz, gg * lz, b * lz));
        this.pulsos.count++;
      }
      if (e.chispas && edad < 0.45) {                            // pixeles brillantes que saltan (como los críticos)
        const nub = this.nubes.ap;
        for (let k = 0; k < e.chispas; k++) {
          const r1 = azar(i * 31 + k, 21), r2 = azar(i * 31 + k, 22), r3 = azar(i * 31 + k, 23), an = r1 * 6.2832, v = 2.5 + 3 * r2;
          nub.poner(cx + Math.cos(an) * v * 0.45 * edad, ay + y + fh + v * edad - 6 * edad * edad, cz + Math.sin(an) * v * 0.45 * edad,
            r * 2.4 + 0.4, gg * 2.4 + 0.4, b * 2.4 + 0.4, a * (1 - edad / 0.45), 0.09 * (0.7 + 0.6 * r3), Math.floor(edad / 0.45 * 8));
        }
      }
      if (edad < pulso && this.pulsos.count < this.pulsos.instanceMatrix.count) {
        const k = 1 - edad / pulso, s = 1.01 + 0.07 * k;
        M.makeScale(fw + s - 1, fh + s - 1, fd + s - 1).setPosition(cx, ay + y + fh / 2, cz);
        this.pulsos.setMatrixAt(this.pulsos.count, M);
        const w = 0.42 * k * k * a * lejos;                                // un golpe de luz, no una caja de color: 35 % blanco
        this.pulsos.setColorAt(this.pulsos.count, C.setRGB((0.65 * r + 0.35) * w, (0.65 * gg + 0.35) * w, (0.65 * b + 0.35) * w));
        this.pulsos.count++;
      }
    }
  }

  // 0 = lo tapa (pegado a la cámara o en la línea entre la cámara y el pecho de LTezla, más cerca que él), 1 = no tapa
  noTapa(x, y, z) {
    const c = this.camPos; if (!c) return 1;
    const dc = Math.hypot(x - c.x, y - c.y, z - c.z);
    let f = suave((dc - 2.2) / 2.3);
    const g = this.escena.grupoActor, ax = g.position.x - c.x, ay = g.position.y + 1.1 - c.y, az = g.position.z - c.z;
    const L = Math.hypot(ax, ay, az) || 1, u = ((x - c.x) * ax + (y - c.y) * ay + (z - c.z) * az) / L;
    if (u > 0 && u < L - 0.3) {
      const px = c.x + ax / L * u - x, py = c.y + ay / L * u - y, pz = c.z + az / L * u - z;
      f *= suave((Math.hypot(px, py, pz) - 0.7) / 0.9);       // a menos de ~1 bloque de la línea de la mirada
    }
    return f;
  }

  // `construye: true`: cada golpe deja su bloque musical puesto desde su cuadro (aparece con un pop de 2 cuadros) y se
  // queda con un brillo tenue (`tenue`, 0.18). Una malla instanciada por lista de golpes: las matrices se escriben una
  // vez y en cada cuadro sólo cambia cuántos se dibujan y la escala de los que están apareciendo.
  construir(g, e, t, primero, ax, ay, az) {
    const img = imagenCuadro(TEX_MUSICAL, true);
    if (!img.tex) return;
    this.rollos ||= new WeakMap();
    const M = new THREE.Matrix4();
    let o = this.rollos.get(g);
    if (!o) {
      if (!this.matMusical) {
        // figuras de muchos bloques (golpe con [w, h, d]): una caja escalada con la textura repetida bloque por bloque.
        // Copia de la textura con mipmaps para que una torre lejana no centellee (de cerca sigue nítida, NearestFilter)
        const tex = img.tex.clone();
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.generateMipmaps = true;
        tex.minFilter = THREE.NearestMipmapLinearFilter; tex.magFilter = THREE.NearestFilter; tex.anisotropy = 8; tex.needsUpdate = true;
        this.matMusical = new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, roughness: 0.9 });
        this.matMusical.onBeforeCompile = (sh) => {
          sh.vertexShader = sh.vertexShader.replace("#include <uv_vertex>", `#include <uv_vertex>
          #ifdef USE_INSTANCING
            vec3 sI = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
            vec3 nA = abs(normal);
            vec2 rep = max(floor((nA.x > 0.5 ? sI.zy : (nA.y > 0.5 ? sI.xz : sI.xy)) + 0.5), vec2(1.0));
            #ifdef USE_MAP
              vMapUv *= rep;
            #endif
            #ifdef USE_EMISSIVEMAP
              vEmissiveMapUv *= rep;
            #endif
          #endif`);
        };
      }
      const conColor = g.some(x => x[8] != null);
      if (conColor && !this.matMusicalClaro) {
        // figuras de color (pista, creeper, torres): la textura del bloque musical en gris claro, para que el tinte se vea
        // (verde × café = verde olivo oscuro, y la cara negra del creeper no se distinguía)
        const im = img.tex.image, cv = document.createElement("canvas");
        cv.width = im.width; cv.height = im.height;
        const cx = cv.getContext("2d"); cx.drawImage(im, 0, 0);
        const d = cx.getImageData(0, 0, cv.width, cv.height);
        for (let k = 0; k < d.data.length; k += 4) {
          const l = (0.3 * d.data[k] + 0.59 * d.data[k + 1] + 0.11 * d.data[k + 2]) / 255;
          const v = Math.round(255 * Math.min(1, 0.55 + 0.75 * l));
          d.data[k] = d.data[k + 1] = d.data[k + 2] = v;
        }
        cx.putImageData(d, 0, 0);
        const t2 = new THREE.CanvasTexture(cv);
        t2.colorSpace = THREE.SRGBColorSpace; t2.wrapS = t2.wrapT = THREE.RepeatWrapping; t2.generateMipmaps = true;
        t2.minFilter = THREE.NearestMipmapLinearFilter; t2.magFilter = THREE.NearestFilter; t2.anisotropy = 8;
        this.matMusicalClaro = this.matMusical.clone();
        this.matMusicalClaro.map = t2; this.matMusicalClaro.emissiveMap = t2; this.matMusicalClaro.onBeforeCompile = this.matMusical.onBeforeCompile;
        this.matMusicalClaro.customProgramCacheKey = () => "musicalClaro";
      }
      const m = new THREE.InstancedMesh(this.cubo, conColor ? this.matMusicalClaro : this.matMusical, g.length);
      m.frustumCulled = false; m.receiveShadow = true;
      const col = new THREE.Color();
      for (let i = 0; i < g.length; i++) {
        ponGolpe(m, i, g[i], 1);
        if (conColor) m.setColorAt(i, col.setHex(g[i][8] ?? 0x734530));   // sin color: el café del bloque musical
      }
      o = { obj: m, sucio: [0, 0], fugaces: g.map((x, i) => x[9] != null ? i : -1).filter(i => i >= 0) };   // fugaces: los que desaparecen
      this.grupo.add(m); this.rollos.set(g, o);
      (this.listaRollos ||= []).push(o);
    }
    const POP = 2 / 30, m = o.obj;
    m.position.set(ax, ay, az);
    const pon = (i, s) => ponGolpe(m, i, g[i], s);
    for (let i = o.sucio[0]; i < o.sucio[1]; i++) pon(i, 1);           // los que aparecían en el cuadro anterior vuelven a su tamaño
    const n = primero(t + 1e-6), k0 = primero(t - POP);
    for (let i = k0; i < n; i++) pon(i, 0.35 + 0.65 * suave((t - g[i][0]) / POP));
    o.sucio = [k0, n];
    for (const i of o.fugaces) if (i < n) pon(i, t >= g[i][9] ? 0 : 1);      // `hasta`: desaparece (escala 0)
    m.count = n; m.instanceMatrix.needsUpdate = true;
    this.matMusical.emissiveIntensity = e.tenue ?? 0.18;
    if (this.matMusicalClaro) this.matMusicalClaro.emissiveIntensity = e.tenue ?? 0.18;
    m.visible = n > 0;
    (this.usadosRollo ||= new Set()).add(o);
  }

  // ecualizador de bloques musicales: por cada columna x de los golpes, una pila cuya altura sigue a las notas recientes de
  // esa columna (cada nota suma `escala` bloques y se apaga linealmente en `ventana` s), `prof` filas de fondo en z.
  // La punta de cada columna destella con el color de su última nota y suelta corcheas. Campos: archivo | golpes,
  // desfase, z (fila de adelante, relativa al ancla), prof (3), ventana (0.45), escala (2.2), max (34)
  ecualizador(e, t, a) {
    const g = e.golpes || (e.archivo && golpesArchivo(e.archivo).golpes); if (!g?.length) return;
    const img = imagenCuadro(TEX_MUSICAL, true); if (!img.tex) return;
    t += e.desfase || 0;
    if (e.congelar != null) t = Math.min(t, e.congelar);             // el final se queda con la última forma
    const max = e.max ?? 34, prof = e.prof ?? 3, z0 = e.z ?? 0;
    const desde = (tt) => { let lo = 0, hi = g.length; while (lo < hi) { const m = (lo + hi) >> 1; if (g[m][0] < tt) lo = m + 1; else hi = m; } return lo; };
    // adaptativo: con mucha densidad (el pico pasa de 1.500 notas/s) la ventana se acorta y cada nota pesa menos, para
    // que las columnas LATAN con los racimos en lugar de quedarse todas arriba (una pared)
    const cuenta = new Map(); let dens = 0;
    for (let i = desde(t - 0.6); i < g.length && g[i][0] <= t; i++) { dens++; cuenta.set(g[i][1], (cuenta.get(g[i][1]) || 0) + 1); }
    const tasa = dens / 0.6;                                         // notas por segundo (último 0.6 s)
    const ventana = (e.ventana ?? 0.45) * Math.max(0.33, Math.min(1, 150 / Math.max(1, tasa)));
    // ganancia: la mitad más activa de las columnas (en el último 0.6 s) queda alrededor de `objetivo` bloques, que crece
    // con la intensidad; cada columna late arriba/abajo con sus propias notas (los racimos del clímax se ven como golpes)
    const cs = [...cuenta.values()].sort((p, q) => q - p), mitad = cs.slice(0, Math.max(1, Math.ceil(cs.length / 2)));
    const ref = Math.max(1e-3, mitad.reduce((p, q) => p + q, 0) / mitad.length * (ventana / 0.6) * 0.5);
    const objetivo = Math.min(max * 0.7, 7 + 12 * Math.min(1, tasa / 1000));
    const escala = objetivo / ref;
    const lo = desde(t - ventana);
    const alto = new Map(), ultima = new Map();
    for (let i = lo; i < g.length && g[i][0] <= t; i++) {
      const [t0, x, , , clics] = g[i];
      alto.set(x, (alto.get(x) || 0) + escala * (1 - (t - t0) / ventana));
      ultima.set(x, [t0, clics]);
    }
    if (!this.ecu) {
      // material propio: el ecualizador brilla un poco por sí mismo (director: "marrón oscuro sin luz")
      this.matEcu = new THREE.MeshStandardMaterial({ map: img.tex, emissive: new THREE.Color("#ffb070"), roughness: 0.9 });
      this.ecu = new THREE.InstancedMesh(this.cubo, this.matEcu, 12000);
      this.ecu.frustumCulled = false; this.ecu.castShadow = true; this.ecu.receiveShadow = true;
      this.grupo.add(this.ecu);
    }
    const ax = Math.floor(this.ancla.x), ay = Math.floor(this.ancla.y), az = Math.floor(this.ancla.z);
    const M = new THREE.Matrix4(), C = new THREE.Color();
    let n = 0;
    // ola de estadio en lo más denso (todas las columnas suenan igual → sería una pared): una onda recorre las columnas
    const ola = Math.min(1, Math.max(0, (tasa - 500) / 700));
    for (const [x, h0] of alto) {
      const onda = 1 - ola * 0.75 * (0.5 + 0.5 * Math.sin(x * 0.22 - t * 6.5));
      const h = Math.min(max, Math.max(1, Math.round(h0 * onda)));
      for (let y = 0; y < h; y++) for (let k = 0; k < prof && n < 12000; k++)
        this.ecu.setMatrixAt(n++, M.makeTranslation(ax + x + 0.5, ay + y + 0.5, az + z0 + k + 0.5));
      const [t0, clics] = ultima.get(x), edad = t - t0;
      if (edad < 0.15 && this.pulsos.count < this.pulsos.instanceMatrix.count) {           // la punta destella
        const [r, gg, b] = colorNota(clics), w = 0.6 * (1 - edad / 0.15) * a;
        M.makeScale(1.06, 1.06, prof + 0.06).setPosition(ax + x + 0.5, ay + h - 0.5, az + z0 + prof / 2);
        this.pulsos.setMatrixAt(this.pulsos.count, M);
        this.pulsos.setColorAt(this.pulsos.count++, C.setRGB((0.6 * r + 0.4) * w, (0.6 * gg + 0.4) * w, (0.6 * b + 0.4) * w));
      }
      if (edad < 0.5) {
        const [r, gg, b] = colorNota(clics), u = edad / 0.5;
        this.nubeNota.poner(ax + x + 0.5, ay + h + 0.6 + u * 1.2, az + z0 + 0.5, r * 1.3, gg * 1.3, b * 1.3, a * (1 - u), e.tam ?? 1.2);
      }
    }
    this.ecu.count = n; this.ecu.instanceMatrix.needsUpdate = true; this.ecu.visible = n > 0;
    this.matEcu.emissiveIntensity = e.tenue ?? 0.08;
    this.usadoEcu = true;
  }

  // los textos, objetos y cuadros se esconden si no se usaron en este cuadro
  terminar() {
    for (const o of this.textos.values()) if (!this.usadosTexto?.has(o)) o.obj.visible = false;
    this.usadosTexto?.clear();
    for (const o of this.listaRollos || []) if (!this.usadosRollo?.has(o)) o.obj.visible = false;
    if (this.ecu && !this.usadoEcu) this.ecu.visible = false;
    this.usadoEcu = false;
    this.usadosRollo?.clear();
    for (const [mapa, usados] of [[this.voxeles, this.usadosVoxel], [this.cuadros, this.usadosCuadro]]) {
      for (const o of mapa?.values() || []) if (!usados?.has(o)) o.obj.visible = false;
      usados?.clear();
    }
  }
}
