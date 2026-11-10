// Trait-only Core replacements must retain weapon chains and preparation follow-up admission.
import assert from 'node:assert/strict';
import test from 'node:test';

import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import { thiefProfession } from '#gw2/professions/thief/profession.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';
import { testPatchPreview } from '#tests/helpers/patch-preview.js';
import { runThief } from '#tests/helpers/thief-simulation.js';

const profession = withPatchPreview(thiefProfession, testPatchPreview);

test('Thief Core preview preserves live chain and flip ownership', () => {
  const live = profession.runtimeFor({ specialization: 'Core', patchId: 'current' }).catalog;
  const preview = profession.runtimeFor({ specialization: 'Core', patchId: testPatchPreview.id }).catalog;
  assert.deepEqual(preview.autoattackChains, live.autoattackChains);
  assert.deepEqual(preview.skillFlips, live.skillFlips);
});

for (const [prepareId, triggerId] of [
  [ID.PREPARE_THOUSAND_NEEDLES, ID.THOUSAND_NEEDLES],
  [ID.PREPARE_PITFALL, ID.PITFALL]
]) {
  test(`Thief preview consumes preparation ${prepareId} and permits preparing it again`, () => {
    // Only the preparation is equipped; its armed follow-up must inherit the slot and consume its window.
    const result = runThief(
      [
        prepareId,
        { type: 'wait', durationMs: 3000 },
        triggerId,
        { type: 'wait', durationMs: 40000 },
        prepareId,
        { type: 'wait', durationMs: 3000 },
        triggerId
      ],
      { patchId: testPatchPreview.id, selectedSkillIds: [prepareId] },
      { profession }
    );
    assert.deepEqual(result.warnings, []);
    assert.equal(observedRuntime(result).flips[triggerId], undefined);
    assert.ok(result.events.some((event) => event.type === 'damage' && event.skillId === triggerId));
  });
}
