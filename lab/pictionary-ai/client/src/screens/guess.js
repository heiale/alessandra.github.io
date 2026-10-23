// Carta per indovinare il disegno dell'AI: un campo di testo, un solo tentativo, poi la carta
// si gira sulla risposta. params: { token, category, startedAt } dalla schermata watch.
// Senza token (solo in sviluppo, es. #guess?word=cat) usa una verifica finta.
import { api, friendlyError } from '../api.js';
import { endPair, isLastPair, scoreTurn } from '../flow.js';
import { button, card, cardScreen, flipCard, h, nextCardNo } from '../ui/card.js';
import * as art from '../ui/illustrations.js';

const MAX_LEN = 30;

// Solo lettere e spazi singoli, massimo 30 caratteri (lo stesso controllo lo rifà il server).
export const cleanAnswer = (s) =>
  s.replace(/[^\p{L} ]/gu, '').replace(/ {2,}/g, ' ').slice(0, MAX_LEN);

export function render(root, { go, state, params }) {
  const no = nextCardNo(state);
  const check = params.token
    ? (answer) => api('check', { token: params.token, answer })
    : demoCheck(params.word ?? 'cat');
  const startedAt = params.startedAt ?? performance.now();
  let alive = true;

  const { screen, stack, actions } = cardScreen('guess');
  stack.setAttribute('aria-live', 'polite');

  const front = card({
    no,
    label: params.category ? `Hint: ${params.category}` : 'Your guess',
    title: 'What did the AI draw?',
    subtitle: 'Type one word. You have one try.',
    tone: 'blue',
    art: art.guess(),
  });
  const flip = flipCard(front);
  stack.append(flip.el);

  const form = h('form', 'guess-form');
  form.noValidate = true;
  const label = h('label', 'sr-only', 'Your guess');
  label.htmlFor = 'guess-input';
  const input = h('input', 'field');
  Object.assign(input, {
    id: 'guess-input',
    name: 'answer',
    type: 'text',
    placeholder: 'Type a word',
    maxLength: MAX_LEN,
    autocomplete: 'off',
    spellcheck: false,
  });
  input.setAttribute('autocapitalize', 'none');
  input.setAttribute('autocorrect', 'off');
  input.setAttribute('enterkeyhint', 'done');
  const submit = button('Guess', { type: 'submit' });
  submit.disabled = true;
  const skip = button('Skip', { variant: 'ghost' });
  form.append(label, input, submit, skip);
  actions.append(form);
  root.append(screen);

  // Telefono: con la tastiera aperta la carta si compatta (niente illustrazione, in alto),
  // così campo e pulsanti restano visibili sopra la tastiera.
  const touch = matchMedia('(pointer: coarse)').matches;
  input.addEventListener('focus', () => {
    if (!touch) return;
    screen.classList.add('is-keyboard');
    // Aspetta che la tastiera finisca di aprirsi, poi porta il campo in vista.
    setTimeout(() => input.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300);
  });
  input.addEventListener('blur', () => screen.classList.remove('is-keyboard'));

  input.addEventListener('input', () => {
    const clean = cleanAnswer(input.value);
    if (clean !== input.value) input.value = clean;
    submit.disabled = clean.trim() === '';
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const answer = cleanAnswer(input.value).trim();
    if (answer) send(answer);
  });
  skip.addEventListener('click', () => send(''));

  function send(answer) {
    const elapsed = performance.now() - startedAt;
    for (const el of form.elements) el.disabled = true;
    input.blur();
    Promise.resolve(check(answer))
      .then((r) => resultCard(no, answer, r, elapsed))
      .catch((err) => {
        console.warn('[guess]', err);
        return {
          card: card({ no, label: 'The answer', title: 'No answer this time', subtitle: `${friendlyError(err)} This round won't count.`, tone: 'grey', art: art.offline() }),
          record: scoreTurn({ kind: 'guess', word: '—', success: false, error: true }),
        };
      })
      .then(async ({ card: back, record }) => {
        if (!alive) return;
        await flip.flip(back);
        if (!alive) return;
        state.history.push(record);
        const next = button(isLastPair(state) ? 'See results' : 'Next round', { onClick: () => endPair(go, state) });
        actions.replaceChildren(next);
        actions.classList.add('is-entering');
        next.focus({ preventScroll: true });
      });
  }

  return () => {
    alive = false;
  };
}

function resultCard(no, answer, { correct, word }, elapsed) {
  const record = scoreTurn({ kind: 'guess', word, success: correct, elapsed });
  const title = `“${word}”`;
  if (correct) {
    const subtitle = record.fast ? 'You got it, and fast: +1 bonus!' : 'You got it!';
    return { record, card: card({ no, label: 'The answer', title, subtitle, tone: 'green', art: art.correct() }) };
  }
  if (!answer) {
    return { record, card: card({ no, label: 'The answer', title, subtitle: 'Skipped. No points this round.', tone: 'grey', art: art.skip() }) };
  }
  return { record, card: card({ no, label: 'The answer', title, subtitle: `You said “${answer}”. Not this time.`, tone: 'red', art: art.wrong() }) };
}

// Verifica finta, solo per provare le carte in sviluppo: la vera parola resta sul server.
function demoCheck(word) {
  return (answer) =>
    new Promise((resolve) =>
      setTimeout(() => resolve({ correct: answer.toLowerCase() === word, word }), 500),
    );
}
