// Koi Pond: a pixel-art pond seen from above, with koi and water lilies.
//
// Everything is drawn pixel by pixel into one small image (one "cell" = a few screen pixels),
// which CSS scales up with sharp edges. No anti-aliasing anywhere: shapes have hard edges and
// dark 1-pixel outlines, and soft transitions use ordered dithering, like hand-made pixel art.
//
// Each frame:
//   1. under the surface: the pond floor (painted once), shadows of pads and fish, the fish
//   2. the surface: a ripple simulation bends that picture and adds bands of light
//   3. on top: food, lily pads and flowers
//
// Tap: drops food, the koi swim up to eat it. Drag: stirs the water, pushes the pads and
// startles the fish nearby. With a mouse, moving over the water leaves a light wake.

(() => {
  "use strict";

  const canvas = document.getElementById("pond");
  const ctx = canvas.getContext("2d");
  const hint = document.getElementById("hint");

  const TAU = Math.PI * 2;
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (list) => list[(Math.random() * list.length) | 0];
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const scale = (c, k) => [c[0] * k, c[1] * k, c[2] * k];

  // Ordered dithering: a fixed 4×4 pattern of thresholds between 0 and 1.
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
  const bayer = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];

  // Water: the ripple simulation runs at a fixed 60 steps per second.
  const DAMPING = 0.984; // how fast ripples fade (closer to 1 = longer)
  const REFRACTION = 4; // how far the ripples bend what is underneath, in cells
  const STEP = 1 / 60;

  let W = 0, H = 0, SHORT = 0;
  let cur, prev, image, out, scene, floorBuf;
  let fish = [], pads = [], food = [];
  let nextDrop = 3;

  // Writes one colour into a pixel buffer, if the pixel is on screen.
  function put(buf, x, y, c) {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const k = (y * W + x) * 4;
    buf[k] = c[0]; buf[k + 1] = c[1]; buf[k + 2] = c[2];
  }

  function darken(buf, x, y, f) {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const k = (y * W + x) * 4;
    buf[k] *= f; buf[k + 1] *= f; buf[k + 2] *= f;
  }

  // ---------- Size ----------

  function resize() {
    const vw = window.innerWidth, vh = window.innerHeight;
    if (!vw || !vh) return; // not laid out yet (e.g. a hidden tab)
    // Each cell is a whole number of device pixels, so the pixels stay perfectly square and sharp.
    const dpr = window.devicePixelRatio || 1;
    const cell = Math.max(2, Math.round((vw < 700 ? 2.7 : 3) * dpr));
    const oldW = W, oldH = H;
    W = Math.ceil((vw * dpr) / cell);
    H = Math.ceil((vh * dpr) / cell);
    SHORT = Math.min(W, H);
    canvas.width = W;
    canvas.height = H;
    canvas.style.width = (W * cell) / dpr + "px";
    canvas.style.height = (H * cell) / dpr + "px";
    canvas.cellCss = cell / dpr;
    cur = new Float32Array(W * H);
    prev = new Float32Array(W * H);
    image = ctx.createImageData(W, H);
    out = image.data;
    for (let k = 3; k < out.length; k += 4) out[k] = 255;
    scene = new Uint8ClampedArray(W * H * 4);
    paintFloor();

    if (!oldW) {
      populate();
    } else {
      const sx = W / oldW, sy = H / oldH;
      for (const f of fish) { for (const p of f.pts) { p.x *= sx; p.y *= sy; } f.goal = null; }
      for (const p of pads) {
        p.x *= sx; p.y *= sy;
        p.ix = Math.round(p.x); p.iy = Math.round(p.y);
      }
      for (const p of food) { p.x *= sx; p.y *= sy; }
    }
  }

  // ---------- Pond floor ----------

  // Smooth random values on a grid.
  function makeNoise(cellSize) {
    const gw = Math.ceil(W / cellSize) + 2, gh = Math.ceil(H / cellSize) + 2;
    const grid = Float32Array.from({ length: gw * gh }, Math.random);
    const s = (t) => t * t * (3 - 2 * t);
    return (x, y) => {
      const gx = x / cellSize, gy = y / cellSize;
      const ix = gx | 0, iy = gy | 0, tx = s(gx - ix), ty = s(gy - iy);
      const a = grid[iy * gw + ix], b = grid[iy * gw + ix + 1];
      const c = grid[(iy + 1) * gw + ix], d = grid[(iy + 1) * gw + ix + 1];
      return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
    };
  }

  const FLOOR = ["#0b2a2a", "#0f3533", "#13403c", "#184b45", "#1e574e", "#266457"].map(hex);
  const STONES = [
    ["#2c5a4e", "#427566", "#1e443b"],
    ["#36574a", "#4f7360", "#273f35"],
    ["#26504b", "#3a6b63", "#1b3b37"],
    ["#3f5c4b", "#5a7a63", "#2c4336"],
  ].map((s) => s.map(hex));
  const WEEDS = ["#0c2f24", "#123d2c", "#1a4d33"].map(hex);
  const WEED_TIP = hex("#2a6a40");

  function paintFloor() {
    floorBuf = new Uint8ClampedArray(W * H * 4);
    const big = makeNoise(Math.max(12, SHORT * 0.25)), small = makeNoise(16);
    const cx = W / 2, cy = H / 2, maxR = Math.hypot(cx, cy);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const n = big(x, y) * 0.78 + small(x, y) * 0.22;
        const depth = 1 - Math.hypot(x - cx, y - cy) / maxR; // deeper in the middle
        const v = 0.12 + n * 0.85 - depth * 0.35;
        const i = clamp(Math.floor(v * FLOOR.length + bayer(x, y) - 0.5), 0, FLOOR.length - 1);
        put(floorBuf, x, y, FLOOR[i]);
      }
    }
    // Pebbles: little ovals, lit from the top left.
    const sparse = location.search.includes("cover") ? 3 : 1; // a quieter floor for the cover
    for (let n = 0, count = (W * H) / 420 / sparse; n < count; n++) {
      const px = rand(0, W), py = rand(0, H), rx = rand(1, 2.6), ry = rand(0.8, 1.8);
      const [base, light, dark] = pick(STONES);
      for (let y = Math.floor(py - ry); y <= Math.ceil(py + ry); y++) {
        for (let x = Math.floor(px - rx); x <= Math.ceil(px + rx); x++) {
          const dx = (x + 0.5 - px) / rx, dy = (y + 0.5 - py) / ry;
          if (dx * dx + dy * dy > 1) continue;
          put(floorBuf, x, y, dx + dy < -0.6 ? light : dx + dy > 0.5 ? dark : base);
        }
      }
    }
    // Clumps of weed: a few wavy strands each.
    for (let n = 0, count = ((W * H) / 6000 + 3) / sparse; n < count; n++) {
      const bx = rand(0, W), by = rand(0, H);
      for (let s = 0, strands = 4 + ((Math.random() * 5) | 0); s < strands; s++) {
        let x = bx + rand(-2, 2), y = by + rand(-2, 2), a = rand(0, TAU);
        const len = rand(5, 14), color = pick(WEEDS);
        for (let k = 0; k < len; k++) {
          put(floorBuf, Math.round(x), Math.round(y), k > len - 2 ? WEED_TIP : color);
          a += rand(-0.5, 0.5);
          x += Math.cos(a); y += Math.sin(a);
        }
      }
    }
  }

  // ---------- Koi ----------

  // Colours of the classic varieties. Each colour gets a darker and a lighter version for
  // shading, worked out once.
  const tone = (h) => { const c = hex(h); return { c, shade: scale(c, 0.8), light: mix(c, [255, 255, 255], 0.35) }; };
  const RED = tone("#ff5e00"), DEEP_RED = tone("#e2421a"), WHITE = tone("#f4efe5"), BLACK = tone("#26262a");
  const GOLD = tone("#f2b73c"), YELLOW = tone("#f5d24a"), CHA = tone("#c4733a");
  const VARIETIES = [
    { base: WHITE, patches: [[RED, 3, 1.1]] }, // kohaku
    { base: WHITE, patches: [[DEEP_RED, 2, 1.25]] }, // kohaku
    { base: WHITE, patches: [[RED, 3, 1.05], [BLACK, 4, 0.45]] }, // sanke
    { base: BLACK, patches: [[RED, 3, 1.05], [WHITE, 2, 0.8]] }, // showa
    { base: WHITE, patches: [], crown: RED }, // tancho
    { base: GOLD, patches: [], shine: true }, // ogon
    { base: YELLOW, patches: [], shine: true }, // yamabuki
    { base: CHA, patches: [] }, // chagoi
    { base: RED, patches: [[WHITE, 1, 0.9]] },
  ];
  const WATER_TINT = hex("#17483f");

  const SEGMENTS = 10;

  function bodyWidth(u) {
    if (u < 0.3) return 0.62 + 0.38 * Math.sin((u / 0.3) * Math.PI / 2);
    return 1 - Math.pow((u - 0.3) / 0.7, 1.25) * 0.84;
  }

  function insidePolygon(px, py, pts) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }

  class Koi {
    constructor(x, y, len, variety) {
      this.len = len;
      this.seg = len / (SEGMENTS - 1);
      this.width = len * 0.13;
      this.v = variety;
      this.outline = mix(scale(variety.base.c, 0.4), [8, 26, 24], 0.5);
      this.fin = variety.base === BLACK ? hex("#55585e") : mix(variety.base.c, [240, 244, 240], 0.55);
      this.finRim = scale(this.fin, 0.82);
      this.a = rand(0, TAU);
      this.pts = [];
      for (let i = 0; i < SEGMENTS; i++) {
        this.pts.push({ x: x - Math.cos(this.a) * this.seg * i, y: y - Math.sin(this.a) * this.seg * i });
      }
      // Each fish has its own character: pace, how wide it turns, how much it wanders,
      // and where it likes to be (along the edges, in open water, or anywhere).
      this.cruise = len * rand(0.28, 0.55); // cells per second
      this.speed = this.cruise;
      this.turnRate = rand(0.35, 0.75); // rad per second: low = wide, calm curves
      this.wobble = rand(0.1, 0.35);
      this.likes = pick(["edges", "open", "anywhere", "anywhere"]);
      this.leader = null; // some fish loosely follow another one
      this.goal = null;
      this.goalTime = 0;
      this.rest = rand(4, 14); // seconds until the next slow glide
      this.gliding = 0;
      this.beat = rand(0, TAU);
      this.t = rand(0, 1000);
      this.phase = [rand(0, TAU), rand(0, TAU)];
      this.z = rand(0.2, 0.8); // depth: 0 at the surface
      this.depthGoal = this.z;
      this.fear = 0;
      this.flee = { x: 0, y: 0 };
      this.target = null;
      this.notice = 0;
      this.drawn = this.pts.map((p) => ({ x: p.x, y: p.y, nx: 0, ny: 0, dx: 1, dy: 0 }));

      // Patches, in body coordinates: u along the body (0 nose, 1 tail), s across (-1..1).
      this.patches = [];
      for (const [color, count, size] of variety.patches) {
        const n = Math.max(1, Math.round(count * rand(0.7, 1.3)));
        for (let i = 0; i < n; i++) {
          const u = rand(0.06, 0.78), s = rand(-0.6, 0.6);
          for (let j = 0; j < 3; j++) {
            this.patches.push({
              color,
              u: clamp(u + rand(-0.06, 0.06), 0.02, 0.9),
              s: clamp(s + rand(-0.5, 0.5), -1.2, 1.2),
              r: this.width * size * rand(0.5, 0.85),
              ph: rand(0, TAU),
            });
          }
        }
      }
    }

    pickGoal() {
      const head = this.pts[0], m = this.len * 1.4;
      let best = null, bestScore = -Infinity;
      for (let i = 0; i < 12; i++) {
        let x = rand(m, W - m), y = rand(m, H - m);
        if (this.likes === "edges") {
          const side = (Math.random() * 4) | 0;
          if (side === 0) x = rand(m, m * 2.2);
          if (side === 1) x = rand(W - m * 2.2, W - m);
          if (side === 2) y = rand(m, m * 2.2);
          if (side === 3) y = rand(H - m * 2.2, H - m);
        } else if (this.likes === "open") {
          x = rand(0.25, 0.75) * W; y = rand(0.25, 0.75) * H;
        }
        const dx = x - head.x, dy = y - head.y, d = Math.hypot(dx, dy);
        const ahead = (dx * Math.cos(this.a) + dy * Math.sin(this.a)) / (d || 1);
        const score = d / SHORT + ahead * 0.5 + rand(0, 0.4);
        if (score > bestScore) { bestScore = score; best = { x, y }; }
      }
      this.goal = best;
      this.goalTime = 0;
    }

    update(dt) {
      this.t += dt;
      const head = this.pts[0];
      const hx = Math.cos(this.a), hy = Math.sin(this.a);
      let vx = hx * 1.2, vy = hy * 1.2; // keep going roughly the same way: calm

      // Head for the goal; followers trail behind their leader instead.
      this.goalTime += dt;
      let gx, gy;
      if (this.leader) {
        const tail = this.leader.pts[SEGMENTS - 1];
        gx = tail.x - Math.cos(this.leader.a) * this.len * 0.6 + Math.sin(this.phase[0]) * this.len * 0.5;
        gy = tail.y - Math.sin(this.leader.a) * this.len * 0.6 + Math.cos(this.phase[0]) * this.len * 0.5;
        if (Math.random() < dt * 0.005) this.leader = null;
      } else {
        if (!this.goal || this.goalTime > 40) this.pickGoal();
        if (Math.hypot(this.goal.x - head.x, this.goal.y - head.y) < this.len * 1.2) this.pickGoal();
        gx = this.goal.x; gy = this.goal.y;
      }
      const gd = Math.hypot(gx - head.x, gy - head.y) || 1;
      vx += ((gx - head.x) / gd) * 1.1;
      vy += ((gy - head.y) / gd) * 1.1;

      // A light, slow sway so the paths are curves, not straight lines.
      const sway = Math.sin(this.t * 0.23 + this.phase[0]) * this.wobble + Math.sin(this.t * 0.09 + this.phase[1]) * this.wobble * 0.6;
      vx += Math.cos(this.a + Math.PI / 2) * sway;
      vy += Math.sin(this.a + Math.PI / 2) * sway;

      const m = this.len * 1.1;
      if (head.x < m) vx += ((m - head.x) / m) * 3;
      if (head.x > W - m) vx -= ((head.x - (W - m)) / m) * 3;
      if (head.y < m) vy += ((m - head.y) / m) * 3;
      if (head.y > H - m) vy -= ((head.y - (H - m)) / m) * 3;

      for (const o of fish) {
        if (o === this) continue;
        const dx = head.x - o.pts[2].x, dy = head.y - o.pts[2].y;
        const d = Math.hypot(dx, dy), r = (this.len + o.len) * 0.4;
        if (d > 0 && d < r) { vx += (dx / d) * (1 - d / r) * 1.6; vy += (dy / d) * (1 - d / r) * 1.6; }
      }

      // Food: pick the closest pellet nearby and go for it.
      if (this.target && this.target.eaten) this.target = null;
      if (!this.target && food.length) {
        let best = null, bestD = Math.max(this.len * 5, SHORT * 0.5);
        for (const p of food) {
          const d = Math.hypot(p.x - head.x, p.y - head.y);
          if (!p.eaten && !(p.land > 0) && d < bestD) { best = p; bestD = d; }
        }
        if (best) { this.target = best; this.notice = rand(0.1, 0.9); }
      }
      let goal = 1;
      if (this.target && (this.notice -= dt) <= 0) {
        const dx = this.target.x - head.x, dy = this.target.y - head.y, d = Math.hypot(dx, dy) || 0.01;
        vx += (dx / d) * 3.2;
        vy += (dy / d) * 3.2;
        goal = 2 * clamp(d / (this.len * 0.9), 0.35, 1);
        this.depthGoal = 0;
        if (d < Math.max(2, this.len * 0.08)) {
          this.target.eaten = true;
          this.target = null;
          ripple(head.x + hx * 1.5, head.y + hy * 1.5, 2, 0.9);
          this.depthGoal = rand(0.2, 0.8);
        }
      } else if (!this.target && Math.random() < dt * 0.08) {
        this.depthGoal = rand(0.1, 0.85);
      }

      // Startled: dart away for a moment.
      if (this.fear > 0) {
        this.fear -= dt;
        vx += this.flee.x * 5;
        vy += this.flee.y * 5;
        goal = 3.4;
        this.depthGoal = 0.9;
      }

      // Now and then a slow glide, almost still, before swimming on.
      if (this.gliding > 0) {
        this.gliding -= dt;
        if (goal === 1) goal = 0.35;
      } else if ((this.rest -= dt) <= 0) {
        this.gliding = rand(2, 5);
        this.rest = rand(8, 22);
      }

      // Turning eases in: small corrections are gentle, never a sudden swerve.
      const rate = this.fear > 0 ? 3.5 : this.target ? 1.8 : this.turnRate;
      const diff = wrapAngle(Math.atan2(vy, vx) - this.a);
      this.a = wrapAngle(this.a + clamp(diff * 1.5, -rate, rate) * dt);
      const want = this.cruise * goal * (0.9 + 0.1 * Math.sin(this.t * 0.5 + this.phase[0]));
      this.speed += (want - this.speed) * Math.min(1, dt * (this.fear > 0 ? 3 : 0.8));
      this.z += (this.depthGoal - this.z) * Math.min(1, dt * 0.8);

      head.x += Math.cos(this.a) * this.speed * dt;
      head.y += Math.sin(this.a) * this.speed * dt;

      // Close to the surface, the fish leaves small rings now and then.
      if (this.z < 0.12 && Math.random() < dt * 0.5) ripple(head.x, head.y, 1.4, 0.25);

      // The body follows the head like a chain.
      for (let i = 1; i < SEGMENTS; i++) {
        const p = this.pts[i], q = this.pts[i - 1];
        const dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy) || 1;
        p.x = q.x - (dx / d) * this.seg;
        p.y = q.y - (dy / d) * this.seg;
      }

      // Tail beat: faster when swimming fast. It only bends the drawn body, not the chain.
      this.beat += dt * (2.2 + (this.speed / this.len) * 5);
      const amp = this.len * 0.05;
      for (let i = 0; i < SEGMENTS; i++) {
        const p = this.pts[i], o = this.drawn[i];
        let dx, dy;
        if (i === 0) { dx = Math.cos(this.a); dy = Math.sin(this.a); } else {
          dx = this.pts[i - 1].x - p.x; dy = this.pts[i - 1].y - p.y;
          const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
        }
        const u = i / (SEGMENTS - 1);
        const bend = Math.sin(this.beat - u * 3.2) * amp * (0.15 + u * u);
        o.dx = dx; o.dy = dy; o.nx = -dy; o.ny = dx;
        o.x = p.x + o.nx * bend;
        o.y = p.y + o.ny * bend;
      }
    }

    // Rasterises the fish into a small grid of pixels around it. Each pixel gets a kind
    // (0 empty, 1 see-through fin, 2 fin edge, 3 body) and a colour.
    raster() {
      const d = this.drawn, wd = this.width, len = this.len;
      const nose = wd * 0.75;
      // Spine from the tip of the nose to the end of the body, with distances along it.
      const P = [[d[0].x + d[0].dx * nose, d[0].y + d[0].dy * nose], ...d.map((p) => [p.x, p.y])];
      const A = [0];
      for (let i = 1; i < P.length; i++) A.push(A[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
      const total = A[A.length - 1];
      const widthAt = (a) => (a < nose
        ? wd * 0.62 * Math.sqrt(Math.max(0, 1 - ((nose - a) / nose) ** 2))
        : wd * bodyWidth(clamp((a - nose) / (total - nose), 0, 1)));

      // Fins: two pectoral fins behind the head, and a two-lobed tail that follows the beat.
      const paddle = Math.sin(this.beat * 0.5) * 0.3;
      const pect = [];
      for (const s of [-1, 1]) {
        const p = d[2];
        const ang = Math.atan2(p.dy, p.dx) + s * (2.3 + paddle * s);
        const bx = p.x + p.nx * s * wd * 0.85, by = p.y + p.ny * s * wd * 0.85;
        pect.push({ x: bx + Math.cos(ang) * len * 0.08, y: by + Math.sin(ang) * len * 0.08,
          ca: Math.cos(ang), sa: Math.sin(ang), rx: Math.max(1.4, len * 0.1), ry: Math.max(0.9, len * 0.05) });
      }
      const t = d[SEGMENTS - 1];
      const axis = Math.atan2(-t.dy, -t.dx) + Math.sin(this.beat - 3.6) * 0.45;
      const tl = len * 0.27;
      const tp = (off, k) => [t.x + Math.cos(axis + off) * tl * k, t.y + Math.sin(axis + off) * tl * k];
      const flutter = Math.sin(this.beat * 1.3) * 0.08;
      const tail = [[t.x, t.y], tp(0.55, 0.5), tp(0.45 + flutter, 1), tp(0.2, 0.75), tp(0, 0.55),
        tp(-0.2, 0.75), tp(-0.45 + flutter, 1), tp(-0.55, 0.5)];

      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const [px, py] of [...P, ...tail]) {
        x0 = Math.min(x0, px); y0 = Math.min(y0, py); x1 = Math.max(x1, px); y1 = Math.max(y1, py);
      }
      const pad = wd + len * 0.18 + 2;
      x0 = Math.floor(x0 - pad); y0 = Math.floor(y0 - pad); x1 = Math.ceil(x1 + pad); y1 = Math.ceil(y1 + pad);
      const w = x1 - x0 + 1, h = y1 - y0 + 1;
      if (!this.kind || this.kind.length < w * h) {
        this.kind = new Uint8Array(w * h * 2);
        this.col = new Uint8ClampedArray(w * h * 6);
      }
      const kind = this.kind, col = this.col;
      kind.fill(0, 0, w * h);

      // Fins first; the body is drawn over them.
      for (let j = 0; j < h; j++) {
        for (let i = 0; i < w; i++) {
          const px = x0 + i + 0.5, py = y0 + j + 0.5;
          let hit = insidePolygon(px, py, tail);
          for (const f of pect) {
            if (hit) break;
            const lx = (px - f.x) * f.ca + (py - f.y) * f.sa, ly = -(px - f.x) * f.sa + (py - f.y) * f.ca;
            if ((lx / f.rx) ** 2 + (ly / f.ry) ** 2 <= 1) hit = true;
          }
          if (hit) kind[j * w + i] = 1;
        }
      }
      // Fin edges: fin pixels next to an empty one.
      for (let j = 0; j < h; j++) {
        for (let i = 0; i < w; i++) {
          const k = j * w + i;
          if (kind[k] !== 1) continue;
          if (i === 0 || j === 0 || i === w - 1 || j === h - 1 || !kind[k - 1] || !kind[k + 1] || !kind[k - w] || !kind[k + w]) kind[k] = 2;
        }
      }

      // Body: for each pixel, the closest point of the spine tells how far along the body it
      // is and on which side, which gives the outline, the patches and the shading.
      const v = this.v;
      const eyeA = nose + len * 0.05;
      for (let j = 0; j < h; j++) {
        for (let i = 0; i < w; i++) {
          const px = x0 + i + 0.5, py = y0 + j + 0.5;
          let best = Infinity, along = 0, side = 1;
          for (let s = 0; s < P.length - 1; s++) {
            const ax = P[s][0], ay = P[s][1], bx = P[s + 1][0] - ax, by = P[s + 1][1] - ay;
            const l2 = bx * bx + by * by || 1;
            const tt = clamp(((px - ax) * bx + (py - ay) * by) / l2, 0, 1);
            const qx = px - (ax + bx * tt), qy = py - (ay + by * tt);
            const dd = qx * qx + qy * qy;
            if (dd < best) { best = dd; along = A[s] + tt * Math.sqrt(l2); side = bx * qy - by * qx > 0 ? 1 : -1; }
          }
          const dist = Math.sqrt(best), wa = widthAt(along);
          if (dist > wa + 0.9 || wa <= 0) continue;
          const k = j * w + i;
          kind[k] = 3;
          let c;
          if (dist > wa - 0.1) {
            c = this.outline;
          } else {
            const u = (along - nose) / len, sn = (side * dist) / wa, across = side * dist;
            let t0 = v.base;
            for (const p of this.patches) {
              const du = along - (nose + p.u * len), ds = across - p.s * widthAt(nose + p.u * len);
              const r = p.r * (1 + 0.22 * Math.sin(3 * Math.atan2(ds, du) + p.ph));
              if (du * du + ds * ds < r * r) t0 = p.color;
            }
            if (v.crown) {
              const du = along - (nose + 0.1 * len);
              if (du * du + across * across < (wd * 0.6) ** 2) t0 = v.crown;
            }
            const edge = Math.abs(sn) + (bayer(x0 + i, y0 + j) - 0.5) * 0.18;
            if (edge > 0.66) c = t0.shade;
            else if (Math.abs(sn) < (v.shine ? 0.32 : 0.2) && u > 0.1 && u < 0.72) c = t0.light;
            else c = t0.c;
            // Eyes: one dark pixel each side of the head, on larger fish.
            if (wd >= 2.6 && Math.abs(along - eyeA) < 0.8 && Math.abs(Math.abs(across) - wa * 0.62) < 0.75) c = this.outline;
          }
          col[k * 3] = c[0]; col[k * 3 + 1] = c[1]; col[k * 3 + 2] = c[2];
        }
      }
      this.box = { x0, y0, w, h };
    }

    drawShadow() {
      const { x0, y0, w, h } = this.box, kind = this.kind;
      const ox = Math.round(2 + this.z * 4), oy = Math.round((2 + this.z * 4) * 1.3);
      for (let j = 0; j < h; j++) {
        for (let i = 0; i < w; i++) if (kind[j * w + i]) darken(scene, x0 + i + ox, y0 + j + oy, 0.62);
      }
    }

    draw() {
      const { x0, y0, w, h } = this.box, kind = this.kind, col = this.col;
      const depth = this.z * 0.32; // deeper fish take on the colour of the water
      const fin = mix(this.fin, WATER_TINT, depth), rim = mix(this.finRim, WATER_TINT, depth);
      for (let j = 0; j < h; j++) {
        const y = y0 + j;
        if (y < 0 || y >= H) continue;
        for (let i = 0; i < w; i++) {
          const x = x0 + i;
          if (x < 0 || x >= W) continue;
          const k = j * w + i, q = (y * W + x) * 4, kd = kind[k];
          if (kd === 3) {
            scene[q] = col[k * 3] + (WATER_TINT[0] - col[k * 3]) * depth;
            scene[q + 1] = col[k * 3 + 1] + (WATER_TINT[1] - col[k * 3 + 1]) * depth;
            scene[q + 2] = col[k * 3 + 2] + (WATER_TINT[2] - col[k * 3 + 2]) * depth;
          } else if (kd === 2) {
            scene[q] = rim[0]; scene[q + 1] = rim[1]; scene[q + 2] = rim[2];
          } else if (kd === 1) {
            // See-through fin: half fin, half what is behind it.
            scene[q] = (scene[q] + fin[0]) / 2; scene[q + 1] = (scene[q + 1] + fin[1]) / 2; scene[q + 2] = (scene[q + 2] + fin[2]) / 2;
          }
        }
      }
    }
  }

  // ---------- Lily pads and flowers ----------

  const PAD_TONES = [
    { fill: "#4f8f3c", light: "#6fae4a", dark: "#3b7330", rim: "#24481f", vein: "#7fbf55" },
    { fill: "#3f7d36", light: "#5c9a43", dark: "#2f6229", rim: "#1d3d1a", vein: "#6aa84a" },
    { fill: "#5e9c40", light: "#82b852", dark: "#467a31", rim: "#2a4d1f", vein: "#94c862" },
    { fill: "#6b8f3a", light: "#8aab4c", dark: "#53712c", rim: "#2f4519", vein: "#a0bd5e" },
  ].map((t) => Object.fromEntries(Object.entries(t).map(([k, v]) => [k, hex(v)])));
  const FLOWERS = [
    { outer: "#f29ab8", outerShade: "#d97399", inner: "#fcd3e1", innerShade: "#f2b3c9", line: "#9c4a66" },
    { outer: "#f7b9cd", outerShade: "#e494b0", inner: "#fff0f5", innerShade: "#f6d3df", line: "#a4607a" },
    { outer: "#f1ede4", outerShade: "#cfc8ba", inner: "#fffdf7", innerShade: "#e8e2d6", line: "#7f7a70" },
  ].map((t) => Object.fromEntries(Object.entries(t).map(([k, v]) => [k, hex(v)])));
  const POLLEN = hex("#f2be2f"), POLLEN_LIGHT = hex("#ffe07a");

  function makePad(x, y, r) {
    const rot = rand(0, TAU);
    const pad = {
      x, y, r, leaf: true,
      tone: pick(PAD_TONES), notch: rand(0.5, 0.8),
      rot, vx: 0, vy: 0, vr: 0,
      ix: Math.round(x), iy: Math.round(y), irot: rot, // where it is drawn
      flower: null, fx: 0, fy: 0,
    };
    const roll = Math.random();
    if (roll < 0.35) pad.flower = { tone: pick(FLOWERS), size: Math.max(3, r * rand(0.55, 0.75)), turn: rand(0, TAU), bud: false };
    else if (roll < 0.47) pad.flower = { tone: pick(FLOWERS), size: Math.max(2.5, r * 0.4), turn: rand(0, TAU), bud: true };
    if (pad.flower) { pad.fx = rand(-0.25, 0.25) * r; pad.fy = rand(-0.25, 0.25) * r; }
    return pad;
  }

  // Which part of a pad a point falls on: 0 outside, 1 rim, 2 vein, 3 leaf.
  function padPart(p, lx, ly) {
    const d = Math.hypot(lx, ly);
    if (d > p.r) return 0;
    const signed = wrapAngle(Math.atan2(ly, lx) - p.irot); // the notch is around angle 0
    const a = Math.abs(signed), half = p.notch / 2;
    if (a < half && d > 1.2) return 0;
    if (p.r - d < 1 || (a - half) * d < 1) return 1;
    if (d > 1.5 && d < p.r - 1.5) {
      const around = signed < 0 ? signed + TAU : signed; // 0..TAU, leaf between half and TAU - half
      for (let k = 1; k <= 6; k++) {
        if (Math.abs(around - (half + (k / 7) * (TAU - p.notch))) * d < 0.5) return 2;
      }
    }
    return 3;
  }

  function padShadow(p) {
    const cx = p.ix, cy = p.iy, r = Math.ceil(p.r) + 1;
    for (let y = cy - r; y <= cy + r; y++) {
      for (let x = cx - r; x <= cx + r; x++) {
        if (padPart(p, x + 0.5 - cx, y + 0.5 - cy)) darken(scene, x + 2, y + 3, 0.65);
      }
    }
  }

  function drawPad(p) {
    const cx = p.ix, cy = p.iy, r = Math.ceil(p.r) + 1, t = p.tone;
    for (let y = cy - r; y <= cy + r; y++) {
      for (let x = cx - r; x <= cx + r; x++) {
        const lx = x + 0.5 - cx, ly = y + 0.5 - cy;
        const part = padPart(p, lx, ly);
        if (!part) continue;
        let c;
        if (part === 1) c = t.rim;
        else if (part === 2) c = t.vein;
        else {
          // Lit from the top left, with a dithered edge between the tones.
          const l = (lx + ly) / p.r + (bayer(x, y) - 0.5) * 0.35;
          c = l < -0.6 ? t.light : l > 0.55 ? t.dark : t.fill;
        }
        put(out, x, y, c);
      }
    }
    if (p.flower) {
      // The flower turns with its leaf.
      const ca = Math.cos(p.irot), sa = Math.sin(p.irot);
      drawFlower(cx + 0.5 + p.fx * ca - p.fy * sa, cy + 0.5 + p.fx * sa + p.fy * ca, p.flower, true, p.irot);
    }
  }

  // A water lily drawn in polar coordinates: two rings of pointed petals and a yellow heart.
  function drawFlower(fx, fy, f, onLeaf, spin = 0) {
    const cx = Math.round(fx), cy = Math.round(fy), s = f.size, R = Math.ceil(s) + 2, t = f.tone;
    const turn = f.turn + spin;
    const shape = (lx, ly) => {
      const d = Math.hypot(lx, ly), th = Math.atan2(ly, lx) - turn;
      if (f.bud) {
        const ex = lx * Math.cos(turn) + ly * Math.sin(turn), ey = -lx * Math.sin(turn) + ly * Math.cos(turn);
        const v = (ex / (s * 0.55)) ** 2 + (ey / (s * 0.36)) ** 2;
        return v <= 1 ? (ex > s * 0.25 ? t.outerShade : ey < 0 ? t.inner : t.outer) : v <= 1.5 ? t.line : null;
      }
      const sector = TAU / 8, f1 = (((th % sector) + sector) % sector) / sector - 0.5;
      const e1 = s * (0.45 + 0.55 * (1 - 2 * Math.abs(f1)));
      const sector2 = TAU / 6, f2 = ((((th + sector2 / 2) % sector2) + sector2) % sector2) / sector2 - 0.5;
      const e2 = s * 0.62 * (0.5 + 0.5 * (1 - 2 * Math.abs(f2)));
      if (d <= s * 0.2 + 0.3) return lx + ly < 0 ? POLLEN_LIGHT : POLLEN;
      if (d <= e2) return f2 < 0 ? t.innerShade : t.inner;
      if (d <= e1) return f1 < 0 ? t.outerShade : t.outer;
      if (d <= e1 + 0.9) return t.line;
      return null;
    };
    // A soft shadow under the flower, on the leaf or the water.
    for (let y = cy - R; y <= cy + R; y++) {
      for (let x = cx - R; x <= cx + R; x++) if (shape(x + 0.5 - cx, y + 0.5 - cy)) darken(out, x + 1, y + 1, onLeaf ? 0.72 : 0.6);
    }
    for (let y = cy - R; y <= cy + R; y++) {
      for (let x = cx - R; x <= cx + R; x++) {
        const c = shape(x + 0.5 - cx, y + 0.5 - cy);
        if (c) put(out, x, y, c);
      }
    }
  }

  function slope(x, y) {
    const ix = clamp(x | 0, 1, W - 2), iy = clamp(y | 0, 1, H - 2), i = iy * W + ix;
    return [cur[i - 1] - cur[i + 1], cur[i - W] - cur[i + W]];
  }

  function heightAt(x, y) {
    return cur[clamp(Math.round(y), 0, H - 1) * W + clamp(Math.round(x), 0, W - 1)];
  }

  // A pad is only redrawn somewhere else once it has really moved most of a pixel (or turned
  // a little), so a pad at rest never flickers between two neighbouring pixels.
  function settleDrawn(p) {
    const stick = p.vx || p.vy ? 0.5 : 0.75; // while moving it simply follows, pixel by pixel
    if (Math.abs(p.x - p.ix) > stick) p.ix = Math.round(p.x);
    if (Math.abs(p.y - p.iy) > stick) p.iy = Math.round(p.y);
    if (Math.abs(wrapAngle(p.rot - p.irot)) > 0.06) p.irot = p.rot;
  }

  // Speed limits, in cells per second (a cell is about 3 screen pixels): higher while a finger
  // holds the pad, lower once it is let go, so the glide afterwards stays short and calm.
  const PAD_HELD_SPEED = 45, PAD_FREE_SPEED = 14;

  function updatePads(dt) {
    for (const p of pads) {
      // Waves push a pad away from their crests: compare the water height all round its edge.
      let fx = 0, fy = 0;
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * TAU, ca = Math.cos(a), sa = Math.sin(a);
        const h = heightAt(p.x + ca * (p.r + 1), p.y + sa * (p.r + 1));
        fx -= h * ca; fy -= h * sa;
      }
      const push = 30 / (p.r + 1);
      p.vx += fx * push * dt;
      p.vy += fy * push * dt;
      // Held by the finger: the pad eases into the finger's speed and gently closes the gap
      // to the point where it was touched, so it follows softly without falling behind.
      const held = pointer && pointer.grab && pointer.grab.pad === p && dt > 0;
      if (held) {
        const g = pointer.grab, tx = pointer.last.x - g.ox, ty = pointer.last.y - g.oy;
        const still = performance.now() - pointer.time > 60; // the finger has stopped
        const fvx = still ? 0 : pointer.vx, fvy = still ? 0 : pointer.vy;
        const ease = 1 - Math.exp(-dt / 0.12);
        p.vx += (fvx + (tx - p.x) * 2.5 - p.vx) * ease;
        p.vy += (fvy + (ty - p.y) * 2.5 - p.vy) * ease;
        // It turns gently to trail behind the finger.
        const lead = (g.ox * p.vy - g.oy * p.vx) / (p.r * p.r);
        p.vr += (lead * 0.08 - p.vr) * Math.min(1, dt * 3);
      }
      // Water drag: once let go, a pad glides on and slows down softly, then stays put.
      const drag = Math.pow(held ? 1 : 0.25, dt);
      p.vx *= drag; p.vy *= drag; p.vr *= Math.pow(0.4, dt);
      const v = Math.hypot(p.vx, p.vy);
      const cap = held ? PAD_HELD_SPEED : PAD_FREE_SPEED;
      if (v > cap) {
        // Above the limit, slow down quickly but smoothly rather than all at once.
        const f = held ? cap / v : Math.max(cap / v, Math.pow(0.08, dt));
        p.vx *= f; p.vy *= f;
      }
      p.vr = clamp(p.vr, -0.35, 0.35);
      // Below a crawl the pad simply rests, instead of creeping from pixel to pixel.
      if (!held && Math.hypot(p.vx, p.vy) < 0.12) { p.vx = 0; p.vy = 0; }
      if (Math.abs(p.vr) < 0.015) p.vr = 0;
      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      // A pad pushed through the water makes small ripples ahead of it.
      const sp = Math.hypot(p.vx, p.vy);
      if (sp > 4 && Math.random() < dt * 10) {
        ripple(p.x + (p.vx / sp) * (p.r + 1), p.y + (p.vy / sp) * (p.r + 1), 1.6, Math.min(0.3, sp * 0.015));
      }
      // Pads may poke out of the edges a little, but not drift away.
      const e = p.r * 0.4;
      if (p.x < e) { p.x = e; p.vx = Math.abs(p.vx) * 0.3; }
      if (p.x > W - e) { p.x = W - e; p.vx = -Math.abs(p.vx) * 0.3; }
      if (p.y < e) { p.y = e; p.vy = Math.abs(p.vy) * 0.3; }
      if (p.y > H - e) { p.y = H - e; p.vy = -Math.abs(p.vy) * 0.3; }
    }
    // Pads push each other apart gently.
    for (let i = 0; i < pads.length; i++) {
      for (let j = i + 1; j < pads.length; j++) {
        const a = pads[i], b = pads[j];
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 0.01;
        const overlap = (a.r + b.r) * 0.92 - d;
        if (overlap > 0) {
          const nx = dx / d, ny = dy / d, k = overlap * 0.5;
          a.x -= nx * k; a.y -= ny * k; b.x += nx * k; b.y += ny * k;
          const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
          if (rv < 0) {
            a.vx += nx * rv * 0.5; a.vy += ny * rv * 0.5; b.vx -= nx * rv * 0.5; b.vy -= ny * rv * 0.5;
            // A glancing knock turns both pads a little.
            const slide = (b.vx - a.vx) * -ny + (b.vy - a.vy) * nx;
            a.vr += slide * 0.02; b.vr -= slide * 0.02;
          }
        }
      }
    }
    for (const p of pads) settleDrawn(p);
  }

  // ---------- Setting up the pond ----------

  // A calm, composed scene for the Laboratory cover image (open the page with ?cover):
  // two koi circling each other in open water, a few lilies in two opposite corners.
  function composeCover() {
    const len = SHORT * 0.26, cx = W * 0.5, cy = H * 0.5, R = len * 0.62;
    const a = new Koi(cx, cy, len, VARIETIES[0]);
    const b = new Koi(cx, cy, len * 0.94, VARIETIES[1]);
    fish = [a, b];
    // Each body lies along the same circle, on opposite sides, both swimming around it.
    for (const [f, start] of [[a, -0.6], [b, Math.PI - 0.6]]) {
      f.pts.forEach((p, i) => {
        const t = start - (i * f.seg) / R;
        p.x = cx + Math.cos(t) * R; p.y = cy + Math.sin(t) * R;
      });
      f.a = start + Math.PI / 2;
      f.z = 0.15; f.depthGoal = 0.15; f.gliding = 1e9; // slow, close to the surface
      f.goal = { x: cx + Math.cos(start + 1) * R, y: cy + Math.sin(start + 1) * R };
    }
    const flower = (p, k) => ({ tone: FLOWERS[k], size: p.r * 0.62, turn: rand(0, TAU), bud: false });
    pads = [
      [0.1, 0.16, 0.1, 0], [0.22, 0.07, 0.065, -1], [0.06, 0.36, 0.055, -1],
      [0.9, 0.84, 0.11, 2], [0.76, 0.93, 0.07, -1], [0.95, 0.6, 0.055, 1],
      [0.84, 0.2, 0.06, 0],
    ].map(([x, y, r, f]) => {
      const p = makePad(x * W, y * H, SHORT * r);
      p.flower = f >= 0 ? flower(p, f) : null;
      p.fx = p.fy = 0;
      return p;
    });
    for (const p of pads) { p.ix = Math.round(p.x); p.iy = Math.round(p.y); p.irot = p.rot; }
  }

  function populate() {
    if (location.search.includes("cover")) { composeCover(); return; }
    const fishCount = clamp(Math.round((W * H) / 13000), 5, 10);
    const varieties = [...VARIETIES].sort(() => Math.random() - 0.5);
    fish = [];
    for (let i = 0; i < fishCount; i++) {
      const len = clamp(SHORT * rand(0.12, 0.16), 20, 48);
      fish.push(new Koi(rand(len, W - len), rand(len, H - len), len, varieties[i % varieties.length]));
    }
    for (let i = 1; i < fish.length; i += 4) fish[i].leader = fish[i - 1];

    // Lily pads grow in a few clusters.
    pads = [];
    const padCount = clamp(Math.round((W * H) / 6000), 8, 24);
    const clusters = Array.from({ length: Math.random() < 0.5 ? 3 : 4 }, () => ({
      x: rand(0.08, 0.92) * W, y: rand(0.08, 0.92) * H,
    }));
    for (let i = 0; i < padCount; i++) {
      const c = clusters[i % clusters.length];
      const r = clamp(SHORT * rand(0.035, 0.07), 6, 20);
      pads.push(makePad(c.x + rand(-1, 1) * SHORT * 0.14, c.y + rand(-1, 1) * SHORT * 0.14, r));
    }
    if (!pads.some((p) => p.flower && !p.flower.bud)) {
      pads[0].flower = { tone: pick(FLOWERS), size: Math.max(3, pads[0].r * 0.7), turn: rand(0, TAU), bud: false };
    }
    // Let the pads settle apart before the first frame.
    for (let i = 0; i < 60; i++) updatePads(0);
    for (const p of pads) {
      p.ix = Math.round(p.x); p.iy = Math.round(p.y); p.irot = p.rot;
    }
  }

  // ---------- Water ----------

  function ripple(x, y, radius, amount) {
    const r = Math.max(1, radius);
    const x0 = Math.max(1, Math.floor(x - r)), x1 = Math.min(W - 2, Math.ceil(x + r));
    const y0 = Math.max(1, Math.floor(y - r)), y1 = Math.min(H - 2, Math.ceil(y + r));
    for (let yy = y0; yy <= y1; yy++) {
      for (let xx = x0; xx <= x1; xx++) {
        const d = Math.hypot(xx - x, yy - y);
        if (d < r) cur[yy * W + xx] += amount * (Math.cos((d / r) * Math.PI) + 1) * 0.5;
      }
    }
  }

  // One step of the wave equation. The neighbours are weighed in all eight directions (not
  // just four), so rings spread as true circles instead of slightly square ones.
  const WAVE = 0.5 / 6;
  function stepWater() {
    const a = cur, b = prev;
    for (let y = 1; y < H - 1; y++) {
      for (let i = y * W + 1, end = y * W + W - 1; i < end; i++) {
        const side = a[i - 1] + a[i + 1] + a[i - W] + a[i + W];
        const corner = a[i - W - 1] + a[i - W + 1] + a[i + W - 1] + a[i + W + 1];
        b[i] = (2 * a[i] - b[i] + WAVE * (4 * side + corner - 20 * a[i])) * DAMPING;
      }
    }
    // Floating leaves calm the water underneath them.
    for (const p of pads) {
      const r = p.r - 1, x0 = Math.max(1, Math.ceil(p.x - r)), x1 = Math.min(W - 2, Math.floor(p.x + r));
      for (let y = Math.max(1, Math.ceil(p.y - r)), y1 = Math.min(H - 2, Math.floor(p.y + r)); y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          if ((x - p.x) ** 2 + (y - p.y) ** 2 < r * r) b[y * W + x] *= 0.92;
        }
      }
    }
    // The finger in the water: it holds a small dip where it touches and, when it moves,
    // drags that dip along, which leaves a wake behind it.
    if (pointer) {
      const from = pointer.inWater, to = pointer.last;
      const d = Math.hypot(to.x - from.x, to.y - from.y), n = Math.max(1, Math.ceil(d));
      for (let s = 1; s <= n; s++) press(from.x + ((to.x - from.x) * s) / n, from.y + ((to.y - from.y) * s) / n, 1.1, 2.6);
      pointer.inWater = { x: to.x, y: to.y };
    }
    prev = a;
    cur = b;
  }

  // Pulls the surface towards a rounded dip of the given depth (for something touching it).
  function press(x, y, depth, radius) {
    const x0 = Math.max(1, Math.floor(x - radius)), x1 = Math.min(W - 2, Math.ceil(x + radius));
    const y0 = Math.max(1, Math.floor(y - radius)), y1 = Math.min(H - 2, Math.ceil(y + radius));
    const b = prev; // the buffer being written in this step
    for (let yy = y0; yy <= y1; yy++) {
      for (let xx = x0; xx <= x1; xx++) {
        const dd = Math.hypot(xx - x, yy - y);
        if (dd >= radius) continue;
        const i = yy * W + xx, target = -depth * (Math.cos((dd / radius) * Math.PI) + 1) * 0.5;
        b[i] += (target - b[i]) * 0.35;
      }
    }
  }

  // Bends the picture under the surface along the slopes of the waves, and lights the slopes
  // in a few clean bands (dithered at the edges), with pale glints on the crests.
  const BAND = 11, GLINT = hex("#cfeee2");
  function renderWater() {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x, k = i * 4;
        let dx = 0, dy = 0;
        if (x > 0 && x < W - 1 && y > 0 && y < H - 1) {
          dx = cur[i - 1] - cur[i + 1];
          dy = cur[i - W] - cur[i + W];
        }
        const sx = clamp(Math.round(x + dx * REFRACTION), 0, W - 1);
        const sy = clamp(Math.round(y + dy * REFRACTION), 0, H - 1);
        const j = (sy * W + sx) * 4;
        const level = clamp(Math.round((dx + dy) * 6 + (bayer(x, y) - 0.5) * 0.9), -3, 4);
        let r = scene[j] + level * BAND, g = scene[j + 1] + level * BAND, b = scene[j + 2] + level * BAND * 0.9;
        if (level >= 3) { r = (r + GLINT[0] * 2) / 3; g = (g + GLINT[1] * 2) / 3; b = (b + GLINT[2] * 2) / 3; }
        out[k] = r; out[k + 1] = g; out[k + 2] = b;
      }
    }
  }

  // ---------- Food ----------

  const PELLET = [hex("#8a5428"), hex("#a86a32")], PELLET_LIGHT = hex("#d8a868");

  // A pinch of food: the pellets land one by one, each with its own little ring.
  function dropFood(x, y) {
    const n = 3 + ((Math.random() * 3) | 0);
    for (let i = 0; i < n; i++) {
      food.push({ x: x + rand(-3.5, 3.5), y: y + rand(-3.5, 3.5), age: 0, land: rand(0.05, 0.4), eaten: false, tone: (Math.random() * 2) | 0 });
    }
    if (food.length > 60) food.splice(0, food.length - 60);
  }

  function updateFood(dt) {
    for (const p of food) {
      if (p.land > 0) {
        p.land -= dt;
        if (p.land <= 0) ripple(p.x, p.y, 1.6, -0.75);
        continue;
      }
      p.age += dt;
      const [sx, sy] = slope(p.x, p.y);
      p.x += sx * 8 * dt;
      p.y += sy * 8 * dt;
    }
    food = food.filter((p) => !p.eaten && p.age < 40);
  }

  function drawFood() {
    for (const p of food) {
      if (p.land > 0) continue; // still falling
      if (p.age > 36 && bayer(Math.round(p.x), Math.round(p.y)) < (p.age - 36) / 4) continue; // fades out
      const x = Math.round(p.x), y = Math.round(p.y);
      darken(out, x + 1, y + 1, 0.6);
      put(out, x, y, PELLET[p.tone]);
      if (p.tone) put(out, x, y, PELLET_LIGHT);
    }
  }

  // ---------- Pointer ----------

  let pointer = null;
  let lastHover = null;
  let used = false;

  const toCell = (e) => ({ x: e.clientX / canvas.cellCss, y: e.clientY / canvas.cellCss });

  // The pad under a point (the top one if several overlap), and where it was touched.
  function grabAt(p) {
    for (let i = pads.length - 1; i >= 0; i--) {
      const pad = pads[i];
      if (pad.leaf && Math.hypot(p.x - pad.x, p.y - pad.y) < pad.r) return { pad, ox: p.x - pad.x, oy: p.y - pad.y };
    }
    return null;
  }

  canvas.addEventListener("pointerdown", (e) => {
    try { canvas.setPointerCapture(e.pointerId); } catch { /* the pointer is already gone */ }
    const p = toCell(e);
    // The finger touches the water here; stepWater keeps pressing where it is.
    pointer = { id: e.pointerId, start: p, last: p, inWater: p, time: performance.now(), moved: 0, grab: grabAt(p), vx: 0, vy: 0 };
    ripple(p.x, p.y, 2.6, -0.9); // the finger breaking the surface
    firstUse();
  });

  canvas.addEventListener("pointermove", (e) => {
    const p = toCell(e);
    if (pointer && e.pointerId === pointer.id) {
      const now = performance.now();
      const d = Math.hypot(p.x - pointer.last.x, p.y - pointer.last.y);
      pointer.moved += d;
      const ms = Math.max(1, now - pointer.time);
      const vx = ((p.x - pointer.last.x) / ms) * 1000, vy = ((p.y - pointer.last.y) / ms) * 1000;
      const speed = Math.hypot(vx, vy);
      pointer.vx += (vx - pointer.vx) * 0.4; // smoothed finger speed
      pointer.vy += (vy - pointer.vy) * 0.4;
      // A finger that runs into a pad takes hold of it (updatePads makes it follow softly);
      // pads close to the stroke are carried a little by the moving water.
      if (!pointer.grab) pointer.grab = grabAt(p);
      for (const pad of pads) {
        if (pointer.grab && pointer.grab.pad === pad) continue;
        const dist = Math.hypot(p.x - pad.x, p.y - pad.y), reach = pad.r + 7;
        if (dist < reach) {
          const k = (1 - dist / reach) * 0.08;
          pad.vx += (vx * 0.3 - pad.vx) * k;
          pad.vy += (vy * 0.3 - pad.vy) * k;
        }
      }
      // Fast strokes close to a fish startle it.
      if (speed > 60) {
        for (const f of fish) {
          const h = f.pts[1];
          const fx = h.x - p.x, fy = h.y - p.y, dist = Math.hypot(fx, fy);
          if (dist < f.len * 1.4) {
            f.fear = rand(0.8, 1.4);
            f.flee = { x: fx / (dist || 1), y: fy / (dist || 1) };
            f.target = null;
          }
        }
      }
      pointer.last = p;
      pointer.time = now;
    } else if (e.pointerType === "mouse") {
      // Just hovering with the mouse: the lightest touch, a faint wake.
      if (lastHover) {
        const dx = p.x - lastHover.x, dy = p.y - lastHover.y, n = Math.ceil(Math.hypot(dx, dy) / 1.5);
        for (let s = 1; s <= n; s++) ripple(lastHover.x + (dx * s) / n, lastHover.y + (dy * s) / n, 1.8, -0.05);
      }
      lastHover = p;
    }
  });

  canvas.addEventListener("pointerup", (e) => {
    if (!pointer || e.pointerId !== pointer.id) return;
    // Let go of a pad after resting the finger: it stays right there instead of drifting.
    if (pointer.grab && performance.now() - pointer.time > 60) { pointer.grab.pad.vx = 0; pointer.grab.pad.vy = 0; }
    // A tap (no real drag) drops food.
    if (pointer.moved < 3) dropFood(pointer.start.x, pointer.start.y);
    pointer = null;
  });
  canvas.addEventListener("pointercancel", (e) => { if (pointer && e.pointerId === pointer.id) pointer = null; });
  canvas.addEventListener("pointerleave", () => { lastHover = null; });

  function firstUse() {
    if (used) return;
    used = true;
    setTimeout(() => hint.classList.add("is-faded"), 5000);
  }

  // ---------- Loop ----------

  let last = performance.now();
  let acc = 0;

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!W) { resize(); return; }
    tick(dt);
  }

  // Moves everything on by dt seconds and draws the result.
  function tick(dt) {
    // Now and then something touches the surface: an insect, a drop.
    if ((nextDrop -= dt) <= 0) {
      nextDrop = rand(3, 7);
      ripple(rand(0, W), rand(0, H), rand(1, 1.6), rand(0.3, 0.6));
    }

    acc += dt;
    let steps = 0;
    while (acc >= STEP && steps < 3) { stepWater(); acc -= STEP; steps++; }
    if (steps === 3) acc = 0;

    for (const f of fish) f.update(dt);
    updatePads(dt);
    updateFood(dt);

    // Under the surface: floor, shadows from above, fish (deepest first).
    scene.set(floorBuf);
    for (const p of pads) padShadow(p);
    for (const f of fish) f.raster();
    for (const f of fish) f.drawShadow();
    for (const f of [...fish].sort((a, b) => b.z - a.z)) f.draw();

    // The surface, then what floats on it.
    renderWater();
    drawFood();
    for (const p of pads) drawPad(p);
    ctx.putImageData(image, 0, 0);
  }

  let resizeTimer = 0;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 120);
  });
  resize();
  requestAnimationFrame((t) => { last = t; frame(t); });

  // With ?debug in the address, the fish can be inspected from the browser console.
  if (location.search.includes("debug")) window.pond = { get fish() { return fish; }, get pads() { return pads; }, tick };
})();
