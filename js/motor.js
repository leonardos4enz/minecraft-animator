// Motor: evalúa el proyecto en el tiempo t. Pistas:
//   poses   (en secuencia): cada clip llega a su pose en `trans` segundos y la mantiene
//   ojos    (en secuencia): expresión + mirada, con transición corta
//   matices (libres): movimientos procedurales que se suman (hablar, asentir, temblar...)
//   camara  (en secuencia): tomas con vista inicial/final y temblor opcional
//   audio   (libres): voces y sonidos; la envolvente de la voz mueve la cabeza al hablar
//   escenas (en secuencia): para tráilers con cortes. Cada toma elige escenario, cielo/luz, dónde está el
//           personaje (y hacia dónde se mueve), mobs de fondo y fundidos a negro
//   textos  (libres): títulos grandes en pantalla
//
// DINÁMICA (lo que hace que se vea "suave"): las poses de arriba son el OBJETIVO; cada articulación lo
// sigue como un sistema masa-resorte-amortiguador (x'' = ω²(objetivo − x) − 2ζω·x'). Parámetros
// medidos en el video de referencia: arranque rápido (~0.1 s), asentamiento 2-4 veces más lento y un
// pequeño rebote (ζ ≈ 0.3-0.45 en cabeza y brazos). Las partes lejanas (codos, cabeza) tienen menos
// amortiguamiento: llegan un poco después y rebotan un poco más → acción superpuesta (follow-through).
import * as THREE from "three";
import { JUNTAS } from "./personaje.js";
import { POSES, MATICES, CAMARAS, CURVAS } from "./poses.js";
import { resolverExpresion, mezclarExpresion } from "./rostro.js";

const D2R = Math.PI / 180;
const _e = new THREE.Euler(), _q = new THREE.Quaternion();
const quat = (v) => _q.clone().setFromEuler(_e.set((v?.[0] || 0) * D2R, (v?.[1] || 0) * D2R, (v?.[2] || 0) * D2R, "XYZ"));

// [ω (rad/s), ζ] por articulación
export const RESORTES = {
  raiz: [12, 0.78], torso: [14, 0.6], cabeza: [16, 0.42],
  brazoD: [17, 0.46], codoD: [14, 0.36], brazoI: [17, 0.46], codoI: [14, 0.36],
  piernaD: [24, 0.82], rodillaD: [22, 0.78], piernaI: [24, 0.82], rodillaI: [22, 0.78], munecaD: [20, 0.55],
  pos: [15, 0.68],
};
// pelo: persigue la orientación de la cabeza con poco amortiguamiento (se pasa y rebota) y además
// lo empuja la aceleración del cuerpo (inercia). Límite de ángulo para que no atraviese la cabeza.
export const PELO = { om: 11, zeta: 0.5, inercia: 0.18, max: 9 * Math.PI / 180 };

export const finSecuencia = (clips) => clips.reduce((s, c) => s + c.dur, 0);
export function duracion(p) {
  const k = p.pistas;
  return Math.max(0.5, finSecuencia(k.poses), finSecuencia(k.ojos), finSecuencia(k.camara), finSecuencia(k.escenas || []),
    ...(k.textos || []).map(x => x.inicio + x.dur),
    ...k.matices.map(m => m.inicio + m.dur), ...(k.audio || []).map(a => a.inicio + (a.dur || 0)));
}
export function inicios(clips) { let s = 0; return clips.map(c => { const i = s; s += c.dur; return i; }); }

function buscar(clips, t) {
  let s = 0;
  for (let i = 0; i < clips.length; i++) {
    if (t < s + clips[i].dur || i === clips.length - 1) return { i, tau: t - s };
    s += clips[i].dur;
  }
  return null;
}

// semillas fijas: parpadeo y saltitos de los ojos salen igual en la vista previa y al exportar
function lista(semilla, hasta, min, rango, extra) {
  let x = semilla, t = 0.8; const out = [];
  const rnd = () => (x = (x * 16807) % 2147483647) / 2147483647;
  while (t < hasta + 6) { out.push({ t, a: rnd() * 2 - 1, b: rnd() * 2 - 1 }); t += min + rnd() * rango; if (extra && rnd() < 0.18) out.push({ t: t - 0.32, a: 0, b: 0 }); }
  return out.sort((a, b) => a.t - b.t);
}
let _parp = { hasta: 0, l: [] }, _sac = { hasta: 0, l: [] };
function parpado(t) {
  if (t > _parp.hasta) _parp = { hasta: t + 60, l: lista(12345, t + 60, 1.8, 3.6, true) };
  for (const { t: b } of _parp.l) {
    const d = t - b;
    if (d >= 0 && d < 0.2) return d < 0.06 ? d / 0.06 : d < 0.11 ? 1 : 1 - (d - 0.11) / 0.09;
    if (b > t) break;
  }
  return 0;
}
// sacadas: la mirada da saltitos pequeños y rápidos (como los ojos reales) y se queda ahí
function sacada(t) {
  if (t > _sac.hasta) _sac = { hasta: t + 60, l: lista(777, t + 60, 0.9, 1.9, false) };
  let prev = { a: 0, b: 0 }, act = null;
  for (const s of _sac.l) { if (s.t > t) break; prev = act || prev; act = s; }
  if (!act) return [0, 0];
  const k = Math.min(1, (t - act.t) / 0.05);
  return [(prev.a + (act.a - prev.a) * k) * 0.13, (prev.b + (act.b - prev.b) * k) * 0.06];
}
// ruido suave (suma de senos con frecuencias que no se repiten)
const ruido = (t, s) => (Math.sin(t * 2.31 + s) * 0.5 + Math.sin(t * 4.47 + s * 2.1) * 0.3 + Math.sin(t * 7.13 + s * 3.7) * 0.2);

export const poseDe = (clip) => clip.pose || POSES.reposo;

// acento: cuánto subió la voz en los últimos 0.12 s (inicio de sílaba fuerte)
function acento(k, t) {
  const d = voz(k, t) - voz(k, t - 0.12);
  return Math.max(0, Math.min(1, d * 2.6));
}

// envolvente de una voz en el tiempo t (0..1)
function voz(k, t) {
  let v = 0;
  for (const a of k.audio || []) {
    if (a.tipo !== "voz" || !a.env || t < a.inicio || t >= a.inicio + a.dur) continue;
    const i = (t - a.inicio) * 30, i0 = Math.floor(i), f = i - i0;
    const e = (a.env[i0] || 0) * (1 - f) + (a.env[i0 + 1] || 0) * f;
    v = Math.max(v, e * (a.vol ?? 1));
  }
  return v;
}

// ── objetivo del cuerpo (poses + matices + vida + voz), sin dinámica
function objetivo(proy, t, sinMatices) {
  const aj = proy.ajustes, k = proy.pistas;
  const rot = {}, pos = new THREE.Vector3();
  for (const n of JUNTAS) rot[n] = new THREE.Quaternion();
  let boca = 0, mxExtra = 0;

  const b = buscar(k.poses, t);
  if (b) {
    const c = k.poses[b.i], ant = k.poses[b.i - 1] || c;
    const pa = poseDe(ant), pb = poseDe(c);
    const trans = Math.min(c.trans ?? 0.4, c.dur);
    const curva = (CURVAS[c.curva] || CURVAS.natural).f;
    const a = trans <= 0.001 ? 1 : curva(Math.min(1, b.tau / trans));
    for (const n of JUNTAS) rot[n].copy(slerpLibre(quat(pa.r?.[n]), quat(pb.r?.[n]), a));
    pos.copy(new THREE.Vector3(...(pa.p || [0, 0, 0]))).lerp(new THREE.Vector3(...(pb.p || [0, 0, 0])), a);
    if (!sinMatices) {
      const sumarMov = (pose, peso, tau) => {
        for (const m of pose.mov || []) {
          const v = [0, 0, 0]; v[m.e] = Math.sin(tau * Math.PI * 2 * m.f + (m.fase || 0)) * m.a * peso;
          rot[m.j].multiply(quat(v));
        }
      };
      if (a < 1 && ant !== c) sumarMov(pa, 1 - Math.min(1, a), b.tau + (ant.dur || 0));
      sumarMov(pb, Math.min(1, Math.max(0, a)), b.tau);
    }
  }
  if (sinMatices) return { rot, pos, boca, mxExtra };

  const capas = k.matices.filter(m => t >= m.inicio && t < m.inicio + m.dur).map(m => {
    const tau = t - m.inicio, fade = Math.min(0.25, m.dur / 3);
    return { m, peso: Math.min(1, tau / fade, (m.dur - tau) / fade) * (m.intensidad ?? 1) };
  });
  if (aj.vida) capas.push({ m: { tipo: "respirar", inicio: 0 }, peso: 0.7 });
  for (const { m, peso } of capas) {
    const def = MATICES[m.tipo]; if (!def) continue;
    const r = def.f(t - m.inicio);
    for (const [n, v] of Object.entries(r.r || {})) rot[n].multiply(quat(v.map(x => x * peso)));
    if (r.p) pos.add(new THREE.Vector3(...r.p).multiplyScalar(peso));
    if (r.boca) boca = Math.max(boca, r.boca * peso);
    if (r.mx) mxExtra += r.mx * peso;
  }

  // vida: nunca está congelado (en el video la cabeza se mueve ~18 px/s aun "quieta")
  if (aj.vida) {
    const V = aj.intensidadVida ?? 3.3;                    // calibrado contra el original (ver analisis/comparacion)
    const s = Math.sin(t * Math.PI * 2 * 0.17 + 1);        // cambio de peso entre piernas
    rot.raiz.multiply(quat([0, ruido(t * 0.25, 11) * 2 * V, s * 1.1 * V]));
    rot.torso.multiply(quat([ruido(t * 0.4, 1) * 0.9 * V, ruido(t * 0.35, 2) * 1.6 * V, -s * 1.6 * V]));
    rot.cabeza.multiply(quat([ruido(t * 0.6, 3) * 2.4 * V, ruido(t * 0.5, 4) * 3.4 * V, -s * 0.9 * V + ruido(t * 0.4, 5) * 1.5 * V]));
    rot.brazoD.multiply(quat([ruido(t * 0.55, 6) * 2 * V, 0, ruido(t * 0.45, 7) * 1.1 * V]));
    rot.brazoI.multiply(quat([ruido(t * 0.55, 8) * 2 * V, 0, ruido(t * 0.45, 9) * 1.1 * V]));
    rot.codoD.multiply(quat([ruido(t * 0.5, 12) * 2 * V, 0, 0])); rot.codoI.multiply(quat([ruido(t * 0.5, 13) * 2 * V, 0, 0]));
    rot.piernaD.multiply(quat([0, 0, -s * 0.8 * V])); rot.piernaI.multiply(quat([0, 0, -s * 0.8 * V]));
    pos.x += s * 0.35 * V; pos.y += Math.abs(s) * -0.15 * V;
  }

  // voz: la cabeza acentúa las sílabas (sustituye a la boca cuando la skin no tiene)
  const v = voz(k, t);
  if (v > 0.01) {
    // al hablar se mueve todo el cuerpo (en el original, de 2-4 s y 8-10 s gesticula con cabeza y hombros)
    const ac = acento(k, t);                                 // golpe de la sílaba acentuada (0..1)
    rot.cabeza.multiply(quat([v * 8 + ac * 11 + Math.sin(t * 9.5) * v * 3, Math.sin(t * 2.6) * v * 10, Math.sin(t * 1.9) * v * 5 + ac * 3]));
    rot.torso.multiply(quat([v * 3 + ac * 5, Math.sin(t * 1.7) * v * 6, Math.sin(t * 1.3) * v * 3]));
    // hombros: los brazos suben y se abren un poco en cada acento (no hay hueso de hombro: se aproxima)
    rot.brazoD.multiply(quat([-v * 8 * (0.5 + 0.5 * Math.sin(t * 2.1)) - ac * 6, 0, -v * 3 - ac * 7]));
    rot.brazoI.multiply(quat([-v * 8 * (0.5 + 0.5 * Math.sin(t * 2.4 + 1)) - ac * 6, 0, v * 3 + ac * 7]));
    rot.codoD.multiply(quat([-v * 12 - ac * 14, 0, 0])); rot.codoI.multiply(quat([-v * 12 - ac * 14, 0, 0]));
    pos.y += ac * 0.35;
    boca = Math.max(boca, Math.min(1, v * 1.4));
  }
  return { rot, pos, boca, mxExtra };
}

// ── simulación de resortes (se calcula una vez por cambio del proyecto, a 60 Hz)
const HZ = 60;
const cache = { firma: null, n: 0, q: {}, p: null, boca: null, mx: null };
function firma(proy) {
  const k = proy.pistas;
  return JSON.stringify([k.poses, k.matices, (k.audio || []).map(a => [a.id, a.inicio, a.dur, a.vol, a.tipo, a.env?.length]), proy.ajustes.vida]);
}
function simular(proy) {
  const f = firma(proy);
  if (cache.firma === f) return;
  const total = duracion(proy) + 0.6, n = Math.ceil(total * HZ) + 1;
  const q = {}, w = {}, out = {};
  for (const j of JUNTAS) { out[j] = new Float32Array(n * 4); w[j] = new THREE.Vector3(); }
  out.pelo = new Float32Array(n * 4);
  const peloQ = new THREE.Quaternion(), peloW = new THREE.Vector3(), cabezaMundo = new THREE.Quaternion(), loc = new THREE.Quaternion();
  const pvAnt = new THREE.Vector3(), acel = new THREE.Vector3(), arriba = new THREE.Vector3(0, 1, 0), torque = new THREE.Vector3();
  const P = new Float32Array(n * 3), Bo = new Float32Array(n), MX = new Float32Array(n);
  let pos = null; const pv = new THREE.Vector3();
  const err = new THREE.Quaternion(), inv = new THREE.Quaternion(), dq = new THREE.Quaternion(), eje = new THREE.Vector3(), e = new THREE.Vector3();
  const sub = 3, h = 1 / HZ / sub;
  const cortesI = new Set(cortesPoses(proy).map(tc => Math.ceil(tc * HZ - 1e-6)));
  for (let i = 0; i < n; i++) {
    const obj = objetivo(proy, i / HZ, false);
    if (i === 0 || cortesI.has(i)) {
      for (const j of JUNTAS) w[j].set(0, 0, 0); pv.set(0, 0, 0); peloW.set(0, 0, 0);
      for (const j of JUNTAS) q[j] = obj.rot[j].clone(); pos = obj.pos.clone();
      peloQ.copy(q.raiz).multiply(q.torso).multiply(q.cabeza);
    }
    for (let s = 0; s < sub; s++) {
      for (const j of JUNTAS) {
        const [om, z] = RESORTES[j];
        err.copy(obj.rot[j]).multiply(inv.copy(q[j]).invert());
        if (err.w < 0) err.set(-err.x, -err.y, -err.z, -err.w);
        const ang = 2 * Math.acos(Math.min(1, err.w));
        const sn = Math.sqrt(Math.max(1e-12, 1 - err.w * err.w));
        e.set(err.x / sn, err.y / sn, err.z / sn).multiplyScalar(ang < 1e-6 ? 0 : ang);
        w[j].addScaledVector(e, om * om * h).multiplyScalar(1 / (1 + 2 * z * om * h));     // amortiguamiento implícito (estable)
        const wl = w[j].length();
        if (wl > 1e-9) { dq.setFromAxisAngle(eje.copy(w[j]).divideScalar(wl), wl * h); q[j].premultiply(dq).normalize(); }
      }
      const [om, z] = RESORTES.pos;
      pvAnt.copy(pv);
      pv.addScaledVector(obj.pos.clone().sub(pos), om * om * h).multiplyScalar(1 / (1 + 2 * z * om * h));
      pos.addScaledVector(pv, h);
      // pelo
      cabezaMundo.copy(q.raiz).multiply(q.torso).multiply(q.cabeza);
      err.copy(cabezaMundo).multiply(inv.copy(peloQ).invert());
      if (err.w < 0) err.set(-err.x, -err.y, -err.z, -err.w);
      const angP = 2 * Math.acos(Math.min(1, err.w)), snP = Math.sqrt(Math.max(1e-12, 1 - err.w * err.w));
      e.set(err.x / snP, err.y / snP, err.z / snP).multiplyScalar(angP < 1e-6 ? 0 : angP);
      acel.copy(pv).sub(pvAnt).divideScalar(h * 16);                     // px/s² → bloques/s²
      torque.copy(arriba).cross(acel).multiplyScalar(-PELO.inercia);     // si el cuerpo acelera, el pelo se queda atrás
      peloW.addScaledVector(e, PELO.om * PELO.om * h).addScaledVector(torque, h).multiplyScalar(1 / (1 + 2 * PELO.zeta * PELO.om * h));
      const wl2 = peloW.length();
      if (wl2 > 1e-9) { dq.setFromAxisAngle(eje.copy(peloW).divideScalar(wl2), wl2 * h); peloQ.premultiply(dq).normalize(); }
    }
    // rotación local del pelo respecto a la cabeza, con límite
    loc.copy(cabezaMundo).invert().multiply(peloQ);
    if (loc.w < 0) loc.set(-loc.x, -loc.y, -loc.z, -loc.w);
    const angL = 2 * Math.acos(Math.min(1, loc.w));
    if (angL > PELO.max) loc.slerp(new THREE.Quaternion(), 1 - PELO.max / angL);
    loc.toArray(out.pelo, i * 4);
    for (const j of JUNTAS) q[j].toArray(out[j], i * 4);
    pos.toArray(P, i * 3); Bo[i] = obj.boca; MX[i] = obj.mxExtra;
  }
  Object.assign(cache, { firma: f, n, q: out, p: P, boca: Bo, mx: MX });
}
export const invalidarDinamica = () => { cache.firma = null; };

// inicio de cada clip de pose marcado como corte (la pose llega de golpe, sin resorte)
function cortesPoses(proy) {
  const out = []; let s = 0;
  for (const c of proy.pistas.poses) { if (c.corte && s > 0) out.push(s); s += c.dur; }
  return out;
}

// trayectoria suave (Catmull-Rom) por puntos [[tau, valores…], …]: cámara tipo dron y punto de mira que se mueven sin
// tirones. Devuelve los valores en tau (se quedan quietos antes del primero y después del último)
export function rutaEn(ruta, tau) {
  const n = ruta.length;
  if (tau <= ruta[0][0]) return ruta[0].slice(1);
  if (tau >= ruta[n - 1][0]) return ruta[n - 1].slice(1);
  let i = 0; while (i < n - 2 && ruta[i + 1][0] <= tau) i++;
  const p0 = ruta[Math.max(0, i - 1)], p1 = ruta[i], p2 = ruta[i + 1], p3 = ruta[Math.min(n - 1, i + 2)];
  const u = (tau - p1[0]) / (p2[0] - p1[0]), u2 = u * u, u3 = u2 * u;
  return p1.slice(1).map((_, k) => { const a = p0[k + 1], b = p1[k + 1], c = p2[k + 1], d = p3[k + 1];
    return 0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u2 + (-a + 3 * b - 3 * c + d) * u3); });
}

// ── tráiler: toma activa (escenario, ambiente, posición del personaje, mobs, fundido)
const lerpA = (a, b, k) => ({ x: a.x + (b.x - a.x) * k, y: (a.y || 0) + ((b.y || 0) - (a.y || 0)) * k, z: a.z + (b.z - a.z) * k, rot: (a.rot || 0) + ((b.rot ?? a.rot ?? 0) - (a.rot || 0)) * k });
export function tomaEn(proy, t) {
  const k = proy.pistas.escenas;
  if (!k?.length) return null;
  const b = buscar(k, t); if (!b) return null;
  const c = k[b.i], u = Math.min(1, Math.max(0, b.tau / c.dur));
  const base = { x: 0, y: 0, z: 0, rot: 0, ...c.actor };
  // ancla: de dónde salen la cámara fija y los mobs (por defecto, donde empieza el personaje)
  const ancla = c.ancla ? { ...base, ...c.ancla } : base;
  let actor = c.actorHasta ? lerpA(base, { ...base, ...c.actorHasta }, (CURVAS[c.curva || "lineal"] || CURVAS.lineal).f(u)) : base;
  if (c.actorRuta?.length) { const [x, y, z] = rutaEn(c.actorRuta, b.tau); actor = { ...base, x, y, z }; }      // [[tau, x, y, z], …]
  const f = c.fundido || {};
  let negro = 0;
  if (f.entra && b.tau < f.entra) negro = Math.max(negro, 1 - b.tau / f.entra);
  if (f.sale && c.dur - b.tau < f.sale) negro = Math.max(negro, 1 - (c.dur - b.tau) / f.sale);
  if (c.negro) negro = 1;
  return { i: b.i, tau: b.tau, clip: c, ancla, actor, negro };
}
// tiempos de corte (inicio de cada toma) para que el desenfoque de movimiento no mezcle dos tomas
export const cortesTomas = (proy) => inicios(proy.pistas.escenas || []).slice(1);
// títulos visibles en t, con su tiempo local
export function textosEn(proy, t) {
  return (proy.pistas.textos || []).filter(x => t >= x.inicio && t < x.inicio + x.dur).map(x => ({ ...x, tau: t - x.inicio }));
}

function hablandoEn(k, t) {
  return (k.audio || []).some(a => a.tipo === "voz" && a.visemas && t >= a.inicio && t < a.inicio + a.dur);
}

function visemaEn(k, t) {
  for (const a of k.audio || []) {
    if (a.tipo !== "voz" || !a.visemas || t < a.inicio || t >= a.inicio + a.dur) continue;
    const tau = t - a.inicio;
    for (const [t0, t1, v] of a.visemas) if (tau >= t0 && tau < t1 + 0.03) return v;
  }
  return null;
}

export function evaluar(proy, tReal, { sinMatices = false } = {}) {
  const aj = proy.ajustes, k = proy.pistas;
  const t = aj.stop > 0 ? Math.floor(tReal * aj.stop) / aj.stop : tReal;
  let cuerpo;
  if (!sinMatices && aj.dinamica !== false) {
    simular(proy);
    const x = Math.min(cache.n - 1.001, Math.max(0, t * HZ)), i = Math.floor(x), f = x - i;
    const rot = {}, a = new THREE.Quaternion(), b = new THREE.Quaternion();
    for (const j of [...JUNTAS, "pelo"]) rot[j] = a.fromArray(cache.q[j], i * 4).clone().slerp(b.fromArray(cache.q[j], (i + 1) * 4), f);
    const pos = new THREE.Vector3().fromArray(cache.p, i * 3).lerp(new THREE.Vector3().fromArray(cache.p, (i + 1) * 3), f);
    cuerpo = { rot, pos, boca: cache.boca[i], mxExtra: cache.mx[i] };
  } else cuerpo = objetivo(proy, t, sinMatices);

  // ── ojos
  let exp = resolverExpresion("neutral"), mx = 0, my = 0, aCam = 0;
  const o = buscar(k.ojos, tReal);
  if (o) {
    const c = k.ojos[o.i], ant = k.ojos[o.i - 1] || c;
    const ea = resolverExpresion(ant.cara), eb = resolverExpresion(c.cara);
    const kk = Math.min(1, o.tau / 0.16), km = CURVAS.suave.f(Math.min(1, o.tau / 0.3));
    exp = kk >= 1 ? eb : mezclarExpresion(ea, eb, CURVAS.suave.f(kk));
    mx = (ant.mx || 0) + ((c.mx || 0) - (ant.mx || 0)) * km;
    my = (ant.my || 0) + ((c.my || 0) - (ant.my || 0)) * km;
    // "mirar a la cámara": peso que la vista usa para girar cabeza y ojos hacia el lente
    const pa = ant.aCamara ? 1 : 0, pb = c.aCamara ? 1 : 0;
    aCam = pa + (pb - pa) * km;
  }
  const [sx, sy] = aj.vida && !sinMatices ? sacada(tReal) : [0, 0];
  // las cejas suben en las sílabas acentuadas (enfatizar al hablar)
  const acC = sinMatices ? 0 : acento(k, tReal);
  if (acC > 0.02) exp = { ...exp, ojos: exp.ojos.map(o => ({ ...o, cejaY: o.cejaY + acC * 0.55 })) };
  const ojos = { exp, mx: mx + cuerpo.mxExtra + sx, my: my + sy, boca: cuerpo.boca, parpado: aj.parpadeo ? parpado(tReal) : 0, t: tReal,
    visema: visemaEn(k, tReal), hablando: hablandoEn(k, tReal), aCamara: aCam };

  // ── cámara
  let cam = null;
  const cb = buscar(k.camara, tReal);
  if (cb) cam = vistaCamara(k.camara[cb.i], cb.tau, tReal, k.camara[cb.i - 1]);

  // capa: cuánto se levanta según lo que hace el personaje (rad), con un aleteo; corre → casi horizontal
  let capa = 0.1 + 0.035 * Math.sin(t * 1.7);
  for (const m of k.matices || []) {
    if (t < m.inicio || t >= m.inicio + m.dur) continue;
    if (m.tipo === "correr") capa = Math.max(capa, 0.95 + 0.09 * Math.sin(t * 15.5) + 0.04 * Math.sin(t * 7.1));
    else if (m.tipo === "caminar" || m.tipo === "caminar_atras") capa = Math.max(capa, 0.42 + 0.06 * Math.sin(t * 10));
    else if (m.tipo === "rebotar" || m.tipo === "agitado") capa = Math.max(capa, 0.25 + 0.08 * Math.sin(t * 9));
  }
  return { rot: cuerpo.rot, pos: cuerpo.pos, ojos, cam, t, capa };
}

function slerpLibre(qa, qb, a) {
  // a puede salir de [0,1] con rebote/elástico/anticipación: extrapolar con slerp sin recortar
  if (a >= 0 && a <= 1) return qa.clone().slerp(qb, a);
  const q = qa.clone().invert().multiply(qb);
  const ang = 2 * Math.acos(Math.min(1, Math.abs(q.w)));
  if (ang < 1e-5) return qb.clone();
  const eje = new THREE.Vector3(q.x, q.y, q.z).normalize().multiplyScalar(q.w < 0 ? -1 : 1);
  return qa.clone().multiply(new THREE.Quaternion().setFromAxisAngle(eje, ang * a));
}

export function vistaCamara(toma, tau, t, previa = null) {
  const pre = CAMARAS[toma.tipo] || CAMARAS.frente;
  const desde = toma.desde || pre.desde, hasta = toma.hasta || pre.hasta || desde;
  const curva = CURVAS[toma.curva || pre.curva || "suave"].f;
  const a = curva(Math.min(1, Math.max(0, tau / toma.dur)));
  const v = {};
  for (const n of ["az", "el", "dist", "ty"]) v[n] = desde[n] + (hasta[n] - desde[n]) * a;
  // ruta de dron: [[tau, az, el, dist, ty, fov, roll], …] manda sobre desde/hasta
  const ruta = toma.ruta?.length ? rutaEn(toma.ruta, tau) : null;
  if (ruta) [v.az, v.el, v.dist, v.ty] = ruta;
  // encuadre: girar/inclinar la cámara después de apuntar al personaje (para dejarlo en un tercio)
  for (const n of ["pan", "tilt"]) v[n] = (desde[n] ?? 0) + ((hasta[n] ?? desde[n] ?? 0) - (desde[n] ?? 0)) * a;
  v.fija = !!(toma.fija ?? pre.fija);
  if (toma.foco != null) v.foco = toma.foco;
  v.fov = (desde.fov ?? 35) + ((hasta.fov ?? desde.fov ?? 35) - (desde.fov ?? 35)) * a;
  v.roll = (desde.roll ?? 0) + ((hasta.roll ?? 0) - (desde.roll ?? 0)) * a;
  if (ruta) { v.fov = ruta[4] ?? v.fov; v.roll = ruta[5] ?? v.roll; }
  v.seguir = toma.seguir ?? pre.seguir ?? 0;
  const seguiaAntes = previa ? (previa.seguir ?? CAMARAS[previa.tipo]?.seguir ?? 0) : v.seguir;
  if (v.seguir && !seguiaAntes) v.seguir *= CURVAS.suave.f(Math.min(1, tau / 0.7));
  v.buscarFoco = !!(toma.buscarFoco ?? pre.buscarFoco) && tau < 0.05;
  const tem = toma.temblor ?? pre.temblor ?? 0;
  if (tem) {
    // cámara en mano medida en el video: deriva lenta (0.5-1.5 Hz), casi nada de vibración rápida
    const w = Math.PI * 2;
    v.az += (Math.sin(t * w * 0.42) * 0.55 + Math.sin(t * w * 0.77 + 1.3) * 0.3 + Math.sin(t * w * 1.6) * 0.08) * tem;
    v.el += (Math.sin(t * w * 0.6 + 1) * 0.4 + Math.sin(t * w * 1.5 + 0.4) * 0.22) * tem;
    v.ty += Math.sin(t * w * 0.33 + 2) * 0.01 * tem;
    v.roll += (Math.sin(t * w * 0.37 + 0.5) * 0.5 + Math.sin(t * w * 0.9) * 0.18) * tem;
  }
  return v;
}

export function aplicar(personaje, ev) {
  const j = personaje.juntas;
  for (const n of JUNTAS) j[n].quaternion.copy(ev.rot[n]);
  if (j.pelo) j.pelo.quaternion.copy(ev.rot.pelo || new THREE.Quaternion());
  j.raiz.position.copy(personaje.reposo.raiz).add(ev.pos);
  if (personaje.capa && ev.capa != null) personaje.capa.rotation.x = ev.capa;
}
