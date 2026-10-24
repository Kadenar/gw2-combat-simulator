import assert from 'node:assert/strict';
import test from 'node:test';
import { defineTestProfession } from '#tests/helpers/profession.js';
import { createCanonicalCatalog } from '#gw2/platform/skills/catalog.js';
import { createPeriodicTaskState, definePeriodicTask } from '#gw2/platform/simulation/periodic-task.js';
import { executeDamageOccurrence } from '#gw2/platform/skill-damage/run-occurrence.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { engineerProfession } from '#gw2/professions/engineer/profession.js';
import { ENGINEER_SKILL_IDS as SKILL, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';

const occurrence = (id) => ({
  id: String(id),
  name: 'Fixture',
  effect: { kind: 'skill', id },
  source: 'Skill',
  unit: 'activation',
  icon: ''
});

// The same skill-owned finite loop exercises real completion tracking under both preview policies.
function fixture(background) {
  const loop = definePeriodicTask({
    name: 'fixture.periodic-might',
    background,
    priority: 0,
    state: (runtime) => runtime.profession.periodic,
    nextAt: (runtime) => (runtime.time + 1 < runtime.profession.expiresAt ? runtime.time + 1 : Infinity),
    run(runtime) {
      runtime.effects.emit({
        kind: 'packet',
        event: {
          type: 'buff',
          at: runtime.time,
          source: 'Trait',
          sourceId: 991002,
          actorType: 'player',
          kind: 'might',
          stacks: 1,
          duration: 1
        }
      });
    }
  });
  return defineTestProfession({
    id: 'periodic-observation',
    name: 'Periodic observation',
    catalog: createCanonicalCatalog({
      generated: [
        {
          id: 991001,
          name: 'Fixture',
          castTimeMs: 0,
          effects: [{ type: 'strike', coefficient: 1, weaponStrength: 1000 }]
        }
      ]
    }),
    resources: { createState: () => ({ periodic: createPeriodicTaskState(), expiresAt: 0 }) },
    hooks: {
      ...loop.hooks,
      onCastCommit(runtime) {
        runtime.profession.expiresAt = runtime.time + 3;
        loop.restart(runtime, runtime.time + 1);
      }
    }
  });
}

test('skill-owned periodic work extends isolated previews only when it is not background', () => {
  const combatGrants = [];
  for (const background of [false, true]) {
    const profession = fixture(background);
    const preview = executeDamageOccurrence(profession, {}, occurrence(991001), { includeTraitProcs: true });
    const lastDamage = Math.max(...preview.events.filter((event) => event.type === 'damage').map((event) => event.at));
    const trailing = preview.events.filter((event) => event.kind === 'might' && event.at > lastDamage);
    assert.equal(trailing.length > 0, !background);

    const combat = simulateGw2({
      profession,
      config: {},
      rotation: [
        { type: 'cast', skillId: 991001 },
        { type: 'wait', durationMs: 3000 }
      ]
    });
    combatGrants.push(combat.resolvedEvents.filter((event) => event.kind === 'might'));
    assert.ok(combatGrants.at(-1).length > 0);
  }

  assert.deepEqual(
    combatGrants[0],
    combatGrants[1],
    'background classification changes preview completion, not combat delivery'
  );
});

test('Function Gyro retains Mass Momentum rewards after its last damage in an isolated preview', () => {
  const preview = executeDamageOccurrence(
    engineerProfession,
    {
      specialization: 'Scrapper',
      selectedTraitIds: [TRAIT.MASS_MOMENTUM],
      selectedSkillIds: [SKILL.FUNCTION_GYRO]
    },
    occurrence(SKILL.FUNCTION_GYRO),
    { includeTraitProcs: true }
  );
  const lastDamage = Math.max(...preview.events.filter((event) => event.type === 'damage').map((event) => event.at));
  assert.ok(Number.isFinite(lastDamage));
  assert.ok(
    preview.events.some(
      (event) => event.sourceId === TRAIT.MASS_MOMENTUM && event.kind === 'might' && event.at > lastDamage
    )
  );
});
