#version 300 es
// Effetto glitch "a pezzi": prende pezzi dell'immagine della persona e li sposta.
// Dove un pezzo se ne va resta un buco, e nel buco si vede lo sfondo.
//
// Per ogni punto dello schermo:
//   1. scegliamo da dove prendere l'immagine (uv spostata da fasce, pezzi, pixel);
//   2. se in quel punto di origine c'è la persona, mostriamo quel pezzo di persona (con il glitch);
//   3. altrimenti mostriamo lo sfondo: il video vero se lì non c'è nessuno, oppure la "lastra"
//      dello sfondo imparata nel tempo (vedi background.js) se lì c'è la persona. Dove la lastra
//      non conosce ancora lo sfondo mostriamo il video vero: niente buchi scuri, niente bordi.
// Il risultato: contorni rotti, pezzi della persona fuori posto e sfondo che si vede attraverso.
//
// Tutto è scalato da uIntensity (0..1, dai gesti) e da uBurst (>0 solo durante un "frame glitch").
precision highp float;

in vec2 vUv;
out vec4 outColor;

uniform sampler2D uVideo;
uniform sampler2D uMask;        // maschera della persona: 1 = persona, 0 = sfondo (riga 0 = alto)
uniform sampler2D uBackground;  // lastra dello sfondo in coordinate video (alpha = quanto è nota)
uniform vec2 uResolution;       // dimensione del canvas in pixel
uniform vec2 uCoverScale;       // trasformazione "cover" (vedi gl.js)
uniform vec2 uCoverOffset;
uniform float uTime;            // secondi
uniform float uIntensity;       // 0..1
uniform float uBurst;           // 0 = niente, ~1 = frame glitch pieno
uniform float uBurstSeed;       // cambia a scatti durante il burst

uniform float uRgbShift;        // spostamento massimo dei canali, in frazione della larghezza
uniform float uSliceAmount;     // spostamento massimo delle fasce
uniform float uSliceCount;      // quante fasce orizzontali
uniform float uSliceSpeed;      // quante volte al secondo il glitch cambia (in media)
uniform float uSliceDensity;    // quota di fasce che si spostano a intensità piena
uniform float uPieceAmount;     // quanto lontano vanno i pezzi spostati
uniform float uPieceDensity;    // quota di zone i cui pezzi si spostano a intensità piena
uniform float uEdgeBreak;       // quanto i contorni della persona diventano a gradini e sfrangiati
uniform float uPixelSize;       // lato del pixel più piccolo, in pixel del canvas
uniform float uPixelDensity;    // quota di zone pixelate a intensità piena
uniform float uPosterize;       // livelli di colore per canale nelle zone pixelate
uniform float uPatchiness;      // 0 = glitch uniforme, 1 = solo alcune zone, molto diverse tra loro
uniform float uSmear;           // quota di zone "strisciate" (pixel stirati in orizzontale)
uniform float uGrain;
uniform float uScanlines;
uniform float uScanlineSpacing; // in pixel del canvas

uniform float uMaskThreshold;   // confidenza oltre la quale un pixel è "persona"
uniform float uMaskFeather;     // morbidezza del bordo della maschera
uniform float uShowMask;        // debug: colora la zona riconosciuta come persona

// Hash veloce e stabile: un numero pseudo-casuale 0..1 per ogni coppia di valori.
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

// UV dello schermo → UV del video: prima lo specchio (x invertita), poi il ritaglio "cover".
vec2 videoUv(vec2 screenUv) {
  return vec2(1.0 - screenUv.x, screenUv.y) * uCoverScale + uCoverOffset;
}

// Quanto il punto dello schermo appartiene alla persona (0..1, con bordo morbido).
// La texture del video è capovolta in y, la maschera no: per questo 1.0 - y.
float personAt(vec2 screenUv) {
  vec2 v = videoUv(screenUv);
  float m = texture(uMask, vec2(v.x, 1.0 - v.y)).r;
  return smoothstep(uMaskThreshold - uMaskFeather, uMaskThreshold + uMaskFeather, m);
}

// Porta un punto (in UV dello schermo) al centro del suo blocco di lato `size` pixel.
vec2 snapToGrid(vec2 uv, float size) {
  vec2 px = uv * uResolution;
  return (floor(px / size) + 0.5) * size / uResolution;
}

// Arrotonda uno spostamento (in UV) a un numero intero di pixel di lato `size`.
vec2 snapOffset(vec2 offset, float size) {
  return floor(offset * uResolution / size + 0.5) * size / uResolution;
}

void main() {
  float k = clamp(uIntensity, 0.0, 1.0);
  float burst = uBurst;
  // "Energia" complessiva: durante un burst supera 1, così ogni componente si spinge oltre.
  float energy = k + burst;
  vec2 px = gl_FragCoord.xy;

  // --- 0. Zone ---------------------------------------------------------------
  // Griglia grossa di rettangoli larghi (come i blocchi di un video compresso male).
  // Ogni zona cambia a un ritmo suo e riceve una sua dose di glitch: l'effetto è irregolare.
  vec2 zoneSize = vec2(uPixelSize * 9.0, uPixelSize * 4.0);
  vec2 zone = floor(px / zoneSize);
  float zoneRate = uSliceSpeed * (0.35 + 1.3 * hash12(zone + 3.7));
  float zoneTick = floor(uTime * zoneRate + hash12(zone) * 10.0) + uBurstSeed * 17.0;
  float zoneRoll = hash12(zone + zoneTick * 1.37);
  float zoneAmount = mix(1.0, smoothstep(0.4, 1.0, zoneRoll) * 2.2, uPatchiness);
  float local = energy * zoneAmount;

  vec2 uv = vUv; // punto da cui prendiamo l'immagine (all'inizio: lo stesso punto)

  // --- 1. Pezzi spostati ------------------------------------------------------
  // In alcune zone il pezzo di immagine viene preso da un altro punto, anche in verticale:
  // il pezzo di persona finisce altrove e dove stava si apre un buco.
  // Durante ogni "scatto" il pezzo scivola (a passi di un pixel) invece di stare fermo.
  float zonePhase = fract(uTime * zoneRate + hash12(zone) * 10.0); // 0→1 dentro lo scatto corrente
  float pieceChance = clamp(uPieceDensity * local, 0.0, 1.0);
  float isPiece = step(1.0 - pieceChance, hash12(zone + zoneTick * 0.53 + 21.0));
  vec2 pieceDir = vec2(hash12(zone + zoneTick + 31.0), hash12(zone + zoneTick + 47.0)) * 2.0 - 1.0;
  pieceDir.y *= 0.5; // più spostamenti in orizzontale che in verticale, come nei glitch video
  float glide = 0.35 + 0.65 * zonePhase;
  uv += snapOffset(pieceDir * uPieceAmount * min(local, 1.5) * isPiece * glide, uPixelSize);

  // Seconda scala: blocchi più piccoli, più numerosi e più veloci, dentro e fuori dalle zone grandi.
  vec2 chipSize = vec2(uPixelSize * 4.0, uPixelSize * 2.0);
  vec2 chip = floor(px / chipSize);
  float chipRate = uSliceSpeed * (0.8 + 1.6 * hash12(chip + 2.3));
  float chipTime = uTime * chipRate + hash12(chip + 8.8) * 10.0;
  float chipTick = floor(chipTime) + uBurstSeed * 23.0;
  float chipChance = clamp(uPieceDensity * 0.8 * local, 0.0, 1.0);
  float isChip = step(1.0 - chipChance, hash12(chip + chipTick * 0.61 + 3.0));
  vec2 chipDir = vec2(hash12(chip + chipTick + 13.0), hash12(chip + chipTick + 17.0)) * 2.0 - 1.0;
  chipDir.y *= 0.4;
  float chipGlide = 0.35 + 0.65 * fract(chipTime);
  uv += snapOffset(chipDir * uPieceAmount * 0.5 * min(local, 1.5) * isChip * chipGlide, uPixelSize);

  // --- 2. Fasce spezzate -----------------------------------------------------
  // Segmenti di fasce orizzontali che scivolano di lato, a scatti di un pixel.
  float tick = floor(uTime * uSliceSpeed) + uBurstSeed * 17.0;
  float rows = uSliceCount * (1.0 + burst * 1.5);
  float band = floor(vUv.y * rows);
  float segments = 2.0 + floor(hash12(vec2(band, tick + 5.0)) * 7.0);
  float segment = floor(vUv.x * segments);
  float density = clamp(uSliceDensity * local, 0.0, 1.0);
  float isShifted = step(1.0 - density, hash12(vec2(band, tick) + segment * 13.1));
  float dir = hash12(vec2(band, tick + 11.0) + segment) * 2.0 - 1.0;
  uv.x += snapOffset(vec2(dir * uSliceAmount * local * isShifted, 0.0), uPixelSize).x;

  // Durante il burst tutto fa anche un piccolo salto verticale.
  uv.y += (hash12(vec2(uBurstSeed, 2.0)) - 0.5) * 0.06 * burst;

  // --- 3. Pixel ----------------------------------------------------------------
  float pixelChance = clamp(uPixelDensity * local, 0.0, 1.0);
  float isPixel = step(1.0 - pixelChance, hash12(zone + zoneTick * 0.71 + 9.1));
  float sizeStep = floor(hash12(zone + zoneTick + 5.3) * 3.0); // 0, 1, 2 → 1×, 2×, 4×
  float blockSize = uPixelSize * pow(2.0, sizeStep) * (1.0 + burst);
  // Anche i pezzi spostati diventano a blocchi: un pezzo che si muove non porta con sé l'immagine nitida.
  bool blocky = isPixel > 0.5 || isPiece > 0.5 || isChip > 0.5;
  if (blocky) uv = snapToGrid(uv, blockSize);

  // --- 3b. Strisciate ----------------------------------------------------------
  // In alcune zone una sola colonna di pixel viene stirata per tutta la larghezza della zona,
  // come nei video corrotti: dell'immagine restano solo strisce orizzontali di colore.
  float smearChance = clamp(uSmear * local, 0.0, 1.0);
  float isSmear = step(1.0 - smearChance, hash12(zone + zoneTick * 0.37 + 61.0));
  if (isSmear > 0.5) {
    float anchor = (zone.x + 0.2 + 0.6 * hash12(zone + zoneTick + 71.0)) * zoneSize.x / uResolution.x;
    uv.x = mix(uv.x, anchor, 0.92);
    uv.y = snapToGrid(uv, blockSize).y;
    blocky = true;
  }

  // --- Punti non toccati -------------------------------------------------------
  // Se questo punto non è stato né spostato né pixelato, mostriamo il video originale così com'è:
  // niente frange di colore, grana o scanlines. Così, dove l'effetto non c'è, la persona
  // si vede normale, senza aloni lungo il contorno.
  float movedPx = length((uv - vUv) * uResolution);
  if (movedPx < 0.5 && !blocky) {
    vec3 plain = texture(uVideo, videoUv(vUv)).rgb;
    if (uShowMask > 0.5) plain = mix(plain, vec3(1.0, 0.18, 0.39), personAt(vUv) * 0.4);
    outColor = vec4(plain, 1.0);
    return;
  }

  // --- 4. Contorni rotti ------------------------------------------------------
  // La maschera viene letta a blocchi (contorno a gradini) e ogni riga di blocchi è spostata
  // di poco a caso (contorno sfrangiato). Cresce con l'intensità.
  float edgeGrid = uPixelSize * mix(1.0, 3.0, k);
  float edgeRow = floor(px.y / edgeGrid);
  float edgeJitter = (hash12(vec2(edgeRow, tick + 77.0)) - 0.5) * 2.0 * uEdgeBreak * local;
  vec2 maskUv = uv + vec2(edgeJitter * 0.02, 0.0);
  if (uEdgeBreak > 0.0) maskUv = snapToGrid(maskUv, edgeGrid);
  // Quanto il pezzo preso è "persona": decide se qui si vede la persona o lo sfondo.
  float piecePerson = personAt(maskUv);

  // --- 5. Colore del pezzo (persona con il glitch) ----------------------------
  float shift = uRgbShift * (k + burst * 2.0) * (1.0 + isShifted * 1.5) * mix(0.4, 1.4, zoneRoll);
  float shiftStep = blocky ? blockSize : uPixelSize * 0.5;
  vec2 offset = vec2(snapOffset(vec2(shift, 0.0), shiftStep).x, 0.0);
  vec3 col = vec3(
    texture(uVideo, videoUv(uv + offset)).r,
    texture(uVideo, videoUv(uv)).g,
    texture(uVideo, videoUv(uv - offset)).b
  );
  // Livelli di colore ridotti nelle zone a pixel (al massimo, 32, la riduzione è spenta).
  if (blocky && uPosterize < 31.5) col = floor(col * uPosterize + 0.5) / uPosterize;

  // Scanlines: solo sui pezzi spostati, come un segnale disturbato.
  float lines = 0.5 + 0.5 * cos(px.y * 6.2831853 / uScanlineSpacing);
  col *= 1.0 - uScanlines * mix(0.35, 1.0, k) * lines;

  // Grana (a blocchi nelle zone pixelate).
  float grainCell = blocky ? blockSize : 1.0;
  float noise = hash12(floor(px / grainCell) + fract(uTime * 7.13) * 431.0) - 0.5;
  col += noise * uGrain * mix(0.25, 1.0, min(energy, 1.5));
  col = clamp(col, 0.0, 1.0);

  // --- 6. Sfondo ---------------------------------------------------------------
  // Se qui, nel video vero, non c'è la persona, lo sfondo è semplicemente il video.
  // Se invece c'è (cioè questo è un buco lasciato da un pezzo spostato), usiamo la lastra.
  vec2 here = videoUv(vUv);
  vec3 live = texture(uVideo, here).rgb;
  vec4 plate = texture(uBackground, here);
  // Dove lo sfondo non è ancora stato visto mostriamo il video vero: il buco semplicemente non si vede.
  vec3 hidden = mix(live, plate.rgb, smoothstep(0.5, 0.95, plate.a));
  float personHere = personAt(vUv);

  // --- 7. Composizione ---------------------------------------------------------
  // Prima i pezzi di persona sopra il video; poi i buchi: dove qui c'era la persona ma il pezzo
  // preso è sfondo, mostriamo la lastra dello sfondo.
  vec3 result = mix(live, col, piecePerson);
  float hole = clamp(personHere - piecePerson, 0.0, 1.0);
  result = mix(result, hidden, hole);

  if (uShowMask > 0.5) result = mix(result, vec3(1.0, 0.18, 0.39), personHere * 0.4);

  outColor = vec4(result, 1.0);
}
