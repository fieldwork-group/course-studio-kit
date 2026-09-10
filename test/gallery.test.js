/**
 * The gallery builds, and every frame in it is sandboxed the one legal way.
 *
 * The sandbox assertion is a grep on purpose. `sandbox="allow-scripts"` is the
 * whole security model of a user demo, and the failure mode is somebody adding a
 * second flag to make something work — `allow-same-origin` "just for the
 * preview", `allow-popups` for a link. A test that reads the built bytes and
 * refuses anything but the exact attribute is the cheapest guard there is, and it
 * fails on the diff that introduces the flag rather than on the incident.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, demos } from '../tools/build-gallery.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = join(ROOT, 'site');

/** Every `.html` under a directory, recursively. */
function htmlFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...htmlFiles(path));
    else if (entry.name.endsWith('.html')) out.push(path);
  }
  return out;
}

test('the gallery builds one card per example', () => {
  const list = build(SITE);
  assert.equal(list.length, demos().length);
  assert.ok(list.length >= 3);

  const index = readFileSync(join(SITE, 'index.html'), 'utf8');
  for (const demo of list) {
    assert.ok(index.includes(demo.title), `${demo.slug}'s title is on the page`);
    assert.ok(index.includes(`demos/${demo.slug}/still.png`), `${demo.slug}'s still is on the page`);
    for (const name of ['demo.html', 'still.png', 'demo.json']) {
      assert.ok(existsSync(join(SITE, 'demos', demo.slug, name)), `site/demos/${demo.slug}/${name} exists`);
    }
    // The copies are the demo, byte for byte — the gallery is not a rewrite.
    assert.deepEqual(
      readFileSync(join(SITE, 'demos', demo.slug, 'demo.html')),
      readFileSync(join(demo.dir, 'demo.html')),
    );
  }
  assert.ok(existsSync(join(SITE, 'host.js')) && existsSync(join(SITE, 'gallery.css')));
  assert.ok(statSync(join(SITE, '.nojekyll')).isFile(), 'Pages is told not to run Jekyll');
});

test('every frame in site/ is exactly sandbox="allow-scripts"', () => {
  build(SITE);
  let frames = 0;
  for (const file of htmlFiles(SITE)) {
    const html = readFileSync(file, 'utf8');
    for (const tag of html.match(/<iframe\b[^>]*>/gi) || []) {
      frames++;
      const sandbox = /\bsandbox\s*=\s*"([^"]*)"/i.exec(tag);
      assert.ok(sandbox, `an iframe in ${file} has no sandbox attribute: ${tag}`);
      assert.equal(sandbox[1], 'allow-scripts', `wrong sandbox in ${file}: ${tag}`);
    }
  }
  assert.ok(frames >= 3, `expected a frame per demo, found ${frames}`);

  // …and the host that creates the rest of the chrome writes the same value, once.
  const host = readFileSync(join(SITE, 'host.js'), 'utf8');
  const values = [...host.matchAll(/sandbox\w*\s*=\s*'([^']*)'/gi)].map((m) => m[1]);
  assert.deepEqual(values, ['allow-scripts'], 'host.js names one sandbox value');
  assert.ok(!/allow-same-origin|allow-forms|allow-popups|allow-top-navigation|allow-modals/i.test(host),
    'host.js mentions no second sandbox flag');
});
