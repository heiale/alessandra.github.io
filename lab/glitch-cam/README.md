# Glitch Cam

Esperimento interattivo per il portfolio: un effetto glitch in tempo reale sulla persona inquadrata
dalla webcam, controllato dai gesti della mano. Il glitch prende pezzi dell'immagine della persona e
li sposta: i contorni si rompono e nei buchi lasciati dai pezzi si vede lo sfondo.

L'intensità va su una scala da 0 a 10:

- **Nessuna mano** → livello 0–1, oscilla piano
- **Mano in scena** → livello 0–10: pugno chiuso 0 (minimo), mano aperta 10 (massimo), in mezzo in modo continuo
- **Altezza della mano** → sposta un po' il livello (in alto di più, in basso di meno)

### Blocchi nel tempo

Dove c'è la persona, l'immagine è divisa in sezioni irregolari (grandi, medie e piccole) e ogni
sezione mostra un momento diverso: il presente o qualche fotogramma prima (fino a ~1 s). Alcune
sezioni hanno il ritardo a strisce (slit-scan), altre sono un po' spostate. La griglia è fissa
nell'immagine, non segue il corpo, e ogni sezione cambia per conto suo. È sempre attivo, anche
senza mano: da fermi non si vede, muovendosi il corpo si scompone in pezzi presi da momenti diversi. Sopra compaiono anche
rettangoli sparsi, congelati o un po' sfalsati (`src/timeblocks.js`). L'intensità aumenta il
ritardo dei blocchi e il numero di rettangoli. Il glitch a pezzi e pixel lavora sopra questa immagine.

### Lo sfondo dietro la persona

La webcam non vede cosa c'è dietro di te, quindi l'app lo impara: a ogni frame, dove la maschera
è sicura che non ci sei, memorizza lo sfondo (`src/background.js`). Muovendoti, scopre anche le
zone che coprivi. Dove lo sfondo non è ancora stato visto, i buchi mostrano un "vuoto digitale"
scuro. Per avere subito uno sfondo completo basta spostarsi un attimo di lato all'inizio.

Stack: Vite + JavaScript vanilla, MediaPipe Tasks Vision (HandLandmarker per la mano, ImageSegmenter
"selfie" per separare la persona dallo sfondo), WebGL2 con shader GLSL.

## Avvio

Serve Node.js 20.19+ o 22.12+.

```bash
npm install
npm run dev
```

Poi apri l'indirizzo che compare nel terminale (di solito http://localhost:5173) e premi **Attiva webcam**.

Al primo `npm run dev` lo script `scripts/setup-assets.mjs` copia i file wasm di MediaPipe in
`public/mediapipe/` e scarica i modelli in `public/models/` (mano ~8 MB, segmentazione ~250 KB). Le volte successive
non scarica più nulla.

Altri comandi:

```bash
npm run build     # build di produzione in ../../laboratory/glitch-cam/ (dentro il sito)
npm run preview   # serve la build in locale
npm run lint      # ESLint
```

La webcam funziona solo su **https** o su **localhost**. `npm run build` scrive la build
direttamente in `laboratory/glitch-cam/` alla radice del portfolio: è la pagina aperta dalla card
nella sezione Laboratory. Dopo ogni modifica all'esperimento, rifai la build e committa anche
quella cartella.

## Controlli

- **D**: apre/chiude il pannello debug, con FPS, stato del tracking, scheletro della mano e uno
  slider per ogni parametro. I valori modificati restano salvati in quel browser; **Copia valori**
  li copia come JSON, da incollare come nuovi default nei file dei vari moduli.
- **Mostra maschera persona** colora la zona che il modello riconosce come persona; gli slider
  "Maschera persona" regolano soglia, morbidezza del bordo e stabilità nel tempo.
- Le sezioni **Pezzi spostati** e **Blocchi nel tempo** regolano come la persona si scompone.
- **Forza intensità** (nel pannello) blocca l'intensità a un valore fisso: comodo per regolare
  l'effetto senza tenere la mano davanti alla camera.

## Struttura

```
src/
  main.js              avvio e loop di rendering
  camera.js            accesso alla webcam e gestione errori
  mediapipe.js         parti comuni ai modelli: wasm, file dei modelli, loop separato dal rendering
  tracking.js          MediaPipe HandLandmarker, lettura dei gesti, mapping → intensità
  segmentation.js      MediaPipe ImageSegmenter: maschera persona/sfondo
  background.js        lastra dello sfondo imparata nel tempo (per i buchi lasciati dal glitch)
  timeblocks.js        blocchi nel tempo: ultimo secondo di video + rettangoli in ritardo
  gl.js                helper WebGL condivisi (shader, quad a schermo intero, texture video, "cover")
  ui.js                schermata iniziale, suggerimenti, pannello debug
  effects/
    index.js           registro degli effetti
    glitch.js          parametri e logica dell'effetto glitch
    glitch.frag.glsl   fragment shader del glitch
```

### Aggiungere un effetto

Ogni effetto è un oggetto con la stessa interfaccia:

```js
{
  name, schema, params,
  init(renderer),       // renderer.gl, .videoTexture, .source.texture (video con i blocchi nel tempo),
                        // .maskTexture, .background.texture,
                        // .createProgram(), .drawQuad()
  update(state, dt),    // state = { time, intensity, hand, debug }
  render(),
  dispose(),
}
```

Crea `src/effects/<nome>.js`, registralo in `src/effects/index.js` e aggiungilo ad
`ACTIVE_EFFECTS` (gli effetti vengono disegnati uno sopra l'altro, in quell'ordine).
Il pannello debug costruisce gli slider da `schema` in automatico.

## Prestazioni

- Il rendering gira a ogni frame (`requestAnimationFrame`); mano e segmentazione girano ognuna su un
  loop separato, al massimo a 30 Hz e solo quando la webcam ha un fotogramma nuovo. Se un modello è
  lento, il suo intervallo si allunga da solo per lasciare tempo al rendering.
- La segmentazione lavora su un fotogramma ridotto a 256 px di larghezza: la maschera è piccola e
  costa poco caricarla sulla GPU; il bordo viene ammorbidito nello shader.
- I modelli provano prima la GPU e, se non è disponibile, passano alla CPU (il delegate in uso è
  visibile nel pannello debug). Se la segmentazione non parte, il glitch copre tutta l'immagine.
- La risoluzione del canvas è limitata a 2× la densità dello schermo.
- **Telefoni** (`src/quality.js`): webcam a 640×480, effetto disegnato al 75% con densità 1, modelli
  a 15 Hz, memoria del passato ridotta (20 fotogrammi a 480 px invece di 32 a 960 px).
- **Qualità adattiva** (tutti i dispositivi): se gli FPS restano sotto 24 per più di 1,5 s, la
  qualità scende a gradini, prima la risoluzione dell'effetto e poi la frequenza dei modelli.
  Nel pannello debug, la riga "Quality" mostra profilo, scala e gradini scesi.

## Privacy

- Il video della webcam **non lascia mai il dispositivo**: viene letto dal browser, elaborato in locale
  (MediaPipe gira in WebAssembly, l'effetto in WebGL) e mostrato a schermo. Non viene inviato a
  server, registrato o salvato.
- I file del modello e di MediaPipe sono serviti dall'app stessa. Solo se il download iniziale del
  modello non è riuscito, il browser lo scarica da `storage.googleapis.com`: è un download del
  modello, non viene inviato nulla.
- L'unico dato salvato è la regolazione dei parametri del pannello debug, nel `localStorage`
  del browser.
- La webcam si attiva solo dopo il click su **Attiva webcam** e dopo il permesso del browser.
