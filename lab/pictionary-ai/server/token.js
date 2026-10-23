// Token di round firmati con HMAC: base64url(payload).base64url(firma).
// Il payload contiene il tipo di round, la parola, un id e la scadenza. Il server resta senza
// database: la parola viaggia nel token, e la firma impedisce al client di cambiarla.
// Attenzione: il payload firmato è leggibile (solo base64): va bene per il Round A, dove la parola
// è già mostrata all'utente. Per il Round B, dove deve restare segreta, si usa sealToken (cifrato).
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const DEFAULT_TTL = 5 * 60_000; // 5 minuti

function getSecret() {
  const s = process.env.ROUND_SECRET;
  if (s && s.length >= 32) return s;
  // Senza un segreto valido se ne crea uno casuale a ogni avvio: va bene in locale
  // (i token durano 5 minuti), ma i round in corso si perdono a ogni riavvio del server.
  if (!getSecret.ephemeral) {
    getSecret.ephemeral = randomBytes(32).toString('hex');
    console.warn('ROUND_SECRET mancante o più corto di 32 caratteri: uso un segreto temporaneo.');
  }
  return getSecret.ephemeral;
}

const b64 = (buf) => Buffer.from(buf).toString('base64url');
const sign = (data) => createHmac('sha256', getSecret()).update(data).digest();

export function signToken(payload, ttl = DEFAULT_TTL) {
  const body = b64(JSON.stringify({ ...payload, id: randomBytes(9).toString('base64url'), exp: Date.now() + ttl }));
  return `${body}.${b64(sign(body))}`;
}

// Restituisce il payload se il token è integro, non scaduto e del tipo atteso; altrimenti null.
export function verifyToken(token, type) {
  if (typeof token !== 'string' || token.length > 2000) return null;
  const [body, mac, extra] = token.split('.');
  if (!body || !mac || extra !== undefined) return null;

  const expected = sign(body);
  const given = Buffer.from(mac, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (!payload || payload.t !== type || typeof payload.exp !== 'number' || payload.exp < Date.now()) return null;
  return payload;
}

// --- Token cifrati (Round B): il client non deve poter leggere la parola che l'AI ha disegnato.
// AES-256-GCM: cifra e insieme protegge dalle modifiche. Formato: base64url(iv | testo cifrato | tag).
const encKey = () => createHash('sha256').update(`pictionary-enc:${getSecret()}`).digest();

export function sealToken(payload, ttl = DEFAULT_TTL) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encKey(), iv);
  const plain = JSON.stringify({ ...payload, id: randomBytes(9).toString('base64url'), exp: Date.now() + ttl });
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return b64(Buffer.concat([iv, data, cipher.getAuthTag()]));
}

export function openToken(token, type) {
  if (typeof token !== 'string' || token.length > 2000 || !/^[A-Za-z0-9_-]+$/.test(token)) return null;
  const buf = Buffer.from(token, 'base64url');
  if (buf.length < 12 + 16 + 2) return null;
  let payload;
  try {
    const decipher = createDecipheriv('aes-256-gcm', encKey(), buf.subarray(0, 12));
    decipher.setAuthTag(buf.subarray(buf.length - 16));
    const plain = Buffer.concat([decipher.update(buf.subarray(12, buf.length - 16)), decipher.final()]);
    payload = JSON.parse(plain.toString('utf8'));
  } catch {
    return null; // token modificato, chiave diversa o JSON rotto
  }
  if (!payload || payload.t !== type || typeof payload.exp !== 'number' || payload.exp < Date.now()) return null;
  return payload;
}

// Token usati, tenuti in memoria fino alla scadenza: ogni token vale per una sola richiesta
// all'AI, così non si può ripetere /api/guess all'infinito con lo stesso round.
const used = new Map(); // id -> exp

export function consumeToken(payload) {
  const now = Date.now();
  for (const [id, exp] of used) if (exp < now) used.delete(id);
  if (used.has(payload.id)) return false;
  used.set(payload.id, payload.exp);
  return true;
}

// Se la chiamata all'AI fallisce, il round si può riprovare.
export function releaseToken(payload) {
  used.delete(payload.id);
}
