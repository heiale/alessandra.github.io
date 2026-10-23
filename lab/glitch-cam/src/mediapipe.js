// Parti comuni ai modelli MediaPipe (mano, segmentazione della persona, futuri):
//   - caricamento dei file wasm, fatto una sola volta
//   - scelta del file del modello (locale, oppure remoto come ripiego)
//   - VisionLoop: un loop separato dal rendering, a frequenza limitata e adattiva

import { FilesetResolver } from '@mediapipe/tasks-vision';

// File serviti dall'app stessa (vedi scripts/setup-assets.mjs). Il modello remoto è solo un ripiego
// se il download locale non è riuscito: scarica il modello, non invia nulla della webcam.
const WASM_PATH = new URL('mediapipe/wasm', document.baseURI).href;
const REMOTE_MODELS = 'https://storage.googleapis.com/mediapipe-models/';

let filesetPromise = null;

/** Il runtime wasm di MediaPipe Vision, condiviso da tutti i modelli. */
export function loadFileset() {
  filesetPromise ??= FilesetResolver.forVisionTasks(WASM_PATH);
  return filesetPromise;
}

/**
 * @param {string} file nome del file in public/models/
 * @param {string} remotePath percorso sotto storage.googleapis.com/mediapipe-models/
 */
export async function resolveModel(file, remotePath) {
  const local = new URL(`models/${file}`, document.baseURI).href;
  try {
    const res = await fetch(local, { method: 'HEAD' });
    if (res.ok) return local;
  } catch {
    /* rete o file assente: usiamo il remoto */
  }
  return REMOTE_MODELS + remotePath;
}

/**
 * Base per i modelli che lavorano sul video. Le sottoclassi implementano:
 *   createTask(fileset, delegate) → Promise<task MediaPipe>
 *   process(video, timestamp)     → esegue il modello e salva il risultato
 */
export class VisionLoop {
  constructor(video, { targetFps = 30, delegates = ['GPU', 'CPU'] } = {}) {
    this.video = video;
    this.targetFps = targetFps;
    this.delegates = delegates;
    this.task = null;
    this.delegate = null; // 'GPU' | 'CPU'
    this.running = false;
    this.timer = 0;
    this.lastVideoTime = -1;
    this.lastRun = 0;
    this.runs = 0;
    this.stats = { ms: 0, fps: 0 };
  }

  /** Crea il modello provando i delegate in ordine (di solito prima GPU, poi CPU). */
  async init() {
    const fileset = await loadFileset();
    for (const delegate of this.delegates) {
      try {
        this.task = await this.createTask(fileset, delegate);
        this.delegate = delegate;
        return delegate;
      } catch (err) {
        console.warn(`[${this.constructor.name}] Delegate ${delegate} unavailable`, err);
      }
    }
    throw new Error(`${this.constructor.name}: unable to start the model.`);
  }

  start() {
    if (!this.task || this.running) return;
    this.running = true;
    this.tick();
  }

  stop() {
    this.running = false;
    clearTimeout(this.timer);
  }

  close() {
    this.stop();
    this.task?.close();
    this.task = null;
  }

  // Ogni esecuzione è un task a sé (setTimeout), così il browser può disegnare tra una e l'altra
  // invece di aspettare il modello.
  tick = () => {
    if (!this.running) return;
    const start = performance.now();

    // Lavoriamo solo se la webcam ha prodotto un fotogramma nuovo.
    if (this.video.readyState >= 2 && this.video.currentTime !== this.lastVideoTime) {
      this.lastVideoTime = this.video.currentTime;
      try {
        this.process(this.video, start);
      } catch (err) {
        console.error(`[${this.constructor.name}] Model error`, err);
      }
      const ms = performance.now() - start;
      // I primi giri sono lenti (il modello compila gli shader GPU): non li contiamo,
      // altrimenti la media gonfiata rallenterebbe il loop per diversi secondi.
      this.runs++;
      if (this.runs > 5) this.stats.ms = lerp(this.stats.ms, ms, 0.1);
      if (this.lastRun) this.stats.fps = lerp(this.stats.fps, 1000 / (start - this.lastRun), 0.1);
      this.lastRun = start;
    }

    // Intervallo adattivo: se il modello è lento (laptop poco potenti) lo chiamiamo meno spesso,
    // per lasciare tempo al rendering. Mai più di targetFps, mai meno di 4 volte al secondo.
    const interval = Math.min(Math.max(1000 / this.targetFps, this.stats.ms * 2), 250);
    this.timer = setTimeout(this.tick, Math.max(0, interval - (performance.now() - start)));
  };
}

const lerp = (a, b, t) => a + (b - a) * t;
