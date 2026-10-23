// Effetto glitch. Ogni effetto espone la stessa interfaccia:
//   name, params (valori correnti), schema (per gli slider del debug),
//   init(renderer), update(state, dt), render(), dispose()
// `renderer` (gl.js) dà accesso a `gl`, al quad a schermo intero e alle texture di video e maschera.
// `state` è condiviso fra tutti gli effetti: { time, intensity, hand, debug }.

import fragmentSource from './glitch.frag.glsl?raw';

/** Parametri regolabili. `value` è il default; gli slider del debug li modificano in tempo reale. */
export const GLITCH_SCHEMA = [
  { group: 'RGB split' },
  { key: 'rgbShift', label: 'Channel shift', min: 0, max: 0.05, step: 0.001, value: 0.003 },

  { group: 'Moved pieces' },
  { key: 'pieceAmount', label: 'Piece distance', min: 0, max: 0.4, step: 0.005, value: 0.25 },
  { key: 'pieceDensity', label: 'Moved pieces share', min: 0, max: 1, step: 0.01, value: 0.7 },
  { key: 'edgeBreak', label: 'Broken edges', min: 0, max: 1, step: 0.01, value: 0.6 },

  { group: 'Slices' },
  { key: 'sliceAmount', label: 'Max shift', min: 0, max: 0.3, step: 0.005, value: 0.15 },
  { key: 'sliceCount', label: 'Slice count', min: 4, max: 120, step: 1, value: 36 },
  { key: 'sliceSpeed', label: 'Changes per second', min: 1, max: 30, step: 1, value: 12 },
  { key: 'sliceDensity', label: 'Active slices share', min: 0, max: 1, step: 0.01, value: 0.35 },

  { group: 'Pixels' },
  { key: 'pixelSize', label: 'Pixel size (px)', min: 2, max: 64, step: 1, value: 18 },
  { key: 'pixelDensity', label: 'Pixelated zones share', min: 0, max: 1, step: 0.01, value: 0.6 },
  { key: 'smear', label: 'Smeared zones share', min: 0, max: 1, step: 0.01, value: 0.3 },
  { key: 'posterize', label: 'Color levels (32 = off)', min: 2, max: 32, step: 1, value: 32 },
  { key: 'patchiness', label: 'Patchiness', min: 0, max: 1, step: 0.01, value: 0.7 },

  { group: 'Grain and scanlines' },
  { key: 'grain', label: 'Grain', min: 0, max: 0.4, step: 0.005, value: 0.04 },
  { key: 'scanlines', label: 'Scanlines', min: 0, max: 0.6, step: 0.01, value: 0.06 },
  { key: 'scanlineSpacing', label: 'Scanline spacing (px)', min: 2, max: 10, step: 0.5, value: 3 },

  { group: 'Frame glitch' },
  { key: 'burstRate', label: 'Rate (per second)', min: 0, max: 3, step: 0.05, value: 0.6 },
  { key: 'burstStrength', label: 'Strength', min: 0, max: 1.5, step: 0.05, value: 1 },
  { key: 'burstDuration', label: 'Duration (ms)', min: 40, max: 400, step: 10, value: 140 },

  { group: 'Person mask' },
  { key: 'maskThreshold', label: 'Person threshold', min: 0.05, max: 0.95, step: 0.01, value: 0.5 },
  { key: 'maskFeather', label: 'Edge softness', min: 0, max: 0.5, step: 0.01, value: 0.15 },
];

export function createGlitchEffect() {
  const params = Object.fromEntries(GLITCH_SCHEMA.filter((p) => p.key).map((p) => [p.key, p.value]));

  let renderer;
  let gl;
  let program;
  let uniforms;
  let time = 0;
  let intensity = 0;
  let showMask = false;

  // Stato del "frame glitch" a scatti.
  let burstLeft = 0; // secondi rimanenti
  let burstSeed = 0;
  let seedTimer = 0;

  return {
    name: 'glitch',
    schema: GLITCH_SCHEMA,
    params,

    init(r) {
      renderer = r;
      gl = r.gl;
      ({ program, uniforms } = r.createProgram(fragmentSource));
    },

    update(state, dt) {
      time = state.time;
      intensity = state.intensity;
      showMask = Boolean(state.debug?.showMask);

      if (burstLeft > 0) {
        burstLeft -= dt;
        // Durante il burst il seme cambia ogni ~50 ms: l'immagine "salta" invece di animarsi fluida.
        seedTimer -= dt;
        if (seedTimer <= 0) {
          burstSeed = Math.random() * 100;
          seedTimer = 0.05;
        }
      } else {
        // Probabilità di un burst in questo frame. Cresce più che linearmente con l'intensità:
        // a pugno chiuso i burst praticamente spariscono, a mano aperta arrivano spesso.
        const rate = params.burstRate * Math.pow(intensity, 1.5);
        if (Math.random() < rate * dt) {
          burstLeft = (params.burstDuration / 1000) * (0.5 + Math.random());
          seedTimer = 0;
        }
      }
    },

    render() {
      const { scale, offset } = renderer.coverTransform();
      const dpr = renderer.canvas.width / Math.max(renderer.canvas.clientWidth, 1);
      const burst = burstLeft > 0 ? params.burstStrength : 0;

      gl.useProgram(program);
      gl.activeTexture(gl.TEXTURE0);
      // Immagine di partenza: il video con i blocchi nel tempo (timeblocks.js), o il video vero.
      gl.bindTexture(gl.TEXTURE_2D, renderer.source?.texture ?? renderer.videoTexture);
      gl.uniform1i(uniforms.uVideo, 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, renderer.maskTexture);
      gl.uniform1i(uniforms.uMask, 1);
      // Lastra dello sfondo (background.js): quello che si vede nei buchi lasciati dai pezzi.
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, renderer.background?.texture ?? null);
      gl.uniform1i(uniforms.uBackground, 2);
      gl.uniform2f(uniforms.uCoverScale, scale[0], scale[1]);
      gl.uniform2f(uniforms.uCoverOffset, offset[0], offset[1]);
      gl.uniform1f(uniforms.uTime, time);
      gl.uniform1f(uniforms.uIntensity, intensity);
      gl.uniform1f(uniforms.uBurst, burst);
      gl.uniform1f(uniforms.uBurstSeed, burstSeed);
      gl.uniform1f(uniforms.uRgbShift, params.rgbShift);
      gl.uniform1f(uniforms.uSliceAmount, params.sliceAmount);
      gl.uniform1f(uniforms.uSliceCount, params.sliceCount);
      gl.uniform1f(uniforms.uSliceSpeed, params.sliceSpeed);
      gl.uniform1f(uniforms.uSliceDensity, params.sliceDensity);
      gl.uniform2f(uniforms.uResolution, renderer.canvas.width, renderer.canvas.height);
      // Dimensione in pixel CSS convertita in pixel del canvas: stessa resa anche sugli schermi retina.
      gl.uniform1f(uniforms.uPixelSize, params.pixelSize * dpr);
      gl.uniform1f(uniforms.uPixelDensity, params.pixelDensity);
      gl.uniform1f(uniforms.uPosterize, params.posterize);
      gl.uniform1f(uniforms.uPatchiness, params.patchiness);
      gl.uniform1f(uniforms.uSmear, params.smear);
      gl.uniform1f(uniforms.uGrain, params.grain);
      gl.uniform1f(uniforms.uScanlines, params.scanlines);
      // Il passo è in pixel CSS: lo convertiamo in pixel del canvas, così non cambia sugli schermi retina.
      gl.uniform1f(uniforms.uScanlineSpacing, params.scanlineSpacing * dpr);
      gl.uniform1f(uniforms.uMaskThreshold, params.maskThreshold);
      gl.uniform1f(uniforms.uMaskFeather, params.maskFeather);
      gl.uniform1f(uniforms.uPieceAmount, params.pieceAmount);
      gl.uniform1f(uniforms.uPieceDensity, params.pieceDensity);
      gl.uniform1f(uniforms.uEdgeBreak, params.edgeBreak);
      gl.uniform1f(uniforms.uShowMask, showMask ? 1 : 0);
      renderer.drawQuad();
    },

    dispose() {
      gl?.deleteProgram(program);
    },
  };
}
