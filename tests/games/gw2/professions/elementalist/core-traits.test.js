import assert from 'node:assert/strict';
import test from 'node:test';

import { describeSimulationTrait } from '#gw2/app/shared/simulation-tooltip.js';
import { baseAttributeInputs } from '#gw2/platform/attributes/inputs.js';
import { normalizeTransitionDelays } from '#gw2/platform/execution/transition-lockouts.js';
import { elementalistAppAdapter } from '#gw2/professions/elementalist/app/app-definition.js';
import { elementalistTooltips } from '#gw2/professions/elementalist/app/tooltips.js';
import { ELEMENTALIST_TRAIT_IDS as TRAIT } from '#gw2/professions/elementalist/data/ids.js';
import { elementalistCatalog, elementalistProfession } from '#gw2/professions/elementalist/profession.js';
import { createCalculateAttributes, createProfessionBuildAttributeRules } from '#tests/helpers/build-attributes.js';
import { runElementalist } from '#tests/helpers/elementalist-simulation.js';
import { patchTraitProfession } from '#tests/helpers/trait-patch.js';

function canonicalRotation(rotation) {
  return rotation.map((entry) =>
    typeof entry === 'number'
      ? { type: 'wait', durationMs: entry }
      : { type: 'cast', skillId: elementalistCatalog.skills.find((candidate) => candidate.name === entry).id }
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
    patch: elementalistAppAdapter.profession.resolvePatch(),
    build,
    adapter: elementalistAppAdapter,
    profession: elementalistProfession,
    activeCatalog: elementalistCatalog,
    attributeWeaponSet: 1
  };
  app.attributeData = elementalistAppAdapter
    .createBuildContext({
      build: app.build,
      transitionDelays: normalizeTransitionDelays(app.simulationSettings?.transitionDelays),
      patch: elementalistAppAdapter.profession.resolvePatch({ id: app.patch.id ?? 'current' })
    })
    .attributes(app.attributeWeaponSet === 2 ? 2 : 1);
  const config = elementalistAppAdapter
    .createBuildContext({
      build: app.build,
      transitionDelays: normalizeTransitionDelays(app.simulationSettings?.transitionDelays),
      patch: elementalistAppAdapter.profession.resolvePatch({ id: app.patch.id ?? 'current' })
    })
    .simulationConfig();

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
      assert.ok(result.events.some((event) => event.type === 'aura' && event.source === 'Written in Stone'))
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
      assert.equal(result.events.find((event) => event.type === 'aura' && event.source === 'Sunspot').duration, 3.99)
  },
  {
    name: 'Soothing Ice',
    traits: [TRAIT.SOOTHING_ICE],
    rotation: ['Glyph of Elemental Harmony'],
    verify: (result) => {
      assert.ok(result.events.some((event) => event.type === 'aura' && event.source === 'Soothing Ice'));
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

test('Elementalist Core definitions preserve patched build grants and disabled-trait preview selection', () => {
  const family = patchTraitProfession(elementalistProfession, {
    balanceProfiles: {
      [TRAIT.BURNING_RAGE]: { fields: { 'attributeBonuses.conditionDamage': 240 } },
      [TRAIT.BURNING_PRECISION]: { fields: { durationMultiplier: 30 } },
      [TRAIT.ZEPHYRS_SPEED]: { fields: { criticalChance: 0.1 } }
    }
  });
  const calculate = createCalculateAttributes(
    createProfessionBuildAttributeRules(elementalistCatalog),
    family.attributeContributions
  );
  const build = {
    specializations: [
      { name: 'Fire', traits: '1-1-1' },
      { name: 'Air', traits: '1-1-1' }
    ]
  };
  const live = calculate(build, [], 1, null, null, family.resolvePatch({ id: 'current' }).balanceContext);
  const preview = calculate(build, [], 1, null, null, family.resolvePatch({ id: 's4-preview' }).balanceContext);
  assert.equal(live.attributes['Condition Damage'].traits, 180);
  assert.equal(preview.attributes['Condition Damage'].traits, 240);
  assert.equal(preview.attributes['Burning Duration'].traits, 30);
  assert.equal(preview.attributes['Critical Chance'].traits, 10);
  assert.equal(
    calculate(build, [], 1, 'Burning Rage', null, family.resolvePatch({ id: 's4-preview' }).balanceContext).attributes[
      'Condition Damage'
    ].traits,
    0
  );
});

test('Electric Discharge keeps its packet-owned critical modifier after selection ends and reads preview tuning', () => {
  // Its proc packet already owns eligibility; ordinary trait modifiers still require current selection.
  const family = patchTraitProfession(elementalistProfession, {
    balanceProfiles: { [TRAIT.ELECTRIC_DISCHARGE]: { fields: { criticalDamage: 3 } } }
  });
  for (const [patchId, factor] of [
    ['current', 2],
    ['s4-preview', 3]
  ]) {
    const runtime = family.runtimeFor({ patchId });
    const context = {
      time: 1,
      catalog: runtime.catalog,
      event: { actorType: 'effect', skillName: 'Electric Discharge' },
      config: { selectedTraitIds: [] }
    };
    assert.equal(runtime.modifyCriticalDamage(context, 1), factor);
    assert.equal(runtime.modifyCriticalDamage({ ...context, event: { skillName: 'Other' } }, 1), 1);
    assert.equal(runtime.modifyCriticalChance({ ...context, event: { actorType: 'player' } }, 0), 0);
  }
});

test('Persisting Flames patches transform packets before emission and display the same stack cap used by damage', () => {
  const family = patchTraitProfession(elementalistProfession, {
    balanceProfiles: {
      [TRAIT.PERSISTING_FLAMES]: {
        fields: { durationPerTier: 3, maximumStacks: 2, damageIncreasePerStack: 0.1 }
      }
    }
  });
  const effects = [
    { type: 'strike', damageKind: 'field-tick', coefficient: 1, atMs: 0, applications: 2, intervalMs: 1000 }
  ];
  const skill = { type: 'Weapon', comboFields: [{ fieldType: 'Fire', duration: 2 }] };
  // The patched field extension alone decides how many one-second pulses are added.
  for (const [patchId, extension, damage] of [
    ['current', 2, 110],
    ['s4-preview', 3, 120]
  ]) {
    const runtime = family.runtimeFor({ patchId });
    const context = {
      time: 1,
      helpers: runtime.catalog,
      catalog: runtime.catalog,
      config: { selectedTraitIds: [TRAIT.PERSISTING_FLAMES] },
      runtime: {
        boons: new Map([]),
        buffs: new Map([
          ['persisting flames', [{ resolvedAudience: { includesSelf: true }, at: 0, expiresAt: 15, stacks: 5 }]]
        ])
      },
      event: { actorType: 'player' }
    };
    assert.equal(runtime.modifyComboFields(context, { skill }, skill.comboFields)[0].duration, 2 + extension);
    // Value transforms receive the fixture's query view, as they do through native mechanic composition.
    const transformed = runtime.modifyEffects({ ...context, queries: context }, { skill }, effects);
    assert.equal(transformed.at(-1).applications, 2 + extension);
    assert.ok(Math.abs(runtime.modifyStrikeDamage(context, 100) - damage) < 1e-10);
    const unselected = { ...context, config: { selectedTraitIds: [] } };
    assert.equal(runtime.modifyEffects({ ...unselected, queries: unselected }, { skill }, effects), effects);
  }

  const tooltip = describeSimulationTrait(
    family.resolvePatch({ id: 's4-preview' }).balanceContext,
    { id: TRAIT.PERSISTING_FLAMES, name: 'Persisting Flames' },
    elementalistTooltips
  );
  assert.equal(tooltip.facts.find((fact) => fact.name === 'Maximum stacks').detail, '2');
  assert.equal(effects[0].applications, 2);
  assert.equal(skill.comboFields[0].duration, 2);
});
