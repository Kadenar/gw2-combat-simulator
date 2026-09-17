import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { REFERENCE_REVISION, runCombatEngine } from '#gw2/platform/combat-engine/run.js';
import {
  loadReferenceEncounter,
  readReferenceResults
} from '../../fixtures/gw2combat-reference/reference-encounter.js';
import {
  EXAMPLE_FIXTURE_DIR,
  loadExampleEncounter,
  readExampleManifest,
  readExampleResults
} from '../../fixtures/gw2combat-reference/example-encounters.js';

// Preset regression policy: only total DPS against the recorded reference value, within 1%.
const MAXIMUM_RELATIVE_ERROR = 0.01;

function assertWithinReference(actual, expected, label) {
  const relative = Math.abs(actual - expected) / expected;
  assert.ok(relative <= MAXIMUM_RELATIVE_ERROR, `${label} DPS ${actual} differs from ${expected} by ${relative}`);
}

test('the frozen Willbender reference encounter simulates within 1% of the C++ reference mean', () => {
  const result = runCombatEngine({ encounter: loadReferenceEncounter(), output: 'score', seed: 1 });

  assert.equal(result.ok, true, result.message);
  assertWithinReference(result.dps, readReferenceResults().canonical.meanDps, 'canonical');
});

test('the deterministic reference variant simulates within 1% of the C++ reference', () => {
  const result = runCombatEngine({ encounter: loadReferenceEncounter({ deterministic: true }), output: 'score' });

  assert.equal(result.ok, true, result.message);
  assertWithinReference(result.dps, readReferenceResults().deterministic.dps, 'deterministic');
});

const examples = readExampleManifest();
const baselines = readExampleResults();

// Pin semantic JSON content while allowing required formatting and checkout line-ending normalization.
test('additional reference inputs match their pinned manifest and recorded example coverage', () => {
  assert.equal(examples.referenceRevision, REFERENCE_REVISION);
  assert.equal(baselines.referenceRevision, examples.referenceRevision);
  assert.deepEqual(Object.keys(baselines.examples).sort(), examples.examples.map((example) => example.id).sort());
  for (const [file, entry] of Object.entries(examples.files)) {
    const text = readFileSync(path.join(EXAMPLE_FIXTURE_DIR, file), 'utf8');
    const content = file.endsWith('.json') ? JSON.stringify(JSON.parse(text)) : text.replaceAll('\r\n', '\n');
    const checksum = createHash('sha256').update(content).digest('hex');
    assert.equal(checksum, entry.parsedSha256 ?? entry.normalizedSha256, file);
  }
});

for (const example of examples.examples) {
  test(`${example.id}: loads and simulates within 1% of the C++ DPS mean at 1 ms`, () => {
    const result = runCombatEngine({
      encounter: loadExampleEncounter(example.id),
      output: 'score',
      seed: baselines.seed
    });
    assert.equal(result.ok, true, result.message);
    assertWithinReference(result.dps, baselines.examples[example.id].reference.meanDps, example.id);
  });

  // This preserves current coarse-step behavior; it does not claim 40 ms matches C++ or the game's timing rules.
  test(`${example.id}: detailed output at 40 ms stays within 1% of its recorded TypeScript DPS`, () => {
    const result = runCombatEngine({
      encounter: loadExampleEncounter(example.id),
      output: 'detailed',
      seed: baselines.seed,
      stepMs: 40
    });
    assert.equal(result.ok, true, result.message);
    assertWithinReference(result.dps, baselines.examples[example.id].step40.dps, `${example.id} at 40 ms`);
  });
}
