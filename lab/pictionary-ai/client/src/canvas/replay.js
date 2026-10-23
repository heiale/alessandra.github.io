// Animazione dei tratti dell'AI con effetto "fatto a mano" (PLAN.md sez. 7):
// - ogni punto riceve un jitter casuale di ±2-4 unità (deciso una volta, non a ogni frame);
// - i tratti sono curve morbide (drawStroke: quadraticCurveTo fra i punti medi);
// - si disegna un tratto alla volta, a 40-60 punti al secondo con un leggero rallentamento
//   all'inizio e alla fine, e una breve pausa fra un tratto e l'altro.
// I tratti arrivano nella canvas 1000x1000 del server: { color, width, points: [[x, y], ...] }.
import { drawStroke } from './strokes.js';

const between = (rand, [lo, hi]) => lo + rand() * (hi - lo);
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

/**
 * Prepara l'animazione: jitter e tempi di ogni tratto.
 * @returns {{ items: Array<{ stroke, start, duration }>, total: number }}  tempi in ms
 */
export function planReplay(strokes, {
  jitter = [2, 4],
  speed = [40, 60], // punti al secondo
  pause = [220, 420], // ms fra un tratto e l'altro
  delay = 400, // ms prima del primo tratto
  rand = Math.random,
} = {}) {
  let t = delay;
  const items = strokes.map((s) => {
    const amp = between(rand, jitter);
    const points = s.points.map(([x, y]) => [x + (rand() * 2 - 1) * amp, y + (rand() * 2 - 1) * amp]);
    const duration = Math.max(160, ((points.length - 1) / between(rand, speed)) * 1000);
    const item = { stroke: { tool: 'pencil', color: s.color, width: s.width, points }, start: t, duration };
    t += duration + between(rand, pause);
    return item;
  });
  return { items, total: items.length ? items.at(-1).start + items.at(-1).duration : 0 };
}

// Parte di un tratto disegnata dopo `progress` (0-1): punti interi più un punto interpolato.
function partial(stroke, progress) {
  const pts = stroke.points;
  const k = easeInOut(progress) * (pts.length - 1);
  const i = Math.floor(k);
  const f = k - i;
  const head = pts.slice(0, i + 1);
  if (f > 0 && i + 1 < pts.length) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[i + 1];
    head.push([ax + (bx - ax) * f, ay + (by - ay) * f]);
  }
  return { ...stroke, points: head };
}

/**
 * Disegna lo stato dell'animazione al tempo `elapsed` (ms). Il contesto deve già avere la
 * trasformazione che porta la canvas 1000x1000 sullo schermo (vedi fitTransform).
 * `minWidth`: spessore minimo in unità, così le linee restano visibili su schermi piccoli.
 * Restituisce true quando tutti i tratti sono completi.
 */
export function drawReplay(ctx, plan, elapsed, minWidth = 0) {
  for (const { stroke, start, duration } of plan.items) {
    if (elapsed <= start) break;
    const s = { ...stroke, width: Math.max(stroke.width, minWidth) };
    drawStroke(ctx, elapsed >= start + duration ? s : partial(s, (elapsed - start) / duration));
  }
  return elapsed >= plan.total;
}

/**
 * Trasformazione che centra la canvas 1000x1000 in un'area w×h (px CSS) con un margine.
 * @returns {{ k: number, dx: number, dy: number }}  scala e spostamento in px CSS
 */
export function fitTransform(w, h, margin = 0.06) {
  const side = Math.min(w, h) * (1 - margin * 2);
  const k = side / 1000;
  return { k, dx: (w - side) / 2, dy: (h - side) / 2 };
}
