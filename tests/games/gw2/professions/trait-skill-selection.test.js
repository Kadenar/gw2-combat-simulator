import assert from 'node:assert/strict';
import test from 'node:test';
import { baseAttributeInputs } from '#gw2/platform/attributes/inputs.js';
import { runGw2Runtime } from '#gw2/platform/simulation/runtime.js';
import { engineerProfession } from '#gw2/professions/engineer/profession.js';
import { guardianProfession } from '#gw2/professions/guardian/profession.js';
import {
  GUARDIAN_SKILL_IDS as GUARDIAN,
  GUARDIAN_TRAIT_IDS as GUARDIAN_TRAIT
} from '#gw2/professions/guardian/data/ids.js';
import {
  ENGINEER_SKILL_IDS as ENGINEER,
  ENGINEER_TRAIT_IDS as ENGINEER_TRAIT
} from '#gw2/professions/engineer/data/ids.js';
import { necromancerProfession } from '#gw2/professions/necromancer/profession.js';
import {
  NECROMANCER_SKILL_IDS as NECROMANCER,
  NECROMANCER_TRAIT_IDS as NECROMANCER_TRAIT
} from '#gw2/professions/necromancer/data/ids.js';
import { rangerProfession } from '#gw2/professions/ranger/profession.js';
import { RANGER_SKILL_IDS as RANGER, RANGER_TRAIT_IDS as RANGER_TRAIT } from '#gw2/professions/ranger/data/ids.js';

const cases = [
  {
    name: 'Glacial Heart',
    profession: guardianProfession,
    specialization: 'Core',
    traitId: GUARDIAN_TRAIT.GLACIAL_HEART,
    base: GUARDIAN.MIGHTY_BLOW,
    variant: GUARDIAN.GLACIAL_BLOW,
    primaryWeapon: 'Hammer',
    preparation: []
  },
  {
    name: 'Lingering Curse',
    profession: necromancerProfession,
    specialization: 'Core',
    traitId: NECROMANCER_TRAIT.LINGERING_CURSE,
    base: NECROMANCER.FEAST_OF_CORRUPTION,
    variant: NECROMANCER.DEVOURING_DARKNESS,
    primaryWeapon: 'Scepter',
    preparation: []
  },
  {
    name: 'Herald of Sorrow',
    profession: necromancerProfession,
    specialization: 'Scourge',
    traitId: NECROMANCER_TRAIT.HERALD_OF_SORROW,
    base: NECROMANCER.DESERT_SHROUD,
    variant: NECROMANCER.SANDSTORM_SHROUD,
    primaryWeapon: 'Scepter',
    preparation: []
  },
  ...[
    [ENGINEER.LIGHT_STRIKE, ENGINEER.LIGHT_STRIKE_STORM, []],
    [ENGINEER.BRIGHT_SLASH, ENGINEER.BRIGHT_SLASH_STORM, [ENGINEER.LIGHT_STRIKE]],
    [ENGINEER.FLASH_CUTTER, ENGINEER.FLASH_CUTTER_STORM, [ENGINEER.LIGHT_STRIKE, ENGINEER.BRIGHT_SLASH]]
  ].map(([base, variant, chain]) => ({
    name: `Crystal Configuration: Storm / ${engineerProfession.catalog.skillsById.get(base).name}`,
    profession: engineerProfession,
    specialization: 'Holosmith',
    traitId: ENGINEER_TRAIT.CRYSTAL_CONFIGURATION_STORM,
    base,
    variant,
    primaryWeapon: 'Pistol',
    preparation: [ENGINEER.ENGAGE_PHOTON_FORGE, ...chain]
  })),
  {
    name: 'Perilous Skies',
    profession: rangerProfession,
    specialization: 'Galeshot',
    traitId: RANGER_TRAIT.PERILOUS_SKIES,
    base: RANGER.QUARRYS_PERIL,
    variant: RANGER.PELT,
    primaryWeapon: 'Longbow',
    preparation: [RANGER.SUMMON_CYCLONE_BOW]
  }
];

for (const entry of cases) {
  // Resolve either saved skill identity through the selected trait before execution, preserving authored commands.
  test(`${entry.name}: saved variants follow trait selection in execution`, () => {
    const commands = [entry.base, entry.variant].map((skillId) => ({ type: 'cast', skillId }));
    const original = structuredClone(commands);
    for (const selected of [false, true, false]) {
      const expected = selected ? entry.variant : entry.base;
      const config = {
        specialization: entry.specialization,
        primaryWeapon: entry.primaryWeapon,
        initialResource: 100,
        selectedTraitIds: selected ? [entry.traitId] : [],
        attributeInputs: baseAttributeInputs({ power: 1000, precision: 1000, vitality: 1000 }),
        target: { armor: 2597, health: 0, conditions: {} }
      };
      for (const command of commands) {
        const result = runGw2Runtime({
          profession: entry.profession.runtimeFor(config),
          config,
          rotation: [...entry.preparation.map((skillId) => ({ type: 'cast', skillId })), command]
        });
        assert.deepEqual(result.warnings, []);
        const step = result.steps.find((step) => step.ri === entry.preparation.length);
        assert.ok(step && !step.invalid);
        assert.equal(step.skillId, expected);
        assert.deepEqual(commands, original);
      }
    }
  });
}
