# `studio` — the command line

*This is the kit's copy, refreshed from the studio; a correction to it is an
issue, not a pull request. It documents the bundled `cli/studio.mjs` that ships
here — the studio's own copy is longer and covers what only a maintainer can
run.*

One file, `cli/studio.mjs`, with everything it needs inside it. Node 22 or
newer, and nothing to install:

```bash
npx --package github:fieldwork-group/course-studio-kit studio init     # in your course folder
node /path/to/course-studio-kit/cli/studio.mjs status                  # a clone works the same
```

`studio kit-path` prints the directory the kit ended up in, so an agent can
find `AGENTS.md` and `docs/demos/format.md` without being told where they are.

## The folder

`studio init` sets up the folder you are standing in: it asks for the access
token you minted in the studio (*API access* in the account menu), checks it
against the API, and writes

```
.env                  STUDIO_TOKEN=…        mode 600, and never printed
.studio/config.json   the studio's origin, the token's id and label, your courses
.gitignore            .env and .studio/ added to it
```

**The token is never a flag.** It is read from the prompt, or from
`$STUDIO_TOKEN` if that is already set. A credential in `argv` is in the shell
history of the machine it was typed on and in the process list of anything that
looks while it runs. For the same reason `init` refuses to run in a folder
whose `.env` is already tracked by git: a token written there would be in the
next commit.

Afterwards every command reads the token out of `.env` — from that folder or
any folder inside it — so nothing else has to hold it. An exported
`$STUDIO_TOKEN` or an explicit `--token` still wins over the file.

## The commands

| Command | Does | Exit |
|---|---|---|
| `init [<dir>]` | the folder above: prompt, verify, `.env`, `.studio/config.json`, `.gitignore` | 1 refused or already tracked |
| `kit-path` | where this kit is installed, one line | 2 not running from the kit |
| `status [<dir>] [--course id] [--json]` | who the credential says you are, then per lecture: lock holder, open notes, unpulled changes, last event, published | |
| `pull <course> [<into-dir>]` | the whole course into `courses/<id>/` — guides, demos, every lecture | 2 no such course |
| `pull <lecture-dir>` | one lecture, and the demos it wires | 2 no such lecture |
| `push [<lecture-dir>]` | the working copy back, with the ETags `pull` recorded; never merges | 2 never pulled · 3 conflict, pull first |
| `notes list \| add \| reply \| done \| reopen \| delete` | the author-notes thread — where an agent asks instead of guessing | 2 no such note |
| `demos list \| pull \| push` | the course's demos, three files each under `courses/<id>/demos/<slug>/` | 2 no `demo.json` · 3 conflict |
| `publish [<lecture-dir>]` | publish and wait for the job | 4 job failed |
| `import <lecture-dir>… [--course id] [--title "…"]` | first-time push of a lecture folder that the studio does not have yet | |
| `login [--api <origin>]` | sign in with a browser instead of a token, cached in `~/.config/studio/` | 1 refused or timed out |
| `tokens create \| list \| revoke` | mint and revoke access tokens — **a signed-in session, not a token** | |
| `reader set \| show <course>` | the password students type to open the published notes — **a signed-in session** | |
| `access list \| grant \| revoke \| limit` | who may see which course — **administrators, and a session** | |

The last three refuse an access token with `session_required`, and say so in
words. That is deliberate: a held credential must not be able to mint its
successor, widen its owner's reach, or change the door students walk through.

`--api <origin>` names the studio; after `init` it comes from
`.studio/config.json` and you do not pass it again.

**A course `import` has to open gets its id as its title**, unless `--title`
says otherwise — `studio import ./L01 --course optics --title "אופטיקה"`. The
rest of a course's identity (the English title, the term, the lecturer line,
the look) is edited in the studio, on the course page, where you can see what
you are typing; there are no flags for it here, and a title you do not like is
one field to change.

## The layout `pull` writes

```
courses/<course>/
  conventions.md  glossary.md  style.md  syllabus.md   the course's guides
  demos/<slug>/   demo.json · demo.html · still.png    one self-contained file each
  lectures/<lecture>/
    notes.html      the lecture, as a page
    slides.html     the deck, when there is one
    lecture.json    numbers, titles, which demo mounts where
    figures/  data/ what the documents refer to
    author-notes.md the thread, as markdown beside the lecture
    .studio/        the ETags `push` sends as `If-Match` — local, not committed
```

That is the same layout the studio's own repository uses, so the kit's demo
tools work on it unchanged.

Two things worth knowing about the pulled files:

- **`notes.html` is a page, not a fragment.** The `<head>` it carries points at
  the platform's stylesheets and scripts by a relative path that only resolves
  inside the studio's repository, so a pulled file opens unstyled on your
  machine. Look at your work through the studio — the reading view, or
  `studio status` for what changed — and treat the file on disk as the text.
  The published page is rendered by the platform from what you push.
- **`data-id` attributes are the studio's.** Keep them exactly as they are on a
  block you edit, give a new block none at all, and never copy one onto a
  second block. Notes and history are anchored to them. After a push that
  assigned ids, `push` **writes the document back** into your working copy
  with the ids the server chose — so a block you added carries its id from
  then on, and the next push does not send it as new again. Re-read the file
  after a push before editing it further.
- **A push saves only what changed.** A document whose bytes the studio
  already holds is reported `unchanged` and not saved again; so is the
  manifest. A push with nothing to say writes no versions and no events.

## When a push is refused

The API refuses a fragment carrying markup the schema would not emit — a
`<script>`, an `on*` attribute, a `javascript:` link — with `422
unsafe_markup`, and **writes nothing**. `push` prints the list, block by block,
because the fix is in your working copy:

```
studio: PUT notes: 422 the fragment carries markup the schema would not emit; nothing was written
    7Q3K5M2P1A (paragraph): <script> removed
    B4X1Z8N0RD (raw): on* attribute: onclick
```

A `412` is the other refusal worth recognising: somebody saved in the studio
while you were working. `studio pull` and re-apply; do not push the same bytes
again.

## Exit codes, because this runs in scripts

```
0  fine
1  any other failure
2  the folder is not a working copy, or the thing named does not exist
3  a save was refused: the studio has a newer version — pull first
4  the publish job failed
```
