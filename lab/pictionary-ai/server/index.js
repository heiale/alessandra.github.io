// Server API di Pictionary AI: custodisce la chiave Anthropic e firma i round.
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import { AIError, MODEL, drawWord, guessDrawing, hasCredentials } from './ai.js';
import { isMatch } from './match.js';
import { consumeToken, openToken, releaseToken, sealToken, signToken, verifyToken } from './token.js';
import { pickWord } from './words.js';

const app = express();
const PRODUCTION = process.env.NODE_ENV === 'production';
// In locale API_PORT (8787); sull'hosting la porta la decide la piattaforma con PORT.
// (In locale PORT si ignora: l'anteprima la usa per Vite.)
const PORT = Number(process.env.API_PORT) || (PRODUCTION && Number(process.env.PORT)) || 8787;
// Build del client (npm run build): in produzione la serve questo stesso server.
const DIST = fileURLToPath(new URL('../dist/', import.meta.url));
// Solo questo computer: dal telefono si passa dal proxy di Vite (npm run dev:lan).
const HOST = process.env.API_HOST || '127.0.0.1';

// In produzione il segreto dei round è obbligatorio (senza, ogni riavvio invaliderebbe i round).
if (PRODUCTION && (process.env.ROUND_SECRET ?? '').length < 32) {
  console.error('ROUND_SECRET mancante o più corto di 32 caratteri: il server non parte in produzione.');
  process.exit(1);
}

const MAX_IMAGE_BYTES = 1.5 * 1024 * 1024; // PNG decodificato
const MAX_IMAGE_SIDE = 1024; // il client esporta al massimo 768 px sul lato lungo
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

app.disable('x-powered-by');

// Dietro un proxy (hosting), l'IP vero del giocatore arriva nell'intestazione X-Forwarded-For:
// TRUST_PROXY=1 dice a Express di fidarsi del primo proxy, così i limiti restano per giocatore.
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);

// Intestazioni di base per tutte le risposte dell'API.
app.use('/api', (_req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store',
    'Cross-Origin-Resource-Policy': 'same-origin',
  });
  next();
});

// Le chiamate dell'API vengono solo dal gioco stesso. Due controlli contro le richieste fatte
// partire da altri siti (che consumerebbero credito a nome di chi visita quei siti):
// - il browser segna come "cross-site" le richieste che arrivano da un altro sito;
// - le POST devono essere JSON: da un altro sito il browser lo consente solo dopo un controllo
//   preliminare (CORS) che questo server non autorizza.
app.use('/api', (req, res, next) => {
  if (req.get('sec-fetch-site') === 'cross-site') return res.status(403).json({ error: 'forbidden' });
  if (req.method === 'POST' && !req.is('application/json')) return res.status(415).json({ error: 'unsupported_media_type' });
  next();
});

// --- Limiti per IP: per minuto e per giorno (in memoria, si azzerano al riavvio).
const limitOptions = {
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'rate_limited' },
};
app.use('/api', rateLimit({ ...limitOptions, windowMs: 60_000, limit: 20 }));
app.use('/api', rateLimit({ ...limitOptions, windowMs: 24 * 60 * 60_000, limit: 200 }));

// Base64 di 1,5 MB ≈ 2 MB, più il resto del JSON.
app.use(express.json({ limit: '2.2mb' }));

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    model: MODEL,
    hasApiKey: hasCredentials(),
    hasRoundSecret: (process.env.ROUND_SECRET ?? '').length >= 32,
  });
});

// Round A: il server assegna la parola da disegnare (l'utente non la sceglie).
app.post('/api/word', (_req, res) => {
  const { word, category } = pickWord();
  res.json({ word, category, token: signToken({ t: 'A', w: word, c: category }) });
});

// Round A: l'AI indovina il disegno. La parola giusta viene dal token, mai dal client.
app.post('/api/guess', async (req, res) => {
  const round = verifyToken(req.body?.token, 'A');
  if (!round) return res.status(400).json({ error: 'invalid_token' });

  const png = parsePng(req.body?.image);
  if (!png) return res.status(400).json({ error: 'invalid_image' });

  if (!hasCredentials()) return res.status(503).json({ error: 'not_configured' });
  if (!consumeToken(round)) return res.status(409).json({ error: 'round_used' });

  const started = Date.now();
  try {
    const { guess, refused, usage } = await guessDrawing(png);
    const correct = !refused && isMatch(guess, round.w);
    console.log(
      `[guess] word="${round.w}" guess="${guess}" correct=${correct} refused=${refused} ` +
        `${Date.now() - started}ms in=${usage?.input_tokens ?? '?'} out=${usage?.output_tokens ?? '?'}`,
    );
    res.json({ guess, correct, refused, word: round.w });
  } catch (err) {
    releaseToken(round); // il giocatore può riprovare lo stesso round
    console.error(`[guess] failed after ${Date.now() - started}ms:`, err instanceof AIError ? err.message : err);
    res.status(502).json({ error: 'ai_unavailable' });
  }
});

// Round B: l'AI disegna una parola della lista, che il client non vede mai (token cifrato).
// Disegno non valido: un nuovo tentativo con la stessa parola, poi uno con una parola nuova.
// Errori dell'API (timeout, rete...) invece si fermano subito: niente attese in fila.
app.post('/api/draw', async (_req, res) => {
  if (!hasCredentials()) return res.status(503).json({ error: 'not_configured' });

  const started = Date.now();
  let pick = pickWord();
  const used = [pick.word];
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const result = await drawWord(pick.word);
      if (result.refused) {
        console.warn(`[draw] word="${pick.word}" refused`);
        pick = pickWord(used); // dopo un rifiuto si cambia subito parola
        used.push(pick.word);
        continue;
      }
      const { strokes, usage } = result;
      const points = strokes.reduce((n, s) => n + s.points.length, 0);
      console.log(
        `[draw] word="${pick.word}" strokes=${strokes.length} points=${points} attempt=${attempt} ` +
          `${Date.now() - started}ms in=${usage?.input_tokens ?? '?'} out=${usage?.output_tokens ?? '?'}`,
      );
      return res.json({
        strokes,
        category: pick.category,
        token: sealToken({ t: 'B', w: pick.word, c: pick.category }),
      });
    } catch (err) {
      if (!(err instanceof AIError)) {
        console.error('[draw] unexpected error:', err);
        break;
      }
      console.warn(`[draw] word="${pick.word}" attempt ${attempt} failed: ${err.message}`);
      if (err.message.startsWith('Anthropic API')) break; // errore di rete/API: non riprovare
      if (attempt >= 2) {
        pick = pickWord(used); // seconda volta non valido con la stessa parola: parola nuova
        used.push(pick.word);
      }
    }
  }
  res.status(502).json({ error: 'ai_unavailable' });
});

// Round B: verifica la risposta dell'utente e rivela la parola. Un solo tentativo per round.
// La risposta non finisce mai in un prompt: viene solo confrontata con la parola.
app.post('/api/check', (req, res) => {
  const round = openToken(req.body?.token, 'B');
  if (!round) return res.status(400).json({ error: 'invalid_token' });

  const answer = req.body?.answer ?? '';
  // Solo lettere e spazi, massimo 30 caratteri; vuota = "Skip".
  if (typeof answer !== 'string' || answer.length > 30 || !/^[\p{L} ]*$/u.test(answer)) {
    return res.status(400).json({ error: 'invalid_answer' });
  }
  if (!consumeToken(round)) return res.status(409).json({ error: 'round_used' });

  const correct = answer.trim() !== '' && isMatch(answer, round.w);
  res.json({ correct, word: round.w });
});

app.use('/api', (_req, res) => res.status(404).json({ error: 'not_found' }));

// "Sveglia" per l'hosting gratuito, che addormenta il server quando nessuno gioca: la pagina
// di attesa sul portfolio la chiama da un altro sito e aspetta solo che il server risponda.
// Non restituisce dati, quindi può essere letta da qualunque sito.
app.get('/wake', (_req, res) => {
  res.set({ 'Cache-Control': 'no-store', 'Cross-Origin-Resource-Policy': 'cross-origin' });
  res.status(204).end();
});

// Il gioco (pagina e file statici), se la build esiste.
if (existsSync(DIST)) {
  // Regole per la pagina: script, stili e connessioni solo da qui, font da Google,
  // immagini anche come data: (la foto del disegno), e niente inclusione in siti altrui.
  const CSP = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' https://fonts.googleapis.com",
    "font-src https://fonts.gstatic.com",
    "img-src 'self' data:",
    "connect-src 'self'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join('; ');
  app.use((_req, res, next) => {
    res.set({
      'Content-Security-Policy': CSP,
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    });
    next();
  });
  app.use(
    express.static(DIST, {
      setHeaders(res, path) {
        // I file in assets/ hanno l'impronta nel nome: si possono tenere in cache a lungo.
        res.set('Cache-Control', /[/\\]assets[/\\]/.test(path) ? 'public, max-age=31536000, immutable' : 'no-cache');
      },
    }),
  );
}

// Errori imprevisti (JSON malformato, corpo troppo grande...): messaggio neutro, dettagli nel log.
// eslint-disable-next-line no-unused-vars -- Express riconosce il gestore errori dai 4 argomenti
app.use((err, _req, res, _next) => {
  const status = err.status === 413 ? 413 : err.status === 400 ? 400 : 500;
  if (status === 500) console.error(err);
  res.status(status).json({ error: status === 413 ? 'too_large' : status === 400 ? 'bad_request' : 'server_error' });
});

// Controlla che l'immagine sia un PNG vero e piccolo. Accetta base64 puro o una data URL PNG.
// Restituisce il base64 pulito, oppure null.
function parsePng(image) {
  if (typeof image !== 'string') return null;
  const b64 = image.startsWith('data:') ? image.replace(/^data:image\/png;base64,/, '') : image;
  if (b64.startsWith('data:') || !/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) return null;
  if ((b64.length * 3) / 4 > MAX_IMAGE_BYTES + 4) return null;

  const buf = Buffer.from(b64, 'base64');
  if (buf.length < 33 || buf.length > MAX_IMAGE_BYTES) return null;
  if (!buf.subarray(0, 8).equals(PNG_MAGIC)) return null;
  // Il primo chunk deve essere IHDR, con larghezza e altezza.
  if (buf.toString('latin1', 12, 16) !== 'IHDR') return null;
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  if (!width || !height || width > MAX_IMAGE_SIDE || height > MAX_IMAGE_SIDE) return null;
  return b64;
}

app.listen(PORT, HOST, () => {
  if (PRODUCTION && !existsSync(DIST)) console.warn('Attenzione: build del client mancante (npm run build)');
  console.log(`Pictionary AI API su http://${HOST}:${PORT} (modello ${MODEL})`);
  if (!hasCredentials()) console.warn('Attenzione: ANTHROPIC_API_KEY mancante in .env: /api/guess risponderà 503');
});
