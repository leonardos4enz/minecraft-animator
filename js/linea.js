// Línea de tiempo: 4 pistas. Poses, ojos y cámara van en secuencia (arrastrar = reordenar,
// borde derecho = cambiar duración). Los matices son libres (arrastrar = mover en el tiempo).
import { inicios, duracion } from "./motor.js";

export const SECUENCIA = ["poses", "ojos", "camara", "escenas"];
const snap = (v) => Math.round(v * 20) / 20;

export class Linea {
  constructor(app) {
    this.app = app;
    this.pps = 110;                                  // pixeles por segundo
    this.cont = document.getElementById("carriles");
    this.int = document.getElementById("carriles-int");
    this.regla = document.getElementById("regla");
    this.cabezalEl = document.getElementById("cabezal");
    this.carriles = Object.fromEntries([...document.querySelectorAll(".carril")].map(c => [c.dataset.pista, c]));

    const scrub = (e) => {
      if (e.target.closest(".clip")) return;
      const mover = (ev) => {
        const r = this.int.getBoundingClientRect();
        this.app.irA(Math.max(0, (ev.clientX - r.left) / this.pps));
      };
      mover(e);
      if (e.target.closest(".carril")) this.app.seleccionar(null);
      const up = () => { removeEventListener("pointermove", mover); removeEventListener("pointerup", up); };
      addEventListener("pointermove", mover); addEventListener("pointerup", up);
    };
    this.int.addEventListener("pointerdown", scrub);
    this.cont.addEventListener("wheel", (e) => {
      if (!e.ctrlKey) return;
      e.preventDefault(); this.zoom(e.deltaY < 0 ? 1.15 : 1 / 1.15);
    }, { passive: false });
  }

  zoom(f) { this.pps = Math.min(400, Math.max(30, this.pps * f)); this.render(); }

  render() {
    const p = this.app.proy, total = duracion(p);
    const ancho = Math.max(this.cont.clientWidth, (total + 3) * this.pps);
    this.int.style.width = ancho + "px";
    // regla
    const paso = this.pps > 160 ? 0.5 : this.pps > 60 ? 1 : 2;
    let h = "";
    for (let s = 0; s * this.pps < ancho; s += paso) h += `<span style="left:${s * this.pps}px">${s}s</span>`;
    this.regla.innerHTML = h;

    for (const pista of Object.keys(this.carriles)) {
      const c = this.carriles[pista];
      c.innerHTML = "";
      const clips = p.pistas[pista] || [];
      const ini = SECUENCIA.includes(pista) ? inicios(clips) : clips.map(m => m.inicio);
      clips.forEach((clip, i) => {
        const d = document.createElement("div");
        d.className = "clip" + (this.app.sel?.id === clip.id ? " sel" : "") + (pista === "audio" && !clip.archivo ? " generando" : "");
        d.style.left = ini[i] * this.pps + 1 + "px";
        d.style.width = Math.max(8, clip.dur * this.pps - 2) + "px";
        const { texto, img, icono } = this.app.etiqueta(pista, clip);
        if (pista === "poses" && clip.trans > 0) d.innerHTML = `<span class="trans" style="width:${Math.min(clip.trans, clip.dur) * this.pps}px"></span>`;
        d.innerHTML += (img ? `<img src="${img}" alt="">` : icono ? `<svg class="ic"><use href="#i-${icono}"/></svg>` : "") + `<span>${texto}</span><span class="asa"></span>`;
        d.title = `${texto} · ${clip.dur.toFixed(2)} s`;
        d.addEventListener("pointerdown", (e) => this.arrastrar(e, pista, clip, d));
        c.appendChild(d);
      });
    }
    this.cabezal();
  }

  cabezal() {
    const x = this.app.t * this.pps;
    this.cabezalEl.style.left = x + "px";
    // seguir al cabezal mientras se reproduce
    if (this.app.reproduciendo && (x > this.cont.scrollLeft + this.cont.clientWidth - 40 || x < this.cont.scrollLeft)) this.cont.scrollLeft = x - 40;
  }

  arrastrar(e, pista, clip, el) {
    e.stopPropagation();
    e.preventDefault();
    this.app.seleccionar({ pista, id: clip.id });
    el = this.carriles[pista].querySelectorAll(".clip")[this.app.proy.pistas[pista].indexOf(clip)] || el;
    const x0 = e.clientX, durIni = clip.dur, inicioIni = clip.inicio;
    const redimensionar = e.target.classList.contains("asa");
    const secuencia = SECUENCIA.includes(pista);
    let movido = false;
    const mover = (ev) => {
      const dx = ev.clientX - x0;
      if (Math.abs(dx) > 3) movido = true;
      if (!movido) return;
      if (redimensionar) {
        clip.dur = Math.max(0.1, snap(durIni + dx / this.pps));
        if (clip.durOriginal) clip.dur = Math.min(clip.dur, clip.durOriginal);
        if (pista === "poses") clip.trans = Math.min(clip.trans, clip.dur);
        this.render(); this.app.alCambiarTiempo();
      } else if (!secuencia) {
        clip.inicio = Math.max(0, snap(inicioIni + dx / this.pps));
        this.render(); this.app.alCambiarTiempo();
      } else {
        el.classList.add("arrastrando");
        el.style.transform = `translateX(${dx}px)`;
      }
    };
    const soltar = (ev) => {
      removeEventListener("pointermove", mover); removeEventListener("pointerup", soltar);
      if (!movido) return;
      if (secuencia && !redimensionar) {
        const clips = this.app.proy.pistas[pista];
        const r = this.int.getBoundingClientRect();
        const t = (ev.clientX - r.left) / this.pps;
        const desde = clips.indexOf(clip);
        clips.splice(desde, 1);
        const ini = inicios(clips);
        let a = clips.length;
        for (let i = 0; i < clips.length; i++) if (t < ini[i] + clips[i].dur / 2) { a = i; break; }
        clips.splice(a, 0, clip);
      }
      this.app.commit();
    };
    addEventListener("pointermove", mover); addEventListener("pointerup", soltar);
  }
}
