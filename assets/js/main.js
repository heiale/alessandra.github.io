// Mobile menu overlay
(function () {
  var toggle = document.querySelector('.menu-toggle');
  var menu = document.getElementById('menu');
  if (!toggle || !menu) return;
  var close = menu.querySelector('.menu-close');

  function setOpen(open) {
    menu.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    document.body.style.overflow = open ? 'hidden' : '';
    (open ? close : toggle).focus();
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
