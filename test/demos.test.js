/**
 * Every demo in the repository passes the lint — the template and the three
 * examples, the same command CI runs on a pull request.
 *
 * It is one test rather than one per demo because the lint launches a browser
 * and launching it once for four demos is the difference between a suite you run
 * and a suite you skip. When it fails, the output names the demo and the reason.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('check-demo passes on the template and every example', () => {
  const examples = readdirSync(join(ROOT, 'demos/examples'), { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => join('demos/examples', e.name));
  assert.ok(examples.length >= 3, 'the kit ships three examples');

  const run = spawnSync(process.execPath, ['tools/check-demo.js', 'demos/template', ...examples],
    { cwd: ROOT, encoding: 'utf8' });
  assert.equal(run.status, 0, `check-demo failed:\n${run.stdout}${run.stderr}`);
  for (const dir of ['demos/template', ...examples]) {
    assert.match(run.stdout, new RegExp(`^ok\\s+${dir}\\b`, 'm'), `${dir} was not checked`);
  }
});
