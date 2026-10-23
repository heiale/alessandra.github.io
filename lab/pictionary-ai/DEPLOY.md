# Pubblicare Pictionary AI su Render

Il gioco gira come un unico servizio su Render (piano gratuito): lo stesso server manda la pagina
e risponde alle chiamate `/api`. Il portfolio su GitHub Pages ha solo la carta nel Laboratory e una
piccola pagina d'attesa (`laboratory/pictionary-ai/`) che sveglia il server e poi porta al gioco.

## Prima volta

1. **Su Anthropic** ([console](https://console.anthropic.com)): crea una chiave API dedicata a
   questo gioco e imposta un **limite di spesa mensile** (Settings → Limits).
2. **Su GitHub**: il codice deve essere sul repository (commit e push di `lab/pictionary-ai/` e
   `render.yaml`).
3. **Su Render** ([render.com](https://render.com)): crea un account e collegalo a GitHub.
   Poi **New → Blueprint**, scegli il repository: Render legge `render.yaml` e propone il servizio
   `pictionary-ai`. Quando chiede `ANTHROPIC_API_KEY`, incolla la chiave del punto 1.
   `ROUND_SECRET` lo genera Render da solo.
4. Alla fine del primo deploy Render mostra l'indirizzo, di solito
   `https://pictionary-ai.onrender.com`. Aprilo e gioca una partita per controllare.
5. **Nel portfolio**: in `build.py`, voce `pictionary-ai` di `EXPERIMENTS`, controlla che
   `"url"` sia quell'indirizzo e togli `"hidden": True`. Poi `python3 build.py`, commit e push:
   la carta compare nel Laboratory.

## Da sapere

- **Server che dorme**: sul piano gratuito Render spegne il servizio dopo circa 15 minuti senza
  visite. Il primo visitatore dopo una pausa aspetta circa un minuto: la pagina d'attesa del
  portfolio mostra una carta "Waking up the AI" e apre il gioco appena il server risponde.
  Con il piano a pagamento (Starter) il server resta sempre acceso.
- **Aggiornamenti**: ogni push che tocca `lab/pictionary-ai/` rifà il deploy da solo.
- **Limiti**: 20 richieste al minuto e 200 al giorno per giocatore (in memoria: si azzerano
  quando il server riparte). Il limite di spesa su Anthropic è la protezione finale.
- **Log**: nella dashboard di Render, scheda Logs. Ogni guess e disegno scrive una riga con
  parola, risultato, tempi e token usati (mai le immagini).
- **Controllo dei limiti per giocatore**: dopo il primo deploy, guarda nei log che non compaiano
  avvisi di `express-rate-limit` su `trust proxy`. Se compaiono, va rivisto `TRUST_PROXY`.
- **Cambiare modello**: variabile `AI_MODEL` nelle impostazioni del servizio su Render.
