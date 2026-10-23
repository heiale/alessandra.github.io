// Modello dei tratti, disegno su canvas ed esportazione PNG.
//
// I punti sono salvati in "unità": 1 unità = il lato corto della canvas, con l'origine al centro.
// Così il disegno resta proporzionato e centrato se la canvas cambia misura (es. rotazione del
// telefono). Ogni tratto è { tool, color, width, points: [[x, y], ...] }, con width in unità.
// Lo stesso formato a liste [x, y] serve anche per i tratti dell'AI (replay.js).

const MIN_STEP = 0.004; // distanza minima fra due punti (circa 1 px su un telefono)

export function createDrawing() {
  const strokes = [];
  let current = null;

  return {
    strokes,
    get current() {
      return current;
    },
    // Vero se c'è almeno un tratto di matita (la gomma da sola non conta come disegno).
    get hasInk() {
      return strokes.some((s) => s.tool !== 'eraser');
    },
    begin(tool, color, width, point) {
      current = { tool, color, width, points: [point] };
    },
    extend(point) {
      if (!current) return;
      const [lx, ly] = current.points[current.points.length - 1];
      if (Math.hypot(point[0] - lx, point[1] - ly) < MIN_STEP) return;
      current.points.push(point);
    },
    end() {
      const s = current;
      current = null;
      if (s) strokes.push(s);
      return s;
    },
    undo() {
      return strokes.pop();
    },
    clear() {
      strokes.length = 0;
      current = null;
    },
  };
}

// Disegna un tratto con curve morbide: quadraticCurveTo fra i punti medi.
export function drawStroke(ctx, stroke) {
  const pts = stroke.points;
  if (!pts.length) return;
  ctx.save();
  ctx.globalCompositeOperation = stroke.tool === 'eraser' ? 'destination-out' : 'source-over';
  ctx.strokeStyle = ctx.fillStyle = stroke.color;
  ctx.lineWidth = stroke.width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (pts.length === 1) {
    // Un tocco singolo lascia un punto.
    ctx.beginPath();
    ctx.arc(pts[0][0], pts[0][1], stroke.width / 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i][0] + pts[i + 1][0]) / 2;
      const my = (pts[i][1] + pts[i + 1][1]) / 2;
      ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
    }
    const last = pts[pts.length - 1];
    ctx.lineTo(last[0], last[1]);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawStrokes(ctx, strokes) {
  for (const s of strokes) drawStroke(ctx, s);
}

// Esporta il disegno in PNG (data URL) su fondo bianco, ritagliato attorno ai tratti con un
// margine, con il lato lungo di `maxSide` px. Restituisce null se non c'è niente di disegnato.
export function exportPNG(strokes, { maxSide = 768, margin = 0.1, minSize = 0.25, background = '#fff' } = {}) {
  const ink = strokes.filter((s) => s.tool !== 'eraser');
  if (!ink.length) return null;

  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const s of ink) {
    const r = s.width / 2;
    for (const [x, y] of s.points) {
      x0 = Math.min(x0, x - r); y0 = Math.min(y0, y - r);
      x1 = Math.max(x1, x + r); y1 = Math.max(y1, y + r);
    }
  }
  // Un disegno minuscolo non va ingrandito a tutta immagine: dimensione minima del riquadro.
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const bw = Math.max(x1 - x0, minSize), bh = Math.max(y1 - y0, minSize);
  const pad = Math.max(bw, bh) * margin;
  const w = bw + pad * 2, h = bh + pad * 2;
  const k = maxSide / Math.max(w, h);
  const pw = Math.round(w * k), ph = Math.round(h * k);

  // I tratti (gomma compresa) vanno su un livello trasparente, poi sopra il fondo bianco:
  // così la gomma cancella l'inchiostro e non il bianco.
  const layer = document.createElement('canvas');
  layer.width = pw; layer.height = ph;
  const lctx = layer.getContext('2d');
  lctx.setTransform(k, 0, 0, k, (w / 2 - cx) * k, (h / 2 - cy) * k);
  drawStrokes(lctx, strokes);

  const out = document.createElement('canvas');
  out.width = pw; out.height = ph;
  const octx = out.getContext('2d');
  octx.fillStyle = background;
  octx.fillRect(0, 0, pw, ph);
  octx.drawImage(layer, 0, 0);
  return out.toDataURL('image/png');
}
