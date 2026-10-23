// Carta delle schermate home, reveal, guess e summary: header grigio chiaro con "Card No. X",
// titolo serif e sottotitolo, sotto un'area di colore piatto con un'illustrazione.

const TONES = ['red', 'green', 'blue', 'grey'];

// Crea un elemento con classe e testo (il testo passa sempre da textContent, mai da innerHTML).
export function h(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text != null) el.textContent = text;
  return el;
}

// Numero progressivo delle carte della partita ("Card No. 01", "02"...).
export function nextCardNo(state) {
  state.cardNo = (state.cardNo ?? 0) + 1;
  return state.cardNo;
}

/**
 * @param {object} o
 * @param {number} o.no        numero della carta
 * @param {string} [o.label]   etichetta piccola a destra del numero
 * @param {string} o.title
 * @param {string} [o.subtitle]
 * @param {'red'|'green'|'blue'|'grey'} [o.tone]
 * @param {string|HTMLElement} [o.art]  SVG statico (stringa) o elemento da mettere nell'area colorata
 * @param {HTMLElement} [o.body]        contenuto extra nell'header, sotto il sottotitolo
 */
export function card({ no, label, title, subtitle, tone = 'blue', art, body }) {
  if (!TONES.includes(tone)) tone = 'blue';
  const el = h('article', `card card--${tone}`);

  const head = h('header', 'card-head');
  const meta = h('div', 'card-meta');
  meta.append(h('span', 'card-no', `Card No. ${String(no ?? 1).padStart(2, '0')}`));
  if (label) meta.append(h('span', 'card-label', label));
  head.append(meta, h('h2', 'card-title', title));
  if (subtitle) head.append(h('p', 'card-sub', subtitle));
  if (body) head.append(body);

  const area = h('div', 'card-art');
  if (typeof art === 'string') area.innerHTML = art; // solo SVG statici di illustrations.js
  else if (art) area.append(art);

  el.append(head, area);
  return el;
}

// Tre puntini animati dopo il titolo, per le carte di attesa.
export function withDots(cardEl) {
  const dots = h('span', 'dots');
  dots.setAttribute('aria-hidden', 'true');
  dots.append(h('i'), h('i'), h('i'));
  cardEl.querySelector('.card-title').append(dots);
  return cardEl;
}

// Il disegno dell'utente come una piccola foto bianca appoggiata sull'area colorata.
export function photo(src, alt) {
  const frame = h('figure', 'card-photo');
  const img = h('img');
  img.src = src;
  img.alt = alt;
  frame.append(img);
  return frame;
}

// Carta che fluttua piano e si gira: fronte subito, retro impostato quando c'è il risultato.
export function flipCard(front) {
  const float = h('div', 'card-float');
  const flip = h('div', 'flip');
  const inner = h('div', 'flip-inner');
  const frontFace = h('div', 'flip-face flip-face--front');
  const backFace = h('div', 'flip-face flip-face--back');
  backFace.setAttribute('aria-hidden', 'true');
  frontFace.append(front);
  inner.append(frontFace, backFace);
  flip.append(inner);
  float.append(flip);

  return {
    el: float,
    // Gira la carta mostrando `back`. Restituisce una Promise che si risolve a fine animazione.
    flip(back) {
      backFace.replaceChildren(back);
      backFace.removeAttribute('aria-hidden');
      frontFace.setAttribute('aria-hidden', 'true');
      // Due frame: il retro deve essere nel DOM prima che parta la transizione.
      requestAnimationFrame(() => requestAnimationFrame(() => flip.classList.add('is-flipped')));
      const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      return new Promise((resolve) => {
        if (reduced) return requestAnimationFrame(() => resolve());
        const done = (e) => {
          if (e.target !== inner) return;
          inner.removeEventListener('transitionend', done);
          resolve();
        };
        inner.addEventListener('transitionend', done);
        setTimeout(resolve, 1200); // rete di sicurezza se transitionend non arriva
      });
    },
  };
}

// Schermata a carta: carta al centro, azioni sotto.
export function cardScreen(name) {
  const screen = h('section', `card-screen card-screen--${name}`);
  const stack = h('div', 'card-stack');
  const actions = h('div', 'actions');
  screen.append(stack, actions);
  return { screen, stack, actions };
}

export function button(text, { variant, type = 'button', onClick } = {}) {
  const b = h('button', variant ? `btn btn--${variant}` : 'btn', text);
  b.type = type;
  if (onClick) b.addEventListener('click', onClick);
  return b;
}
