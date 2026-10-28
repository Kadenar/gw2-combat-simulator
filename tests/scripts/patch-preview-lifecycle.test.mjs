import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  assertPromotionReady,
  reworkChecklist,
  reworkExtensionPoints
} from '../../scripts/patch-preview/rework-lifecycle.mjs';

// Promotion checks use synthetic declarations so they remain valid after the current preview ships.
test('lifecycle report identifies replacement modules, tooltip maps and unresolved controls', () => {
  const profession = { id: 'fixture', nativeDefinition: { moduleVariants: { replacement: { id: 'Elite' } } } };
  const tooltips = { reworks: { replacement: { traits: { 1: () => ({}) } } } };
  assert.match(
    reworkChecklist(profession, tooltips, { reworks: ['replacement'] })[0],
    /replacement.*Elite.*tooltip.*1 traits/
  );
  assert.throws(() => reworkChecklist(profession, {}, { reworks: ['replacement'] }), /Missing rework/);
  assert.throws(
    () => assertPromotionReady({ professions: { fixture: { provisional: [{ id: 'pending' }] } } }),
    /fixture.pending/
  );
  assert.doesNotThrow(() => assertPromotionReady({ professions: { fixture: { provisional: [] } } }));
});

test('extension-point inventory reports tagged source locations', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'rework-report-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'owner'));
  await writeFile(
    path.join(root, 'owner', 'module.ts'),
    '// Ordinary comment\n// Rework extension point (replacement): temporary grant\n'
  );
  assert.deepEqual(await reworkExtensionPoints(root), [{ variant: 'replacement', file: 'owner/module.ts', line: 2 }]);
});
