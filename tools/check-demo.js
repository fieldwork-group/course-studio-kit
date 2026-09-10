#!/usr/bin/env node
/**
 * `check-demo` — the lint a demo has to pass before it is worth uploading.
 *
 *   node tools/check-demo.js demos/template demos/examples/*
 *   node tools/check-demo.js my-demo --still        # write the screenshot as still.png
 *   node tools/check-demo.js my-demo --still --wait 3500   # … after 3.5 s of running
 *
 * There is deliberately **no check of the physics**: a user demo has no quality
 * gate, by decision, and the author who wrote it is the person who can see that
 * it is wrong. What this checks is the contract — the three files, the caps, the
 * names — and the one claim an author cannot verify by looking: that the file
 * makes **no request at all**.
 *
 * It does that twice, because the two halves catch different mistakes.
 *
 *   *Statically*, by regular expression, on the markup outside `<script>`: a
 *   `<script src>`, a `<link href>`, an `<img src>` or a CSS `url(…)` that is
 *   not a `data:` URI is the mistake almost everybody makes once, and naming the
 *   line is a better error message than "something failed to load".
 *
 *   *Dynamically*, in the browser: the file is mounted exactly the way the
 *   studio mounts it — `srcdoc` in an `<iframe sandbox="allow-scripts">` with
 *   the demo CSP as a `<meta http-equiv>` — and every request the page or the
 *   frame attempts is counted. This is the half that is actually authoritative:
 *   an inlined library carries URLs in its own strings (p5 mentions a CDN in an
 *   error message it never fetches), so no pattern over the bytes can decide the
 *   question, and a browser can.
 *
 * The same run waits five seconds for `ready` and screenshots the frame, which
 * is where `still.png` comes from with `--still`.
 *
 * Exit code 0 when every demo passes, 1 otherwise. That is what CI reads.
 */
import { readFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { basename, join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** The caps, from the format. Bytes, not characters. */
export const CAPS = { 'demo.html': 2 * 1024 * 1024, 'still.png': 1024 * 1024, 'demo.json': 4 * 1024 };
export const SLUG = /^[a-z0-9][a-z0-9-]{1,39}$/;
export const READY_MS = 5000;

/**
 * The policy the platform serves a demo under, character for character as
 * `demos/src/core/frame.js` has it. `frame-ancestors` is dropped on the way into
 * a meta tag: a browser ignores it there — who may frame a document is the
 * server's answer, not the document's — and logs an error for every demo on the
 * page if it is left in.
 */
export const DEMO_CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline' 'unsafe-eval'",
  "style-src 'unsafe-inline'",
  'img-src data: blob:',
  'font-src data:',
  'media-src data: blob:',
  'worker-src blob:',
  "frame-ancestors 'self'",
].join('; ');

export function withCspMeta(html, csp = DEMO_CSP) {
  const inMeta = csp.split(';').map((d) => d.trim())
    .filter((d) => d && !/^frame-ancestors\b/i.test(d)).join('; ');
  const meta = `<meta http-equiv="Content-Security-Policy" content="${inMeta.replace(/"/g, '&quot;')}">`;
  const head = /<head\b[^>]*>/i.exec(html);
  if (head) return html.slice(0, head.index + head[0].length) + meta + html.slice(head.index + head[0].length);
  return meta + html;
}

/** Script bodies and HTML comments blanked, line count kept, so a line number in
 *  an error still points at the right line. Comments go because a demo's own
 *  header comment routinely *talks* about `<script src>`, and script bodies go
 *  because an inlined library is full of strings no pattern can judge. */
function maskedMarkup(html) {
  const blank = (text) => text.replace(/[^\n]/g, ' ');
  return html
    .replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script>)/gi, (m, open, body, close) => open + blank(body) + close)
    .replace(/<!--[\s\S]*?-->/g, blank);
}

/** An attribute that loads something, or a CSS url(), pointing anywhere but
 *  `data:` / `blob:` / a fragment. */
function externalReferences(html) {
  const hits = [];
  const markup = maskedMarkup(html);
  const attr = /\b(src|href|srcset|poster|data|action|formaction|manifest|ping)\s*=\s*["']?([^"'>\s]+)/gi;
  const styles = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
  const at = (index) => markup.slice(0, index).split('\n').length;

  let m;
  while ((m = attr.exec(markup))) {
    const [name, value] = [m[1].toLowerCase(), m[2]];
    if (/^(data:|blob:|#|about:blank$)/i.test(value)) continue;
    if (name === 'href' && /^(mailto:|tel:)/i.test(value)) continue;
    hits.push({ line: at(m.index), what: `${name}="${value.slice(0, 60)}"` });
  }
  let s;
  while ((s = styles.exec(html))) {
    const css = s[1];
    const base = at(html.slice(0, s.index).length ? s.index : 0);
    const url = /url\(\s*["']?([^"')]+)/gi;
    let u;
    while ((u = url.exec(css))) {
      if (/^(data:|blob:|#)/i.test(u[1])) continue;
      hits.push({ line: base + css.slice(0, u.index).split('\n').length - 1, what: `url(${u[1].slice(0, 60)})` });
    }
    if (/@import/i.test(css)) hits.push({ line: base, what: '@import in a <style> block' });
  }
  return hits;
}

/** The SDK, if the demo says it inlined it, must be the SDK. */
function sdkDrift(html) {
  const start = html.indexOf('/* studio-demo.js');
  const end = html.indexOf('/* end studio-demo.js */');
  if (start < 0 || end < 0) return null;                     // not using the helper: fine
  const inlined = html.slice(html.indexOf('*/', start) + 2, end).trim();
  const sdk = readFileSync(join(ROOT, 'demos/sdk/studio-demo.js'), 'utf8');
  const code = sdk.slice(sdk.indexOf('*/\n') + 3).trim();
  return inlined === code ? null : 'the inlined studio-demo.js does not match demos/sdk/studio-demo.js';
}

/** Everything that can be decided without a browser. */
export function staticCheck(dir, { stillPending = false } = {}) {
  const errors = [];
  const note = (m) => errors.push(m);
  const slug = basename(resolve(dir));

  for (const name of ['demo.html', 'still.png', 'demo.json']) {
    const file = join(dir, name);
    if (!existsSync(file)) {
      // With `--still` the screenshot is what this run is about to write.
      if (!(stillPending && name === 'still.png')) note(`missing ${name}`);
      continue;
    }
    const size = statSync(file).size;
    if (size > CAPS[name]) note(`${name} is ${(size / 1024).toFixed(0)} KB, over the ${CAPS[name] / 1024} KB cap`);
    if (size === 0) note(`${name} is empty`);
  }
  if (errors.length) return { slug, errors, manifest: null };

  let manifest = null;
  try { manifest = JSON.parse(readFileSync(join(dir, 'demo.json'), 'utf8')); }
  catch (e) { note(`demo.json is not JSON: ${e.message}`); return { slug, errors, manifest: null }; }

  if (!manifest.slug) note('demo.json has no slug');
  else if (!SLUG.test(manifest.slug)) note(`slug "${manifest.slug}" does not match ${SLUG}`);
  else if (manifest.slug !== slug) note(`slug "${manifest.slug}" is not the folder name "${slug}"`);
  if (!manifest.title || typeof manifest.title !== 'string') note('demo.json has no title');
  if (manifest.aspect !== undefined && !(Number(manifest.aspect) > 0 && Number(manifest.aspect) <= 4)) {
    note(`aspect ${manifest.aspect} is not a ratio between 0 and 4 (height ÷ width)`);
  }

  if (existsSync(join(dir, 'still.png'))) {
    const png = readFileSync(join(dir, 'still.png')).subarray(0, 8);
    if (!png.equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) note('still.png is not a PNG');
  }

  const html = readFileSync(join(dir, 'demo.html'), 'utf8');
  if (!/<html[\s>]/i.test(html) || !/<\/html>/i.test(html)) note('demo.html is not a complete HTML document');
  for (const hit of externalReferences(html)) {
    note(`demo.html:${hit.line} loads something from outside the file — ${hit.what}`);
  }
  const drift = sdkDrift(html);
  if (drift) note(drift);
  return { slug, errors, manifest, html };
}

/**
 * The browser half: mount, count requests, wait for `ready`, screenshot.
 * The harness is the platform's mounting reduced to the two things that decide
 * the outcome — the sandbox attribute and the CSP meta tag.
 */
export async function runCheck(browser, dir, html, manifest, shotPath, waitMs = 800) {
  const aspect = Number(manifest?.aspect) > 0 ? Number(manifest.aspect) : 0.5;
  const width = 900;
  const height = Math.min(600, Math.round(width * aspect));
  const context = await browser.newContext({ viewport: { width: width + 40, height: height + 60 } });
  const page = await context.newPage();
  const requests = [];
  page.on('request', (r) => {
    if (/^(https?|ws|wss|file|ftp):/i.test(r.url())) requests.push(`${r.method()} ${r.url()}`);
  });

  await page.setContent(`<!doctype html><meta charset="utf-8">
    <style>html,body{margin:0;background:#fff}iframe{display:block;border:0;width:${width}px;height:${height}px}</style>
    <script>
      window.__seen = [];
      addEventListener('message', function (e) {
        var f = document.getElementById('f');
        if (!f || e.source !== f.contentWindow) return;      // the host's own source check
        var d = e.data;
        if (!d || d.studio !== 'demo' || d.v !== 1) return;
        window.__seen.push(d);
      });
    </script>
    <iframe id="f" sandbox="allow-scripts" title="demo"></iframe>`, { waitUntil: 'load' });

  await page.evaluate((srcdoc) => {
    document.getElementById('f').setAttribute('srcdoc', srcdoc);
  }, withCspMeta(html));

  const errors = [];
  try {
    await page.waitForFunction(() => window.__seen.some((m) => m.type === 'ready'), null, { timeout: READY_MS });
  } catch {
    errors.push(`no "ready" message within ${READY_MS / 1000} s — the still would stand for ever`);
  }

  // A late request is still a request: give the demo a moment past `ready`. The
  // same wait decides what the screenshot shows, which is why `--still` uses a
  // longer one — a still taken at t = 0.1 s does not look like the demo.
  await page.waitForTimeout(waitMs);
  for (const r of requests) errors.push(`made a request: ${r}`);

  mkdirSync(dirname(shotPath), { recursive: true });
  await page.locator('#f').screenshot({ path: shotPath });
  await context.close();
  return errors;
}

async function main(argv) {
  const still = argv.includes('--still');
  const waitAt = argv.indexOf('--wait');
  const waitMs = waitAt >= 0 ? Number(argv[waitAt + 1]) : (still ? 3000 : 800);
  const dirs = argv.filter((a, i) => !a.startsWith('--') && !(waitAt >= 0 && i === waitAt + 1));
  if (!dirs.length) {
    console.error('usage: node tools/check-demo.js <demo-dir>... [--still]');
    return 2;
  }
  const shotsDir = join(ROOT, '.check');
  const browser = await chromium.launch();
  let failed = 0;
  try {
    for (const dir of dirs) {
      const { slug, errors, manifest, html } = staticCheck(dir, { stillPending: still });
      if (!errors.length) {
        const shot = still ? join(dir, 'still.png') : join(shotsDir, `${slug}.png`);
        errors.push(...await runCheck(browser, dir, html, manifest, shot, waitMs));
        if (!errors.length) console.log(`ok    ${dir}  (${manifest.title}) → ${shot}`);
      }
      if (errors.length) {
        failed++;
        console.log(`FAIL  ${dir}`);
        for (const e of errors) console.log(`      ${e}`);
      }
    }
  } finally {
    await browser.close();
  }
  return failed ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  process.exit(await main(process.argv.slice(2)));
}
