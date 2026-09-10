#!/usr/bin/env node
/**
 * `build-gallery` — writes `site/` from every `demos/examples/<slug>/demo.json`.
 *
 *   node tools/build-gallery.js            # → site/
 *   node tools/build-gallery.js --out dist
 *
 * One card per demo: the still, the title, the description, the author, and
 * three ways to have it — *open* (it runs, right there, in the same sandboxed
 * frame and under the same protocol a lecture page uses), *source* (the file on
 * GitHub) and *download* (the file itself, which is the whole demo).
 *
 * Everything is static. There is no framework and no build step beyond copying:
 * the page a reader gets is the page in `site/`, and the demos under
 * `site/demos/<slug>/` are byte-identical to the ones in `demos/examples/`.
 *
 * The card's `dir` comes from `demo.json`'s `lang` (default `he`, since the
 * studio's own courses are Hebrew). `lang` is the one field here the platform
 * does not define — a demo manifest may carry fields nobody defined and the
 * studio ignores them, so the gallery uses one and the format document says so.
 *
 * The `<iframe sandbox="allow-scripts">` is written **here**, into the built
 * HTML, rather than created by `host.js` at runtime. Two reasons: a reader with
 * no JavaScript still gets the still and the words, and the sandbox attribute is
 * in a file a grep can check — which is what `test/gallery.test.js` does.
 */
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync, existsSync, rmSync } from 'node:fs';
import { join, resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = 'https://github.com/fieldwork-group/course-studio-kit';

/** The one sandbox value, written in one place, as it is in the platform. */
const SANDBOX = 'allow-scripts';

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

export function demos(dir = join(ROOT, 'demos/examples')) {
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(join(dir, e.name, 'demo.json')))
    .map((e) => {
      const manifest = JSON.parse(readFileSync(join(dir, e.name, 'demo.json'), 'utf8'));
      return { ...manifest, slug: manifest.slug || e.name, dir: join(dir, e.name), folder: e.name };
    })
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

function card(demo) {
  const lang = demo.lang === 'en' ? 'en' : 'he';
  const dir = lang === 'he' ? 'rtl' : 'ltr';
  const aspect = Number(demo.aspect) > 0 ? Number(demo.aspect) : 0.5;
  const source = `${REPO}/blob/main/demos/examples/${demo.folder}/demo.html`;
  const file = `demos/${demo.slug}/demo.html`;
  return `      <article class="card" lang="${lang}" dir="${dir}">
        <div class="demo" data-aspect="${aspect}">
          <div class="demo-stage">
            <iframe sandbox="${SANDBOX}" title="${esc(demo.title)}" data-src="${esc(file)}"></iframe>
            <img class="still" src="demos/${esc(demo.slug)}/still.png" alt="${esc(demo.title)}">
          </div>
          <div class="demo-controls">
            <button type="button" class="demo-btn" data-act="open">▶ open</button>
            <button type="button" class="demo-btn" data-act="reset">↺ reset</button>
          </div>
        </div>
        <h2>${esc(demo.title)}</h2>
        <p class="desc">${esc(demo.description || '')}</p>
        <p class="meta"><span>${esc(demo.slug)}</span><span>${esc(demo.author || '—')}</span>
          <span>v${esc(demo.version || '1.0.0')}</span><span>aspect ${aspect}</span></p>
        <p class="links"><a href="${esc(source)}">source</a>
          <a href="${esc(file)}" download>download demo.html</a></p>
      </article>`;
}

export function page(list) {
  return `<!doctype html>
<html lang="en" dir="ltr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Course Studio · demo gallery</title>
<link rel="stylesheet" href="gallery.css">
</head>
<body>
<header class="page">
  <p class="eyebrow">Course Studio kit</p>
  <h1>Demo gallery</h1>
  <p>A <strong>user demo</strong> is one self-contained HTML file that runs inside a
     lecture page in a sandboxed frame with no network. Each card below runs its
     demo here the way a lecture runs it: the same
     <code>sandbox="allow-scripts"</code> frame, the same <code>postMessage</code>
     protocol, the same content policy, the same host code.</p>
  <p>The format is in <a href="${REPO}/blob/main/docs/demos/format.md">docs/demos/format.md</a>,
     how to build one in <a href="${REPO}/blob/main/docs/demos/authoring.md">authoring.md</a>,
     and a template that already works in
     <a href="${REPO}/tree/main/demos/template">demos/template</a>. Contributing a demo is a
     pull request adding a folder under <code>demos/examples/</code>.</p>
</header>
<main>
  <div class="grid">
${list.map(card).join('\n')}
  </div>
</main>
<footer class="page">
  <p>Demos and code MIT · documents CC BY 4.0 · built by <code>tools/build-gallery.js</code>.
     The physics of these three examples was checked by hand once; a contributed
     demo is checked for the format only, never for its physics.</p>
</footer>
<script src="host.js"></script>
</body>
</html>
`;
}

function build(out) {
  rmSync(out, { recursive: true, force: true });
  mkdirSync(join(out, 'demos'), { recursive: true });
  const list = demos();
  for (const demo of list) {
    const target = join(out, 'demos', demo.slug);
    mkdirSync(target, { recursive: true });
    for (const name of ['demo.html', 'still.png', 'demo.json']) {
      copyFileSync(join(demo.dir, name), join(target, name));
    }
  }
  copyFileSync(join(ROOT, 'tools/gallery/host.js'), join(out, 'host.js'));
  copyFileSync(join(ROOT, 'tools/gallery/gallery.css'), join(out, 'gallery.css'));
  writeFileSync(join(out, 'index.html'), page(list));
  // GitHub Pages runs Jekyll unless told not to, and Jekyll drops files whose
  // name starts with an underscore. Nothing here does today; the flag costs
  // nothing and removes a class of surprise.
  writeFileSync(join(out, '.nojekyll'), '');
  return list;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const at = process.argv.indexOf('--out');
  const out = at >= 0 ? resolve(process.argv[at + 1]) : join(ROOT, 'site');
  const list = build(out);
  console.log(`${basename(out)}/ — ${list.length} demo${list.length === 1 ? '' : 's'}: ${list.map((d) => d.slug).join(', ')}`);
}

export { build, SANDBOX };
