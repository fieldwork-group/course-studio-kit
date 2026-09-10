# The user demo format

A **user demo** is one self-contained HTML file that runs inside a lecture page,
in a frame that cannot see the page and cannot reach the network. Any stack works
inside the file — plain canvas, SVG, p5, three.js — as long as every byte of it is
*in* the file. That is a stronger standard than picking a framework, and it is the
only one that lets a stranger's JavaScript onto a page students read.

This document is the contract. [`authoring.md`](authoring.md) is how to build one,
and [`faq.md`](faq.md) answers the questions the contract raises.

## The three files

A demo is a folder of three files named exactly this way:

| File | Is | Cap |
|---|---|---|
| `demo.html` | a complete HTML document; every script, style, font, image and sound inlined or a `data:` URI; **no external request of any kind** | 2 MB |
| `still.png` | the frame that stands for the demo in print and before it is ready; the demo's own aspect ratio | 1 MB |
| `demo.json` | `{ slug, title, description?, aspect?, author?, version? }` | 4 KB |

```
my-demo/
  demo.html
  still.png
  demo.json
```

`slug` matches `^[a-z0-9][a-z0-9-]{1,39}$` and is the demo's id inside a course —
the folder name, the key every lecture wires it by, and the last path segment it is
served from. It is lowercase Latin because it is a path segment; `title` is what
people read and may be in any script.

`aspect` is **height ÷ width**, default `0.5`. The page sizes the frame from the
width it has and this ratio, and caps it at **600 px** tall; a demo may ask for a
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

Only `title` is required. **Anything else in the file is ignored** — a field nobody
defined is a field nobody will maintain. The one extra field this repository uses
is `lang` (`"he"` or `"en"`), which the [gallery](../../tools/build-gallery.js)
reads to set a card's text direction; the studio ignores it, as it ignores any
field it does not know.

## What the page does with it

The mount point in a lecture is a `<div id="demo-x">`, and it gets the same chrome
a platform demo gets: a stage, and under it a control strip with **play / pause**
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

The still lies over the frame until the demo says it is ready. On paper the frame
is hidden and the still is what prints — a printer runs no scripts, so the still is
not decoration but the demo's only representation in a handout and in the PDF.

**The sandbox is `allow-scripts` and nothing else.** No `allow-same-origin`, so the
frame is an *opaque origin*: no cookies, no `localStorage`, no `sessionStorage`, no
reach into the page around it and no way to read anything belonging to the site. No
forms, no popups, no navigation.

**The demo has no network.** It is served under this policy, and the same policy is
injected as a `<meta http-equiv>` whenever the file is mounted from its text rather
than from a URL:

```
default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; style-src 'unsafe-inline';
img-src data: blob:; font-src data:; media-src data: blob:; worker-src blob:;
frame-ancestors 'self'
```

No origin appears anywhere except `frame-ancestors`. There is deliberately no
`connect-src`, so `fetch`, `XMLHttpRequest`, `WebSocket` and `sendBeacon` are all
refused by `default-src 'none'`. `'unsafe-eval'` is allowed because some libraries
need it, and with no network and no origin it buys nothing.

(`frame-ancestors` is dropped from the meta-tag copy. A browser ignores that
directive in a `<meta>` — who may frame a document is the server's answer, not the
document's — and would log an error for every demo on the page. It is carried by
the response header, where it means something.)

Two things follow for an author, and they are the only two rules that ever catch
people out:

- **A CDN `<script src>` will not load.** Paste the library in, or use one that fits
  in a file. `demos/examples/superposition-p5/demo.html` has p5.js inlined, whole.
- **A web font will not load.** Inline it as a `data:` URI, or use a system stack.

One more, which is not about the sandbox: a demo is **its own document**, so it
chooses its own text direction. A lecture page may be right-to-left; canvas text
inherits the direction of the document it is drawn in, and a demo that leaves its
`<html>` RTL will render `t = -1.1` as `1.1- = t`. Set `dir="ltr"` on the document,
or `ctx.direction = 'ltr'` on the context, unless the labels really are in Hebrew
or Arabic.

## The protocol

`postMessage`, both directions. Every message is an object shaped

```js
{ studio: 'demo', v: 1, type: '…', /* payload */ }
```

The host posts to the frame with target `'*'`, because an opaque origin has no
other address, and it accepts back **only messages whose `event.source` is its own
frame's window** — that check is what makes `'*'` safe on the way out. The demo
posts to `parent` with `'*'`.

| Direction | `type` | Payload | Meaning |
|---|---|---|---|
| host → demo | `run` | `{ running: boolean }` | play / pause. Also `false` when the block scrolls off screen and `true` when it comes back — the platform's visibility gating, so a page of demos does not burn a laptop |
| host → demo | `reset` | — | the ↺ button |
| host → demo | `theme` | `{ tokens: { '--c-bg': …, … } }` | the course's twelve colour tokens, sent once after `ready` and again if the theme changes |
| demo → host | `ready` | `{ height?: number }` | the first frame is drawn; the still fades out |
| demo → host | `height` | `{ height: number }` | the demo wants a different height (capped at 600 px) |
| demo → host | `state` | `{ running: boolean }` | the demo has its own play button and it moved; keeps the host's transport label honest |

The twelve theme tokens are `--c-bg`, `--c-panel`, `--c-ink`, `--c-muted`,
`--c-rule`, `--c-accent`, `--c-on-accent`, `--c-warn` and `--c-series-1` …
`--c-series-4`. Only the ones the page actually resolved are sent, so read each one
with a fallback and never assume all twelve arrived.

Two details of the host worth knowing, because they decide when your handlers run:

- the theme and the current `run` state are sent **twice** — once when the frame
  fires `load`, for a demo that draws before it says anything, and again when
  `ready` arrives;
- what the host sends as `run` is `running && visible`. A demo that is playing but
  off screen is told `false`, and gets `true` when the reader scrolls back.

**A demo that never posts `ready` shows its still for ever, with the controls
live.** That is on purpose: a user demo gets no quality gate, and a demo that does
not come up is the author's to notice, not the platform's to refuse.

### `studio-demo.js`

The kit ships [twenty lines to inline](../../demos/sdk/studio-demo.js), so the
protocol is four calls rather than a message handler:

```js
StudioDemo.on('run', (running) => { … });
StudioDemo.on('reset', () => { … });
StudioDemo.on('theme', (tokens) => { … });
StudioDemo.ready();          // or StudioDemo.ready(320)
StudioDemo.height(320);
StudioDemo.state(running);   // when the demo has its own play button
```

It is a copy-paste, not a `<script src>` — the demo may not fetch it. The lint
checks that the copy in your file is the current one, if you kept the two marker
comments around it.

## A whole demo, end to end

Generic physics, no dependencies, about forty lines. This is
[`demos/template/demo.html`](../../demos/template/demo.html) with the helper folded
back into a plain handler, so you can see the protocol with nothing in front of it:

```html
<!doctype html>
<html lang="en" dir="ltr">
<head><meta charset="utf-8"><title>Damped oscillator</title>
<style>html,body{margin:0;height:100%;background:var(--bg,#101820)}
canvas{display:block;width:100%;height:100%}</style></head>
<body>
<canvas id="c" width="800" height="400"></canvas>
<script>
  const send = (type, extra) => parent.postMessage({ studio: 'demo', v: 1, type, ...extra }, '*');
  const ctx = document.getElementById('c').getContext('2d');
  ctx.direction = 'ltr';
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
`node tools/check-demo.js my-demo --still` takes it for you.

## Getting a demo into a course

Three ways, all the same three files and the same API underneath;
[`authoring.md`](authoring.md) has the commands.

**In the studio.** Course page → *Demos* → *Add a demo*: the title, the slug, the
two files. The demo runs in the panel, in the real sandboxed frame, with the
course's theme applied, **before** anything is saved. That preview is the check;
there is no other.

**On the command line**, with the `studio` CLI.

**Over the API**, which is what an agent uses:

```
PUT    /courses/{c}/demos/{slug}              the demo.json fields
PUT    /courses/{c}/demos/{slug}/demo.html    text/html, ≤ 2 MB
PUT    /courses/{c}/demos/{slug}/still.png    image/png, ≤ 1 MB
GET    /courses/{c}/demos                     the library, with usedIn per demo
DELETE /courses/{c}/demos/{slug}              409 while a lecture wires it
```

`demo.json` must exist before either file: a file with no manifest beside it is a
demo nothing can list, name or delete. The full shapes are in
[`../api/openapi.yaml`](../api/openapi.yaml).

## Wiring a demo into a lecture

A lecture's `lecture.json` records what mounts where:

```json
"demos": {
  "#demo-x": { "kind": "file", "demo": "damped-oscillator", "aspect": 0.5, "title": "Damped oscillator" }
}
```

`kind: "file"` is a user demo; an entry with no `kind` is a platform demo
(`{ module, export, opts }`) and is unaffected. The mount node — the
`<div id="demo-x">` — is content, in the document; the wiring is manifest. That
split is why a demo can be swapped without touching a word of the lecture.

Publishing a lecture copies `demo.html` and `still.png` for **the demos it actually
wires**, and nothing for the rest of the library.

## The rules, in one place

1. One folder, three files, those names.
2. `demo.html` makes **no request**. Everything inlined.
3. `sandbox="allow-scripts"` and nothing else, always, everywhere it is mounted.
4. 2 MB, 1 MB, 4 KB. The cap is on bytes, not on content.
5. Post `ready` when the first frame is drawn, or the still stands for ever.
6. Answer `run`; a demo that ignores it runs behind a reader's back.
7. Ship a `still.png` that looks like the demo. It is what prints.

`node tools/check-demo.js <folder>` checks 1–5 of those, and that the file really
makes no request — it mounts the demo in a browser, in the same sandbox with the
same policy, and counts.
