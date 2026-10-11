import { baseAttributeInputs } from '#gw2/platform/builds/attribute-inputs.js';
import assert from 'node:assert/strict';
import test from 'node:test';

import { runElementalist } from '#tests/helpers/elementalist-simulation.js';
import { elementalistAppAdapter } from '#gw2/professions/elementalist/app/app-definition.js';
import { elementalistCatalog, elementalistProfession } from '#gw2/professions/elementalist/profession.js';
import { ELEMENTALIST_TRAIT_IDS as TRAIT } from '#gw2/professions/elementalist/data/ids.js';

function canonicalRotation(rotation) {
  return rotation.map((entry) =>
    typeof entry === 'number'
      ? { type: 'wait', durationMs: entry }
      : { type: 'cast', skillId: elementalistCatalog.skillsByName.get(entry).id }
  );
}

// Run the smallest Core rotation that reaches a migrated trait through the public dispatcher.
function simulate(
  rotation,
  { traits, startAttunement = 'Fire', selectedSkillIds = {}, stats, initialize, ...buildOptions }
) {
  // Trait reachability scenarios begin in combat so entry-only effects are eligible.
  const commands = [{ type: 'combat-start' }, ...canonicalRotation(rotation)];
  const defaults = elementalistProfession.createBuildDefaults();
  const build = elementalistAppAdapter.toApplicationBuild({
    ...defaults,
    ...buildOptions,
    startAttunement,
    selectedSkillIds: { ...defaults.selectedSkillIds, ...selectedSkillIds },
    specializations: [
      { name: 'Fire', traits: '1-1-1' },
      { name: 'Air', traits: '1-1-1' },
      { name: 'Arcane', traits: '1-1-1' }
    ],
    rotation: commands
  });
  const app = {
    build,
    adapter: elementalistAppAdapter,
    profession: elementalistProfession,
    skillByName: elementalistCatalog.skillsByName,
    skillById: elementalistCatalog.skillsById,
    attributeWeaponSet: 1
  };
  elementalistAppAdapter.recalculate(app);
  const config = elementalistAppAdapter.simulationConfig(app);

  return runElementalist(
    commands,
    {
      ...config,
      selectedTraitIds: traits,
      attributeInputs: baseAttributeInputs({ ...config.attributeInputs?.weaponSets[0].commonTotals, ...stats })
    },
    { profession: elementalistProfession, initialize }
  );
}

const allEvents = (result) => [...result.events, ...result.resolvedEvents];
const hasEvent = (result, predicate) => allEvents(result).some(predicate);
const criticalRotation = ['Updraft', 'Charged Strike', 'Polaric Slash', 'Call Lightning'];
const criticalStats = { precision: 10_000 };

const traitCases = [
  {
    name: 'Electric Discharge',
    traits: [TRAIT.ELECTRIC_DISCHARGE],
    rotation: ['Air Attunement'],
    startAttunement: 'Fire',
    verify: (result) =>
      assert.ok(hasEvent(result, (event) => event.type === 'damage' && event.source === 'Electric Discharge'))
  },
  {
    name: 'One with Air',
    traits: [TRAIT.ONE_WITH_AIR],
    rotation: ['Air Attunement'],
    startAttunement: 'Fire',
    verify: (result) => assert.ok(hasEvent(result, (event) => event.type === 'buff' && event.kind === 'superspeed'))
  },
  {
    name: 'Inscription',
    traits: [TRAIT.INSCRIPTION],
    rotation: ['Air Attunement', 'Glyph of Elemental Harmony'],
    startAttunement: 'Fire',
    verify: (result) => {
      assert.ok(hasEvent(result, (event) => event.type === 'buff' && event.kind === 'resistance'));
      assert.ok(
        hasEvent(
          result,
          (event) => event.type === 'buff' && event.sourceId === TRAIT.INSCRIPTION && event.kind === 'swiftness'
        )
      );
    }
  },
  {
    name: 'Fresh Air',
    traits: [TRAIT.FRESH_AIR],
    rotation: ['Fire Attunement', 'Flame Uprising', 'Ring of Fire'],
    startAttunement: 'Air',
    attributeInputs: baseAttributeInputs(criticalStats),
    verify: (result) => assert.ok(result.events.some((event) => event.type === 'elementalist.fresh-air'))
  },
  {
    name: 'Lightning Rod',
    traits: [TRAIT.LIGHTNING_ROD],
    rotation: ['Updraft'],
    startAttunement: 'Air',
    verify: (result) =>
      assert.ok(hasEvent(result, (event) => event.type === 'damage' && event.source === 'Lightning Rod'))
  },
  {
    name: 'Raging Storm',
    traits: [TRAIT.RAGING_STORM],
    rotation: criticalRotation,
    startAttunement: 'Air',
    attributeInputs: baseAttributeInputs(criticalStats),
    verify: (result) =>
      assert.ok(hasEvent(result, (event) => event.type === 'buff' && event.sourceId === TRAIT.RAGING_STORM))
  },
  {
    name: "Zephyr's Boon",
    traits: [TRAIT.ZEPHYRS_BOON, TRAIT.SUNSPOT],
    rotation: ['Fire Attunement'],
    startAttunement: 'Air',
    verify: (result) =>
      assert.deepEqual(
        result.events
          .filter((event) => event.type === 'buff' && event.sourceId === TRAIT.ZEPHYRS_BOON)
          .map((event) => event.kind),
        ['fury', 'swiftness']
      )
  },
  {
    name: 'Arcane Prowess',
    traits: [TRAIT.ARCANE_PROWESS],
    rotation: ['Fire Attunement'],
    startAttunement: 'Air',
    verify: (result) => assert.ok(hasEvent(result, (event) => event.sourceId === TRAIT.ARCANE_PROWESS))
  },
  {
    name: 'Elemental Attunement',
    traits: [TRAIT.ELEMENTAL_ATTUNEMENT],
    rotation: ['Fire Attunement'],
    startAttunement: 'Air',
    verify: (result) => assert.ok(hasEvent(result, (event) => event.sourceId === TRAIT.ELEMENTAL_ATTUNEMENT))
  },
  {
    name: 'Bountiful Power',
    traits: [TRAIT.BOUNTIFUL_POWER],
    rotation: ['Air Attunement', 'Water Attunement', 'Earth Attunement', 'Fire Attunement', 'Air Attunement'],
    verify: (result) =>
      assert.ok(hasEvent(result, (event) => event.sourceId === TRAIT.BOUNTIFUL_POWER && event.kind === 'quickness'))
  },
  {
    name: 'Evasive Arcana',
    traits: [TRAIT.EVASIVE_ARCANA],
    rotation: ['Dodge'],
    verify: (result) => assert.ok(result.events.some((event) => event.type === 'elementalist.evasive-arcana'))
  },
  {
    name: 'Arcane Lightning',
    traits: [TRAIT.ARCANE_LIGHTNING],
    rotation: ['Arcane Wave'],
    verify: (result) => {
      assert.ok(result.events.some((event) => event.type === 'buff' && event.kind === 'arcane-lightning'));
      assert.ok(result.events.some((event) => event.type === 'condition' && event.condition === 'Immobilized'));
    }
  },
  {
    name: 'Elemental Lockdown',
    traits: [TRAIT.ELEMENTAL_LOCKDOWN],
    rotation: ['Updraft'],
    startAttunement: 'Air',
    verify: (result) =>
      assert.ok(hasEvent(result, (event) => event.type === 'buff' && event.sourceId === TRAIT.ELEMENTAL_LOCKDOWN))
  },
  {
    name: 'Arcane Precision',
    traits: [TRAIT.ARCANE_PRECISION],
    rotation: criticalRotation,
    startAttunement: 'Air',
    attributeInputs: baseAttributeInputs(criticalStats),
    verify: (result) =>
      assert.ok(hasEvent(result, (event) => event.type === 'condition' && event.source === 'Arcane Precision'))
  },
  {
    name: 'Renewing Stamina',
    traits: [TRAIT.RENEWING_STAMINA],
    rotation: criticalRotation,
    startAttunement: 'Air',
    attributeInputs: baseAttributeInputs(criticalStats),
    verify: (result) =>
      assert.ok(hasEvent(result, (event) => event.type === 'buff' && event.sourceId === TRAIT.RENEWING_STAMINA))
  },
  {
    name: 'Earthen Blast',
    traits: [TRAIT.EARTHEN_BLAST],
    rotation: ['Earth Attunement'],
    startAttunement: 'Water',
    verify: (result) =>
      assert.ok(hasEvent(result, (event) => event.type === 'damage' && event.source === 'Earthen Blast'))
  },
  {
    name: 'Rock Solid',
    traits: [TRAIT.ROCK_SOLID],
    rotation: ['Earth Attunement'],
    startAttunement: 'Water',
    verify: (result) =>
      assert.ok(hasEvent(result, (event) => event.type === 'buff' && event.sourceId === TRAIT.ROCK_SOLID))
  },
  {
    name: "Earth's Embrace",
    traits: [TRAIT.EARTHS_EMBRACE],
    rotation: ['Glyph of Elemental Harmony'],
    verify: (result) =>
      assert.ok(hasEvent(result, (event) => event.type === 'buff' && event.sourceId === TRAIT.EARTHS_EMBRACE))
  },
  {
    name: 'Written in Stone',
    traits: [TRAIT.WRITTEN_IN_STONE],
    rotation: ['Signet of Earth'],
    selectedSkillIds: { Utility1: 5571 },
    verify: (result) =>
      assert.ok(
        result.events.some((event) => event.type === 'elementalist.aura' && event.source === 'Written in Stone')
      )
  },
  {
    name: 'Strength of Stone',
    traits: [TRAIT.STRENGTH_OF_STONE],
    rotation: ['Signet of Earth'],
    selectedSkillIds: { Utility1: 5571 },
    startAttunement: 'Earth',
    verify: (result) =>
      assert.ok(hasEvent(result, (event) => event.type === 'condition' && event.source === 'Strength of Stone'))
  },
  {
    name: 'Elemental Shielding',
    traits: [TRAIT.ELEMENTAL_SHIELDING, TRAIT.SUNSPOT],
    rotation: ['Fire Attunement'],
    startAttunement: 'Air',
    verify: (result) => assert.ok(hasEvent(result, (event) => event.type === 'buff' && event.kind === 'protection'))
  },
  {
    name: 'Sunspot',
    traits: [TRAIT.SUNSPOT],
    rotation: ['Fire Attunement'],
    startAttunement: 'Air',
    verify: (result) => assert.ok(hasEvent(result, (event) => event.type === 'damage' && event.source === 'Sunspot'))
  },
  {
    name: 'Burning Rage',
    traits: [TRAIT.BURNING_RAGE, TRAIT.SUNSPOT],
    rotation: ['Fire Attunement'],
    startAttunement: 'Air',
    verify: (result) => assert.ok(hasEvent(result, (event) => event.type === 'condition' && event.source === 'Sunspot'))
  },
  {
    name: "Pyromancer's Puissance and Flame Expulsion",
    traits: [TRAIT.PYROMANCERS_PUISSANCE],
    // Keep the observation window open for the delayed explosion.
    rotation: ['Flame Uprising', 'Air Attunement', 1000],
    verify: (result) => {
      assert.ok(result.events.some((event) => event.type === 'buff' && event.kind === 'might'));
      assert.ok(hasEvent(result, (event) => event.type === 'damage' && event.source === 'Flame Expulsion'));
    }
  },
  {
    name: 'Persisting Flames',
    traits: [TRAIT.PERSISTING_FLAMES],
    rotation: ['Flame Uprising', 5_000],
    verify: (result) => {
      assert.equal(
        result.events.filter((event) => event.type === 'damage' && event.skillName === 'Flame Uprising').length,
        5
      );
      assert.ok(hasEvent(result, (event) => event.type === 'buff' && event.kind === 'persisting flames'));
    }
  },
  {
    name: 'Burning Precision',
    traits: [TRAIT.BURNING_PRECISION],
    rotation: criticalRotation,
    startAttunement: 'Air',
    attributeInputs: baseAttributeInputs(criticalStats),
    verify: (result) =>
      assert.ok(hasEvent(result, (event) => event.type === 'condition' && event.source === 'Burning Precision'))
  },
  {
    name: 'Smothering Auras',
    traits: [TRAIT.SMOTHERING_AURAS, TRAIT.SUNSPOT],
    rotation: ['Fire Attunement'],
    startAttunement: 'Air',
    verify: (result) =>
      assert.equal(
        result.events.find((event) => event.type === 'elementalist.aura' && event.source === 'Sunspot').duration,
        3.99
      )
  },
  {
    name: 'Soothing Ice',
    traits: [TRAIT.SOOTHING_ICE],
    rotation: ['Glyph of Elemental Harmony'],
    verify: (result) => {
      assert.ok(result.events.some((event) => event.type === 'elementalist.aura' && event.source === 'Soothing Ice'));
      assert.ok(result.events.some((event) => event.type === 'buff' && event.sourceId === TRAIT.SOOTHING_ICE));
    }
  }
];

for (const { name, traits, rotation, startAttunement, selectedSkillIds, stats, verify } of traitCases) {
  test(`${name} remains behaviorally reachable through the Core trait dispatcher`, () => {
    verify(simulate(rotation, { traits, startAttunement, selectedSkillIds, stats }));
  });
}

test('Elementalist critical reactions emit effects in registration order', () => {
  const expected = ['Raging Storm', 'Arcane Precision', 'Renewing Stamina', 'Burning Precision'];
  const effects = [];

  // One guaranteed critical proc per trait exposes dispatch order before queued boons and immediate conditions resolve.
  simulate(['Charged Strike'], {
    traits: [TRAIT.RAGING_STORM, TRAIT.ARCANE_PRECISION, TRAIT.RENEWING_STAMINA, TRAIT.BURNING_PRECISION],
    startAttunement: 'Air',
    attributeInputs: baseAttributeInputs(criticalStats),
    initialize(runtime) {
      runtime.random = { ...runtime.random, roll: () => true };
      const emit = runtime.effects.emit.bind(runtime.effects);
      runtime.effects = {
        emit(request) {
          // Observe submitted profile identity while the real emitter expands the payload.
          if (request.kind === 'profile' && expected.includes(request.attribution?.skillName))
            effects.push(request.attribution.skillName);
          return emit(request);
        }
      };
    }
  });

  assert.deepEqual(effects, expected);
});
