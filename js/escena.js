// Escena three.js: render "de cine" (tonos ACES, luz ambiente suave, sombras suaves, oclusión
// ambiental GTAO, desenfoque de profundidad y efecto de cámara: grano, aberración y viñeta),
// mundo de bloques, actor colocable, gizmo para posar y estudio de miniaturas.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { BokehPass } from "three/addons/postprocessing/BokehPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { crearPersonaje } from "./personaje.js";
import { Rostro, resolverExpresion } from "./rostro.js";
import { evaluar, aplicar } from "./motor.js";
import { Mundo, B, BLOQUES, VIENTO, AGUA, TINTE, conTinte, MUNDOS_REALES, cargarMundoReal } from "./mundo.js";
import { Mobs } from "./mobs.js";
import { Titulos3D } from "./titulos3d.js";
import { Efectos } from "./efectos.js";

const D2R = Math.PI / 180;

// v = {az, el, dist, ty} relativo al actor (az 0 = de frente al personaje)
export function posicionCamara(cam, v, actor = { x: 0, y: 0, z: 0, rot: 0 }) {
  const az = (v.az + (actor.rot || 0)) * D2R, el = v.el * D2R;
  const ty = v.ty + (actor.y || 0);
  cam.position.set(actor.x + Math.sin(az) * Math.cos(el) * v.dist, ty + Math.sin(el) * v.dist, actor.z + Math.cos(az) * Math.cos(el) * v.dist);
  cam.lookAt(actor.x, ty, actor.z);
  if (v.pan) cam.rotateY(v.pan * D2R);
  if (v.tilt) cam.rotateX(v.tilt * D2R);
  if (v.roll) cam.rotateZ(v.roll * D2R);
}

const EfectoCamara = {
  uniforms: { tDiffuse: { value: null }, tiempo: { value: 0 }, grano: { value: 0 }, aberracion: { value: 0 }, vineta: { value: 0 }, saturacion: { value: 1 }, suavidad: { value: 0 }, contraste: { value: 1 }, balance: { value: new THREE.Vector3(1, 1, 1) }, resol: { value: new THREE.Vector2(1, 1) }, premium: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float tiempo, grano, aberracion, vineta, saturacion, suavidad, contraste, premium; uniform vec3 balance; uniform vec2 resol; varying vec2 vUv;
    float az(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec2 d = vUv - 0.5; float r2 = dot(d, d);
      vec2 off = d * aberracion * 0.018 * (0.25 + r2 * 2.5);
      vec4 c = texture2D(tDiffuse, vUv);
      c.r = texture2D(tDiffuse, vUv + off).r; c.b = texture2D(tDiffuse, vUv - off).b;
      // suavidad óptica (lente de videocámara): mezcla con un desenfoque de ~1.5 px
      vec2 px = 2.6 / resol;
      vec3 sv = (texture2D(tDiffuse, vUv + vec2(px.x, 0.)).rgb + texture2D(tDiffuse, vUv - vec2(px.x, 0.)).rgb
               + texture2D(tDiffuse, vUv + vec2(0., px.y)).rgb + texture2D(tDiffuse, vUv - vec2(0., px.y)).rgb) * 0.25;
      c.rgb = mix(c.rgb, sv, suavidad);
      // saturación (el original es mucho más colorido)
      float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
      c.rgb = clamp(mix(vec3(l), c.rgb, saturacion), 0., 1.);
      c.rgb = clamp((c.rgb - 0.5) * contraste + 0.5, 0., 1.);
      c.rgb = clamp(c.rgb * balance, 0., 1.);              // balance de blancos (el original es más frío)
      // etalonaje del modo premium: sombras hacia el azul petróleo, luces cálidas, curva en S y algo más de color
      if (premium > 0.) {
        float L = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
        vec3 tono = mix(vec3(0.90, 0.98, 1.10), vec3(1.04, 1.0, 0.95), smoothstep(0.12, 0.72, L));
        vec3 g = clamp(c.rgb * tono, 0., 1.);
        g = mix(g, g * g * (3. - 2. * g), 0.38);
        float L2 = dot(g, vec3(0.2126, 0.7152, 0.0722));
        g = clamp(mix(vec3(L2), g, 1.1), 0., 1.);
        c.rgb = mix(c.rgb, g, premium);
      }
      float n = az(floor(vUv * resol / 1.5) + fract(tiempo * 7.13) * 100.0) - 0.5;
      c.rgb += n * grano * 0.22 * (1.0 - 0.5 * dot(c.rgb, vec3(.33)));
      c.rgb *= mix(1.0, smoothstep(0.75, 0.12, r2 * 1.9), vineta);
      gl_FragColor = c;
    }`,
};


// Filtros de Minecraft (los "Super Secret Settings" de la 1.8 y los efectos de estado del juego) e impact frames.
// Lo controlan los efectos `filtro` e `impacto` de la toma (js/efectos.js → fx.post). Va al final, sobre la imagen ya
// en sRGB. modo: 1 invert (visión de enderman) · 2 creeper · 3 spider · 4 sobel · 5 pencil · 6 bits · 7 deconverge ·
// 8 wobble · 9 ntsc · 10 flip · 11 nausea (portal) · 12 oscuridad (warden) · 13 nieve (nieve en polvo) · 14 vision nocturna.
// impacto: 1 = silueta negra sobre blanco con líneas radiales de pixeles · 2 = invertido (silueta del color, fondo negro).
// La silueta sale de tMascara: LTezla, mobs y efectos dibujados en blanco sin el mundo ni el cielo.
export const FILTROS_MC = { invert: 1, creeper: 2, spider: 3, sobel: 4, pencil: 5, bits: 6, deconverge: 7, wobble: 8, ntsc: 9, flip: 10, nausea: 11, oscuridad: 12, nieve: 13, vision: 14 };
const SuperSecreto = {
  uniforms: { tDiffuse: { value: null }, tMascara: { value: null }, modo: { value: 0 }, fuerza: { value: 1 }, tiempo: { value: 0 }, resol: { value: new THREE.Vector2(1, 1) },
    impacto: { value: 0 }, colorImp: { value: new THREE.Color(1, 0.3, 0.5) }, centro: { value: new THREE.Vector2(0.5, 0.5) }, semilla: { value: 0 }, pixel: { value: 6 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse, tMascara; uniform float modo, fuerza, tiempo, impacto, semilla, pixel; uniform vec2 resol, centro; uniform vec3 colorImp; varying vec2 vUv;
    float az(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    vec3 tx(vec2 u){ return texture2D(tDiffuse, clamp(u, 0.001, 0.999)).rgb; }
    float lum(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }
    float bordes(vec2 u, vec2 px){
      float a = lum(tx(u + vec2(-px.x, px.y))), b = lum(tx(u + vec2(0., px.y))), c = lum(tx(u + px));
      float d = lum(tx(u - vec2(px.x, 0.))), f = lum(tx(u + vec2(px.x, 0.)));
      float g = lum(tx(u - px)), h = lum(tx(u - vec2(0., px.y))), i = lum(tx(u + vec2(px.x, -px.y)));
      float gx = -a - 2. * d - g + c + 2. * f + i, gy = -a - 2. * b - c + g + 2. * h + i;
      return sqrt(gx * gx + gy * gy);
    }
    // la parte que va con la "rejilla de pixeles" de Minecraft: todo se cuantiza a celdas de 'pixel' px
    vec2 celda(vec2 u, float p){ vec2 q = resol / p; return (floor(u * q) + 0.5) / q; }
    vec3 filtro(vec2 u, float m){
      vec2 px = 1. / resol;
      if (m < 1.5) return 1. - tx(u);
      if (m < 2.5) {                                        // creeper: verde, de baja resolución, con líneas
        vec3 c = tx(celda(u, 4.)); float l = lum(c);
        vec3 g = vec3(0.12, 0.9, 0.25) * (0.25 + l * 1.1);
        return g * (0.85 + 0.15 * step(0.5, fract(u.y * resol.y / 4.)));
      }
      if (m < 3.5) {                                        // spider: 8 ojos (3×3 sin el centro de abajo), cada uno con la imagen
        vec2 asp = vec2(resol.x / resol.y, 1.);
        vec3 acc = vec3(0.); float w = 0.;
        for (int i = 0; i < 9; i++) {
          if (i == 7) continue;
          vec2 o = vec2(float(i - (i / 3) * 3) - 1., float(i / 3) - 1.) * vec2(0.3, 0.26);
          vec2 d = (u - 0.5 - o) * asp; float r = length(d);
          float k = smoothstep(0.16, 0.13, r);
          if (k > 0.) { acc += k * tx(0.5 + d / asp * 2.2 + o * 0.3); w += k; }
        }
        return mix(vec3(0.02), acc / max(w, 1e-3), clamp(w, 0., 1.)) * vec3(1., 0.85, 0.85);
      }
      if (m < 4.5) { float e = bordes(u, px * 1.5); vec3 c = tx(u); return clamp(e * 2.2, 0., 1.) * normalize(c + 0.15) * 1.6; }
      if (m < 5.5) {                                        // pencil: dibujo a lápiz sobre papel
        float e = bordes(u, px * 1.2), l = lum(tx(u));
        float tr = step(0.55, fract((u.x + u.y) * resol.y / 5.)) * step(l, 0.42) * 0.35;
        return vec3(0.96, 0.94, 0.88) * (1. - clamp(e * 2.6, 0., 1.)) * (1. - tr);
      }
      if (m < 6.5) {                                        // bits: pixeles grandes, 4 niveles por canal y tramado
        vec2 c = celda(u, 6.); vec3 col = tx(c);
        vec2 q = floor(u * resol / 6.); float dith = (mod(q.x + q.y * 2., 4.) / 4. - 0.375) * 0.25;
        return floor((col + dith) * 3. + 0.5) / 3.;
      }
      if (m < 7.5) { vec2 d = (u - 0.5) * 0.02; return vec3(tx(u + d).r, tx(u).g, tx(u - d).b); }
      if (m < 8.5) {                                        // wobble: ondas y el color que gira
        vec2 w = u + vec2(sin(u.y * 12. + tiempo * 4.), cos(u.x * 10. + tiempo * 3.)) * 0.012;
        vec3 c = tx(w); float a = tiempo * 2.;
        mat3 hue = mat3(0.299 + 0.701 * cos(a) + 0.168 * sin(a), 0.587 - 0.587 * cos(a) + 0.330 * sin(a), 0.114 - 0.114 * cos(a) - 0.497 * sin(a),
                        0.299 - 0.299 * cos(a) - 0.328 * sin(a), 0.587 + 0.413 * cos(a) + 0.035 * sin(a), 0.114 - 0.114 * cos(a) + 0.292 * sin(a),
                        0.299 - 0.300 * cos(a) + 1.250 * sin(a), 0.587 - 0.588 * cos(a) - 1.050 * sin(a), 0.114 + 0.886 * cos(a) - 0.203 * sin(a));
        return clamp(c * hue, 0., 1.);
      }
      if (m < 9.5) {                                        // ntsc: tele vieja (curva, color corrido, líneas)
        vec2 d = u - 0.5; vec2 w = 0.5 + d * (1. + dot(d, d) * 0.18);
        vec3 c = vec3(tx(w + vec2(px.x * 3., 0.)).r, tx(w).g, tx(w - vec2(px.x * 3., 0.)).b);
        c *= 0.8 + 0.2 * sin(w.y * resol.y * 1.6);
        return c * step(abs(w.x - 0.5), 0.5) * step(abs(w.y - 0.5), 0.5);
      }
      if (m < 10.5) return tx(vec2(u.x, 1. - u.y));
      if (m < 11.5) {                                       // nausea / portal del Nether: remolino y tinte morado
        vec2 d = u - 0.5; float r = length(d), a = atan(d.y, d.x) + sin(tiempo * 2.) * 0.25 * (1. - r);
        vec3 c = tx(0.5 + vec2(cos(a), sin(a)) * r * (1. + 0.03 * sin(tiempo * 5.)));
        return mix(c, vec3(0.55, 0.2, 0.9), 0.35 + 0.15 * sin(tiempo * 3. + r * 10.));
      }
      if (m < 12.5) {                                       // oscuridad del warden: pulso negro desde los bordes
        float r = length((u - 0.5) * vec2(resol.x / resol.y, 1.));
        float p = 0.5 + 0.5 * sin(tiempo * 6.2832 * 0.8);
        return tx(u) * smoothstep(0.75 - 0.45 * p, 0.05, r) * (0.7 + 0.3 * (1. - p));
      }
      if (m < 13.5) {                                       // nieve en polvo: marco escarchado de pixeles
        vec2 q = floor(u * resol / 8.); float r = length(u - 0.5) * 1.6 + (az(q) - 0.5) * 0.25;
        return mix(tx(u), vec3(0.85, 0.93, 1.), smoothstep(0.55, 0.85, r) * 0.9);
      }
      vec3 c = tx(u); return clamp(vec3(0.6, 0.9, 1.1) * (c * 1.5 + 0.08), 0., 1.);   // visión nocturna
    }
    void main(){
      vec2 u = vUv;
      vec3 base = tx(u);
      vec3 c = base;
      if (modo > 0.5) c = mix(base, filtro(u, modo), fuerza);
      if (impacto > 0.5) {
        // líneas de velocidad radiales hechas de pixeles: ángulo en 'pixel' px, rayos con ancho y largo al azar
        vec2 q = celda(u, pixel);
        vec2 d = (q - centro) * vec2(resol.x / resol.y, 1.);
        float r = length(d), a = atan(d.y, d.x) / 6.2832 + 0.5;
        float n = 90., k = floor(a * n), f = fract(a * n);
        float ancho = 0.12 + 0.5 * az(vec2(k, semilla)), ini = 0.12 + 0.3 * az(vec2(k + 7., semilla));
        float linea = step(abs(f - 0.5), ancho * 0.5 * smoothstep(ini, ini + 0.5, r)) * step(ini, r);
        float m = texture2D(tMascara, u).r;
        float m2 = texture2D(tMascara, q).r;
        float e = clamp(bordes(u, 1.5 / resol) * 2.5, 0., 1.) * step(0.5, m);      // trazos internos de la silueta
        if (impacto < 1.5) {
          vec3 fondo = vec3(1. - linea);
          vec3 sil = vec3(0.04) + step(0.45, e) * 0.9;
          c = mix(fondo, sil, step(0.5, m));
        } else {
          vec3 fondo = vec3(linea);
          vec3 sil = colorImp * (1. - step(0.45, e) * 0.85);
          c = mix(fondo, sil, step(0.5, m));
        }
        // borde de la silueta en la rejilla de pixeles (como un contorno de 1 pixel de Minecraft)
        c = mix(c, impacto < 1.5 ? vec3(0.) : vec3(1.), step(0.5, m2) * (1. - step(0.5, m)) * 0.9);
      }
      gl_FragColor = vec4(c, 1.);
    }`,
};

// Modo premium (como los shaders BSL / Complementary de Minecraft, pero dentro de este motor): rayos de sol volumétricos
// (desenfoque radial del cielo visible hacia el sol), neblina que se tiñe del color del sol según la distancia y
// destellos de lente. Usa la profundidad que ya calcula el pase de oclusión (GTAO), así que no dibuja la escena dos veces.
const Atmosfera = {
  uniforms: { tDiffuse: { value: null }, tDepth: { value: null }, solUV: { value: new THREE.Vector2(0.5, 0.5) }, solVis: { value: 0 },
    solColor: { value: new THREE.Color(1, 0.7, 0.4) }, nieblaColor: { value: new THREE.Color(1, 0.8, 0.7) }, solDir: { value: new THREE.Vector3(0, 0, 1) },
    rayos: { value: 1 }, neblina: { value: 1 }, destellos: { value: 1 }, aspecto: { value: 1 },
    invProj: { value: new THREE.Matrix4() }, camMundo: { value: new THREE.Matrix4() } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse, tDepth; uniform vec2 solUV; uniform float solVis, rayos, neblina, destellos, aspecto;
    uniform vec3 solColor, nieblaColor, solDir; uniform mat4 invProj, camMundo; varying vec2 vUv;
    float cieloEn(vec2 p){ if (p.x < 0. || p.y < 0. || p.x > 1. || p.y > 1.) return 0.; return step(0.99995, texture2D(tDepth, p).x); }
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      float d = texture2D(tDepth, vUv).x;
      vec4 vp = invProj * vec4(vUv * 2. - 1., d * 2. - 1., 1.); vp /= vp.w;
      vec3 dir = normalize((camMundo * vec4(vp.xyz, 0.)).xyz);
      float haciaSol = max(dot(dir, normalize(solDir)), 0.);
      // neblina: más espesa a lo lejos y dorada hacia el sol (el cielo no: ya trae su degradado)
      if (d < 0.99995) {
        float h = 1. - exp(-length(vp.xyz) * 0.0028 * neblina);
        vec3 col = mix(nieblaColor * 0.85, solColor * 1.5, pow(haciaSol, 6.));
        c.rgb = mix(c.rgb, col, h * 0.38);
      }
      // rayos: el cielo visible, cerca del sol, se arrastra hacia afuera
      if (solVis > 0.001 && rayos > 0.) {
        vec2 paso = (vUv - solUV) / 56. * 0.92;
        vec2 p = vUv; float luz = 0., caida = 1.;
        for (int i = 0; i < 56; i++) {
          p -= paso;
          vec2 q = (p - solUV) * vec2(aspecto, 1.);
          luz += cieloEn(p) * caida * (1. - smoothstep(0.0, 0.4, length(q)));
          caida *= 0.965;
        }
        c.rgb += solColor * luz / 56. * 1.05 * rayos * solVis;
      }
      // destellos de lente: fantasmas sobre la línea sol → centro, sólo si el sol se ve (no tapado)
      if (solVis > 0.001 && destellos > 0.) {
        float vis = 0.;
        for (int i = 0; i < 9; i++) { float a = float(i) * 0.6981; vis += cieloEn(solUV + vec2(cos(a), sin(a)) * (i > 0 ? 0.012 : 0.)); }
        vis /= 9.;
        vec2 eje = vec2(0.5) - solUV;
        vec3 g = vec3(0.);
        for (int k = 0; k < 5; k++) {
          float pos = float(k) * 0.45 + 0.35, tam = 0.03 + 0.025 * float(k);
          vec2 gp = solUV + eje * pos * 2.;
          float r = length((vUv - gp) * vec2(aspecto, 1.));
          float disco = smoothstep(tam, tam * 0.55, r);
          vec3 tinte = k == 1 ? vec3(0.5, 0.8, 1.) : (k == 3 ? vec3(1., 0.5, 0.7) : vec3(1., 0.8, 0.5));
          g += tinte * disco * (0.045 - 0.006 * float(k));
        }
        float rs = length((vUv - solUV) * vec2(aspecto, 1.));
        g += solColor * smoothstep(0.16, 0.0, rs) * 0.07;                      // halo grande alrededor del sol
        c.rgb += g * vis * destellos * solVis;
      }
      gl_FragColor = c;
    }`,
};

// ───────────── ambientes del tráiler: cielo, niebla y luz por toma ─────────────
// cielo: degradado arriba/horizonte/abajo + disco de sol con halo · sol: [color, intensidad, dirección]
export const AMBIENTES = {
  dia: { nombre: "Día", arriba: "#3d8be8", horizonte: "#bfe2ff", abajo: "#9cc38a", niebla: ["#bfe2ff", 50, 170], hemi: ["#d2e6ff", "#8a7a60", 1.45], sol: ["#fff1dc", 2.8, [-0.62, 0.95, 0.38]], exp: 1.12, nubes: true, brillo: 0.45 },
  nieve: { nombre: "Nieve (día frío)", arriba: "#3f86e8", horizonte: "#cfe3fa", abajo: "#e8f0f6", niebla: ["#c8dcf2", 45, 170], hemi: ["#cfe0f8", "#7d8a9a", 1.0], sol: ["#fff6ea", 1.9, [-0.5, 0.8, 0.5]], exp: 0.86, nubes: true, brillo: 0.25 },
  noche: { nombre: "Noche con luna", arriba: "#050a2c", horizonte: "#18237a", abajo: "#05061a", niebla: ["#131b58", 30, 130], hemi: ["#5a68d8", "#1a1438", 0.55], sol: ["#c4d0ff", 1.5, [0.2, 0.6, 0.75]], exp: 1.05, tamLuna: 120, estrellas: true, luna: true, brillo: 0.55, halo: 1.18 },
  agua: { nombre: "Bajo el agua", arriba: "#0b2f78", horizonte: "#071f55", abajo: "#020a26", niebla: ["#08245e", 1, 22], hemi: ["#4aa8ff", "#041840", 0.75], sol: ["#7fc8ff", 0.9, [0.1, 1, 0.2]], exp: 1.1, particulas: "agua" },
  rosa: { nombre: "Cielo rosa", arriba: "#f59ac0", horizonte: "#fbb6c4", abajo: "#f2b2c0", niebla: ["#f7bccd", 22, 95], hemi: ["#ffd8e6", "#a07a70", 1.6], sol: ["#ffe4d2", 2.4, [0.5, 0.7, 0.6]], exp: 1.15 },
  dorado: { nombre: "Atardecer dorado (premium)", arriba: "#4a5fb0", horizonte: "#ffb27a", abajo: "#c99a8a", niebla: ["#d9b49e", 90, 520], hemi: ["#ffe2c8", "#5a5a7a", 0.95], sol: ["#ffbf7a", 2.7, [0.12, 0.22, 1]], exp: 0.9, disco: [8, 7], nubesVol: true, brillo: 0.3 },
  atardecer: { nombre: "Atardecer", arriba: "#6a58d8", horizonte: "#ffb488", abajo: "#c98aa8", niebla: ["#eaa6b8", 24, 110], hemi: ["#d8b9ff", "#8a5a60", 1.2], sol: ["#ffb26a", 3.0, [0.1, 0.25, 1]], exp: 1.15, disco: [5, 5], petalos: false },
  lila: { nombre: "Tarde lila", arriba: "#6a57ee", horizonte: "#c7b0ff", abajo: "#9cc38a", niebla: ["#c5b2ff", 30, 140], hemi: ["#d9cdff", "#8a7060", 1.45], sol: ["#ffe2c4", 2.6, [0.6, 0.6, -0.5]], exp: 1.12, nubes: true, brillo: 0.45 },
  nether: { nombre: "Nether", arriba: "#1c0a52", horizonte: "#4a1a7a", abajo: "#2a0a24", niebla: ["#3a1460", 12, 70], hemi: ["#c88cff", "#5a1020", 1.0], sol: ["#ffb070", 1.5, [0.3, 0.9, 0.2]], exp: 1.2, particulas: "esporas" },
};

const D2R_ = Math.PI / 180;
const dirDe = (az, el) => new THREE.Vector3(Math.sin(az * D2R_) * Math.cos(el * D2R_), Math.sin(el * D2R_), Math.cos(az * D2R_) * Math.cos(el * D2R_));

class Cielo {
  constructor(scene) {
    this.grupo = new THREE.Group(); scene.add(this.grupo);
    this.uni = { arriba: { value: new THREE.Color() }, horizonte: { value: new THREE.Color() }, abajo: { value: new THREE.Color() },
      solDir: { value: new THREE.Vector3(0, 0.1, -1) }, solColor: { value: new THREE.Color("#fff2c8") }, disco: { value: 0 },
      nubesVol: { value: 0 }, tiempo: { value: 0 } };
    this.domo = new THREE.Mesh(new THREE.SphereGeometry(320, 32, 16), new THREE.ShaderMaterial({
      uniforms: this.uni, side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform vec3 arriba, horizonte, abajo, solDir, solColor; uniform float disco, nubesVol, tiempo; varying vec3 vDir;
        float hs(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float ruido(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
          return mix(mix(hs(i), hs(i + vec2(1, 0)), f.x), mix(hs(i + vec2(0, 1)), hs(i + vec2(1, 1)), f.x), f.y); }
        float fbm(vec2 p){ float v = 0., a = 0.5; for (int i = 0; i < 5; i++) { v += a * ruido(p); p = p * 2.03 + 7.1; a *= 0.5; } return v; }
        void main(){ float y = vDir.y; vec3 c = y > 0. ? mix(horizonte, arriba, pow(clamp(y, 0., 1.), 0.6)) : mix(horizonte, abajo, pow(clamp(-y * 3., 0., 1.), 0.7));
          vec3 sd = normalize(solDir);
          float s = max(0., dot(normalize(vDir), sd));
          // nubes con volumen (modo premium): capa de ruido proyectada en el cielo, iluminada desde el sol
          if (nubesVol > 0. && y > 0.01) {
            vec2 p = vDir.xz / (y + 0.08) * 1.6 + vec2(tiempo * 0.012, tiempo * 0.004);
            float n = fbm(p);
            float dens = smoothstep(0.42, 0.72, n) * smoothstep(0.01, 0.12, y);
            float frente = fbm(p + sd.xz * 0.12);
            float luz = clamp((n - frente) * 5. + 0.55, 0., 1.);
            vec3 sombra = mix(arriba, vec3(0.42, 0.36, 0.52), 0.5), lit = solColor * 1.25 + vec3(0.12);
            vec3 cn = mix(sombra, lit, luz);
            cn += solColor * pow(s, 8.) * 1.4 * (1. - dens * 0.5);
            cn = mix(cn, horizonte, 1. - smoothstep(0.0, 0.3, y));
            c = mix(c, cn, dens * 0.92 * nubesVol);
          }
          c += solColor * disco * (pow(s, 900.) * 3.0 + pow(s, 40.) * 0.45 + pow(s, 6.) * 0.22);
          gl_FragColor = vec4(c, 1.); }`,
    }));
    this.domo.renderOrder = -10; this.domo.frustumCulled = false;
    // estrellas
    const r = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
    const pos = [];
    for (let i = 0; i < 1600; i++) { const v = new THREE.Vector3(r() - 0.5, r() * 0.9 - 0.05, r() - 0.5).normalize().multiplyScalar(300); pos.push(v.x, v.y, v.z); }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    this.estrellas = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xdfe6ff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85 }));
    // luna (textura real de tu Minecraft si está, si no un cuadro blanco)
    const lunaMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 1.5, 1.65), fog: false, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });   // la luna del juego es blanca sobre negro: se suma
    const cargarCielo = (n, ok) => new THREE.TextureLoader().load("texturas_mc/packs/barebones/environment/" + n, ok, undefined, () => new THREE.TextureLoader().load("texturas_mc/environment/" + n, ok));
    cargarCielo("full_moon.png", (t) => { t.magFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace; lunaMat.map = t; lunaMat.needsUpdate = true; });
    this.luna = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), lunaMat);
    const halo = document.createElement("canvas"); halo.width = halo.height = 128;
    const hx = halo.getContext("2d"), gr = hx.createRadialGradient(64, 64, 8, 64, 64, 64);
    gr.addColorStop(0, "rgba(200,215,255,0.55)"); gr.addColorStop(0.4, "rgba(140,160,255,0.16)"); gr.addColorStop(1, "rgba(80,90,200,0)");
    hx.fillStyle = gr; hx.fillRect(0, 0, 128, 128);
    this.halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(halo), blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true }));
    // nubes cuadradas de Minecraft (textura clouds.png: blanco = nube)
    const nubMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.92, fog: false, side: THREE.DoubleSide, depthWrite: false });
    cargarCielo("clouds.png", (t) => { t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 2); nubMat.map = t; nubMat.alphaMap = null; nubMat.needsUpdate = true; this.nubTex = t; });
    this.nubes = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), nubMat);
    this.nubes.rotation.x = Math.PI / 2;
    // partículas cerca de la cámara (agua: motas brillantes y burbujas · esporas del Nether)
    const N = 420, pp = new Float32Array(N * 3); this.semillas = [];
    for (let i = 0; i < N; i++) this.semillas.push([r(), r(), r(), r()]);
    const pg = new THREE.BufferGeometry(); pg.setAttribute("position", new THREE.BufferAttribute(pp, 3));
    this.part = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0x9ff4ff, size: 0.06, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.part.frustumCulled = false;
    // rayos de luz bajo el agua: planos aditivos con degradado que bajan desde la superficie y se mecen
    const rc = document.createElement("canvas"); rc.width = 32; rc.height = 256;
    const rx = rc.getContext("2d"), rg = rx.createLinearGradient(0, 0, 0, 256);
    rg.addColorStop(0, "rgba(160,235,255,0.55)"); rg.addColorStop(0.55, "rgba(90,190,255,0.18)"); rg.addColorStop(1, "rgba(60,140,255,0)");
    rx.fillStyle = rg; rx.fillRect(0, 0, 32, 256);
    const hg = rx.createLinearGradient(0, 0, 32, 0); hg.addColorStop(0, "rgba(0,0,0,1)"); hg.addColorStop(0.5, "rgba(0,0,0,0)"); hg.addColorStop(1, "rgba(0,0,0,1)");
    rx.globalCompositeOperation = "destination-out"; rx.fillStyle = hg; rx.fillRect(0, 0, 32, 256);
    const rayMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(rc), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide });
    this.rayos = new THREE.Group();
    for (let i = 0; i < 7; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), rayMat); m.userData.s = [r(), r(), r()]; this.rayos.add(m); }
    this.grupo.add(this.domo, this.estrellas, this.luna, this.halo, this.nubes, this.part, this.rayos);
    this.grupo.visible = false;
    this.amb = null;
  }

  usar(amb, dirCielo) {
    this.amb = amb;
    this.grupo.visible = !!amb;
    if (!amb) return;
    this.uni.arriba.value.set(amb.arriba); this.uni.horizonte.value.set(amb.horizonte); this.uni.abajo.value.set(amb.abajo);
    const d = dirCielo || amb.disco || (amb.luna ? [0, 18] : null);
    this.dir = d ? dirDe(d[0], d[1]) : new THREE.Vector3(0, 0.3, -1).normalize();
    this.uni.solDir.value.copy(this.dir);
    this.uni.disco.value = amb.disco ? 1 : 0;
    this.uni.solColor.value.set(amb.sol[0]);
    this.uni.nubesVol.value = amb.nubesVol ? 1 : 0;
    this.estrellas.visible = !!amb.estrellas;
    this.luna.visible = this.halo.visible = !!amb.luna;
    this.nubes.visible = !!amb.nubes;
    this.nubes.material.color.set(amb.luna ? 0x3c4470 : 0xffffff);      // de noche, nubes oscuras contra el cielo
    this.part.visible = !!amb.particulas;
    this.rayos.visible = amb.particulas === "agua";
    if (amb.particulas === "esporas") { this.part.material.color.set(0xff9a6a); this.part.material.size = 0.05; }
    else { this.part.material.color.set(0x8ff0ff); this.part.material.size = 0.1; }
  }

  seguir(cam, t) {
    if (!this.amb) return;
    const p = cam.position;
    this.domo.position.copy(p); this.estrellas.position.copy(p);
    this.uni.tiempo.value = t;
    if (this.luna.visible) {
      // luna por toma ([tamaño, halo]): enorme detrás del lobo, nítida y con poco halo junto al risco
      const tam = this.lunaToma?.[0] ?? this.amb.tamLuna ?? 34, halo = this.lunaToma?.[1] ?? this.amb.halo ?? 1.5;
      this.luna.position.copy(p).addScaledVector(this.dir, 220); this.luna.lookAt(p); this.luna.scale.setScalar(tam);
      this.halo.position.copy(p).addScaledVector(this.dir, 225); this.halo.scale.setScalar(tam * halo);
    }
    if (this.nubes.visible) { this.nubes.position.set(p.x, 70, p.z); if (this.nubTex) this.nubTex.offset.set((p.x / 1400 + t * 0.0015) % 1, (-p.z / 1400) % 1); }
    if (this.rayos.visible) {
      const fw = new THREE.Vector3(); cam.getWorldDirection(fw); fw.y = 0; fw.normalize();
      const der = new THREE.Vector3(fw.z, 0, -fw.x);
      this.rayos.children.forEach((m, i) => {
        const [a, b, c] = m.userData.s, lado = (a - 0.5) * 16 + Math.sin(t * 0.3 + i) * 0.6, lejos = 6 + b * 10;
        m.position.copy(p).addScaledVector(fw, lejos).addScaledVector(der, lado); m.position.y = p.y + 6 + c * 3;
        m.scale.set(1.2 + c * 2.2, 18, 1); m.lookAt(p.x, m.position.y, p.z); m.rotateZ(0.35 + (a - 0.5) * 0.2);
      });
    }
    if (this.part.visible) {
      const a = this.part.geometry.attributes.position, R = 9;
      for (let i = 0; i < this.semillas.length; i++) {
        const [u, v, w, s] = this.semillas[i];
        const sube = this.amb.particulas === "agua" ? (s < 0.25 ? 0.9 : 0.12) : 0.25;
        const m = (x, c) => ((x - c) % (2 * R) + 3 * R) % (2 * R) - R + c;           // caja que se repite alrededor de la cámara
        a.setXYZ(i, m(u * 2 * R + Math.sin(t * 0.4 + s * 9) * 0.6, p.x), m(v * 2 * R + t * sube, p.y), m(w * 2 * R + Math.cos(t * 0.3 + s * 7) * 0.6, p.z));
      }
      a.needsUpdate = true;
    }
  }
}

export class Escena {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.18;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.6;

    this.camara = new THREE.PerspectiveCamera(35, 1, 0.05, 900);
    this.actor = { x: 0, y: 0, z: 0, rot: 0 };
    this.orbita = new OrbitControls(this.camara, canvas);
    this.orbita.enableDamping = true;
    this.orbita.minDistance = 0.4; this.orbita.maxDistance = 60;
    this.vistaInicial();

    this.hemi = new THREE.HemisphereLight(0xb9d4ff, 0x9c8c78, 1.6);
    this.scene.add(this.hemi);
    const sol = new THREE.DirectionalLight(0xfff1dc, 2.6);
    sol.position.set(4, 8, 5); sol.castShadow = true;
    sol.shadow.mapSize.set(4096, 4096);
    sol.shadow.radius = 4; sol.shadow.bias = -0.0004; sol.shadow.normalBias = 0.02;
    this.scene.add(sol, sol.target);
    this.sol = sol;

    this.sombra = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), new THREE.ShadowMaterial({ opacity: 0.25 }));
    this.sombra.rotation.x = -Math.PI / 2; this.sombra.receiveShadow = true;
    this.scene.add(this.sombra);

    // suelo lejano (toma con `sueloInfinito: true`): pasto que sigue más allá del borde del escenario (128×128) hasta perderse
    // en la neblina, con la textura real (1 bloque = 1 repetición). Sigue a la cámara en pasos de 1 bloque para no deslizarse
    this.sueloLejos = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshStandardMaterial({ color: new THREE.Color("#9ccf55"), roughness: 0.95 }));
    this.sueloLejos.rotation.x = -Math.PI / 2; this.sueloLejos.receiveShadow = true; this.sueloLejos.visible = false;
    new THREE.TextureLoader().load("texturas_mc/packs/barebones/block/grass_block_top.png", (tx) => {
      tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.repeat.set(4000, 4000); tx.magFilter = THREE.NearestFilter;
      tx.anisotropy = 8; tx.colorSpace = THREE.SRGBColorSpace;
      this.sueloLejos.material.map = tx; this.sueloLejos.material.needsUpdate = true;
    });
    conTinte(this.sueloLejos.material);                    // y el suelo lejano
    this.scene.add(this.sueloLejos);
    // bosque lejano sobre el suelo lejano: árboles de bloques (tronco + copa) fuera del escenario, lejos del pasillo del
    // rollo (|x| < 46, salvo adelante del frente). Fijos (semilla), así que salen iguales en todas las tomas
    {
      const N = 2600, r = (() => { let s = 11; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
      const tronco = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: "#6b4f2e", roughness: 1 }), N);
      const copa = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 1 }), N);
      const M = new THREE.Matrix4(), C = new THREE.Color(), verdes = ["#4f8f2c", "#5c9a31", "#3f7d27", "#6aa63a", "#7fb03a"];
      let k = 0;
      for (let i = 0; i < N * 4 && k < N; i++) {
        const x = Math.round((r() - 0.5) * 1400), z = Math.round((r() - 0.5) * 1400);
        if ((Math.abs(x) < 46 && z < 80) || (Math.abs(x) < 66 && Math.abs(z) < 66)) continue;   // adelante del frente (z > 80) el rollo no llega
        const h = 4 + Math.floor(r() * 4), w = 3 + Math.floor(r() * 3), hc = 2 + Math.floor(r() * 3);
        tronco.setMatrixAt(k, M.makeScale(1, h, 1).setPosition(x + 0.5, h / 2, z + 0.5));
        copa.setMatrixAt(k, M.makeScale(w, hc, w).setPosition(x + 0.5, h + hc / 2 - 0.5, z + 0.5));
        copa.setColorAt(k, C.set(verdes[Math.floor(r() * verdes.length)]));
        k++;
      }
      tronco.count = copa.count = k;
      for (const m of [tronco, copa]) { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; }
      this.bosqueLejos = new THREE.Group(); this.bosqueLejos.add(tronco, copa); this.bosqueLejos.visible = false;
      this.scene.add(this.bosqueLejos);
      conTinte(tronco.material); conTinte(copa.material);       // el efecto `paleta` también tiñe el bosque lejano
    }
    this.mundo = new Mundo();
    this.mundo.grupo.visible = false;
    this.scene.add(this.mundo.grupo);

    this.grupoActor = new THREE.Group();
    this.scene.add(this.grupoActor);

    // tráiler: un escenario por toma (se generan una vez y se prenden/apagan), cielo y mobs
    this.sets = {}; this.setActual = null; this.reales = null;
    this.cielo = new Cielo(this.scene);
    // antorchas por toma: un grupo fijo de 12 (las luces siempre en la escena, apagadas si no se usan: así no se recompilan
    // los materiales al cambiar de toma)
    this.antorchas = Array.from({ length: 12 }, () => this.nuevaAntorcha());
    this.mobs = new Mobs(this.scene);
    this.titulos = new Titulos3D(this.scene);      // títulos 3D con la fuente Minecraft Ten
    this.fx = new Efectos(this);                   // efectos por toma (js/efectos.js): partículas, flechas, Roadster…
    this.ancla = this.actor;
    this.dirSol = new THREE.Vector3(-0.62, 0.95, 0.38).normalize();

    // marcador para construir
    this.cursor = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.01, 1.01, 1.01)), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }));
    this.cursor.visible = false;
    this.scene.add(this.cursor);

    // gizmo de pose
    this.gizmo = new TransformControls(this.camara, canvas);
    this.gizmo.setMode("rotate"); this.gizmo.setSpace("local"); this.gizmo.setSize(0.7);
    this.gizmo.addEventListener("dragging-changed", (e) => { this.orbita.enabled = !e.value && !this.vistaCamara; this.onGizmoSuelto?.(e.value); });
    this.gizmo.addEventListener("objectChange", () => this.onGizmo?.());
    this.scene.add(this.gizmo.getHelper());
    this.vistaCamara = false;

    // post-proceso
    this.composer = new EffectComposer(this.renderer);
    this.pRender = new RenderPass(this.scene, this.camara);
    this.pAO = new GTAOPass(this.scene, this.camara, 512, 512);
    this.pAO.output = GTAOPass.OUTPUT.Default;
    this.pAO.blendIntensity = 0.9;
    this.pAO.updateGtaoMaterial({ radius: 0.35, distanceExponent: 1.4, thickness: 1, scale: 1.1, samples: 16 });
    this.pBokeh = new BokehPass(this.scene, this.camara, { focus: 3, aperture: 0.004, maxblur: 0.008 });
    this.pAtmos = new ShaderPass(Atmosfera); this.pAtmos.enabled = false;
    // reflejo planar del agua (premium): la escena reflejada en el nivel del mar, a media resolución
    this.rtRefl = new THREE.WebGLRenderTarget(256, 256, { type: THREE.HalfFloatType });
    this.camRefl = new THREE.PerspectiveCamera();
    // el cielo (luna, halo, estrellas) no debe proyectar oclusión ambiental: se apaga solo durante ese pase
    const renderAO = this.pAO.render.bind(this.pAO);
    this.pAO.render = (...a) => { const v = this.cielo.grupo.visible, f = this.fx.sinAO.visible; this.cielo.grupo.visible = false; this.fx.sinAO.visible = false; renderAO(...a); this.cielo.grupo.visible = v; this.fx.sinAO.visible = f; };
    this.pBrillo = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.35, 0.55, 0.82);     // bloom: luna, sol, lava, nieve al sol
    this.pSalida = new OutputPass();
    this.pEfecto = new ShaderPass(EfectoCamara);
    // filtros de Minecraft e impact frames (efectos `filtro` / `impacto`): al final; la silueta se dibuja en rtMascara
    this.pSecreto = new ShaderPass(SuperSecreto); this.pSecreto.enabled = false;
    this.rtMascara = new THREE.WebGLRenderTarget(512, 512);
    this.matMascara = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false, toneMapped: false });
    for (const p of [this.pRender, this.pAO, this.pAtmos, this.pBokeh, this.pBrillo, this.pSalida, this.pEfecto, this.pSecreto]) this.composer.addPass(p);
    this.cfg = { calidad: "cine", ao: true, dof: 0, grano: 0, aberracion: 0, vineta: 0, saturacion: 1, suavidad: 0, brillo: 0, contraste: 1 };
    this.reloj = new THREE.Clock();
  }

  vistaInicial() {
    posicionCamara(this.camara, { az: 25, el: 8, dist: 4.6, ty: 1.05 }, this.actor);
    this.orbita.target.set(this.actor.x, this.actor.y + 1.05, this.actor.z);
  }

  ponerPersonaje(p) {
    if (this.personaje) { this.gizmo.detach(); this.grupoActor.remove(this.personaje.grupo); this.personaje.dispose(); }
    this.personaje = p;
    this.grupoActor.add(p.grupo);
  }

  colocarActor(a) {
    const dx = a.x - this.actor.x, dy = (a.y || 0) - this.actor.y, dz = a.z - this.actor.z;
    this.actor = { x: a.x, y: a.y || 0, z: a.z, rot: a.rot || 0 };
    this.grupoActor.position.set(this.actor.x, this.actor.y, this.actor.z);
    this.grupoActor.rotation.y = this.actor.rot * D2R;
    // la órbita sigue al personaje
    this.orbita.target.add(new THREE.Vector3(dx, dy, dz));
    this.camara.position.add(new THREE.Vector3(dx, dy, dz));
    this.sombra.position.set(this.actor.x, this.actor.y + 0.001, this.actor.z);
    this.colocarSol();
  }

  colocarSol() {
    const mundo = this.mundo.grupo.visible || !!this.setActual;
    const c = this.ancla || this.actor;
    this.sol.position.copy(this.dirSol).multiplyScalar(mundo ? 45 : 9).add(new THREE.Vector3(c.x, c.y, c.z));
    this.sol.target.position.set(c.x, c.y, c.z);
  }

  // antorcha: palo y llama (más brillante que 1: la toma el bloom) con una luz cálida que parpadea
  nuevaAntorcha() {
    const g = new THREE.Group();
    const palo = new THREE.Mesh(new THREE.BoxGeometry(0.125, 0.62, 0.125), new THREE.MeshStandardMaterial({ color: 0x6b4f2a, roughness: 0.9 }));
    palo.position.y = 0.31; palo.castShadow = true;
    const llama = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.17, 0.15), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 2.3, 0.6), fog: false }));
    llama.position.y = 0.7;
    const brasa = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.09), new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 4.2, 2.2), fog: false }));
    brasa.position.y = 0.74;
    const luz = new THREE.PointLight(0xff9a3c, 0, 11, 1.4); luz.position.y = 0.85;
    const cuerpo = new THREE.Group(); cuerpo.add(palo, llama, brasa); cuerpo.visible = false;
    g.add(cuerpo, luz); g.userData = { luz, llama, cuerpo };
    this.scene.add(g);
    return g;
  }
  // campo `antorchas` de la toma: [[x, z, intensidad?, y?], …] relativos al ancla; se paran en el bloque más alto
  usarAntorchas(lista, ancla, mundo, t) {
    this.antorchas.forEach((a, i) => {
      const p = lista?.[i], { luz, llama, cuerpo } = a.userData;
      cuerpo.visible = !!p;
      if (!p) { luz.intensity = 0; return; }
      const x = (ancla?.x || 0) + p[0], z = (ancla?.z || 0) + p[1];
      a.position.set(x, p[3] ?? this.alturaSet(mundo, x, z), z);
      const f = 1 + 0.13 * Math.sin(t * 13.1 + i * 2.1) + 0.07 * Math.sin(t * 27.3 + i * 0.7);   // parpadeo
      luz.intensity = (p[2] ?? 7) * f;
      llama.scale.set(1, 0.85 + 0.25 * Math.max(0, Math.sin(t * 17 + i)), 1);
    });
  }
  alturaSet(m, x, z) {
    if (!m) return 0;
    const cx = Math.floor(x + m.O.x), cz = Math.floor(z + m.O.z);
    if (cx < 0 || cz < 0 || cx >= m.T.x || cz >= m.T.z) return 0;
    let y = m.T.y - 1;
    while (y > 0) { const id = m.get(cx, y, cz); if (id && !["planta", "capa", "antorcha", "alfombra", "recorte"].includes(BLOQUES[id]?.tipo)) break; y--; }
    return y + 1 - m.O.y;
  }

  // escenario del tráiler (null = el mundo normal del proyecto)
  usarSet(nombre) {
    if (nombre === this.setActual) return;
    if (nombre && !this.sets[nombre]) {
      let tam = { x: 128, y: 60, z: 128 }, origen = { x: 64, y: 26, z: 64 };
      if (nombre.startsWith("real:")) {                  // mundo real importado: su propio tamaño
        const r = MUNDOS_REALES.get(nombre);
        if (!r?.ids) { cargarMundoReal(nombre); return; }
        tam = r.meta.tam; origen = r.meta.origen;
      }
      const m = new Mundo(this.reales, tam, origen);
      m.generar(nombre);
      this.sets[nombre] = m; this.scene.add(m.grupo);
      this.edicionesSet(nombre, m);
    }
    for (const [k, m] of Object.entries(this.sets)) m.grupo.visible = k === nombre || k === this.fondoActual;
    this.setActual = nombre || null;
    if (nombre) { this.mundo.grupo.visible = false; this.sombra.visible = false; }
    else if (this.esc) this.fondo(this.esc);
    const s = this.sol.shadow.camera;
    if (nombre) { Object.assign(s, { left: -24, right: 24, top: 24, bottom: -24, near: 0.5, far: 140 }); s.updateProjectionMatrix(); }
  }
  // bloques puestos o quitados por el agente (proyecto.ediciones = {escenario: [[x, y, z, "bloque" | "aire"], …]}, en
  // coordenadas de la escena: y = 0 es el piso). Si cambian, el escenario se regenera y se vuelven a aplicar todas.
  sincronizarEdiciones(ed) {
    if (ed === this._ediciones) return;
    this._ediciones = ed;
    let cambio = false;
    for (const [nombre, m] of Object.entries(this.sets)) cambio = this.edicionesSet(nombre, m) || cambio;
    if (cambio) this.mobs.sims.clear();              // la física de los mobs depende de los bloques
  }
  edicionesSet(nombre, m) {
    const lista = this._ediciones?.[nombre] || [], firma = JSON.stringify(lista);
    if ((m._firma ?? "[]") === firma) { m._firma = firma; return false; }
    if (m._firma && m._firma !== "[]") m.generar(nombre);          // quitar ediciones viejas: volver a generar
    for (const [x, y, z, id] of lista) m.set(m.O.x + x, m.O.y + y, m.O.z + z, id === "aire" ? 0 : B[id] ?? 0);
    m.reconstruir();
    m._firma = firma;
    return true;
  }
  // fondo lejano de la toma (otro escenario dibujado más grande y lejos: montañas). cfg = {x, y, z, escala, rot}
  usarFondo(nombre, cfg = {}) {
    const clave = nombre ? nombre + JSON.stringify(cfg) : null;
    if (clave === this.fondoClave) return;
    this.fondoClave = clave;
    const antes = this.fondoActual;
    if (nombre && !this.sets[nombre]) {
      const m = new Mundo(this.reales, { x: 128, y: 60, z: 128 }, { x: 64, y: 26, z: 64 });
      m.generar(nombre); this.sets[nombre] = m; this.scene.add(m.grupo);
      this.edicionesSet(nombre, m);
    }
    if (antes && this.sets[antes] && antes !== this.setActual) this.sets[antes].grupo.visible = false;
    this.fondoActual = nombre || null;
    if (nombre) {
      const g = this.sets[nombre].grupo;
      g.visible = true; g.scale.setScalar(cfg.escala ?? 3); g.position.set(cfg.x ?? 0, cfg.y ?? 0, cfg.z ?? -200); g.rotation.y = (cfg.rot ?? 0) * D2R;
      for (const mm of Object.values(this.sets[nombre].mallas)) mm.castShadow = false;
    }
  }
  usarSueloLejos(tipo) {
    const m = this.sueloLejos.material, mar = tipo === "agua";
    this.sueloLejos.visible = !!tipo; this.bosqueLejos.visible = !!tipo && !mar;
    if (!tipo || m.userData.tipo === tipo) return;
    m.userData.tipo = tipo;
    if (mar) { m.color.set("#2f62c8"); m.roughness = 0.25; m.metalness = 0.1; m.userData.tex ||= m.map; m.map = null; }
    else { m.color.set("#9ccf55"); m.roughness = 0.95; m.metalness = 0; if (m.userData.tex) m.map = m.userData.tex; }
    m.needsUpdate = true;
  }

  texturasSets(reales) {
    this.reales = reales;
    for (const m of Object.values(this.sets)) m.usarTexturas(reales);
  }

  // cielo, niebla y luz de la toma (null = lo del panel Escena)
  ambiente(nombre, dirCielo = null) {
    const clave = nombre ? nombre + JSON.stringify(dirCielo) : null;
    if (clave === this.ambClave) return;
    this.ambClave = clave;
    const a = nombre && AMBIENTES[nombre];
    this.amb = a || null;
    this.cielo.usar(a || null, dirCielo);
    if (!a) { this.dirSol.set(-0.62, 0.95, 0.38).normalize(); if (this.esc) this.fondo(this.esc); return; }
    this.scene.background = new THREE.Color(a.horizonte);
    this.scene.fog = new THREE.Fog(a.niebla[0], a.niebla[1], a.niebla[2]);
    AGUA.cielo.value.set(a.horizonte).lerp(new THREE.Color(a.arriba), 0.35);      // lo que refleja el agua
    this.hemi.color.set(a.hemi[0]); this.hemi.groundColor.set(a.hemi[1]); this.hemi.intensity = a.hemi[2];
    this.sol.color.set(a.sol[0]); this.sol.intensity = a.sol[1];
    this.dirSol.set(...a.sol[2]).normalize();
    this.renderer.toneMappingExposure = a.exp ?? 1.18;
    this.scene.environmentIntensity = nombre === "noche" ? 0.1 : nombre === "agua" ? 0.35 : 0.6;
    this.colocarSol();
  }

  fondo(esc) {
    this.esc = esc;
    if (this.ambClave) return;                           // el ambiente de la toma manda
    this.hemi.color.set(0xb9d4ff); this.hemi.groundColor.set(0x9c8c78); this.hemi.intensity = 1.6;
    this.sol.color.set(0xfff1dc); this.sol.intensity = 2.6; this.renderer.toneMappingExposure = 1.18; this.scene.environmentIntensity = 0.6;
    const mundo = esc.fondo === "mundo" && !this.setActual;
    this.mundo.grupo.visible = mundo;
    this.sombra.visible = !mundo && esc.sombras;
    this.sol.castShadow = esc.sombras;
    const s = this.sol.shadow.camera, r = mundo ? 22 : 4;
    Object.assign(s, { left: -r, right: r, top: r, bottom: -r, near: 0.5, far: mundo ? 120 : 30 });
    s.updateProjectionMatrix();
    this.colocarSol();
    if (esc.fondo === "transparente") { this.scene.background = null; this.scene.fog = null; this.renderer.setClearColor(0x000000, 0); }
    else if (esc.fondo === "color") { this.scene.background = new THREE.Color(esc.color); this.scene.fog = null; }
    else { this.scene.background = new THREE.Color(esc.cielo || "#9cc9f5"); this.scene.fog = new THREE.Fog(esc.cielo || "#9cc9f5", 40, 110); }
  }

  efectos(cfg) {
    this.cfg = { ...this.cfg, ...cfg };
  }

  tamano(w, h) {
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(w, h);
    this.camara.aspect = w / h; this.camara.updateProjectionMatrix();
    this.pEfecto.uniforms.resol.value.set(w * this.renderer.getPixelRatio(), h * this.renderer.getPixelRatio());
    this.pSecreto.uniforms.resol.value.set(w * this.renderer.getPixelRatio(), h * this.renderer.getPixelRatio());
    this.rtMascara.setSize(Math.max(1, Math.round(w * this.renderer.getPixelRatio() / 2)), Math.max(1, Math.round(h * this.renderer.getPixelRatio() / 2)));
    this.rtRefl.setSize(Math.max(64, Math.round(w * this.renderer.getPixelRatio() / 2)), Math.max(64, Math.round(h * this.renderer.getPixelRatio() / 2)));
  }

  usarVistaCamara(v) {
    this.vistaCamara = v;
    this.orbita.enabled = !v;
  }

  // vista actual relativa al actor (para guardar tomas)
  vistaActual() {
    const t = this.orbita.target;
    const p = this.camara.position.clone().sub(t);
    const dist = p.length();
    return { az: Math.atan2(p.x, p.z) / D2R - this.actor.rot, el: Math.asin(p.y / dist) / D2R, dist, ty: t.y - this.actor.y };
  }

  // actor desplazado por el cuerpo (para tomas que siguen al personaje)
  actorCon(ofs) { return ofs ? { ...this.actor, x: this.actor.x + ofs.x, y: this.actor.y + ofs.y, z: this.actor.z + ofs.z } : this.actor; }
  // de dónde sale la cámara: fija = el ancla de la toma (el personaje puede salir de cuadro); si no, el personaje
  baseCamara(cam, ofs) { return cam.fija ? this.ancla : this.actorCon(cam.seguir ? ofs : null); }

  // enfoque automático tipo videocámara: la distancia de foco persigue a la cara con retraso
  enfocar(objetivo, t, reiniciar) {
    const dt = this.tFoco == null ? 1 : t - this.tFoco;
    this.tFoco = t;
    if (this.foco == null || dt < 0 || dt > 0.5) { this.foco = objetivo; this.focoV = 0; }
    if (reiniciar) { this.foco = objetivo * 3.4 + 2.5; this.focoV = 0; }     // arranca muy desenfocado (medido: 17 % de nitidez)
    const om = 10, z = 0.72, pasos = Math.max(1, Math.ceil(Math.max(0, dt) / (1 / 120))), h = Math.max(0, dt) / pasos;
    for (let i = 0; i < pasos; i++) { this.focoV += (om * om * (objetivo - this.foco) - 2 * z * om * this.focoV) * h; this.foco += this.focoV * h; }
    return this.foco;
  }

  render(cam, { fov, ofs, cabeza, t = 0, corte = false, textos = [] } = {}) {
    if (corte) this.foco = null;                          // en un corte el foco ya está puesto
    if (cam && this.vistaCamara) {
      posicionCamara(this.camara, cam, this.baseCamara(cam, ofs));
      if (cam.fov && this.camara.fov !== cam.fov) { this.camara.fov = cam.fov; this.camara.updateProjectionMatrix(); }
    } else {
      if (this.camara.fov !== (fov || 35)) { this.camara.fov = fov || 35; this.camara.updateProjectionMatrix(); }
      this.orbita.update();
    }
    // sacudida de cámara y golpe de zoom (efecto `sacude`): se suma después de poner la cámara de la toma
    const sac = this.vistaCamara && this.fx.post?.sacude;
    if (sac) {
      this.camara.updateMatrixWorld();
      const der = new THREE.Vector3().setFromMatrixColumn(this.camara.matrixWorld, 0), arr = new THREE.Vector3().setFromMatrixColumn(this.camara.matrixWorld, 1);
      this.camara.position.addScaledVector(der, sac.x).addScaledVector(arr, sac.y);
      this.camara.rotateZ(sac.giro * D2R);
      this.camara.fov = this.camara.fov * sac.zoom; this.camara.updateProjectionMatrix();
    }
    this.camara.updateMatrixWorld();
    this.cielo.seguir(this.camara, t);
    if (this.sueloLejos.visible) this.sueloLejos.position.set(Math.round(this.camara.position.x), this.sueloLejos.material.userData.tipo === "agua" ? -0.3 : -0.02, Math.round(this.camara.position.z));
    this.fx.antesDeRender(this.camara, this.renderer);
    this.titulos.poner(textos, this.camara);
    const c = this.cfg;
    if (c.calidad !== "cine") { this.renderer.render(this.scene, this.camara); this.titulos.dibujar(this.renderer, this.camara); return; }
    const transparente = !this.scene.background;
    const premium = !!c.premium && !transparente;
    VIENTO.tiempo.value = t; VIENTO.fuerza.value = premium ? (c.viento ?? 1) : 0;
    this.pAO.enabled = c.ao || premium;                   // premium usa la profundidad del pase de oclusión
    this.pAtmos.enabled = premium && !!this.amb;
    if (this.pAtmos.enabled) {
      const u = this.pAtmos.uniforms, dir = this.cielo.dir || new THREE.Vector3(0, 0.3, 1).normalize();
      const p = this.camara.position.clone().addScaledVector(dir, 500).project(this.camara);
      const fw = new THREE.Vector3(); this.camara.getWorldDirection(fw);
      const delante = fw.dot(dir);
      u.solUV.value.set(p.x * 0.5 + 0.5, p.y * 0.5 + 0.5);
      u.solVis.value = delante <= 0 ? 0 : THREE.MathUtils.smoothstep(1.9, 1.0, Math.max(Math.abs(p.x), Math.abs(p.y))) * THREE.MathUtils.smoothstep(0, 0.25, delante);
      u.solDir.value.copy(dir); u.solColor.value.copy(this.sol.color).multiplyScalar(0.9);
      u.nieblaColor.value.copy(this.scene.fog?.color || new THREE.Color(1, 0.8, 0.7));
      u.tDepth.value = this.pAO.depthTexture;
      u.aspecto.value = this.camara.aspect;
      u.invProj.value.copy(this.camara.projectionMatrixInverse); u.camMundo.value.copy(this.camara.matrixWorld);
      u.rayos.value = c.rayos ?? 1; u.neblina.value = c.neblina ?? 1; u.destellos.value = c.destellos ?? 1;
    }
    this.pBokeh.enabled = c.dof > 0.01 && !transparente;
    if (this.pBokeh.enabled) {
      const meta = cam?.foco ?? this.camara.position.distanceTo(cabeza || new THREE.Vector3(this.actor.x, this.actor.y + (cam?.ty ?? 1.4), this.actor.z));
      const foco = this.enfocar(meta, t, !!cam?.buscarFoco && this.vistaCamara);
      const u = this.pBokeh.uniforms;
      const fuera = Math.min(1, Math.abs(foco - meta) / Math.max(0.5, meta));          // "buscando foco": mucho más borroso
      const dof = c.dof * (this.dofToma ?? 1);
      u.focus.value = foco; u.aperture.value = dof * 0.007; u.maxblur.value = dof * 0.016 * (1 + 3 * fuera);
    }
    const aj = this.ajusteToma || { exp: 1, sat: 1, cal: 0 };
    if (this.amb) this.renderer.toneMappingExposure = (this.amb.exp ?? 1.18) * aj.exp;
    this.pBrillo.enabled = (c.brillo || 0) > 0.01 && !transparente;
    this.pBrillo.strength = (c.brillo || 0) * (this.amb?.brillo ?? 1) * (this.brilloToma ?? 1);
    this.reflejarAgua(premium, t);
    const efecto = premium || !!c.balance || !!this.ajusteToma || Math.abs((c.contraste ?? 1) - 1) > 0.01 || c.grano > 0.01 || c.aberracion > 0.01 || c.vineta > 0.01 || Math.abs((c.saturacion ?? 1) - 1) > 0.01 || (c.suavidad || 0) > 0.01;
    this.pEfecto.enabled = efecto && !transparente;
    const u = this.pEfecto.uniforms;
    u.tiempo.value = this.tiempoEfecto ?? this.reloj.getElapsedTime();
    u.grano.value = c.grano; u.aberracion.value = c.aberracion; u.vineta.value = c.vineta;
    u.saturacion.value = (c.saturacion ?? 1) * aj.sat; u.suavidad.value = c.suavidad || 0; u.contraste.value = c.contraste ?? 1;
    u.premium.value = premium ? (c.etalonaje ?? 1) : 0;
    const bl = c.balance || [1, 1, 1]; u.balance.value.set(bl[0] * (1 + 0.03 * aj.cal), bl[1], bl[2] * (1 - 0.03 * aj.cal));
    this.posMinecraft(transparente);
    this.composer.render();
    this.titulos.dibujar(this.renderer, this.camara);
  }

  // filtros de Minecraft e impact frames (fx.post, lo calcula js/efectos.js con el tiempo de la toma)
  posMinecraft(transparente) {
    const post = this.fx.post, ps = this.pSecreto, u = ps.uniforms;
    TINTE.mezcla.value = post?.paleta ? post.paleta.mezcla : 0;
    if (post?.paleta) { TINTE.oscuro.value.copy(post.paleta.oscuro); TINTE.claro.value.copy(post.paleta.claro); }
    ps.enabled = !transparente && !!post && (post.modo > 0 || post.impacto > 0);
    if (!ps.enabled) return;
    u.modo.value = post.modo; u.fuerza.value = post.fuerza; u.tiempo.value = post.t;
    u.impacto.value = post.impacto;
    if (post.impacto > 0) {
      u.colorImp.value.copy(post.color);
      if (post.centro) u.centro.value.set(post.centro[0], post.centro[1]);
      else {                                               // las líneas salen del pecho de LTezla en la pantalla
        const q = new THREE.Vector3().setFromMatrixPosition(this.grupoActor.matrixWorld); q.y += 1.1; q.project(this.camara);
        u.centro.value.set(THREE.MathUtils.clamp(q.x * 0.5 + 0.5, 0.15, 0.85), THREE.MathUtils.clamp(q.y * 0.5 + 0.5, 0.15, 0.85));
      }
      u.semilla.value = post.semilla; u.pixel.value = post.pixel;
      this.dibujarMascara();
      u.tMascara.value = this.rtMascara.texture;
    }
  }

  // la silueta del impact frame: todo lo que no es mundo ni cielo (LTezla, mobs, efectos, bloques musicales) en blanco
  dibujarMascara() {
    const fuera = [this.mundo.grupo, this.cielo.grupo, this.sueloLejos, this.bosqueLejos, this.sombra, this.cursor, this.gizmo.getHelper(),
      ...Object.values(this.sets).map(m => m.grupo), ...Object.values(this.fx.nubes).map(n => n.obj), this.fx.nubeNota.obj, this.fx.pulsos,
      ...Object.values(this.fx.nubesTrozo || {}).map(n => n.obj),
      // brillos sumados (destellos, ondas, haces de luz): no son cuerpos, no van en la silueta
      ...this.fx.sinAO.children.filter(o => o.isSprite || o.material?.blending === THREE.AdditiveBlending),
      // con soloActor (por defecto) la silueta es sólo LTezla y los mobs: los bloques cerca de la cámara llenaban el cuadro
      ...(this.fx.post?.soloActor === false ? [] : [this.fx.sinAO, this.fx.grupo])];
    const antes = fuera.map(o => o.visible), fondo = this.scene.background, niebla = this.scene.fog;
    fuera.forEach(o => { o.visible = false; });
    this.scene.background = new THREE.Color(0, 0, 0); this.scene.fog = null;
    this.scene.overrideMaterial = this.matMascara;
    const rt = this.renderer.getRenderTarget(), tm = this.renderer.toneMapping;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.setRenderTarget(this.rtMascara); this.renderer.clear(); this.renderer.render(this.scene, this.camara);
    this.renderer.setRenderTarget(rt); this.renderer.toneMapping = tm;
    this.scene.overrideMaterial = null; this.scene.background = fondo; this.scene.fog = niebla;
    fuera.forEach((o, i) => { o.visible = antes[i]; });
  }

  // dibuja la escena reflejada en el plano del agua (y = nivelAgua: la superficie del mar de los mundos reales, 2/16 bajo
  // el piso) para el shader del agua. Mismo cálculo que el Reflector de three.js, con un plano de recorte global
  reflejarAgua(premium, t = 0) {
    const m = this.setActual && this.sets[this.setActual], agua = m?.mallas?.agua;
    const usar = premium && agua && agua.geometry.index?.count > 0;
    AGUA.usaRefl.value = usar ? 1 : 0;
    if (!usar) return;
    const h = this.cfg.nivelAgua ?? -0.125, cam = this.camara, rc = this.camRefl, n = new THREE.Vector3(0, 1, 0);
    const P = new THREE.Vector3(cam.position.x, h, cam.position.z), C = new THREE.Vector3().setFromMatrixPosition(cam.matrixWorld);
    const R = new THREE.Matrix4().extractRotation(cam.matrixWorld);
    const vista = new THREE.Vector3().subVectors(P, C).reflect(n).negate().add(P);
    const mira = new THREE.Vector3(0, 0, -1).applyMatrix4(R).add(C);
    const obj = new THREE.Vector3().subVectors(P, mira).reflect(n).negate().add(P);
    rc.position.copy(vista); rc.up.set(0, 1, 0).applyMatrix4(R).reflect(n); rc.lookAt(obj);
    rc.near = cam.near; rc.far = cam.far; rc.updateMatrixWorld(); rc.projectionMatrix.copy(cam.projectionMatrix);
    AGUA.matRefl.value.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1).multiply(rc.projectionMatrix).multiply(rc.matrixWorldInverse);
    const r = this.renderer, antes = r.getRenderTarget(), sombras = r.shadowMap.autoUpdate;
    for (const s of Object.values(this.sets)) if (s.mallas?.agua) s.mallas.agua.visible = false;
    const lejos = this.sueloLejos.visible; this.sueloLejos.visible = false;
    r.shadowMap.autoUpdate = false; r.clippingPlanes = [new THREE.Plane(n, -h)];
    this.cielo.seguir(rc, t);
    r.setRenderTarget(this.rtRefl); r.clear(); r.render(this.scene, rc);
    r.setRenderTarget(antes); r.clippingPlanes = []; r.shadowMap.autoUpdate = sombras;
    this.cielo.seguir(cam, t);
    this.sueloLejos.visible = lejos;
    for (const s of Object.values(this.sets)) if (s.mallas?.agua) s.mallas.agua.visible = true;
    AGUA.refl.value = this.rtRefl.texture;
  }

  // rayo desde el ratón
  rayo(evento) {
    const r = this.canvas.getBoundingClientRect();
    const m = new THREE.Vector2(((evento.clientX - r.left) / r.width) * 2 - 1, -((evento.clientY - r.top) / r.height) * 2 + 1);
    const ray = new THREE.Raycaster(); ray.setFromCamera(m, this.camara);
    return ray;
  }

  juntaEn(evento) {
    if (!this.personaje) return null;
    const ray = this.rayo(evento);
    for (const m of this.personaje.piezas) m.computeBoundingSphere();
    const hit = ray.intersectObjects(this.personaje.piezas, false)[0];
    return hit ? this.personaje.juntaDe(hit) : null;
  }

  // bloque bajo el ratón: {celda, normal, punto}
  bloqueEn(evento) {
    const m = this.setActual ? this.sets[this.setActual] : this.mundo;
    if (!m.grupo.visible) return null;
    const hit = this.rayo(evento).intersectObjects(Object.values(m.mallas), false)[0];
    if (!hit) return null;
    const n = hit.face.normal.clone().round();
    const dentro = hit.point.clone().addScaledVector(n, -0.01);
    return { celda: this.mundo.celda(dentro), normal: n, punto: hit.point };
  }
}

// Estudio de miniaturas: renderer pequeño aparte con su propio personaje
export class Estudio {
  constructor() {
    this.canvas = document.createElement("canvas");
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setSize(150, 150, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.scene = new THREE.Scene();
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8c9aa8, 1.8));
    const sol = new THREE.DirectionalLight(0xffffff, 2.2); sol.position.set(3, 6, 4); this.scene.add(sol);
    this.camara = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    this.rostro = new Rostro();
    this.cache = new Map();
  }
  preparar(skin, cara8, cfgRostro, delgado, pelo) {
    this.rostro.configurar(cara8, cfgRostro);
    this.rostro.dibujar({ exp: resolverExpresion("neutral"), t: 0 });
    if (this.p) { this.scene.remove(this.p.grupo); this.p.dispose(); }
    this.p = crearPersonaje(skin, this.rostro.textura, { delgado, ojosRects: [...cfgRostro.ojos, cfgRostro.boca, ...(cfgRostro.borrar || [])], pelo });
    this.scene.add(this.p.grupo);
    this.cache.clear();
  }
  miniatura(clave, pose) {
    if (this.cache.has(clave)) return this.cache.get(clave);
    const proy = { ajustes: { stop: 0, vida: false, parpadeo: false }, pistas: { poses: [{ pose, dur: 1, trans: 0 }], ojos: [], matices: [], camara: [] } };
    aplicar(this.p, evaluar(proy, 0.5, { sinMatices: true }));
    const y = Math.max(0, (pose.p?.[1] || 0) / 16);
    posicionCamara(this.camara, { az: 28, el: 8, dist: 4.5, ty: 1.05 + y * 0.5 });
    this.renderer.render(this.scene, this.camara);
    const url = this.canvas.toDataURL();
    this.cache.set(clave, url);
    return url;
  }
  // retrato (cabeza) para el catálogo de personajes
  retrato(skin, cara8, cfgRostro, delgado) {
    this.preparar(skin, cara8, cfgRostro, delgado);
    const proy = { ajustes: { stop: 0, vida: false, parpadeo: false }, pistas: { poses: [{ pose: { r: { cabeza: [0, -14, 0], brazoD: [0, 0, -4], brazoI: [0, 0, 4] } }, dur: 1, trans: 0 }], ojos: [], matices: [], camara: [] } };
    aplicar(this.p, evaluar(proy, 0.5, { sinMatices: true }));
    this.rostro.dibujar({ exp: resolverExpresion("feliz"), t: 0 });
    posicionCamara(this.camara, { az: 22, el: 6, dist: 2.9, ty: 1.4 });
    this.renderer.render(this.scene, this.camara);
    this.cache.clear();
    return this.canvas.toDataURL();
  }
}
