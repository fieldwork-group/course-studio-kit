# Fieldwork Course Studio — the public kit

Welcome. This repository is the public side of the **Fieldwork Course Studio**:
a hosted studio where lecture notes and decks are written in the browser, block
by block, exactly as students will read them — typeset formulas and live demos
inside the argument, in Hebrew or in English, each in its own direction. The
studio is at <https://studio.fieldwork-group.com/studio/>; the published
courses are at <https://courses.fieldwork-group.com/>.

Everything the studio's own editor does is an HTTP call, and the same calls are
open to an AI assistant, a script, or an agent of your own. This kit is what you
need to make those calls, and what you need to build a demo that runs in a
lecture:

- **the `studio` command** — one file, nothing to install, that puts a course
  on your machine and sends your edits back;
- **the API documents** — the contract, the agent guide, the vocabulary of a
  lecture and the two schemas;
- **the demo format** — one self-contained HTML file, a helper, a template, three
  worked examples and a lint;
- **the gallery** — <https://fieldwork-group.github.io/course-studio-kit/>, every
  example running in the same sandbox a lecture uses.

## Start here

| If you are… | Read |
|---|---|
| **a lecturer with a studio account** who wants an AI to help write the course | [Work with an AI coding agent](#work-with-an-ai-coding-agent) — four steps, then paste the prompt |
| **running the `studio` command** yourself | [`cli/README.md`](cli/README.md) |
| **an agent** about to read or write a lecture | [`AGENTS.md`](AGENTS.md) first, then [`docs/api/openapi.yaml`](docs/api/openapi.yaml) and [`docs/api/vocabulary.md`](docs/api/vocabulary.md) |
| **building a demo** — a figure that moves — for a course | [`docs/demos/format.md`](docs/demos/format.md), then copy [`demos/template/`](demos/template/) |
| **browsing** | the [gallery](https://fieldwork-group.github.io/course-studio-kit/) |

## Getting access

An account on the studio is what grants access; the kit does not. If you have
one, there are two ways to bring an assistant in, and the first is the one to
start with.

### Work with an AI coding agent

1. **Make a folder** for your course on your machine. Empty is fine.
2. **Get a token.** In the studio: account menu → *API access* → *New token*,
   scoped to your course. It is shown once. A token is scoped to `read` ·
   `write` · `publish`, each separately, optionally to **one course**, and is
   revocable in one click. A token cannot mint or revoke tokens; that needs a
   signed-in session, so a leaked one cannot widen itself.
3. **Set the folder up:**

   ```bash
   npx --package github:fieldwork-group/course-studio-kit studio init
   ```

   (or clone this kit beside the folder and run
   `node ../course-studio-kit/cli/studio.mjs init`). Paste the token when it
   asks — it is never a flag, so it stays out of your shell history. It is
   written to a local `.env` that the folder ignores; nothing else holds it.
4. **Start a coding session in the folder** — Claude Code, or any agent with a
   shell — and give it this as its first message:

   > This folder is a course in the Fieldwork Course Studio. Read `AGENTS.md`
   > from the kit first (`studio kit-path` prints where it is, or it is in
   > `../course-studio-kit/`). The API token is in `.env` as `STUDIO_TOKEN`;
   > the `studio` command reads it. Start with `studio status` and
   > `studio pull <course>`, edit the files on disk, check your work as the kit
   > describes, and `studio push` when I say so. Never publish, never print the
   > token, and never commit `.env`.

`studio pull <course>` writes the whole course — the guides, the demos and
every lecture — into `courses/<id>/`, in the same layout the studio's own
repository uses, so everything in this kit works on it. The commands are in
[`cli/README.md`](cli/README.md); what the agent needs to know before its first
write is [`AGENTS.md`](AGENTS.md).

Every change made through a token carries the token's name, so the lecture's
history reads *"someone@… via claude-code"*, and any afternoon is one restore
away. Publishing is allowed on purpose: the version log is the safety valve,
not the publish button — and the prompt above tells the agent to leave it to
you.

### A Claude connector, for a chat

Nothing to install and no token on your machine: in claude.ai, Claude Desktop
or Claude Code, add a custom connector by URL and sign in with your studio
account. Claude then reads and edits the courses you have, held to exactly the
permissions you are.

```
https://studio.fieldwork-group.com/api/mcp
```

```bash
claude mcp add --transport http studio https://studio.fieldwork-group.com/api/mcp
```

**The client id and secret come from a studio administrator** — Cognito has no
dynamic client registration, so the client is pre-registered and those two
values are the whole of the setup. That is why this is the second way in rather
than the first. [`AGENTS.md`](AGENTS.md) has the step-by-step for each Claude
surface.

A chat can do the whole edit loop: read a lecture, change it, upload a figure,
leave a note, preview, publish. What it cannot do is the part of a demo that is
not text — it can write a single self-contained `demo.html` and save it, but it
cannot build one from the modular source, run the lint that mounts it in a
browser with no network, watch it run, or render its still image. Those want a
shell, which is the first way in.

If you have no account, the demo half of the kit still works in full: a demo is
a file, and it runs anywhere.

## The API in one screen

```bash
STUDIO=https://studio.fieldwork-group.com/api

curl -H "authorization: Bearer $STUDIO_TOKEN" "$STUDIO/openapi.json"   # the contract
curl -H "authorization: Bearer $STUDIO_TOKEN" "$STUDIO/me"             # who you are, what you may do
curl -H "authorization: Bearer $STUDIO_TOKEN" "$STUDIO/courses"

# the edit loop: get with an ETag, send the whole fragment back with If-Match
curl -H "authorization: Bearer $STUDIO_TOKEN" \
     "$STUDIO/courses/<course>/lectures/<lecture>"

curl -X PUT "$STUDIO/courses/<course>/lectures/<lecture>/notes" \
     -H "authorization: Bearer $STUDIO_TOKEN" -H 'content-type: text/html' \
     -H 'if-match: "9f2a…"' -H 'x-changed-blocks: K7F2Q9X1M0' \
     --data-binary @notes.html

curl -H "authorization: Bearer $STUDIO_TOKEN" \
     "$STUDIO/courses/<course>/lectures/<lecture>/preview?mode=notes"
curl -X POST -H "authorization: Bearer $STUDIO_TOKEN" \
     "$STUDIO/courses/<course>/lectures/<lecture>/publish"
```

A lecture is three things stored separately: the **fragment** (`notes.html`,
and `slides.html` when there is a deck — a flat list of blocks, no page around
it), the **manifest** (`lecture.json`: numbers, titles, which demo mounts where)
and the **assets** (figures and data). The studio renders the page, the deck and
the PDF from those. What a fragment may contain is
[`docs/api/vocabulary.md`](docs/api/vocabulary.md); the schema is also the
sanitiser, so a save carrying markup the studio would never produce is refused
rather than cleaned up.

Four things that trip up a first client, all explained in
[`AGENTS.md`](AGENTS.md):

1. the body of a save is the **whole** fragment, never a patch;
2. `If-Match` is required (or `If-None-Match: *` to create);
3. a `412` means someone saved while you were working — get again, re-apply,
   save again;
4. block `data-id`s are kept exactly as they were, because notes and history
   are anchored to them.

Through the connector the same loop is a handful of tools — `studio_whoami`,
`studio_get_lecture`, `studio_save_notes`, `studio_preview_url`,
`studio_publish` — that call the same route functions as HTTP, so the ETag,
sanitiser and history behaviour is identical. The documents in
[`docs/api/`](docs/api/) are also served to a connector as MCP resources
(`studio://guide`, `studio://vocabulary`, `studio://openapi`).

## Demos

A **course demo** is one self-contained HTML file that runs inside a lecture
page in a `sandbox="allow-scripts"` frame with no network, is wired into the
lecture the way a platform figure is, and is printed as its still.

| | |
|---|---|
| [`docs/demos/format.md`](docs/demos/format.md) | the contract: the three files, the caps, the sandbox, the protocol table |
| [`docs/demos/authoring.md`](docs/demos/authoring.md) | how to build one, check it, and put it in a course |
| [`docs/demos/faq.md`](docs/demos/faq.md) | why no network, why one file, inlining a library, Hebrew on canvas |
| [`demos/sdk/studio-demo.js`](demos/sdk/studio-demo.js) | the twenty-line helper every example inlines |
| [`demos/template/`](demos/template/) | runs as it is: a square, the protocol, a still |
| [`demos/examples/`](demos/examples/) | a pendulum (canvas, RK4, Hebrew UI), superposition (p5 inlined, English), a standing wave (SVG) |

To check a demo of your own the way the studio will:

```bash
npm install
node tools/check-demo.js path/to/my-demo          # the lint
node tools/build-gallery.js                        # → site/, the gallery, locally
```

The lint checks the format and then mounts the demo in a real browser, in the
same sandbox under the same content policy, and asserts **zero network
requests** and a `ready` message within five seconds. That is the one claim an
author cannot check by looking.

The examples are generic physics belonging to no course; take one into your own
course without asking.

## What is in here

```
README.md              this
AGENTS.md              the four steps, the starting prompt, and the agent guide
cli/                   studio.mjs — the `studio` command, one file · README.md
LICENSE                MIT (code, demos) · docs/LICENSE  CC BY 4.0 (documents)
docs/api/              openapi.yaml · agent-guide.md · vocabulary.md
                       lecture.schema.json · course.schema.json
docs/demos/            format.md · authoring.md · faq.md
demos/sdk/             studio-demo.js
demos/template/        demo.html · still.png · demo.json
demos/examples/        pendulum-canvas · superposition-p5 · standing-wave-svg
tools/                 check-demo.js · build-gallery.js · gallery/
```

The API documents, `AGENTS.md` and everything under `cli/` are copies of the
studio's own and are refreshed from it, so a correction to one of them is an
issue here, not a pull request. Demos are
welcome as pull requests; see [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Licences

Code and demos are **MIT** ([`LICENSE`](LICENSE)); the documents under `docs/`
are **CC BY 4.0** ([`docs/LICENSE`](docs/LICENSE)). So a lecturer can take an
example demo into their own course without a licence question, and the
documents can be quoted with attribution.
`demos/examples/superposition-p5/demo.html` contains an unmodified copy of
p5.js, which keeps its own LGPL 2.1 licence; the note is in `LICENSE`.
