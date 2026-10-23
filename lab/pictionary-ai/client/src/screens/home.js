// Carta "Start": presenta il gioco e azzera la partita.
import { button, card, cardScreen, flipCard, nextCardNo } from '../ui/card.js';
import { start } from '../ui/illustrations.js';
import { startUserRound } from '../flow.js';

export function render(root, { go, state }) {
  Object.assign(state, { pair: 0, history: [], cardNo: 0 });

  const { screen, stack, actions } = cardScreen('home');
  const front = card({
    no: nextCardNo(state),
    label: 'Pictionary AI',
    title: 'Draw with an AI',
    subtitle: 'You draw and the AI guesses. Then it draws and you guess.',
    tone: 'blue',
    art: start(),
  });
  stack.append(flipCard(front).el);
  actions.append(button('Start', { onClick: () => startUserRound(go, state) }));
  root.append(screen);
}
