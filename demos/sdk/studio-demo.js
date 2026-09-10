/**
 * `StudioDemo` — the demo half of the host↔demo protocol, in twenty lines you
 * paste into your file.
 *
 * A demo makes no request, so this is not a script tag you link: copy it into a
 * `<script>` at the top of `demo.html`. It is deliberately small enough to read
 * in one sitting, because inlining code you have not read is how a demo ends up
 * doing something its author did not intend.
 *
 * Every message either way is `{ studio: 'demo', v: 1, type, … }`. The host
 * posts to this frame with target `'*'` — the frame is a sandboxed opaque
 * origin, so there is no other address to name — and accepts back only messages
 * whose `event.source` is its own frame. This side answers the mirror of that:
 * it ignores anything that is not the envelope, and posts to `parent` with `'*'`.
 *
 *   StudioDemo.on('run',   (running) => { … })   play / pause, and off-screen
 *   StudioDemo.on('reset', () => { … })          the ↺ button
 *   StudioDemo.on('theme', (tokens) => { … })    the course's twelve colours
 *   StudioDemo.ready(320)                        first frame drawn; the still goes
 *   StudioDemo.height(320)                       ask for a different height
 *   StudioDemo.state(running)                    your own play button moved
 *
 * Call `ready()` when the first frame is on screen and not before: until it
 * arrives the host shows `still.png`, for ever if it has to.
 */
(function (global) {
  var handlers = {};
  function post(type, payload) {
    var msg = { studio: 'demo', v: 1, type: type };
    for (var k in (payload || {})) msg[k] = payload[k];
    global.parent.postMessage(msg, '*');
  }
  global.addEventListener('message', function (e) {
    var m = e.data;
    if (!m || m.studio !== 'demo' || m.v !== 1 || typeof m.type !== 'string') return;
    var fn = handlers[m.type];
    if (!fn) return;
    if (m.type === 'run') fn(!!m.running);
    else if (m.type === 'theme') fn(m.tokens || {});
    else fn();
  });
  global.StudioDemo = {
    on: function (type, fn) { handlers[type] = fn; return this; },
    ready: function (height) { post('ready', height > 0 ? { height: height } : {}); },
    height: function (height) { post('height', { height: height }); },
    state: function (running) { post('state', { running: !!running }); },
  };
})(window);
