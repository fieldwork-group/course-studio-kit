# Fieldwork Course Studio — the public kit

Welcome. This repository is the public side of the **Fieldwork Course Studio**:
a hosted studio where physics lecture notes and decks are written in the browser,
block by block, exactly as students will read them, with interactive demos
running inside the argument. The studio is at
<https://studio.fieldwork-group.com/studio/>; the published courses are at
<https://courses.fieldwork-group.com/>.

Everything the studio's own editor does is an HTTP call, and the same calls are
open to an AI assistant, a script, or an agent of your own. This kit is what you
need to make those calls, and what you need to build a demo that runs in a
lecture:

- **the API documents** — the contract, the agent guide, the vocabulary of a
  lecture and the two schemas;
- **the demo format** — one self-contained HTML file, a helper, a template, three
  worked examples and a lint;
- **the gallery** — <https://fieldwork-group.github.io/course-studio-kit/>, every
  example running in the same sandbox a lecture uses.

## Start here

| If you are… | Read |
|---|---|
| **a lecturer with a studio account** who wants an AI to help write the course | [Getting access](#getting-access), then hand [`AGENTS.md`](AGENTS.md) to your assistant |
| **an agent** about to read or write a lecture | [`AGENTS.md`](AGENTS.md) first, then [`docs/api/openapi.yaml`](docs/api/openapi.yaml) and [`docs/api/vocabulary.md`](docs/api/vocabulary.md) |
| **building a demo** — a figure that moves — for a course | [`docs/demos/format.md`](docs/demos/format.md), then copy [`demos/template/`](demos/template/) |
| **browsing** | the [gallery](https://fieldwork-group.github.io/course-studio-kit/) |

## Getting access

An account on the studio is what grants access; the kit does not. If you have
one, there are two ways to bring an assistant in.

**A Claude connector — nothing to install, no token to keep.** In claude.ai,
Claude Desktop or Claude Code, add a custom connector by URL and sign in with
your studio account. Claude then reads and edits the courses you have, held to
exactly the permissions you are.

```
https://studio.fieldwork-group.com/api/mcp
```

```bash
claude mcp add --transport http studio https://studio.fieldwork-group.com/api/mcp
```

The connector's client id and secret come from a studio administrator; they are
not printed anywhere public. [`AGENTS.md`](AGENTS.md) has the step-by-step for
each Claude surface.

**An access token — for a script, CI, or an agent with a shell.** Sign in to the
studio, open **API access** in the account menu, and create a token. It is shown
once. A token is scoped:

- `read` · `write` · `publish`, each separately, all three on by default;
- optionally to **one course**, so an agent working on one course cannot touch
  another;
- revocable in one click. A token cannot mint or revoke tokens; that needs a
  signed-in session, so a leaked token cannot widen itself.

Every change made through a token carries the token's name, so the lecture's
history reads *"someone@… via claude-code"*, and any afternoon is one restore
away. Publishing is allowed on purpose: the version log is the safety valve, not
the publish button.

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
AGENTS.md              the agent guide, the file an agent reads first
LICENSE                MIT (code, demos) · docs/LICENSE  CC BY 4.0 (documents)
docs/api/              openapi.yaml · agent-guide.md · vocabulary.md
                       lecture.schema.json · course.schema.json
docs/demos/            format.md · authoring.md · faq.md
demos/sdk/             studio-demo.js
demos/template/        demo.html · still.png · demo.json
demos/examples/        pendulum-canvas · superposition-p5 · standing-wave-svg
tools/                 check-demo.js · build-gallery.js · gallery/
```

The API documents are copies of the studio's own and are refreshed from it, so a
correction to one of them is an issue here, not a pull request. Demos are
welcome as pull requests; see [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Licences

Code and demos are **MIT** ([`LICENSE`](LICENSE)); the documents under `docs/`
are **CC BY 4.0** ([`docs/LICENSE`](docs/LICENSE)). So a lecturer can take an
example demo into their own course without a licence question, and the
documents can be quoted with attribution.
`demos/examples/superposition-p5/demo.html` contains an unmodified copy of
p5.js, which keeps its own LGPL 2.1 licence; the note is in `LICENSE`.
