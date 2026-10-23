// Registro degli effetti disponibili. Per aggiungerne uno nuovo: crea src/effects/<nome>.js
// con la stessa interfaccia di glitch.js e aggiungilo qui.
// L'ordine conta: gli effetti vengono disegnati uno sopra l'altro, nell'ordine di questa lista.
import { createGlitchEffect } from './glitch.js';

export const EFFECTS = {
  glitch: createGlitchEffect,
};

/** Effetti attivi, dal primo (sotto) all'ultimo (sopra). */
export const ACTIVE_EFFECTS = ['glitch'];
