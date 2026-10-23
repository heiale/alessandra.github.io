// Router di schermate e stato di gioco.
import './styles/tokens.css';
import './styles/cards.css';
import './styles/draw.css';

import * as home from './screens/home.js';
import * as draw from './screens/draw.js';
import * as reveal from './screens/reveal.js';
import * as watch from './screens/watch.js';
import * as guess from './screens/guess.js';
import * as summary from './screens/summary.js';
import * as wait from './screens/wait.js';
import * as ready from './screens/ready.js';

const screens = { home, ready, draw, reveal, watch, guess, summary, wait };
const root = document.getElementById('app');

// Stato della partita, condiviso fra le schermate (home lo azzera).
export const state = { pair: 0, history: [], cardNo: 0 };

let cleanup = null;

export function go(name, params = {}) {
  const screen = screens[name];
  if (!screen) throw new Error(`Unknown screen: ${name}`);
  if (typeof cleanup === 'function') cleanup();
  root.replaceChildren();
  root.dataset.screen = name;
  window.scrollTo(0, 0);
  cleanup = screen.render(root, { state, go, params });
}

// Solo in sviluppo: #nome?param=valore apre direttamente una schermata,
// es. #reveal?guess=pear oppure #guess?word=cat.
function fromHash() {
  const [name, query = ''] = location.hash.slice(1).split('?');
  // "wait" ha bisogno di una funzione da eseguire: non si apre dall'indirizzo.
  return screens[name] && name !== 'wait' ? [name, Object.fromEntries(new URLSearchParams(query))] : ['home', {}];
}

if (import.meta.env.DEV) {
  go(...fromHash());
  window.addEventListener('hashchange', () => go(...fromHash()));
} else {
  go('home');
}
