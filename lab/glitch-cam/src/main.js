// Avvio dell'esperienza e loop principale.
//
// Flusso: click su "Attiva webcam" → webcam → WebGL → effetto. Tracking della mano e segmentazione
// della persona si caricano in parallelo: finché non sono pronti, il glitch gira al livello
// "nessuna mano" e su tutta l'immagine.

import './style.css';
import { startCamera } from './camera.js';
import { Renderer } from './gl.js';
import { BackgroundPlate } from './background.js';
import { TimeBlocks } from './timeblocks.js';
import { HandTracker, GestureMapper } from './tracking.js';
import { PersonSegmenter } from './segmentation.js';
import { EFFECTS, ACTIVE_EFFECTS } from './effects/index.js';
import { createIntro, createHint, createDebugPanel } from './ui.js';
import { playBootGlitch } from './boot.js';

const canvas = document.getElementById('stage');
const intro = createIntro(document.getElementById('intro'), { onStart: start });
const hint = createHint(document.getElementById('hint'));

// Entrata della pagina con effetto glitch.
playBootGlitch();

// Creati una sola volta, alla prima attivazione.
let renderer = null;
let effects = [];
let debug = null;
const mapper = new GestureMapper();

// Legati alla sessione webcam corrente (si ricreano se la webcam si scollega e si riprova).
let camera = null;
let tracker = null;
let segmenter = null;
let maskVersion = -1;
let rafId = 0;

const NO_HAND = {
  present: false,
  landmarks: null,
  openness: 0,
  gesture: 'nessuna',
  y: 0.5,
  time: 0,
};

async function start() {
  intro.setLoading('Turning on the webcam…');
  try {
    camera = await startCamera();
  } catch (err) {
    console.error(err);
    intro.setError(err.code ?? 'unknown');
    return;
  }

  if (!renderer) {
    let code = 'webgl';
    try {
      renderer = new Renderer(canvas);
      code = 'effect';
      // Lo sfondo imparato nel tempo, condiviso da tutti gli effetti (renderer.background.texture).
      renderer.background = new BackgroundPlate(renderer);
      // Blocchi nel tempo: l'immagine di partenza per gli effetti (renderer.source.texture).
      renderer.source = new TimeBlocks(renderer); // da qui in poi un errore è dello shader, non del supporto WebGL
      effects = ACTIVE_EFFECTS.map((name) => EFFECTS[name]());
      effects.forEach((effect) => effect.init(renderer));
    } catch (err) {
      console.error(err);
      camera.stop();
      renderer = null;
      effects = [];
      intro.setError(code);
      return;
    }
    debug = createDebugPanel({
      panel: document.getElementById('debug'),
      overlay: document.getElementById('overlay'),
      effects: [renderer.source, ...effects],
      mapper,
    });
  }

  // Il <video> sta nel DOM (invisibile): alcuni browser rallentano la decodifica dei video fuori pagina.
  camera.video.className = 'source-video';
  document.body.append(camera.video);
  camera.stream.getVideoTracks()[0]?.addEventListener('ended', () => stopSession('ended'));

  renderer.background.reset(); // nuova sessione: lo sfondo va reimparato
  renderer.source.reset();
  intro.hide();
  startLoop();
  startVision(camera.video);
}

/** Carica in parallelo mano e segmentazione; ognuno parte appena è pronto. */
async function startVision(video) {
  hint.show('Loading tracking…');
  const hands = new HandTracker(video, { targetFps: 30 });
  const person = new PersonSegmenter(video, { targetFps: 30 });
  tracker = hands;
  segmenter = person;
  maskVersion = -1;

  const [handsOk, personOk] = await Promise.all([launch(hands), launch(person)]);
  // La sessione potrebbe essere finita mentre i modelli si caricavano.
  if (tracker !== hands) return;

  if (!handsOk) hint.show('Hand tracking unavailable: the glitch stays at its base level.');
  else if (!personOk) hint.show('Person segmentation unavailable: the glitch covers the whole image.');
  else {
    hint.show();
    hint.fadeAfter(6000);
  }
}

/** Inizializza un modello e lo avvia. Restituisce false se non è riuscito a partire. */
async function launch(loop) {
  try {
    await loop.init();
  } catch (err) {
    console.error(err);
    return false;
  }
  if (tracker !== loop && segmenter !== loop) {
    loop.close(); // sessione già chiusa
    return false;
  }
  if (!document.hidden) loop.start();
  return true;
}

function stopSession(reason) {
  cancelAnimationFrame(rafId);
  tracker?.close();
  segmenter?.close();
  tracker = null;
  segmenter = null;
  renderer?.resetMask();
  camera?.stop();
  camera?.video.remove();
  camera = null;
  if (reason) intro.setError(reason);
}

// ---------------------------------------------------------------------------
// Loop di rendering
// ---------------------------------------------------------------------------

let lastFrame = 0;
let fps = 0;

function startLoop() {
  cancelAnimationFrame(rafId);
  lastFrame = performance.now();
  rafId = requestAnimationFrame(frame);
}

function frame(now) {
  rafId = requestAnimationFrame(frame);
  // dt limitato: dopo un cambio di tab non vogliamo un salto enorme nello smoothing.
  const dt = Math.min((now - lastFrame) / 1000, 0.1);
  lastFrame = now;
  if (dt > 0) fps += (1 / dt - fps) * 0.05;

  renderer.resize();
  const newFrame = renderer.uploadVideo(camera.video);
  // La maschera arriva al ritmo della segmentazione (~30 Hz): la ricarichiamo solo quando è nuova.
  if (segmenter && segmenter.version !== maskVersion) {
    maskVersion = segmenter.version;
    if (maskVersion > 0) renderer.uploadMask(segmenter.mask, segmenter.width, segmenter.height);
  }
  renderer.background.update();

  const hand = tracker?.latest ?? NO_HAND;
  const intensity = mapper.update(hand, dt, now);
  renderer.source.update(dt, intensity, segmenter?.bbox ?? null, newFrame);
  // Stato condiviso: tutti gli effetti ricevono lo stesso oggetto.
  const state = { time: now / 1000, intensity, hand, debug: debug.flags };

  // Disegnati in ordine, uno sopra l'altro.
  for (const effect of effects) {
    effect.update(state, dt);
    effect.render();
  }

  debug.update({ now, fps, tracker, segmenter, effects: [renderer.source, ...effects], hand, intensity, video: camera.video });
}

// Solo in sviluppo (npm run dev): accesso dalla console per provare gli effetti senza webcam o mano.
if (import.meta.env.DEV) {
  window.__glitchCam = {
    get tracker() {
      return tracker;
    },
    get effects() {
      return effects;
    },
    get source() {
      return renderer?.source;
    },
    mapper,
  };
}

// ---------------------------------------------------------------------------
// Eventi globali
// ---------------------------------------------------------------------------

window.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() !== 'd' || e.metaKey || e.ctrlKey || e.altKey || !debug) return;
  if (e.target instanceof HTMLInputElement && e.target.type !== 'range' && e.target.type !== 'checkbox') return;
  debug.toggle();
});

// Tab nascosta: fermiamo i modelli (il rendering si ferma da solo con requestAnimationFrame).
document.addEventListener('visibilitychange', () => {
  for (const loop of [tracker, segmenter]) {
    if (!loop?.task) continue;
    if (document.hidden) loop.stop();
    else loop.start();
  }
});
