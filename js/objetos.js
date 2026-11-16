// Objetos de Minecraft para tener en la mano (LTezla y los mobs): espadas, comida, herramientas, bloques…
// El catálogo sale de texturas_mc/biblioteca/indice.json (herramientas/biblioteca.py: texturas de Bare Bones, o de tu .jar
// si Bare Bones no las trae). Como en el juego:
//   - objeto plano (forma "plano"): un cubito por pixel opaco de su textura de 16×16 (ítem "extruido"), igual que el cuerno de
//     cabra del tráiler;
//   - bloque (forma "bloque"): un cubo con la textura del costado y la de arriba.
// crearObjeto(id) devuelve una promesa con un THREE.Group centrado en el puño (16 unidades = un ítem de 16 px; quien lo
// usa lo escala). Los ids son los de Java ("diamond_sword", "apple", "oak_planks"…); también se aceptan nombres en español.
import * as THREE from "three";

let indice = null;
const porId = {}, alias = {};
const sinAcentos = (t) => String(t).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
export function cargarObjetos() {
  indice ??= fetch("texturas_mc/biblioteca/indice.json").then(r => r.ok ? r.json() : null).catch(() => null).then(ind => {
    for (const it of ind?.items || []) { porId[it.id] = it; alias[sinAcentos(it.nombre)] ??= it.id; alias[sinAcentos(it.nombre_en || "")] ??= it.id; }
    return ind?.items || [];
  });
  return indice;
}
export const objetoInfo = (id) => porId[id] || porId[alias[sinAcentos(id)]] || null;
export const listaObjetos = () => Object.values(porId);

const imagen = (src) => new Promise((ok, mal) => { const i = new Image(); i.onload = () => ok(i); i.onerror = mal; i.src = src; });
function pixeles(img, n = 16) {
  const c = document.createElement("canvas"); c.width = c.height = n;
  const x = c.getContext("2d"); x.imageSmoothingEnabled = false; x.drawImage(img, 0, 0, img.width, Math.min(img.height, img.width), 0, 0, n, n);
  return x.getImageData(0, 0, n, n).data;
}
function texturaPixel(img) {
  const c = document.createElement("canvas"); c.width = c.height = 16;
  const x = c.getContext("2d"); x.imageSmoothingEnabled = false; x.drawImage(img, 0, 0, img.width, Math.min(img.height, img.width), 0, 0, 16, 16);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = t.minFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace; t.generateMipmaps = false;
  return t;
}

// ítem plano: un cubito por pixel opaco (las dos capas se apilan: p. ej. la poción y su líquido)
function voxel(imgs) {
  const px = [];
  const usados = new Set();
  for (const img of imgs) {
    const d = pixeles(img);
    for (let v = 0; v < 16; v++) for (let u = 0; u < 16; u++) {
      const k = (v * 16 + u) * 4;
      if (d[k + 3] > 100 && !usados.has(u + v * 16)) { usados.add(u + v * 16); px.push([u, v, d[k], d[k + 1], d[k + 2]]); }
    }
  }
  const m = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.6 }), Math.max(1, px.length));
  const mat4 = new THREE.Matrix4(), col = new THREE.Color();
  px.forEach(([u, v, r, g, b], i) => { mat4.makeTranslation(u - 7.5, 7.5 - v, 0); m.setMatrixAt(i, mat4); m.setColorAt(i, col.setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace)); });
  m.count = px.length;
  m.castShadow = true;
  return m;
}
// bloque en la mano: cubo de 16 con la textura del costado (y la de arriba/abajo)
function cubo(lado, arriba) {
  const ml = new THREE.MeshStandardMaterial({ map: texturaPixel(lado), roughness: 0.9, alphaTest: 0.1 });
  const ma = arriba ? new THREE.MeshStandardMaterial({ map: texturaPixel(arriba), roughness: 0.9, alphaTest: 0.1 }) : ml;
  const m = new THREE.Mesh(new THREE.BoxGeometry(16, 16, 16), [ml, ml, ma, ma, ml, ml]);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

const cache = {};
// id → Promise<THREE.Group | null>. Cada llamada devuelve un clon (se puede poner en varias manos a la vez).
export async function crearObjeto(id) {
  await cargarObjetos();
  const info = objetoInfo(id);
  cache[id] ??= (async () => {
    // compatibilidad: texturas_mc/item/<id>.png (el cuerno de cabra del tráiler, copiado del .jar) manda si existe
    const viejo = !info || id === "goat_horn" ? await imagen(`texturas_mc/item/${id}.png`).catch(() => null) : null;
    if (viejo) return Object.assign(new THREE.Group().add(voxel([viejo])), { userData: { forma: "plano", mano: "plano" } });
    if (!info) return null;
    if (info.forma === "bloque") {
      const [l, a] = await Promise.all([imagen(info.tex), info.tex_arriba ? imagen(info.tex_arriba).catch(() => null) : null]);
      return Object.assign(new THREE.Group().add(cubo(l, a)), { userData: { forma: "bloque", mano: "bloque" } });
    }
    const imgs = [await imagen(info.tex)];
    if (info.tex2) imgs.push(await imagen(info.tex2).catch(() => null));
    return Object.assign(new THREE.Group().add(voxel(imgs.filter(Boolean))), { userData: { forma: "plano", mano: info.mano || "plano" } });
  })().catch(() => null);
  const g = await cache[id];
  if (!g) return null;
  const c = g.clone(); c.userData = { ...g.userData, id };
  return c;
}
// versión síncrona para el bucle de render: el objeto si ya está listo (y lo empieza a cargar si no)
const listos = {};
export function objetoListo(id) {
  if (!id) return null;
  if (!(id in listos)) { listos[id] = null; crearObjeto(id).then(g => { listos[id] = g; }); }
  return listos[id];
}
