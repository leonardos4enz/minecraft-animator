// Biblioteca: poses, matices (movimientos que se suman encima), tomas de cámara y curvas.
// Rotaciones en grados (Euler XYZ por junta). Convenciones:
//   brazo: x− = hacia adelante, z− (der.) / z+ (izq.) = hacia el lado · codo: x− = doblar hacia adelante
//   pierna: x− = hacia adelante · rodilla: x+ = doblar hacia atrás
//   cabeza: x+ = mirar abajo, y+ = girar a su izquierda, z = inclinar · torso: x+ = inclinarse adelante
//   raiz.p = desplazamiento del cuerpo en pixeles de skin (y− = agacharse)
// mov: movimiento propio de la pose mientras se mantiene: [{j, e (0=x,1=y,2=z), a (grados), f (Hz), fase}]

const P = (nombre, cat, r, extra = {}) => ({ nombre, cat, r, ...extra });

export const CATEGORIAS = ["Básicas", "Gestos", "Emociones", "Acción", "Baile"];

export const POSES = {
  reposo: P("Reposo", "Básicas", { brazoD: [0, 0, -3], brazoI: [0, 0, 3], codoD: [-6, 0, 0], codoI: [-6, 0, 0] }),
  relajado: P("Relajado", "Básicas", { torso: [0, 6, 2], cabeza: [4, -10, -4], brazoD: [6, 0, -5], codoD: [-14, 0, 0], brazoI: [-4, 0, 6], codoI: [-10, 0, 0], piernaD: [-4, 0, -3], piernaI: [3, 0, 2], rodillaD: [6, 0, 0] }),
  firmes: P("Firmes", "Básicas", { cabeza: [-3, 0, 0] }),
  jarras: P("Manos en la cintura", "Básicas", { brazoD: [10, 0, -42], codoD: [0, 0, 82], brazoI: [10, 0, 42], codoI: [0, 0, -82], piernaD: [0, 0, -4], piernaI: [0, 0, 4], cabeza: [-4, 0, 0] }),
  cruzados: P("Brazos cruzados", "Básicas", { brazoD: [-28, 0, 12], codoD: [-30, 0, 95], brazoI: [-34, 0, -12], codoI: [-24, 0, -95], cabeza: [-4, 8, 0], piernaD: [0, 0, -3], piernaI: [0, 0, 3] }),
  paso: P("Paso", "Básicas", { piernaD: [-30, 0, 0], rodillaD: [12, 0, 0], piernaI: [24, 0, 0], rodillaI: [28, 0, 0], brazoD: [26, 0, -4], codoD: [-14, 0, 0], brazoI: [-26, 0, 4], codoI: [-22, 0, 0], torso: [4, 0, 0], raiz: [0, 0, 0] }, { p: [0, -0.4, 0] }),
  correr: P("Correr", "Básicas", { piernaD: [-60, 0, 0], rodillaD: [40, 0, 0], piernaI: [40, 0, 0], rodillaI: [70, 0, 0], brazoD: [50, 0, -6], codoD: [-70, 0, 0], brazoI: [-60, 0, 6], codoI: [-80, 0, 0], torso: [16, 0, 0], cabeza: [-10, 0, 0] }, { p: [0, -0.8, 0] }),
  salto: P("Salto", "Básicas", { piernaD: [-30, 0, -4], rodillaD: [60, 0, 0], piernaI: [-10, 0, 4], rodillaI: [40, 0, 0], brazoD: [0, 0, -140], brazoI: [0, 0, 140], cabeza: [-12, 0, 0] }, { p: [0, 5, 0] }),
  agachado: P("Agachado", "Básicas", { piernaD: [-70, 0, -6], rodillaD: [70, 0, 0], piernaI: [-70, 0, 6], rodillaI: [70, 0, 0], torso: [30, 0, 0], cabeza: [-25, 0, 0], brazoD: [-40, 0, -8], codoD: [-30, 0, 0], brazoI: [-40, 0, 8], codoI: [-30, 0, 0] }, { p: [0, -4, -4] }),
  sentado: P("Sentado", "Básicas", { piernaD: [-90, 0, -4], piernaI: [-90, 0, 4], torso: [-8, 0, 0], cabeza: [4, 0, 0], brazoD: [24, 0, -16], brazoI: [24, 0, 16] }, { p: [0, -10, 0] }),
  reverencia: P("Reverencia", "Básicas", { torso: [50, 0, 0], cabeza: [10, 0, 0], brazoD: [-10, 0, 0], codoD: [-90, 0, 20], brazoI: [20, 0, 10] }),

  saludar: P("Saludar", "Gestos", { brazoD: [-10, 0, -125], codoD: [0, 0, -30], brazoI: [0, 0, 4], cabeza: [0, -8, -6] }, { mov: [{ j: "codoD", e: 2, a: 24, f: 2.2 }] }),
  hola_dos: P("Hola con las dos", "Gestos", { brazoD: [-10, 0, -140], codoD: [0, 0, -20], brazoI: [-10, 0, 140], codoI: [0, 0, 20], cabeza: [-8, 0, 0] }, { mov: [{ j: "brazoD", e: 2, a: 14, f: 2 }, { j: "brazoI", e: 2, a: -14, f: 2 }] }),
  senalar: P("Señalar", "Gestos", { brazoD: [-90, -12, 0], torso: [0, -10, 0], cabeza: [0, -8, 0], brazoI: [5, 0, 5] }),
  senalar_arriba: P("Señalar arriba", "Gestos", { brazoD: [-168, 0, -8], cabeza: [-25, 0, 0], brazoI: [0, 0, 6] }),
  pulgar: P("Pulgar arriba", "Gestos", { brazoD: [-50, 0, -8], codoD: [-60, 0, 0], cabeza: [0, 0, -6], brazoI: [0, 0, 4] }),
  encogerse: P("Encogerse", "Gestos", { brazoD: [0, 0, -12], codoD: [-60, 0, -45], brazoI: [0, 0, 12], codoI: [-60, 0, 45], cabeza: [0, 0, 10] }, { p: [0, 0.5, 0] }),
  ofrecer: P("Ofrecer", "Gestos", { brazoD: [-55, 0, -6], codoD: [-25, 0, 0], brazoI: [-55, 0, 6], codoI: [-25, 0, 0], torso: [6, 0, 0], cabeza: [8, 0, 0] }),
  presentar: P("Presentar", "Gestos", { brazoI: [-20, 0, 70], codoI: [-20, 0, 0], torso: [0, -12, 0], cabeza: [0, 15, 0], brazoD: [0, 0, -4] }),
  pensar: P("Pensar", "Gestos", { brazoD: [-25, 0, 10], codoD: [-125, 0, 0], brazoI: [-30, 0, -10], codoI: [-80, 0, -50], cabeza: [-8, 0, -10] }),
  facepalm: P("Facepalm", "Gestos", { brazoD: [-110, 0, 22], codoD: [-75, 0, 0], cabeza: [25, 0, 0], torso: [10, 0, 0], brazoI: [0, 0, 6] }),
  aplaudir: P("Aplaudir", "Gestos", { brazoD: [-60, 0, 22], codoD: [-50, 0, 0], brazoI: [-60, 0, -22], codoI: [-50, 0, 0], cabeza: [-5, 0, 0] }, { mov: [{ j: "brazoD", e: 2, a: 10, f: 3.5 }, { j: "brazoI", e: 2, a: -10, f: 3.5 }] }),
  saludo_militar: P("Saludo militar", "Gestos", { brazoD: [-30, -10, -85], codoD: [-30, 0, 120], cabeza: [-4, 0, 0] }),
  estirarse: P("Estirarse", "Gestos", { brazoD: [0, 0, -168], codoD: [-30, 0, 0], brazoI: [0, 0, 168], codoI: [-30, 0, 0], torso: [-10, 0, 0], cabeza: [-20, 0, 0] }),

  celebrar: P("Celebrar", "Emociones", { brazoD: [0, 0, -160], codoD: [-15, 0, 0], brazoI: [0, 0, 160], codoI: [-15, 0, 0], cabeza: [-15, 0, 0] }, { p: [0, 0.6, 0], mov: [{ j: "brazoD", e: 2, a: 8, f: 3 }, { j: "brazoI", e: 2, a: -8, f: 3 }] }),
  victoria: P("Victoria", "Emociones", { brazoD: [-170, 0, -10], brazoI: [10, 0, 10], cabeza: [-10, 0, 0], torso: [-5, 0, 0] }),
  timido: P("Tímido", "Emociones", { cabeza: [20, 15, 8], brazoD: [-15, 0, 15], codoD: [-30, 0, 0], brazoI: [-15, 0, -15], codoI: [-30, 0, 0], piernaI: [-6, 0, 0], rodillaI: [12, 0, 0], torso: [6, 0, 0] }),
  sorpresa: P("Sorpresa", "Emociones", { brazoD: [-30, 0, -35], codoD: [-110, 0, 0], brazoI: [-30, 0, 35], codoI: [-110, 0, 0], torso: [-8, 0, 0], cabeza: [-10, 0, 0] }, { p: [0, 0, -0.5] }),
  miedo: P("Miedo", "Emociones", { torso: [-14, 0, 0], cabeza: [12, 0, 0], brazoD: [-80, 0, -15], codoD: [-80, 0, 0], brazoI: [-80, 0, 15], codoI: [-80, 0, 0], piernaD: [8, 0, -5], rodillaD: [10, 0, 0] }, { p: [0, -0.7, -1] }),
  enojado: P("Enojado", "Emociones", { torso: [10, 0, 0], cabeza: [8, 0, 0], brazoD: [10, 0, -14], codoD: [-20, 0, 0], brazoI: [10, 0, 14], codoI: [-20, 0, 0], piernaD: [0, 0, -4], piernaI: [0, 0, 4] }),
  triste: P("Triste", "Emociones", { torso: [16, 0, 0], cabeza: [26, 0, 0], brazoD: [-6, 0, -2], codoD: [-6, 0, 0], brazoI: [-6, 0, 2], codoI: [-6, 0, 0] }, { p: [0, -0.3, 0] }),
  chulo: P("Chulo", "Emociones", { torso: [0, 10, -4], cabeza: [-4, -15, 8], brazoD: [0, 0, -38], codoD: [0, 0, 80], brazoI: [-40, 0, 10], codoI: [-60, 0, 0], piernaD: [-6, 0, -6], piernaI: [4, 0, 0], rodillaI: [14, 0, 0] }),

  en_guardia: P("En guardia", "Acción", { piernaD: [-25, 0, -5], rodillaD: [25, 0, 0], piernaI: [15, 0, 5], rodillaI: [20, 0, 0], torso: [8, -20, 0], brazoD: [-70, 0, -10], codoD: [-100, 0, 0], brazoI: [-60, 0, 10], codoI: [-110, 0, 0], cabeza: [5, 18, 0] }, { p: [0, -1, 0] }),
  punetazo: P("Puñetazo", "Acción", { brazoD: [-90, 0, 0], torso: [8, 25, 0], brazoI: [-60, 0, 10], codoI: [-110, 0, 0], piernaD: [-25, 0, -5], rodillaD: [25, 0, 0], piernaI: [15, 0, 5], rodillaI: [20, 0, 0], cabeza: [0, -20, 0] }, { p: [0, -1, 0] }),
  patada: P("Patada", "Acción", { piernaD: [-95, 0, 0], rodillaD: [5, 0, 0], piernaI: [5, 0, 0], torso: [-15, 0, 0], brazoD: [-20, 0, -50], brazoI: [-20, 0, 50] }),
  espadazo: P("Espadazo", "Acción", { brazoD: [-150, 0, -20], codoD: [-30, 0, 0], torso: [-6, -15, 0], piernaD: [-25, 0, -5], rodillaD: [20, 0, 0], piernaI: [15, 0, 5], brazoI: [-30, 0, 20] }),
  // con espada (u otra herramienta): la muñeca (munecaD) gira la hoja respecto al puño
  guardia_espada: P("Guardia con espada", "Acción", { piernaD: [-25, 0, -5], rodillaD: [25, 0, 0], piernaI: [15, 0, 5], rodillaI: [20, 0, 0], torso: [8, -18, 0], cabeza: [4, 16, 0], brazoD: [-32, 0, -14], codoD: [-45, 0, 0], munecaD: [55, 0, 0], brazoI: [-20, 0, 18], codoI: [-35, 0, 0] }, { p: [0, -1, 0] }),
  espada_atras: P("Espada atrás (preparar golpe)", "Acción", { piernaD: [-28, 0, -5], rodillaD: [28, 0, 0], piernaI: [18, 0, 5], rodillaI: [22, 0, 0], torso: [-8, -35, 0], cabeza: [6, 30, 0], brazoD: [-160, 0, -22], codoD: [-22, 0, 0], munecaD: [10, 0, 0], brazoI: [-45, 0, 22], codoI: [-40, 0, 0] }, { p: [0, -1.2, 0] }),
  espada_golpe: P("Golpe de espada", "Acción", { piernaD: [-35, 0, -5], rodillaD: [35, 0, 0], piernaI: [22, 0, 5], rodillaI: [18, 0, 0], torso: [22, 25, 0], cabeza: [0, -18, 0], brazoD: [-55, 0, 18], codoD: [-8, 0, 0], munecaD: [120, 0, 0], brazoI: [10, 0, 25], codoI: [-25, 0, 0] }, { p: [0, -1.6, 0] }),
  estocada: P("Estocada", "Acción", { piernaD: [-45, 0, -4], rodillaD: [40, 0, 0], piernaI: [30, 0, 4], rodillaI: [10, 0, 0], torso: [18, 20, 0], cabeza: [-6, -16, 0], brazoD: [-88, 0, -4], codoD: [-4, 0, 0], munecaD: [130, 0, 0], brazoI: [20, 0, 30], codoI: [-20, 0, 0] }, { p: [0, -1.8, 0] }),
  victoria_espada: P("Victoria con espada", "Acción", { brazoD: [-172, 0, -10], codoD: [-4, 0, 0], munecaD: [130, 0, 0], brazoI: [-20, 0, 25], codoI: [-60, 0, 0], torso: [-8, 0, 0], cabeza: [-22, 0, 0], piernaD: [-6, 0, -6], piernaI: [6, 0, 6] }),
  minar: P("Minar", "Acción", { brazoD: [-80, 0, -5], codoD: [-30, 0, 0], torso: [6, 0, 0], cabeza: [12, 0, 0], brazoI: [0, 0, 5] }, { mov: [{ j: "brazoD", e: 0, a: 35, f: 2.2 }] }),
  volar: P("Volar", "Acción", { brazoD: [-170, 0, -8], brazoI: [-170, 0, 8], cabeza: [-50, 0, 0], raiz: [80, 0, 0] }, { p: [0, 6, 0] }),

  dab: P("Dab", "Baile", { brazoI: [-30, 0, 125], brazoD: [-95, -30, 45], codoD: [-95, 0, 0], cabeza: [30, 25, 0], torso: [10, 10, 0] }),
  baile: P("Baile", "Baile", { brazoD: [-30, 0, -60], codoD: [-60, 0, 0], brazoI: [-30, 0, 60], codoI: [-60, 0, 0] }, { mov: [{ j: "torso", e: 1, a: 15, f: 1.8 }, { j: "brazoD", e: 0, a: 30, f: 1.8 }, { j: "brazoI", e: 0, a: -30, f: 1.8 }, { j: "cabeza", e: 2, a: 8, f: 1.8 }] }),
  disco: P("Disco", "Baile", { brazoD: [-20, 0, -150], brazoI: [10, 0, 30], codoI: [-40, 0, 0], torso: [0, 0, 8], cabeza: [0, 10, -8], piernaD: [0, 0, -8], rodillaI: [20, 0, 0] }),
  ladear: P("Ladear la cabeza", "Emociones", { cabeza: [-4, -12, 18], torso: [0, 0, -4], brazoD: [4, 0, -5], codoD: [-12, 0, 0], brazoI: [0, 0, 6], codoI: [-10, 0, 0] }),
  mano_pecho: P("Mano en el pecho", "Emociones", { brazoI: [-35, 0, -15], codoI: [-95, 0, -30], brazoD: [0, 0, -5], cabeza: [6, 8, 6], torso: [4, 0, 0] }, { mov: [{ j: "torso", e: 1, a: 5, f: 0.8 }, { j: "cabeza", e: 2, a: 5, f: 0.9 }] }),
  voltear: P("Voltear atrás", "Básicas", { raiz: [0, 140, 0], cabeza: [-4, -35, 0], torso: [0, -10, 0], brazoD: [6, 0, -4], brazoI: [-6, 0, 4] }),
  alcanzar: P("Alcanzar la cámara", "Gestos", { brazoD: [-80, -10, 10], codoD: [-20, 0, 0], brazoI: [-75, 10, -10], codoI: [-25, 0, 0], torso: [12, 0, 0], cabeza: [-6, 0, 0] }, { p: [0, 0, 1] }),
  manos_nuca: P("Manos en la nuca", "Gestos", { brazoD: [-20, 0, -140], codoD: [-120, 0, 0], brazoI: [-20, 0, 140], codoI: [-120, 0, 0], cabeza: [-6, 0, 0], torso: [-4, 0, 0] }),
  lejos: P("Llegando (atrás)", "Básicas", { brazoD: [12, 0, -4], brazoI: [-12, 0, 4], cabeza: [-4, 0, 0] }, { p: [0, 0, -26] }),
  sorpresa_leve: P("Sorpresa leve", "Emociones", { torso: [-10, 0, 0], cabeza: [-10, 0, 0], brazoD: [-15, 0, -22], codoD: [-45, 0, 0], brazoI: [-15, 0, 22], codoI: [-45, 0, 0] }, { p: [0, 0.4, 0] }),
  dudar: P("Dudar (¿sí?)", "Emociones", { cabeza: [-3, 22, 10], torso: [0, 10, 0], brazoD: [4, 0, -6], brazoI: [0, 0, 8], piernaI: [-4, 0, 0] }),
  risa_nuca: P("Risa con mano en la nuca", "Emociones", { raiz: [0, -38, 0], torso: [-4, -8, 0], cabeza: [-10, -12, 8], brazoI: [-25, 0, 135], codoI: [-125, 0, 0], brazoD: [8, 0, -8], codoD: [-15, 0, 0] }),
  risa_atras: P("Risa (cabeza atrás)", "Emociones", { raiz: [0, -48, 0], torso: [-12, -10, 0], cabeza: [-22, -18, 10], brazoI: [-25, 0, 130], codoI: [-120, 0, 0], brazoD: [-30, 0, -10], codoD: [-70, 0, 0] }),
  mirar_picaro: P("Mirada pícara", "Emociones", { cabeza: [6, -10, -8], torso: [0, -8, 0], brazoD: [4, 0, -5], brazoI: [-4, 0, 5] }),
  presentarse: P("Presentarse (brazos abiertos)", "Gestos", { brazoD: [-20, 0, -50], codoD: [-40, 0, -30], brazoI: [-20, 0, 50], codoI: [-40, 0, 30], cabeza: [0, 0, -10], torso: [-4, 0, 0] }, { p: [0, 0.3, 0] }),
  tomar_camara: P("Tomar la cámara", "Gestos", { brazoD: [-70, -22, -12], codoD: [-35, 0, 0], brazoI: [-66, 22, 12], codoI: [-35, 0, 0], torso: [8, 0, 0], cabeza: [-6, 0, 0] }, { p: [0, 0, 6] }),
  sostener_camara: P("Sostener la cámara", "Gestos", { brazoD: [-58, -20, 14], codoD: [-50, 0, 0], brazoI: [-58, 20, -14], codoI: [-50, 0, 0], torso: [5, 0, 0], cabeza: [-2, 0, 5] }, { p: [0, 0.3, 10] }),
  manos_juntas: P("Manos juntas (emocionado)", "Emociones", { brazoD: [-52, -38, 24], codoD: [-78, 0, 0], brazoI: [-52, 38, -24], codoI: [-78, 0, 0], torso: [4, 0, 0], cabeza: [-4, 0, 4] }, { p: [0, 0.3, 8] }),
  // tráiler (réplica del video para Bobicraft)
  apoyado: P("Apoyado en la pared", "Básicas", { raiz: [-5, 0, 0], torso: [-3, 0, 0], cabeza: [3, 8, 0], brazoD: [-28, 0, 12], codoD: [-30, 0, 95], brazoI: [-34, 0, -12], codoI: [-24, 0, -95], piernaD: [-8, 0, 9], rodillaD: [14, 0, 0], piernaI: [2, 0, -2] }, { p: [0, 0, -1.2] }),
  trotar: P("Correr (base)", "Básicas", { torso: [14, 0, 0], cabeza: [-12, 0, 0], codoD: [-80, 0, 0], codoI: [-80, 0, 0], brazoD: [0, 0, -6], brazoI: [0, 0, 6] }, { p: [0, -0.6, 0] }),
  nadar: P("Nadar", "Acción", { raiz: [68, 0, 0], cabeza: [-58, 0, 0], brazoD: [-150, 0, -18], codoD: [-10, 0, 0], brazoI: [-150, 0, 18], codoI: [-10, 0, 0], piernaD: [6, 0, -4], piernaI: [-4, 0, 4], rodillaD: [14, 0, 0], rodillaI: [8, 0, 0] }),
  caer_espalda: P("Caer de espaldas (estrella)", "Acción", { raiz: [-84, 0, 0], cabeza: [-14, 0, 0], brazoD: [-10, 0, -112], codoD: [-12, 0, 0], brazoI: [-10, 0, 112], codoI: [-12, 0, 0], piernaD: [-6, 0, -24], piernaI: [-6, 0, 24], rodillaD: [10, 0, 0], rodillaI: [10, 0, 0] }),
  asomarse: P("Asomarse por la esquina", "Gestos", { torso: [4, 0, 15], cabeza: [4, 12, 9], brazoI: [-72, 0, 28], codoI: [-38, 0, 0], brazoD: [6, 0, -4], codoD: [-14, 0, 0], piernaD: [0, 0, -5], piernaI: [0, 0, 6] }, { p: [-1.2, 0, 0] }),
  sentado_borde: P("Sentado en el borde", "Básicas", { piernaD: [-88, 0, -5], rodillaD: [72, 0, 0], piernaI: [-82, 0, 5], rodillaI: [64, 0, 0], torso: [-6, 0, 0], cabeza: [-16, 0, 0], brazoD: [22, 0, -18], codoD: [-8, 0, 0], brazoI: [22, 0, 18], codoI: [-8, 0, 0] }, { p: [0, -11, 0] }),
  contemplar: P("Contemplar (de espaldas)", "Emociones", { cabeza: [-10, -6, 0], torso: [-2, 0, 0], brazoD: [4, 0, -6], codoD: [-12, 0, 0], brazoI: [4, 0, 6], codoI: [-12, 0, 0], piernaI: [3, 0, 2] }),
  mirar_lado: P("Mirar a un lado", "Emociones", { cabeza: [7, 38, 2], torso: [0, 10, 0], brazoD: [4, 0, -5], brazoI: [-2, 0, 5] }),
  de_frente: P("De frente (firme)", "Emociones", { cabeza: [-3, 0, 0], torso: [0, 2, 0], brazoD: [4, 0, -5], brazoI: [-2, 0, 5] }),
  montar: P("Montar (a caballo / cabra)", "Básicas", { piernaD: [-72, 0, 24], rodillaD: [38, 0, 0], piernaI: [-72, 0, -24], rodillaI: [38, 0, 0], torso: [4, 0, 0], cabeza: [-4, 0, 0], brazoD: [-34, 0, -8], codoD: [-40, 0, 0], brazoI: [-30, 0, 10], codoI: [-46, 0, 0] }, { p: [0, -10, 0] }),
  robot: P("Robot", "Baile", { brazoD: [0, 0, -90], codoD: [0, 0, -90], brazoI: [0, 0, 90], codoI: [0, 0, -90] }, { mov: [{ j: "cabeza", e: 1, a: 25, f: 1 }] }),
};

const JUNTAS_PAR = [["brazoD", "brazoI"], ["codoD", "codoI"], ["piernaD", "piernaI"], ["rodillaD", "rodillaI"]];
export function espejarPose(pose) {
  const r = {};
  const inv = (v) => v && [v[0], -v[1], -v[2]];
  for (const [k, v] of Object.entries(pose.r || {})) r[k] = inv(v);
  for (const [a, b] of JUNTAS_PAR) { const ra = r[a], rb = r[b]; delete r[a]; delete r[b]; if (rb) r[a] = rb; if (ra) r[b] = ra; }
  const swap = { brazoD: "brazoI", brazoI: "brazoD", codoD: "codoI", codoI: "codoD", piernaD: "piernaI", piernaI: "piernaD", rodillaD: "rodillaI", rodillaI: "rodillaD" };
  return {
    ...pose, nombre: pose.nombre + " (espejo)", r,
    p: pose.p ? [-pose.p[0], pose.p[1], pose.p[2]] : undefined,
    mov: pose.mov?.map(m => ({ ...m, j: swap[m.j] || m.j, a: m.e === 0 ? m.a : -m.a })),
  };
}

export const copiaPose = (id) => JSON.parse(JSON.stringify({ ...POSES[id], id }));

// ───────────── curvas ─────────────
export const CURVAS = {
  // medida en el video de referencia: anticipación pequeña, arranque rápido, frenado largo (≈3:1)
  natural: { nombre: "Natural (anticipa y frena suave)", f: t => t < 0.14 ? -0.05 * Math.sin(Math.PI * t / 0.14) : 1 - Math.pow(1 - (t - 0.14) / 0.86, 3.2) },
  suave: { nombre: "Suave", f: t => t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2 },
  lineal: { nombre: "Lineal", f: t => t },
  salida: { nombre: "Frenado", f: t => 1 - (1 - t) ** 3 },
  rebote: { nombre: "Rebote", f: t => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2; } },
  elastico: { nombre: "Elástico", f: t => t === 0 || t === 1 ? t : 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI / 3)) + 1 },
  corte: { nombre: "Corte seco", f: () => 1 },
};

// ───────────── matices: movimientos que se suman encima de la pose ─────────────
const S = Math.sin, TAU = Math.PI * 2;
export const MATICES = {
  respirar: { nombre: "Respirar", f: (t) => { const s = S(t * TAU * 0.32); return { r: { torso: [s * 1.4, 0, 0], cabeza: [-s, 0, 0], brazoD: [0, 0, -s * 1.6 - 1], brazoI: [0, 0, s * 1.6 + 1] }, p: [0, s * 0.12, 0] }; } },
  hablar: { nombre: "Hablar", f: (t) => ({ r: { cabeza: [Math.abs(S(t * 7.3)) * 3.5 + S(t * 2.1) * 2, S(t * 1.3) * 4, S(t * 0.9) * 2] , torso: [0, S(t * 1.1) * 2, 0] }, boca: Math.abs(S(t * 11)) * (0.55 + 0.45 * S(t * 3.7)) }) },
  asentir: { nombre: "Asentir", f: (t) => ({ r: { cabeza: [S(t * TAU * 1.8) * 11 + 4, 0, 0] } }) },
  negar: { nombre: "Negar con la cabeza", f: (t) => ({ r: { cabeza: [3, S(t * TAU * 2) * 20, 0] } }) },
  reir: { nombre: "Reír", f: (t) => { const b = Math.abs(S(t * TAU * 3.2)); return { r: { torso: [-4 - b * 4, 0, 0], cabeza: [-10 + b * 6, 0, 0], brazoD: [0, 0, -b * 4], brazoI: [0, 0, b * 4] }, p: [0, b * 0.3, 0], boca: 0.8 }; } },
  temblar: { nombre: "Temblar", f: (t) => { const n = (k) => S(t * 53 + k) * 1.2 + S(t * 31 + k * 2) * 1.2; return { r: { torso: [n(1), n(2), n(3)], cabeza: [n(4), n(5), n(6)], brazoD: [n(7), 0, n(8)], brazoI: [n(9), 0, n(10)] }, p: [n(11) * 0.08, 0, 0] }; } },
  rebotar: { nombre: "Rebotar al ritmo", f: (t) => { const b = Math.abs(S(t * Math.PI * 2.2)); return { r: { piernaD: [-b * 7, 0, 0], piernaI: [-b * 7, 0, 0], rodillaD: [b * 14, 0, 0], rodillaI: [b * 14, 0, 0], cabeza: [b * 4, 0, 0] }, p: [0, -b * 1.2, 0] }; } },
  balancear: { nombre: "Balancearse", f: (t) => { const s = S(t * TAU * 0.6); return { r: { torso: [0, 0, s * 5], cabeza: [0, 0, -s * 4] }, p: [s * 0.6, 0, 0] }; } },
  caminar_atras: { nombre: "Caminar hacia atrás (brazos quietos)", f: (t) => { const w = t * TAU * 1.7, s = S(w); return { r: { piernaD: [s * 22, 0, 0], piernaI: [-s * 22, 0, 0], rodillaD: [Math.max(0, -s) * 26, 0, 0], rodillaI: [Math.max(0, s) * 26, 0, 0], torso: [-2, 0, s * 2.5], cabeza: [Math.abs(S(w)) * 3, 0, -s * 2] }, p: [s * 0.25, -Math.abs(S(w)) * 0.55, 0] }; } },
  caminar: { nombre: "Caminar en el sitio", f: (t) => { const w = t * TAU * 1.6, s = S(w); return { r: { piernaD: [-s * 28, 0, 0], piernaI: [s * 28, 0, 0], rodillaD: [Math.max(0, s) * 30, 0, 0], rodillaI: [Math.max(0, -s) * 30, 0, 0], brazoD: [s * 22, 0, 0], brazoI: [-s * 22, 0, 0] }, p: [0, -Math.abs(S(w)) * 0.4, 0] }; } },
  mirar_alrededor: { nombre: "Mirar alrededor", f: (t) => { const s = S(t * TAU * 0.25); return { r: { cabeza: [S(t * TAU * 0.5) * 4, s * 35, 0] }, mx: s * 0.8 }; } },
  // jinete (estilo Actions & Stuff): el cuerpo sigue la respiración y los pasitos de la montura con retraso
  montar: { nombre: "Montar (vaivén de la montura)", f: (t) => { const w = t * TAU * 0.85, s = S(w), s2 = S(w * 2 + 0.6); return { r: { torso: [s2 * 2.2, s * 1.5, s * 2.4], cabeza: [-s2 * 1.6, -s * 2.5, -s * 1.8], brazoD: [s2 * 3, 0, -Math.abs(s) * 2], brazoI: [s2 * 3, 0, Math.abs(s) * 2] }, p: [s * 0.15, s2 * 0.35, 0] }; } },
  correr: { nombre: "Correr (piernas y brazos)", f: (t) => { const w = t * TAU * 2.6, s = S(w); return { r: { piernaD: [-s * 50, 0, 0], piernaI: [s * 50, 0, 0], rodillaD: [Math.max(0, s) * 70 + 8, 0, 0], rodillaI: [Math.max(0, -s) * 70 + 8, 0, 0], brazoD: [s * 48, 0, 0], brazoI: [-s * 48, 0, 0], torso: [0, s * 6, 0], cabeza: [Math.abs(s) * 3, -s * 4, 0] }, p: [0, -Math.abs(S(w)) * 0.9, 0] }; } },
  nadar: { nombre: "Nadar (patada y brazada)", f: (t) => { const s = S(t * TAU * 2.2), b = S(t * TAU * 0.75); return { r: { piernaD: [s * 16, 0, 0], piernaI: [-s * 16, 0, 0], brazoD: [b * 34, 0, -Math.max(0, b) * 40], brazoI: [b * 34, 0, Math.max(0, b) * 40], raiz: [0, 0, S(t * TAU * 0.4) * 5], cabeza: [b * 4, 0, 0] }, p: [0, b * 0.4, 0] }; } },
  flotar: { nombre: "Flotar (cae girando)", f: (t) => { const s = S(t * TAU * 1.1); return { r: { brazoD: [0, 0, s * 12], brazoI: [0, 0, -s * 12], piernaD: [0, 0, -s * 8], piernaI: [0, 0, s * 8], cabeza: [S(t * 3) * 6, S(t * 2.2) * 8, 0] } }; } },
  agitado: { nombre: "Respirar agitado", f: (t) => { const s = S(t * TAU * 1.4); return { r: { torso: [s * 4 + 6, 0, 0], cabeza: [-s * 3, 0, 0] }, p: [0, s * 0.3, 0], boca: 0.4 + s * 0.3 }; } },
};

// ───────────── cámara ─────────────
const V = (az, el, dist, ty) => ({ az, el, dist, ty });
export const CAMARAS = {
  frente: { nombre: "Frente", desde: V(0, 4, 4.6, 1.05) },
  tres_cuartos: { nombre: "Tres cuartos", desde: V(32, 8, 4.6, 1.05) },
  perfil: { nombre: "Perfil", desde: V(90, 4, 4.6, 1.05) },
  plano_medio: { nombre: "Plano medio", desde: V(12, 4, 2.8, 1.35) },
  primer_plano: { nombre: "Primer plano (cara)", desde: V(6, 2, 1.55, 1.72) },
  contrapicado: { nombre: "Contrapicado", desde: V(20, -18, 3.6, 1.25) },
  picado: { nombre: "Picado", desde: V(15, 38, 4.2, 0.9) },
  orbita: { nombre: "Órbita 360°", desde: V(-30, 10, 4.4, 1), hasta: V(330, 10, 4.4, 1), curva: "lineal" },
  acercar: { nombre: "Acercamiento", desde: V(15, 6, 5.4, 1), hasta: V(5, 3, 1.7, 1.65) },
  alejar: { nombre: "Alejamiento", desde: V(5, 3, 1.7, 1.65), hasta: V(15, 6, 5.4, 1) },
  paneo: { nombre: "Paneo", desde: V(-35, 6, 4, 1.1), hasta: V(35, 6, 4, 1.1) },
  en_mano: { nombre: "Cámara en mano", desde: V(18, 5, 2.6, 1.4), temblor: 1 },
  vlog: { nombre: "Vlog (cámara en mano de frente)", desde: { ...V(-4, 1, 1.85, 1.6), fov: 42 }, temblor: 2.0 },
  vlog_cerca: { nombre: "Vlog muy cerca", desde: { ...V(-6, 0, 1.75, 1.62), fov: 46 }, temblor: 1.0 },
  agarre: { nombre: "Agarran la cámara (a la cara)", desde: { ...V(-8, 1, 2.1, 1.58), fov: 40 }, hasta: { ...V(3, 3, 1.45, 1.66), fov: 40, roll: -4 }, temblor: 1.8, curva: "salida", seguir: 1 },
  llevada: { nombre: "Se llevan la cámara (caminando)", desde: { ...V(3, 3, 1.45, 1.66), fov: 40 }, hasta: { ...V(-3, 4, 1.55, 1.66), fov: 40, roll: 3 }, temblor: 3.0, seguir: 1, curva: "lineal" },
  caida: { nombre: "Agarran la cámara (caída)", desde: { ...V(-6, 0, 1.75, 1.62), fov: 46 }, hasta: { ...V(10, -55, 0.55, 1.1), fov: 46, roll: 25 }, temblor: 2, curva: "salida" },
  libre: { nombre: "Vista guardada", desde: V(25, 8, 4.4, 1.05) },
};
