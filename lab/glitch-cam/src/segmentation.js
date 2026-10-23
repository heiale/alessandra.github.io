// Segmentazione della persona con MediaPipe ImageSegmenter (modello "selfie").
// Produce una maschera in scala di grigi (255 = persona, 0 = sfondo) che gli effetti usano
// per decidere dove applicarsi. Gira su un suo loop, come il tracking della mano.

import { ImageSegmenter } from '@mediapipe/tasks-vision';
import { VisionLoop, resolveModel } from './mediapipe.js';

// Il modello lavora comunque a 256 px: gli passiamo un fotogramma già ridotto, così la maschera
// è piccola (lettura e caricamento sulla GPU costano poco) e il bordo viene ammorbidito dal filtro lineare.
const MASK_WIDTH = 256;

/** Regolazioni modificabili dal pannello debug, condivise tra una sessione webcam e l'altra. */
export const SEGMENTATION_SETTINGS = {
  smoothing: 0.5, // quanto della maschera precedente teniamo: più alto = meno sfarfallio, più scia
};

export class PersonSegmenter extends VisionLoop {
  /** @param {HTMLVideoElement} video */
  constructor(video, options) {
    super(video, options);
    const aspect = video.videoWidth / video.videoHeight || 16 / 9;
    this.width = MASK_WIDTH;
    this.height = Math.round(MASK_WIDTH / aspect);
    this.frame = new OffscreenCanvas(this.width, this.height);
    this.frameCtx = this.frame.getContext('2d', { willReadFrequently: false });
    this.mask = new Uint8Array(this.width * this.height);
    this.version = 0; // cresce a ogni maschera nuova: main.js la ricarica sulla GPU solo quando cambia
    this.coverage = 0; // quota di pixel "persona", utile nel debug
    // Rettangolo che contiene la persona, in coordinate del video (0..1, y verso il basso), o null.
    this.bbox = null;
  }

  async createTask(fileset, delegate) {
    const modelAssetPath = await resolveModel(
      'selfie_segmenter.tflite',
      'image_segmenter/selfie_segmenter/float16/1/selfie_segmenter.tflite',
    );
    return ImageSegmenter.createFromOptions(fileset, {
      baseOptions: { modelAssetPath, delegate },
      runningMode: 'VIDEO',
      outputConfidenceMasks: true,
      outputCategoryMask: false,
    });
  }

  process(video, time) {
    this.frameCtx.drawImage(video, 0, 0, this.width, this.height);
    // Versione con callback: le maschere sono valide solo qui dentro, ma MediaPipe non le copia.
    this.task.segmentForVideo(this.frame, time, (result) => {
      const masks = result.confidenceMasks;
      if (!masks?.length) return;
      // Con più categorie la persona è l'ultima (0 = sfondo); il modello selfie ne ha una sola.
      const confidence = masks[masks.length - 1].getAsFloat32Array();
      if (confidence.length !== this.mask.length) return;

      // Media mobile nel tempo: i bordi della maschera tremano meno da un frame all'altro.
      const keep = SEGMENTATION_SETTINGS.smoothing;
      const w = this.width;
      let sum = 0;
      let x0 = w;
      let y0 = this.height;
      let x1 = -1;
      let y1 = -1;
      for (let i = 0; i < confidence.length; i++) {
        const value = this.mask[i] * keep + confidence[i] * 255 * (1 - keep);
        this.mask[i] = value;
        sum += value;
        if (value > 128) {
          const x = i % w;
          const y = (i / w) | 0;
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
      this.coverage = sum / (255 * confidence.length);
      this.bbox = x1 < 0 ? null : { x0: x0 / w, y0: y0 / this.height, x1: (x1 + 1) / w, y1: (y1 + 1) / this.height };
      this.version++;
    });
  }
}
