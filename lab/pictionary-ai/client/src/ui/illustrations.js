// Illustrazioni originali delle carte: forme semplici e tratti sottili.
// Il colore delle linee è currentColor (bianco sulle aree colorate, nero su quella grigia);
// i riempimenti usano la palette. Tutte nella stessa viewBox 240x150.

const svg = (body) =>
  `<svg viewBox="0 0 240 150" preserveAspectRatio="xMidYMid meet" aria-hidden="true">${body}</svg>`;

// Stellina a quattro punte (il "pensiero" dell'AI), centrata in x,y con raggio r.
const sparkle = (x, y, r) =>
  `<path d="M${x} ${y - r} Q${x} ${y} ${x + r} ${y} Q${x} ${y} ${x} ${y + r} Q${x} ${y} ${x - r} ${y} Q${x} ${y} ${x} ${y - r}Z"/>`;

// Matita con la punta in (0,0) che punta a sinistra; si posiziona con transform.
const pencil = (transform) => `
  <g transform="${transform}">
    <path d="M0 0 L16 -7 L16 7 Z" fill="var(--tone)"/>
    <path d="M0 0 L5 -2.2 L5 2.2 Z" fill="currentColor"/>
    <path d="M16 -7 H78 V7 H16 Z" fill="var(--tone)"/>
    <path d="M16 0 H78" opacity=".5"/>
    <path d="M78 -7 H92 a4 4 0 0 1 4 4 v6 a4 4 0 0 1 -4 4 H78 Z" fill="currentColor"/>
  </g>`;

// Home: una matita lascia una linea a zig-zag, il sole rosso e due stelline per l'AI.
export const start = () => svg(`
  <circle cx="176" cy="50" r="24" fill="var(--red)" stroke="none"/>
  <path d="M28 118 C44 92 58 136 76 110 S104 86 118 106 S140 122 150 104"/>
  ${pencil('translate(150 104) rotate(-32)')}
  ${sparkle(206, 112, 9)}
  ${sparkle(52, 44, 6)}
  <circle cx="84" cy="36" r="2.5" fill="currentColor" stroke="none"/>
`);

// Attesa del guess: una casetta disegnata a mano e una lente che ci gira sopra.
export const thinking = () => svg(`
  <path d="M74 122 V86 L104 62 L134 86 V122 Z"/>
  <path d="M96 122 V102 H112 V122"/>
  <path d="M42 122 H170" />
  <circle cx="190" cy="40" r="5" fill="var(--blue)" stroke="none"/>
  <circle cx="44" cy="52" r="3" fill="var(--red)" stroke="none"/>
  <g class="art-search">
    <circle cx="140" cy="70" r="24" fill="var(--white)" fill-opacity=".45"/>
    <path d="M157 87 L178 108" stroke-width="5"/>
  </g>
`);

// Indovinato: un grande cerchio con la spunta e qualche coriandolo.
export const correct = () => svg(`
  <circle cx="120" cy="75" r="40"/>
  <path d="M102 76 L115 89 L140 62" stroke-width="3"/>
  <rect x="46" y="38" width="10" height="10" rx="2" transform="rotate(18 51 43)" fill="var(--ink)" stroke="none"/>
  <path d="M186 40 l10 -6 M190 112 l12 4 M52 108 l-8 8"/>
  <circle cx="182" cy="76" r="4" fill="var(--blue)" stroke="none"/>
  <circle cx="70" cy="80" r="3" fill="currentColor" stroke="none"/>
  ${sparkle(176, 118, 7)}
  ${sparkle(60, 24, 6)}
`);

// Sbagliato: un fumetto con il punto di domanda e una spirale.
export const wrong = () => svg(`
  <path d="M76 34 H164 a16 16 0 0 1 16 16 V86 a16 16 0 0 1 -16 16 H118 L98 120 V102 H76 a16 16 0 0 1 -16 -16 V50 a16 16 0 0 1 16 -16 Z"/>
  <path d="M110 58 a10 10 0 1 1 14 9.5 c-4 2 -4 5 -4 9"/>
  <circle cx="120" cy="88" r="2.6" fill="currentColor" stroke="none"/>
  <path d="M210 40 a3 3 0 1 1 -3 -3 a6 6 0 1 1 -6 6 a9 9 0 1 1 9 9" />
  <circle cx="44" cy="112" r="6" fill="var(--ink)" stroke="none"/>
`);

// Saltato: una freccia che scavalca una scatola.
export const skip = () => svg(`
  <rect x="96" y="80" width="48" height="40" rx="4"/>
  <path d="M96 92 H144" opacity=".5"/>
  <path d="M58 112 C64 40 176 40 182 104"/>
  <path d="M172 96 L182 106 L192 94"/>
  <circle cx="58" cy="112" r="4" fill="currentColor" stroke="none"/>
  <circle cx="196" cy="40" r="5" fill="var(--blue)" stroke="none"/>
`);

// Tocca a te indovinare: un fumetto con i tre puntini di chi sta scrivendo.
export const guess = () => svg(`
  <path d="M70 40 H170 a18 18 0 0 1 18 18 V84 a18 18 0 0 1 -18 18 H96 L76 118 V102 H70 a18 18 0 0 1 -18 -18 V58 a18 18 0 0 1 18 -18 Z"/>
  <circle cx="96" cy="71" r="6" fill="currentColor" stroke="none"/>
  <circle cx="120" cy="71" r="6" fill="currentColor" stroke="none"/>
  <circle cx="144" cy="71" r="6" fill="currentColor" stroke="none"/>
  <circle cx="204" cy="34" r="12" fill="var(--red)" stroke="none"/>
  ${sparkle(34, 110, 8)}
  ${sparkle(212, 120, 5)}
`);

// Riepilogo: una medaglia con il nastro.
export const summary = () => svg(`
  <path d="M96 18 H111 L129 62 H114 Z" fill="var(--tone)"/>
  <path d="M144 18 H129 L111 62 H126 Z" fill="var(--tone)"/>
  <circle cx="120" cy="88" r="32" fill="var(--paper)" stroke="none"/>
  <circle cx="120" cy="88" r="32"/>
  <path d="M120 72 L125 83 L137 84 L128 92 L131 104 L120 98 L109 104 L112 92 L103 84 L115 83 Z" stroke="var(--ink)" fill="var(--red)"/>
  ${sparkle(184, 52, 9)}
  ${sparkle(56, 112, 7)}
  <circle cx="60" cy="48" r="4" fill="var(--red)" stroke="none"/>
  <path d="M182 108 l12 6 M186 122 l4 10"/>
`);

// Errore di rete o del server: un filo staccato.
export const offline = () => svg(`
  <path d="M30 76 H92"/>
  <rect x="92" y="62" width="22" height="28" rx="5"/>
  <path d="M114 70 H124 M114 82 H124"/>
  <rect x="146" y="62" width="22" height="28" rx="5"/>
  <path d="M168 76 H210"/>
  <path d="M132 56 l-4 -10 M140 54 l4 -10 M136 98 v10"/>
`);
