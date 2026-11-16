// Estilo "Suave HD": los ojos se dibujan con trazos vectoriales a 32 px por pixel de skin
// (como en las animaciones de Blender): iris redondo con degradado, pupila, brillos, párpados
// curvos con pestaña, ^ ^ y > < con trazo redondeado. Nada de "mini pixeles".
// Todas las funciones se llaman con `this` = la instancia de Rostro.

const mezclar = (a, b, k) => {
  const p = (h) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const A = p(a), B = p(b);
  return "#" + A.map((v, i) => Math.round(v + (B[i] - v) * k).toString(16).padStart(2, "0")).join("");
};

function trazo(ctx, color, ancho) {
  ctx.strokeStyle = color; ctx.lineWidth = ancho; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.stroke();
}

export function ojo(o, p, interior, { mx, my, parpado }) {
  const { ctx, S, col: c, cfg } = this;
  const X = o.x * S, Y = o.y * S, W = o.w * S, H = o.h * S;
  const g = S * 0.17;                                   // grosor de línea
  let forma = p.forma;
  const cierre = Math.min(1, p.abre + parpado * (1 - p.abre));
  // ojo cerrado (parpadeo) con cualquier forma abierta → línea de ojo cerrado
  if (!["arco", "apretado", "linea"].includes(forma) && cierre >= 0.96) forma = "linea";
  const tapar = () => { ctx.fillStyle = c.piel; ctx.fillRect(X, Y, W, H); };

  if (cfg.estilo === "cuadrado" && forma === "normal") return ojoCuadrado.call(this, o, p, interior, mx, my, cierre);
  ctx.save();
  if (forma === "linea") {
    tapar();
    const y = Y + H * 0.62;
    ctx.beginPath(); ctx.moveTo(X + W * 0.06, y - H * 0.04); ctx.quadraticCurveTo(X + W / 2, y + H * 0.22, X + W * 0.94, y - H * 0.04);
    trazo(ctx, c.linea, g * 1.15);
  } else if (forma === "arco") {
    tapar();
    ctx.beginPath(); ctx.moveTo(X + W * 0.1, Y + H * 0.78); ctx.quadraticCurveTo(X + W / 2, Y - H * 0.05, X + W * 0.9, Y + H * 0.78);
    trazo(ctx, c.linea, g * 1.25);
  } else if (forma === "apretado") {
    tapar();
    const ex = interior > 0 ? X + W * 0.85 : X + W * 0.15, fx = interior > 0 ? X + W * 0.15 : X + W * 0.85;
    ctx.beginPath(); ctx.moveTo(fx, Y + H * 0.2); ctx.lineTo(ex, Y + H * 0.52); ctx.lineTo(fx, Y + H * 0.84);
    trazo(ctx, c.linea, g * 1.2);
  } else {
    ctx.beginPath(); ctx.rect(X, Y, W, H); ctx.clip();
    // blanco del ojo con sombra arriba (lo tapa el párpado)
    ctx.fillStyle = c.esclera; ctx.fillRect(X, Y, W, H);
    const sombra = ctx.createLinearGradient(0, Y, 0, Y + H * 0.55);
    sombra.addColorStop(0, "rgba(40,20,30,.28)"); sombra.addColorStop(1, "rgba(40,20,30,0)");
    ctx.fillStyle = sombra; ctx.fillRect(X, Y, W, H);

    const esc = Math.max(0.35, p.iris);
    const rx = Math.min(W * 0.36, H * 0.5) * esc * (o.w >= 2 ? 1 : 1.25), ry = Math.max(rx * 1.12, H * 0.42 * esc);
    const cx = X + W / 2 + mx * Math.max(0, W / 2 - rx * 0.9);
    const cy = Y + H / 2 + H * 0.04 - my * Math.max(0, H / 2 - ry * 0.55);
    if (forma === "corazon") corazon(ctx, cx, cy + ry * 0.05, Math.min(W, H) * 0.48 * Math.max(0.8, esc));
    else if (forma === "estrella") estrella(ctx, cx, cy, Math.min(W, H) * 0.5, c.iris);
    else {
      // iris con degradado, aro oscuro, pupila y brillos
      const gr = ctx.createRadialGradient(cx, cy + ry * 0.35, ry * 0.1, cx, cy, ry);
      gr.addColorStop(0, mezclar(c.iris, "#ffffff", 0.35));
      gr.addColorStop(0.55, c.iris);
      gr.addColorStop(1, mezclar(c.iris, "#000000", 0.45));
      ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.fillStyle = gr; ctx.fill();
      ctx.lineWidth = S * 0.07; ctx.strokeStyle = mezclar(c.iris, "#000000", 0.6); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(cx, cy + ry * 0.05, rx * 0.46, ry * 0.5, 0, 0, Math.PI * 2);
      ctx.fillStyle = c.pupila; ctx.fill();
      if (cfg.brillo !== false) {
        const b = rx * (p.brillo ? 0.42 : 0.32);
        const bx = cx - interior * rx * 0.32, by = cy - ry * 0.38;
        ctx.fillStyle = "rgba(255,255,255,.95)";
        ctx.beginPath(); ctx.ellipse(bx, by, b, b * 1.1, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + interior * rx * 0.38, cy + ry * 0.42, b * 0.42, 0, Math.PI * 2); ctx.fill();
        if (p.brillo) { ctx.beginPath(); ctx.arc(cx + interior * rx * 0.1, cy - ry * 0.02, b * 0.28, 0, Math.PI * 2); ctx.fill(); }
      }
    }
    // párpado de arriba: curva con inclinación (enojado / triste)
    const incI = p.incl > 0 ? p.incl * 0.6 : 0, incE = p.incl < 0 ? -p.incl * 0.6 : 0;
    const cInt = Math.min(1.05, cierre + incI), cExt = Math.min(1.05, cierre + incE);
    const xInt = interior > 0 ? X + W : X, xExt = interior > 0 ? X : X + W;
    const yInt = Math.min(Y + H * cInt, Y + H - g * 0.6), yExt = Math.min(Y + H * cExt, Y + H - g * 0.6), yMid = Y + H * (cierre + (incI + incE) * 0.35) + H * 0.1 * cierre;
    if (cInt > 0.02 || cExt > 0.02) {
      ctx.beginPath(); ctx.moveTo(xExt, Y - 2); ctx.lineTo(xInt, Y - 2); ctx.lineTo(xInt, yInt);
      ctx.quadraticCurveTo(X + W / 2, yMid, xExt, yExt); ctx.closePath();
      ctx.fillStyle = c.parpado; ctx.fill();
      ctx.beginPath(); ctx.moveTo(xInt, yInt); ctx.quadraticCurveTo(X + W / 2, yMid, xExt, yExt);
      trazo(ctx, c.linea, g * 1.05);
    } else if (cfg.delineado !== false) {
      ctx.beginPath(); ctx.moveTo(X, Y + g * 0.35); ctx.lineTo(X + W, Y + g * 0.35);
      trazo(ctx, c.linea, g * 0.9);
    }
    // párpado de abajo (sonrisa de ojos)
    if (p.inf > 0.02) {
      const yb = Y + H * (1 - p.inf), yc = Y + H * (1 - p.inf * 1.6);
      ctx.beginPath(); ctx.moveTo(X - 2, Y + H + 2); ctx.lineTo(X - 2, yb); ctx.quadraticCurveTo(X + W / 2, yc, X + W + 2, yb); ctx.lineTo(X + W + 2, Y + H + 2); ctx.closePath();
      ctx.fillStyle = c.parpado; ctx.fill();
      ctx.beginPath(); ctx.moveTo(X, yb); ctx.quadraticCurveTo(X + W / 2, yc, X + W, yb);
      trazo(ctx, mezclar(c.parpado, "#000000", 0.25), g * 0.5);
    }
  }
  ctx.restore();
}

// Ojo estilo animación de Minecraft (como el video de Benly): esclera con el borde de arriba arqueado,
// iris CUADRADO con aro de color, pupila negra cuadrada, brillo blanco cuadrado, delineado grueso con pestañas.
function ojoCuadrado(o, p, interior, mx, my, cierre) {
  const { ctx, S, col: c } = this;
  const X = o.x * S, Y = o.y * S, W = o.w * S, H = o.h * S;
  const g = S * 0.17;
  const arco = H * (o.h >= 2 ? 0.22 : 0.3) * (this.cfg.pestanas ? 1 : 0.55);   // masculino: ojo más recto
  const cima = X + W * (interior > 0 ? 0.42 : 0.58);
  // tapar primero todo el rectángulo con piel: fuera del arco no deben asomarse los ojos viejos de la skin
  ctx.fillStyle = c.piel; ctx.fillRect(X, Y, W, H);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(X, Y + arco);
  ctx.quadraticCurveTo(cima, Y - arco * 0.85, X + W, Y + arco);
  ctx.lineTo(X + W, Y + H); ctx.lineTo(X, Y + H); ctx.closePath();
  ctx.clip();
  ctx.fillStyle = c.esclera; ctx.fillRect(X, Y - arco, W, H + arco);
  const sombra = ctx.createLinearGradient(0, Y, 0, Y + H * 0.5);
  sombra.addColorStop(0, "rgba(50,60,100,.32)"); sombra.addColorStop(1, "rgba(50,60,100,0)");
  ctx.fillStyle = sombra; ctx.fillRect(X, Y - arco, W, H + arco);
  // iris cuadrado
  const L = Math.min(W * 0.6, H * 0.98) * Math.max(0.45, p.iris);
  const cx = X + W / 2 + mx * Math.max(0, W / 2 - L * 0.42);
  const cy = Y + H * 0.56 - my * Math.max(0, H * 0.32);
  const cuadro = (cxx, cyy, lado, color, r = 0.08) => { ctx.beginPath(); ctx.roundRect(cxx - lado / 2, cyy - lado / 2, lado, lado, lado * r); ctx.fillStyle = color; ctx.fill(); };
  cuadro(cx, cy, L * 1.08, mezclar(c.iris, "#000000", 0.55));
  const gr = ctx.createLinearGradient(0, cy - L / 2, 0, cy + L / 2);
  gr.addColorStop(0, mezclar(c.iris, "#000000", 0.15)); gr.addColorStop(1, mezclar(c.iris, "#ffffff", 0.3));
  ctx.beginPath(); ctx.roundRect(cx - L / 2, cy - L / 2, L, L, L * 0.08); ctx.fillStyle = gr; ctx.fill();
  cuadro(cx, cy + L * 0.02, L * 0.6, "#0b0b10", 0.06);
  if (this.cfg.brillo !== false) {
    const b = L * (p.brillo ? 0.3 : 0.24);
    cuadro(cx + L * 0.13, cy - L * 0.17, b, "rgba(255,255,255,.96)", 0.12);
    cuadro(cx - L * 0.2, cy + L * 0.22, b * 0.38, "rgba(255,255,255,.8)", 0.2);
  }
  // párpados (cierre e inclinación)
  const incI = p.incl > 0 ? p.incl * 0.6 : 0, incE = p.incl < 0 ? -p.incl * 0.6 : 0;
  const cInt = Math.min(1.05, cierre + incI), cExt = Math.min(1.05, cierre + incE);
  const xInt = interior > 0 ? X + W : X, xExt = interior > 0 ? X : X + W;
  const yInt = Y + arco * (1 - cInt) + (H - g) * cInt, yExt = Y + arco * (1 - cExt) + (H - g) * cExt;
  const hayParpado = cInt > 0.02 || cExt > 0.02;
  const ctrl = hayParpado ? Math.min(yInt, yExt) - arco * (1 - cierre) * 0.9 : Y - arco * 0.85;
  if (hayParpado) {
    ctx.beginPath(); ctx.moveTo(xExt, Y - arco * 2); ctx.lineTo(xInt, Y - arco * 2); ctx.lineTo(xInt, yInt);
    ctx.quadraticCurveTo(cima, ctrl, xExt, yExt); ctx.closePath();
    ctx.fillStyle = c.parpado; ctx.fill();
  }
  if (p.inf > 0.02) {
    const yb = Y + H * (1 - p.inf), yc = Y + H * (1 - p.inf * 1.7);
    ctx.beginPath(); ctx.moveTo(X - 2, Y + H + 2); ctx.lineTo(X - 2, yb); ctx.quadraticCurveTo(X + W / 2, yc, X + W + 2, yb); ctx.lineTo(X + W + 2, Y + H + 2); ctx.closePath();
    ctx.fillStyle = c.parpado; ctx.fill();
  }
  ctx.restore();
  // delineado grueso arriba (sigue al párpado) + ala y pestañas del lado de afuera
  const yI = (hayParpado ? yInt : Y + arco) + g * 0.35, yE = (hayParpado ? yExt : Y + arco) + g * 0.35;   // dentro del borde, sin hueco
  ctx.beginPath(); ctx.moveTo(xInt, yI); ctx.quadraticCurveTo(cima, ctrl + g * 0.35, xExt, yE);
  trazo(ctx, c.linea, this.cfg.pestanas ? g * 1.45 : g * 1.05);
  if (this.cfg.pestanas) {                                            // pestañas y "ala" (look femenino, opcional)
    const sx = interior > 0 ? -1 : 1;
    ctx.beginPath(); ctx.moveTo(xExt, yE); ctx.lineTo(xExt + sx * W * 0.12, yE - H * 0.12); trazo(ctx, c.linea, g * 1.1);
    for (let k = 0; k < 3; k++) {
      const t = 0.05 + k * 0.13, px = xExt - sx * W * t, py = yE - (yE - ctrl) * (t * 1.6) - g * 0.3;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + sx * W * 0.07, py - H * 0.2); trazo(ctx, c.linea, g * 0.55);
    }
  }
  if (p.inf <= 0.02 && cierre < 0.5) {
    ctx.beginPath(); ctx.moveTo(X + W * 0.15, Y + H - g * 0.2); ctx.lineTo(X + W * 0.85, Y + H - g * 0.2);
    trazo(ctx, mezclar(c.parpado, "#000000", 0.35), g * 0.35);
  }
}

function corazon(ctx, cx, cy, r) {
  ctx.beginPath();
  ctx.moveTo(cx, cy + r * 0.85);
  ctx.bezierCurveTo(cx - r * 1.25, cy + r * 0.05, cx - r * 0.75, cy - r * 0.95, cx, cy - r * 0.35);
  ctx.bezierCurveTo(cx + r * 0.75, cy - r * 0.95, cx + r * 1.25, cy + r * 0.05, cx, cy + r * 0.85);
  ctx.fillStyle = "#ff3b5c"; ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,.8)";
  ctx.beginPath(); ctx.ellipse(cx - r * 0.42, cy - r * 0.3, r * 0.17, r * 0.12, -0.6, 0, Math.PI * 2); ctx.fill();
}

// estrella roja con volumen (Leo: "las estrellas rojas y con volumen; así se ven simples, sin chiste"): degradado de luz
// arriba a la izquierda, bisel interior más claro, contorno oscuro, brillo blanco y un destello chico
function estrella(ctx, cx, cy, r, iris) {
  const punta = (rad, dx = 0, dy = 0, interior = 0.44) => {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? rad * interior : rad;
      ctx.lineTo(cx + dx + Math.cos(a) * rr, cy + dy + Math.sin(a) * rr);
    }
    ctx.closePath();
  };
  ctx.save();
  punta(r * 1.04, r * 0.05, r * 0.07);                               // sombra suave hacia abajo-derecha
  ctx.fillStyle = "rgba(60, 0, 8, 0.35)"; ctx.fill();
  punta(r);
  const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.05, cx, cy, r * 1.1);
  g.addColorStop(0, "#ff9a9a"); g.addColorStop(0.45, "#e8213a"); g.addColorStop(1, "#8e0c1c");
  ctx.fillStyle = g; ctx.fill();
  ctx.lineJoin = "round"; ctx.lineWidth = r * 0.11; ctx.strokeStyle = "#4e0610"; ctx.stroke();
  punta(r * 0.55, -r * 0.06, -r * 0.08, 0.5);                        // bisel interior (la cara que recibe luz)
  const g2 = ctx.createLinearGradient(cx - r * 0.5, cy - r * 0.5, cx + r * 0.4, cy + r * 0.4);
  g2.addColorStop(0, "rgba(255, 200, 200, 0.85)"); g2.addColorStop(1, "rgba(255, 90, 100, 0.0)");
  ctx.fillStyle = g2; ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx - r * 0.22, cy - r * 0.3, r * 0.17, r * 0.1, -0.6, 0, Math.PI * 2);   // brillo
  ctx.fillStyle = "rgba(255, 255, 255, 0.95)"; ctx.fill();
  ctx.beginPath(); ctx.arc(cx + r * 0.25, cy + r * 0.12, r * 0.05, 0, Math.PI * 2);                    // destello chico
  ctx.fillStyle = "rgba(255, 235, 235, 0.8)"; ctx.fill();
  ctx.restore();
}

export function ceja(o, p, interior) {
  // ceja gruesa y recta (bloque con un poco de volumen), se inclina con la emoción
  const { ctx, S, col: c } = this;
  const X = o.x * S, W = o.w * S;
  const y = o.y * S - S * 0.62 - p.cejaY * S * 0.4;
  const g = S * 0.42;
  const dInt = p.cejaAng * S * 0.32, dExt = -p.cejaAng * S * 0.12;
  const xInt = interior > 0 ? X + W * 1.0 : X, xExt = interior > 0 ? X + W * 0.05 : X + W * 0.95;
  ctx.beginPath();
  ctx.moveTo(xExt, y + dExt - g / 2); ctx.lineTo(xInt, y + dInt - g / 2); ctx.lineTo(xInt, y + dInt + g / 2); ctx.lineTo(xExt, y + dExt + g / 2 - g * 0.15);
  ctx.closePath(); ctx.fillStyle = c.ceja; ctx.fill();
  ctx.beginPath(); ctx.moveTo(xExt, y + dExt - g / 2); ctx.lineTo(xInt, y + dInt - g / 2);
  ctx.strokeStyle = mezclar(c.ceja, "#ffffff", 0.18); ctx.lineWidth = S * 0.06; ctx.stroke();
}

export function rubor(k) {
  const { ctx, S, col: c, cfg } = this;
  for (const o of cfg.ojos) {
    const cx = (o.x + o.w / 2) * S, cy = (o.y + o.h + 0.75) * S, rx = o.w * S * 0.55, ry = S * 0.4;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rx);
    g.addColorStop(0, c.rubor + "cc"); g.addColorStop(1, c.rubor + "00");
    ctx.save(); ctx.globalAlpha = 0.75 * k; ctx.translate(cx, cy); ctx.scale(1, ry / rx); ctx.translate(-cx, -cy);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, rx, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
}

function gota(ctx, x, y, r, color, alfa) {
  ctx.save(); ctx.globalAlpha = alfa;
  ctx.beginPath(); ctx.moveTo(x, y - r * 1.6);
  ctx.bezierCurveTo(x + r, y - r * 0.3, x + r, y + r, x, y + r);
  ctx.bezierCurveTo(x - r, y + r, x - r, y - r * 0.3, x, y - r * 1.6);
  ctx.fillStyle = color; ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,.7)"; ctx.beginPath(); ctx.arc(x - r * 0.3, y, r * 0.25, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

export function lagrimas(t) {
  const { ctx, S, cfg } = this;
  for (const o of cfg.ojos) {
    const x = (o.x + o.w / 2) * S, y0 = (o.y + o.h) * S;
    ctx.save(); ctx.globalAlpha = 0.85;
    ctx.beginPath(); ctx.moveTo(x - S * 0.15, y0); ctx.lineTo(x + S * 0.15, y0); ctx.lineTo(x + S * 0.1, 8 * S); ctx.lineTo(x - S * 0.1, 8 * S); ctx.closePath();
    ctx.fillStyle = "rgba(120,210,255,.5)"; ctx.fill(); ctx.restore();
    for (let k = 0; k < 2; k++) {
      const f = (t * 1.2 + k * 0.5) % 1;
      gota(ctx, x, y0 + f * (8 * S - y0), S * 0.2, "#6fd3ff", 1 - f * 0.5);
    }
  }
}

export function sudor(t) {
  const { ctx, S } = this;
  const f = (t * 0.7) % 1;
  gota(ctx, 6.9 * S, (1.4 + f * 2.2) * S, S * 0.3, "#8fdcff", 1 - f * 0.5);
}

// formas de boca por sonido (visema): [ancho, alto] relativos
const VISEMAS = { A: [0.62, 1], E: [0.74, 0.55], I: [0.76, 0.34], O: [0.46, 0.8], U: [0.34, 0.55], C: [0.52, 0.4], F: [0.6, 0.24], M: [0.4, 0], X: [0.4, 0] };

export function boca(b, forma, abierta, visema) {
  const { ctx, S, col: c } = this;
  if (visema) return bocaVisema.call(this, b, VISEMAS[visema] ? visema : "M", abierta, forma);
  const X = b.x * S, Y = b.y * S, W = b.w * S, H = Math.max(b.h, 1) * S;
  const cx = X + W / 2, cy = Y + H / 2, g = S * 0.16;
  ctx.save();
  ctx.fillStyle = c.piel; ctx.fillRect(X, Y, W, b.h * S);
  const abiertaForma = (w, h, sonrisa) => {
    ctx.beginPath();
    ctx.moveTo(cx - w / 2, cy - h * 0.3);
    ctx.quadraticCurveTo(cx, cy - h * (sonrisa ? 0.2 : 0.55), cx + w / 2, cy - h * 0.3);
    ctx.quadraticCurveTo(cx + w * 0.45, cy + h * 0.75, cx, cy + h * 0.7);
    ctx.quadraticCurveTo(cx - w * 0.45, cy + h * 0.75, cx - w / 2, cy - h * 0.3);
    ctx.closePath();
    ctx.fillStyle = c.boca; ctx.fill();
    ctx.save(); ctx.clip();
    ctx.fillStyle = "#d9686a"; ctx.beginPath(); ctx.ellipse(cx, cy + h * 0.65, w * 0.3, h * 0.35, 0, 0, Math.PI * 2); ctx.fill();
    if (sonrisa) { ctx.fillStyle = "#fbf3ec"; ctx.fillRect(cx - w / 2, cy - h * 0.5, w, h * 0.28); }
    ctx.restore();
    trazo(ctx, c.linea, g * 0.7);
  };
  if (abierta > 0.12 && forma !== "o") {
    abiertaForma(W * (forma.startsWith("sonrisa") ? 0.8 : 0.6), H * Math.min(1, 0.35 + abierta * 0.6), forma.startsWith("sonrisa"));
  } else switch (forma) {
    case "linea": ctx.beginPath(); ctx.moveTo(cx - W * 0.17, cy); ctx.lineTo(cx + W * 0.17, cy); trazo(ctx, c.linea, g * 0.8); break;
    case "sonrisa": ctx.beginPath(); ctx.moveTo(cx - W * 0.24, cy - H * 0.12); ctx.quadraticCurveTo(cx, cy + H * 0.28, cx + W * 0.24, cy - H * 0.12); trazo(ctx, c.linea, g * 0.85); break;
    case "triste": ctx.beginPath(); ctx.moveTo(cx - W * 0.32, cy + H * 0.2); ctx.quadraticCurveTo(cx, cy - H * 0.35, cx + W * 0.32, cy + H * 0.2); trazo(ctx, c.linea, g); break;
    case "ondulada": ctx.beginPath(); ctx.moveTo(cx - W * 0.36, cy); for (let i = 1; i <= 4; i++) ctx.quadraticCurveTo(cx - W * 0.36 + W * 0.18 * (i - 0.5), cy + (i % 2 ? -1 : 1) * H * 0.22, cx - W * 0.36 + W * 0.18 * i, cy); trazo(ctx, c.linea, g * 0.9); break;
    case "gato": ctx.beginPath(); ctx.moveTo(cx - W * 0.34, cy - H * 0.1); ctx.quadraticCurveTo(cx - W * 0.17, cy + H * 0.35, cx, cy - H * 0.05); ctx.quadraticCurveTo(cx + W * 0.17, cy + H * 0.35, cx + W * 0.34, cy - H * 0.1); trazo(ctx, c.linea, g * 0.9); break;
    case "sonrisa_abierta": abiertaForma(W * 0.52, H * 0.55, true); break;
    case "o": { const r = Math.min(W, H) * (0.22 + abierta * 0.15); ctx.beginPath(); ctx.ellipse(cx, cy, r * 0.85, r, 0, 0, Math.PI * 2); ctx.fillStyle = c.boca; ctx.fill(); trazo(ctx, c.linea, g * 0.7); break; }
    case "apretada": {
      const w = W * 0.6, h = H * 0.4;
      ctx.beginPath(); ctx.roundRect(cx - w / 2, cy - h / 2, w, h, h * 0.3); ctx.fillStyle = "#fbf3ec"; ctx.fill(); trazo(ctx, c.linea, g * 0.8);
      ctx.beginPath(); ctx.moveTo(cx - w / 2, cy); ctx.lineTo(cx + w / 2, cy); trazo(ctx, c.linea, g * 0.4);
      break;
    }
  }
  ctx.restore();
}

function bocaVisema(b, v, abierta, forma) {
  const { ctx, S, col: c } = this;
  const X = b.x * S, Y = b.y * S, W = b.w * S, H = Math.max(b.h, 1) * S;
  const cx = X + W / 2, cy = Y + H * 0.45;
  ctx.save();
  ctx.fillStyle = c.piel; ctx.fillRect(X, Y, W, b.h * S);
  const [pw, ph] = VISEMAS[v];
  const sonrie = forma && forma.startsWith("sonrisa") ? 1 : 0;
  const w = W * 0.62 * pw * (1 + sonrie * 0.1), h = S * 0.62 * ph * (0.4 + 0.6 * Math.min(1, abierta * 1.3));
  if (v === "M" || v === "X" || h < S * 0.1) {
    const wl = W * 0.34;
    ctx.beginPath(); ctx.moveTo(cx - wl / 2, cy); ctx.lineTo(cx + wl / 2, cy);
    trazo(ctx, c.linea, S * 0.13); ctx.restore(); return;
  }
  ctx.beginPath();
  if (v === "O" || v === "U") ctx.ellipse(cx, cy + h * 0.1, w / 2, h / 2, 0, 0, Math.PI * 2);
  else {
    const sube = sonrie ? -h * 0.18 : 0;
    ctx.moveTo(cx - w / 2, cy - h * 0.15 + sube);
    ctx.quadraticCurveTo(cx, cy - h * 0.55, cx + w / 2, cy - h * 0.15 + sube);
    ctx.quadraticCurveTo(cx + w * 0.42, cy + h * 0.62, cx, cy + h * 0.6);
    ctx.quadraticCurveTo(cx - w * 0.42, cy + h * 0.62, cx - w / 2, cy - h * 0.15 + sube);
    ctx.closePath();
  }
  ctx.fillStyle = "#3a1416"; ctx.fill();
  ctx.save(); ctx.clip();
  if ("AEOC".includes(v)) { ctx.fillStyle = "#c95a62"; ctx.beginPath(); ctx.ellipse(cx, cy + h * 0.55, w * 0.32, h * 0.32, 0, 0, Math.PI * 2); ctx.fill(); }
  if ("EICF".includes(v) || (v === "A" && sonrie)) { ctx.fillStyle = "#f6eee8"; ctx.fillRect(cx - w / 2, cy - h * 0.6, w, h * 0.32); }
  ctx.restore();
  trazo(ctx, mezclar(c.linea, c.piel, 0.2), S * 0.08);
  ctx.restore();
}
