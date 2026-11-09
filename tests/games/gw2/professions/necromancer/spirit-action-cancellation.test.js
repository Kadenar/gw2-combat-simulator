/** Exercise spirit ownership through native casts, including the transition from pending opening to independent field. */
import assert from 'node:assert/strict';
import test from 'node:test';

import { applySkillPatch } from '#gw2/integrations/patches/authoring/patches.js';
import { baseAttributeInputs } from '#gw2/platform/attributes/inputs.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { necromancerProfession } from '#gw2/professions/necromancer/profession.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
import { cast, wait } from '#tests/helpers/commands.js';
import { createProfessionSimulator } from '#tests/helpers/profession-simulation.js';

const run = createProfessionSimulator(necromancerProfession, () => ({
  specialization: 'Ritualist',
  initialResource: 100,
  attributeInputs: baseAttributeInputs({ power: 1000, precision: 1000, vitality: 1000 }),
  target: { armor: 2597, health: 0, conditions: {} }
}));
const opening = [cast(ID.RITUALISTS_SHROUD), { ...cast(ID.WANDERLUST), impactDelayMs: 3000 }];

// Identify the first opening independently of a replacement spirit's later field.
function firstField(result) {
  const summon = result.steps.find((step) => step.skillId === ID.WANDERLUST);
  return result.resolvedEvents.filter(
    (event) =>
      event.skillId === ID.WANDERLUST &&
      event.metadata?.spiritAttackType === 'initial' &&
      (event.activationId === summon.activationId || event.activationId === `${summon.activationId}:field`)
  );
}

// Delay separates field creation from its first impact, so survival cannot depend on damage already having landed.
for (const [name, replacement, config] of [
  ['despawn', ID.EXIT_RITUALISTS_SHROUD, {}],
  ['resummon', ID.WANDERLUST, { selectedTraitIds: [TRAIT.SOUL_TWISTING] }]
]) {
  test(`Wanderlust ${name} cancels a pending field but preserves a created field before its first impact`, () => {
    const before = run([...opening, cast(replacement), wait(12000)], config);
    const after = run([...opening, wait(2000), cast(replacement), wait(12000)], config);
    assert.deepEqual(before.warnings, []);
    assert.deepEqual(after.warnings, []);
    assert.deepEqual(firstField(before), []);
    const effects = firstField(after);
    assert.ok(effects.some((event) => event.type === 'damage'));
    assert.ok(effects.some((event) => event.type === 'condition'));
    const replacedAt = after.steps.findLast((step) => step.skillId === replacement).end / 1000;
    assert.ok(effects.every((event) => event.at > replacedAt));

    if (replacement === ID.EXIT_RITUALISTS_SHROUD)
      assert.deepEqual(after.planningState.profession[STATE.ACTIVE_SPIRITS], {});
  });
}

// An accepted command replaces the opening action while its already created field remains independent.
test('Summon Spirits preserves a created Wanderlust field before its first impact', () => {
  const result = run([...opening, wait(2000), cast(ID.SUMMON_SPIRITS), wait(12000)]);
  assert.deepEqual(result.warnings, []);
  const command = result.steps.find((step) => step.skillId === ID.SUMMON_SPIRITS);
  assert.ok(
    result.resolvedEvents.some((event) => event.type === 'damage' && event.activationId === command.activationId)
  );
  const field = firstField(result);
  assert.ok(field.some((event) => event.type === 'damage'));
  assert.ok(field.some((event) => event.type === 'condition'));
  assert.ok(field.every((event) => event.at > command.end / 1000));
});

// Align recovery with an existing auto opportunity to test creation priority, not native skill calibration.
test('Wanderlust field creation wins a simultaneous auto opportunity', () => {
  const initialized = run(opening);
  assert.deepEqual(initialized.warnings, []);
  const summon = initialized.steps.find((step) => step.skillId === ID.WANDERLUST);
  const entry = initialized.steps.find((step) => step.skillId === ID.RITUALISTS_SHROUD);
  const interval = necromancerProfession.catalog.balanceProfilesById.get(TRAIT.SPAWNING_POWER).pulseInterval;
  const opportunityMs = entry.end + interval * 1000;
  const skill = necromancerProfession.catalog.skillsById.get(ID.WANDERLUST);
  const recovery = necromancerProfession.catalog.skillsById.get(skill.summonAttackId).initialBusyMs;
  const delayMs = opportunityMs - summon.end - recovery;
  assert.ok(delayMs >= 0);
  const stopBeforeNextAutoMs = opportunityMs + interval * 1000 - 1;
  const result = run([opening[0], wait(delayMs), opening[1], wait(stopBeforeNextAutoMs - summon.end - delayMs)]);
  assert.deepEqual(result.warnings, []);
  const auto = result.resolvedEvents.find(
    (event) => event.type === 'damage' && event.metadata?.spiritAttackType === 'autoattack'
  );
  assert.ok(auto);
  const field = firstField(result);
  assert.ok(field.some((event) => event.type === 'damage'));
  assert.ok(field.some((event) => event.type === 'condition'));
  assert.ok(field.every((event) => event.at > opportunityMs / 1000));
  // Observe only the first opportunity so a later auto cannot disguise an incorrectly blocked one.
  assert.ok(result.planningState.atSeconds < entry.end / 1000 + interval * 2);
});

// Reset enables a second supported command before the first delayed action lands; both damage and control must retire.
test('a replacement spirit command cancels the prior command damage and control', () => {
  const prefix = [...opening, wait(2000), { ...cast(ID.SUMMON_SPIRITS), impactDelayMs: 3000 }];
  const baseline = run([...prefix, wait(6000)]);
  const replaced = run([...prefix, { type: 'cooldown-reset' }, wait(100), cast(ID.SUMMON_SPIRITS), wait(6000)]);
  assert.deepEqual(baseline.warnings, []);
  assert.deepEqual(replaced.warnings, []);
  const first = baseline.steps.find((step) => step.skillId === ID.SUMMON_SPIRITS);
  const commands = replaced.steps.filter((step) => step.skillId === ID.SUMMON_SPIRITS);
  for (const type of ['damage', 'control']) {
    const delivered = (result, activationId) =>
      result.events.some((event) => event.type === type && event.activationId === activationId);
    assert.equal(delivered(baseline, first.activationId), true);
    assert.equal(delivered(replaced, commands[0].activationId), false);
    assert.equal(delivered(replaced, commands[1].activationId), true);
  }
});

// Removing the field must not reclassify Wanderlust's independent player swing as a spirit opening.
test('removing the Wanderlust field preserves its player swing without creating spirit opening packets', () => {
  const result = run(
    [...opening, wait(12000)],
    {},
    {
      catalog: (catalog) =>
        applySkillPatch(catalog, {
          skills: {
            [ID.WANDERLUST]: {
              sideEffects: { opening: { removeEffects: [{ type: 'strike', name: 'Wanderlust Initial Field' }] } }
            }
          }
        })
    }
  );
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(firstField(result), []);
  assert.ok(result.planningState.profession[STATE.ACTIVE_SPIRITS].wanderlust);
  assert.ok(
    result.resolvedEvents.some(
      (event) => event.type === 'damage' && event.skillId === ID.WANDERLUST && event.source === 'necromancer'
    )
  );
});
