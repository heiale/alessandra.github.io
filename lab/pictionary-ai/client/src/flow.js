// Ordine dei turni e punteggio. Una partita = PAIRS coppie di turni:
// l'utente disegna (Round A), poi l'AI disegna (Round B). Alla fine il riepilogo.
import { api } from './api.js';

export const PAIRS = 2;

// Punteggio: 1 punto per turno riuscito, +1 se è stato veloce.
// Round A: l'AI indovina un disegno fatto in meno di FAST_MS.
// Round B: l'utente indovina entro FAST_MS dall'inizio dell'animazione.
export const FAST_MS = 20_000;

export function scoreTurn({ kind, word, success, elapsed, error = false }) {
  const fast = success && elapsed != null && elapsed <= FAST_MS;
  return { kind, word, success, fast, error, points: success ? 1 + (fast ? 1 : 0) : 0 };
}

export const roundLabel = (state) => `Round ${Math.min((state.pair ?? 0) + 1, PAIRS)} of ${PAIRS}`;

// Round A: chiede una parola al server, poi la carta che la mostra prima del timer.
export function startUserRound(go, state) {
  go('wait', {
    label: roundLabel(state),
    title: 'Picking a word',
    subtitle: 'Something easy to draw, promise.',
    task: () => api('word', {}, { timeout: 15_000 }),
    next: (r) => go('ready', { word: r.word, category: r.category, token: r.token }),
  });
}

// Round B: l'AI disegna (la chiamata più lenta: fino a tre tentativi sul server).
export function startAiRound(go, state) {
  go('wait', {
    label: roundLabel(state),
    title: 'The AI is drawing',
    subtitle: 'It is sketching something for you to guess.',
    task: () => api('draw', {}, { timeout: 120_000 }),
    next: (r) => go('watch', { strokes: r.strokes, token: r.token, category: r.category }),
    // Se l'AI non riesce a disegnare, il turno si salta senza punti.
    skip: {
      label: 'Skip this turn',
      run: () => {
        state.history.push(scoreTurn({ kind: 'guess', word: '—', success: false, error: true }));
        endPair(go, state);
      },
    },
  });
}

// Fine di una coppia di turni: un'altra coppia o il riepilogo.
export function endPair(go, state) {
  state.pair = (state.pair ?? 0) + 1;
  if (state.pair < PAIRS) startUserRound(go, state);
  else go('summary');
}

export const isLastPair = (state) => (state.pair ?? 0) + 1 >= PAIRS;
