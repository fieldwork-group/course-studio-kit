/**
 * Every relative link in the repository's Markdown resolves — the file exists,
 * and when the link carries a `#fragment`, the heading it names exists too.
 *
 * The kit is read far more often than it is run: a reader who follows a dead link
 * in `authoring.md` has no way to tell whether the document is wrong or the thing
 * it points at was renamed. Absolute links are left alone; nothing here should
 * take responsibility for the rest of the internet being up.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function markdown(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'site') continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) markdown(path, out);
    else if (entry.name.endsWith('.md')) out.push(path);
  }
  return out;
}

/** GitHub's heading anchors, near enough: lowercase, punctuation dropped,
 *  spaces to hyphens. Enough to catch a renamed heading. */
function anchors(text) {
  const found = new Set();
  for (const line of text.split('\n')) {
    const heading = /^#{1,6}\s+(.*)$/.exec(line);
    if (!heading) continue;
    const slug = heading[1]
      .replace(/`/g, '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s-]/gu, '')
      .trim()
      .replace(/\s+/g, '-');
    found.add(slug);
  }
  return found;
}

test('relative links in the documents resolve', () => {
  const files = markdown(ROOT);
  assert.ok(files.length >= 6, `expected the kit's documents, found ${files.length}`);
  const problems = [];

  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    for (const m of text.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
      const target = m[1];
      if (/^(https?:|mailto:|tel:)/i.test(target)) continue;
      const [path, fragment] = target.split('#');
      const here = relative(ROOT, file);
      if (path) {
        const full = resolve(dirname(file), path);
        if (!existsSync(full)) { problems.push(`${here} → ${target} (no such file)`); continue; }
        if (fragment && path.endsWith('.md')) {
          if (!anchors(readFileSync(full, 'utf8')).has(fragment)) {
            problems.push(`${here} → ${target} (no such heading)`);
          }
        }
      } else if (fragment && !anchors(text).has(fragment)) {
        problems.push(`${here} → #${fragment} (no such heading here)`);
      }
    }
  }
  assert.deepEqual(problems, [], `dead links:\n  ${problems.join('\n  ')}`);
});
