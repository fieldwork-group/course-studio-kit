# `docs/api/` — the machine contract

Everything in this folder exists so that something which is not the studio SPA
can write a lecture: another person's agent, the MCP server, the CLI, a script.
The studio's own design lives in `docs/studio/`; this is the outward-facing
half.

| File | What | Written by |
|---|---|---|
| [`agent-guide.md`](agent-guide.md) | What an agent reads before its first request: what a lecture is, the session, the edit loop, block ids, figures, demos, the three hard rules. Under 300 lines, written for a model. | by hand |
| [`vocabulary.md`](vocabulary.md) | Every node and mark the schema knows, with its tag, its attributes, the classes that give it meaning in this course, and one real example. | `npm run docs:vocabulary -w schema` |
| [`lecture.schema.json`](lecture.schema.json) | `lecture.json` as JSON Schema 2020-12. The API validates every manifest against it. | the same command |
| [`course.schema.json`](course.schema.json) | `course.json`, the same way. | the same command |
| `studio/api/openapi.yaml` | Every route, with its request and response shapes, the error codes, the ETag rules and the two kinds of bearer token. | by hand |

The API serves the last one at **`GET /openapi.json`**, with `info.version`
equal to the API package's version, so a client can always ask the deployment
what it is running rather than trusting a file in a repository it cannot see.

## The four generated files, and what keeps them honest

Three things here are generated and committed, for the same reason the demo
bundles are: they are what a reader loads, and a stale one is worse than a
missing one because nothing says it is stale.

```bash
npm run docs:vocabulary -w schema             # vocabulary.md + the two schemas
npm run docs:vocabulary -w schema -- --check  # fails when any of them is stale — CI runs this
npm run build:openapi -w api                  # openapi.yaml → api/src/openapi.generated.js
npm run build:openapi -w api -- --check       # fails when it is stale — `npm test -w api` asserts it too
```

`vocabulary.md` has a **hand-written region** between
`<!-- hand-written: kept when this file is regenerated -->` and
`<!-- end hand-written -->`. It holds the two things the generator cannot infer
— what each class *means*, and the three rules — and it is copied through on
every regeneration. Edit it in the file itself; the seed in
`schema/tools/vocabulary.js` is only what a first run writes.

## The route parity test

`studio/api/test/openapi.test.js` walks the `(method, path)` pairs of a built
handler and asserts the set equals the set of operations in `openapi.yaml`, both
ways. A route with no entry fails the suite; an entry with no route fails it
too.

**Adding a route is therefore two lines**: `router.add(...)` in the route
module, and one operation under the same path in `openapi.yaml`. Nothing else,
and nothing in the test to update.

The only exemptions are `POST /_upload` and `GET /_download`, the local
stand-ins for presigned S3 URLs. They do not exist in a deploy, so documenting
them would send a client at an endpoint that is not there. The test asserts they
are still real routes, so an exemption cannot outlive the thing it exempts.

## The course guides are not in this folder

`conventions.md`, `glossary.md`, `syllabus.md` and `style.md` are the *course's*
documents, not the platform's: the notation, the sign conventions, the one
Hebrew term per concept, the house style. They live in the repo at
`courses/<course>/` and in the store at
`tenants/<t>/courses/<c>/guides/<name>.md`, and they are read over the API:

```
GET  /courses/{c}/guides            the ones that exist
GET  /courses/{c}/guides/{name}     markdown, with an ETag
PUT  /courses/{c}/guides/{name}     markdown, `If-Match` optional, ≤ 256 KB
```

`studio pull` writes them beside `syllabus.md` in the repo when they differ,
`studio push` sends back the ones that changed, and `studio import` pushes them
the first time. In the studio they are a read-only tab on the course page.

An agent should read them before writing physics for a course. They are the
difference between a lecture that fits the course and one that has to be
rewritten.
