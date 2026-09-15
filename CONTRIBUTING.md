# Contributing

## A demo

A pull request adding a folder under `demos/examples/` — the three files
[`docs/demos/format.md`](docs/demos/format.md) describes. CI runs the lint, and
the gallery rebuilds on merge.

Nobody reviews the physics. The kit's own three examples were checked by hand
once against closed-form results, and each says in its header comment what was
checked and how; do the same. Keep an example generic: no course content, no
names, no URLs from anybody's deployment.

```bash
npm install
npx playwright install chromium
npm test                                   # the lint on every demo, the gallery, the links
```

## The API documents

`docs/api/*` and `AGENTS.md` are copies of the studio's own documents, refreshed
from the studio's repository by its maintainers. An edit made here is overwritten
on the next refresh, so a correction is an **issue**, not a pull request; it gets
fixed at the source and lands here with the next sync.

`tools/gallery/host.js` is a copy of the platform's demo host, reduced to what a
static page needs: the same sandbox attribute, the same message envelope, the
same `event.source` check, the same height cap and the same theme tokens. That
copy is what makes the gallery's claim true — a demo that runs in a card runs
unchanged in a lecture — so it changes only when the platform's does.
