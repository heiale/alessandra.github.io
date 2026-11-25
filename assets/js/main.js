// Mobile menu overlay
(function () {
  var toggle = document.querySelector('.menu-toggle');
  var menu = document.getElementById('menu');
  if (!toggle || !menu) return;
  var close = menu.querySelector('.menu-close');

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  // Opening: the menu unrolls from the top down (CSS). Closing: it rolls back up, then hides.
  function setOpen(open) {
    toggle.setAttribute('aria-expanded', String(open));
    document.body.style.overflow = open ? 'hidden' : '';
    if (open) {
      menu.classList.remove('is-closing');
      menu.hidden = false;
      close.focus();
      return;
    }
    toggle.focus();
    if (reduceMotion.matches) { menu.hidden = true; return; }
    menu.classList.add('is-closing');
    var finished = false;
    function finish() {
      if (finished) return;
      finished = true;
      menu.removeEventListener('animationend', onEnd);
      if (menu.classList.contains('is-closing')) {
        menu.classList.remove('is-closing');
        menu.hidden = true;
      }
    }
    function onEnd(e) { if (e.target === menu) finish(); }  // ignore the links' own animations
    menu.addEventListener('animationend', onEnd);
    setTimeout(finish, 500);  // in case the animation does not run at all
  }

  toggle.addEventListener('click', function () { setOpen(true); });
  close.addEventListener('click', function () { setOpen(false); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !menu.hidden) setOpen(false);
  });
  window.matchMedia('(min-width: 800px)').addEventListener('change', function (e) {
    if (e.matches && !menu.hidden) setOpen(false);
  });
})();

// Letter-shuffle hover for the top bar: the letters of each word are shuffled
// for a few frames, then settle back to the original text. The shuffled letters are
// only drawn on top (CSS ::after); the link text itself never changes, so a click
// always reaches the link, even while the letters are moving.
(function () {
  var items = document.querySelectorAll('[data-shuffle]');
  if (!items.length) return;
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var FRAMES = 7;
  var FRAME_MS = 45;

  function shuffleWord(word) {
    var letters = word.split('');
    for (var i = letters.length - 1; i > 0; i--) {
      var k = Math.floor(Math.random() * (i + 1));
      var tmp = letters[i]; letters[i] = letters[k]; letters[k] = tmp;
    }
    return letters.join('');
  }

  items.forEach(function (el) {
    var original = el.textContent;
    var timer = null;
    var target = el.closest('a') || el;

    function stop() {
      clearInterval(timer);
      timer = null;
      el.classList.remove('is-shuffling');
      el.removeAttribute('data-shuffled');
    }

    target.addEventListener('mouseenter', function () {
      if (timer) return;
      var frame = 0;
      el.classList.add('is-shuffling');
      timer = setInterval(function () {
        frame++;
        if (frame >= FRAMES) { stop(); return; }
        el.setAttribute('data-shuffled', original.split(' ').map(shuffleWord).join(' '));
      }, FRAME_MS);
    });
  });
})();

// Pixel hover for images that open a project: on hover the image is redrawn
// as a coarse mosaic that sharpens in a few steps, then the real image returns.
(function () {
  var links = document.querySelectorAll('[data-pixel-hover]');
  if (!links.length) return;
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var STEPS = [6, 10, 18, 32, 56, 96]; // mosaic width in blocks, coarse to fine
  var STEP_MS = 80;

  // The part of the source image that is visible inside its box, in image pixels.
  function visibleSource(img, box) {
    var b = box.getBoundingClientRect();
    var nw = img.naturalWidth, nh = img.naturalHeight;
    var scale = Math.max(b.width / nw, b.height / nh);
    var sw = b.width / scale, sh = b.height / scale;
    var sx = (nw - sw) / 2, sy = (nh - sh) / 2;
    sx = Math.max(0, sx); sy = Math.max(0, sy);
    sw = Math.min(sw, nw - sx); sh = Math.min(sh, nh - sy);
    return { sx: sx, sy: sy, sw: sw, sh: sh, ratio: b.height / b.width };
  }

  links.forEach(function (link) {
    var box = link.classList.contains('media') ? link : link.querySelector('.media');
    var img = box && box.querySelector('img');
    if (!img) return;
    var timer = null;

    link.addEventListener('mouseenter', function () {
      if (timer || !img.complete || !img.naturalWidth) return;
      var src = visibleSource(img, box);
      var canvas = document.createElement('canvas');
      canvas.className = 'pixel';
      var ctx = canvas.getContext('2d');
      box.appendChild(canvas);
      var i = 0;

      function draw() {
        if (i >= STEPS.length) {
          clearInterval(timer);
          timer = null;
          canvas.remove();
          return;
        }
        canvas.width = STEPS[i];
        canvas.height = Math.max(1, Math.round(STEPS[i] * src.ratio));
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(img, src.sx, src.sy, src.sw, src.sh, 0, 0, canvas.width, canvas.height);
        i++;
      }

      draw();
      timer = setInterval(draw, STEP_MS);
    });
  });
})();

// Scroll reveal: every block of the page fades in and rises slightly the first time it enters the
// window, like on martinabraidotti.com. Section titles move with their text, nothing stays pinned.
(function () {
  if (!('IntersectionObserver' in window)) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var blocks = document.querySelectorAll('main > section:not(.proj-grid), main > div, .proj-card, .site-footer');
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      // A block skipped by a fast scroll or a jump is shown as well, so nothing above stays hidden.
      if (!entry.isIntersecting && entry.boundingClientRect.top > 0) return;
      entry.target.classList.add('v');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.06 });
  blocks.forEach(function (block) {
    block.classList.add('rv');
    observer.observe(block);
  });
})();

// Header on scroll: past the first part of the page, scrolling down hides the bar and
// scrolling up shows it again. It always stays visible near the top, while the mobile
// menu is open and while a link inside it has keyboard focus.
(function () {
  var header = document.querySelector('.site-header');
  if (!header) return;
  var menu = document.getElementById('menu');
  var SHOW_ABOVE = 200;  // px from the top where the bar is always shown
  var DELTA = 6;         // ignore tiny movements, e.g. trackpad jitter
  var last = window.scrollY;
  var ticking = false;

  function update() {
    ticking = false;
    var y = window.scrollY;
    if (Math.abs(y - last) < DELTA) return;
    var keep = y < SHOW_ABOVE || (menu && !menu.hidden) || header.contains(document.activeElement);
    header.classList.toggle('is-hidden', !keep && y > last);
    last = y;
  }

  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }, { passive: true });
  header.addEventListener('focusin', function () { header.classList.remove('is-hidden'); });
})();

// Intro screen: on the home page only, the first time it is opened in a visit, while its content loads.
// The <head> script adds the "intro" class only when the screen should play. The name is there from the start; the line under it appears with the letters of
// each word shuffled, as on the top bar on hover, then settles. A counter runs to 100, then the screen
// breaks into squares that disappear in random order. A click or a key skips it.
(function () {
  var root = document.documentElement;
  var loader = document.querySelector('.loader');
  if (!loader || !root.classList.contains('intro')) return;
  try { sessionStorage.setItem('aa-intro', '1'); } catch (e) {}

  var SHUFFLE_FRAMES = 16;  // the top bar uses 7 frames of 45 ms; here the shuffle lasts a little longer
  var FRAME_MS = 45;
  var MIN_MS = 2200;   // the screen stays at least this long
  var MAX_MS = 4500;   // and never longer than this, even if the page is still loading
  var start = performance.now();
  var done = false;

  // The letters of each word in a random order (same as the top bar hover).
  function shuffleWord(word) {
    var letters = word.split('');
    for (var i = letters.length - 1; i > 0; i--) {
      var k = Math.floor(Math.random() * (i + 1));
      var tmp = letters[i]; letters[i] = letters[k]; letters[k] = tmp;
    }
    return letters.join('');
  }

  var texts = Array.prototype.map.call(loader.querySelectorAll('[data-scramble]'), function (el) {
    var text = el.textContent;
    el.textContent = '';
    return { el: el, text: text, delay: 150, shown: -1 };
  });
  var count = loader.querySelector('.loader-count span');

  function frame(now) {
    var t = now - start;
    texts.forEach(function (x) {
      var local = t - x.delay;
      if (local < 0) return;
      var f = Math.min(SHUFFLE_FRAMES, Math.floor(local / FRAME_MS));
      if (f === x.shown) return;  // a new arrangement every 45 ms, as on the top bar
      x.shown = f;
      x.el.textContent = f < SHUFFLE_FRAMES ? x.text.split(' ').map(shuffleWord).join(' ') : x.text;
    });
    // The counter stops at 99 until the page is ready.
    var pct = Math.min(ready() ? 100 : 99, Math.round(100 * Math.pow(Math.min(1, t / MIN_MS), 0.8)));
    count.textContent = ('00' + pct).slice(-3);
    if (!done) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // The black background as a grid of squares, so it can break apart.
  var mosaic = loader.querySelector('.loader-mosaic');
  var cols = window.innerWidth < 600 ? 6 : 12;
  var size = window.innerWidth / cols;
  var rows = Math.ceil(window.innerHeight / size);
  mosaic.style.gridTemplateColumns = 'repeat(' + cols + ', 1fr)';
  mosaic.style.gridTemplateRows = 'repeat(' + rows + ', ' + size + 'px)';
  var cells = document.createDocumentFragment();
  for (var k = 0; k < cols * rows; k++) {
    var cell = document.createElement('i');
    cell.style.transitionDelay = Math.round(Math.random() * 1000) + 'ms';
    cells.appendChild(cell);
  }
  mosaic.appendChild(cells);

  function leave() {
    if (done) return;
    done = true;
    texts.forEach(function (x) { x.el.textContent = x.text; });
    count.textContent = '100';
    loader.classList.add('is-leaving');
    setTimeout(function () { root.classList.remove('intro'); loader.remove(); }, 1200);
  }

  // Ready when the page has loaded and the images in the first screen of the home are drawn.
  var loaded = document.readyState === 'complete';
  window.addEventListener('load', function () { loaded = true; });
  var firstImages = Array.prototype.filter.call(document.querySelectorAll('main img'), function (img) {
    img.loading = 'eager';
    return img.getBoundingClientRect().top < window.innerHeight;
  });
  function ready() {
    return loaded && firstImages.every(function (img) { return img.complete; });
  }
  (function wait() {
    var t = performance.now() - start;
    if ((ready() && t >= MIN_MS) || t >= MAX_MS) leave();
    else setTimeout(wait, 100);
  })();
  loader.addEventListener('click', leave);
  document.addEventListener('keydown', leave, { once: true });
})();
