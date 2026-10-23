// Carta con la parola da disegnare: la si legge con calma, il timer parte solo con "Start drawing".
// params: { word, category, token } da /api/word.
import { button, card, cardScreen, flipCard, nextCardNo } from '../ui/card.js';
import { start } from '../ui/illustrations.js';
import { roundLabel } from '../flow.js';

export function render(root, { go, state, params }) {
  const { screen, stack, actions } = cardScreen('ready');
  const front = card({
    no: nextCardNo(state),
    label: roundLabel(state),
    title: params.word,
    subtitle: 'Your word to draw. You have 60 seconds, and the AI will try to guess it.',
    tone: 'blue',
    art: start(),
  });
  stack.append(flipCard(front).el);
  const go2 = button('Start drawing', { onClick: () => go('draw', params) });
  actions.append(go2);
  root.append(screen);
  go2.focus({ preventScroll: true });
}
