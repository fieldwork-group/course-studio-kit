/**
 * `site/host.js` — the gallery's copy of the platform's demo host.
 *
 * This is `demos/src/core/frame.js` from the studio, reduced to what a static
 * page needs and translated from a module to a classic script. It is a *copy*,
 * on purpose: the gallery's whole claim is that a demo which runs here runs
 * unchanged in a lecture, and that claim is only worth something if the thing
 * around it is the same thing — the same sandbox attribute, the same message
 * envelope, the same source check, the same height cap, the same theme tokens.
 *
 * If the platform's protocol ever changes, this file changes with it and the
 * format document says so. Nothing else in the kit talks to a demo.
 *
 * What is deliberately different:
 *
 *   * the labels are English and the card sets its own `dir`, because the
 *     gallery is bilingual and a lecture page is not;
 *   * a demo is mounted when the reader asks for it (*open*), not on load: a
 *     gallery of demos is a page of megabytes, and a lecture is not;
 *   * the file is fetched and mounted through `srcdoc` with the demo CSP as a
 *     `<meta http-equiv>`, exactly as the studio does it. GitHub Pages cannot
 *     set a response header, so serving the file to a frame with `src` would
 *     leave it with no policy at all — the sandbox would still hold, but "a
 *     demo makes no request" would stop being enforced on the one page whose
 *     job is to demonstrate it. When the fetch cannot work (the page opened
 *     from `file://`), it falls back to `src` and says so in the console.
 */
(function (global) {
  'use strict';

  /** The one sandbox value. A second flag would undo the whole design. */
  var SANDBOX = 'allow-scripts';

  /** Character for character the policy the studio serves a demo under. */
  var DEMO_CSP = [
    "default-src 'none'",
    "script-src 'unsafe-inline' 'unsafe-eval'",
    "style-src 'unsafe-inline'",
    'img-src data: blob:',
    'font-src data:',
    'media-src data: blob:',
    'worker-src blob:',
    "frame-ancestors 'self'",
  ].join('; ');

  var MAX_HEIGHT = 600;
  var DEFAULT_ASPECT = 0.5;

  /** The twelve course tokens, as `schema/src/theme.js` names them. */
  var THEME_TOKENS = [
    '--c-bg', '--c-panel', '--c-ink', '--c-muted', '--c-rule',
    '--c-accent', '--c-on-accent', '--c-warn',
    '--c-series-1', '--c-series-2', '--c-series-3', '--c-series-4',
  ];

  /**
   * `frame-ancestors` is dropped on the way into a meta tag: a browser ignores
   * it there — who may frame a document is the server's answer, not the
   * document's — and logs an error for every demo on the page if it is left in.
   */
  function withCspMeta(html) {
    var inMeta = DEMO_CSP.split(';').map(function (d) { return d.trim(); })
      .filter(function (d) { return d && !/^frame-ancestors\b/i.test(d); }).join('; ');
    var meta = '<meta http-equiv="Content-Security-Policy" content="' + inMeta.replace(/"/g, '&quot;') + '">';
    var head = /<head\b[^>]*>/i.exec(html);
    if (head) return html.slice(0, head.index + head[0].length) + meta + html.slice(head.index + head[0].length);
    return meta + html;
  }

  function isDemoMessage(data) {
    return !!data && typeof data === 'object' && data.studio === 'demo' && data.v === 1
      && typeof data.type === 'string';
  }

  /** Whatever the page resolved the tokens to is what the demo is told. */
  function themeTokens() {
    var style = global.getComputedStyle(document.documentElement);
    var tokens = {};
    for (var i = 0; i < THEME_TOKENS.length; i++) {
      var value = String(style.getPropertyValue(THEME_TOKENS[i]) || '').trim();
      if (value) tokens[THEME_TOKENS[i]] = value;
    }
    return tokens;
  }

  /**
   * Attach the host behaviour to one card built by `build-gallery.js`.
   * The markup — `.demo-stage` with the `<iframe sandbox="allow-scripts">` and
   * the still `<img>`, and the `.demo-controls` strip — is written into the page
   * at build time so it is greppable, and so that a reader with no JavaScript
   * still sees the still and the text.
   */
  function attach(card) {
    var host = card.querySelector('.demo');
    var stage = card.querySelector('.demo-stage');
    var frame = card.querySelector('iframe');
    var open = card.querySelector('[data-act="open"]');
    var reset = card.querySelector('[data-act="reset"]');
    var src = frame.getAttribute('data-src');
    var aspect = Number(host.getAttribute('data-aspect')) > 0
      ? Number(host.getAttribute('data-aspect')) : DEFAULT_ASPECT;

    var mounted = false, running = false, visible = false, wantedHeight = null, height = 0;

    function post(type, payload) {
      var win = frame.contentWindow;
      if (!win) return;
      var msg = { studio: 'demo', v: 1, type: type };
      for (var k in (payload || {})) msg[k] = payload[k];
      // `'*'`: the frame is an opaque origin, so there is no other target to
      // name. Nothing secret is ever sent — play, reset and twelve colours.
      try { win.postMessage(msg, '*'); } catch (e) { /* the frame is gone */ }
    }

    function measure() {
      var width = stage.clientWidth || 0;
      var wanted = wantedHeight === null ? Math.round(width * aspect) : wantedHeight;
      var next = Math.max(80, Math.min(Math.round(wanted), MAX_HEIGHT));
      if (next === height) return;
      height = next;
      stage.style.height = next + 'px';
      frame.style.height = next + 'px';
    }

    function paint() {
      open.textContent = !mounted ? '▶ open' : (running ? '⏸ pause' : '▶ play');
      open.setAttribute('aria-pressed', String(running));
    }

    /** A paused demo and an off-screen one are the same thing to the machine. */
    function sync() { post('run', { running: running && visible }); }

    function mount() {
      mounted = true; running = true;
      paint();
      global.fetch(src).then(function (r) { return r.text(); }).then(function (html) {
        frame.setAttribute('srcdoc', withCspMeta(html));
      }).catch(function () {
        console.warn('[gallery] cannot read ' + src + ' — falling back to src, which carries no CSP of its own');
        frame.setAttribute('src', src);
      });
    }

    open.addEventListener('click', function () {
      if (!mounted) { mount(); return; }
      running = !running;
      paint();
      sync();
    });
    reset.addEventListener('click', function () { if (mounted) post('reset'); });

    global.addEventListener('message', function (e) {
      // The only check that matters: `'*'` on the way out means anyone could
      // post to us, so the sender has to be our own frame.
      if (!frame.contentWindow || e.source !== frame.contentWindow) return;
      if (!isDemoMessage(e.data)) return;
      var msg = e.data;
      if (msg.type === 'ready') {
        host.classList.add('frame-ready');
        if (Number(msg.height) > 0) { wantedHeight = Number(msg.height); measure(); }
        post('theme', { tokens: themeTokens() });
        sync();
      } else if (msg.type === 'height') {
        if (Number(msg.height) > 0) { wantedHeight = Number(msg.height); measure(); }
      } else if (msg.type === 'state') {
        running = !!msg.running;
        paint();
      }
    });

    frame.addEventListener('load', function () {
      post('theme', { tokens: themeTokens() });
      sync();
    });

    if (typeof ResizeObserver === 'function') new ResizeObserver(measure).observe(stage);
    if (typeof IntersectionObserver === 'function') {
      new IntersectionObserver(function (entries) {
        var now = entries[entries.length - 1].isIntersecting;
        if (now === visible) return;
        visible = now;
        if (mounted) sync();
      }, { threshold: 0.05 }).observe(host);
    } else {
      visible = true;
    }

    measure();
    paint();
  }

  global.StudioHost = {
    SANDBOX: SANDBOX,
    DEMO_CSP: DEMO_CSP,
    withCspMeta: withCspMeta,
    attach: attach,
    attachAll: function () {
      var cards = document.querySelectorAll('.card');
      for (var i = 0; i < cards.length; i++) attach(cards[i]);
    },
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { global.StudioHost.attachAll(); });
  } else {
    global.StudioHost.attachAll();
  }
})(window);
