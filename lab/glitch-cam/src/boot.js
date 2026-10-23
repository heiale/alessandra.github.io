// Entrata della pagina con effetto glitch: violenta ma breve (~0,55 s), così si capisce
// che è voluta e non sembra un problema.
//
// Tre livelli, dall'alto in basso:
//   1. fasce bianche (si arriva dal portfolio, che è bianco) che si rompono e spariscono subito;
//   2. blocchetti "pixel" colorati che lampeggiano in punti casuali;
//   3. la schermata iniziale "strappata": copiata in strisce orizzontali spostate a scatti,
//      alcune in negativo o con le tinte ruotate.
// Sotto, la schermata vera fa un lampo in negativo e una piccola deformazione.
// Con "riduci movimento" attivo nel sistema: solo una dissolvenza breve.

const DURATION = 550; // ms, poi l'overlay viene rimosso
const SLICES = 22;
const TEARS = 12;
const PIXELS = 60;

const ACCENTS = ['#ff5e00', '#ff2e63', '#08d9d6', '#ffe600', '#2b50ff', '#39ff14'];
const SLICE_COLORS = ['#ffffff', '#ffffff', '#ffffff', '#050505', ...ACCENTS];
const TEAR_FILTERS = [
  'none',
  'none',
  'invert(1)',
  'hue-rotate(90deg) saturate(3)',
  'hue-rotate(200deg) saturate(4)',
  'invert(1) hue-rotate(180deg)',
  'contrast(3) saturate(0)',
];

const pick = (list) => list[Math.floor(Math.random() * list.length)];
const rand = (min, max) => min + Math.random() * (max - min);

/** Altezze casuali (in %) che insieme coprono tutto lo schermo. */
function bands(count) {
  const weights = Array.from({ length: count }, () => rand(0.3, 1.7));
  const total = weights.reduce((a, b) => a + b, 0);
  let top = 0;
  return weights.map((w) => {
    const height = (w / total) * 100;
    const band = { top, height };
    top += height;
    return band;
  });
}

/** Keyframe a scatti: `jumps` posizioni casuali, l'ultima con opacità 0. */
function jumpFrames(jumps, spread, extra = () => ({})) {
  const frames = [];
  for (let i = 0; i <= jumps; i++) {
    frames.push({
      transform: `translateX(${rand(-spread, spread)}%)`,
      opacity: i === jumps ? 0 : 1,
      offset: i / jumps,
      ...extra(i),
    });
  }
  return frames;
}

export function playBootGlitch() {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const intro = document.getElementById('intro');
  const overlay = document.createElement('div');
  overlay.className = 'boot';
  overlay.setAttribute('aria-hidden', 'true');
  overlay.inert = true; // le copie della schermata non devono essere cliccabili né raggiungibili da tastiera
  document.body.append(overlay);
  // L'overlay è al suo posto: possiamo mostrare la pagina (vedi lo stile in index.html).
  document.documentElement.classList.remove('booting');

  if (reduced || !overlay.animate) {
    overlay.style.background = '#fff';
    const fade = overlay.animate?.([{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: 'ease-out' });
    if (fade) fade.onfinish = () => overlay.remove();
    else overlay.remove();
    return;
  }

  // steps(): niente movimento fluido, solo salti, come un segnale disturbato.
  const STEPS = 'steps(1, end)';

  // --- 3. Schermata strappata (sotto le fasce). ---
  if (intro) {
    for (const { top, height } of bands(TEARS)) {
      const tear = intro.cloneNode(true);
      tear.removeAttribute('id');
      tear.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
      tear.classList.add('boot__tear');
      tear.style.clipPath = `inset(${top}% 0 ${Math.max(0, 100 - top - height - 0.2)}% 0)`;
      overlay.append(tear);
      tear.animate(
        jumpFrames(Math.floor(rand(3, 7)), 18, () => ({ filter: pick(TEAR_FILTERS) })),
        { duration: rand(280, DURATION - 30), delay: 40, easing: STEPS, fill: 'both' },
      );
    }
  }

  // --- 1. Fasce bianche che si rompono. ---
  for (const { top, height } of bands(SLICES)) {
    const slice = document.createElement('div');
    slice.className = 'boot__slice';
    slice.style.top = `${top}%`;
    slice.style.height = `${height + 0.2}%`; // un filo di sovrapposizione: niente righe tra le fasce
    overlay.append(slice);
    slice.animate(
      jumpFrames(Math.floor(rand(2, 5)), 45, (i) => ({ background: i === 0 ? '#fff' : pick(SLICE_COLORS) })),
      { duration: rand(80, 290), easing: STEPS, fill: 'forwards' },
    );
  }

  // --- 2. Blocchetti "pixel". ---
  for (let i = 0; i < PIXELS; i++) {
    const block = document.createElement('div');
    block.className = 'boot__pixel';
    const w = rand(1.5, 18); // in % della larghezza
    const h = rand(0.6, 4.5); // in % dell'altezza
    block.style.left = `${rand(0, 100 - w)}%`;
    block.style.top = `${rand(0, 100 - h)}%`;
    block.style.width = `${w}%`;
    block.style.height = `${h}%`;
    overlay.append(block);
    block.animate(
      [
        { opacity: 1, background: pick(ACCENTS), transform: 'translateX(0)' },
        { opacity: 1, background: pick(ACCENTS), transform: `translateX(${rand(-60, 60)}px)` },
        { opacity: 0 },
      ],
      { duration: rand(45, 130), delay: rand(0, DURATION - 130), easing: STEPS, fill: 'both' },
    );
  }

  setTimeout(() => overlay.remove(), DURATION);

  // --- Sotto: la schermata vera fa un lampo in negativo e una piccola deformazione. ---
  intro?.animate(
    [
      { filter: 'invert(1) hue-rotate(90deg)', transform: 'skewX(-6deg) scaleY(1.04)', offset: 0 },
      { filter: 'none', transform: 'translateX(14px)', offset: 0.3 },
      { filter: 'hue-rotate(220deg) saturate(3)', transform: 'skewX(4deg)', offset: 0.55 },
      { filter: 'none', transform: 'translateX(-4px)', offset: 0.8 },
      { filter: 'none', transform: 'none', offset: 1 },
    ],
    { duration: DURATION, easing: STEPS },
  );

  // Il testo si assesta con i canali di colore separati, appena dopo che lo strappo finisce.
  document.querySelector('.intro__box')?.animate(
    [
      { textShadow: '-12px 0 #ff2e63, 12px 0 #08d9d6, 0 5px #ffe600' },
      { textShadow: '9px 0 #ff5e00, -9px 0 #2b50ff, 0 -4px #39ff14' },
      { textShadow: '-4px 0 #08d9d6, 4px 0 #ff2e63' },
      { textShadow: 'none' },
    ],
    { duration: DURATION + 80, easing: 'steps(4, end)' },
  );
}
