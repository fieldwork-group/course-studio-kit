# Writing a course through the API

You are editing lecture notes in the Course Studio — **in the course's own
language**, which `GET /courses/{c}` tells you (`lang` is `he` or `en`, and
`dir` follows from it). Students read them in a browser and print them as a
handout, and they live on typeset formulas and demos that run inside the
argument. What the course is about is the author's, and none of the rules here
depend on it. Read this before your first request: it is the part of the
studio's rules that holds in every course. The part that does not — the
notation, the sign conventions, the one term per concept — is served per course
by the API, and this document tells you where.

**Read `lang` before you write a word.** Everything you add goes into that
language: the prose, a caption, the label on a result box, a new section's
title. A Hebrew paragraph in an English course is not a style slip, it is a
page that reads in two directions.

## Three rules you must not break

1. **No prose script inside math.** KaTeX has no metrics for a right-to-left
   prose face; it renders boxes and lays the run out backwards inside a formula
   that reads forwards. For a Hebrew course that means: never Hebrew inside
   `$…$`. Put it in HTML *around* the formula — `מ־$\omega_0$`, never
   `$מ-\omega_0$` — and the same for any other right-to-left script.
2. **`.board-note` marks what is derived on the board.** The lecturer derives in
   chalk; the page carries what chalk cannot. When a page states a result whose
   derivation happens on the board, say so in a `<div class="board-note">`, in
   one sentence, naming the step.
3. **A slide that restates a paragraph of the notes should not exist.** The
   notes are written first and carry every derivation. The deck is *cut from*
   them: boxed results, setup figures and demos, nothing else.

Beyond those: use the term the course's glossary guide already has (see *The
session*, below). Do not invent a second translation for a term that is in
there. Prose is concise and accurate, with no embellishment.

## What a lecture is

Three things, stored separately:

- **the fragment** — `notes.html`, and `slides.html` when there is a deck. Not a
  page: a flat list of blocks, with no `<head>`, no boot script and no
  wrappers. The platform's half is added when the page is rendered.
- **the manifest** — `lecture.json`: the number, the titles, the standfirst
  lines, the reading line, and which demo mounts where.
  `docs/api/lecture.schema.json` is the authority and the API validates against
  it.
- **the assets** — `figures/*` and `data/*`, referenced from the fragment by
  relative path.

What the fragment may contain is `docs/api/vocabulary.md`: every node, the
classes that give it meaning, and a real example of each lifted from the
committed lectures. **The schema is the sanitiser** — whatever it does not know
cannot reach a student's browser, so a save carrying markup it would not emit is
refused with `422 unsafe_markup` naming the blocks and what was wrong. That is a
refusal, not a cleanup: your content did not land.

## Two ways in

**With a token, in a folder — the first way.** `cst_…`, minted by the author in
the studio's *API access* panel, sent as `Authorization: Bearer`. It is the way
in that needs nobody's permission but the author's: they make it in a click,
scope it to one course, and revoke it in another. On a machine it lives in a
`.env` the folder ignores, written by `studio init` from the public kit, and
the `studio` command reads it from there — `AGENTS.md` in the kit has the four
steps and the prompt that starts the session, and `cli/README.md` beside it has
the commands. This is the way for a coding session, for a script and for CI.
The routes are below and the CLI is a thin client over them.

**As a connector, in a chat — the second way.** The studio runs an MCP server at
`https://studio.fieldwork-group.com/api/mcp`. Add that URL as a custom
connector, sign in with your studio account, and the tools below become
available in the conversation. Nothing is installed and no credential ends up on
your machine — Claude keeps the tokens and the model never sees them. It is
second rather than first for one reason: **the client id and secret come from a
studio administrator**, because Cognito has no dynamic client registration, so
somebody has to hand them to you before you start.

What a chat can do through it is the whole edit loop — read a lecture, change a
fragment, upload a figure, leave a note, preview, publish. What it cannot do is
the part of a demo that is not text: it can write a single self-contained
`demo.html` and save it, but it cannot build one from the kit's modular source,
run the lint that mounts it in a browser with no network, look at it running, or
render its still image. Those want a shell, which is the first way in.

- **Claude Desktop · claude.ai · mobile · Cowork** — *Settings → Connectors →
  Add custom connector*, paste the URL, open *Advanced settings* and enter the
  **client id** and **client secret** the studio's administrator gives you.
  (Cognito has no dynamic client registration, so the client is pre-registered;
  those two values are the whole of the setup.) Click *Connect*, sign in on the
  page that opens, and approve the scopes.
- **Claude Code** —

  ```bash
  claude mcp add --transport http studio https://studio.fieldwork-group.com/api/mcp
  ```

  and `/mcp` in the session to sign in. If the browser round trip fails — the
  loopback callback port is not guaranteed to be one Cognito has been told
  about — use a token instead:

  ```bash
  claude mcp add --transport http studio https://studio.fieldwork-group.com/api/mcp \
    --header 'Authorization: Bearer cst_…'
  ```

The tools are named `studio_*`; `studio_whoami` first, then `studio_guides`.
Read the resources `studio://guide` (this file) and `studio://vocabulary`
before your first write. Everything the tools do goes through the routes below,
so the rest of this document is the contract either way — a 412 through a tool
is the same 412, carrying the same current ETag.

## The session

```
GET /openapi.json                    the contract: every route, request and answer
GET /me                              → { actor, groups, tenant }
GET /courses                         → the courses you can see
GET /courses/{c}                     → the course, its language, its lectures, its guides
GET /courses/{c}/guides/conventions  → the notation and the sign conventions
GET /courses/{c}/guides/glossary     → the one term per concept
GET /courses/{c}/guides/style        → how the prose should read
GET /courses/{c}/guides/syllabus     → what is taught when, and what state it is in
```

Read the guides before you write a line of the course. They are the difference
between a lecture that fits it and one that has to be rewritten: which symbol
means which quantity, which sign convention the board uses, which word the
course has already chosen for a term that has more than one.

`groups` in `GET /me` tells you what the rest of the API will allow. `authors`
writes; `viewers` reads everything, including drafts, and is refused every
non-GET.

A course that is not in your list is one you have not been granted, and there
is no way through the API to reach it. A *new* course is the lecturer's to
open — `POST /courses` with `{ title, lang }`, which makes them its author
in the same request — but only from a signed-in session in the studio or the CLI: a
token or a connector gets `403 session_required`, because a held credential
must not be able to widen the reach of the person holding it. If you are asked
to start a course, say that the lecturer opens it once in the studio (the
account menu, *New course*) and you take it from there. A user may open ten
courses unless an administrator raises their limit; deleting one is an
administrator's, from the foot of the course page.

A course opened that way can start from a **template** instead of empty —
`{ title, from: 'starter-he' }` or `{ title, from: 'starter-en' }`, offered on
the same page — which fills it with a short tour of the studio in two lectures,
written to be read once and then edited into something else. There is one
template per language and they are two courses rather than one translated, so
`from` decides the course's language: send no `lang` and it is the template's,
send one that disagrees and the answer is `400 invalid_course`.

Every new author gets one on their first sign-in. If a lecturer you are working
with still has theirs, it is not content anybody is attached to: it is the
fastest thing in the course to overwrite, and reading its `style` guide is the
quickest way to learn how this course wants to sound. It is also the example to
read if you have never seen a lecture in this studio — it uses every block
type, wires two demos and carries a deck — and it costs nobody anything if you
read it first.

The four guides are still read here and nowhere else in the interface: the
studio stopped drawing them on the course page on 2026-09-17, because they are
written in the repo and read by you.

## The edit loop

```
GET  /courses/{c}/lectures/{l}
     → { manifest, manifestEtag, notes: { body, etag }, slides, lock }

     … change the fragment …

PUT  /courses/{c}/lectures/{l}/notes
     If-Match: <the etag you were given>
     x-changed-blocks: <ids of the blocks you changed>
     body: the WHOLE fragment
     → { etag, versionId, idsAssigned, bytes }
```

Four things about that `PUT`:

- **The body is the whole fragment, not a patch.** There is no partial save. Get
  it, change it, send all of it.
- **`If-Match` is required.** It is the ETag from the `GET`. Without it the
  answer is `400 if_match_required`. To create a document that does not exist
  yet — a deck the lecture has not got — send `If-None-Match: *` instead.
- **A `412` means someone saved while you were working.** The body carries the
  current `etag`, who wrote it and when. Do not retry the same body: `GET`
  again, re-apply your change to the new text, and save with the new ETag.
- **`x-changed-blocks`** is a comma-separated list of the `data-id`s you
  touched. It becomes the summary in the history, which is how a person later
  sees what you did.

Then look at it, and publish:

```
GET  /courses/{c}/lectures/{l}/preview?mode=notes    the page, as a student sees it
POST /courses/{c}/lectures/{l}/publish               → 202 { job, status, keys }
GET  /courses/{c}/lectures/{l}/publish/{job}         poll: copying → rendering → done | failed
```

The pages are already live when the `202` arrives; what is still running is the
PDF. A failed print is a failed job, not a failed publish.

**A course with no address, or no reader password, cannot be published**: `409
address_required` and then `409 reader_password_required`, before anything is
copied.

The **address** is the course's published prefix — the first segment of every
student URL (`/<address>/<lecture>/notes`), the key the edge looks the course
up by, and the user name students type. It is not the course id: since
2026-09-17 the id is generated, is the store's key, appears in the studio's own
URL and in your requests, and is seen by no student. The address is chosen
once, before the first publish, and is fixed afterwards. `GET /courses/{c}`
carries it as `course.address`, with `course.publishedFirst` saying whether it
is fixed yet.

The **reader password** goes with it: the edge admits a course only when its
credential is on it, so publishing without one would put a lecture on the site
that every student gets a 404 for.

Both are one action by the course's author, from a signed-in session: the
Publishing panel on the course page in the studio, or `studio address set <c>
<address>` and `studio reader set <c>` at a shell. **Neither is yours to set** —
there is a route for the address but it refuses a token or a connector with
`403 session_required`, because a held credential must not be able to move or
open the door students walk through. If you meet either 409, say so and ask; do
not retry.

## Block ids

Every block in a stored fragment carries `data-id="…"`, ten characters of
base32. **Keep them.** They are how the editor's merge, the author notes and the
history all point at a block; changing one silently detaches every note anchored
to it.

- Editing a block: keep its `data-id` exactly as it was.
- A **new** block: give it no `data-id` at all. The server assigns one and tells
  you how many it assigned (`idsAssigned`).
- Never copy a `data-id` onto a second block. Two blocks with one id is a
  document the merge cannot reason about, so the server does not store one:
  the second block is treated as new and gets its own id (counted in
  `idsAssigned`), and the first keeps the id the notes and the history point
  at. If you duplicated a block on purpose, drop the id from the copy yourself
  and nothing surprises you.

`data-id` is the only attribute you must not author. Section anchors (`id="s4"`)
are different: they are the lecturer's, the table of contents and every
cross-reference use them, and they are kept verbatim.

## Adding a figure

Two steps. The bytes never pass through the API.

```
POST /courses/{c}/lectures/{l}/uploads
     { "name": "reflection.svg", "type": "image/svg+xml", "size": 4210 }
     → { url, fields, href: "figures/reflection.svg" }

POST <url>   multipart/form-data: every entry of `fields` first, the file last
```

Then reference it from the fragment by the `href` you were given:

```html
<figure class="fig">
  <img src="figures/reflection.svg" alt="שיקוף המטוטלות סביב נקודת האמצע">
  <figcaption>שיקוף סביב הציר שבאמצע.</figcaption>
</figure>
```

PNG, SVG and JPEG go under `figures/`; JSON — numbers computed ahead of time
that a demo reads instead of computing them — goes under `data/`. Five megabytes each. Every SVG is
sanitised before it is served or published: an SVG from the site's own origin is
a document, not a picture, so scripts, event handlers and external references
come out of it.

**If you cannot make the figure**, do not describe it in prose and move on. Put
a pending block where it belongs and say what it should show:

```html
<figure class="fig pending">
  <p class="brief">גרף של x(t) עבור שלושה ערכי ריסון, עם המעטפת</p>
</figure>
```

The theme labels it "in preparation" to a student, and the brief stays on the
page as the description of what is missing — so whoever comes back to it, you
or the author, knows what to draw.

## Wiring a demo

A demo is an empty `<div>` with an id in the fragment, and an entry in the
manifest saying what mounts there. The fragment:

```html
<figure class="demo-block">
  <h3 class="demo-title">מסה על קפיץ, חי</h3>
  <div id="demo-mass-spring"></div>
</figure>
```

The manifest, `PUT /courses/{c}/lectures/{l}/manifest`, keyed by the selector:

```json
{ "demos": {
    "#demo-pendulum-lab": { "kind": "file", "demo": "pendulum-lab",
                            "aspect": 0.5, "title": "Pendulum lab" } } }
```

There is one kind of demo: one self-contained HTML file the course owns, run
in a sandboxed frame with no network. `demo` is its slug — `GET
/courses/{c}/demos` lists them — and `aspect` and `title` are copied off that
demo's own `demo.json` so a published page needs no API to size the frame.
`docs/demos/format.md` is the format; write a demo when the course has none
that shows the point.

`published` is not yours. The publish route writes it; a manifest body carrying
it is a `400`, and the stored value is kept for you when you leave it out.

## When you are not sure

Leave a note on the block instead of guessing at the subject:

```
POST /courses/{c}/lectures/{l}/notes-thread
     { "body": "על הלוח הסימן הפוך — לשנות גם כאן?",
       "anchor": { "section": "s4", "block": "K7F2Q9X1M0",
                   "quote": "נבחר את הסימן כך ש" } }
```

The thread is never published. It is where the lecturer answers, and a note is
cheaper than a lecture that teaches the wrong sign. Anchor it to the block you
are unsure about, quote the sentence, and say what you would do.

## Refusals worth recognising

| Code | Means |
|---|---|
| `if_match_required` | a document save with no `If-Match` and no `If-None-Match: *` |
| `precondition` (412) | someone saved first; re-`GET`, re-apply, save again |
| `unsafe_markup` (422) | the fragment carried markup the schema would not emit; nothing was written |
| `invalid_manifest` (400) | the manifest failed its schema; `path` is the JSON Pointer of the offending key |
| `locked` (409) | someone has the lecture open. A courtesy, not a mutex — `If-Match` is what actually protects the save |
| `address_required` (409) | the course has no published address yet, and every student URL is that address. Its author sets one; you cannot |
| `reader_password_required` (409) | the course has no reader password, so a publish would be invisible to students. Its author sets one; you cannot |
| `session_required` (403) | a route a held credential may not call at all — `/tokens`, `/access`, `POST /courses`, the course address, the reader password |
| `forbidden` (403) | a `viewers` session tried to write, or the thing belongs to someone else |
| `too_large` | over the cap: 5 MB a figure, 256 KB a guide |

Every error is `{ error, message, … }`. `error` is stable and worth branching
on; `message` is a sentence for a person.

## The same loop, through the tools

```
studio_whoami                                     → actor, groups, scopes, courses
studio_guides { course: "my-course" }             → conventions, glossary, style, syllabus
studio_get_lecture { course, lecture, sections: "all" }
    → { manifest, manifestEtag, notes: { etag, bytes, sections, fragment }, openNotes }
studio_save_notes { course, lecture, fragment, etag, changedBlocks: ["K7F2Q9X1M0"] }
studio_preview_url { course, lecture }            → a link for the person to open
studio_publish { course, lecture }                → { job }   ← ask them first
studio_publish_status { course, lecture, job }
```

Three things about the tools that are not obvious from the names:

- **`studio_get_lecture` does not return the fragment unless you ask.** A
  lecture is 60 KB of prose and markup, which is about twenty thousand tokens,
  and a
  client that truncates a tool result cuts it mid-formula. The default answer
  is the manifest, the ETags and a list of the sections with their sizes; pass
  `sections: ["s3"]` to read one or `sections: "all"` for the whole thing —
  which is what a save needs, because a save sends every byte.
- **`studio_upload_figure` takes the bytes inline**, base64, up to 5 MB. There
  is no presign step through the tools: the two-step flow exists so a browser
  need not send a megabyte through the API, and you are already holding it.
- **`studio_publish` is two tools.** The first answers with a job id and the
  pages are already live when it does; what is still running is the PDF. Poll
  the second.

## The whole loop, once

```
GET /me · GET /courses · GET /courses/my-course/guides/conventions
GET /courses/my-course/lectures/L02
    → notes.etag = "9f2a…"
PUT /courses/my-course/lectures/L02/notes
    If-Match: "9f2a…"   x-changed-blocks: K7F2Q9X1M0
    → { etag: "b31c…", idsAssigned: 2 }
GET /courses/my-course/lectures/L02/preview?mode=notes
POST /courses/my-course/lectures/L02/publish   → { job: "K9QT" }
GET /courses/my-course/lectures/L02/publish/K9QT → { status: "done" }
```
