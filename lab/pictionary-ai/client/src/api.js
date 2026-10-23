// Chiamate al server e messaggi d'errore per il giocatore.
// L'indirizzo è relativo ("api/..."), così funziona anche dentro una sottocartella del portfolio.
// Se un giorno il server sarà su un altro dominio, basta impostare VITE_API_BASE alla build.
const API_BASE = (import.meta.env.VITE_API_BASE ?? 'api').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(status, code) {
    super(code || `HTTP ${status}`);
    this.status = status; // 0 = rete o timeout
    this.code = code;
  }
}

/**
 * POST JSON a una route del server.
 * @param {string} route  es. 'word', 'guess', 'draw', 'check'
 * @param {object} [body]
 * @param {{ timeout?: number }} [opts]  timeout in ms (il disegno dell'AI è il più lento)
 */
export async function api(route, body = {}, { timeout = 45_000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  let res;
  try {
    res = await fetch(`${API_BASE}/${route}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
  } catch (err) {
    throw new ApiError(0, err?.name === 'AbortError' ? 'timeout' : 'network');
  } finally {
    clearTimeout(timer);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data?.error);
  return data;
}

// Messaggio neutro e comprensibile per ogni tipo di errore.
export function friendlyError(err) {
  const code = err?.code;
  if (code === 'rate_limited') return 'Lots of games right now. Try again in a minute.';
  if (code === 'not_configured') return "The AI isn't set up on this server yet.";
  if (code === 'timeout' || code === 'ai_unavailable') return "The AI didn't answer in time.";
  if (code === 'network') return "Can't reach the game server. Check your connection.";
  if (code === 'invalid_token' || code === 'round_used') return 'This round has expired.';
  return 'Something went wrong on our side.';
}
