import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveEntrySkill } from '#gw2/app/rotation/editing/actions.js';
import { baseAttributeInputs } from '#gw2/platform/attributes/inputs.js';
import { runGw2Runtime } from '#gw2/platform/simulation/runtime.js';
import {
  ENGINEER_SKILL_IDS as ENGINEER,
  ENGINEER_TRAIT_IDS as ENGINEER_TRAIT
} from '#gw2/professions/engineer/data/ids.js';
import { engineerProfession } from '#gw2/professions/engineer/profession.js';
import {
  GUARDIAN_SKILL_IDS as GUARDIAN,
  GUARDIAN_TRAIT_IDS as GUARDIAN_TRAIT
} from '#gw2/professions/guardian/data/ids.js';
import { guardianProfession } from '#gw2/professions/guardian/profession.js';
import {
  NECROMANCER_SKILL_IDS as NECROMANCER,
  NECROMANCER_TRAIT_IDS as NECROMANCER_TRAIT
} from '#gw2/professions/necromancer/data/ids.js';
import { necromancerProfession } from '#gw2/professions/necromancer/profession.js';
import { RANGER_SKILL_IDS as RANGER, RANGER_TRAIT_IDS as RANGER_TRAIT } from '#gw2/professions/ranger/data/ids.js';
import { rangerProfession } from '#gw2/professions/ranger/profession.js';
import { loadProfessionAppAdapter } from '#tests/helpers/profession-app-adapter.js';

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
  // A trait edit changes the displayed and executed identity while leaving the authored command intact.
  test(`${entry.name}: saved variants follow trait selection in display and execution`, async () => {
    const adapter = await loadProfessionAppAdapter(entry.profession.id);
    const patch = adapter.profession.resolvePatch();
    const line = patch.catalog.specializations.find((line) =>
      line.majorTraits.flat().some((trait) => trait.id === entry.traitId)
    );
    assert.ok(line);
    const unrelated = patch.catalog.skills.find((skill) => skill.type === 'Heal' && !skill.specialization);
    assert.ok(unrelated);
    const app = {
      adapter,
      profession: adapter.profession,
      patch,
      activeCatalog: patch.catalog,
      build: adapter.toApplicationBuild(adapter.profession.createBuildDefaults())
    };
    const commands = [entry.base, entry.variant].map((skillId) => ({ type: 'cast', skillId }));
    const original = structuredClone(commands);
    // Reuse the app and patch when toggling back off to exercise the display selector's trait cache.
    for (const selected of [false, true, false]) {
      app.build.specializations = [
        {
          name: line.name,
          traits: line.majorTraits
            .map((tier) => (selected ? tier.findIndex((trait) => trait.id === entry.traitId) + 1 : 0))
            .join('-')
        }
      ];
      const expected = selected ? entry.variant : entry.base;
      for (const command of commands) assert.equal(resolveEntrySkill(app, command)?.id, expected);
      assert.deepEqual(commands, original);
      assert.equal(resolveEntrySkill(app, { type: 'cast', skillId: unrelated.id })?.id, unrelated.id);

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
