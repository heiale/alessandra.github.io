// Carta con la risposta dell'AI: fronte "Thinking" mentre aspetta, poi si gira sul risultato.
// params: { word, image, token, timeUsed } dalla schermata di disegno.
// Senza token (solo in sviluppo, es. #reveal?guess=pear) usa un risultato finto.
import { api, friendlyError } from '../api.js';
import { scoreTurn, startAiRound } from '../flow.js';
import { button, card, cardScreen, flipCard, nextCardNo, photo, withDots } from '../ui/card.js';
import * as art from '../ui/illustrations.js';

const LABEL = "AI's guess";

export function render(root, { go, state, params }) {
  const word = params.word ?? 'apple';
  const no = nextCardNo(state);
  let alive = true;

  const { screen, stack, actions } = cardScreen('reveal');
  stack.setAttribute('aria-live', 'polite');

  const front = withDots(
    card({ no, label: LABEL, title: 'Thinking', subtitle: 'The AI is looking at your drawing.', tone: 'grey', art: art.thinking() }),
  );
  const flip = flipCard(front);
  stack.append(flip.el);
  root.append(screen);

  let pending;
  if (params.image === null) pending = Promise.resolve({ empty: true }); // tempo scaduto a canvas vuota
  else if (params.token) pending = api('guess', { image: params.image, token: params.token });
  else pending = demoResult(word, params);

  pending
    .then((r) => resultCard(no, word, r, params))
    .catch((err) => {
      console.warn('[reveal]', err);
      return {
        card: card({ no, label: LABEL, title: 'No guess this time', subtitle: `${friendlyError(err)} This round won't count.`, tone: 'grey', art: art.offline() }),
        record: scoreTurn({ kind: 'draw', word, success: false, error: true }),
      };
    })
    .then(async ({ card: back, record }) => {
      if (!alive) return;
      await flip.flip(back);
      if (!alive) return;
      state.history.push(record);
      const next = button('Next: the AI draws', { onClick: () => startAiRound(go, state) });
      actions.classList.add('is-entering');
      actions.append(next);
      next.focus({ preventScroll: true });
    });

  return () => {
    alive = false;
  };
}

function resultCard(no, word, r, { image, timeUsed }) {
  const record = (success) => scoreTurn({ kind: 'draw', word, success, elapsed: timeUsed });

  if (r.empty) {
    return {
      card: card({ no, label: LABEL, title: "Time's up", subtitle: 'Nothing on the canvas, so no guess this round.', tone: 'grey', art: art.skip() }),
      record: record(false),
    };
  }
  // Disegno rifiutato: messaggio neutro, niente immagine, niente punti.
  if (r.refused) {
    return {
      card: card({ no, label: LABEL, title: "Let's skip this one", subtitle: 'No points this round.', tone: 'grey', art: art.skip() }),
      record: record(false),
    };
  }
  const drawing = image ? photo(image, 'Your drawing') : null;
  if (r.correct) {
    const rec = record(true);
    const bonus = rec.fast ? ' Fast drawing: +1 bonus.' : '';
    return {
      card: card({ no, label: LABEL, title: `“${r.guess}”`, subtitle: `The AI got it: the word was ${word}.${bonus}`, tone: 'green', art: drawing ?? art.correct() }),
      record: rec,
    };
  }
  return {
    card: card({ no, label: LABEL, title: `“${r.guess}”`, subtitle: `Not quite: the word was ${word}.`, tone: 'red', art: drawing ?? art.wrong() }),
    record: record(false),
  };
}

// Risultato finto per provare le carte (es. #reveal?guess=pear oppure #reveal?refused=true).
function demoResult(word, { guess = word, correct, refused } = {}) {
  const isRefused = String(refused) === 'true';
  return new Promise((resolve) =>
    setTimeout(
      () =>
        resolve({
          guess: isRefused ? '' : guess,
          correct: correct != null ? String(correct) === 'true' : guess === word,
          refused: isRefused,
        }),
      1600,
    ),
  );
}
