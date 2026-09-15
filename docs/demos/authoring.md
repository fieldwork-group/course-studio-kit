# Building a demo

The short version: copy the template, replace the physics, run the lint, upload
the folder. Half an hour for something small, and nothing to install except the
lint's browser if you want to run it.

```bash
git clone https://github.com/fieldwork-group/course-studio-kit
cd course-studio-kit
cp -r demos/template ~/work/my-demo
```

## 1. Start from the template

[`demos/template/`](../../demos/template/) runs as it is: a square slides across a
canvas, the page's play, pause and reset work, and the course's colours arrive and
are used. Start there rather than from an empty file — when a demo does not come
up, the first question is whether the format is wrong or the physics is, and a
template that already works answers it.

Rename the folder to your slug (`^[a-z0-9][a-z0-9-]{1,39}$`) and set the same slug
in `demo.json`. The folder name and the slug are the same string; the lint says so
if they drift.

The part to replace is marked:

```js
/* ---- your demo starts here ---------------------------------------------- */
```

Everything above it is the twenty-line helper, which you keep.

## 2. Write it — with the three rules in your hands

**Everything is inlined.** No `<script src>` to a CDN, no `<link>` to a font, no
image URL. The frame has no network at all, so a request does not fail slowly — it
is refused, and the only sign is that your library is not there. See
[*inlining a library*](faq.md#how-do-i-inline-a-library) for the two commands.

**Answer the host.** Three handlers and one call:

```js
StudioDemo.on('run',   (running) => { … });   // play/pause, and off-screen
StudioDemo.on('reset', () => { … });          // back to t = 0
StudioDemo.on('theme', (tokens) => { … });    // the course's twelve colours
StudioDemo.ready(400);                        // first frame drawn → the still goes
```

`run` is not optional. A demo that ignores it keeps a laptop busy behind a
reader's back, and the play button lies. `theme` is what makes a demo look like it
belongs to the course it is in rather than to you: read each token with a
fallback — `tokens['--c-accent'] || '#d8722c'` — because only the tokens the page
actually resolved are sent.

**Say `ready` once, when there is something to look at.** Not in `setup`, not
before the first frame: until `ready` arrives the reader is looking at your
`still.png`, and after it the still fades. A demo that never says it shows the
still for ever, which is a real outcome and nobody will stop you.

**Text direction.** A lecture page may be right-to-left and your document inherits
nothing from it, but canvas text inherits the direction of *your* document. Put
`dir="ltr"` on `<html>` (or `ctx.direction = 'ltr'`) unless your labels really are
Hebrew or Arabic — otherwise `t = -1.1` comes out as `1.1- = t`. If the chrome is
Hebrew and the numbers are Latin, do what
[`pendulum-canvas`](../../demos/examples/pendulum-canvas/demo.html) does: an RTL
document, HTML controls with Hebrew labels, and the numeric readouts in a span with
`direction: ltr; unicode-bidi: isolate`.

Sizes: the frame is as wide as the page's measure and `aspect × width` tall, capped
at 600 px. Design for a box about 900 × 450 and let it scale; a `ResizeObserver` on
your stage is a better answer than reading the size once.

## 3. Make the still and run the lint

```bash
npm install                       # once, for the lint's browser
node tools/check-demo.js ~/work/my-demo --still
```

`--still` writes `still.png` from the demo itself, after three seconds of running,
so the still looks like the demo rather than like its first frame. Without the
flag the screenshot goes to `.check/<slug>.png` and your own `still.png` is left
alone.

The lint checks what an author cannot check by looking:

- the three files exist, and the caps (2 MB, 1 MB, 4 KB);
- the slug, the folder name and the title;
- no external reference in the markup — a `<script src>`, a `<link href>`, an
  `<img src>`, a CSS `url()` that is not a `data:` URI;
- and then, in a real browser, in the same `sandbox="allow-scripts"` frame under
  the same content policy: **zero network requests**, and `ready` within five
  seconds.

That last part is the one that matters. An inlined library carries URLs in its own
strings — p5 mentions a CDN in an error message it never fetches — so no pattern
over the bytes can decide the question. A browser can.

```
ok    /home/…/my-demo  (My demo) → /home/…/my-demo/still.png
```

## 4. Put it in a course

Three ways in, all the same three files.

### The studio

Course page → **Demos** → *Add a demo*. Give it a title, a slug and the two files.
It runs in the panel, in the real sandboxed frame with the course's theme, before
anything is saved. That preview is the check; there is no other.

### An agent, over MCP

The studio publishes a **remote MCP server** — one URL added in Claude as a custom
connector, signed in with your studio account, no token on your laptop. The tools
`studio_list_demos`, `studio_put_demo` (the three files inline, the still base64)
and `studio_delete_demo` are the routes below, and the agent sees the same errors
you would. The connector URL is `https://studio.fieldwork-group.com/api/mcp`;
Claude Code takes the same URL with `claude mcp add --transport http`. The
setup for each Claude surface is in [`AGENTS.md`](../../AGENTS.md).

### curl, with a token

Mint a token in the studio — **API access** in the account menu — scoped `write`,
and to one course if you like, and:

```bash
STUDIO=https://studio.fieldwork-group.com/api
COURSE=<course>
SLUG=my-demo

curl -X PUT "$STUDIO/courses/$COURSE/demos/$SLUG" \
     -H "authorization: Bearer $STUDIO_TOKEN" -H 'content-type: application/json' \
     -d '{"title":"My demo","description":"…","aspect":0.5}'

curl -X PUT "$STUDIO/courses/$COURSE/demos/$SLUG/demo.html" \
     -H "authorization: Bearer $STUDIO_TOKEN" -H 'content-type: text/html' \
     --data-binary @my-demo/demo.html

curl -X PUT "$STUDIO/courses/$COURSE/demos/$SLUG/still.png" \
     -H "authorization: Bearer $STUDIO_TOKEN" -H 'content-type: image/png' \
     --data-binary @my-demo/still.png
```

The manifest first: a file with no `demo.json` beside it is a demo nothing can
list, name or delete, and the route refuses it. Over the cap the answer is `413`;
the wrong content type is a `415`.

## 5. Wire it into a lecture

A demo in the library is not yet on a page. The lecture's fragment carries the
mount node:

```html
<figure class="demo-block">
  <h3 class="demo-title">…</h3>
  <div id="demo-my-demo"></div>
</figure>
```

and the manifest says what mounts there:

```bash
curl -X PUT "$STUDIO/courses/$COURSE/lectures/<lecture>/manifest" \
     -H "authorization: Bearer $STUDIO_TOKEN" -H 'content-type: application/json' \
     -H 'if-match: "<the etag you were given>"' \
     -d '{"demos":{"#demo-my-demo":{"kind":"file","demo":"my-demo","aspect":0.5,"title":"My demo"}}}'
```

In the studio the same thing is the demo block's *source* toggle: *platform demo*
or *course demo*, and a select of the library with the stills.

Publishing the lecture copies your two files beside it. Only wired demos are
copied, and only those two files.

## 6. Contribute it to the gallery

A demo that is generic — not tied to one course's notation or one lecturer's
example — is welcome here. A pull request adding a folder under
[`demos/examples/`](../../demos/examples/) with the three files is the whole
process. CI runs the lint; the gallery rebuilds when it is merged.

Two things to know before you open it:

- **Nobody checks your physics.** The lint checks the format. The kit's own three
  examples were checked by hand once, against closed-form results, and that is
  stated in each file's header comment — do the same for yours, in the file, so
  the next reader knows what was verified and how.
- **Keep it generic.** No course content, no lecturer's or student's name, no URL
  from anybody's deployment. An example is a pendulum, not a homework problem.
