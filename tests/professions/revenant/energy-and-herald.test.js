import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { paletteSkillView } from '#gw2/app/rotation/palette/model.js';
import { createCalculateAttributes } from '#gw2/platform/builds/attributes.js';
import {
  createRevenantBuildDefaults,
  migrateRevenantBuild,
  validateRevenantBuild
} from '#gw2/professions/revenant/build/build.js';
import { applyRevenantBuildAttributeRules } from '#gw2/professions/revenant/build/attributes.js';
import { revenantCatalog } from '#gw2/professions/revenant/catalog.js';
import {
  REVENANT_LEGEND_IDS as LEGEND,
  REVENANT_SKILL_IDS as SKILL,
  REVENANT_TRAIT_IDS as TRAIT
} from '#gw2/professions/revenant/data/ids.js';
import { createRevenantCoreState } from '#gw2/professions/revenant/core/state.js';
import { afterRevenantCast, observeRevenantEvent } from '#gw2/professions/revenant/core/traits/index.js';
import { revenantProfession } from '#gw2/professions/revenant/definition.js';
import {
  legalRevenantLegendIds,
  REVENANT_CORE_LEGEND_IDS,
  REVENANT_ELITE_LEGEND_BY_SPECIALIZATION,
  REVENANT_RELEASE_POTENTIAL_BY_LEGEND
} from '#gw2/professions/revenant/data/legends.js';
import { REVENANT_LEGENDS, revenantLegendLoadout } from '#gw2/professions/revenant/build/legend-loadout.js';
import { createProfessionSimulator } from '../../helpers/profession-simulation.js';

// Attribute assertions use the same calculator composed into the Revenant adapter.
const calculateRevenantAttributes = createCalculateAttributes(applyRevenantBuildAttributeRules);

const revenantAttributeRules = Object.freeze({
  modifyAttributes(context, value) {
    return revenantProfession.resolveRuntime(context?.config || {}).modifyAttributes(context, value);
  },
  modifyCriticalChance(context, value) {
    return revenantProfession.resolveRuntime(context?.config || {}).modifyCriticalChance(context, value);
  },
  modifyStrikeDamage(context, value) {
    return revenantProfession.resolveRuntime(context?.config || {}).modifyStrikeDamage(context, value);
  },
  modifyConditionDamage(context, value) {
    return revenantProfession.resolveRuntime(context?.config || {}).modifyConditionDamage(context, value);
  },
  modifyConditionDuration(context, value) {
    return revenantProfession.resolveRuntime(context?.config || {}).modifyConditionDuration(context, value);
  }
});

const baseConfig = Object.freeze({
  selectedLegends: [LEGEND.ASSASSIN, LEGEND.DEMON],
  startingLegend: LEGEND.ASSASSIN,
  initialEnergy: 50,
  selectedDodge: 'Death Drop',
  allianceSide: 'luxon',
  stats: {
    power: 2000,
    precision: 1500,
    ferocity: 500,
    conditionDamage: 1000,
    expertise: 0,
    vitality: 1000
  },
  target: { armor: 2597, conditions: { Vulnerability: 25 } }
});

const simulate = createProfessionSimulator(revenantProfession, baseConfig);

const observationTail = (durationMs) => ({ kind: 'tail', durationMs });

test('legend loadout validation requires two legal distinct legends', () => {
  const defaults = createRevenantBuildDefaults();

  assert.equal(defaults.assumptions.hitboxSize, 'small');
  assert.ok(revenantProfession.ui.assumptionControls.some((control) => control.key === 'hitboxSize'));
  assert.deepEqual(validateRevenantBuild(defaults), {
    valid: true,
    errors: []
  });
  assert.equal(
    validateRevenantBuild({
      ...defaults,
      selectedLegends: [LEGEND.ASSASSIN, LEGEND.ASSASSIN]
    }).valid,
    false
  );
  assert.equal(
    validateRevenantBuild({
      ...defaults,
      selectedLegends: [LEGEND.ASSASSIN, LEGEND.RENEGADE],
      startingLegend: LEGEND.RENEGADE
    }).valid,
    false
  );
  const migrated = migrateRevenantBuild({
    ...defaults,
    selectedLegends: [LEGEND.ASSASSIN, LEGEND.DRAGON],
    startingLegend: 'missing'
  });

  assert.equal(migrated.startingLegend, LEGEND.ASSASSIN);
  assert.equal(migrateRevenantBuild({ ...defaults, assumptions: {} }).assumptions.hitboxSize, 'small');
  assert.equal(
    validateRevenantBuild({
      ...defaults,
      assumptions: { ...defaults.assumptions, hitboxSize: 'huge' }
    }).valid,
    false
  );
});

test('legend loadout exposes core legends plus only the active elite legend', () => {
  for (const specialization of ['Core', 'Herald', 'Renegade', 'Vindicator', 'Conduit']) {
    const legal = legalRevenantLegendIds(specialization);

    assert.deepEqual(legal, [
      ...REVENANT_CORE_LEGEND_IDS,
      ...(REVENANT_ELITE_LEGEND_BY_SPECIALIZATION[specialization]
        ? [REVENANT_ELITE_LEGEND_BY_SPECIALIZATION[specialization]]
        : [])
    ]);
    const options = revenantLegendLoadout
      .view({
        specialization,
        build: baseConfig
      })
      .selectors[0].options.map((option) => option.value);

    assert.deepEqual(options, legal);
  }

  const conduit = revenantLegendLoadout.normalizeBuild(
    {
      selectedLegends: [LEGEND.ALLIANCE, LEGEND.ENTITY],
      startingLegend: LEGEND.ALLIANCE
    },
    { specialization: 'Conduit' }
  );

  assert.deepEqual(conduit.selectedLegends, [LEGEND.ENTITY, LEGEND.ASSASSIN]);
  assert.equal(conduit.startingLegend, LEGEND.ENTITY);
});

test('profession palette deduplicates actions and shows only active Conduit release', () => {
  assert.deepEqual(REVENANT_RELEASE_POTENTIAL_BY_LEGEND, {
    [LEGEND.ASSASSIN]: 'Release Potential: Assassin',
    [LEGEND.CENTAUR]: 'Release Potential: Monk',
    [LEGEND.DEMON]: 'Release Potential: Mesmer',
    [LEGEND.DWARF]: 'Release Potential: Warrior',
    [LEGEND.ENTITY]: 'Release Potential: Dervish'
  });
  const professionSkillIds = (specialization, selectedLegends, activeLegendId) =>
    revenantProfession.ui
      .paletteGroups({
        specialization,
        build: {
          ...baseConfig,
          selectedLegends,
          startingLegend: activeLegendId
        },
        professionState: {
          activeLegendId,
          activeLoadoutId: activeLegendId,
          availableFlips: {}
        }
      })
      .find((group) => group.id === 'revenant-profession').skillIds;

  const vindicatorIds = professionSkillIds('Vindicator', [LEGEND.ALLIANCE, LEGEND.ASSASSIN], LEGEND.ALLIANCE);

  assert.equal(vindicatorIds.filter((id) => revenantCatalog.skillsById.get(id)?.name === 'Energy Meld').length, 1);

  for (const activeLegendId of [...REVENANT_CORE_LEGEND_IDS, LEGEND.ENTITY]) {
    const selectedLegends =
      activeLegendId === LEGEND.ENTITY ? [LEGEND.ENTITY, LEGEND.ASSASSIN] : [activeLegendId, LEGEND.ENTITY];
    const conduitIds = professionSkillIds('Conduit', selectedLegends, activeLegendId);
    const releases = conduitIds
      .map((id) => revenantCatalog.skillsById.get(id)?.name)
      .filter((name) => name?.startsWith('Release Potential:'));

    assert.deepEqual(releases, [REVENANT_RELEASE_POTENTIAL_BY_LEGEND[activeLegendId]]);
  }
});

test('energy regenerates every 100 ms and every skill pays its explicit cost', () => {
  const result = simulate('Core', ['Phase Traversal', { type: 'wait', durationMs: 1000 }]);

  // 50 - 30 + 2.5 during the half-second cast + 5 during the wait.
  assert.equal(result.endState.profession.energy, 27.5);
  const denied = simulate('Core', ['Jade Winds'], { initialEnergy: 34 });

  assert.match(denied.warnings[0], /requires 35 energy/);

  const utilityDenied = simulate('Core', ['Phase Traversal'], {
    initialEnergy: 29
  });

  assert.match(utilityDenied.warnings[0], /requires 30 energy/);
  const weaponDenied = simulate('Conduit', ['Chilling Isolation'], {
    initialEnergy: 4,
    selectedLegends: [LEGEND.ENTITY, LEGEND.ASSASSIN],
    startingLegend: LEGEND.ENTITY
  });

  assert.match(weaponDenied.warnings[0], /requires 5 energy/);

  const ticked = simulate('Core', ['__combat_start', { type: 'wait', durationMs: 150 }], { initialEnergy: 0 });

  assert.equal(ticked.endState.profession.energy, 0.5);
  assert.deepEqual(
    ticked.events
      .filter((event) => event.type === 'revenant.state' && event.reason === 'energy')
      .map((event) => [event.at, event.state.energy]),
    [[0.1, 0.5]]
  );
});

test('an in-combat Revenant skill waits for the 100 ms Energy tick that makes it affordable', () => {
  const result = simulate('Renegade', ['__combat_start', "Razorclaw's Rage"], {
    initialEnergy: 24.5,
    selectedLegends: [LEGEND.RENEGADE, LEGEND.ASSASSIN],
    startingLegend: LEGEND.RENEGADE
  });

  assert.equal(result.warnings.length, 0);
  assert.equal(result.steps.at(-1).start, 100);
});

test('a cooldown-queued Revenant skill recovers Energy before its next cast', () => {
  const result = simulate('Core', ['Phase Traversal', 'Phase Traversal']);

  assert.equal(result.warnings.length, 0);
  assert.deepEqual(
    result.steps.map((step) => [step.skill, step.start]),
    [
      ['Phase Traversal', 0],
      ['Phase Traversal', 5500]
    ]
  );
});

test('Revenant energy regeneration stops at 50 while out of combat', () => {
  for (const specialization of ['Core', 'Renegade', 'Conduit']) {
    const legends =
      specialization === 'Core'
        ? {}
        : {
            selectedLegends: [specialization === 'Renegade' ? LEGEND.RENEGADE : LEGEND.ENTITY, LEGEND.ASSASSIN],
            startingLegend: specialization === 'Renegade' ? LEGEND.RENEGADE : LEGEND.ENTITY
          };
    const precombat = simulate(specialization, [{ type: 'wait', durationMs: 20000 }, '__combat_start'], {
      ...legends,
      initialEnergy: 0
    });

    assert.equal(precombat.endState.profession.energy, 50, specialization);

    const inCombat = simulate(
      specialization,
      [{ type: 'wait', durationMs: 20000 }, '__combat_start', { type: 'wait', durationMs: 1000 }],
      { ...legends, initialEnergy: 0 }
    );

    assert.equal(inCombat.endState.profession.energy, 55, specialization);
  }
});

test('non-damaging Revenant heals do not enter combat', () => {
  const buffOnly = simulate('Conduit', ['Enchanted Daggers', { type: 'wait', durationMs: 20000 }], {
    selectedLegends: [LEGEND.ASSASSIN, LEGEND.ENTITY],
    startingLegend: LEGEND.ASSASSIN
  });

  assert.equal(buffOnly.totalDamage, 0);
  assert.equal(buffOnly.firstHitTime, null);
  assert.equal(buffOnly.endState.profession.combatBeganAt, null);
  assert.equal(buffOnly.endState.profession.energy, 50);

  const breakrazor = simulate('Renegade', ["Breakrazor's Bastion", { type: 'wait', durationMs: 20000 }], {
    selectedLegends: [LEGEND.RENEGADE, LEGEND.ASSASSIN],
    startingLegend: LEGEND.RENEGADE
  });

  assert.equal(breakrazor.totalDamage, 0);
  assert.equal(breakrazor.firstHitTime, null);
  assert.equal(breakrazor.endState.profession.combatBeganAt, null);
  assert.equal(breakrazor.endState.profession.energy, 50);
  assert.equal(
    breakrazor.events.some(
      (event) =>
        event.skillId === SKILL.BREAKRAZORS_BASTION && ['damage', 'condition', 'control', 'blind'].includes(event.type)
    ),
    false
  );

  const followedByDamage = simulate(
    'Conduit',
    ['Enchanted Daggers', { type: 'wait', durationMs: 20000 }, 'Phase Traversal', { type: 'wait', durationMs: 10000 }],
    {
      selectedLegends: [LEGEND.ASSASSIN, LEGEND.ENTITY],
      startingLegend: LEGEND.ASSASSIN
    }
  );

  assert.ok(followedByDamage.totalDamage > 0);
  assert.equal(followedByDamage.endState.profession.combatBeganAt, followedByDamage.firstHitTime);
  assert.ok(followedByDamage.endState.profession.energy > 50);
});

test('legend swap replaces the fixed bar, resets energy, and triggers sigils', () => {
  const result = simulate('Core', ['Phase Traversal', 'Swap Legends', 'Banish Enchantment']);

  assert.equal(result.warnings.length, 0);
  assert.equal(result.profession.activeLegendId, LEGEND.DEMON);
  assert.ok(result.events.some((event) => event.type === 'sigil_swap'));
  assert.ok(result.endState.profession.legendSwapReadyAt >= 10);
  assert.ok(result.totalDamage > 0);

  const precombat = simulate('Core', ['Swap Legends', 'Swap Legends']);

  assert.equal(precombat.warnings.length, 0);
  assert.deepEqual(
    precombat.steps.map((step) => step.start),
    [0, 0]
  );
  assert.equal(precombat.endState.profession.legendSwapReadyAt, 0);

  const inCombat = simulate('Core', ['__combat_start', 'Swap Legends', 'Swap Legends']);

  assert.deepEqual(
    inCombat.steps.filter((step) => step.skill === 'Swap Legends').map((step) => step.start),
    [0, 10000]
  );
  assert.equal(inCombat.endState.profession.legendSwapReadyAt, 20);

  const sigilResult = simulate('Core', ['__combat_start', 'Swap Legends'], {
    sigilSets: [
      { names: ['Hydromancy', 'Geomancy'], strike: 1, condition: 1 },
      { names: [], strike: 1, condition: 1 }
    ]
  });

  assert.deepEqual(
    sigilResult.procSteps.filter((step) => step.type === 'sigil_proc').map((step) => [step.skill, step.sourceSkill]),
    [
      ['Sigil of Hydromancy', 'Swap Legends'],
      ['Sigil of Geomancy', 'Swap Legends']
    ]
  );
});

test('legend swaps use the destination legend icon', () => {
  const rotation = ['Phase Traversal', 'Swap Legends', 'Banish Enchantment', 'Swap Legends'].map((name) => ({
    type: 'cast',
    skillId: revenantCatalog.skillsByName.get(name).id
  }));
  const build = {
    ...baseConfig,
    selectedLegends: [LEGEND.ASSASSIN, LEGEND.DEMON],
    startingLegend: LEGEND.ASSASSIN
  };
  const iconAt = (index) =>
    revenantProfession.ui.timelineSkillIcon({
      entry: rotation[index],
      index,
      rotation,
      build,
      catalog: revenantCatalog,
      skill: revenantCatalog.skillsById.get(rotation[index].skillId)
    });
  const icon = (legendId) => REVENANT_LEGENDS.find((legend) => legend.id === legendId).icon;

  assert.equal(iconAt(1), icon(LEGEND.DEMON));
  assert.equal(iconAt(3), icon(LEGEND.ASSASSIN));
  assert.equal(iconAt(0), '');
});

test('Charged Mists uses the low-energy legend reset', () => {
  const normal = simulate('Core', ['Swap Legends'], { initialEnergy: 5 });

  assert.equal(normal.endState.profession.energy, 50);
  const charged = simulate('Core', ['Swap Legends'], {
    initialEnergy: 5,
    selectedTraitIds: [TRAIT.CHARGED_MISTS]
  });

  assert.equal(charged.endState.profession.energy, 75);
  const chargedFractional = simulate('Core', ['Swap Legends'], {
    initialEnergy: 10.7,
    selectedTraitIds: [TRAIT.CHARGED_MISTS]
  });

  assert.equal(chargedFractional.endState.profession.energy, 75);
  const aboveThreshold = simulate('Core', ['Swap Legends'], {
    initialEnergy: 11,
    selectedTraitIds: [TRAIT.CHARGED_MISTS]
  });

  assert.equal(aboveThreshold.endState.profession.energy, 50);
});

test('legend invocation traits resolve after swap effects', () => {
  const result = simulate(
    'Core',
    ['Swap Legends'],
    {
      selectedTraitIds: [TRAIT.INVOKING_TORMENT, TRAIT.DIABOLIC_INFERNO, TRAIT.SPIRIT_BOON, TRAIT.SONG_OF_THE_MISTS]
    },
    observationTail(1000)
  );
  const swap = result.events.find((event) => event.type === 'sigil_swap');
  const spiritBoon = result.events.find((event) => event.sourceId === TRAIT.SPIRIT_BOON);
  const call = result.events.find((event) => event.name === 'Call of the Demon');
  const invoke = result.events.find((event) => event.type === 'damage' && event.name === 'Invoke Torment');

  assert.equal(swap.at, 0);
  assert.equal(call.at, 0);
  assert.equal(call.coefficient, 0.9);
  assert.equal(invoke.at, 0.75);
  assert.equal(invoke.coefficient, 1);
  assert.ok(spiritBoon.eventOrder < call.eventOrder);
  assert.ok(call.eventOrder < invoke.eventOrder);
  assert.deepEqual(
    result.events
      .filter((event) => event.type === 'condition' && event.skillName === 'Invoke Torment')
      .map((event) => [event.condition, event.stacks, event.duration]),
    [
      ['Torment', 1, 10],
      ['Poisoned', 1, 10],
      ['Burning', 1, 4]
    ]
  );
  assert.ok(
    result.events.some((event) => event.type === 'buff' && event.kind === 'resistance' && event.duration === 2)
  );
});

test('Herald invocation traits emit their declared proc skills', () => {
  const result = simulate('Herald', ['Swap Legends'], {
    selectedLegends: [LEGEND.ASSASSIN, LEGEND.DRAGON],
    startingLegend: LEGEND.ASSASSIN,
    selectedTraitIds: [TRAIT.SPIRIT_BOON, TRAIT.SONG_OF_THE_MISTS]
  });
  const call = result.events.find((event) => event.type === 'damage' && event.name === 'Call of the Dragon');
  const spiritBoon = result.events.find((event) => event.type === 'buff' && event.skillName === 'Spirit Boon (Dragon)');

  assert.equal(call.skillId, SKILL.CALL_OF_THE_DRAGON);
  assert.equal(call.sourceId, TRAIT.SONG_OF_THE_MISTS);
  assert.equal(call.coefficient, 0.75);
  assert.equal(spiritBoon.sourceId, TRAIT.SPIRIT_BOON);
  assert.equal(spiritBoon.kind, 'protection');
  assert.equal(spiritBoon.duration, 3);
});

test('Renegade invocation traits emit declared proc skills and grant fervor', () => {
  const result = simulate('Renegade', ['Swap Legends'], {
    selectedLegends: [LEGEND.ASSASSIN, LEGEND.RENEGADE],
    startingLegend: LEGEND.ASSASSIN,
    selectedTraitIds: [TRAIT.SPIRIT_BOON, TRAIT.SONG_OF_THE_MISTS]
  });
  const call = result.events.find((event) => event.type === 'damage' && event.name === 'Call of the Renegade');
  const bleeding = result.events.find(
    (event) =>
      event.type === 'condition' && event.skillName === 'Call of the Renegade' && event.condition === 'Bleeding'
  );
  const spiritBoon = result.events.find(
    (event) => event.type === 'buff' && event.skillName === 'Spirit Boon (Renegade)'
  );

  assert.equal(call.skillId, SKILL.CALL_OF_THE_RENEGADE);
  assert.equal(call.sourceId, TRAIT.SONG_OF_THE_MISTS);
  assert.equal(call.coefficient, 0.5);
  assert.equal(bleeding.stacks, 2);
  assert.equal(bleeding.duration, 8);
  assert.equal(spiritBoon.sourceId, TRAIT.SPIRIT_BOON);
  assert.equal(spiritBoon.kind, 'resolution');
  assert.equal(spiritBoon.duration, 4);
  assert.equal(result.endState.profession.kallasFervor.length, 2);
});

test('Corruption traits update attributes, duration, and chill triggers', () => {
  const build = createRevenantBuildDefaults();

  build.specializations = [
    { name: 'Corruption', traits: '1-3-1' },
    { name: 'Devastation', traits: '2-2-2' }
  ];
  build.assumptions.might = 25;
  const attributes = calculateRevenantAttributes(build).attributes;

  assert.equal(attributes['Condition Damage'].traits, 120);
  assert.equal(attributes.Power.traits, 0);
  assert.equal(attributes['Condition Duration'].traits, 15);
  assert.equal(attributes['Torment Duration'].traits, 10);
  assert.equal(attributes['Poison Duration'].traits, 10);

  const chill = simulate('Herald', ['Swap Legends'], {
    selectedLegends: [LEGEND.ASSASSIN, LEGEND.DRAGON],
    startingLegend: LEGEND.ASSASSIN,
    selectedTraitIds: [TRAIT.SONG_OF_THE_MISTS, TRAIT.ABYSSAL_CHILL]
  });

  assert.ok(
    chill.events.some(
      (event) =>
        event.type === 'condition' &&
        event.skillName === 'Abyssal Chill' &&
        event.condition === 'Torment' &&
        event.stacks === 1 &&
        event.duration === 3
    )
  );
  assert.equal(
    revenantAttributeRules.modifyConditionDamage(
      {
        config: { selectedTraitIds: [TRAIT.ACOLYTE_OF_TORMENT] },
        event: { actorType: 'player' },
        condition: 'Torment'
      },
      1
    ),
    1.1
  );
});

test('Notoriety applies its Might conversion at runtime without negative UI attributes', async () => {
  const saved = JSON.parse(
    await readFile(new URL('../../../data/gw2/builds/revenant/b-power-conduit.json', import.meta.url), 'utf8')
  );
  const attributes = calculateRevenantAttributes(migrateRevenantBuild(saved)).attributes;

  assert.equal(attributes['Condition Damage'].traits, 75);
  assert.equal(attributes['Condition Damage'].final, 75);

  const runtime = revenantAttributeRules.modifyAttributes(
    {
      config: {
        specialization: 'Core',
        selectedTraitIds: [TRAIT.NOTORIETY],
        boons: { might: 25 }
      },
      time: 0,
      runtime: { boons: new Map(), profession: {} }
    },
    {
      power: 1750,
      conditionDamage: 750
    }
  );

  assert.equal(runtime.power, 2000);
  assert.equal(runtime.conditionDamage, 500);
});

test('Retribution and Invocation traits use live combat state', () => {
  const player = { actorType: 'player' };
  const context = (traitId, extra = {}) => ({
    config: { selectedTraitIds: [traitId], ...(extra.config || {}) },
    event: player,
    time: 1,
    runtime: { totals: { strike: 0, condition: 0 }, ...(extra.runtime || {}) },
    query: {
      targetHasCondition: () => true,
      targetConditionStacks: () => 20,
      ...(extra.query || {})
    }
  });

  assert.equal(
    revenantAttributeRules.modifyStrikeDamage(
      context(TRAIT.RISING_TIDE, {
        config: { playerHealthFraction: 1 }
      }),
      1
    ),
    1.1
  );
  assert.equal(revenantAttributeRules.modifyStrikeDamage(context(TRAIT.DWARVEN_BATTLE_TRAINING), 1), 1.1);
  assert.equal(
    revenantAttributeRules.modifyConditionDamage(
      context(TRAIT.VICIOUS_REPRISAL, {
        config: { boons: { resolution: true } }
      }),
      1
    ),
    1.1
  );
  assert.equal(
    revenantAttributeRules.modifyCriticalChance(
      {
        config: {
          selectedTraitIds: [TRAIT.ROILING_MISTS],
          boons: { fury: true }
        },
        event: player,
        time: 1
      },
      0.25
    ),
    0.5
  );

  const disabled = simulate('Vindicator', ["Reaver's Rage"], {
    selectedLegends: [LEGEND.ALLIANCE, LEGEND.ASSASSIN],
    startingLegend: LEGEND.ALLIANCE,
    selectedTraitIds: [TRAIT.DWARVEN_BATTLE_TRAINING],
    initialEnergy: 100
  });

  assert.ok(
    disabled.events.some(
      (event) =>
        event.type === 'condition' &&
        event.skillName === 'Dwarven Battle Training' &&
        event.condition === 'Weakness' &&
        event.duration === 5
    )
  );
});

test('Devastation modifiers and Battle Scars use supplied thresholds', () => {
  const modifierContext = (traitId, { healthDamage = 0, secondaryWeapon = '', targetBoons = {} } = {}) => ({
    config: {
      selectedTraitIds: [traitId],
      secondaryWeapon,
      target: { health: 100, boons: targetBoons }
    },
    event: { actorType: 'player' },
    time: 1,
    runtime: {
      activeWeaponSet: 1,
      totals: { strike: healthDamage, condition: 0 }
    },
    query: {
      targetHasCondition: () => true,
      targetConditionStacks: () => 20
    }
  });
  const strikeCases = [
    [TRAIT.DESTRUCTIVE_IMPULSES, {}, 1.05],
    [TRAIT.DESTRUCTIVE_IMPULSES, { secondaryWeapon: 'Sword' }, 1.075],
    [TRAIT.UNSUSPECTING_STRIKES, { healthDamage: 10 }, 1.2],
    [TRAIT.TARGETED_DESTRUCTION, {}, 1.1],
    [TRAIT.BRUTALITY, { targetBoons: { protection: true } }, 1.15],
    [TRAIT.SWIFT_TERMINATION, { healthDamage: 60 }, 1.2]
  ];

  for (const [traitId, options, expected] of strikeCases) {
    assert.equal(revenantAttributeRules.modifyStrikeDamage(modifierContext(traitId, options), 1), expected);
  }

  const destructiveWithForce = modifierContext(TRAIT.DESTRUCTIVE_IMPULSES, {
    secondaryWeapon: 'Sword'
  });

  destructiveWithForce.timeline = {
    activeSigilSetAt: () => ({
      strike: 1.05,
      strikeAdd: 0.05
    })
  };
  assert.equal(revenantAttributeRules.modifyStrikeDamage(destructiveWithForce, 1.05), 1.125);

  const scars = simulate('Core', ['Enchanted Daggers', 'Phase Traversal'], {
    selectedTraitIds: [TRAIT.BATTLE_SCARRED],
    initialEnergy: 100
  });
  const siphon = scars.events.find((event) => event.name === 'Battle Scars — Life Siphon');

  assert.equal(siphon.flatStrikeBase, 117);
  assert.equal(siphon.flatStrikePowerCoeff, 0.006);
  assert.equal(scars.endState.profession.battleScars.length, 4);

  const dance = simulate('Core', ['Phase Traversal', { type: 'wait', durationMs: 5000 }, 'Phase Traversal'], {
    selectedTraitIds: [TRAIT.EXPOSE_DEFENSES, TRAIT.DANCE_OF_DEATH],
    initialEnergy: 100
  });

  assert.equal(dance.events.filter((event) => event.name === 'Battle Scars — Life Siphon').length, 1);
});

test('Devastation boon procs respect combat intervals and skill categories', () => {
  const passive = simulate('Core', ['__combat_start', { type: 'wait', durationMs: 1100 }, 'Phase Traversal'], {
    selectedTraitIds: [TRAIT.THRILL_OF_COMBAT, TRAIT.ASSASSINS_PRESENCE],
    initialEnergy: 100
  });

  assert.equal(passive.events.filter((event) => event.name === 'Battle Scars — Life Siphon').length, 1);
  assert.ok(
    passive.events.some(
      (event) =>
        event.type === 'buff' &&
        event.skillName === "Assassin's Presence" &&
        event.kind === 'fury' &&
        event.duration === 3
    )
  );

  const reprisal = simulate('Core', ['Unrelenting Assault'], {
    selectedTraitIds: [TRAIT.VICIOUS_REPRISAL],
    boons: { resolution: true },
    initialEnergy: 100
  });

  assert.equal(
    reprisal.events.filter((event) => event.type === 'buff' && event.skillName === 'Vicious Reprisal').length,
    1
  );

  const notoriety = simulate('Core', ['Enchanted Daggers'], {
    selectedTraitIds: [TRAIT.NOTORIETY],
    initialEnergy: 100
  });

  assert.ok(
    notoriety.events.some(
      (event) =>
        event.type === 'buff' &&
        event.skillName === 'Enchanted Daggers' &&
        event.sourceId === TRAIT.NOTORIETY &&
        event.kind === 'might' &&
        event.stacks === 2 &&
        event.duration === 10
    )
  );
  const notorietyStats = revenantAttributeRules.modifyAttributes(
    {
      config: { selectedTraitIds: [TRAIT.NOTORIETY], boons: { might: 0 } },
      time: 1,
      runtime: {
        boons: new Map([['might', [{ at: 0, expiresAt: 10, stacks: 2 }]]])
      }
    },
    { power: 1060, conditionDamage: 1060 }
  );

  assert.equal(notorietyStats.power, 1080);
  assert.equal(notorietyStats.conditionDamage, 1040);

  const brutality = simulate('Core', ['Swap Weapons'], {
    selectedTraitIds: [TRAIT.BRUTALITY],
    primaryWeapon: 'Sword',
    secondaryWeapon: 'Sword',
    weaponSet2Primary: 'Mace',
    weaponSet2Secondary: 'Axe'
  });

  assert.ok(
    brutality.events.some(
      (event) =>
        event.type === 'buff' && event.skillName === 'Brutality' && event.kind === 'quickness' && event.duration === 3
    )
  );
});

// Exercise one same-time condition and strike through the public dispatcher so
// cross-line reactions retain Corruption, Devastation, then Retribution order.
test('Core Revenant trait lines preserve scheduled-event reaction order', () => {
  const config = {
    ...baseConfig,
    specialization: 'Core',
    selectedTraitIds: [TRAIT.ABYSSAL_CHILL, TRAIT.ASSASSINS_PRESENCE, TRAIT.VICIOUS_REPRISAL]
  };
  const sources = [];
  const context = {
    config,
    catalog: revenantCatalog,
    profession: revenantProfession,
    epsilon: 1e-9,
    hasExplicitCombatStart: false,
    combatStartTime: null,
    state: {
      time: 1,
      profession: {
        core: createRevenantCoreState(config),
        specialization: { kind: 'Core', state: {} }
      }
    },
    tasks: { schedule() {} },
    hasBuff: (kind) => kind === 'resolution',
    emit(event) {
      return { ...event, eventOrder: sources.length + 1 };
    },
    emitDerived(_cause, event) {
      sources.push(event.sourceId);
      return { ...event, eventOrder: sources.length };
    }
  };

  observeRevenantEvent(context, {
    type: 'condition',
    at: 1,
    eventOrder: 1,
    source: 'revenant',
    actorType: 'player',
    condition: 'Chilled',
    stacks: 1
  });
  observeRevenantEvent(context, {
    type: 'damage',
    at: 1,
    eventOrder: 2,
    source: 'revenant',
    actorType: 'player',
    skillId: SKILL.PHASE_TRAVERSAL,
    skillName: 'Phase Traversal',
    coefficient: 1
  });

  assert.deepEqual(sources, [TRAIT.ABYSSAL_CHILL, TRAIT.ASSASSINS_PRESENCE, TRAIT.VICIOUS_REPRISAL]);
});

// Observe trait emissions and the upkeep setter directly to pin the mixed
// after-cast contract: Battle Scarred, Notoriety, then base Embrace bookkeeping.
test('Core Revenant after-cast traits run before Embrace empowerment', () => {
  const config = {
    ...baseConfig,
    specialization: 'Core',
    selectedTraitIds: [TRAIT.BATTLE_SCARRED, TRAIT.NOTORIETY]
  };
  const order = [];
  let empowered = false;
  const upkeep = { skillId: SKILL.EMBRACE_THE_DARKNESS };
  Object.defineProperty(upkeep, 'empoweredNextPulse', {
    get: () => empowered,
    set(value) {
      empowered = value;
      order.push('Embrace the Darkness');
    }
  });
  const core = createRevenantCoreState(config);
  core.activeUpkeeps = [upkeep];
  const context = {
    config,
    catalog: revenantCatalog,
    profession: revenantProfession,
    epsilon: 1e-9,
    hasExplicitCombatStart: false,
    combatStartTime: null,
    effectiveEnd: 1,
    state: {
      time: 1,
      profession: { core, specialization: { kind: 'Core', state: {} } }
    },
    emit(event) {
      order.push(event.sourceId === TRAIT.BATTLE_SCARRED ? 'Battle Scarred' : 'Notoriety');
      return { ...event, eventOrder: order.length };
    }
  };

  afterRevenantCast(context, revenantCatalog.skillsById.get(SKILL.ENCHANTED_DAGGERS));

  assert.deepEqual(order, ['Battle Scarred', 'Notoriety', 'Embrace the Darkness']);
  assert.equal(empowered, true);
});

test('upkeep drains net energy and cancels exactly on starvation', () => {
  const draining = simulate('Core', ['Impossible Odds', { type: 'wait', durationMs: 20000 }]);

  assert.equal(draining.endState.profession.energy, 25);
  assert.equal(draining.endState.profession.activeUpkeeps.length, 1);

  const starved = simulate('Core', ['Impossible Odds', { type: 'wait', durationMs: 50000 }]);

  assert.equal(starved.endState.profession.activeUpkeeps.length, 0);
  assert.equal(starved.endState.profession.energy, 25);
});

test('upkeep Energy drain begins when its cast completes', () => {
  const result = simulate('Core', ['Embrace the Darkness'], {
    selectedLegends: [LEGEND.DEMON, LEGEND.ASSASSIN],
    startingLegend: LEGEND.DEMON
  });

  const completion = result.steps[0].end / 1000;

  // The activation spends 5 Energy immediately, then receives normal regeneration until the upkeep completes.
  assert.deepEqual(
    result.events
      .filter((event) => event.type === 'revenant.state' && event.reason === 'energy' && event.at < completion)
      .map((event) => event.state.energy),
    [45.5, 46, 46.5, 47, 47.5, 48]
  );
  assert.equal(result.endState.profession.activeUpkeeps[0].startsAt, completion);
});

test('Revenant palette exposes upkeep releases and enforces Energy costs', () => {
  const active = simulate('Core', ['Impossible Odds']);
  const context = {
    specialization: 'Core',
    build: baseConfig,
    professionState: active.endState.profession
  };
  const assassin = revenantLegendLoadout.paletteGroups(context).find((group) => group.label === 'Assassin');

  assert.ok(assassin.skillIds.includes(SKILL.RELINQUISH_POWER));

  const impossible = revenantCatalog.skillsByName.get('Impossible Odds');
  const relinquish = revenantCatalog.skillsByName.get('Relinquish Power');

  assert.equal(revenantProfession.ui.isPaletteSkillAvailable(context, impossible), false);
  assert.equal(revenantProfession.ui.isPaletteSkillAvailable(context, relinquish), true);

  const lowEnergyContext = {
    ...context,
    professionState: {
      ...context.professionState,
      energy: 4.9,
      activeUpkeeps: [],
      availableFlips: {}
    }
  };
  const chilling = revenantCatalog.skillsByName.get('Chilling Isolation');
  const phase = revenantCatalog.skillsByName.get('Phase Traversal');

  assert.equal(revenantProfession.ui.isPaletteSkillAvailable(lowEnergyContext, chilling), false);
  assert.equal(revenantProfession.ui.isPaletteSkillAvailable(lowEnergyContext, phase), false);
  assert.equal(
    revenantProfession.ui.isPaletteSkillAvailable(
      {
        ...lowEnergyContext,
        cooldowns: {
          'Phase Traversal': { readyAt: 5500, remaining: 5000 }
        }
      },
      phase
    ),
    true
  );
  assert.equal(
    revenantProfession.ui.paletteSkillUnavailableMessage(lowEnergyContext, phase),
    'Requires 30 Energy; currently 4'
  );
  assert.match(paletteSkillView({ results: null }, phase).title, /Energy cost: 30/);
  assert.match(paletteSkillView({ results: null }, relinquish).title, /Energy cost: 0/);
});

test('Herald palette replaces active facets with their consume skills', () => {
  const context = {
    specialization: 'Herald',
    build: {
      ...baseConfig,
      selectedLegends: [LEGEND.DRAGON, LEGEND.ASSASSIN],
      startingLegend: LEGEND.DRAGON
    },
    professionState: {
      activeLegendId: LEGEND.DRAGON,
      activeLoadoutId: LEGEND.DRAGON,
      availableFlips: {
        [SKILL.INFUSE_LIGHT]: true,
        [SKILL.BURST_OF_STRENGTH]: true,
        [SKILL.ELEMENTAL_BLAST]: true,
        [SKILL.GAZE_OF_DARKNESS]: true,
        [SKILL.CHAOTIC_RELEASE]: true,
        [SKILL.TRUE_NATURE_ID_51696]: true
      }
    }
  };
  const dragon = revenantLegendLoadout.paletteGroups(context).find((group) => group.label === 'Dragon');

  assert.deepEqual(dragon.skillIds, [
    SKILL.INFUSE_LIGHT,
    SKILL.BURST_OF_STRENGTH,
    SKILL.ELEMENTAL_BLAST,
    SKILL.GAZE_OF_DARKNESS,
    SKILL.CHAOTIC_RELEASE
  ]);

  const professionGroups = revenantProfession.ui.paletteGroups(context);
  const profession = professionGroups.find((group) => group.id === 'revenant-profession');

  // The UI declares the complete tile family; the shared projector chooses the live legend variant.
  assert.deepEqual(profession.skillIds, [
    SKILL.FACET_OF_NATURE,
    SKILL.TRUE_NATURE,
    SKILL.TRUE_NATURE_ID_51675,
    SKILL.TRUE_NATURE_ID_51696,
    SKILL.TRUE_NATURE_ID_51713,
    SKILL.TRUE_NATURE_ID_51714
  ]);
  assert.equal(
    professionGroups.some((group) => group.id === 'revenant-facet-consumes'),
    false
  );
});

test('Call to Anguish arms Unyielding Impact in the rotation palette', () => {
  const config = {
    selectedLegends: [LEGEND.DEMON, LEGEND.ASSASSIN],
    startingLegend: LEGEND.DEMON,
    initialEnergy: 100,
    boons: { quickness: true }
  };
  const armed = simulate('Core', ['Call to Anguish'], config);

  assert.equal(armed.steps[0].fullCastMs, 820);
  const context = {
    specialization: 'Core',
    build: { ...baseConfig, ...config },
    professionState: armed.endState.profession
  };
  const demon = revenantLegendLoadout.paletteGroups(context).find((group) => group.label === 'Demon');

  assert.ok(demon.skillIds.includes(SKILL.UNYIELDING_IMPACT));
  assert.equal(
    revenantProfession.ui.isPaletteSkillAvailable(context, revenantCatalog.skillsById.get(SKILL.CALL_TO_ANGUISH)),
    false
  );
  assert.equal(
    revenantProfession.ui.isPaletteSkillAvailable(context, revenantCatalog.skillsById.get(SKILL.UNYIELDING_IMPACT)),
    true
  );

  const consumed = simulate('Core', ['Call to Anguish', 'Unyielding Impact'], config);

  assert.deepEqual(consumed.warnings, []);
  assert.equal(consumed.endState.profession.availableFlips[SKILL.UNYIELDING_IMPACT], undefined);

  const unavailable = simulate('Core', ['Unyielding Impact'], config);

  assert.match(unavailable.warnings[0], /cast Call to Anguish first/);

  const queuedForEnergy = simulate('Core', ['Call to Anguish', 'Unyielding Impact'], { ...config, initialEnergy: 30 });

  assert.equal(queuedForEnergy.warnings.length, 0);
  assert.equal(queuedForEnergy.steps.at(-1).start, 1000);
});

test('Herald facets expose and consume their active flips', () => {
  const result = simulate('Herald', ['Facet of Strength', 'Burst of Strength'], {
    selectedLegends: [LEGEND.DRAGON, LEGEND.ASSASSIN],
    startingLegend: LEGEND.DRAGON,
    initialEnergy: 100
  });

  assert.equal(result.warnings.length, 0);
  assert.equal(result.endState.profession.activeUpkeeps.length, 0);
  assert.ok(result.totalDamage > 0);
});

test('Facet of Nature exposes the consume variant for the active legend', () => {
  const result = simulate('Herald', ['Facet of Nature', { skillId: SKILL.TRUE_NATURE_ID_51696 }], {
    selectedLegends: [LEGEND.DRAGON, LEGEND.DEMON],
    startingLegend: LEGEND.DRAGON
  });

  assert.deepEqual(result.warnings, []);
  assert.equal(
    result.events.find((event) => event.type === 'action' && event.skillName === 'True Nature')?.skillId,
    SKILL.TRUE_NATURE_ID_51696
  );
});

test('Dragon True Nature extends active allied boons by two seconds', () => {
  const result = simulate(
    'Herald',
    [
      'Facet of Darkness',
      { type: 'wait', durationMs: 3100 },
      'Facet of Nature',
      { skillId: SKILL.TRUE_NATURE_ID_51696 }
    ],
    {
      selectedLegends: [LEGEND.DRAGON, LEGEND.ASSASSIN],
      startingLegend: LEGEND.DRAGON,
      initialEnergy: 100,
      stats: { concentration: 0 }
    }
  );
  const fury = result.events.find(
    (event) => event.type === 'buff' && event.skillName === 'Facet of Darkness' && event.kind === 'fury'
  );
  const extension = result.events.find(
    (event) => event.type === 'proc' && event.skillId === SKILL.TRUE_NATURE_ID_51696
  );

  assert.deepEqual(result.warnings, []);
  assert.equal(fury.duration, 5);
  assert.equal(extension.duration, 2);
  assert.equal(extension.procType, 'boon-extension');
});

test('True Nature variants share their twenty-second parent cooldown across legends', () => {
  const result = simulate(
    'Herald',
    [
      'Facet of Nature',
      { skillId: SKILL.TRUE_NATURE },
      'Swap Legends',
      'Facet of Nature',
      { skillId: SKILL.TRUE_NATURE_ID_51696 }
    ],
    {
      selectedLegends: [LEGEND.ASSASSIN, LEGEND.DRAGON],
      startingLegend: LEGEND.ASSASSIN,
      initialEnergy: 100
    }
  );
  const facetSteps = result.steps.filter((step) => step.skill === 'Facet of Nature');
  const firstTrueNature = result.steps.find((step) => step.skill === 'True Nature');

  assert.deepEqual(result.warnings, []);
  assert.equal(facetSteps[1].start, firstTrueNature.end + 20000);
  for (const skillId of [
    SKILL.TRUE_NATURE,
    SKILL.TRUE_NATURE_ID_51675,
    SKILL.TRUE_NATURE_ID_51696,
    SKILL.TRUE_NATURE_ID_51713,
    SKILL.TRUE_NATURE_ID_51714
  ]) {
    assert.equal(revenantCatalog.skillsById.get(skillId).cooldown, 20);
  }
});

test('Herald consume skills apply their cooldown to the parent facet', () => {
  const cases = [
    ['Facet of Light', 'Infuse Light', 30],
    ['Facet of Darkness', 'Gaze of Darkness', 15],
    ['Facet of Elements', 'Elemental Blast', 12],
    ['Facet of Strength', 'Burst of Strength', 12],
    ['Facet of Chaos', 'Chaotic Release', 20]
  ];

  for (const [facet, consume, cooldown] of cases) {
    const result = simulate('Herald', [facet, consume], {
      selectedLegends: [LEGEND.DRAGON, LEGEND.ASSASSIN],
      startingLegend: LEGEND.DRAGON,
      initialEnergy: 100
    });
    const consumeStep = result.steps.find((step) => step.skill === consume);

    assert.deepEqual(result.warnings, [], facet);
    const readyAt = consumeStep.end + cooldown * 1000;

    assert.deepEqual(result.endState.cooldowns[facet], {
      readyAt,
      remaining: readyAt - result.endState.time
    });
  }
});

test('Herald facets pulse their boons every three seconds', () => {
  const cases = [
    ['Facet of Light', 'Infuse Light', 1, 'regeneration', 4],
    ['Facet of Darkness', 'Gaze of Darkness', 2, 'fury', 3],
    ['Facet of Elements', 'Elemental Blast', 1, 'swiftness', 3],
    ['Facet of Strength', 'Burst of Strength', 2, 'might', 12],
    ['Facet of Chaos', 'Chaotic Release', 4, 'protection', 3]
  ];

  for (const [facet, consume, upkeep, boon, duration] of cases) {
    assert.equal(revenantCatalog.skillsByName.get(facet).upkeepCost, upkeep);
    const result = simulate('Herald', [facet, { type: 'wait', durationMs: 3100 }, consume], {
      selectedLegends: [LEGEND.DRAGON, LEGEND.ASSASSIN],
      startingLegend: LEGEND.DRAGON,
      initialEnergy: 100
    });

    assert.equal(result.warnings.length, 0);
    assert.ok(
      result.events.some(
        (event) =>
          event.type === 'buff' && event.skillName === facet && event.kind === boon && event.duration === duration
      )
    );
    assert.equal(result.endState.profession.activeUpkeeps.length, 0);
  }
});

test('Shared Empowerment grants one stack of eight-second Might on a strict one-second ICD', () => {
  const result = simulate(
    'Herald',
    ['Pain Absorption', 'Pain Absorption', { type: 'wait', durationMs: 1 }, 'Pain Absorption'],
    {
      selectedLegends: [LEGEND.DEMON, LEGEND.DRAGON],
      startingLegend: LEGEND.DEMON,
      initialEnergy: 100,
      selectedTraitIds: [TRAIT.SHARED_EMPOWERMENT],
      stats: { concentration: 0 },
      allies: { count: 4 }
    }
  );
  const applications = result.events.filter(
    (event) => event.type === 'buff' && event.skillName === 'Shared Empowerment'
  );

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(
    applications.map((event) => [event.at, event.kind, event.duration, event.stacks]),
    [
      [result.steps[0].end / 1000, 'might', 8, 1],
      [result.steps.at(-1).end / 1000, 'might', 8, 1]
    ]
  );
  assert.ok(applications.every((event) => event.resolvedAudience.alliedPlayerCount === 4));
});

test('Elevated Compassion grants 1.25 seconds of Quickness once per second at six upkeep', () => {
  const belowThreshold = simulate('Herald', ['Facet of Chaos', { type: 'wait', durationMs: 1100 }], {
    selectedLegends: [LEGEND.DRAGON, LEGEND.ASSASSIN],
    startingLegend: LEGEND.DRAGON,
    initialEnergy: 100,
    selectedTraitIds: [TRAIT.ELEVATED_COMPASSION],
    stats: { concentration: 0 }
  });
  const atThreshold = simulate('Herald', ['Facet of Chaos', 'Facet of Strength', { type: 'wait', durationMs: 2100 }], {
    selectedLegends: [LEGEND.DRAGON, LEGEND.ASSASSIN],
    startingLegend: LEGEND.DRAGON,
    initialEnergy: 100,
    selectedTraitIds: [TRAIT.ELEVATED_COMPASSION],
    stats: { concentration: 0 }
  });
  const thresholdReentry = simulate(
    'Herald',
    [
      'Facet of Chaos',
      'Facet of Strength',
      'Burst of Strength',
      'Facet of Darkness',
      { type: 'wait', durationMs: 300 }
    ],
    {
      selectedLegends: [LEGEND.DRAGON, LEGEND.ASSASSIN],
      startingLegend: LEGEND.DRAGON,
      initialEnergy: 100,
      selectedTraitIds: [TRAIT.ELEVATED_COMPASSION],
      stats: { concentration: 0 }
    }
  );

  assert.equal(
    belowThreshold.events.some((event) => event.type === 'buff' && event.skillName === 'Elevated Compassion'),
    false
  );
  assert.deepEqual(
    atThreshold.events
      .filter((event) => event.type === 'buff' && event.skillName === 'Elevated Compassion')
      .map((event) => [event.at, event.kind, event.duration]),
    [
      [0, 'quickness', 1.25],
      [1, 'quickness', 1.25],
      [2, 'quickness', 1.25]
    ]
  );
  assert.deepEqual(
    thresholdReentry.events
      .filter((event) => event.type === 'buff' && event.skillName === 'Elevated Compassion')
      .map((event) => event.at),
    [0, 1]
  );
});

test('Herald consume skills apply their full outgoing profiles', () => {
  const gaze = simulate('Herald', ['Facet of Darkness', 'Gaze of Darkness'], {
    selectedLegends: [LEGEND.DRAGON, LEGEND.ASSASSIN],
    startingLegend: LEGEND.DRAGON
  });

  assert.equal(gaze.schedulerState.cooldowns.get(revenantCatalog.skillsByName.get('Gaze of Darkness').id), 15);
  assert.ok(
    gaze.events.some(
      (event) => event.type === 'blind' && event.skillName === 'Gaze of Darkness' && event.duration === 5
    )
  );
  assert.ok(gaze.events.some((event) => event.condition === 'Revealed' && event.duration === 5));
  assert.ok(
    gaze.events.some((event) => event.condition === 'Vulnerability' && event.stacks === 10 && event.duration === 6)
  );

  const elements = simulate(
    'Herald',
    ['Facet of Elements', 'Elemental Blast'],
    {
      selectedLegends: [LEGEND.DRAGON, LEGEND.ASSASSIN],
      startingLegend: LEGEND.DRAGON
    },
    observationTail(3000)
  );

  assert.deepEqual(
    elements.events
      .filter((event) => event.type === 'damage' && event.skillName === 'Elemental Blast')
      .map((event) => [event.at, event.coefficient]),
    [
      [0.28, 1.5],
      [1.28, 1.5],
      [2.28, 1.5]
    ]
  );
  assert.deepEqual(
    elements.events
      .filter((event) => event.type === 'condition' && event.skillName === 'Elemental Blast')
      .map((event) => [event.condition, event.stacks, event.duration]),
    [
      ['Weakness', 1, 5],
      ['Chilled', 1, 3],
      ['Burning', 2, 4]
    ]
  );

  const strength = simulate('Herald', ['Facet of Strength', 'Burst of Strength'], {
    selectedLegends: [LEGEND.DRAGON, LEGEND.ASSASSIN],
    startingLegend: LEGEND.DRAGON
  });

  assert.deepEqual(
    strength.events
      .filter((event) => event.type === 'damage' && event.skillName === 'Burst of Strength')
      .map((event) => [Number(event.at.toFixed(2)), event.coefficient]),
    [
      [0.36, 1.6],
      [0.68, 1.6]
    ]
  );
  assert.ok(
    strength.events.some(
      (event) => event.type === 'buff' && event.kind === 'burst-of-strength' && event.duration === 10
    )
  );
  const burstContext = {
    config: { specialization: 'Herald' },
    time: 5,
    event: { actorType: 'player', skillName: 'Chilling Isolation' },
    runtime: {
      boons: new Map([['burst-of-strength', [{ at: 1, expiresAt: 11, stacks: 1 }]]]),
      profession: {}
    }
  };

  assert.equal(revenantAttributeRules.modifyStrikeDamage(burstContext, 1), 1.1);
  assert.equal(revenantAttributeRules.modifyConditionDamage(burstContext, 1), 1.05);
  const reinforcedPotencyContext = {
    config: {
      specialization: 'Herald',
      selectedTraitIds: [TRAIT.REINFORCED_POTENCY],
      boons: {
        aegis: true,
        alacrity: true,
        fury: true,
        might: 25,
        protection: true,
        quickness: true,
        regeneration: true,
        resolution: true,
        swiftness: true,
        vigor: true
      }
    },
    time: 5,
    event: { actorType: 'player' },
    runtime: { boons: new Map(), profession: {} }
  };

  assert.equal(revenantAttributeRules.modifyStrikeDamage(reinforcedPotencyContext, 1), 1.1);

  const chaos = simulate('Herald', ['Facet of Chaos', 'Chaotic Release'], {
    selectedLegends: [LEGEND.DRAGON, LEGEND.ASSASSIN],
    startingLegend: LEGEND.DRAGON
  });

  assert.ok(
    chaos.events.some(
      (event) => event.type === 'damage' && event.skillName === 'Chaotic Release' && event.coefficient === 4
    )
  );
  assert.ok(chaos.events.some((event) => event.type === 'control' && event.controlKind === 'knockback'));
  assert.ok(chaos.events.some((event) => event.type === 'buff' && event.kind === 'superspeed' && event.duration === 5));
});
