// Interfaccia: schermata iniziale, suggerimento in basso e pannello debug (tasto D).

import { videoToScreen } from './gl.js';
import { HAND_CONNECTIONS } from './tracking.js';
import { SEGMENTATION_SETTINGS } from './segmentation.js';

// ---------------------------------------------------------------------------
// Schermata iniziale
// ---------------------------------------------------------------------------

const ERROR_MESSAGES = {
  denied:
    'Webcam access was denied. To try again, allow the camera in the site settings ' +
    '(the icon next to the address bar) and press the button again.',
  'not-found': 'No webcam found. Connect one and try again.',
  busy: 'The webcam is being used by another app (Zoom, Meet, FaceTime…). Close it and try again.',
  insecure: 'The webcam only works on an https page (or locally). Open the https version of the site.',
  unsupported: 'This browser can’t use the webcam. Try an up-to-date Chrome, Edge, Firefox or Safari.',
  webgl: 'Your browser doesn’t support WebGL2, which the effect needs. Try updating it or turning on hardware acceleration.',
  effect: 'The effect couldn’t start on this device. The error details are in the console.',
  ended: 'The webcam was disconnected or stopped.',
  unknown: 'Something went wrong while starting the webcam. Please try again.',
};

export function createIntro(root, { onStart }) {
  const text = root.querySelector('#intro-text');
  const button = root.querySelector('#start-button');
  const defaultText = text.textContent.trim();

  button.addEventListener('click', () => onStart());

  return {
    setLoading(message) {
      root.classList.remove('is-hidden');
      text.textContent = message;
      text.classList.remove('is-error');
      button.disabled = true;
    },
    setError(code) {
      root.classList.remove('is-hidden');
      text.textContent = ERROR_MESSAGES[code] ?? ERROR_MESSAGES.unknown;
      text.classList.add('is-error');
      button.disabled = false;
      button.textContent = 'Try again';
      button.focus();
    },
    hide() {
      root.classList.add('is-hidden');
      text.textContent = defaultText;
      text.classList.remove('is-error');
      button.disabled = false;
      button.textContent = 'Turn on webcam';
    },
  };
}

// ---------------------------------------------------------------------------
// Suggerimento in basso
// ---------------------------------------------------------------------------

export function createHint(el) {
  const defaultHtml = el.innerHTML;
  let fadeTimer = 0;
  return {
    /** Mostra un messaggio; senza argomenti rimette il suggerimento standard. */
    show(message) {
      clearTimeout(fadeTimer);
      if (message) el.textContent = message;
      else el.innerHTML = defaultHtml;
      el.hidden = false;
      el.classList.remove('is-faded');
    },
    fadeAfter(ms) {
      clearTimeout(fadeTimer);
      fadeTimer = setTimeout(() => el.classList.add('is-faded'), ms);
    },
  };
}

// ---------------------------------------------------------------------------
// Pannello debug
// ---------------------------------------------------------------------------

const GESTURE_SCHEMA = [
  { group: 'Gesture mapping' },
  { key: 'idleMin', label: 'No hand: min level', min: 0, max: 10, step: 0.1 },
  { key: 'idleMax', label: 'No hand: max level', min: 0, max: 10, step: 0.1 },
  { key: 'idleSpeed', label: 'No hand: drift speed', min: 0, max: 2, step: 0.05 },
  { key: 'handMin', label: 'Closed fist: level', min: 0, max: 10, step: 0.1 },
  { key: 'handMax', label: 'Open hand: level', min: 0, max: 10, step: 0.1 },
  { key: 'verticalInfluence', label: 'Hand height influence', min: 0, max: 1, step: 0.01 },
  { key: 'attack', label: 'Rise time (s)', min: 0.01, max: 1.5, step: 0.01 },
  { key: 'release', label: 'Fall time (s)', min: 0.01, max: 2, step: 0.01 },
  { key: 'lostGrace', label: 'Lost hand grace (s)', min: 0, max: 1, step: 0.05 },
];

const SEGMENTATION_SCHEMA = [
  { key: 'smoothing', label: 'Mask stability over time', min: 0, max: 0.9, step: 0.01 },
];

const STORAGE_KEY = 'glitch-cam:tuning';

// Nomi dei gesti mostrati nel pannello (il pannello è in inglese, il tracker usa nomi italiani).
const GESTURE_NAMES = { aperta: 'open', pugno: 'fist', intermedia: 'half open', nessuna: 'none' };

/**
 * @param {{ panel: HTMLElement, overlay: HTMLCanvasElement, effects: object[], mapper: import('./tracking.js').GestureMapper }} opts
 */
export function createDebugPanel({ panel, overlay, effects, mapper }) {
  const ctx = overlay.getContext('2d');
  // Tutti i valori regolabili, raggruppati: uno per effetto (con il suo nome) + gesti e maschera.
  const tunables = {
    ...Object.fromEntries(effects.map((effect) => [effect.name, effect.params])),
    gesture: mapper.settings,
    mask: SEGMENTATION_SETTINGS,
  };
  const defaults = Object.fromEntries(Object.entries(tunables).map(([id, t]) => [id, { ...t }]));
  // Opzioni di visualizzazione lette dal loop principale (state.debug).
  const flags = { showLandmarks: true, showMask: false };
  let lastStatsUpdate = 0;

  restoreTuning(tunables);

  panel.innerHTML = `
    <h2>Status</h2>
    <dl class="debug__stats">
      <dt>Render FPS</dt><dd data-stat="fps">–</dd>
      <dt>Hand tracking FPS</dt><dd data-stat="trackFps">–</dd>
      <dt>Hand model time</dt><dd data-stat="detectMs">–</dd>
      <dt>Hand delegate</dt><dd data-stat="delegate">–</dd>
      <dt>Segmentation FPS</dt><dd data-stat="segFps">–</dd>
      <dt>Segmentation time</dt><dd data-stat="segMs">–</dd>
      <dt>Segmentation delegate</dt><dd data-stat="segDelegate">–</dd>
      <dt>Person in frame</dt><dd data-stat="coverage">–</dd>
      <dt>Gesture</dt><dd data-stat="gesture">–</dd>
      <dt>Hand openness</dt><dd data-stat="openness">–</dd>
      <dt>Hand height</dt><dd data-stat="handY">–</dd>
      <dt>Scattered time blocks</dt><dd data-stat="timeblocks">–</dd>
      <dt>Intensity</dt><dd data-stat="intensity">–</dd>
    </dl>
    <div class="debug__meter"><span data-meter></span></div>
    <div data-controls></div>
    <div class="debug__buttons">
      <button type="button" data-action="copy">Copy values</button>
      <button type="button" data-action="reset">Reset</button>
    </div>
    <p class="debug__note">Press D to close. Values are saved in this browser.</p>
  `;

  const stat = Object.fromEntries([...panel.querySelectorAll('[data-stat]')].map((el) => [el.dataset.stat, el]));
  const meter = panel.querySelector('[data-meter]');
  const controls = panel.querySelector('[data-controls]');
  const inputs = [];

  addSliders(controls, GESTURE_SCHEMA, mapper.settings, inputs, save);

  // Forza intensità: utile per regolare l'effetto senza dover tenere la mano davanti alla camera.
  const overrideRow = document.createElement('div');
  overrideRow.className = 'debug__row';
  overrideRow.innerHTML = `
    <label><input type="checkbox" data-override-toggle /> Force intensity</label>
    <output>5.0</output>
    <input type="range" min="0" max="10" step="0.1" value="5" disabled data-override-value />`;
  controls.append(overrideRow);
  const overrideToggle = overrideRow.querySelector('[data-override-toggle]');
  const overrideValue = overrideRow.querySelector('[data-override-value]');
  const overrideOut = overrideRow.querySelector('output');
  const syncOverride = () => {
    overrideValue.disabled = !overrideToggle.checked;
    overrideOut.textContent = Number(overrideValue.value).toFixed(1);
    mapper.override = overrideToggle.checked ? Number(overrideValue.value) : null;
  };
  overrideToggle.addEventListener('change', syncOverride);
  overrideValue.addEventListener('input', syncOverride);

  for (const effect of effects) addSliders(controls, effect.schema, effect.params, inputs, save);
  addSliders(controls, SEGMENTATION_SCHEMA, SEGMENTATION_SETTINGS, inputs, save);

  addCheckbox(controls, 'Show person mask', flags.showMask, (on) => (flags.showMask = on));
  addCheckbox(controls, 'Show hand landmarks', flags.showLandmarks, (on) => {
    flags.showLandmarks = on;
    if (!on) clearOverlay();
  });

  panel.querySelector('[data-action="copy"]').addEventListener('click', async (e) => {
    const json = JSON.stringify(tunables, null, 2);
    try {
      await navigator.clipboard.writeText(json);
      e.target.textContent = 'Copied ✓';
    } catch {
      console.log(json);
      e.target.textContent = 'See console';
    }
    setTimeout(() => (e.target.textContent = 'Copy values'), 1500);
  });

  panel.querySelector('[data-action="reset"]').addEventListener('click', () => {
    for (const id of Object.keys(tunables)) Object.assign(tunables[id], defaults[id]);
    inputs.forEach((sync) => sync());
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* storage non disponibile: nessun problema */
    }
  });

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tunables));
    } catch {
      /* storage non disponibile (navigazione privata ecc.): i valori valgono solo per questa sessione */
    }
  }

  function clearOverlay() {
    ctx.clearRect(0, 0, overlay.width, overlay.height);
  }

  function drawLandmarks(landmarks, video) {
    // Stesso canvas size del WebGL, così la trasformazione "cover" coincide.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(overlay.clientWidth * dpr);
    const h = Math.round(overlay.clientHeight * dpr);
    if (overlay.width !== w || overlay.height !== h) {
      overlay.width = w;
      overlay.height = h;
    }
    clearOverlay();
    if (!landmarks || !video.videoWidth) return;

    const pts = landmarks.map((p) => videoToScreen(p, w, h, video.videoWidth, video.videoHeight));

    ctx.lineWidth = 2 * dpr;
    ctx.strokeStyle = 'rgba(8, 217, 214, 0.9)';
    ctx.beginPath();
    for (const [a, b] of HAND_CONNECTIONS) {
      ctx.moveTo(...pts[a]);
      ctx.lineTo(...pts[b]);
    }
    ctx.stroke();
    ctx.fillStyle = '#ff2e63';
    for (const [x, y] of pts) {
      ctx.beginPath();
      ctx.arc(x, y, 3.5 * dpr, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  return {
    flags,

    get visible() {
      return !panel.hidden;
    },

    toggle() {
      panel.hidden = !panel.hidden;
      if (panel.hidden) clearOverlay();
    },

    /** Chiamato a ogni frame dal loop principale. */
    update({ now, fps, tracker, segmenter, effects: active, hand, intensity, video }) {
      if (panel.hidden) return;
      meter.style.width = `${(intensity * 100).toFixed(1)}%`;
      if (flags.showLandmarks) drawLandmarks(hand.present ? hand.landmarks : null, video);

      // Il testo lo aggiorniamo 4 volte al secondo: leggibile e senza lavoro inutile per il DOM.
      if (now - lastStatsUpdate < 250) return;
      lastStatsUpdate = now;
      stat.fps.textContent = fps.toFixed(0);
      stat.trackFps.textContent = tracker?.running ? tracker.stats.fps.toFixed(0) : 'off';
      stat.detectMs.textContent = tracker?.running ? `${tracker.stats.ms.toFixed(1)} ms` : '–';
      stat.delegate.textContent = tracker?.delegate ?? 'loading';
      stat.segFps.textContent = segmenter?.running ? segmenter.stats.fps.toFixed(0) : 'off';
      stat.segMs.textContent = segmenter?.running ? `${segmenter.stats.ms.toFixed(1)} ms` : '–';
      stat.segDelegate.textContent = segmenter?.delegate ?? 'loading';
      stat.coverage.textContent = segmenter?.version ? `${Math.round(segmenter.coverage * 100)}%` : '–';
      stat.gesture.textContent = hand.present ? (GESTURE_NAMES[hand.gesture] ?? hand.gesture) : 'no hand';
      stat.openness.textContent = hand.present ? hand.openness.toFixed(2) : '–';
      stat.handY.textContent = hand.present ? hand.y.toFixed(2) : '–';
      const blocks = active.find((effect) => effect.name === 'timeblocks');
      stat.timeblocks.textContent = blocks ? String(blocks.count) : '–';
      stat.intensity.textContent = `${(intensity * 10).toFixed(1)} / 10${mapper.override !== null ? ' (forced)' : ''}`;
    },
  };
}

/** Crea uno slider per ogni voce dello schema; le voci `{ group }` diventano titoli. */
function addSliders(container, schema, target, syncList, onChange) {
  for (const item of schema) {
    if (item.group) {
      const h = document.createElement('h2');
      h.textContent = item.group;
      container.append(h);
      continue;
    }
    const id = `ctl-${item.key}`;
    const row = document.createElement('div');
    row.className = 'debug__row';
    row.innerHTML = `
      <label for="${id}">${item.label}</label>
      <output for="${id}"></output>
      <input type="range" id="${id}" min="${item.min}" max="${item.max}" step="${item.step}" />`;
    const input = row.querySelector('input');
    const output = row.querySelector('output');
    const decimals = Math.max(0, -Math.floor(Math.log10(item.step)));
    const sync = () => {
      input.value = target[item.key];
      output.textContent = Number(target[item.key]).toFixed(decimals);
    };
    input.addEventListener('input', () => {
      target[item.key] = Number(input.value);
      output.textContent = Number(input.value).toFixed(decimals);
      onChange();
    });
    sync();
    syncList.push(sync);
    container.append(row);
  }
}

function addCheckbox(container, label, checked, onChange) {
  const row = document.createElement('label');
  row.className = 'debug__row debug__row--check';
  row.innerHTML = `<input type="checkbox" ${checked ? 'checked' : ''} /><span>${label}</span>`;
  row.querySelector('input').addEventListener('change', (e) => onChange(e.target.checked));
  container.append(row);
}

function restoreTuning(tunables) {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (!saved) return;
    // Le versioni precedenti salvavano i parametri del glitch sotto "effect".
    if (saved.effect && !saved.glitch) saved.glitch = saved.effect;
    // Copiamo solo le chiavi che esistono ancora, così i salvataggi vecchi non rompono nulla.
    for (const [id, target] of Object.entries(tunables)) {
      for (const key of Object.keys(target)) {
        if (typeof saved[id]?.[key] === 'number') target[key] = saved[id][key];
      }
    }
  } catch {
    /* storage non disponibile o dati corrotti: usiamo i default */
  }
}
