// Riepilogo finale: punteggio, una riga per turno e "Play again".
// Punti: 1 per turno riuscito, +1 se veloce (vedi flow.js).
import { button, card, cardScreen, flipCard, h, nextCardNo } from '../ui/card.js';
import { summary } from '../ui/illustrations.js';

// Partita di esempio, se si apre il riepilogo senza aver giocato (solo in sviluppo, #summary).
const DEMO = [
  { kind: 'draw', word: 'apple', success: true, fast: true, points: 2 },
  { kind: 'guess', word: 'bicycle', success: false, points: 0 },
  { kind: 'draw', word: 'lighthouse', success: false, points: 0 },
  { kind: 'guess', word: 'snail', success: true, fast: false, points: 1 },
];

export function render(root, { go, state }) {
  const history = state.history?.length ? state.history : DEMO;
  const score = history.reduce((sum, r) => sum + (r.points ?? 0), 0);
  const wins = history.filter((r) => r.success).length;

  const list = h('ol', 'score-list');
  for (const r of history) {
    const who = r.kind === 'draw' ? 'You drew' : 'The AI drew';
    const kind = r.error ? `${who} · no answer` : r.fast ? `${who} · fast` : who;
    const li = h('li');
    li.append(
      h('span', 'score-kind', kind),
      h('span', 'score-word', r.word),
      h('span', `score-points${r.points > 0 ? ' is-win' : ''}`, r.points > 0 ? `+${r.points}` : '0'),
    );
    li.setAttribute('aria-label', `${kind}, ${r.word}: ${r.points} ${r.points === 1 ? 'point' : 'points'}`);
    list.append(li);
  }

  const { screen, stack, actions } = cardScreen('summary');
  const front = card({
    no: nextCardNo(state),
    label: 'Final score',
    title: `${score} ${score === 1 ? 'point' : 'points'}`,
    subtitle: message(wins, history.length),
    tone: wins === history.length && wins > 0 ? 'green' : 'blue',
    art: summary(),
    body: list,
  });
  stack.append(flipCard(front).el);
  actions.append(button('Play again', { onClick: () => go('home') }));
  root.append(screen);
}

function message(wins, turns) {
  if (turns > 0 && wins === turns) return 'A perfect game. You and the AI make a good team.';
  if (wins > 0) return 'Not bad at all. Want another round?';
  return 'Drawing is hard. Give it another go.';
}
