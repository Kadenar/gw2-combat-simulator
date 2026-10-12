import assert from 'node:assert/strict';
import test from 'node:test';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { mesmerProfession } from '#gw2/professions/mesmer/profession.js';
import { createDefaultConfig, runMesmer } from '#tests/helpers/mesmer-simulation.js';

// Summon handlers bypass direct completion grants, so their authored resources must belong to phantasm conversion.
test('every specialization routes summon declarations through phantasm resources', () => {
  for (const specialization of ['Core', 'Chronomancer', 'Mirage', 'Virtuoso', 'Troubadour']) {
    const summons = mesmerProfession
      .runtimeFor({ specialization })
      .catalog.skills.filter((skill) =>
        skill.sideEffects?.some((action) => action.do.type === 'mesmer.summon-phantasm')
      );
    assert.ok(summons.length > 0, specialization);
    for (const skill of summons) {
      assert.equal(skill.resource?.mode, 'phantasm', `${specialization}: ${skill.name}`);
    }
  }
});

// Alter the selected runtime catalog to test resource availability without calibrating individual attack packets.
function run(timing, specialization = 'Core', selectedTraitIds = []) {
  return runMesmer(
    [ID.PHANTASMAL_SWORDSMAN, { type: 'wait', durationMs: 10000 }],
    {
      ...createDefaultConfig(),
      specialization,
      selectedTraitIds,
      initialResource: 0,
      primaryWeapon: 'Sword',
      secondaryWeapon: 'Sword'
    },
    {
      catalog(catalog) {
        const original = catalog.skillsById.get(ID.PHANTASMAL_SWORDSMAN);
        const skill = {
          ...original,
          phantasmTiming: timing === null ? undefined : { ...original.phantasmTiming, ...timing }
        };
        return {
          ...catalog,
          skills: catalog.skills.map((entry) => (entry.id === skill.id ? skill : entry)),
          skillsById: new Map(catalog.skillsById).set(skill.id, skill),
          skillsByName: new Map(catalog.skillsByName).set(skill.name, skill)
        };
      }
    }
  );
}

test('phantasm conversion availability follows each selected runtime catalog without leaking between runs', () => {
  for (const spawnAtMs of [30000, 1000, 30000]) {
    const result = run({ spawnAtMs });
    assert.deepEqual(result.warnings, []);
    assert.equal(result.planningState.profession.resource, spawnAtMs === 1000 ? 1 : 0);
  }
});

test('Chronomancer conversion overrides retain precedence over the selected base timing', () => {
  const result = run({ repeatSpawnAtMs: 30000 }, 'Chronomancer', [TRAIT.CHRONOPHANTASMA]);
  assert.deepEqual(result.warnings, []);
  assert.equal(result.planningState.profession.resource, 1);
});

test('a phantasm without catalog timing fails explicitly during preparation', () => {
  assert.throws(() => run(null), /requires attack timing metadata/);
});
