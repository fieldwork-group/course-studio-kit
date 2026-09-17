# The user demo format

*The spec the kit publishes. Everything here is what a demo author needs and
nothing here is about one course: the examples belong to no course and no
lecture, lecturer or student URL appears.*

A **demo** is one self-contained HTML file that runs inside a lecture page in a
sandboxed frame. There is one kind: the platform mounts the file and puts
chrome around it, and everything that draws is in the file. Any stack works inside the file — plain canvas, SVG, p5,
three.js — as long as every byte of it is in the file. That is a stronger
standard than picking a framework, and it is the only one that lets a
stranger's JavaScript onto a page students read.

## The three files

A demo is a folder of three files named exactly this way:

| File | Is | Cap |
|---|---|---|
| `demo.html` | a complete HTML document; every script, style, font, image and sound inlined or a `data:` URI; **no external request of any kind** | 2 MB |
| `still.png` | the **drawing**, and not the controls around it: what stands for the demo in print and until it is ready. A handout with a row of dead sliders under every figure is a handout that looks broken | 1 MB |
| `demo.json` | `{ slug, title, description?, aspect?, author?, version? }` | 4 KB |

```
my-demo/
  demo.html
  still.png
  demo.json
```

`slug` matches `^[a-z0-9][a-z0-9-]{1,39}$` and is the demo's id inside a
course — the folder name, the key every lecture wires it by, and the last path
segment it is served from. It is lowercase Latin because it is a path segment;
`title` is what people read and may be in any script.

`aspect` is **height ÷ width**, default `0.5`. The page sizes the frame from
the width it has and this ratio, capped at 600 px tall; a demo may ask for a
different height at runtime (below) and is capped the same way.

`demo.json`, in full:

```json
{
  "slug": "damped-oscillator",
  "title": "Damped oscillator",
  "description": "A mass on a spring with adjustable damping.",
  "aspect": 0.5,
  "author": "R. Feynman",
  "version": "1.0.0"
}
```

Only `title` is required. Anything else in the file is ignored — a field
nobody defined is a field nobody will maintain.

## What the page does with it

The mount point in the lecture is a `<div id="demo-x">`, and it gets the
platform's chrome: a stage, and under it a control strip with **play / pause**
and **reset**. Inside the stage are two things:

```html
<div class="demo demo-frame">
  <div class="demo-stage">
    <iframe sandbox="allow-scripts" title="…"></iframe>
    <img class="still" …>
  </div>
  <div class="demo-controls">…</div>
</div>
```

**The chrome is in the course's language and the demo is in the author's.**
`play`, `pause`, `reset` and the frame's `title` come from a table in
`demos/src/core/frame.js`, read off the nearest `[lang]` — `<html>` on a
published page, the lecture's root in the studio. Nothing about the *file*
changes: it is its own document, it says what it likes, and the platform never
looks inside it.

The still lies over the frame until the demo says it is ready, letterboxed into
the stage against its own background. On paper the frame is hidden and the
still is what prints — a printer runs no scripts, so the still is not
decoration but the demo's only representation in a handout and in the PDF.
That is why it is the drawing alone: a control a reader cannot touch is noise
on paper.

**The sandbox is `allow-scripts` and nothing else.** No `allow-same-origin`, so
the frame is an *opaque origin*: no cookies, no `localStorage`, no
`sessionStorage`, no reach into the page around it and no way to read anything
belonging to the site. No forms, no popups, no navigation.

**The demo has no network.** It is served under this policy, and the same
policy is injected as a `<meta http-equiv>` whenever the file is mounted from
its text rather than from a URL:

```
default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; style-src 'unsafe-inline';
img-src data: blob:; font-src data:; media-src data: blob:; worker-src blob:;
frame-ancestors 'self'
```

No origin appears anywhere except `frame-ancestors`. There is deliberately no
`connect-src`, so `fetch`, `XMLHttpRequest`, `WebSocket` and `sendBeacon` are
all refused by `default-src 'none'`. `'unsafe-eval'` is allowed because some
libraries need it, and with no network and no origin it buys nothing.

Two things follow for an author, and they are the only two rules that ever
catch people out:

- **A CDN `<script src>` will not load.** Paste the library in, or use one that
  fits in a file.
- **A web font will not load.** Inline it as a `data:` URI, or use a system
  stack.

One more, which is not about the sandbox: a demo is **its own document**, so it
chooses its own text direction. A lecture page may be right-to-left; canvas text
inherits the direction of the document it is drawn in, and a demo that leaves
its `<html>` RTL will render `t = -1.1` as `1.1- = t`. Set `dir="ltr"` on the
document, or `ctx.direction = 'ltr'` on the context, unless the labels really
are in Hebrew or Arabic.

## The protocol

`postMessage`, both directions. Every message is an object shaped

```js
{ studio: 'demo', v: 1, type: '…', /* payload */ }
```

The host posts to the frame with target `'*'`, because an opaque origin has no
other address, and it accepts only messages whose `source` is its own frame's
window. The demo posts to `parent` with `'*'`.

| Direction | `type` | Payload | Meaning |
|---|---|---|---|
| host → demo | `run` | `{ running: boolean }` | play / pause. Also `false` when the block scrolls off screen and `true` when it comes back — the platform's visibility gating, so a page of demos does not burn a laptop |
| host → demo | `reset` | — | the ↺ button |
| host → demo | `theme` | `{ tokens: { '--c-bg': …, … } }` | the course's twelve colour tokens, sent once after `ready` and again if the theme changes |
| demo → host | `ready` | `{ height?: number, running?: boolean }` | the first frame is drawn; the still fades out. `running: false` means the demo means to come up paused — say it here and the page adopts it before its first `run`. It can only ever make the demo more still: a page that mounted it paused stays in charge |
| demo → host | `height` | `{ height: number }` | the demo wants a different height (capped at 600 px) |
| host → demo | `cue` | `{ rep?: string, show?: string }` | a link in the lecture text was clicked and it points at this demo: show this representation, reveal this panel. The names are the demo's own; a demo that has neither ignores it |
| demo → host | `state` | `{ running: boolean }` | the demo has its own play button and it moved; keeps the host's transport label honest |

The twelve theme tokens are `--c-bg`, `--c-panel`, `--c-ink`, `--c-muted`,
`--c-rule`, `--c-accent`, `--c-on-accent`, `--c-warn` and `--c-series-1` …
`--c-series-4`. Only the ones the page actually resolved are sent.

**A demo that never posts `ready` shows its still for ever, with the controls
live.** That is on purpose: a user demo gets no quality gate, and a demo that
does not come up is the author's to notice, not the platform's to refuse.

### `studio-demo.js`

The kit ships twenty lines to inline, so the protocol is four calls rather
than a message handler:

```js
StudioDemo.on('run', (running) => { … });
StudioDemo.on('reset', () => { … });
StudioDemo.on('theme', (tokens) => { … });
StudioDemo.on('cue', ({ rep, show }) => { … });
StudioDemo.ready();          // or StudioDemo.ready(320)
StudioDemo.height(320);
StudioDemo.state(running);   // when the demo has its own play button
```

**Post `ready` without waiting for `requestAnimationFrame`.** A browser does
not run rAF in an iframe that is off screen, and on a page with several demos
every one below the fold is off screen when it loads. A demo that announced
itself from a rAF callback would keep its still over a demo that was already
drawn, until the reader happened to scroll to it. Draw the first frame, then
announce on a `setTimeout(…, 0)`.

## A whole demo, end to end

No dependencies, about forty lines:

```html
<!doctype html>
<html>
<head><meta charset="utf-8"><title>Damped oscillator</title>
<style>html,body{margin:0;height:100%;background:var(--bg,#101820)}
canvas{display:block;width:100%;height:100%}</style></head>
<body>
<canvas id="c" width="800" height="400"></canvas>
<script>
  const send = (type, extra) => parent.postMessage({ studio: 'demo', v: 1, type, ...extra }, '*');
  const ctx = document.getElementById('c').getContext('2d');
  let t = 0, running = true;
  let ink = '#e8eef2', accent = '#d8722c';

  const x = (t) => Math.exp(-0.15 * t) * Math.cos(2 * t);

  function draw() {
    ctx.clearRect(0, 0, 800, 400);
    ctx.strokeStyle = accent; ctx.lineWidth = 3; ctx.beginPath();
    for (let i = 0; i <= 800; i++) ctx.lineTo(i, 200 - 150 * x(t - (800 - i) / 80));
    ctx.stroke();
    ctx.fillStyle = ink; ctx.font = '16px sans-serif';
    ctx.fillText('t = ' + t.toFixed(1) + ' s', 12, 26);
  }

  function frame() { if (running) t += 0.02; draw(); requestAnimationFrame(frame); }

  addEventListener('message', (e) => {
    const m = e.data;
    if (!m || m.studio !== 'demo' || m.v !== 1) return;
    if (m.type === 'run') running = m.running;
    if (m.type === 'reset') { t = 0; draw(); }
    if (m.type === 'theme') {
      ink = m.tokens['--c-ink'] || ink;
      accent = m.tokens['--c-accent'] || accent;
      document.documentElement.style.setProperty('--bg', m.tokens['--c-bg'] || '#101820');
      draw();
    }
  });

  frame();
  send('ready', { height: 400 });
</script>
</body>
</html>
```

with

```json
{ "slug": "damped-oscillator", "title": "Damped oscillator", "aspect": 0.5 }
```

and a `still.png` — a screenshot of the canvas at `t = 0` is exactly right, and
the controls are deliberately not in it.

## Building a demo from modules, with the kit's harness

A demo is one file, but it does not have to be *written* as one file. The kit
ships the harness the format's own reference demos are built with — a `Demo`
base class with a fixed-timestep canvas stage, a control strip that reads
slider values into `this.p`, a small axes/plot helper, RK4 and Verlet
integrators, and a TeX-to-HTML reader for the labels — and a build step that
bundles a demo module together with all of it into one `demo.html`.

```js
import { Demo } from './core/demo.js';
import { Axes, palette } from './core/plot.js';

export class Pendulum extends Demo {
  static aspect = 0.5;
  controls(ui) { ui.slider('L', { label: 'length $L$', min: 0.2, max: 2, value: 1 }); }
  setup() { this.axes = new Axes({ x: [0, 10], y: [-1.2, 1.2] }); }
  reset() { this.t = 0; }
  step(dt) { this.t += dt; }
  draw(ctx) { /* … */ }
}
```

The last piece is the adapter, `core/standalone.js`: it mounts the class into
the document and speaks the protocol on its behalf — `ready` with the measured
height, `run`, `reset`, `theme` applied as CSS variables on `:root`, `cue`
routed to the demo's own `setRep` / `reveal`, and `state` when the demo has a
play button of its own.

```js
import { bootStandalone } from './core/standalone.js';
bootStandalone(Pendulum, { maxHeight: 400 });
```

esbuild turns those two into an IIFE; the build puts it in a document with the
harness's stylesheet inlined and writes `demo.json` beside it. About 40 kB a
demo, every byte of it in the file.

Three things the harness does because a frame is not a page:

- **The twelve tokens come in as CSS variables**, so the plotting helper reads
  the course's colours off `:root` exactly as it did when the demo was part of
  the page. The file carries a default palette for the first frame, which is
  drawn before any `theme` message arrives.
- **No web font, and no KaTeX.** Both would be inlined bytes an order of
  magnitude larger than the demo, so the harness uses a system stack and turns
  `$…$` in a label into HTML with real sub- and superscripts (`ω₀`, `√(a²+b²)`)
  instead. A demo that needs real typesetting inlines KaTeX itself; the
  harness uses `window.katex` whenever it finds one.
- **The page draws play and reset**, outside the frame, for every demo alike,
  and that is the one transport a reader sees. `bootStandalone` suppresses the
  base class's own play button, and `controls(ui)` is for the *parameters* —
  sliders, toggles, a choice of representation. A demo that also drew ▶ / ⏸ /
  ↺ would show the reader two of each.

The harness's own reference implementation is this repository's
`tools/build-demos.js`, which builds ten demos this way.

## Getting a demo into a course

Three ways, all the same three files and the same API underneath.

**In the studio.** Course page → *Demos* → *Add a demo*: the title, the slug,
the two files. The demo runs in the panel, in the real sandboxed frame, with
the course's theme applied, **before** anything is saved. That preview is the
check; there is no other.

**On the command line.**

```bash
studio demos list                                   # the course's library
studio demos pull  courses/<course>                 # every demo, three files each
studio demos push  courses/<course>/demos/<slug>    # one demo, back up
```

`studio pull <lecture-dir>` also writes the demos that lecture wires into
`courses/<course>/demos/`, so the pulled `notes.html` opens by double-clicking
with the demo running.

**Over the API**, which is what an agent uses:

```
PUT /courses/{c}/demos/{slug}              the demo.json fields
PUT /courses/{c}/demos/{slug}/demo.html    text/html, ≤ 2 MB
PUT /courses/{c}/demos/{slug}/still.png    image/png, ≤ 1 MB
GET /courses/{c}/demos                     the library, with usedIn per demo
DELETE /courses/{c}/demos/{slug}           409 while a lecture wires it
```

`demo.json` must exist before either file: a file with no manifest beside it is
a demo nothing can list, name or delete.

## Wiring a demo into a lecture

A lecture's `lecture.json` records what mounts where:

```json
"demos": {
  "#demo-x": { "kind": "file", "demo": "damped-oscillator", "aspect": 0.5, "title": "Damped oscillator" }
}
```

`kind: 'file'` is the only shape there is. The mount node — the
`<div id="demo-x">` — is content, in the document; the wiring is manifest. That
split is why a demo can be swapped without touching a word of the lecture.

Publishing a lecture copies `demo.html` and `still.png` for **the demos it
actually wires**, and nothing for the rest of the library.

## The rules, in one place

1. One folder, three files, those names.
2. `demo.html` makes **no request**. Everything inlined.
3. `sandbox="allow-scripts"` and nothing else, always, everywhere it is
   mounted.
4. 2 MB, 1 MB, 4 KB. The cap is on bytes, not on content.
5. Post `ready` when the first frame is drawn, or the still stands for ever.
6. Answer `run`; a demo that ignores it runs behind a reader's back.
7. Ship a `still.png` that looks like the demo. It is what prints.
