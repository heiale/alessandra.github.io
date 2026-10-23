// Blocchi nel tempo: pezzi dell'immagine che vengono da un momento passato.
//
// Teniamo in memoria sulla GPU circa l'ultimo secondo di video. Due livelli:
//   - base, sempre attiva: dove c'è la persona, l'immagine è divisa in sezioni irregolari (grandi,
//     medie e piccole) e ogni sezione mostra un momento diverso, a volte a strisce o un po' spostata.
//   - rettangoli sparsi sopra: compaiono ogni tanto, in ritardo, congelati o un po' sfalsati.
// Da fermi passato e presente coincidono e i blocchi non si vedono; muovendosi, il corpo si
// scompone in pezzi presi da momenti diversi.
//
// Il risultato è una nuova immagine "di partenza" (in coordinate del video), che gli effetti
// usano al posto del video vero: renderer.source.texture.

const HISTORY_FRAMES = 32; // ~1 s a 30 fps
const HISTORY_MAX_WIDTH = 960; // la storia è a risoluzione ridotta per stare leggera in memoria
const MAX_BLOCKS = 16; // deve coincidere con la dimensione degli array nello shader

const COPY_FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uVideo;
void main() {
  outColor = texture(uVideo, vUv);
}`;

const COMPOSE_FRAG = /* glsl */ `#version 300 es
precision highp float;
precision highp sampler2DArray;
in vec2 vUv;            // UV del video (v verso l'alto, come la texture del video)
out vec4 outColor;
uniform sampler2D uVideo;
uniform sampler2DArray uHistory;
uniform vec4 uRects[${MAX_BLOCKS}];   // x0, y0, x1, y1 in UV del video
uniform vec4 uInfo[${MAX_BLOCKS}];    // x = fotogramma della storia, y/z = spostamento, w = non usato
uniform int uCount;

// Livello base: dove c'è la persona, l'immagine è divisa in sezioni irregolari con ritardi diversi.
uniform sampler2D uMask;    // maschera della persona (riga 0 = alto)
uniform float uAspect;      // larghezza / altezza del video
uniform float uCellSize;    // lato delle sezioni più grandi, in frazione della larghezza
uniform float uSplit;       // probabilità che una sezione si divida in due (fino a 3 volte)
uniform float uSlit;        // quota di sezioni con il ritardo a strisce ("slit-scan")
uniform float uJitter;      // quota di sezioni anche un po' spostate
uniform float uBaseDelay;   // ritardo massimo delle sezioni, in fotogrammi
uniform float uLiveShare;   // quota di sezioni che restano nel presente
uniform float uShuffle;     // quante volte al secondo (in media) una sezione cambia
uniform float uTime;
uniform float uNewest;      // indice del fotogramma più recente nella storia
uniform float uFrames;      // quanti fotogrammi ci sono nella storia

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

// Persona "allargata": il massimo della maschera su qualche punto vicino. Così le sezioni
// coprono anche il punto dove la persona era un attimo fa, e i pezzi in ritardo restano visibili.
float personNear(vec2 uv) {
  vec2 m = vec2(uv.x, 1.0 - uv.y);
  float d = 0.05;
  float v = texture(uMask, m).r;
  v = max(v, texture(uMask, m + vec2(d, 0.0)).r);
  v = max(v, texture(uMask, m - vec2(d, 0.0)).r);
  v = max(v, texture(uMask, m + vec2(0.0, d)).r);
  v = max(v, texture(uMask, m - vec2(0.0, d)).r);
  return v;
}

vec3 history(vec2 uv, float delay) {
  float layer = mod(uNewest - delay + uFrames * 2.0, uFrames);
  return texture(uHistory, vec3(clamp(uv, 0.0, 1.0), layer)).rgb;
}

void main() {
  vec3 color = texture(uVideo, vUv).rgb;

  if (personNear(vUv) > 0.3) {
    // Griglia fissa nell'immagine (non agganciata al corpo), con sezioni di dimensioni miste:
    // ogni sezione può dividersi a metà in orizzontale o in verticale, fino a tre volte.
    vec2 size = vec2(uCellSize, uCellSize * uAspect); // sezioni quadrate in pixel
    vec2 cell = floor(vUv / size);
    // Ogni sezione grande cambia per conto suo, a un ritmo suo.
    float rate = uShuffle * (0.5 + hash12(cell + 5.5));
    float epoch = floor(uTime * rate + hash12(cell) * 9.0);
    for (int level = 0; level < 3; level++) {
      float r = hash12(cell + vec2(float(level) * 31.0, epoch));
      if (r >= uSplit) break;
      if (r < uSplit * 0.5) size.x *= 0.5; else size.y *= 0.5;
      cell = floor(vUv / size);
    }
    vec2 local = fract(vUv / size); // posizione dentro la sezione, 0..1

    float roll = hash12(cell * 1.37 + epoch);
    if (roll >= uLiveShare) {
      float t = (roll - uLiveShare) / max(1.0 - uLiveShare, 1e-3);
      float delay = floor(mix(2.0, max(uBaseDelay, 2.0), t));

      // Slit-scan: dentro la sezione il ritardo cambia a strisce, così un pezzo di corpo
      // in movimento si "allunga" e si spezza invece di restare un blocco intero.
      float slit = hash12(cell + epoch + 41.0);
      if (slit < uSlit) {
        float strip = slit < uSlit * 0.5 ? local.x : local.y;
        delay = floor(mix(1.0, delay, floor(strip * 5.0) / 4.0));
      }

      // Alcune sezioni prendono l'immagine anche da un punto un po' spostato.
      vec2 offset = vec2(0.0);
      if (hash12(cell + epoch + 59.0) < uJitter) {
        offset = (vec2(hash12(cell + epoch + 61.0), hash12(cell + epoch + 67.0)) - 0.5) * size * 1.2;
      }
      color = history(vUv + offset, delay);
    }
  }

  // I rettangoli si sovrappongono: vince l'ultimo.
  for (int i = 0; i < ${MAX_BLOCKS}; i++) {
    if (i >= uCount) break;
    vec4 r = uRects[i];
    if (vUv.x >= r.x && vUv.x < r.z && vUv.y >= r.y && vUv.y < r.w) {
      vec4 info = uInfo[i];
      color = texture(uHistory, vec3(clamp(vUv + info.yz, 0.0, 1.0), info.x)).rgb;
    }
  }
  outColor = vec4(color, 1.0);
}`;

/** Parametri, con lo schema per gli slider del pannello debug. */
export const TIMEBLOCKS_SCHEMA = [
  { group: 'Time blocks on person (base)' },
  { key: 'cellSize', label: 'Large section size', min: 0.02, max: 0.4, step: 0.01, value: 0.12 },
  { key: 'split', label: 'Split amount (smaller sections)', min: 0, max: 1, step: 0.01, value: 0.65 },
  { key: 'slit', label: 'Slit-scan sections share', min: 0, max: 1, step: 0.01, value: 0.35 },
  { key: 'jitter', label: 'Shifted sections share', min: 0, max: 1, step: 0.01, value: 0.25 },
  { key: 'baseDelay', label: 'Max delay (frames)', min: 2, max: HISTORY_FRAMES - 1, step: 1, value: 10 },
  { key: 'baseDelayHand', label: 'Extra delay at full intensity', min: 0, max: HISTORY_FRAMES - 1, step: 1, value: 14 },
  { key: 'liveShare', label: 'Live sections share', min: 0, max: 1, step: 0.01, value: 0.2 },
  { key: 'shuffle', label: 'Changes per second (per section)', min: 0, max: 4, step: 0.05, value: 1.2 },

  { group: 'Scattered time blocks' },
  { key: 'rate', label: 'Blocks per second', min: 0, max: 20, step: 0.5, value: 6 },
  { key: 'maxBlocks', label: 'Max blocks at once', min: 0, max: MAX_BLOCKS, step: 1, value: 8 },
  { key: 'minSize', label: 'Min size', min: 0.02, max: 0.5, step: 0.01, value: 0.08 },
  { key: 'maxSize', label: 'Max size', min: 0.05, max: 0.8, step: 0.01, value: 0.3 },
  { key: 'maxDelay', label: 'Max delay (frames)', min: 2, max: HISTORY_FRAMES - 1, step: 1, value: 24 },
  { key: 'freezeChance', label: 'Frozen blocks share', min: 0, max: 1, step: 0.01, value: 0.4 },
  { key: 'offsetChance', label: 'Offset blocks share', min: 0, max: 1, step: 0.01, value: 0.3 },
  { key: 'life', label: 'Average life (s)', min: 0.1, max: 2, step: 0.05, value: 0.6 },
];

export class TimeBlocks {
  /** @param {import('./gl.js').Renderer} renderer */
  constructor(renderer) {
    this.name = 'timeblocks';
    this.schema = TIMEBLOCKS_SCHEMA;
    this.params = Object.fromEntries(TIMEBLOCKS_SCHEMA.filter((p) => p.key).map((p) => [p.key, p.value]));

    this.renderer = renderer;
    this.gl = renderer.gl;
    this.copy = renderer.createProgram(COPY_FRAG);
    this.compose = renderer.createProgram(COMPOSE_FRAG);
    this.framebuffer = this.gl.createFramebuffer();

    this.history = null; // texture array con gli ultimi fotogrammi
    this.historySize = [0, 0];
    this.head = 0; // dove scriveremo il prossimo fotogramma
    this.stored = 0; // quanti fotogrammi validi ci sono
    this.output = null; // immagine composta, a risoluzione piena del video
    this.outputSize = [0, 0];

    this.blocks = [];
    this.spawnDebt = 0;
    this.intensity = 0;
    this.time = 0;
    this.rectData = new Float32Array(MAX_BLOCKS * 4);
    this.infoData = new Float32Array(MAX_BLOCKS * 4);
  }

  /** L'immagine da usare al posto del video (null finché non è pronta). */
  get texture() {
    return this.stored > 0 ? this.output : null;
  }

  /** Quanti blocchi sono visibili (per il pannello debug). */
  get count() {
    return this.blocks.length;
  }

  reset() {
    this.stored = 0;
    this.head = 0;
    this.blocks = [];
  }

  /**
   * Da chiamare a ogni frame, dopo renderer.uploadVideo().
   * @param {number} dt secondi
   * @param {number} intensity 0..1
   * @param {{x0:number,y0:number,x1:number,y1:number}|null} bbox persona in coordinate video (y in basso)
   * @param {boolean} newFrame true se la webcam ha prodotto un fotogramma nuovo
   */
  update(dt, intensity, bbox, newFrame) {
    const [videoW, videoH] = this.renderer.videoSize;
    if (videoW <= 1) return;
    this.allocate(videoW, videoH);
    if (newFrame || this.stored === 0) this.storeFrame();
    this.intensity = intensity;
    this.time += dt;
    this.updateBlocks(dt, intensity, bbox);
    this.composeOutput();
  }

  allocate(videoW, videoH) {
    const gl = this.gl;
    const scale = Math.min(1, HISTORY_MAX_WIDTH / videoW);
    const hw = Math.round(videoW * scale);
    const hh = Math.round(videoH * scale);
    if (hw !== this.historySize[0] || hh !== this.historySize[1]) {
      if (this.history) gl.deleteTexture(this.history);
      this.history = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.history);
      gl.texStorage3D(gl.TEXTURE_2D_ARRAY, 1, gl.RGBA8, hw, hh, HISTORY_FRAMES);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      this.historySize = [hw, hh];
      this.reset();
    }
    if (videoW !== this.outputSize[0] || videoH !== this.outputSize[1]) {
      if (this.output) gl.deleteTexture(this.output);
      this.output = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.output);
      gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, videoW, videoH);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      this.outputSize = [videoW, videoH];
    }
  }

  /** Copia il fotogramma corrente nella storia. */
  storeFrame() {
    const gl = this.gl;
    gl.useProgram(this.copy.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.renderer.videoTexture);
    gl.uniform1i(this.copy.uniforms.uVideo, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    gl.viewport(0, 0, this.historySize[0], this.historySize[1]);

    // Il primo fotogramma riempie tutta la storia, così i ritardi non mostrano mai il nero.
    const layers = this.stored === 0 ? [...Array(HISTORY_FRAMES).keys()] : [this.head];
    for (const layer of layers) {
      gl.framebufferTextureLayer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, this.history, 0, layer);
      this.renderer.drawQuad();
    }
    this.restoreScreen();

    this.head = (this.head + 1) % HISTORY_FRAMES;
    this.stored = this.stored === 0 ? HISTORY_FRAMES : Math.min(this.stored + 1, HISTORY_FRAMES);
  }

  /** Indice nella storia del fotogramma di `delay` fotogrammi fa. */
  layerAgo(delay) {
    return (this.head - 1 - delay + HISTORY_FRAMES * 2) % HISTORY_FRAMES;
  }

  updateBlocks(dt, intensity, bbox) {
    const p = this.params;

    // Invecchiamento: i blocchi finiti spariscono.
    for (const block of this.blocks) block.life -= dt;
    this.blocks = this.blocks.filter((block) => block.life > 0);

    // Nascita: più frequente con l'intensità, ma qualche blocco c'è sempre (si vede solo muovendosi).
    this.spawnDebt += p.rate * (0.2 + 0.8 * intensity) * dt;
    while (this.spawnDebt >= 1) {
      this.spawnDebt -= 1;
      if (this.blocks.length < p.maxBlocks) this.blocks.push(this.createBlock(bbox));
    }
  }

  createBlock(bbox) {
    const p = this.params;
    const rand = Math.random;
    const lerp = (a, b, t) => a + (b - a) * t;

    // Dimensioni: per lo più rettangoli medi, a volte strisce strette e alte (come nel collo del riferimento).
    let w = lerp(p.minSize, p.maxSize, Math.pow(rand(), 1.5));
    let h = lerp(p.minSize * 0.6, p.maxSize * 0.8, Math.pow(rand(), 1.5));
    if (rand() < 0.25) {
      w *= 0.4;
      h *= 1.8;
    }

    // Centro dentro la persona (un po' allargata); senza persona, nella parte centrale dell'immagine.
    // bbox è in coordinate video con y verso il basso; le UV della texture hanno v verso l'alto.
    const area = bbox
      ? { x0: bbox.x0 - 0.05, x1: bbox.x1 + 0.05, y0: 1 - bbox.y1 - 0.05, y1: 1 - bbox.y0 + 0.05 }
      : { x0: 0.2, x1: 0.8, y0: 0.2, y1: 0.8 };
    const cx = lerp(area.x0, area.x1, rand());
    const cy = lerp(area.y0, area.y1, rand());
    // Bordi agganciati a una griglia di 1/64: rettangoli puliti, allineati tra loro.
    const snap = (v) => Math.min(1, Math.max(0, Math.round(v * 64) / 64));

    const delay = Math.round(lerp(3, Math.max(3, p.maxDelay), rand()));
    const frozen = rand() < p.freezeChance;
    const shifted = rand() < p.offsetChance;
    return {
      x0: snap(cx - w / 2),
      x1: snap(cx + w / 2),
      y0: snap(cy - h / 2),
      y1: snap(cy + h / 2),
      delay,
      // Un blocco congelato resta sul fotogramma in cui è nato: deve sparire prima che la storia lo sovrascriva.
      frozenLayer: frozen ? this.layerAgo(delay) : -1,
      life: frozen ? Math.min(p.life * (0.5 + rand()), 0.8) : p.life * (0.5 + rand()),
      ox: shifted ? (rand() - 0.5) * 0.08 : 0,
      oy: shifted ? (rand() - 0.5) * 0.05 : 0,
    };
  }

  composeOutput() {
    const gl = this.gl;
    const n = Math.min(this.blocks.length, MAX_BLOCKS);
    for (let i = 0; i < n; i++) {
      const b = this.blocks[i];
      this.rectData.set([b.x0, b.y0, b.x1, b.y1], i * 4);
      const layer = b.frozenLayer >= 0 ? b.frozenLayer : this.layerAgo(Math.min(b.delay, this.stored - 1));
      this.infoData.set([layer, b.ox, b.oy, 0], i * 4);
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.output, 0);
    gl.viewport(0, 0, this.outputSize[0], this.outputSize[1]);
    const { program, uniforms } = this.compose;
    gl.useProgram(program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.renderer.videoTexture);
    gl.uniform1i(uniforms.uVideo, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.history);
    gl.uniform1i(uniforms.uHistory, 1);
    gl.uniform4fv(uniforms['uRects[0]'], this.rectData);
    gl.uniform4fv(uniforms['uInfo[0]'], this.infoData);
    gl.uniform1i(uniforms.uCount, n);
    const p = this.params;
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.renderer.maskTexture);
    gl.uniform1i(uniforms.uMask, 2);
    gl.uniform1f(uniforms.uAspect, this.outputSize[0] / this.outputSize[1]);
    gl.uniform1f(uniforms.uCellSize, p.cellSize);
    gl.uniform1f(uniforms.uSplit, p.split);
    gl.uniform1f(uniforms.uSlit, p.slit);
    gl.uniform1f(uniforms.uJitter, p.jitter);
    gl.uniform1f(uniforms.uBaseDelay, Math.min(p.baseDelay + p.baseDelayHand * this.intensity, this.stored - 1));
    gl.uniform1f(uniforms.uLiveShare, p.liveShare);
    gl.uniform1f(uniforms.uShuffle, p.shuffle);
    gl.uniform1f(uniforms.uTime, this.time);
    gl.uniform1f(uniforms.uNewest, this.layerAgo(0));
    gl.uniform1f(uniforms.uFrames, HISTORY_FRAMES);
    this.renderer.drawQuad();
    this.restoreScreen();
  }

  restoreScreen() {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.renderer.canvas.width, this.renderer.canvas.height);
  }
}
