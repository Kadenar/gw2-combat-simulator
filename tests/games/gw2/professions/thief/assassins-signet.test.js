import assert from 'node:assert/strict';
import test from 'node:test';

import { applySkillPatch } from '#gw2/integrations/patches/authoring/patches.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';
import { runThief } from '#tests/helpers/thief-simulation.js';

const config = { selectedSkillIds: [ID.ASSASSINS_SIGNET] };
const wait = (seconds) => ({ type: 'wait', durationMs: seconds * 1000 });

// Read live attributes from the cooldown owner; replaying past queries after a reset cannot reconstruct readiness.
function power(result) {
  assert.deepEqual(result.warnings, []);
  const runtime = observedRuntime(result);
  return runtime.query.statsAt(runtime.time, null, runtime).power;
}

test("Assassin's Signet separates its active buff from passive eligibility during recharge", () => {
  assert.equal(power(runThief([], config)), 1180);
  assert.equal(power(runThief([ID.ASSASSINS_SIGNET, wait(1)], config)), 1540);
  assert.equal(power(runThief([ID.ASSASSINS_SIGNET, wait(7)], config)), 1000);
});

// Shared attribute leaves remain independently patchable and every active grant follows the signet's buff window.
test("Assassin's Signet applies patched active attribute maps independently of its passive", () => {
  const options = {
    catalog: (catalog) =>
      applySkillPatch(catalog, {
        skills: {
          [ID.ASSASSINS_SIGNET]: {
            fields: {
              'attributeBonuses.power': 250,
              'activeAttributeBonuses.power': 600
            }
          }
        }
      })
  };
  for (const [rotation, expectedPower] of [
    [[], 1250],
    [[ID.ASSASSINS_SIGNET, wait(1)], 1600],
    [[ID.ASSASSINS_SIGNET, wait(7)], 1000]
  ]) {
    const result = runThief(rotation, config, options);
    assert.equal(power(result), expectedPower);
  }
});

test("Assassin's Signet's passive returns at natural cooldown expiry", () => {
  const baseline = runThief([ID.ASSASSINS_SIGNET], config);
  const readyAt = observedRuntime(baseline).cooldownController.readyAt(ID.ASSASSINS_SIGNET);
  const samples = [];
  const result = runThief([ID.ASSASSINS_SIGNET, wait(readyAt)], config, {
    probes: [readyAt - 1, readyAt].map((at) => [
      at,
      (runtime) => {
        samples.push(runtime.query.statsAt(runtime.time, null, runtime).power);
      }
    ])
  });
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(samples, [1000, 1180]);
});

// A reset restores readiness immediately, including while the separately owned active buff still exists.
test("Assassin's Signet follows cooldown reset both during and after its active buff", () => {
  for (const [elapsed, expected] of [
    [1, 1720],
    [7, 1180]
  ]) {
    const result = runThief([ID.ASSASSINS_SIGNET, { type: 'cooldown-reset' }, wait(elapsed)], config);
    assert.equal(observedRuntime(result).cooldownController.isOnCooldown(ID.ASSASSINS_SIGNET), false);
    assert.equal(power(result), expected);
  }
});

// Reducing this one skill's recharge must restore eligibility without relying on the global reset command.
test("Assassin's Signet follows a cooldown reduction at the live query boundary", () => {
  const result = runThief([ID.ASSASSINS_SIGNET, wait(7)], config, {
    probes: [
      [
        7,
        (runtime) => {
          const skill = runtime.helpers.skillsById.get(ID.ASSASSINS_SIGNET);
          assert.equal(runtime.query.statsAt(runtime.time, null, runtime).power, 1000);
          runtime.cooldownController.reduceSkillRecharge(skill, 100, runtime.time);
          assert.equal(runtime.cooldownController.isOnCooldown(skill.id), false);
          assert.equal(runtime.query.statsAt(runtime.time, null, runtime).power, 1180);
        }
      ]
    ]
  });
  assert.deepEqual(result.warnings, []);
});
