// Schermata di disegno dell'utente: canvas a tutto schermo e toolbar verticale a destra
// (timer, matita, gomma, annulla, fatto). Alla fine esporta il PNG e passa a "reveal".
import { createDrawing, drawStroke, drawStrokes, exportPNG } from '../canvas/strokes.js';

const DURATION = 60_000; // tempo per disegnare, in ms
const LOW_TIME = 10_000; // sotto questa soglia il timer diventa rosso
const INK = '#111111';
const TOOLS = {
  pencil: { width: 6 }, // spessore in px CSS al momento del disegno
  eraser: { width: 32 },
};
const RING = 2 * Math.PI * 21; // circonferenza dell'anello del timer (r = 21)

const ICONS = {
  pencil: '<path d="M4 20l1.2-4.4L15.6 5.2a2 2 0 0 1 2.8 0l.4.4a2 2 0 0 1 0 2.8L8.4 18.8z"/><path d="M13.5 7.3l3.2 3.2"/>',
  eraser: '<path d="M9 19.5h11"/><path d="M4.7 14.7l8.6-8.6a2 2 0 0 1 2.8 0l2.8 2.8a2 2 0 0 1 0 2.8l-7.4 7.4H8.6z"/><path d="M8.6 10.8l4.6 4.6"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  done: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
};
const icon = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;

export function render(root, { go, params }) {
  const word = params.word ?? 'apple'; // senza parametri (solo in sviluppo, #draw) una parola di prova

  const el = document.createElement('section');
  el.className = 'draw-screen';
  el.dataset.activeTool = 'pencil';
  el.innerHTML = `
    <div class="draw-stage">
      <canvas class="draw-canvas" aria-label="Drawing area"></canvas>
      <p class="draw-prompt">Draw<strong></strong></p>
    </div>
    <div class="draw-toolbar" role="toolbar" aria-label="Drawing tools" aria-orientation="vertical">
      <div class="draw-timer" role="timer" aria-label="Time left">
        <svg viewBox="0 0 48 48" aria-hidden="true">
          <circle class="track" cx="24" cy="24" r="21"/>
          <circle class="ring" cx="24" cy="24" r="21" stroke-dasharray="${RING}" stroke-dashoffset="0"/>
        </svg>
        <span>60</span>
      </div>
      <button class="tool" type="button" data-tool="pencil" aria-pressed="true" aria-label="Pencil" title="Pencil (P)">${icon('pencil')}</button>
      <button class="tool" type="button" data-tool="eraser" aria-pressed="false" aria-label="Eraser" title="Eraser (E)">${icon('eraser')}</button>
      <button class="tool" type="button" data-action="undo" aria-label="Undo" title="Undo (Ctrl+Z)" disabled>${icon('undo')}</button>
      <button class="tool tool-done" type="button" data-action="done" aria-label="Done" title="Done" disabled>${icon('done')}</button>
    </div>`;
  el.querySelector('.draw-prompt strong').textContent = word;
  root.append(el);

  const stage = el.querySelector('.draw-stage');
  const canvas = el.querySelector('.draw-canvas');
  const ctx = canvas.getContext('2d');
  const timerEl = el.querySelector('.draw-timer');
  const ringEl = timerEl.querySelector('.ring');
  const secondsEl = timerEl.querySelector('span');
  const undoBtn = el.querySelector('[data-action="undo"]');
  const doneBtn = el.querySelector('[data-action="done"]');
  const toolBtns = [...el.querySelectorAll('[data-tool]')];

  // I tratti finiti stanno in una canvas fuori schermo: a ogni frame si copia quella e si
  // disegna sopra solo il tratto in corso, senza ridisegnare tutto.
  const committed = document.createElement('canvas');
  const cctx = committed.getContext('2d');

  const drawing = createDrawing();
  const view = { w: 0, h: 0, s: 1, dpr: 1, left: 0, top: 0 };
  let tool = 'pencil';
  let activePointer = null;
  let frame = 0;
  let finished = false;

  // Trasformazione unità → pixel della canvas: scala = lato corto, origine al centro.
  function applyView(c) {
    const k = view.s * view.dpr;
    c.setTransform(k, 0, 0, k, (view.w / 2) * view.dpr, (view.h / 2) * view.dpr);
  }

  function rebuildCommitted() {
    cctx.setTransform(1, 0, 0, 1, 0, 0);
    cctx.clearRect(0, 0, committed.width, committed.height);
    applyView(cctx);
    drawStrokes(cctx, drawing.strokes);
  }

  function paint() {
    frame = 0;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(committed, 0, 0);
    if (drawing.current) {
      applyView(ctx);
      drawStroke(ctx, drawing.current);
    }
  }
  const schedule = () => { if (!frame) frame = requestAnimationFrame(paint); };

  function resize() {
    const rect = stage.getBoundingClientRect();
    view.w = rect.width;
    view.h = rect.height;
    view.s = Math.max(1, Math.min(rect.width, rect.height));
    view.dpr = Math.min(window.devicePixelRatio || 1, 3);
    const pw = Math.round(rect.width * view.dpr);
    const ph = Math.round(rect.height * view.dpr);
    canvas.width = committed.width = pw;
    canvas.height = committed.height = ph;
    rebuildCommitted();
    paint();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(stage);

  function toUnits(e) {
    return [
      (e.clientX - view.left - view.w / 2) / view.s,
      (e.clientY - view.top - view.h / 2) / view.s,
    ];
  }

  function updateButtons() {
    undoBtn.disabled = finished || drawing.strokes.length === 0;
    doneBtn.disabled = finished || !drawing.hasInk;
  }

  function setTool(name) {
    tool = name;
    el.dataset.activeTool = name;
    for (const b of toolBtns) b.setAttribute('aria-pressed', String(b.dataset.tool === name));
  }

  function undo() {
    if (finished || activePointer !== null || !drawing.undo()) return;
    rebuildCommitted();
    paint();
    updateButtons();
  }

  // --- Pointer Events: un solo dito/penna alla volta, gli altri tocchi sono ignorati.
  function onDown(e) {
    if (finished || activePointer !== null) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    activePointer = e.pointerId;
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      // Senza cattura si disegna lo stesso, solo che il tratto si ferma se si esce dalla canvas.
    }
    const rect = canvas.getBoundingClientRect();
    view.left = rect.left;
    view.top = rect.top;
    drawing.begin(tool, INK, TOOLS[tool].width / view.s, toUnits(e));
    schedule();
  }

  function onMove(e) {
    if (e.pointerId !== activePointer) return;
    const events = e.getCoalescedEvents?.() ?? [];
    for (const ev of events.length ? events : [e]) drawing.extend(toUnits(ev));
    schedule();
  }

  function onUp(e) {
    if (e.pointerId !== activePointer) return;
    activePointer = null;
    const stroke = drawing.end();
    if (stroke) {
      applyView(cctx);
      drawStroke(cctx, stroke);
    }
    schedule();
    updateButtons();
  }

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  // Safari iOS: niente zoom con due dita sulla schermata di disegno.
  el.addEventListener('gesturestart', (e) => e.preventDefault());

  el.querySelector('.draw-toolbar').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn || btn.disabled) return;
    if (btn.dataset.tool) setTool(btn.dataset.tool);
    else if (btn.dataset.action === 'undo') undo();
    else if (btn.dataset.action === 'done') finish(false);
  });

  function onKey(e) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      undo();
    } else if (!e.metaKey && !e.ctrlKey && !e.altKey) {
      if (e.key === 'p') setTool('pencil');
      if (e.key === 'e') setTool('eraser');
    }
  }
  window.addEventListener('keydown', onKey);

  // --- Timer: basato su una scadenza, così resta giusto anche se i frame rallentano.
  const deadline = performance.now() + DURATION;
  let timerFrame = 0;
  let shownSeconds = -1;
  function tick() {
    const left = Math.max(0, deadline - performance.now());
    ringEl.setAttribute('stroke-dashoffset', String(RING * (1 - left / DURATION)));
    const secs = Math.ceil(left / 1000);
    if (secs !== shownSeconds) {
      shownSeconds = secs;
      secondsEl.textContent = String(secs);
      timerEl.setAttribute('aria-label', `${secs} seconds left`);
      timerEl.classList.toggle('is-low', left <= LOW_TIME);
    }
    if (left === 0) finish(true);
    else timerFrame = requestAnimationFrame(tick);
  }
  timerFrame = requestAnimationFrame(tick);

  function finish(timedOut) {
    if (finished) return;
    // Se il tempo scade a metà tratto, il tratto in corso viene tenuto.
    if (activePointer !== null) onUp({ pointerId: activePointer });
    finished = true;
    updateButtons();
    const image = exportPNG(drawing.strokes);
    go('reveal', { word, image, timedOut, token: params.token, timeUsed: DURATION - Math.max(0, deadline - performance.now()) });
  }

  document.documentElement.classList.add('is-locked');

  return () => {
    finished = true;
    ro.disconnect();
    cancelAnimationFrame(frame);
    cancelAnimationFrame(timerFrame);
    window.removeEventListener('keydown', onKey);
    document.documentElement.classList.remove('is-locked');
  };
}
