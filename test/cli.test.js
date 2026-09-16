/**
 * The bundled `studio` command starts, and points at this repository.
 *
 * `cli/studio.mjs` is not written here — it is one file built in the studio and
 * copied in by the publisher's sync, which is exactly why it is worth a test on
 * this side: a truncated copy, a lost executable bit or a bundle that needs
 * something from `node_modules` would all look fine in a diff and fail on the
 * first machine that ran the four steps in the README.
 *
 * Deliberately not tested here: anything that talks to the studio. That needs
 * an account and a token, it is covered where the command is built, and a test
 * in a public repository must not want a credential.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CLI = resolve(ROOT, 'cli', 'studio.mjs');

test('the bundled command runs under node and names its commands', () => {
  const out = execFileSync(process.execPath, [CLI, '--help'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  for (const command of ['studio init', 'studio pull', 'studio push', 'studio kit-path']) {
    assert.match(out, new RegExp(command));
  }
});

test('kit-path prints this repository, so an agent can find AGENTS.md', () => {
  const out = execFileSync(process.execPath, [CLI, 'kit-path'], { encoding: 'utf8' });
  assert.equal(out.trim(), ROOT);
});

test('it is executable, because package.json names it as a bin', () => {
  assert.ok(statSync(CLI).mode & 0o111, 'cli/studio.mjs has its executable bit');
});
