// Lista di parole curata a mano, per categoria. L'AI non sceglie mai liberamente cosa disegnare:
// sia nel turno dell'utente sia in quello dell'AI la parola viene da qui.
// Criteri: cose concrete e quotidiane, riconoscibili con pochi tratti, niente di ambiguo o sensibile.
// Da rivedere a mano: togliere quelle che l'AI disegna in modo illeggibile (vedi PLAN.md, sez. 11).
import { randomInt } from 'node:crypto';

export const WORDS = {
  animals: [
    'cat', 'dog', 'fish', 'bird', 'snake', 'spider', 'snail', 'turtle', 'rabbit', 'mouse',
    'elephant', 'giraffe', 'lion', 'pig', 'cow', 'horse', 'duck', 'owl', 'penguin', 'frog',
    'butterfly', 'bee', 'octopus', 'whale', 'crab', 'shark', 'bat', 'sheep', 'chicken', 'ladybug',
    'hedgehog', 'jellyfish',
  ],
  food: [
    'apple', 'banana', 'pear', 'cherry', 'strawberry', 'grapes', 'lemon', 'watermelon', 'carrot', 'mushroom',
    'pizza', 'ice cream', 'cake', 'cookie', 'donut', 'egg', 'bread', 'cheese', 'hamburger', 'hot dog',
    'lollipop', 'candy', 'pineapple', 'corn', 'cupcake', 'popcorn', 'sandwich', 'pretzel', 'broccoli', 'avocado',
  ],
  objects: [
    'house', 'car', 'bicycle', 'boat', 'airplane', 'train', 'rocket', 'umbrella', 'chair', 'table',
    'lamp', 'clock', 'key', 'glasses', 'hat', 'shoe', 'sock', 'shirt', 'book', 'pencil',
    'scissors', 'cup', 'bottle', 'spoon', 'fork', 'candle', 'balloon', 'kite', 'guitar', 'drum',
    'camera', 'phone', 'television', 'computer', 'light bulb', 'ladder', 'bucket', 'envelope', 'crown', 'anchor',
    'bell', 'star', 'heart', 'moon', 'sun', 'cloud', 'rainbow', 'snowman', 'tree', 'flower',
    'leaf', 'cactus', 'mountain', 'door', 'window', 'tent', 'backpack', 'toothbrush', 'magnet', 'hammer',
  ],
  places: [
    'beach', 'island', 'castle', 'lighthouse', 'bridge', 'volcano', 'desert', 'forest', 'city', 'farm',
    'igloo', 'pyramid', 'waterfall', 'river', 'garden', 'playground', 'windmill', 'skyscraper', 'cave', 'harbor',
  ],
  actions: [
    'swimming', 'running', 'jumping', 'sleeping', 'fishing', 'skiing', 'reading', 'cooking', 'dancing', 'singing',
    'flying', 'climbing', 'skating', 'surfing', 'painting', 'raining', 'snowing', 'waving', 'eating', 'juggling',
  ],
};

export const ALL_WORDS = Object.entries(WORDS).flatMap(([category, words]) =>
  words.map((word) => ({ word, category })),
);

// Parola a caso (crypto.randomInt per non avere sequenze prevedibili), evitando quelle in `exclude`.
export function pickWord(exclude = []) {
  const skip = new Set(exclude);
  const pool = ALL_WORDS.filter((w) => !skip.has(w.word));
  const list = pool.length ? pool : ALL_WORDS;
  return list[randomInt(list.length)];
}
