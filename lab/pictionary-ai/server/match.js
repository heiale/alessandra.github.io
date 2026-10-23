// Confronto tollerante fra una risposta e la parola giusta (usato da /api/guess e /api/check).
// Regole (PLAN.md sez. 5): minuscolo, trim, niente articoli né punteggiatura, plurale semplice
// (s/es), distanza di Levenshtein ≤ 1 per parole con più di 4 lettere. Lo scambio di due lettere
// vicine ("bicylce") conta come un solo errore (distanza di Damerau).

const ARTICLES = new Set(['a', 'an', 'the']);

export function normalize(text) {
  return String(text ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}/gu, '') // accenti (segni combinati dopo NFKD)
    .replace(/[^a-z\s-]/g, ' ')
    .replace(/-/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !ARTICLES.has(w))
    .join(' ');
}

// Forme singolari possibili di una parola (o frase: si guarda l'ultima parola).
function singulars(phrase) {
  const forms = new Set([phrase]);
  if (phrase.endsWith('es')) forms.add(phrase.slice(0, -2));
  if (phrase.endsWith('s') && !phrase.endsWith('ss')) forms.add(phrase.slice(0, -1));
  return forms;
}

function distance(a, b) {
  if (a === b) return 0;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

function samePhrase(a, b) {
  for (const x of singulars(a)) {
    for (const y of singulars(b)) {
      if (x === y) return true;
      if (y.replace(/ /g, '').length > 4 && distance(x, y) <= 1) return true;
    }
  }
  // "hotdog" e "hot dog" sono la stessa risposta
  return a.replace(/ /g, '') === b.replace(/ /g, '');
}

export function isMatch(answer, target) {
  const a = normalize(answer);
  const t = normalize(target);
  if (!a || !t) return false;
  if (samePhrase(a, t)) return true;
  // Bersaglio di una parola sola: vale anche se compare dentro una risposta di due parole
  // (es. "red apple" per "apple"), ma non il contrario.
  if (!t.includes(' ')) {
    const words = a.split(' ');
    if (words.length === 2 && words.some((w) => samePhrase(w, t))) return true;
  }
  return false;
}
