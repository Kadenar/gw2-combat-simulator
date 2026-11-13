// Healing-triggered storms retain poison ownership and enable combos only while their field is active.
import assert from 'node:assert/strict';
import test from 'node:test';

import { applySkillPatch } from '#gw2/integrations/patches/authoring/patches.js';
import { AURA } from '#gw2/platform/constants.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { defaultSimulationConfig } from '#tests/helpers/fixture-harness-core.js';
import { runMesmer } from '#tests/helpers/mesmer-simulation.js';

function stormScenario({ poisonRoll = true, waitMs = 0, cancelled = false, cooldown = false, patch } = {}) {
  const rolls = [];
  const result = runMesmer(
    [
      { name: 'Ether Feast', ...(cancelled ? { interruptAfterMs: 1 } : {}) },
      { type: 'wait', durationMs: waitMs },
      'Phase Retreat',
      { type: 'wait', durationMs: 6000 }
    ],
    defaultSimulationConfig({
      specialization: 'Core',
      primaryWeapon: 'Staff',
      secondaryWeapon: '',
      initialResource: 0,
      selectedTraitIds: [TRAIT.METHOD_OF_MADNESS, TRAIT.ILLUSIONARY_MEMBRANE]
    }),
    {
      ...(patch
        ? { catalog: (catalog) => applySkillPatch(catalog, { skills: { [ID.LESSER_CHAOS_STORM]: patch } }) }
        : {}),
      initialize(runtime) {
        if (cooldown) runtime.cooldownController.setReadyAt(ID.LESSER_CHAOS_STORM, 100);

        const random = runtime.random;
        runtime.random = {
          ...random,
          roll(chance, stream) {
            if (stream !== 'mesmer.lesser-chaos-storm.poison') return random.roll(chance, stream);

            rolls.push(chance);
            return poisonRoll;
          }
        };
      }
    }
  );
  assert.deepEqual(result.warnings, []);
  return { ...result, rolls };
}

const poison = (result) =>
  result.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.skillId === ID.LESSER_CHAOS_STORM && event.condition === 'Poisoned'
  );

test('Lesser Chaos Storm rolls poison with its own skill and trait attribution', () => {
  const accepted = stormScenario();
  assert.ok(accepted.rolls.length > 0);
  assert.ok(accepted.rolls.every((chance) => chance === 1 / 3));
  assert.ok(poison(accepted).length > 0);
  assert.ok(
    poison(accepted).every(
      (event) =>
        event.duration === 2 &&
        event.stacks === 1 &&
        event.sourceId === ID.LESSER_CHAOS_STORM &&
        event.traitId === TRAIT.METHOD_OF_MADNESS &&
        event.actorType === 'player' &&
        event.parentSkillName === 'Ether Feast'
    )
  );
  assert.deepEqual(poison(stormScenario({ poisonRoll: false })), []);
});

test('Lesser Chaos Storm enables Chaos Aura combos until its field expires', () => {
  for (const waitMs of [0, 5100]) {
    const result = stormScenario({ waitMs });
    const fields = result.events.filter(
      (event) => event.type === 'combo_field' && event.skillId === ID.LESSER_CHAOS_STORM
    );
    assert.equal(fields.length, 1);
    assert.equal(fields[0].fieldType, 'Ethereal');
    assert.equal(fields[0].expiresAt - fields[0].at, 5);
    assert.equal(
      result.resolvedEvents.some((event) => event.type === 'aura' && event.aura === AURA.CHAOS),
      waitMs === 0
    );
    assert.equal(
      result.events.some((event) => event.type === 'buff' && event.kind === 'illusionary-membrane'),
      waitMs === 0
    );
  }
});

test('Cancelled heals and storm cooldowns prevent poison rolls and fields', () => {
  for (const options of [{ cancelled: true }, { cooldown: true }]) {
    const result = stormScenario(options);
    assert.deepEqual(result.rolls, []);
    assert.deepEqual(poison(result), []);
    assert.equal(
      result.events.some((event) => event.type === 'combo_field'),
      false
    );
  }
});

test('Lesser Chaos Storm honors poison edits and removal without losing its field', () => {
  const edited = stormScenario({
    patch: { effects: [{ type: 'condition', name: 'Poison', tickIndex: 'all', duration: { from: 2, to: 7 } }] }
  });
  assert.ok(poison(edited).length > 0);
  assert.ok(poison(edited).every((event) => event.duration === 7));
  const removed = stormScenario({ patch: { removeEffects: [{ type: 'condition', name: 'Poison' }] } });
  assert.deepEqual(poison(removed), []);
  assert.deepEqual(removed.rolls, []);
  assert.ok(removed.resolvedEvents.some((event) => event.type === 'aura' && event.aura === AURA.CHAOS));
});
