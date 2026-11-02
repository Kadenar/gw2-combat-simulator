import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assembleNativeApplicationCatalog,
  createNativeModuleData
} from '#gw2/platform/profession-definition/assemble-module-catalog.js';
import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { composeSkillDefinitions, materializeSkillDefinitions } from '#gw2/platform/skills/compose-definitions.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import { elementalistCoreModule } from '#gw2/professions/elementalist/core/module.js';
import { ELEMENTALIST_CORE_SKILLS } from '#gw2/professions/elementalist/core/skills/index.js';
import { ELEMENTALIST_SKILL_IDS, ELEMENTALIST_TRAIT_IDS } from '#gw2/professions/elementalist/data/ids.js';
import { TRAIT_LINES } from '#gw2/professions/elementalist/data/trait-lines.js';
import { catalystModule } from '#gw2/professions/elementalist/specializations/catalyst/module.js';
import { CATALYST_SKILL_MECHANICS } from '#gw2/professions/elementalist/specializations/catalyst/skills/index.js';
import { evokerModule } from '#gw2/professions/elementalist/specializations/evoker/module.js';
import { EVOKER_FAMILIAR_SKILL_MECHANICS } from '#gw2/professions/elementalist/specializations/evoker/skills/familiar-skills.js';
import { EVOKER_MEDITATION_SKILL_MECHANICS } from '#gw2/professions/elementalist/specializations/evoker/skills/meditation-skills.js';
import { tempestModule } from '#gw2/professions/elementalist/specializations/tempest/module.js';
import { TEMPEST_SKILL_MECHANICS } from '#gw2/professions/elementalist/specializations/tempest/skills/index.js';
import { weaverModule } from '#gw2/professions/elementalist/specializations/weaver/module.js';
import { WEAVER_SKILL_MECHANICS } from '#gw2/professions/elementalist/specializations/weaver/skills/index.js';

const slices = [
  ['core', elementalistCoreModule, Object.fromEntries(ELEMENTALIST_CORE_SKILLS.map((skill) => [skill.id, skill]))],
  ['specializations/tempest', tempestModule, TEMPEST_SKILL_MECHANICS],
  ['specializations/weaver', weaverModule, WEAVER_SKILL_MECHANICS],
  ['specializations/catalyst', catalystModule, CATALYST_SKILL_MECHANICS],
  [
    'specializations/evoker',
    evokerModule,
    {
      ...EVOKER_FAMILIAR_SKILL_MECHANICS,
      ...EVOKER_MEDITATION_SKILL_MECHANICS
    }
  ]
];

const ELEMENTALIST_SKILL_MECHANICS = composeSkillDefinitions(...slices.map(([, , mechanics]) => mechanics));

// Missing or duplicate skills break composition; filenames and source spelling do not define this contract.
test('Elementalist skill mechanics have disjoint module ownership', () => {
  const owners = new Map();

  for (const [directory, module, mechanics] of slices) {
    assert.deepEqual(
      module.data.skills
        .map(({ id }) => String(id))
        .filter((id) => Object.hasOwn(mechanics, id))
        .sort(),
      Object.keys(mechanics).sort(),
      directory
    );
    for (const skillId of Object.keys(mechanics)) {
      assert.equal(owners.has(skillId), false, skillId);
      owners.set(skillId, module.id);
    }
  }

  assert.deepEqual(
    [...owners.keys()].sort((left, right) => Number(left) - Number(right)),
    Object.keys(ELEMENTALIST_SKILL_MECHANICS).sort((left, right) => Number(left) - Number(right))
  );
  const declaredIds = new Set([...Object.values(ELEMENTALIST_SKILL_IDS), ...Object.values(SHARED_SKILL_IDS)]);

  for (const skillId of owners.keys()) {
    assert.equal(declaredIds.has(Number(skillId)), true, skillId);
  }
});

// Minimal module contributions isolate ordering and validation from the full combat catalog.
function catalogModule(id, data = {}) {
  return defineNativeModule({ id, data, state: { create: () => ({}) } });
}

test('Elementalist declaration order follows its module contributions', () => {
  const declaration = {
    name: 'Shared fixture',
    icon: 'fixture.png',
    type: 'Utility',
    effects: []
  };
  const firstId = ELEMENTALIST_SKILL_IDS.FIRE_ATTUNEMENT;
  const secondId = ELEMENTALIST_SKILL_IDS.FIREBALL;
  const tempest = catalogModule(
    'Tempest',
    createNativeModuleData({
      id: 'Tempest',
      traitLines: TRAIT_LINES,
      skills: materializeSkillDefinitions({ [firstId]: declaration })
    })
  );
  const weaver = catalogModule(
    'Weaver',
    createNativeModuleData({
      id: 'Weaver',
      traitLines: TRAIT_LINES,
      skills: materializeSkillDefinitions({ [secondId]: declaration })
    })
  );
  const core = catalogModule('Core');
  for (const modules of [
    [core, tempest, weaver],
    [core, weaver, tempest]
  ]) {
    const catalog = assembleNativeApplicationCatalog(modules);
    assert.deepEqual(
      catalog.skills.map((skill) => skill.id),
      modules.flatMap((module) => (module.data.skills ?? []).map((skill) => skill.id))
    );
    assert.equal(
      catalog.skills.find((candidate) => candidate.name === 'Shared fixture').id,
      modules[1].data.skills[0].id
    );
  }
});

test('Elementalist accepts complete declarations and shared assembly rejects duplicate owners', () => {
  const declared = { name: 'Fixture', icon: 'fixture.png', effects: [] };
  assert.equal(
    createNativeModuleData({
      id: 'Tempest',
      traitLines: TRAIT_LINES,
      skills: materializeSkillDefinitions({ 999999: declared })
    }).skills[0].id,
    999999
  );
  const skillMechanics = { [ELEMENTALIST_SKILL_IDS.FIREBALL]: { ...declared, name: 'Duplicate fixture' } };
  assert.throws(
    () =>
      assembleNativeApplicationCatalog([
        catalogModule('Core'),
        ...['Tempest', 'Weaver'].map((id) =>
          catalogModule(
            id,
            createNativeModuleData({
              id: id,
              traitLines: TRAIT_LINES,
              skills: materializeSkillDefinitions(skillMechanics)
            })
          )
        )
      ]),
    /Duplicate skill id 5491 in Tempest and Weaver/
  );
});

test('Specialized Elements models percentage recharge changes as multipliers', () => {
  const catalog = assembleNativeApplicationCatalog([elementalistCoreModule, evokerModule]);
  const trait = catalog.balanceProfilesById.get(ELEMENTALIST_TRAIT_IDS.SPECIALIZED_ELEMENTS);

  assert.equal(Object.hasOwn(trait, 'rechargeReduction'), false);
  assert.equal(trait.rechargeMultiplier, 0.9);
  assert.equal(trait.empoweredRechargeMultiplier, 0.67);
});
