// Hand tracking con MediaPipe HandLandmarker + lettura dei gesti.
//
// Due pezzi separati:
//   - HandTracker: esegue il modello su un suo loop, a frequenza limitata, e tiene l'ultimo risultato.
//   - GestureMapper: trasforma la mano (o la sua assenza) in un'intensità 0..1, con smoothing.
// Il rendering legge solo l'ultimo risultato disponibile: non aspetta mai il modello.

import { HandLandmarker } from '@mediapipe/tasks-vision';
import { VisionLoop, resolveModel } from './mediapipe.js';

// Indici dei landmark MediaPipe (21 punti per mano).
const WRIST = 0;
const MIDDLE_MCP = 9;
const FINGERS = [
  { mcp: 5, tip: 8 }, // indice
  { mcp: 9, tip: 12 }, // medio
  { mcp: 13, tip: 16 }, // anulare
  { mcp: 17, tip: 20 }, // mignolo
];

/** Coppie di landmark da collegare quando disegniamo lo scheletro della mano nel debug. */
export const HAND_CONNECTIONS = HandLandmarker.HAND_CONNECTIONS.map(({ start, end }) => [start, end]);

export class HandTracker extends VisionLoop {
  /** @param {HTMLVideoElement} video */
  constructor(video, options) {
    super(video, options);
    /** Ultimo risultato. `time` è il performance.now() del rilevamento. */
    this.latest = {
      present: false,
      landmarks: null,
      openness: 0,
      gesture: 'nessuna',
      y: 0.5,
      time: 0,
    };
  }

  async createTask(fileset, delegate) {
    const modelAssetPath = await resolveModel(
      'hand_landmarker.task',
      'hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
    );
    return HandLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath, delegate },
      runningMode: 'VIDEO',
      numHands: 1,
      // Soglie un po' sotto il default (0.5): con luce scarsa la mano si perde meno spesso.
      minHandDetectionConfidence: 0.5,
      minHandPresenceConfidence: 0.45,
      minTrackingConfidence: 0.45,
    });
  }

  process(video, time) {
    const landmarks = this.task.detectForVideo(video, time).landmarks?.[0];
    if (!landmarks) {
      this.latest = {
        ...this.latest,
        present: false,
        landmarks: null,
        gesture: 'nessuna',
      };
      return;
    }
    const aspect = video.videoWidth / video.videoHeight;
    const openness = handOpenness(landmarks, aspect);

    this.latest = {
      present: true,
      landmarks,
      openness,
      gesture: openness > 0.65 ? 'aperta' : openness < 0.3 ? 'pugno' : 'intermedia',
      // Altezza della mano: media tra polso e base del medio (0 = alto, 1 = basso).
      y: (landmarks[WRIST].y + landmarks[MIDDLE_MCP].y) / 2,
      time,
    };
  }
}

/**
 * Quanto è aperta la mano, da 0 (pugno) a 1 (dita tese).
 * Per ogni dito confronta la distanza polso→punta con la distanza polso→nocca:
 * dito teso ≈ 1.9–2.1, dito chiuso ≈ 0.9–1.2. Il rapporto non dipende da quanto
 * la mano è vicina alla camera. Il pollice è escluso: si muove poco tra pugno e mano aperta.
 */
export function handOpenness(landmarks, aspect = 16 / 9) {
  const wrist = landmarks[WRIST];
  let sum = 0;
  for (const { mcp, tip } of FINGERS) {
    const ratio = dist(wrist, landmarks[tip], aspect) / Math.max(dist(wrist, landmarks[mcp], aspect), 1e-5);
    sum += clamp01((ratio - 1.15) / (1.75 - 1.15));
  }
  return sum / FINGERS.length;
}

/**
 * Trasforma lo stato della mano in un'intensità del glitch, con transizioni morbide.
 * I livelli sono su una scala 0–10 (0 = nessun glitch, 10 = massimo); l'intensità
 * restituita agli effetti è la stessa cosa divisa per 10 (0..1).
 */
export class GestureMapper {
  constructor() {
    // Valori modificabili dal pannello debug.
    this.settings = {
      idleMin: 0, // nessuna mano: il glitch oscilla piano tra idleMin e idleMax
      idleMax: 1,
      idleSpeed: 0.25, // oscillazioni al secondo (circa) senza mano
      handMin: 0, // mano presente, chiusa a pugno: effetto al minimo
      handMax: 10, // mano presente, aperta: effetto al massimo
      verticalInfluence: 0.35, // quanto l'altezza della mano sposta il livello dentro handMin–handMax
      attack: 0.15, // secondi per salire (verso più glitch)
      release: 0.5, // secondi per scendere (verso meno glitch)
      lostGrace: 0.3, // secondi in cui teniamo l'ultima mano dopo averla persa (evita sfarfallii)
    };
    this.level = this.settings.idleMin; // livello corrente, 0–10
    this.target = this.level;
    this.override = null; // livello 0–10 per forzare l'intensità dal debug
    this.lastHand = null;
  }

  /** Intensità 0..1 per gli effetti. */
  get intensity() {
    return this.level / 10;
  }

  /**
   * @param {HandTracker['latest']} hand ultimo risultato del tracker
   * @param {number} dt secondi dall'ultimo frame
   * @param {number} now performance.now()
   * @returns {number} intensità 0..1
   */
  update(hand, dt, now) {
    const s = this.settings;

    if (hand.present) this.lastHand = hand;
    // Se la mano sparisce per un attimo (mossa veloce, sfocatura) usiamo ancora l'ultima vista.
    const recent = this.lastHand && now - this.lastHand.time < s.lostGrace * 1000 ? this.lastHand : null;

    let target;
    if (!recent) {
      // Senza mano il glitch "respira" tra idleMin e idleMax. Due sinusoidi con periodi diversi
      // danno un andamento meno meccanico di una sola.
      const t = (now / 1000) * s.idleSpeed * Math.PI * 2;
      const wave = 0.5 + 0.3 * Math.sin(t) + 0.2 * Math.sin(t * 2.71 + 1.3); // 0..1
      target = lerp(s.idleMin, s.idleMax, wave);
    } else {
      // Mano presente: pugno → handMin, mano aperta → handMax. L'altezza sposta il valore
      // dentro lo stesso intervallo (in alto di più, in basso di meno), senza mai uscirne.
      const fromCenter = 0.5 - recent.y; // +0.5 in alto, −0.5 in basso
      const amount = clamp01(recent.openness + s.verticalInfluence * fromCenter * 2);
      target = lerp(s.handMin, s.handMax, amount);
    }
    if (this.override !== null) target = this.override;
    this.target = Math.min(10, Math.max(0, target));

    // Smoothing esponenziale indipendente dal frame rate, più rapido in salita che in discesa.
    const tau = this.target > this.level ? s.attack : s.release;
    this.level += (this.target - this.level) * (1 - Math.exp(-dt / Math.max(tau, 1e-3)));
    return this.intensity;
  }
}

function dist(a, b, aspect) {
  // x e y sono normalizzati su larghezza e altezza del video: correggiamo x con il rapporto d'aspetto.
  const dx = (a.x - b.x) * aspect;
  const dy = a.y - b.y;
  const dz = (a.z - b.z) * aspect; // z usa la stessa scala di x
  return Math.hypot(dx, dy, dz);
}

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => Math.min(1, Math.max(0, v));
