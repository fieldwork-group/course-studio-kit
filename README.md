# Course Studio kit

Everything you need to write a lecture, or a figure that moves, **without being
the platform**: the API description an agent reads, the format a demo has to
meet, a helper, a template, three worked examples, and a gallery that runs them.

This repository carries **no platform code and no course content**. The studio
itself is private; the documents here are a published projection of it, refreshed
by [`tools/sync-from-studio.sh`](tools/sync-from-studio.sh), and the examples are
generic physics belonging to nobody's course.

- **The gallery**: <https://fieldwork-group.github.io/course-studio-kit/> (once
  Pages is enabled on this repository)
- **If you are an agent**: [`AGENTS.md`](AGENTS.md), then
  [`docs/api/openapi.yaml`](docs/api/openapi.yaml)
- **If you are writing a demo**: [`docs/demos/format.md`](docs/demos/format.md),
  then [`demos/template/`](demos/template/)

## What the Course Studio is

A studio for interactive physics lecture notes and decks. A lecture is three
things stored separately — the **fragment** (`notes.html`, and `slides.html` when
there is a deck: a flat list of blocks, no page around it), the **manifest**
(`lecture.json`: numbers, titles, and which demo mounts where) and the **assets**
(figures and data). The platform renders the page, the notes and the deck from
those, publishes them behind a course password and prints a PDF.

Everything the studio's own editor does is an HTTP call, and the same calls are
open to anything you hold a credential for: the CLI, an MCP connector, curl, or an
agent of your own. The schema is the sanitiser — whatever it would not emit cannot
reach a student's browser — so a write that carries markup the studio would never
produce is refused rather than cleaned up.

## Who gets a token

An **author** — someone with an account on a studio deployment — mints a token in
the studio (or with the CLI), and hands it to whatever is going to do the writing.
A token is scoped:

- `read` · `write` · `publish`, each separately, all three on by default;
- optionally to **one course**, so an agent working on one course cannot touch
  another;
- revocable in one click, and **a token cannot mint or revoke tokens** — that
  needs a signed-in session, so a leaked token cannot widen itself.

Every event a token writes carries `via: { token, label }`, so the lecture's
history reads *"someone@… via claude-code"* and a bad afternoon is one restore
away. Publishing is allowed on purpose: the version log is the safety valve, not
the publish button.

If you do not have an account on a deployment, this repository is still the whole
demo format — a demo is a file, and it runs anywhere.

## Three ways in

### The CLI — for a shell, a script, a repository

```bash
npm install -g @fieldwork-group/studio      # once published to npm
studio login                                # PKCE, in your browser
studio pull  courses/<course>/lectures/<lecture>
studio push  courses/<course>/lectures/<lecture>
studio demos list · pull · push
```

`studio pull` writes the lecture as plain files — the fragment, the manifest, the
figures, the guides and the demos it wires — and the `notes.html` it leaves opens
by double-clicking, demo and all. That is the export guarantee: the content is
files, and it is yours.

### The MCP connector — for Claude Desktop, claude.ai and Claude Code

The studio publishes a **remote MCP server**: one URL added in Claude as a custom
connector, signed in with your studio account through the studio's own identity
pool. Nothing to install and no token on your laptop — the connector user is the
studio user, with that user's courses.

```
https://<your studio host>/api/mcp          # once deployed
claude mcp add --transport http studio https://<your studio host>/api/mcp
```

The tools are the routes: `studio_whoami`, `studio_list_courses`,
`studio_get_lecture`, `studio_save_notes`, `studio_save_slides`,
`studio_update_manifest`, `studio_upload_figure`, `studio_list_demos`,
`studio_put_demo`, `studio_delete_demo`, `studio_notes_thread`, `studio_tasks`,
`studio_history`, `studio_restore`, `studio_preview_url`, `studio_publish` and
`studio_publish_status`. They call the same route functions the HTTP API does, so
the ETag, sanitiser and event behaviour is identical by construction. The
documents in [`docs/api/`](docs/api/) are also served as MCP resources
(`studio://guide`, `studio://vocabulary`, `studio://openapi`), so a client that
reads resources on connect starts with the rules.

### HTTP — for everything else

```bash
STUDIO=https://<your studio host>/api

curl -H "authorization: Bearer $STUDIO_TOKEN" "$STUDIO/openapi.json"   # the contract
curl -H "authorization: Bearer $STUDIO_TOKEN" "$STUDIO/me"             # actor, groups, tenant
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

Four things that trip up a first client, all of them in
[`AGENTS.md`](AGENTS.md): the body of a save is the **whole** fragment, never a
patch; `If-Match` is required (or `If-None-Match: *` to create); a `412` means
someone saved while you were working — re-`GET`, re-apply, save again; and block
`data-id`s are kept exactly as they were, because notes and history are anchored
to them.

## Demos

A **user demo** is one self-contained HTML file that runs inside a lecture page in
a `sandbox="allow-scripts"` frame with no network, wired into a lecture the way a
platform figure is, and printed as its still.

| | |
|---|---|
| [`docs/demos/format.md`](docs/demos/format.md) | the contract: the three files, the caps, the sandbox, the protocol table |
| [`docs/demos/authoring.md`](docs/demos/authoring.md) | how to build one, check it and upload it |
| [`docs/demos/faq.md`](docs/demos/faq.md) | why no network, why one file, inlining a library, Hebrew on canvas |
| [`demos/sdk/studio-demo.js`](demos/sdk/studio-demo.js) | the twenty-line helper every example inlines |
| [`demos/template/`](demos/template/) | runs as it is: a square, the protocol, a still |
| [`demos/examples/`](demos/examples/) | a pendulum (canvas, RK4, Hebrew UI), superposition (p5 inlined, English), a standing wave (SVG) |

```bash
npm install
node tools/check-demo.js demos/template demos/examples/*      # the lint
node tools/build-gallery.js                                   # → site/
npm test
```

The lint checks the format and then mounts the demo in a real browser, in the same
sandbox under the same content policy, and asserts **zero network requests** and a
`ready` message within five seconds. That is the only claim an author cannot check
by looking.

**Contributing a demo** is a pull request adding a folder under `demos/examples/`.
CI runs the lint; the gallery rebuilds on merge. Nobody reviews the physics — the
kit's own three examples were checked by hand once against closed-form results,
and each says in its header comment what was checked and how. Keep an example
generic: no course content, no names, no URLs from anybody's deployment.

## What is in here

```
README.md              this
AGENTS.md              = docs/api/agent-guide.md — the file an agent reads first
LICENSE                MIT (code, demos) · docs/LICENSE  CC BY 4.0 (documents)
docs/api/              openapi.yaml · agent-guide.md · guide.md · vocabulary.md
                       lecture.schema.json · course.schema.json      (all synced)
docs/demos/            format.md · authoring.md · faq.md
demos/sdk/             studio-demo.js
demos/template/        demo.html · still.png · demo.json
demos/examples/        pendulum-canvas · superposition-p5 · standing-wave-svg
tools/                 check-demo.js · build-gallery.js · sync-from-studio.sh
                       gallery/host.js · gallery/gallery.css
site/                  the gallery, generated, deployed to GitHub Pages
```

`tools/gallery/host.js` is a copy of the platform's demo host, reduced to what a
static page needs: the same sandbox attribute, the same message envelope, the same
`event.source` check, the same height cap and the same twelve theme tokens. That
copy is what makes the gallery's claim true — a demo that runs in a card runs
unchanged in a lecture.

## What is not in here, and will not be

The schema package, the shell, the theme, the editor, the demo harness, any
lecture, any lecturer's or student's name or URL, any infrastructure name. The API
host in `openapi.yaml` is public by nature; nothing else about a deployment is.

## Keeping the documents current

`docs/api/*` and `AGENTS.md` have one source of truth — the private studio
repository — and this repository is a projection:

```bash
tools/sync-from-studio.sh ../course-studio            # copy, then read the diff
tools/sync-from-studio.sh ../course-studio --check    # exit 1 if the kit is behind
```

The script refuses to copy a file that carries anything which must stay private,
and nothing ever flows the other way: an edit made to `docs/api/` here is lost on
the next sync.

## Licences

Code and demos are **MIT** ([`LICENSE`](LICENSE)); the documents under `docs/` are
**CC BY 4.0** ([`docs/LICENSE`](docs/LICENSE)). So a lecturer can take an example
demo into their own course without a licence question, and the documents can be
quoted with attribution. `demos/examples/superposition-p5/demo.html` contains an
unmodified copy of p5.js, which keeps its own LGPL 2.1 licence; the note is in
`LICENSE`.
