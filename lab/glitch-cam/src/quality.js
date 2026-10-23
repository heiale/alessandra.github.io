// Profili di qualità: sui telefoni l'esperienza usa meno risorse, così resta fluida e non si blocca.
// In più, su qualsiasi dispositivo, se gli FPS scendono troppo la qualità si abbassa da sola.

/** Telefoni e tablet: schermo touch come puntatore principale, o user agent mobile. */
export const IS_MOBILE =
  window.matchMedia('(pointer: coarse)').matches || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

/**
 * Valori di partenza.
 *   camera:         risoluzione richiesta alla webcam
 *   maxPixelRatio:  densità massima del canvas (2 = schermi retina a piena risoluzione)
 *   renderScale:    frazione della risoluzione a cui si disegna l'effetto (poi viene ingrandito)
 *   modelFps:       quante volte al secondo girano i modelli di mano e sagoma
 *   historyFrames:  fotogrammi tenuti in memoria per i blocchi nel tempo
 *   historyWidth:   larghezza a cui sono salvati quei fotogrammi
 *   tuning:         valori di partenza diversi per alcuni parametri degli effetti, per nome
 */
export const QUALITY = IS_MOBILE
  ? {
      camera: { width: 640, height: 480 },
      maxPixelRatio: 1,
      renderScale: 0.75,
      modelFps: 15,
      historyFrames: 20,
      historyWidth: 480,
      // Il telefono in mano si muove sempre un po': per i blocchi nel tempo "tutto si muove".
      // Partiamo più calmi (ritardi brevi, più sezioni nel presente, meno rettangoli sparsi);
      // con la mano aperta l'effetto sale comunque.
      tuning: {
        timeblocks: { baseDelay: 4, baseDelayHand: 12, liveShare: 0.5, rate: 2.5, maxDelay: 12, maxBlocks: 5 },
      },
    }
  : {
      camera: { width: 1280, height: 720 },
      maxPixelRatio: 2,
      renderScale: 1,
      modelFps: 30,
      historyFrames: 32,
      historyWidth: 960,
      tuning: {},
    };

const MIN_RENDER_SCALE = 0.45;
const MIN_MODEL_FPS = 8;
const LOW_FPS = 24; // sotto questa soglia l'esperienza non sembra più fluida
const PATIENCE = 1.5; // secondi di FPS bassi prima di abbassare la qualità
const COOLDOWN = 2; // secondi da aspettare dopo un cambio, per vederne l'effetto
const WARMUP = 4; // secondi iniziali ignorati: i modelli si stanno ancora caricando e "scaldando"

/**
 * Abbassa la qualità a gradini quando gli FPS restano bassi:
 * prima la risoluzione dell'effetto, poi la frequenza dei modelli.
 * Non la rialza da sola: meglio stabile che altalenante.
 */
export class AdaptiveQuality {
  constructor({ renderer, getModels }) {
    this.renderer = renderer;
    this.getModels = getModels; // () => [tracker, segmenter] della sessione corrente
    this.lowFor = 0;
    this.cooldown = WARMUP;
    this.level = 0; // quanti gradini abbiamo già sceso (per il pannello debug)
  }

  /** Da chiamare a ogni frame con gli FPS correnti (già smussati). */
  update(fps, dt) {
    // Fotogramma lunghissimo = la scheda era nascosta: non è lentezza, non conta.
    if (dt >= 0.1) {
      this.lowFor = 0;
      return;
    }
    this.cooldown -= dt;
    this.lowFor = fps < LOW_FPS ? this.lowFor + dt : 0;
    if (this.lowFor < PATIENCE || this.cooldown > 0) return;
    this.lowFor = 0;
    this.cooldown = COOLDOWN;

    if (this.renderer.renderScale > MIN_RENDER_SCALE) {
      this.renderer.renderScale = Math.max(MIN_RENDER_SCALE, this.renderer.renderScale - 0.15);
      this.level++;
      return;
    }
    let changed = false;
    for (const model of this.getModels()) {
      if (model && model.targetFps > MIN_MODEL_FPS) {
        model.targetFps = Math.max(MIN_MODEL_FPS, Math.round(model.targetFps * 0.7));
        changed = true;
      }
    }
    if (changed) this.level++;
  }
}
