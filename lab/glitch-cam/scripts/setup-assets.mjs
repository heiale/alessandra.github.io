// Prepara i file che MediaPipe carica a runtime, così l'app li serve da sé
// e il browser non deve contattare CDN esterne.
//   - wasm: copiati da node_modules
//   - modelli (mano, segmentazione della persona): scaricati una volta da Google, solo se mancano
import { copyFile, mkdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const wasmSrc = join(root, 'node_modules/@mediapipe/tasks-vision/wasm');
const wasmDest = join(root, 'public/mediapipe/wasm');
const modelsDest = join(root, 'public/models');
const MODELS_URL = 'https://storage.googleapis.com/mediapipe-models/';
const MODELS = {
  'hand_landmarker.task': 'hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
  'selfie_segmenter.tflite': 'image_segmenter/selfie_segmenter/float16/1/selfie_segmenter.tflite',
};

// Solo i file del loader "classico" (SIMD + fallback senza SIMD), gli unici usati da forVisionTasks().
const WASM_FILES = [
  'vision_wasm_internal.js',
  'vision_wasm_internal.wasm',
  'vision_wasm_nosimd_internal.js',
  'vision_wasm_nosimd_internal.wasm',
];

async function exists(path) {
  try {
    return (await stat(path)).size > 0;
  } catch {
    return false;
  }
}

await mkdir(wasmDest, { recursive: true });
for (const file of WASM_FILES) {
  await copyFile(join(wasmSrc, file), join(wasmDest, file));
}

await mkdir(modelsDest, { recursive: true });
for (const [file, remotePath] of Object.entries(MODELS)) {
  const dest = join(modelsDest, file);
  if (await exists(dest)) continue;
  try {
    console.log(`[setup-assets] Scarico ${file}…`);
    const res = await fetch(MODELS_URL + remotePath);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await writeFile(dest, Buffer.from(await res.arrayBuffer()));
    console.log(`[setup-assets] ${file} salvato in public/models/`);
  } catch (err) {
    // Non blocchiamo dev/build: a runtime src/mediapipe.js ripiega sull'URL remoto del modello.
    console.warn(`[setup-assets] Download di ${file} non riuscito (${err.message}).`);
  }
}
