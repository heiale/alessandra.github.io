// Strumenti WebGL condivisi da tutti gli effetti: contesto, shader, quad a schermo intero
// e texture del video. Ogni effetto riceve un'istanza di Renderer in init().

/** Vertex shader comune: un quad che copre tutto lo schermo, con UV 0..1. */
export const FULLSCREEN_VERT = /* glsl */ `#version 300 es
in vec2 aPosition;
out vec2 vUv;
void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

export class Renderer {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{ maxPixelRatio?: number, renderScale?: number }} options
   */
  constructor(canvas, { maxPixelRatio = 2, renderScale = 1 } = {}) {
    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance',
    });
    if (!gl) throw new Error('WebGL2 is not available in this browser.');

    this.canvas = canvas;
    this.gl = gl;
    this.maxPixelRatio = maxPixelRatio;
    // Frazione della risoluzione a cui disegniamo; il browser poi ingrandisce il canvas a tutto schermo.
    // Può essere abbassata durante l'esperienza (quality.js) se gli FPS calano.
    this.renderScale = renderScale;
    this.videoSize = [1, 1];

    // Un solo VAO con due triangoli che coprono lo schermo, riusato da tutti gli effetti.
    this.quad = gl.createVertexArray();
    gl.bindVertexArray(this.quad);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    // Texture in cui copiamo il frame della webcam a ogni fotogramma.
    this.videoTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.videoTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    // CLAMP: gli spostamenti del glitch che escono dal bordo ripetono l'ultimo pixel invece di avvolgersi.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // Maschera della persona (un canale, 0..255). Finché la segmentazione non è pronta, o se non
    // parte, vale 255 ovunque: gli effetti si comportano come se tutta l'immagine fosse "persona".
    this.maskTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.maskTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.resetMask();
  }

  /** Riporta la maschera a "tutto persona". */
  resetMask() {
    this.uploadMask(new Uint8Array([255]), 1, 1);
  }

  /**
   * Carica la maschera della persona. Riga 0 = alto dell'immagine (non la capovolgiamo:
   * lo shader legge la maschera con la y invertita rispetto al video).
   */
  uploadMask(data, width, height) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.maskTexture);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1); // righe da 1 byte per pixel, non allineate a 4
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, width, height, 0, gl.RED, gl.UNSIGNED_BYTE, data);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
  }

  /** Adatta il canvas alla finestra. Restituisce true se la dimensione è cambiata. */
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, this.maxPixelRatio) * this.renderScale;
    const width = Math.round(this.canvas.clientWidth * dpr);
    const height = Math.round(this.canvas.clientHeight * dpr);
    if (this.canvas.width === width && this.canvas.height === height) return false;
    this.canvas.width = width;
    this.canvas.height = height;
    this.gl.viewport(0, 0, width, height);
    return true;
  }

  /**
   * Copia il fotogramma corrente del video nella texture.
   * Restituisce true se la webcam ha prodotto un fotogramma nuovo dall'ultima chiamata.
   */
  uploadVideo(video) {
    if (video.readyState < video.HAVE_CURRENT_DATA) return false;
    const isNew = video.currentTime !== this.lastVideoTime;
    this.lastVideoTime = video.currentTime;
    const gl = this.gl;
    this.videoSize = [video.videoWidth, video.videoHeight];
    gl.bindTexture(gl.TEXTURE_2D, this.videoTexture);
    // Flip Y: nel video la riga 0 è in alto, in WebGL la coordinata v=0 è in basso.
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    return isNew;
  }

  /**
   * Trasformazione "cover": il video riempie lo schermo mantenendo le proporzioni (ritagliando i bordi).
   * Restituisce scala e offset da applicare alle UV dello schermo per ottenere le UV del video.
   * La stessa trasformazione è usata da ui.js per disegnare i landmark nello stesso punto.
   */
  coverTransform() {
    return coverTransform(this.canvas.width, this.canvas.height, this.videoSize[0], this.videoSize[1]);
  }

  /** Compila e collega un programma; lancia un errore leggibile se qualcosa non compila. */
  createProgram(fragmentSource, vertexSource = FULLSCREEN_VERT) {
    const gl = this.gl;
    const vs = compile(gl, gl.VERTEX_SHADER, vertexSource);
    const fs = compile(gl, gl.FRAGMENT_SHADER, fragmentSource);
    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.bindAttribLocation(program, 0, 'aPosition');
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(`Shader link failed: ${gl.getProgramInfoLog(program)}`);
    }
    gl.deleteShader(vs);
    gl.deleteShader(fs);

    // Mappa nome → location di tutte le uniform attive, così gli effetti non devono cercarle a mano.
    const uniforms = {};
    const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < count; i++) {
      const { name } = gl.getActiveUniform(program, i);
      uniforms[name] = gl.getUniformLocation(program, name);
    }
    return { program, uniforms };
  }

  drawQuad() {
    const gl = this.gl;
    gl.bindVertexArray(this.quad);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.bindVertexArray(null);
  }
}

export function coverTransform(screenW, screenH, videoW, videoH) {
  const screenAspect = screenW / screenH;
  const videoAspect = videoW / videoH;
  let scaleX = 1;
  let scaleY = 1;
  if (screenAspect > videoAspect) {
    // Schermo più largo del video: usiamo tutta la larghezza e tagliamo sopra/sotto.
    scaleY = videoAspect / screenAspect;
  } else {
    // Schermo più alto (es. telefono in verticale): tagliamo ai lati.
    scaleX = screenAspect / videoAspect;
  }
  return { scale: [scaleX, scaleY], offset: [(1 - scaleX) / 2, (1 - scaleY) / 2] };
}

/**
 * Punto in coordinate del video (0..1, y verso il basso, come i landmark di MediaPipe) →
 * pixel del canvas (y verso il basso), tenendo conto dello specchio e del ritaglio "cover".
 * È l'inversa della mappatura usata negli shader.
 */
export function videoToScreen(p, screenW, screenH, videoW, videoH) {
  const { scale, offset } = coverTransform(screenW, screenH, videoW, videoH);
  return [(1 - (p.x - offset[0]) / scale[0]) * screenW, ((p.y - offset[1]) / scale[1]) * screenH];
}

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compilation failed:\n${log}`);
  }
  return shader;
}
