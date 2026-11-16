// Audio: voces (ElevenLabs TTS) y sonidos (ElevenLabs efectos) en la pista "Audio".
// - genera los archivos con el servidor local (la key nunca pasa por el navegador; caché por texto)
// - reproduce sincronizado con la línea de tiempo (WebAudio)
// - calcula la envolvente de cada voz (30 por segundo) → mueve la cabeza al hablar
// - mezcla todo sin tiempo real (OfflineAudioContext) para exportar el video con sonido
export class Motor {
  constructor() { this.ctx = null; this.buffers = new Map(); this.fuentes = []; }

  contexto() {
    if (!this.ctx) this.ctx = new AudioContext({ sampleRate: 48000 });
    if (this.ctx.state === "suspended") this.ctx.resume();
    return this.ctx;
  }

  async buffer(archivo) {
    if (!this.buffers.has(archivo)) {
      this.buffers.set(archivo, (async () => {
        const r = await fetch(archivo);
        if (!r.ok) throw new Error("No encontré " + archivo);
        return await this.contexto().decodeAudioData(await r.arrayBuffer());
      })());
    }
    return this.buffers.get(archivo);
  }

  // pide el archivo al servidor si falta, y completa duración y envolvente del clip
  async preparar(clip) {
    if (!clip.archivo) {
      const ruta = clip.tipo === "voz" ? "/api/voz" : clip.tipo === "musica" ? "/api/musica" : "/api/sfx";
      const cuerpo = clip.tipo === "voz" ? { texto: clip.texto, voz: clip.voz, modelo: clip.modelo } : { texto: clip.texto, dur: clip.durSfx };
      const r = await fetch(ruta, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "ElevenLabs no respondió");
      clip.archivo = j.archivo;
      if (j.alineacion) clip.alineacion = j.alineacion;
    }
    if (clip.tipo === "voz" && clip.alineacion && !clip.visemas) {
      try { clip.visemas = visemas(await (await fetch(clip.alineacion)).json()); } catch { /* sin lip-sync: queda la envolvente */ }
    }
    const b = await this.buffer(clip.archivo);
    clip.durOriginal = +b.duration.toFixed(3);
    const util = b.duration - (clip.desde || 0);          // "desde": empieza más adentro del archivo
    if (!clip.dur || clip.dur === 1 || clip.dur > util) clip.dur = +util.toFixed(3);
    if (clip.tipo === "voz" && !clip.env) clip.env = envolvente(b);
    return clip;
  }

  detener() {
    for (const f of this.fuentes) { try { f.stop(); } catch { /* ya terminó */ } }
    this.fuentes = [];
  }

  // programa todos los clips desde el tiempo t de la animación
  async reproducir(clips, t) {
    this.detener();
    const ctx = this.contexto(), ahora = ctx.currentTime + 0.03;
    for (const c of clips || []) {
      if (!c.archivo || t >= c.inicio + c.dur) continue;
      let b; try { b = await this.buffer(c.archivo); } catch { continue; }
      const src = ctx.createBufferSource(), g = ctx.createGain();
      src.buffer = b; g.gain.value = c.vol ?? 1;
      src.connect(g).connect(ctx.destination);
      const desfase = Math.max(0, t - c.inicio), ini = ahora + Math.max(0, c.inicio - t), largo = Math.max(0.01, c.dur - desfase);
      if (c.dur < b.duration - (c.desde || 0) - 0.05 || c.salida) {   // recortado: se desvanece al final en vez de cortarse
        const sal = c.salida || 0.25;
        g.gain.setValueAtTime(c.vol ?? 1, ini + Math.max(0, largo - sal)); g.gain.linearRampToValueAtTime(0, ini + largo);
      }
      if (c.entrada && desfase < c.entrada) { g.gain.setValueAtTime((c.vol ?? 1) * desfase / c.entrada, ini); g.gain.linearRampToValueAtTime(c.vol ?? 1, ini + c.entrada - desfase); }
      src.start(ini, (c.desde || 0) + desfase, largo);
      this.fuentes.push(src);
    }
  }

  // mezcla final (estéreo 48 kHz) de [0, dur]
  async mezclar(clips, dur) {
    const sr = 48000, off = new OfflineAudioContext(2, Math.ceil(dur * sr), sr);
    for (const c of clips || []) {
      if (!c.archivo) continue;
      const b = await this.buffer(c.archivo);
      const src = off.createBufferSource(), g = off.createGain();
      src.buffer = b; g.gain.value = c.vol ?? 1;
      src.connect(g).connect(off.destination);
      if (c.dur < b.duration - (c.desde || 0) - 0.05 || c.salida) { const sal = c.salida || 0.25; g.gain.setValueAtTime(c.vol ?? 1, c.inicio + Math.max(0, c.dur - sal)); g.gain.linearRampToValueAtTime(0, c.inicio + c.dur); }
      if (c.entrada) { g.gain.setValueAtTime(0, c.inicio); g.gain.linearRampToValueAtTime(c.vol ?? 1, c.inicio + c.entrada); }
      src.start(c.inicio, c.desde || 0, c.dur);
    }
    return off.startRendering();
  }
}

// letras → formas de boca (español). Lo que va entre [corchetes] son emociones de v3: no se pronuncia.
const MAPA = { a: "A", á: "A", e: "E", é: "E", i: "I", í: "I", y: "I", o: "O", ó: "O", u: "U", ú: "U", ü: "U",
  m: "M", b: "M", p: "M", f: "F", v: "F" };
export function visemas(al) {
  const ch = al.characters || [], t0 = al.character_start_times_seconds || [], t1 = al.character_end_times_seconds || [];
  const out = []; let dentro = false;
  for (let i = 0; i < ch.length; i++) {
    const c = ch[i].toLowerCase();
    if (c === "[") { dentro = true; continue; }
    if (c === "]") { dentro = false; continue; }
    if (dentro) continue;
    const v = MAPA[c] || (/[a-zñ]/.test(c) ? "C" : "X");
    const ult = out[out.length - 1];
    if (ult && ult[2] === v && Math.abs(ult[1] - t0[i]) < 0.02) ult[1] = t1[i];
    else out.push([+t0[i].toFixed(3), +t1[i].toFixed(3), v]);
  }
  return out;
}

// envolvente RMS a 30 Hz normalizada (0..1), con ataque rápido y caída suave
export function envolvente(b) {
  const d = b.getChannelData(0), paso = Math.round(b.sampleRate / 30), n = Math.ceil(d.length / paso);
  const env = new Array(n).fill(0);
  let max = 1e-6;
  for (let i = 0; i < n; i++) {
    let s = 0; const ini = i * paso, fin = Math.min(d.length, ini + paso);
    for (let k = ini; k < fin; k++) s += d[k] * d[k];
    env[i] = Math.sqrt(s / Math.max(1, fin - ini)); max = Math.max(max, env[i]);
  }
  let prev = 0;
  return env.map(v => { const x = Math.min(1, v / max); prev = x > prev ? x : prev * 0.82 + x * 0.18; return +prev.toFixed(2); });
}
