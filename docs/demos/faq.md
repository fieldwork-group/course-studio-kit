# Demo FAQ

The questions the format raises, and the answers that are not obvious from the
rules themselves. The rules are in [`format.md`](format.md); how to build one is
[`authoring.md`](authoring.md).

## Why can a demo not use the network?

Because a demo is *somebody else's JavaScript on a page students read*, and the
only version of that which is safe to allow without reviewing every line is one
that cannot talk to anything.

Concretely, the frame is `sandbox="allow-scripts"` with no `allow-same-origin`, so
it is an opaque origin: no cookies, no storage, no access to the page around it.
The page it sits in has nothing ambient to steal anyway — the published site has no
cookies, and the studio keeps its token in memory. And the file is served under
`default-src 'none'` with no `connect-src`, so `fetch`, `XMLHttpRequest`,
`WebSocket` and `sendBeacon` are all refused.

Take one of those away and the argument stops working. With a network, a demo could
send whatever it can see somewhere; with `allow-same-origin`, it could see the page.
Together they are why a demo needs no review, and why anyone can write one.

The side effects are real and worth knowing: no analytics, no error reporting, no
loading a dataset at runtime, no font from Google. Precompute your data and inline
it as JSON in a `<script type="application/json">`.

## Why one file, rather than a folder of assets?

Three reasons, in order of how often they matter.

A lecture is **published, printed, mailed and exported**. One file survives all
four; a folder with relative paths survives the first. The standalone bundle a
lecturer sends a student is a single HTML document with the demo's text inlined as
`srcdoc`, and that only works if the demo's text is the demo.

**The cap is checkable.** "Two megabytes" is a fact about a file. "Two megabytes"
about a folder is a policy about a crawl.

And a single file is **one thing to hand over**: an author who wants their demo back
gets the file, and it opens in a browser by double-clicking, forever, with no
server and no build.

## How do I inline a library?

Download the minified build once and paste it in.

```bash
curl -sSL -o /tmp/p5.min.js https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.11.3/p5.min.js
```

then, in `demo.html`:

```html
<script>
/* p5.js v1.11.3, minified, unmodified */
…the whole file…
</script>
<script>
  …your sketch…
</script>
```

That is exactly what
[`demos/examples/superposition-p5/demo.html`](../../demos/examples/superposition-p5/demo.html)
is: about a megabyte of p5 followed by ninety lines of physics, and it is well
inside the 2 MB cap.

Notes from having done it:

- **Pin the version in the comment.** The file is now yours; nobody will update it
  for you, and in a year the only way to know what it was is what you wrote down.
- **Check the licence.** Inlining is redistribution. p5 is LGPL 2.1 and travels
  with its own source, which is the file you pasted; a note in the demo header and
  in your repository's LICENSE is the honest way to do it.
- **A library that fetches at runtime will not work** — a translation bundle, a
  WASM blob, a tile server. It will fail silently inside the sandbox, which is
  another reason to run the lint: it counts requests in a real browser.
- **`'unsafe-eval'` is allowed**, so a library that compiles shaders or templates at
  runtime is fine. With no network and no origin, it buys an attacker nothing.

A rule of thumb: three.js, p5, d3 and a font subset are all comfortable. If a
library is not comfortable, the demo is usually asking for something a figure would
do better.

## Hebrew and RTL text on canvas

Three separate things get confused here.

**The document's direction.** A demo is its own document. It does not inherit
anything from the lecture around it, so a Hebrew lecture does not make your demo
RTL — you do, with `dir` on `<html>`.

**Canvas text.** `fillText` lays out with the direction of the canvas's context,
which defaults to the document's. In an RTL document `ctx.fillText('t = -1.1')`
renders as `1.1- = t`, because the string is mostly neutral characters and the
paragraph direction decides. Two fixes, and you want both if you mix scripts:

```js
ctx.direction = 'ltr';                 // per context, for Latin labels and numbers
```

and, for a genuinely Hebrew label on an LTR canvas, `ctx.direction = 'rtl'` around
that one call.

**Fonts.** There is no web font, so Hebrew on canvas is whatever the reader's system
has: `system-ui`, `"Segoe UI"`, `Arial` all carry Hebrew on the platforms that
matter. Do not name a font the reader may not have and then measure text with it.

The safer pattern, and the one
[`pendulum-canvas`](../../demos/examples/pendulum-canvas/demo.html) uses: keep
Hebrew **out of the canvas**. Labels, units and readouts go in HTML around it,
where the browser's bidi algorithm is good, and the canvas carries only the
drawing and Latin symbols. Numbers in an RTL page belong in a span with
`direction: ltr; unicode-bidi: isolate`, or `1.00 m` will come out as `m 1.00`
next to a Hebrew word.

And the rule that comes from the studio itself: **Hebrew never goes inside math**.
That is about KaTeX in the lecture text, not about your demo, but the reason
generalises — a script that a layout engine cannot measure ends up as boxes.

## Why does my demo show the still for ever?

You did not post `ready`, or you posted it in a way the host ignored. The host
accepts a message only if `event.source` is its own frame's window and the envelope
is exactly `{ studio: 'demo', v: 1, type: 'ready' }`. A typo in `studio`, a missing
`v`, or posting to `window` instead of `parent` all look like silence.

`node tools/check-demo.js my-demo` fails with *no "ready" message within 5 s* when
that happens, which is faster than staring at a still.

## Can I keep state between visits?

No. `localStorage`, `sessionStorage`, IndexedDB and cookies are all unavailable in
an opaque origin — reading them throws or returns nothing, depending on the
browser. Keep state in a variable; it lives as long as the frame does. A demo that
needs to remember something across a reader's sessions is asking to be a page, not
a figure.

## How big can it really be?

`demo.html` ≤ 2 MB, `still.png` ≤ 1 MB, `demo.json` ≤ 4 KB, and the cap is on
bytes, not on content. Two megabytes is a deliberate choice: enough for an inlined
three.js, small enough that a lecture with five demos is not a burden on a phone
over a lecture-hall network. If a demo genuinely needs more, that is a conversation
about the cap, not a reason to fetch something.

## Does it work in the printed handout?

The frame is hidden on paper and `still.png` is printed in its place, at the demo's
aspect ratio. A printer runs no scripts, so the still is the demo's only
representation in the PDF and in a handout — which is why the format asks for one
that looks like the demo, and why the lint's `--still` takes the screenshot after
the demo has been running for a few seconds rather than at its first frame.

## What happens when my demo throws?

Nothing, to the page. The frame is its own document: an exception inside it does not
reach the lecture, does not stop the other demos and does not appear anywhere a
student sees. What the reader gets is a demo that stopped, or a still that never
faded. Open the file directly in a browser — it is a complete document — and the
console is where you left it.

## Can I use an `<input>`, a slider, a button?

Yes. Forms are not submitted (no `allow-forms`) but every control works, and all
three examples here use sliders and a checkbox. Keep them inside the frame: the
host's control strip is only play, pause and reset, and it is deliberately not
extensible — a demo's own controls belong to the demo.

If your demo has its own play button, tell the host when it moves with
`StudioDemo.state(running)`, so the page's transport label is not lying.
