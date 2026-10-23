// Carta di attesa mentre il server lavora (parola nuova, disegno dell'AI). Se la richiesta
// fallisce, la carta si gira su un errore con "Try again" e, se previsto, "Skip".
// La carta compare solo se l'attesa supera SHOW_AFTER: una risposta veloce passa oltre senza
// far lampeggiare una carta (e senza consumare un numero di carta).
// params: { label, title, subtitle, task: () => Promise, next(result), skip?: { label, run() } }
import { friendlyError } from '../api.js';
import { button, card, cardScreen, flipCard, nextCardNo, withDots } from '../ui/card.js';
import * as art from '../ui/illustrations.js';

const SHOW_AFTER = 250; // ms

export function render(root, { go, state, params }) {
  let alive = true;
  let no = 0;
  let flip = null;

  const { screen, stack, actions } = cardScreen('wait');
  stack.setAttribute('aria-live', 'polite');
  root.append(screen);

  function show() {
    if (flip || !alive) return;
    no = nextCardNo(state);
    const front = withDots(
      card({ no, label: params.label, title: params.title, subtitle: params.subtitle, tone: 'grey', art: art.thinking() }),
    );
    flip = flipCard(front);
    stack.append(flip.el);
  }
  const showTimer = setTimeout(show, SHOW_AFTER);

  params
    .task()
    .then((result) => {
      clearTimeout(showTimer);
      if (alive) params.next(result);
    })
    .catch(async (err) => {
      clearTimeout(showTimer);
      if (!alive) return;
      console.warn('[wait]', err);
      show();
      const back = card({
        no,
        label: params.label,
        title: 'Hmm, a hiccup',
        subtitle: friendlyError(err),
        tone: 'grey',
        art: art.offline(),
      });
      await flip.flip(back);
      if (!alive) return;
      const retry = button('Try again', { onClick: () => go('wait', params) });
      const other = params.skip
        ? button(params.skip.label, { variant: 'ghost', onClick: params.skip.run })
        : button('Back to start', { variant: 'ghost', onClick: () => go('home') });
      actions.classList.add('is-entering');
      actions.append(retry, other);
      retry.focus({ preventScroll: true });
    });

  return () => {
    alive = false;
    clearTimeout(showTimer);
  };
}
