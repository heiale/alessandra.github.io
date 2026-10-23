// "Lastra" dello sfondo: un'immagine dello sfondo senza la persona, imparata nel tempo.
//
// La webcam non vede cosa c'è dietro di noi. Quando il glitch sposta un pezzo della persona,
// nel punto lasciato libero dobbiamo mostrare lo sfondo: lo prendiamo da questa lastra.
// A ogni frame, dove la maschera è sicura che NON c'è la persona, la lastra copia il video;
// spostandosi, la persona "scopre" anche le zone che copriva prima.
// Il canale alpha dice quanto ogni punto è conosciuto (0 = mai visto, 1 = visto).
//
// La lastra è salvata in coordinate del video (non dello schermo), a mezza risoluzione.

const LEARN_FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;          // qui coincide con le UV della texture del video
out vec4 outColor;
uniform sampler2D uVideo;
uniform sampler2D uMask;
uniform sampler2D uPrev;
uniform float uRate;  // quanto velocemente la lastra segue i cambi dello sfondo

// Maschera "allargata": il massimo su alcuni punti vicini. La maschera arriva con un po' di ritardo
// rispetto al video, così evitiamo di stampare nella lastra un alone della persona.
float personNear(vec2 uv) {
  vec2 m = vec2(uv.x, 1.0 - uv.y); // la maschera non è capovolta, il video sì
  float d = 0.025;
  float v = texture(uMask, m).r;
  v = max(v, texture(uMask, m + vec2(d, 0.0)).r);
  v = max(v, texture(uMask, m - vec2(d, 0.0)).r);
  v = max(v, texture(uMask, m + vec2(0.0, d)).r);
  v = max(v, texture(uMask, m - vec2(0.0, d)).r);
  return v;
}

void main() {
  vec4 prev = texture(uPrev, vUv);
  vec3 video = texture(uVideo, vUv).rgb;
  // 1 solo dove siamo sicuri che è sfondo.
  float background = 1.0 - smoothstep(0.1, 0.35, personNear(vUv));
  // Un punto mai visto viene copiato subito; uno già noto si aggiorna piano (luce che cambia ecc.).
  float learn = background * max(uRate, 1.0 - prev.a);
  outColor = vec4(mix(prev.rgb, video, learn), mix(prev.a, 1.0, background));
}`;

export class BackgroundPlate {
  /** @param {import('./gl.js').Renderer} renderer */
  constructor(renderer) {
    this.renderer = renderer;
    this.gl = renderer.gl;
    this.rate = 0.06;
    ({ program: this.program, uniforms: this.uniforms } = renderer.createProgram(LEARN_FRAG));
    this.width = 0;
    this.height = 0;
    this.targets = []; // due texture + framebuffer: si legge da una e si scrive nell'altra
    this.current = 0;
  }

  /** La texture da leggere negli effetti (RGB = sfondo, A = quanto è conosciuto). */
  get texture() {
    return this.targets[this.current]?.texture ?? null;
  }

  /** Dimentica lo sfondo (nuova sessione webcam). */
  reset() {
    const gl = this.gl;
    for (const { framebuffer } of this.targets) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  /** Da chiamare a ogni frame, dopo aver caricato video e maschera. */
  update() {
    const gl = this.gl;
    const [videoW, videoH] = this.renderer.videoSize;
    if (videoW <= 1) return;
    const width = Math.max(1, Math.round(videoW / 2));
    const height = Math.max(1, Math.round(videoH / 2));
    if (width !== this.width || height !== this.height) this.allocate(width, height);

    const read = this.targets[this.current];
    const write = this.targets[1 - this.current];

    gl.bindFramebuffer(gl.FRAMEBUFFER, write.framebuffer);
    gl.viewport(0, 0, width, height);
    gl.useProgram(this.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.renderer.videoTexture);
    gl.uniform1i(this.uniforms.uVideo, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.renderer.maskTexture);
    gl.uniform1i(this.uniforms.uMask, 1);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, read.texture);
    gl.uniform1i(this.uniforms.uPrev, 2);
    gl.uniform1f(this.uniforms.uRate, this.rate);
    this.renderer.drawQuad();

    // Torniamo a disegnare sullo schermo.
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.renderer.canvas.width, this.renderer.canvas.height);
    this.current = 1 - this.current;
  }

  allocate(width, height) {
    const gl = this.gl;
    for (const { texture, framebuffer } of this.targets) {
      gl.deleteTexture(texture);
      gl.deleteFramebuffer(framebuffer);
    }
    this.targets = [0, 1].map(() => {
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const framebuffer = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
      return { texture, framebuffer };
    });
    this.width = width;
    this.height = height;
    this.current = 0;
    this.reset();
  }
}
