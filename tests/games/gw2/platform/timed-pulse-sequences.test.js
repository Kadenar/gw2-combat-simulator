import assert from 'node:assert/strict';
import test from 'node:test';
import { runGuardian } from '#tests/helpers/guardian-simulation.js';
import { GUARDIAN_SKILL_IDS as G } from '#gw2/professions/guardian/data/ids.js';
import { runThief } from '#tests/helpers/thief-simulation.js';

test('Infiltrator signet rearm replaces the pending resource pulse and follows cooldown resets', () => {
  const observed = [];
  const observe = (runtime) =>
    observed.push([runtime.resourceController.value('initiative'), runtime.profession.core.infiltratorsSignetPulseAt]);
  const result = runThief(
    [
      "Infiltrator's Signet",
      { type: 'wait', durationMs: 1000 },
      { type: 'cooldown-reset' },
      { type: 'wait', durationMs: 10000 }
    ],
    { selectedSkillIds: [13064], initialInitiative: 0 },
    { probes: [0.5, 1.0005, 10, 11].map((at) => [at, observe]) }
  );
  assert.deepEqual(result.warnings, []);
  // Activation starts the sixteen-second recharge under Alacrity, so the next pulse waits ten seconds past it.
  assert.equal(observed[0][1], 26);
  // The reset rearms the pulse from the reset instant.
  assert.equal(observed[1][1], 11);
  assert.equal(observed[3][0] - observed[2][0], 2, 'one second of regeneration plus one discrete pulse');
  assert.equal(observed[3][1], 21);
});

test('Willbender fields overlap for the same virtue and cancel as a group when virtue changes', () => {
  const result = runGuardian(
    [
      G.FLOWING_RESOLVE,
      G.FLOWING_RESOLVE,
      { type: 'wait', durationMs: 1000 },
      G.CRASHING_COURAGE,
      { type: 'wait', durationMs: 6000 }
    ],
    { specialization: 'Willbender' }
  );
  assert.deepEqual(result.warnings, []);
  const resolve = result.events.filter((event) => event.type === 'damage' && event.skillId === G.WILLBENDER_FLAMES);
  assert.equal(new Set(resolve.map((event) => event.activationId)).size, 2);
  const courage = result.events.filter(
    (event) => event.type === 'damage' && event.skillId === G.WILLBENDER_FLAMES_COURAGE
  );
  assert.ok(courage.length > 0);
  const activation = result.events.find((event) => event.kind === 'willbender-courage').at;
  assert.ok(resolve.every((event) => event.at < activation));
  assert.ok(courage.every((event) => event.at >= activation));
});
