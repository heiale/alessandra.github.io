// L'AI disegna: stessa schermata del disegno, senza strumenti, con i tratti che si compongono.
// params: { strokes, token, category } da /api/draw.
// Senza strokes mostra un disegno di prova (un gatto), utile per provare l'animazione.
import { drawReplay, fitTransform, planReplay } from '../canvas/replay.js';

const MIN_LINE_PX = 4; // spessore minimo a schermo, come la matita dell'utente

const ICONS = {
  pencil: '<path d="M4 20l1.2-4.4L15.6 5.2a2 2 0 0 1 2.8 0l.4.4a2 2 0 0 1 0 2.8L8.4 18.8z"/><path d="M13.5 7.3l3.2 3.2"/>',
  replay: '<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4.5h4.5"/>',
  guess: '<path d="M9 9.5a3 3 0 1 1 4.2 2.8c-.8.4-1.2 1-1.2 1.9v.3"/><circle cx="12" cy="17.6" r=".6" fill="currentColor"/>',
};
const icon = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;

export function render(root, { go, params }) {
  const demo = !params.strokes;
  const strokes = params.strokes ?? DEMO_CAT;
  const category = params.category ?? (demo ? 'animals' : null);

  const el = document.createElement('section');
  el.className = 'draw-screen watch-screen';
  el.innerHTML = `
    <div class="draw-stage">
      <canvas class="draw-canvas" aria-hidden="true"></canvas>
      <p class="draw-prompt" aria-live="polite"><span class="watch-status">The AI is drawing</span><strong>What is it?</strong></p>
      <p class="watch-hint"></p>
    </div>
    <div class="draw-toolbar" role="toolbar" aria-label="Watch controls" aria-orientation="vertical">
      <div class="watch-badge is-drawing" aria-hidden="true">${icon('pencil')}</div>
      <button class="tool" type="button" data-action="replay" aria-label="Watch again" title="Watch again" disabled>${icon('replay')}</button>
      <button class="tool tool-done tool-guess" type="button" data-action="guess" aria-label="I know it: guess">${icon('guess')}<span>Guess</span></button>
    </div>`;
  root.append(el);
  if (category) el.querySelector('.watch-hint').textContent = `Hint: ${category}`;

  const stage = el.querySelector('.draw-stage');
  const canvas = el.querySelector('.draw-canvas');
  const ctx = canvas.getContext('2d');
  const statusEl = el.querySelector('.watch-status');
  const badge = el.querySelector('.watch-badge');
  const replayBtn = el.querySelector('[data-action="replay"]');

  const view = { w: 0, h: 0, dpr: 1 };
  let plan = planReplay(strokes);
  let startedAt = performance.now();
  let frame = 0;
  let finished = false;
  const watchStart = performance.now();

  function resize() {
    const rect = stage.getBoundingClientRect();
    view.w = rect.width;
    view.h = rect.height;
    view.dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.round(rect.width * view.dpr);
    canvas.height = Math.round(rect.height * view.dpr);
    if (finished) paint(plan.total); // a fine animazione non c'è un loop che ridisegna
  }
  const ro = new ResizeObserver(resize);
  ro.observe(stage);

  function paint(elapsed) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const { k, dx, dy } = fitTransform(view.w, view.h);
    ctx.setTransform(k * view.dpr, 0, 0, k * view.dpr, dx * view.dpr, dy * view.dpr);
    return drawReplay(ctx, plan, elapsed, MIN_LINE_PX / (k || 1));
  }

  function loop(now) {
    const done = paint(now - startedAt);
    if (done) {
      frame = 0;
      setFinished(true);
    } else {
      frame = requestAnimationFrame(loop);
    }
  }

  function setFinished(value) {
    finished = value;
    statusEl.textContent = value ? 'The AI is done' : 'The AI is drawing';
    badge.classList.toggle('is-drawing', !value);
    replayBtn.disabled = !value;
  }

  function replay() {
    cancelAnimationFrame(frame);
    plan = planReplay(strokes); // jitter nuovo: ogni replay è un po' diverso, come a mano
    startedAt = performance.now();
    setFinished(false);
    frame = requestAnimationFrame(loop);
  }

  el.querySelector('.draw-toolbar').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn || btn.disabled) return;
    if (btn.dataset.action === 'replay') replay();
    if (btn.dataset.action === 'guess') {
      go('guess', {
        token: params.token,
        category,
        startedAt: watchStart, // per il bonus velocità: si conta dall'inizio dell'animazione
        ...(demo ? { word: 'cat' } : {}), // solo per la verifica finta della schermata guess
      });
    }
  });
  el.addEventListener('gesturestart', (e) => e.preventDefault());
  document.documentElement.classList.add('is-locked');
  frame = requestAnimationFrame(loop);

  return () => {
    cancelAnimationFrame(frame);
    ro.disconnect();
    document.documentElement.classList.remove('is-locked');
  };
}

// --- Disegno di prova nella canvas 1000x1000: un gatto in 12 tratti, come quelli dell'AI.
const circle = (cx, cy, r, n, from = -Math.PI / 2) =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = from + (i / n) * Math.PI * 2;
    return [Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r * 0.92)];
  });
const INK = '#111111';
const DEMO_CAT = [
  { color: INK, width: 9, points: circle(500, 540, 230, 28) },
  { color: INK, width: 9, points: [[318, 400], [335, 230], [440, 330]] },
  { color: INK, width: 9, points: [[560, 330], [665, 230], [682, 400]] },
  { color: INK, width: 9, points: circle(420, 500, 20, 8) },
  { color: INK, width: 9, points: circle(580, 500, 20, 8) },
  { color: '#E8392B', width: 9, points: [[476, 575], [524, 575], [500, 602], [476, 575]] },
  { color: INK, width: 7, points: [[500, 602], [500, 628], [468, 650]] },
  { color: INK, width: 7, points: [[500, 628], [532, 650]] },
  { color: INK, width: 6, points: [[390, 590], [240, 565]] },
  { color: INK, width: 6, points: [[390, 615], [240, 630]] },
  { color: INK, width: 6, points: [[610, 590], [760, 565]] },
  { color: INK, width: 6, points: [[610, 615], [760, 630]] },
];
