import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';

import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { elementalistAppAdapter } from '#gw2/content/professions/elementalist/app/app-definition.js';
import { elementalistCatalog } from '#gw2/content/professions/elementalist/catalog.js';
import { elementalistProfession } from '#gw2/content/professions/elementalist/definition.js';
import { ELEMENTALIST_TRAIT_IDS as TRAIT } from '#gw2/content/professions/elementalist/data/ids.js';
import { elementalistCoreCriticalReactions } from '#gw2/content/professions/elementalist/core/mechanics/reactions.js';

function canonicalRotation(rotation) {
  return rotation.map((entry) =>
    typeof entry === 'number'
      ? { type: 'wait', durationMs: entry }
      : { type: 'cast', skillId: elementalistCatalog.skillsByName.get(entry).id }
  );
}

// Run the smallest Core rotation that reaches a migrated trait through the public dispatcher.
function simulate(rotation, { traits, startAttunement = 'Fire', selectedSkills = {}, stats, ...buildOptions }) {
  const commands = canonicalRotation(rotation);
  const defaults = elementalistProfession.createBuildDefaults();
  const build = elementalistAppAdapter.toApplicationBuild({
    ...defaults,
    ...buildOptions,
    startAttunement,
    selectedSkills: { ...defaults.selectedSkills, ...selectedSkills },
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

  return simulateGw2({
    profession: elementalistProfession,
    rotation: commands,
    config: {
      ...config,
      selectedTraitIds: traits,
      stats: { ...config.stats, ...stats }
    }
  });
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
          (event) =>
            event.type === 'buff' && event.source === 'Glyph of Elemental Harmony' && event.kind === 'swiftness'
        )
      );
    }
  },
  {
    name: 'Fresh Air',
    traits: [TRAIT.FRESH_AIR],
    rotation: ['Fire Attunement', 'Flame Uprising', 'Ring of Fire'],
    startAttunement: 'Air',
    stats: criticalStats,
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
    stats: criticalStats,
    verify: (result) => assert.ok(hasEvent(result, (event) => event.type === 'buff' && event.source === 'Raging Storm'))
  },
  {
    name: "Zephyr's Boon",
    traits: [TRAIT.ZEPHYRS_BOON, TRAIT.SUNSPOT],
    rotation: ['Fire Attunement'],
    startAttunement: 'Air',
    verify: (result) =>
      assert.deepEqual(
        result.events.filter((event) => event.type === 'buff' && event.source === 'Sunspot').map((event) => event.kind),
        ['fury', 'swiftness']
      )
  },
  {
    name: 'Arcane Prowess',
    traits: [TRAIT.ARCANE_PROWESS],
    rotation: ['Fire Attunement'],
    startAttunement: 'Air',
    verify: (result) => assert.ok(hasEvent(result, (event) => event.source === 'Arcane Prowess'))
  },
  {
    name: 'Elemental Attunement',
    traits: [TRAIT.ELEMENTAL_ATTUNEMENT],
    rotation: ['Fire Attunement'],
    startAttunement: 'Air',
    verify: (result) => assert.ok(hasEvent(result, (event) => event.source === 'Elemental Attunement'))
  },
  {
    name: 'Bountiful Power',
    traits: [TRAIT.BOUNTIFUL_POWER],
    rotation: ['Air Attunement', 'Water Attunement', 'Earth Attunement', 'Fire Attunement', 'Air Attunement'],
    verify: (result) =>
      assert.ok(hasEvent(result, (event) => event.source === 'Bountiful Power' && event.kind === 'quickness'))
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
      assert.ok(result.events.some((event) => event.type === 'buff' && event.kind === 'arcane lightning'));
      assert.ok(result.events.some((event) => event.type === 'condition' && event.condition === 'Immobilized'));
    }
  },
  {
    name: 'Elemental Lockdown',
    traits: [TRAIT.ELEMENTAL_LOCKDOWN],
    rotation: ['Updraft'],
    startAttunement: 'Air',
    verify: (result) =>
      assert.ok(hasEvent(result, (event) => event.type === 'buff' && event.source === 'Elemental Lockdown'))
  },
  {
    name: 'Arcane Precision',
    traits: [TRAIT.ARCANE_PRECISION],
    rotation: criticalRotation,
    startAttunement: 'Air',
    stats: criticalStats,
    verify: (result) =>
      assert.ok(hasEvent(result, (event) => event.type === 'condition' && event.source === 'Arcane Precision'))
  },
  {
    name: 'Renewing Stamina',
    traits: [TRAIT.RENEWING_STAMINA],
    rotation: criticalRotation,
    startAttunement: 'Air',
    stats: criticalStats,
    verify: (result) =>
      assert.ok(hasEvent(result, (event) => event.type === 'buff' && event.source === 'Renewing Stamina'))
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
    verify: (result) => assert.ok(hasEvent(result, (event) => event.type === 'buff' && event.source === 'Rock Solid'))
  },
  {
    name: "Earth's Embrace",
    traits: [TRAIT.EARTHS_EMBRACE],
    rotation: ['Glyph of Elemental Harmony'],
    verify: (result) =>
      assert.ok(hasEvent(result, (event) => event.type === 'buff' && event.source === "Earth's Embrace"))
  },
  {
    name: 'Written in Stone',
    traits: [TRAIT.WRITTEN_IN_STONE],
    rotation: ['Signet of Earth'],
    selectedSkills: { Utility1: 'Signet of Earth' },
    verify: (result) =>
      assert.ok(
        result.events.some((event) => event.type === 'elementalist.aura' && event.source === 'Written in Stone')
      )
  },
  {
    name: 'Strength of Stone',
    traits: [TRAIT.STRENGTH_OF_STONE],
    rotation: ['Signet of Earth'],
    selectedSkills: { Utility1: 'Signet of Earth' },
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
    rotation: ['Flame Uprising', 'Air Attunement'],
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
    stats: criticalStats,
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
      assert.ok(result.events.some((event) => event.type === 'buff' && event.source === 'Soothing Ice'));
    }
  }
];

for (const { name, traits, rotation, startAttunement, selectedSkills, stats, verify } of traitCases) {
  test(`${name} remains behaviorally reachable through the Core trait dispatcher`, () => {
    verify(simulate(rotation, { traits, startAttunement, selectedSkills, stats }));
  });
}

function assertSourceOrder(source, startToken, orderedTokens) {
  let position = source.indexOf(startToken);
  assert.notEqual(position, -1, startToken);
  for (const token of orderedTokens) {
    const next = source.indexOf(token, position + 1);
    assert.ok(next > position, token);
    position = next;
  }
}

test('Elementalist dispatchers preserve attunement, post-cast, event, and condition order', async () => {
  const root = new URL('../../../js/games/gw2/content/professions/elementalist/core/', import.meta.url);
  const [indexSource, reactionsSource, transientSource, castsSource] = await Promise.all([
    readFile(new URL('traits/index.ts', root), 'utf8'),
    readFile(new URL('mechanics/reactions.ts', root), 'utf8'),
    readFile(new URL('mechanics/transient-state.ts', root), 'utf8'),
    readFile(new URL('skills/cast-effects.ts', root), 'utf8')
  ]);

  assertSourceOrder(indexSource, 'export function applyElementalistAttunementTraits', [
    'triggerFlameExpulsion(context, at, skill.id);',
    'triggerSunspot(context, at, skill.id);',
    'triggerElectricDischarge(context, at, skill.id);',
    'applyFreshAirAttunementEntry(context, at, skill, previous);',
    'applyOneWithAir(context, at, skill);',
    'applyInscriptionAirEntry(context, at, skill);',
    'triggerEarthenBlast(context, at, skill.id);',
    'grantElementalistRockSolid(context, at, skill.id);',
    'applyArcaneProwess(context, at, skill.id);',
    'grantElementalAttunementBoon(context, at, target, skill.id);',
    'triggerBountifulPower(context, at, 1, skill.id);'
  ]);
  assertSourceOrder(indexSource, 'export function applyGenericPostCast', [
    'applyPyromancersPuissance(context, skill);',
    'applyEarthsEmbrace(context, skill);',
    'applySoothingIce(context, skill, applyElementalistAura);',
    'applyWrittenInStone(context, skill, applyElementalistAura);',
    'applyInscriptionPostCast(context, skill);',
    'applyArcaneLightning(context, skill);'
  ]);
  assertSourceOrder(indexSource, 'export function observeElementalistTraitEvent', [
    'observeFreshAir(context, event);',
    'applyLightningRod(context, event);',
    'applyElementalLockdown(context, event);'
  ]);
  assertSourceOrder(reactionsSource, 'export function applyElementalistResolvedCondition', [
    'applyStrengthOfStone(context, event);',
    "if (event.condition === 'Burning') grantPersistingFlames(context, event);"
  ]);
  assertSourceOrder(transientSource, 'export function advanceElementalistState', [
    'processFreshAirCandidates(context, at);',
    'updateEndurance(context, state, at'
  ]);
  assertSourceOrder(castsSource, 'export function elementalistAfterCast', [
    'extendPersistingFlamesPackets(context, skill);',
    'const activationEvents = context.events'
  ]);
  assertSourceOrder(castsSource, 'export function elementalistOnCastComplete', [
    'triggerEvasiveArcana(context, skill);',
    'applyPistolState(context, skill);',
    'applyHammerState(context, skill);',
    'applyGenericPostCast(context, skill);'
  ]);
});

test('Elementalist critical reactions retain their registration order', () => {
  assert.deepEqual(
    elementalistCoreCriticalReactions.map((reaction) => reaction.id),
    [
      'elementalist.raging-storm',
      'elementalist.arcane-precision',
      'elementalist.renewing-stamina',
      'elementalist.burning-precision'
    ]
  );
});

test('Elementalist trait-line modules stay private and registration-free', async () => {
  const core = new URL('../../../js/games/gw2/content/professions/elementalist/core/', import.meta.url);
  const files = (await readdir(core, { recursive: true })).filter((file) => file.endsWith('.ts'));
  const lineImport = /core\/traits\/(?:air|arcane|earth|fire|water)\.js/;
  const lineFiles = new Set([
    'traits/air.ts',
    'traits/arcane.ts',
    'traits/earth.ts',
    'traits/fire.ts',
    'traits/water.ts'
  ]);

  for (const file of files) {
    const normalized = file.replaceAll('\\', '/');
    const source = await readFile(new URL(normalized, core), 'utf8');
    if (normalized !== 'traits/index.ts') assert.doesNotMatch(source, lineImport, file);
    if (lineFiles.has(normalized)) {
      assert.doesNotMatch(
        source,
        /elementalistCoreSchedulerHooks|onResolvedCriticalHit|context\.tasks\.schedule/,
        file
      );
    }
  }
});
