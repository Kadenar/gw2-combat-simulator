import assert from 'node:assert/strict';
import test from 'node:test';

import { baseAttributeInputs } from '#gw2/platform/attributes/inputs.js';
import { buildBoonGeneration } from '#gw2/platform/results/boon-generation.js';
import {
  ELEMENTALIST_SKILL_IDS as ID,
  ELEMENTALIST_TRAIT_IDS as TRAIT
} from '#gw2/professions/elementalist/data/ids.js';
import { elementalistCatalog } from '#gw2/professions/elementalist/profession.js';
import { runElementalist } from '#tests/helpers/elementalist-simulation.js';

// Minimal casts exercise authored audiences through real emission and reporting, including solo projections.
const cases = [
  { name: 'Healing Rain', skill: ID.HEALING_RAIN, boons: ['regeneration'], weapons: ['Staff'], element: 'Water' },
  { name: 'Windborne Speed', skill: ID.WINDBORNE_SPEED, boons: ['swiftness'], weapons: ['Staff'], element: 'Air' },
  {
    name: 'Aqua Siphon',
    skill: ID.AQUA_SIPHON,
    boons: ['regeneration'],
    weapons: ['Sword', 'Dagger'],
    element: 'Water'
  },
  {
    name: 'Transmute Frost',
    skill: ID.TRANSMUTE_FROST,
    setup: [ID.FROST_AURA],
    boons: ['regeneration'],
    weapons: ['Dagger', 'Dagger'],
    element: 'Water'
  },
  {
    name: 'Transmute Fire',
    skill: ID.TRANSMUTE_FIRE,
    setup: [ID.FIRE_SHIELD],
    boons: ['might'],
    weapons: ['Scepter', 'Focus']
  },
  { name: 'Cyclone', skill: ID.CYCLONE, boons: ['swiftness'], weapons: ['Scepter', 'Warhorn'], element: 'Air', cap: 3 },
  {
    name: 'Sand Squall',
    skill: ID.SAND_SQUALL,
    boons: ['protection'],
    weapons: ['Scepter', 'Warhorn'],
    element: 'Earth'
  },
  {
    name: 'Dust Storm',
    skill: ID.DUST_STORM,
    boons: ['resistance'],
    weapons: ['Scepter', 'Warhorn'],
    element: 'Earth'
  },
  { name: 'Aftershock', skill: ID.AFTERSHOCK, boons: ['protection', 'aegis'], config: { specialization: 'Tempest' } },
  {
    name: 'Splash',
    skill: ID.SPLASH,
    boons: ['regeneration'],
    config: { specialization: 'Evoker', evokerElement: 'Water', initialEvokerCharges: 6 }
  },
  {
    name: 'Toad resistance',
    skill: ID.TOADS_FORTITUDE,
    boons: ['resistance'],
    config: { specialization: 'Evoker', evokerElement: 'Earth' }
  },
  { name: 'Raging Storm', skill: ID.FLAMESTRIKE, trait: TRAIT.RAGING_STORM, boons: ['fury'] },
  { name: 'Rock Solid', skill: ID.EARTH_ATTUNEMENT, trait: TRAIT.ROCK_SOLID, boons: ['stability'] },
  ...[
    ['Fire', ID.FIRE_ATTUNEMENT, 'might'],
    ['Water', ID.WATER_ATTUNEMENT, 'regeneration'],
    ['Air', ID.AIR_ATTUNEMENT, 'swiftness'],
    ['Earth', ID.EARTH_ATTUNEMENT, 'protection']
  ].map(([element, skill, boon]) => ({
    name: `Elemental Attunement ${element}`,
    skill,
    trait: TRAIT.ELEMENTAL_ATTUNEMENT,
    boons: [boon],
    sourceName: 'Elemental Attunement',
    element: element === 'Fire' ? 'Water' : 'Fire'
  })),
  {
    name: 'Gale Song',
    skill: ID.GLYPH_OF_ELEMENTAL_HARMONY,
    trait: TRAIT.GALE_SONG,
    boons: ['protection'],
    config: { specialization: 'Tempest' }
  },
  {
    name: 'Latent Stamina',
    skill: ID.WATER_ATTUNEMENT,
    trait: TRAIT.LATENT_STAMINA,
    boons: ['vigor'],
    config: { specialization: 'Tempest' }
  },
  {
    name: 'Hardy Conduit',
    skill: ID.OVERLOAD_FIRE,
    trait: TRAIT.HARDY_CONDUIT,
    boons: ['protection'],
    wait: 6000,
    config: { specialization: 'Tempest' }
  },
  {
    name: 'Lucid Singularity',
    skill: ID.OVERLOAD_FIRE,
    trait: TRAIT.LUCID_SINGULARITY,
    boons: ['alacrity'],
    wait: 6000,
    config: { specialization: 'Tempest' }
  }
];

for (const scenario of cases) {
  test(`${scenario.name} preserves its capped allied boon audience in combat and reporting`, () => {
    const skill = elementalistCatalog.skillsById.get(scenario.skill);
    for (const count of [0, 4]) {
      const result = runElementalist(
        [
          { type: 'combat-start' },
          { type: 'wait', durationMs: scenario.wait ?? 0 },
          ...(scenario.setup ?? []).map((skillId) => ({ type: 'cast', skillId })),
          { type: 'cast', skillId: scenario.skill },
          { type: 'wait', durationMs: 6000 }
        ],
        {
          specialization: 'Core',
          startAttunement: scenario.element ?? 'Fire',
          primaryWeapon: scenario.weapons?.[0] ?? 'Scepter',
          secondaryWeapon: scenario.weapons ? scenario.weapons[1] : 'Focus',
          selectedTraitIds: scenario.trait ? [scenario.trait] : [],
          selectedSkillIds: ['Heal', 'Utility', 'Elite'].includes(skill.type) ? [scenario.skill] : [],
          attributeInputs: baseAttributeInputs({ precision: 4000 }),
          allies: { count },
          ...scenario.config
        }
      );
      assert.deepEqual(result.warnings, []);
      const cap = scenario.cap ?? 5;
      const grants = result.resolvedEvents.filter(
        (event) =>
          event.type === 'buff' &&
          (scenario.trait
            ? event.skillName === (scenario.sourceName ?? scenario.name)
            : event.sourceId === scenario.skill)
      );
      for (const kind of scenario.boons) {
        const boons = grants.filter((event) => event.kind === kind);
        assert.ok(boons.length > 0, `${scenario.name}: missing ${kind}`);
        for (const boon of boons) {
          assert.equal(boon.audience.recipients, 'party');
          assert.equal(boon.audience.maximumRecipients, cap);
          assert.equal(boon.resolvedAudience.includesSelf, true);
          assert.equal(boon.resolvedAudience.alliedPlayerCount, Math.min(count, cap - 1));
          assert.deepEqual(boon.resolvedAudience.companionIds, []);
          assert.equal(boon.resolvedAudience.recipientCount, 1 + Math.min(count, cap - 1));
        }

        const generated = buildBoonGeneration(boons, 0, result.rotationEndTime).boons.get(kind);
        assert.ok(generated.self.generatedStackSeconds > 0);
        assert.equal(generated.allies.generatedStackSeconds, generated.self.generatedStackSeconds * (cap - 1));
      }
    }
  });
}

// Nearby-ally fixes must not broaden personal skill boons or bypass the Earth-specialized meditation gate.
test('personal boons remain personal and Toad resistance still requires specialized Earth', () => {
  for (const [name, config, kind] of [
    ['Riptide', { primaryWeapon: 'Sword', secondaryWeapon: 'Dagger', startAttunement: 'Water' }, 'regeneration'],
    ['Glyph of Elemental Harmony', { specialization: 'Tempest', selectedTraitIds: [TRAIT.GALE_SONG] }, 'might'],
    ["Toad's Fortitude", { specialization: 'Evoker', evokerElement: 'Fire' }, 'resistance']
  ]) {
    const skill = elementalistCatalog.skills.find((candidate) => candidate.name === name);
    const result = runElementalist(
      [{ type: 'combat-start' }, { type: 'cast', skillId: skill.id }, { type: 'wait', durationMs: 6000 }],
      { selectedTraitIds: [], selectedSkillIds: [skill.id], startAttunement: 'Fire', allies: { count: 4 }, ...config }
    );
    assert.deepEqual(result.warnings, []);
    const grants = result.resolvedEvents.filter((event) => event.type === 'buff' && event.kind === kind);

    if (kind === 'resistance') {
      assert.deepEqual(grants, []);
      continue;
    }

    assert.ok(grants.length > 0);
    for (const grant of grants) {
      assert.equal(grant.resolvedAudience.includesSelf, true);
      assert.equal(grant.resolvedAudience.alliedPlayerCount, 0);
    }
  }
});
