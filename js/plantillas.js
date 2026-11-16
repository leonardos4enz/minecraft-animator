// Plantillas: animaciones completas listas para editar (poses + ojos + matices + cámara)
import { POSES, copiaPose, CAMARAS } from "./poses.js";
import { EXPRESIONES } from "./rostro.js";

let _id = 0;
export const nuevoId = () => "c" + Date.now().toString(36) + (_id++).toString(36);

export const clipPose = (id, dur = 1.2, extra = {}) => ({ id: nuevoId(), pose: copiaPose(id), dur, trans: 0.4, curva: "natural", ...extra });
export const clipPoseObj = (pose, dur = 1.2, extra = {}) => ({ id: nuevoId(), pose: { editada: true, ...pose }, dur, trans: 0.4, curva: "natural", ...extra });
// audio: voz (ElevenLabs TTS) o sonido (ElevenLabs efectos). Se genera al usarlo y queda en caché.
export const VOZ_LTEZLA = "wXojZ3FhzsE0AumH6Oym";     // "Leo - Energetic" (mexicana), la de tus videos
export const clipVoz = (texto, inicio, extra = {}) => ({ id: nuevoId(), tipo: "voz", texto, voz: VOZ_LTEZLA, modelo: "eleven_v3", inicio, dur: 1, vol: 0.6, ...extra });
export const clipSfx = (texto, inicio, dur = 1, extra = {}) => ({ id: nuevoId(), tipo: "sfx", texto, durSfx: dur, inicio, dur, vol: 0.8, ...extra });
const conP = (id, p, nombre) => ({ ...copiaPose(id), p, nombre: nombre || POSES[id].nombre, editada: true });
export const clipOjos = (cara, dur = 1.2, mx = 0, my = 0, extra = {}) => ({ id: nuevoId(), cara, dur, mx, my, ...extra });
const aC = { aCamara: true };          // mira exactamente a la cámara (cabeza + ojos)
export const clipMatiz = (tipo, inicio, dur, intensidad = 1) => ({ id: nuevoId(), tipo, inicio, dur, intensidad });
export const clipCamara = (tipo, dur = 2) => ({ id: nuevoId(), tipo, dur, curva: CAMARAS[tipo]?.curva || "suave" });

export const clipCamaraVista = (tipo, dur, vista) => ({ ...clipCamara(tipo, dur), ...vista });

// ───────────── Tráiler (réplica del video de @benlyanimations para la MINECRAFT LIVE de Bobicraft) ─────────────
// Mismos cortes que el original (medidos cuadro a cuadro, ver analisis/analisis_trailer_emociones.md), con LTezla
// en el papel de los jugadores (los mobs y aldeanos son los del original). Cada toma = escenario + cielo + cámara + pose + ojos (+ mobs y títulos).
// grupo de mobs (texturas y modelos reales, ver js/mobs.js); la semilla sale de la posición para que sea estable
const mob = (tipo, n, x, z, extra = {}) => ({ tipo, n, x, z, ancho: 1.6, prof: 1.6, semilla: n * 7 + Math.round(x * 13 + z * 5) + tipo.length, ...extra });
const V = (az, el, dist, ty, extra = {}) => ({ az, el, dist, ty, fov: 40, ...extra });
const poseR = (nombre, r, p) => ({ nombre, r, p });
// cubitos rosas sobre las terrazas del Nether (como en el original): nacen arriba y se posan en el bloque más alto
const CUBITOS_NETHER = [[7.5, -5.5], [9.5, -3.5], [10.5, -6.5], [3.5, -3.5], [12.5, -6.5], [15.5, -9.5], [13.5, -11.5], [17.5, -14.5]]
  .map(([x, z], i) => ({ tipo: "cubito", color: "rosa", n: 1, x, z, y: 16, fijo: true, modo: "quieto", dir: -30 + i * 23, semilla: 30 + i }));

const TOMAS_TRAILER = [
  // 1-2: dos casas DE FRENTE (escalón y antorcha sobre cada puerta), hueco al centro con colinas; el granjero recargado
  // junto a su puerta con los brazos cruzados, el aldeanito camina por el centro y voltea, los pollitos cruzan
  { dur: 2.833, nombre: "Aldea: granjero junto a la puerta, aldeanito y pollitos",
    escena: { set: "aldea_frente", ambiente: "dia", sol: [0.35, 0.9, -0.55], niebla: ["#a9d9ee", 14, 75], actor: { x: 0, y: 0, z: 1, rot: 0 }, ocultar: true, fundido: { entra: 2.1 }, dof: 0.5, exp: 0.72, sat: 1.2, calidez: 3,
      mobs: [{ tipo: "granjero", n: 1, x: -4.1, z: 0.55, fijo: true, modo: "quieto", dir: 8 },
        { tipo: "aldeanito", n: 1, x: 0.4, z: 1.7, fijo: true, dir: 4, vel: 0.32, foco: true, cabezaYaw: [[0, 0], [1.4, 0], [1.9, -55]] },
        mob("pollito", 5, -8.6, 1.5, { dir: 90, vel: 1.75, modo: "correr", retraso: 1.05, escalonado: 0.6, ancho: 0.9, prof: 1.4 }),
        // easter egg: Clawd, la mascota de Claude Code, guía a los pollitos al frente de la fila dando saltitos
        { tipo: "clawd", n: 1, x: -7.3, z: 1.5, fijo: true, dir: 90, vel: 1.75, modo: "correr", retraso: 0.95, accion: { tipo: "saltitos", cada: 0.42 }, semilla: 3 }] },
    cams: [{ fija: true, desde: V(0, 1, 12.4, 1.75, { tilt: 1 }), hasta: V(0, 1, 11.9, 1.75, { tilt: 1 }), curva: "lineal", temblor: 0.15 }] },
  { dur: 0.917, nombre: "Aldea: siguen a los pollitos",
    escena: { set: "aldea_frente", ambiente: "dia", sol: [0.35, 0.9, -0.55], niebla: ["#a9d9ee", 14, 75], actor: { x: 0, y: 0, z: 1, rot: 0 }, ocultar: true, dof: 0.35, exp: 0.9, sat: 1.2, calidez: 2,
      mobs: [{ tipo: "granjero", n: 1, x: -4.1, z: 0.55, fijo: true, modo: "quieto", dir: 8 }, { tipo: "aldeanito", n: 1, x: 0.7, z: 2.6, fijo: true, dir: 40, vel: 0.45 },
        mob("pollito", 5, -3.4, 1.5, { dir: 90, vel: 1.8, modo: "correr", escalonado: 0.3, ancho: 0.9, prof: 1.4, foco: true, semilla: 3 }),
        // Clawd se sale de la fila hacia la cámara, frena mirando al lente y da saltitos; los pollitos pasan por detrás
        { tipo: "clawd", n: 1, x: -2.3, z: 2.3, fijo: true, dir: 90, vel: 1.8, modo: "correr", parar: 0.72, rumbo: [[0, 90], [0.22, 90], [0.4, 20], [0.62, 0]], accion: { tipo: "saltitos", cada: 0.3 }, semilla: 3 }] },
    cams: [{ fija: true, desde: V(-4, 1, 6.6, 0.75, { pan: 9 }), hasta: V(-4, 1, 6.6, 0.75, { pan: -2 }), curva: "suave", temblor: 0.25 }] },
  // 3: encuadre heroico: cámara baja en contrapicado y luna enorme justo detrás. El lobo de armadura rosa llega, frena,
  // SE SIENTA y aúlla largo contra la luna (baja la cabeza, la sube con el hocico al cielo, pecho arriba y vibrato);
  // pollitos aleteando alrededor; al final entra el lobo morado
  { dur: 1.783, nombre: "Noche: el lobo se sienta y aúlla contra la luna, pollitos volando",
    escena: { set: "cresta", ambiente: "noche", cielo: [182, 17], luna: [330, 0.42], exp: 0.8, actor: { x: -4, y: 0, z: 0, rot: 0 }, ocultar: true, focoMob: true, dof: 0.6,
      mobs: [{ tipo: "lobo", armadura: "#ff86b8", n: 1, x: -0.6, z: 0, fijo: true, dir: 90, vel: 1.6, foco: true, accion: { tipo: "aullar", en: 0.66, dur: 1.25, sentarse: true, fuerza: 1.35 } },
        mob("pollito", 2, -2.3, -1.2, { dir: 200, vel: 0.5, modo: "flotar", y: 0.55, ancho: 1.2, prof: 0.6, semilla: 11 }),
        mob("pollito", 1, 1.6, -1.0, { dir: 120, vel: 0.5, modo: "flotar", y: 1.6, semilla: 12 }),
        { tipo: "lobo", armadura: "#a99cff", n: 1, x: -3.4, z: -0.7, fijo: true, dir: 90, vel: 2.6, modo: "correr", retraso: 1.2 }] },
    cams: [{ desde: V(0, -8, 2.8, 0.75, { fov: 34, tilt: 5 }), hasta: V(0, -8, 2.65, 0.75, { fov: 34, tilt: 5 }), curva: "lineal", temblor: 0.12 }] },
  { dur: 1.8, nombre: "Noche: los animales saltan del risco frente a la luna (MARZO 21)",
    // 4: continuación de la toma anterior: el borde del risco a la izquierda, la luna enorme y nítida pegada a su orilla, y en
    // silueta chiquita los dos lobos y los pollitos corren por la meseta y saltan al vacío delante de la luna
    escena: { set: "cresta", ambiente: "noche", cielo: [-3, 3.2], luna: [165, 0.3], exp: 0.9, actor: { x: 44, y: 0, z: -4, rot: 0 }, ocultar: true,
      mobs: [mob("pollito", 5, 1.6, 0, { y: 15, dir: -90, vel: 3.2, modo: "correr", ancho: 1.6, prof: 0.6, escalonado: 0.22, saltaBorde: 4.5, semilla: 61 }),
        { tipo: "lobo", armadura: "#ff86b8", n: 1, x: 3.4, z: 0.3, y: 15, fijo: true, dir: -90, vel: 4.2, modo: "correr", retraso: 0.35, saltaBorde: 5.5 },
        { tipo: "lobo", armadura: "#a99cff", n: 1, x: 5.2, z: -0.3, y: 15, fijo: true, dir: -90, vel: 4.4, modo: "correr", retraso: 0.7, saltaBorde: 5.5 }] },
    cams: [{ desde: V(180, 0, 34, 13, { pan: -14, tilt: 3, fov: 36 }), hasta: V(180, 0, 33.4, 13, { pan: -14, tilt: 3, fov: 36 }), curva: "lineal", temblor: 0.15, foco: 34 }],
    // títulos 3D con Minecraft Ten (js/titulos3d.js); tamaños, posiciones y colores medidos en el original a 1280×720
    textos: [{ texto: "MARZO\n21", x: 0.76, y: 0.452, tam: 17.2, interlinea: 1.15, espaciado: -0.05, lineasX: [0, -0.38], prof: 0.35, color: "#0dbd14", color2: "#18c91f", sombra: "#021a08", sombra2: "#06420f", relieve: 0.06, dur: 1.8 }] },
  // 5: la cabra corriendo enorme en cuadro, travelling pegado y el bosque barrido detrás
  { dur: 1.209, nombre: "Nieve: cabra corriendo (cámara al lado)",
    escena: { set: "nieve", ambiente: "nieve", actor: { x: -14, y: 0, z: 0, rot: 90 }, actorHasta: { x: -8.4 }, exp: 0.88, ocultar: true, focoMob: true, obturador: 0.35,
      mobs: [{ tipo: "cabra", n: 1, x: -1.0, z: 0, fijo: true, dir: 90, vel: 4.6, modo: "correr", foco: true }] },
    cams: [{ desde: V(-86, 1, 2.9, 0.7), hasta: V(-90, 1, 2.85, 0.7), curva: "lineal", temblor: 0.4 }] },
  // 6-7: LTezla monta la cabra quieta mientras los cabritos se embisten entre ellos; al fondo la montaña nevada con franjas
  { dur: 2.458, nombre: "Nieve: LTezla montando la cabra, cabritos embistiéndose",
    escena: { set: "nieve", ambiente: "nieve", objeto: "goat_horn", fondo: "montana", exp: 1.1, sat: 0.75, fondoCfg: { x: -205, y: 14, z: 125, escala: 1.7 }, dof: 0.45, niebla: ["#d2e4f6", 70, 420],
      actor: { x: 4, y: 0.98, z: 0, rot: 150 }, ancla: { y: 0 },
      mobs: [{ tipo: "cabra", n: 1, x: 0, z: 0, fijo: true, modo: "quieto", dir: 150, montado: true, foco: true },
        // dos parejas de cabritos que se embisten: cargan, chocan cabezas, rebotan y en el siguiente ciclo uno empuja al otro
        ...[[1.5, 1], [3.3, -1]].map(([z, e], i) => ({ tipo: "cabrito", n: 1, x: -0.8, z, fijo: true, modo: "quieto", accion: { tipo: "chocar", punto: [-0.8, 2.4], en: 0.05, cada: 1.2, empuja: e }, semilla: 5 + i })),
        ...[[-1.4, -1], [-3.2, 1]].map(([z, e], i) => ({ tipo: "cabrito", n: 1, x: -1.4, z, fijo: true, modo: "quieto", accion: { tipo: "chocar", punto: [-1.4, -2.3], en: 0.4, cada: 1.3, empuja: e }, semilla: 15 + i })),
        { tipo: "cabrito", n: 1, x: -1.2, z: 3.4, fijo: true, dir: 200, vel: 1.4, modo: "caminar", accion: { tipo: "embestir", en: 0.9 }, semilla: 7 },
        mob("cabrito", 1, 2.2, -3.8, { modo: "quieto", semilla: 8 })] },
    cams: [{ dur: 1.833, desde: V(-62, 2, 6.0, 0.2, { tilt: 9, pan: 4 }), hasta: V(-58, 2, 5.8, 0.2, { tilt: 9, pan: 4 }), curva: "lineal", temblor: 0.25 },
      { dur: 0.625, desde: V(-58, 2, 5.8, 0.2, { tilt: 9, pan: 4 }), hasta: V(-40, 2, 2.4, 0.75, { fov: 38 }), curva: "salida", temblor: 0.3 }],
    poses: [["montar", 2.458]], ojos: [["determinado", 1.833, 0.4, 0], ["feliz", 0.625, 0, 0, { aCamara: true }]], matices: [["montar", 0, 2.458, 1]] },
  { dur: 2.042, nombre: "Bajo el agua: calamares brillantes (NUEVOS DROPS)",
    // 7: calamares brillantes grandes y CERCA (uno casi encima de la lente), rayos de luz desde la superficie
    escena: { set: "agua", exp: 0.55, ambiente: "agua", actor: { x: 0, y: 2, z: 0, rot: 0 }, ocultar: true, focoMob: true,
      mobs: [{ tipo: "calamar", n: 1, x: -0.2, z: 0.4, fijo: true, modo: "flotar", y: 2.4, dir: 60, vel: 0.35, sube: 0.35, escala: 1.2, foco: true },
        { tipo: "calamar", n: 1, x: 2.6, z: -0.8, fijo: true, modo: "flotar", y: 1.4, dir: 250, vel: 0.4, sube: 0.2, escala: 0.8, semilla: 4 },
        { tipo: "calamar", n: 1, x: -2.9, z: -1.2, fijo: true, modo: "flotar", y: 0.5, dir: 110, vel: 0.5, sube: 0.3, escala: 0.7, semilla: 5 },
        { tipo: "calamar", n: 1, x: 1.1, z: -2.5, fijo: true, modo: "flotar", y: 3.3, dir: 300, vel: 0.3, escala: 0.6, semilla: 6 },
        mob("calamar", 3, 0, -9, { modo: "flotar", y: 2.5, ancho: 12, prof: 4, vel: 0.3, dir: 270, escala: 0.5 })] },
    cams: [{ fija: true, desde: V(0, -14, 5.2, 1.3, { tilt: 16 }), hasta: V(3, -13, 4.9, 1.4, { tilt: 16 }), curva: "lineal", temblor: 0.3 }],
    // en el original los calamares pasan POR DELANTE del título: va dentro de la escena (enEscena) y le llega el brillo
    textos: [{ texto: "NUEVOS DROPS", x: 0.505, y: 0.535, tam: 13, espaciado: -0.04, enEscena: true, dist: 4.6, prof: 0.3, color: "#16eef9", color2: "#4ff7ff", sombra: "#03384e", sombra2: "#0a7d96", relieve: 0.05, dur: 2.042 }] },
  { dur: 1.916, nombre: "Aldea: primer plano del aldeano que voltea a la cámara",
    // 8: el aldeano junto a la esquina de una casa (antorcha arriba, alero); al fondo la otra casa y el granjero
    escena: { set: "aldea_frente", ambiente: "dia", sol: [0.35, 0.9, -0.55], niebla: ["#a9d9ee", 14, 75], actor: { x: 2.9, y: 0, z: 1.75, rot: 0 }, ocultar: true, dof: 0.8, exp: 0.95,
      mobs: [{ tipo: "aldeano", n: 1, x: 0, z: 0, fijo: true, modo: "quieto", dir: -70, foco: true, cabezaYaw: [[0, 0], [1.05, 0], [1.35, 40]] },
        { tipo: "granjero", n: 1, x: -7.0, z: -1.2, fijo: true, modo: "quieto", dir: 8 }] },
    cams: [{ desde: V(-30, 1, 3.2, 1.4, { fov: 38, pan: -12 }), hasta: V(-28, 1, 3.15, 1.4, { fov: 38, pan: -12 }), curva: "lineal", temblor: 0.25 }] },
  { dur: 1.709, nombre: "Aldea: estampida de pollitos (cámara baja)",
    // 9-14: estampida: cámara al ras mirando un poco hacia ARRIBA (mucho cielo), pollitos nítidos que corren hacia la lente
    escena: { set: "aldea", ambiente: "dia", actor: { x: 0.4, y: 0, z: -15, rot: 0 }, exp: 1.1, calidez: -2, ocultar: true, focoMob: true, obturador: 0.22, dof: 0.7,
      mobs: [mob("pollito", 8, 0, 4.6, { dir: 0, vel: 4.0, modo: "correr", ancho: 2.4, prof: 1.6, escalonado: 0.15, foco: true }), mob("pollito", 22, 0, 1.6, { dir: 0, vel: 4.1, modo: "correr", ancho: 3.0, prof: 4, escalonado: 0.3 }), mob("pollito", 10, 0, -2, { dir: 0, vel: 4.0, modo: "correr", ancho: 2.6, prof: 2 })] },
    cams: [{ fija: true, desde: V(-6, 0, 8.6, 0.17, { tilt: 17 }), hasta: V(10, 0, 11.4, 0.17, { tilt: 17 }), curva: "lineal", temblor: 0.45 }] },
  { dur: 1.0, nombre: "Aldea: pasan junto a la cámara",
    escena: { set: "aldea", ambiente: "dia", actor: { x: 0.4, y: 0, z: -5.5, rot: 0 }, sat: 1.2, calidez: 1, ocultar: true, focoMob: true, obturador: 0.22, dof: 0.7,
      mobs: [mob("pollito", 18, 0, -2.5, { dir: 0, vel: 4.3, modo: "correr", ancho: 2.6, prof: 3, escalonado: 0.3, foco: true })] },
    cams: [{ fija: true, desde: V(42, 1, 3.0, 0.24, { tilt: 13 }), hasta: V(62, 1, 3.0, 0.24, { tilt: 13 }), curva: "lineal", temblor: 0.45 }] },
  ...[[15, 1.2, 0.18, -1.0], [-32, 1.5, 0.22, -1.3], [168, 1.4, 0.2, 0.5], [-62, 1.6, 0.25, -0.8]].map(([az, d, ty, z0], i) => ({
    dur: [0.208, 0.208, 0.209, 0.25][i], nombre: "Aldea: corte rápido " + (i + 1),
    escena: { set: "aldea", ambiente: "dia", actor: { x: 0.5, y: 0, z: 0, rot: 0 }, calidez: -2, ocultar: true, focoMob: true, obturador: 0.22, dof: 0.7,
      mobs: [mob("pollito", 7, 0, z0, { dir: 0, vel: 4, modo: "correr", ancho: 1.4, prof: 1.2, semilla: 40 + i, foco: true })] },
    cams: [{ fija: true, desde: V(az, 2, d, ty, { tilt: 8 }), hasta: V(az + 4, 2, d, ty, { tilt: 8 }), curva: "lineal", temblor: 0.5 }] })),
  // 15: cerezos que llenan el cielo, terrazas de tierra; la oveja grande con un cubito morado encima y uno verde volando,
  // corderos dando brincos en el pasto
  { dur: 1.75, nombre: "Cerezos: oveja con cubitos y corderos brincando (¿ESTÁN LISTOS?)",
    escena: { set: "cerezos", ambiente: "dia", actor: { x: 0.5, y: 0, z: 0.5, rot: 0 }, ocultar: true, focoMob: true, exp: 0.82, sat: 1.3,
      mobs: [{ tipo: "oveja", n: 1, x: 0.9, z: 1.2, fijo: true, modo: "quieto", dir: -40, foco: true },
        { tipo: "cubito", color: "morado", n: 1, x: 1.05, z: 1.3, fijo: true, modo: "flotar", y: 1.32, dir: -60, vel: 0, semilla: 3 },
        { tipo: "cubito", color: "verde", n: 1, x: 0.4, z: 0.4, fijo: true, modo: "flotar", y: 2.6, dir: -20, vel: 0.15, sube: 0.15, semilla: 4 },
        mob("cordero", 1, -2.6, 0.3, { dir: 60, vel: 1.3, modo: "correr", accion: { tipo: "saltitos", cada: 0.55 }, semilla: 5 }),
        mob("cordero", 1, -1.4, -0.6, { dir: 80, vel: 1.0, modo: "caminar", accion: { tipo: "saltitos", cada: 0.7 }, semilla: 6 }),
        mob("cordero", 1, 3.2, 2.0, { modo: "quieto", dir: -90, accion: { tipo: "saltitos", cada: 0.8 }, semilla: 7 })] },
    cams: [{ desde: V(6, 0, 5.2, 0.6, { pan: 8, tilt: 11 }), hasta: V(10, 0, 4.9, 0.6, { pan: 8, tilt: 11 }), curva: "lineal", temblor: 0.2 }],
    // como en el original: "ESTAN LISTOS?" sin ¿ ni acento, girado en perspectiva (el lado izquierdo más cerca)
    textos: [{ texto: "ESTAN\nLISTOS?", x: 0.29, y: 0.335, tam: 14.6, interlinea: 1.05, espaciado: -0.04, giro: [0, 20, 0], prof: 0.35, color: "#f9b2fa", color2: "#ffc6ff", sombra: "#5a003e", sombra2: "#9a0e6c", relieve: 0.06, dur: 1.75 }] },
  // 16: vista cenital sobre el pasto con pétalos rosas: la oveja y los cubitos salen volando hacia la cámara dando vueltas
  { dur: 2.0, nombre: "Cerezos: vista de arriba, los animales saltan hacia la cámara",
    escena: { set: "cerezos", ambiente: "dia", actor: { x: -3, y: 0, z: 3, rot: 0 }, exp: 0.68, sat: 1.3, ocultar: true, focoMob: true,
      mobs: [mob("oveja", 1, 0, 0, { modo: "lanzar", vy: 6.2, ancho: 0.3, prof: 0.3 }), mob("cordero", 1, 1.4, 0.8, { modo: "lanzar", vy: 5.8, retraso: 0.25 }),
        { tipo: "cubito", color: "morado", n: 1, x: -0.7, z: 0.5, fijo: true, modo: "lanzar", vy: 7.4, retraso: 0.05, semilla: 9, foco: true },
        { tipo: "cubito", color: "verde", n: 1, x: 0.4, z: -0.6, fijo: true, modo: "lanzar", vy: 7.6, retraso: 0.15, semilla: 10 }] },
    cams: [{ fija: true, desde: V(0, 88, 5.6, 0), hasta: V(25, 88, 5.6, 0), curva: "lineal", temblor: 0.3 }] },
  // 17: callejón angosto entre dos casas con ventanas encendidas y cielo lila; el aldeano cruza corriendo al fondo
  { dur: 1.908, nombre: "Aldea: un aldeano cruza corriendo (COSAS SECRETAS)",
    escena: { set: "calle", ambiente: "lila", actor: { x: 0.5, y: 0, z: 1, rot: 0 }, ocultar: true, focoMob: true, sol: [0.6, 0.6, -0.5], exp: 0.82, sat: 1.35, calidez: 4,
      // cruza sobre el camino (sin pasto alto encima) y sale por la derecha hacia 23.8 s, antes del corte, como en el original
      mobs: [{ tipo: "aldeano", n: 1, x: -5.8, z: -2.5, fijo: true, dir: 90, vel: 8.0, modo: "correr", retraso: 0.12, foco: true }] },
    cams: [{ fija: true, desde: V(0, 0, 7.3, 0.6, { tilt: 11 }), hasta: V(0, 0, 7.2, 0.6, { tilt: 11 }), curva: "lineal", temblor: 0.2 }],
    textos: [{ texto: "COSAS\nSECRETAS", x: 0.512, y: 0.449, tam: 11.85, interlinea: 1.04, espaciado: -0.03, prof: 0.35, color: "#faf90d", color2: "#ffff2e", sombra: "#b0400c", sombra2: "#f2a018", relieve: 0.06, dur: 3.583 }] },
  // 18: LTezla cruza corriendo más lejos con los pollitos detrás
  { dur: 1.675, nombre: "Aldea: LTezla cruza corriendo con los pollitos",
    escena: { set: "calle", ambiente: "lila", sol: [0.6, 0.6, -0.5], actor: { x: -5.5, y: 0, z: -5.6, rot: 90 }, actorHasta: { x: 6.5 }, exp: 0.82, sat: 1.35, calidez: 4, ancla: { x: 0.5, z: 1, rot: 0 },
      mobs: [mob("pollito", 9, -9.5, -5.4, { dir: 90, vel: 6.4, modo: "correr", ancho: 1.0, prof: 1.4, escalonado: 0.3 })] },
    cams: [{ fija: true, desde: V(0, 0, 7.2, 0.6, { tilt: 11 }), hasta: V(0, 0, 7.1, 0.6, { tilt: 11 }), curva: "lineal", temblor: 0.2 }],
    poses: [["trotar", 1.675]], ojos: [["muy_feliz", 1.675]], matices: [["correr", 0, 1.675, 1]] },
  // 19: Nether de cerca: strider enorme mirando a la lente, cubitos rosas sobre bloques de nylium distorsionado, lava que cae
  { dur: 1.083, nombre: "Nether: strider de cerca y cubitos rosas",
    escena: { set: "nether", ambiente: "nether", actor: { x: 0.5, y: 0, z: 0, rot: 0 }, ocultar: true, focoMob: true, exp: 0.85, calidez: 3,
      mobs: [{ tipo: "strider", n: 1, x: -0.9, z: 1.4, fijo: true, dir: 25, vel: 0.35, foco: true }, mob("strider", 2, 2, -6, { dir: 20, vel: 0.5, ancho: 4, prof: 2 }),
        { tipo: "cubito", color: "rosa", n: 1, x: 4.5, z: -1.5, y: 2, fijo: true, modo: "quieto", dir: -20, suelo: true, semilla: 21 },
        { tipo: "cubito", color: "rosa", n: 1, x: 6.5, z: -2.5, y: 3, fijo: true, modo: "quieto", dir: -40, semilla: 22 },
        { tipo: "cubito", color: "rosa", n: 1, x: 5.5, z: -4.5, y: 4, fijo: true, modo: "quieto", dir: 10, semilla: 23 },
        mob("pollito", 2, -0.2, 0.2, { modo: "flotar", y: 1.8, ancho: 2.0, dir: 60, vel: 0.6 }), ...CUBITOS_NETHER] },
    cams: [{ fija: true, desde: V(-8, -12, 4.2, 1.3, { tilt: 14, pan: -14 }), hasta: V(-5, -12, 4.0, 1.3, { tilt: 14, pan: -14 }), curva: "lineal", temblor: 0.3 }] },
  { dur: 0.959, nombre: "Nether: plano general (LTEZLA VOTE)",
    escena: { exp: 0.9, calidez: 4, set: "nether", ambiente: "nether", actor: { x: 0.5, y: 0, z: 0, rot: 0 }, ocultar: true,
      mobs: [{ tipo: "strider", n: 1, x: 0.4, z: -0.6, fijo: true, dir: 200, vel: 0.4, foco: true }, mob("strider", 2, -4, -5, { dir: 160, vel: 0.5, ancho: 3, prof: 2 }),
        { tipo: "cubito", color: "rosa", n: 1, x: 4.5, z: -1.5, y: 2, fijo: true, modo: "quieto", dir: -20, semilla: 21 },
        { tipo: "cubito", color: "rosa", n: 1, x: 6.5, z: -2.5, y: 3, fijo: true, modo: "quieto", dir: -40, semilla: 22 },
        mob("pollito", 3, -2, 1.5, { modo: "correr", vel: 1.5, dir: 80, ancho: 3 }), ...CUBITOS_NETHER] },
    cams: [{ fija: true, desde: V(10, -2, 10.5, 1.4, { pan: -6, tilt: 9 }), hasta: V(8, -2, 10.2, 1.4, { pan: -6, tilt: 9 }), curva: "lineal", temblor: 0.2 }],
    textos: [{ texto: "LTEZLA\nVOTE", x: 0.497, y: 0.307, tam: 15.7, interlinea: 1.0, espaciado: -0.03, giro: [-12, 0, 0], prof: 0.45, color: "#fbfd0b", color2: "#ffff2a", sombra: "#e09600", sombra2: "#f6b80a", relieve: 0.09, dur: 0.959 }] },
  // 21: primer plano contra un cielo rosa LISO, arbustos lima y amarillos abajo
  { dur: 1.771, nombre: "Cielo rosa: LTezla de cerca voltea a la cámara",
    escena: { set: "pradera", ambiente: "rosa", exp: 1.25, actor: { x: 0, y: 0, z: 0, rot: 180 }, dof: 0.8 },
    cams: [{ desde: V(6, -19, 2.1, 1.35, { fov: 38, pan: -6, tilt: 9 }), hasta: V(6, -19, 2.0, 1.35, { fov: 38, pan: -6, tilt: 9 }), curva: "lineal", temblor: 0.2 }],
    poses: [[poseR("Mira a un lado (abajo)", { cabeza: [10, -36, -2], torso: [0, -8, 0], brazoD: [4, 0, -5], brazoI: [-2, 0, 5] }), 0.95], ["de_frente", 0.821, { trans: 0.2 }]],
    ojos: [["neutral", 0.95, -0.6, -0.3], ["determinado", 0.821, 0, 0, { aCamara: true }]] },
  // 22: atardecer: los mobs caminan hacia la lente MUY cerca (oveja, llama con baúl, pollitos, aldeano, cabras)
  { dur: 1.687, nombre: "Atardecer: los animales caminan hacia la cámara",
    escena: { set: "pradera", ambiente: "atardecer", cielo: [0, 6], sat: 1.25, sol: [0.3, 0.35, 1], actor: { x: 0, y: 0, z: 0, rot: 0 }, ocultar: true, focoMob: true,
      mobs: [{ tipo: "oveja", n: 1, x: -1.5, z: -1.1, fijo: true, dir: 175, vel: 1.5, semilla: 31 }, { tipo: "llama", baul: true, n: 1, x: 1.1, z: 0.9, fijo: true, dir: 185, vel: 1.45, semilla: 32 },
        { tipo: "oveja", n: 1, x: 2.2, z: -0.4, fijo: true, dir: 180, vel: 1.5, semilla: 33 }, mob("pollito", 2, 0.1, 0.6, { dir: 180, vel: 1.9, ancho: 1.4, modo: "correr", foco: true }),
        { tipo: "aldeano", n: 1, x: 2.6, z: 1.6, fijo: true, dir: 182, vel: 1.4, semilla: 34 }, { tipo: "cabrito", n: 1, x: -0.4, z: 1.2, fijo: true, dir: 178, vel: 1.5, semilla: 35 },
        { tipo: "cabra", n: 1, x: -1.4, z: 2.6, fijo: true, dir: 176, vel: 1.4, semilla: 36 }, mob("cordero", 1, 0.6, 2.4, { dir: 180, vel: 1.5 })] },
    cams: [{ fija: true, desde: V(180, 1, 3.8, 0.42, { tilt: 9 }), hasta: V(186, 1, 5.0, 0.42, { tilt: 9 }), curva: "lineal", temblor: 0.3 }] },
  // 23: de espaldas, LTezla con todos mirando el sol que se pone sobre una cordillera enorme (morada por la niebla)
  { dur: 1.725, nombre: "Atardecer: LTezla con todos mirando el sol",
    escena: { set: "cresta", ambiente: "atardecer", cielo: [180, 7], sol: [0.05, 0.22, -1], fondo: "cordillera", sat: 1.5, fondoCfg: { x: 0, y: -78, z: -420, escala: 3.6 }, niebla: ["#b98fe0", 140, 760],
      actor: { x: 0.5, y: 0, z: 0.6, rot: 180 }, fundido: { sale: 0.3 },
      mobs: [{ tipo: "llama", baul: true, n: 1, x: 2.4, z: 0.9, fijo: true, modo: "quieto", calmo: true, dir: 170 }, { tipo: "granjero", n: 1, x: -1.6, z: 0.3, fijo: true, modo: "quieto", calmo: true, dir: 180 },
        { tipo: "aldeano", n: 1, x: -3, z: 0.8, fijo: true, modo: "quieto", calmo: true, dir: 175 }, mob("pollito", 4, 0.8, 0.2, { modo: "quieto", calmo: true, ancho: 3, prof: 1 }),
        { tipo: "cabra", n: 1, x: 3.8, z: 0.2, fijo: true, modo: "quieto", calmo: true, dir: 200 }, { tipo: "oveja", n: 1, x: -1.0, z: 1.4, fijo: true, modo: "quieto", calmo: true, dir: 185 },
        { tipo: "cubito", color: "verde", n: 1, x: 1.6, z: -0.4, fijo: true, modo: "flotar", y: 0.5, vel: 0, dir: 180 }] },
    cams: [{ desde: V(184, 3, 7.4, 1.3, { tilt: 6 }), hasta: V(181, 3, 7.0, 1.3, { tilt: 6 }), curva: "lineal", temblor: 0.2 }],
    poses: [["contemplar", 1.725]], ojos: [["feliz", 1.725, 0, 0.4]] },
  { dur: 7.75, nombre: "Tarjeta final", escena: { negro: true },
    cams: [{ desde: V(0, 4, 4, 1.1) }],
    textos: [
      { texto: "LTEZLA", inicio: 0.3, x: 0.5, y: 0.122, tam: 10.5, giro: [-18, 0, 0], prof: 0.5, color: "#d8d3d2", color2: "#efeaea", sombra: "#3e3a3a", sombra2: "#6a6464", relieve: 0.07, dur: 7.45, fundido: { entra: 0.55, sale: 1.2 }, anim: "aparecer", deriva: 0 },
      { texto: "LIVE", inicio: 0.3, x: 0.5, y: 0.235, tam: 7.1, espaciado: 0.12, prof: 0.08, color: "#ffffff", color2: "#ffffff", sombra: "#c9c9c9", relieve: 0.02, caja: "#e0262d", cajaSombra: "#9a0f15", halo: "#e0262d", dur: 7.45, fundido: { entra: 0.55, sale: 1.2 }, anim: "aparecer", deriva: 0 },
      { texto: "MARZO 21", inicio: 0.3, x: 0.5, y: 0.478, tam: 7.15, prof: 0.12, color: "#fdf3f4", color2: "#ffffff", sombra: "#6a5a5a", relieve: 0.03, dur: 7.45, fundido: { entra: 0.55, sale: 1.2 }, anim: "aparecer", deriva: 0 },
      { texto: "10:00 AM GMT-6", inicio: 0.3, x: 0.5, y: 0.557, tam: 5.57, prof: 0.12, color: "#fdf3f4", color2: "#ffffff", sombra: "#6a5a5a", relieve: 0.03, dur: 7.45, fundido: { entra: 0.55, sale: 1.2 }, anim: "aparecer", deriva: 0 },
      { texto: "¡NO TE LO PIERDAS!", inicio: 0.3, x: 0.5, y: 0.617, tam: 2.6, peso: 400, prof: 0.08, color: "#e8e0e0", sombra: "#444", relieve: 0, dur: 7.45, fundido: { entra: 0.55, sale: 1.2 }, anim: "aparecer", deriva: 0 },
    ] },
];

// golpes de la música del original (AST "Bang" y cortes), para poner impactos
const GOLPES_TRAILER = [2.0, 3.75, 4.5, 6.2, 8.0, 11.0, 12.2, 14.5, 15.5, 18.542, 21.0, 22.292, 23.0, 24.5, 25.875, 27.917, 29.5, 33.1];      // cortes + golpes que AST oyó en el original
export const MUSICA_TRAILER = "Upbeat playful electronic game music, 128 bpm, kick on every beat, plucky square-wave lead, glittery arpeggios, warm synth bass, whoosh and boom accents, joyful and energetic like a Minecraft update trailer. 2 second fade-in intro, energetic main section, breakdown with build-up around 24 seconds, final drop, ends at 33 seconds with an epic hit and a soft 7 second fading outro. No vocals.";

function armarTrailer() {
  const k = { escenas: [], camara: [], poses: [], ojos: [], matices: [], textos: [], audio: [] };
  let t0 = 0;
  for (const s of TOMAS_TRAILER) {
    k.escenas.push({ id: nuevoId(), dur: s.dur, nombre: s.nombre, mobs: [], ...s.escena });
    for (const c of s.cams) {
      const { dur, desde, hasta, ...resto } = c;
      k.camara.push({ id: nuevoId(), tipo: "libre", dur: dur ?? s.dur, desde, hasta: hasta || desde, curva: "lineal", ...resto });
    }
    (s.poses || [["reposo", s.dur]]).forEach(([pose, dur, extra = {}], i) => {
      const obj = typeof pose === "string" ? copiaPose(pose) : { ...pose, editada: true };
      k.poses.push({ id: nuevoId(), pose: obj, dur, trans: i === 0 ? 0 : 0.35, curva: "natural", ...(i === 0 ? { corte: true } : {}), ...extra });
    });
    for (const [cara, dur, mx = 0, my = 0, extra = {}] of s.ojos || [["feliz", s.dur]]) k.ojos.push(clipOjos(cara, dur, mx, my, extra));
    for (const [tipo, ini, dur, inten] of s.matices || []) k.matices.push(clipMatiz(tipo, t0 + ini, dur, inten));
    for (const x of s.textos || []) k.textos.push({ id: nuevoId(), anim: "golpe", ...x, inicio: t0 + (x.inicio || 0) });
    t0 += s.dur;
  }
  // música: el primer golpe de bajo de la pista cae en 2.41 s, como en el original (medido con analisis/musica)
  k.audio.push({ id: nuevoId(), tipo: "musica", texto: MUSICA_TRAILER, durSfx: 41, desde: 12.62, inicio: 0, dur: 40.85, vol: 0.95, salida: 1.6 });
  for (const g of GOLPES_TRAILER) k.audio.push(clipSfx("short deep cinematic boom impact with a quick whoosh, trailer hit", g - 0.05, 1.2, { vol: 0.75, durSfx: 1.2 }));
  k.audio.push(clipSfx("a group of baby chicks peeping and chirping while running", 1.9, 2.0, { vol: 0.22, durSfx: 2 }));
  k.audio.push(clipSfx("a group of baby chicks peeping and chirping while running", 15.0, 2.0, { vol: 0.2, durSfx: 2 }));
  k.audio.push(clipSfx("underwater bubbles and muffled swimming", 11.0, 2.0, { vol: 0.25, durSfx: 2 }));
  return k;
}

export const PLANTILLAS = {
  trailer: {
    nombre: "Tráiler (video Benly · Bobicraft)", desc: "Réplica: 25 tomas, mobs reales, títulos y música",
    proyecto: {
      escena: { fondo: "mundo", terreno: "aldea", marco: "ninguno", sombras: true, texturas: "barebones", actor: { x: 0.5, y: 0, z: 0.5, rot: 0 } },
      efectos: { calidad: "cine", ao: true, dof: 0.36, grano: 0.02, aberracion: 0.15, vineta: 0.12, saturacion: 1.58, suavidad: 0.06, brillo: 0.33, contraste: 1.15, balance: [0.915, 1, 1.11] },
      formato: "1280x720", vistaCamara: true,
    },
    crear: armarTrailer,
  },
  benly: {
    nombre: "Vlog (video Benly)", desc: "Réplica: balcón, cámara en mano y REC",
    // Armada con el análisis del original (analisis/analisis_emociones.md): mismos tiempos de voz,
    // mismas emociones y lenguaje corporal, y el final caminando hacia atrás con la cámara en la mano.
    proyecto: {
      escena: { fondo: "mundo", terreno: "balcon", marco: "rec", sombras: true, cielo: "#a9d3f7", actor: { x: 0.5, y: 0, z: 0.5, rot: 0 } },
      efectos: { calidad: "cine", ao: true, dof: 0.75, grano: 0.24, aberracion: 0.55, vineta: 0.3, saturacion: 1.4, suavidad: 1.0 },
      formato: "1706x720", vistaCamara: true,
    },
    crear: () => ({
      poses: [
        clipPose("lejos", 0.05, { trans: 0 }),                                  // entra desde atrás, desenfocado
        clipPose("sorpresa_leve", 0.6, { trans: 0.38 }),                         // "¡Hola!": se sorprende de vernos
        clipPose("saludar", 0.95, { trans: 0.25 }),
        clipPose("ladear", 0.9, { trans: 0.55 }),                                // "no los había visto"
        clipPose("timido", 0.5, { trans: 0.3 }),                                 // mirada apenada hacia abajo
        clipPose("dudar", 1.0, { trans: 0.35 }),                                 // "¿sí?" de reojo
        clipPose("risa_nuca", 1.7, { trans: 0.35 }),                             // risa con pena, mano en la nuca
        clipPose("risa_atras", 2.0, { trans: 0.5 }),                             // carcajada, cabeza atrás
        clipPose("mirar_picaro", 0.6, { trans: 0.45 }),                          // vuelve a vernos, pícaro (≈8.0 s como el original)
        clipPose("ladear", 0.9, { trans: 0.4 }),
        clipPose("mano_pecho", 1.6, { trans: 0.35 }),                            // "me presento"
        clipPose("presentarse", 0.9, { trans: 0.28 }),                           // "soy LTezla" + guiño
        clipPose("tomar_camara", 0.6, { trans: 0.58 }),                          // se acerca y agarra la cámara
        clipPose("sostener_camara", 1.9, { trans: 0.45 }),                       // "y los invito a acompañarme"
        clipPoseObj({ ...copiaPose("manos_juntas"), nombre: "Se aleja (manos juntas)", p: [0, 0.3, -30] }, 1.15, { trans: 1.1, curva: "lineal" }),
        clipPoseObj({ ...copiaPose("manos_juntas"), nombre: "Giro rápido: ¡vamos!", p: [0, 0.3, -36], r: { ...POSES.manos_juntas.r, raiz: [0, 70, 0], cabeza: [-4, -35, 0] } }, 0.35, { trans: 0.22, curva: "salida" }),
      ],
      ojos: [
        clipOjos("sorprendido", 0.65, 0, 0, aC), clipOjos("muy_feliz", 0.95, 0, 0, aC), clipOjos("feliz", 0.9, 0, 0, aC),
        clipOjos("avergonzado", 0.5, -0.3, -0.6), clipOjos("sospecha", 1.0, 0.8, 0.1),
        clipOjos("muy_feliz", 1.7), clipOjos("riendo", 2.0),
        clipOjos("picaro", 0.6, 0, 0, aC), clipOjos("feliz", 0.9, 0, 0, aC), clipOjos("feliz", 1.6, 0, 0, aC),
        clipOjos("guino", 0.9, 0, 0, aC), clipOjos("feliz", 0.6, 0, 0, aC), clipOjos("feliz", 1.9, 0, 0, aC),
        clipOjos("muy_feliz", 0.5, 0, 0, aC), clipOjos("feliz", 1.0, 0, 0, aC),
      ],
      matices: [
        clipMatiz("caminar", 0, 0.55, 1.1), clipMatiz("balancear", 1.7, 1.0, 0.9), clipMatiz("hablar", 1.5, 1.5, 1.0), clipMatiz("negar", 3.1, 0.8, 0.45), clipMatiz("reir", 4.1, 3.6, 0.85), clipMatiz("balancear", 8.3, 0.9, 1.0), clipMatiz("asentir", 9.2, 1.4, 0.9), clipMatiz("hablar", 8.4, 1.6, 0.9),
        clipMatiz("caminar", 11.7, 0.6, 0.6), clipMatiz("caminar_atras", 14.2, 1.5, 1.9), clipMatiz("balancear", 14.0, 1.7, 1.1), clipMatiz("asentir", 14.3, 1.2, 0.5),
      ],
      camara: [
        clipCamaraVista("vlog", 12.3, { desde: { az: -14, el: 1, dist: 1.85, ty: 1.55, fov: 42 }, hasta: { az: -8, el: 0, dist: 1.7, ty: 1.58, fov: 42 }, buscarFoco: true, temblor: 1.4 }),
        clipCamaraVista("agarre", 1.9, { desde: { az: -8, el: 0, dist: 1.7, ty: 1.58, fov: 42 }, hasta: { az: 3, el: 3, dist: 1.5, ty: 1.66, fov: 40, roll: -4 } }),
        clipCamaraVista("llevada", 1.5, { desde: { az: 3, el: 3, dist: 1.5, ty: 1.66, fov: 40, roll: -4 }, hasta: { az: -3, el: 4, dist: 1.55, ty: 1.66, fov: 40, roll: 3 } }),
      ],
      // mismo guion y tiempos que el original (transcrito con Whisper), con la voz de LTezla
      audio: [
        // elegidos "de oído" con herramientas/escuchar.py y elegir_audio.py (AST / CLAP), comparando con el original
        clipVoz("[surprised] ¡Hola!", 0.05, { vol: 0.45 }), clipVoz("[gasps] ¡Oh!", 0.95, { vol: 0.35, dur: 0.75 }),
        clipVoz("No los había visto.", 1.3, { vol: 0.45 }), clipVoz("[sighs] Mmm...", 2.95, { vol: 0.3, dur: 0.6 }),
        clipVoz("[curious] ¿Sí?", 3.5, { vol: 0.45 }),
        clipSfx("teenage boy snickering then laughing softly, playful giggle", 4.85, 3, { vol: 0.62, durSfx: 3 }),
        clipVoz("[sighs] Mmm...", 7.8, { vol: 0.25, dur: 0.6 }),
        clipVoz("Me presento.", 8.45, { vol: 0.45 }), clipVoz("Soy LTezla,", 10.25, { vol: 0.45 }),
        clipVoz("[excited] y los invito a acompañarme... ¡a algo maravilloso!", 11.1, { vol: 0.5 }),
        clipSfx("soft whimsical magical music, gentle bells and pizzicato strings, sense of wonder, slowly building up", 10.3, 6, { vol: 0.46, durSfx: 6, entrada: 1.5 }),
        clipSfx("two soft footsteps on smooth stone floor", 11.7, 1, { vol: 0.4 }),
        clipSfx("small handheld camera grabbed and fumbled, plastic handling noise close to microphone", 12.2, 0.8, { vol: 0.5 }),
        clipSfx("two soft footsteps on smooth stone floor", 14.3, 1, { vol: 0.35 }),
        clipSfx("quiet city balcony ambience, distant traffic, light wind, no music", 0, 15.7, { vol: 0.16, durSfx: 15.7 }),
      ],
    }),
  },
  saludo: {
    nombre: "Saludo", desc: "Saluda, sonríe y guiña",
    crear: () => ({
      poses: [clipPose("reposo", 0.7), clipPose("saludar", 1.8, { curva: "rebote", trans: 0.35 }), clipPose("pulgar", 1.3), clipPose("relajado", 1.2)],
      ojos: [clipOjos("neutral", 0.6), clipOjos("muy_feliz", 1.9), clipOjos("guino", 1.2), clipOjos("feliz", 1.3)],
      matices: [clipMatiz("hablar", 0.8, 1.6)],
      camara: [clipCamara("tres_cuartos", 2.4), clipCamara("plano_medio", 2.6)],
    }),
  },
  charla: {
    nombre: "Charla", desc: "Habla, piensa y explica",
    crear: () => ({
      poses: [clipPose("relajado", 1.4), clipPose("encogerse", 1.2), clipPose("pensar", 1.6), clipPose("senalar", 1.3), clipPose("ofrecer", 1.5)],
      ojos: [clipOjos("neutral", 1.4), clipOjos("confundido", 1.2), clipOjos("pensativo", 1.6, 0.4, 0.6), clipOjos("determinado", 1.3), clipOjos("feliz", 1.5)],
      matices: [clipMatiz("hablar", 0.2, 2.4), clipMatiz("asentir", 4.3, 1.2), clipMatiz("hablar", 5.4, 1.6)],
      camara: [clipCamara("plano_medio", 3.4), clipCamara("primer_plano", 1.6), clipCamara("tres_cuartos", 2)],
    }),
  },
  baile: {
    nombre: "Baile", desc: "Pasos rápidos y dab final",
    crear: () => ({
      poses: [clipPose("baile", 1.6), clipPose("disco", 0.6, { trans: 0.15, curva: "rebote" }), clipPose("baile", 1.2), clipPose("robot", 1.2, { curva: "corte" }), clipPose("dab", 1.4, { trans: 0.2, curva: "rebote" })],
      ojos: [clipOjos("muy_feliz", 2.2), clipOjos("emocionado", 2.4), clipOjos("picaro", 1.4), clipOjos("ojos_cerrados", 1.0)],
      matices: [clipMatiz("rebotar", 0, 4.6)],
      camara: [clipCamara("orbita", 6)],
    }),
  },
  susto: {
    nombre: "Susto", desc: "Algo lo asusta de repente",
    crear: () => ({
      poses: [clipPose("relajado", 1.2), clipPose("sorpresa", 0.8, { trans: 0.12, curva: "rebote" }), clipPose("miedo", 2)],
      ojos: [clipOjos("aburrido", 1.2, -0.3), clipOjos("sorprendido", 0.8, 0.8, 0), clipOjos("asustado", 2, 0.5, 0)],
      matices: [clipMatiz("temblar", 2, 2)],
      camara: [clipCamara("plano_medio", 1.2), clipCamara("en_mano", 2.8)],
    }),
  },
  victoria: {
    nombre: "Victoria", desc: "Se agacha, salta y celebra",
    crear: () => ({
      poses: [clipPose("en_guardia", 1), clipPose("agachado", 0.6), clipPose("salto", 0.5, { trans: 0.18, curva: "salida" }), clipPose("celebrar", 1.8, { trans: 0.25, curva: "rebote" }), clipPose("victoria", 1.4)],
      ojos: [clipOjos("determinado", 1.6), clipOjos("emocionado", 1.6), clipOjos("muy_feliz", 2.1)],
      matices: [clipMatiz("reir", 3.2, 1.6)],
      camara: [clipCamara("contrapicado", 2.4), clipCamara("alejar", 2.9)],
    }),
  },
  triste: {
    nombre: "Triste", desc: "Se pone triste y llora",
    crear: () => ({
      poses: [clipPose("reposo", 1), clipPose("triste", 2.4, { trans: 1 }), clipPose("timido", 1.6)],
      ojos: [clipOjos("neutral", 1), clipOjos("triste", 1.4), clipOjos("llorando", 2.6)],
      matices: [clipMatiz("agitado", 2.6, 2.2, 0.6)],
      camara: [clipCamara("acercar", 5)],
    }),
  },
  enojo: {
    nombre: "Enojo", desc: "Facepalm y se enoja",
    crear: () => ({
      poses: [clipPose("reposo", 0.8), clipPose("facepalm", 1.6), clipPose("enojado", 1.4, { trans: 0.2, curva: "rebote" }), clipPose("cruzados", 1.6)],
      ojos: [clipOjos("neutral", 0.8), clipOjos("ojos_cerrados", 1.6), clipOjos("furioso", 1.4), clipOjos("enojado", 1.6, 0.6)],
      matices: [clipMatiz("negar", 0.9, 1.4), clipMatiz("temblar", 2.4, 1.2, 0.7)],
      camara: [clipCamara("frente", 2.4), clipCamara("primer_plano", 1.4), clipCamara("tres_cuartos", 1.6)],
    }),
  },
};

export function sorprendeme() {
  const ids = Object.keys(POSES).filter(k => !["sentado", "volar", "reverencia"].includes(k));
  const caras = Object.keys(EXPRESIONES);
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const n = 4 + Math.floor(Math.random() * 3);
  const poses = [clipPose("reposo", 0.6)], ojos = [clipOjos("neutral", 0.6)];
  for (let i = 0; i < n; i++) {
    const d = +(0.8 + Math.random() * 1.2).toFixed(1);
    poses.push(clipPose(pick(ids), d, { curva: pick(["suave", "suave", "rebote", "salida"]) }));
    ojos.push(clipOjos(pick(caras), d, +(Math.random() * 1.2 - 0.6).toFixed(2), +(Math.random() * 0.8 - 0.4).toFixed(2)));
  }
  const total = poses.reduce((s, c) => s + c.dur, 0);
  return {
    poses, ojos,
    matices: [clipMatiz(pick(["hablar", "rebotar", "balancear", "asentir"]), 0.8, Math.min(2.5, total - 1))],
    camara: [clipCamara(pick(["tres_cuartos", "plano_medio", "contrapicado"]), total / 2), clipCamara(pick(["orbita", "acercar", "paneo", "en_mano"]), total / 2)],
  };
}
