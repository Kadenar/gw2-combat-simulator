import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  currentAutoattackSkill,
  paletteActionSkills,
  paletteSkillIsInstant,
  weaponSkills
} from '#gw2/app/rotation/palette/model.js';
import { paletteSkillView } from '#gw2/app/rotation/palette/model.js';
import { resolvePaletteDropItem } from '#gw2/app/rotation/palette/interactions.js';
import { insertRotationItems } from '#gw2/app/rotation/editing/actions.js';
import { buildChartSeries } from '#gw2/app/results/model.js';
import { revenantCatalog } from '#gw2/professions/revenant/catalog.js';
import {
  VINDICATOR_DODGE_AUTO_ACTION,
  vindicatorDodgeAutoRotationEntries
} from '#gw2/professions/revenant/specializations/vindicator/presentation.js';
import {
  REVENANT_LEGEND_IDS as LEGEND,
  REVENANT_SKILL_IDS as SKILL,
  REVENANT_TRAIT_IDS as TRAIT
} from '#gw2/professions/revenant/data/ids.js';
import { revenantProfession } from '#gw2/professions/revenant/definition.js';
import { createProfessionSimulator } from '../../helpers/profession-simulation.js';

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

const PLAYER_AUDIENCE = Object.freeze({
  includesSelf: true,
  includesSummons: false,
  alliedPlayerCount: 0,
  companionIds: [],
  recipientCount: 1
});

const simulate = createProfessionSimulator(revenantProfession, baseConfig);

const observationTail = (durationMs) => ({ kind: 'tail', durationMs });

const strikeCoefficient = (effect) =>
  effect.ticks?.reduce((total, tick) => total + Number(tick.coefficient), 0) ?? Number(effect.coefficient);

test('Demon skills use their current projectile and condition packets', () => {
  const banish = simulate('Core', ['Banish Enchantment'], {
    selectedLegends: [LEGEND.DEMON, LEGEND.ASSASSIN],
    startingLegend: LEGEND.DEMON,
    initialEnergy: 100
  });
  const banishEvents = banish.events.filter((event) => event.skillName === 'Banish Enchantment');

  assert.ok(
    banishEvents.filter((event) => event.type === 'damage').every((event) => Math.abs(event.coefficient - 0.4) < 1e-9)
  );
  assert.deepEqual(
    banishEvents.filter((event) => event.type === 'damage').map((event) => Math.round(event.at * 1000)),
    [402, 521, 640]
  );
  assert.equal(
    banishEvents.filter((event) => event.type === 'condition' && event.condition === 'Chilled' && event.duration === 1)
      .length,
    3
  );
  assert.equal(
    banishEvents.filter((event) => event.type === 'condition' && event.condition === 'Torment' && event.duration === 3)
      .length,
    3
  );

  const anguish = simulate('Core', ['Call to Anguish', 'Unyielding Impact'], {
    selectedLegends: [LEGEND.DEMON, LEGEND.ASSASSIN],
    startingLegend: LEGEND.DEMON,
    initialEnergy: 100
  });

  assert.ok(
    anguish.events.some(
      (event) =>
        event.type === 'damage' &&
        event.skillName === 'Call to Anguish' &&
        event.coefficient === 1.2 &&
        event.at === 0.804
    )
  );
  assert.ok(
    anguish.events.some(
      (event) =>
        event.skillName === 'Call to Anguish' &&
        event.condition === 'Chilled' &&
        event.duration === 2 &&
        event.at === 0.804
    )
  );
  assert.ok(
    anguish.events.some(
      (event) => event.type === 'control' && event.skillName === 'Call to Anguish' && event.at === 0.804
    )
  );
  assert.ok(
    anguish.events.some(
      (event) =>
        event.type === 'damage' &&
        event.skillName === 'Unyielding Impact' &&
        event.coefficient === 1 &&
        event.at === 1.787
    )
  );
  assert.deepEqual(
    anguish.events
      .filter((event) => event.type === 'condition' && event.skillName === 'Unyielding Impact')
      .map((event) => [event.condition, event.stacks, event.duration]),
    [
      ['Burning', 1, 3],
      ['Torment', 4, 3],
      ['Poisoned', 1, 3]
    ]
  );
});

test('Embrace the Darkness empowers only the next pulse and releases', () => {
  const baseline = simulate(
    'Core',
    ['Embrace the Darkness', { type: 'wait', durationMs: 1100 }, 'Resist the Darkness'],
    {
      selectedLegends: [LEGEND.DEMON, LEGEND.ASSASSIN],
      startingLegend: LEGEND.DEMON,
      initialEnergy: 100
    }
  );
  const baselinePulse = baseline.events.find(
    (event) => event.type === 'condition' && event.skillName === 'Embrace the Darkness' && event.condition === 'Torment'
  );

  assert.equal(baselinePulse.stacks, 1);
  assert.equal(baselinePulse.duration, 5);
  assert.equal(baselinePulse.at, 0.362);
  assert.ok(
    baseline.events.some(
      (event) => event.type === 'damage' && event.skillName === 'Embrace the Darkness' && event.coefficient === 0.3
    )
  );
  assert.equal(baseline.endState.profession.activeUpkeeps.length, 0);

  const empowered = simulate(
    'Core',
    ['Embrace the Darkness', 'Banish Enchantment', { type: 'wait', durationMs: 600 }, 'Resist the Darkness'],
    {
      selectedLegends: [LEGEND.DEMON, LEGEND.ASSASSIN],
      startingLegend: LEGEND.DEMON,
      initialEnergy: 100
    }
  );
  const empoweredPulses = empowered.events.filter(
    (event) => event.type === 'condition' && event.skillName === 'Embrace the Darkness' && event.condition === 'Torment'
  );

  assert.deepEqual(
    empoweredPulses.map((event) => event.stacks),
    [1, 2]
  );
  assert.equal(empowered.endState.profession.activeUpkeeps.length, 0);

  const freeSkill = simulate(
    'Core',
    ['Embrace the Darkness', 'Shattershot', { type: 'wait', durationMs: 600 }, 'Resist the Darkness'],
    {
      primaryWeapon: 'Shortbow',
      secondaryWeapon: '',
      selectedLegends: [LEGEND.DEMON, LEGEND.ASSASSIN],
      startingLegend: LEGEND.DEMON,
      initialEnergy: 100
    }
  );

  // Embrace empowerment is earned only by spending Energy, not by merely casting a skill.
  assert.deepEqual(
    freeSkill.events
      .filter(
        (event) =>
          event.type === 'condition' && event.skillName === 'Embrace the Darkness' && event.condition === 'Torment'
      )
      .map((event) => event.stacks),
    [1, 1]
  );
});

test('Dwarf skills resolve reinforcement pulses and hammer hit rate', () => {
  const road = simulate(
    'Core',
    ['Inspiring Reinforcement'],
    {
      selectedLegends: [LEGEND.DWARF, LEGEND.ASSASSIN],
      startingLegend: LEGEND.DWARF,
      initialEnergy: 100
    },
    observationTail(5000)
  );

  assert.ok(
    road.events.some(
      (event) => event.type === 'damage' && event.skillName === 'Inspiring Reinforcement' && event.coefficient === 1.5
    )
  );
  assert.ok(
    road.events.some(
      (event) => event.skillName === 'Inspiring Reinforcement' && event.condition === 'Weakness' && event.duration === 6
    )
  );
  assert.deepEqual(
    road.events
      .filter(
        (event) => event.type === 'buff' && event.skillName === 'Inspiring Reinforcement' && event.kind === 'stability'
      )
      .map((event) => [event.at, event.duration]),
    [
      [0.25, 3],
      [0.75, 3],
      [1.75, 3],
      [2.75, 3],
      [3.75, 3],
      [4.75, 3]
    ]
  );

  const engagement = simulate('Core', ['Forced Engagement'], {
    selectedLegends: [LEGEND.DWARF, LEGEND.ASSASSIN],
    startingLegend: LEGEND.DWARF,
    initialEnergy: 100
  });

  assert.ok(engagement.events.some((event) => event.type === 'damage' && event.coefficient === 0.5));
  assert.ok(
    engagement.events.some((event) => event.type === 'control' && event.controlKind === 'taunt' && event.duration === 4)
  );
  assert.ok(engagement.events.some((event) => event.condition === 'Slow' && event.duration === 4));

  const hammers = simulate(
    'Core',
    ['Vengeful Hammers', { type: 'wait', durationMs: 1100 }, 'Release Hammers', { type: 'wait', durationMs: 1000 }],
    {
      selectedLegends: [LEGEND.DWARF, LEGEND.ASSASSIN],
      startingLegend: LEGEND.DWARF,
      initialEnergy: 100
    }
  );
  const hammerHits = hammers.events.filter(
    (event) => event.type === 'damage' && event.skillName === 'Vengeful Hammers'
  );

  assert.equal(hammerHits.length, 9);
  assert.ok(hammerHits.every((event) => Math.abs(event.coefficient - 0.2) < 1e-12));
  assert.equal(hammers.endState.profession.activeUpkeeps.length, 0);
});

test('Icerazor packets use player ownership and trigger player equipment', () => {
  const result = simulate('Renegade', ["Icerazor's Ire", { type: 'wait', durationMs: 6000 }], {
    selectedLegends: [LEGEND.RENEGADE, LEGEND.ASSASSIN],
    startingLegend: LEGEND.RENEGADE,
    initialEnergy: 100,
    relic: 'Shackles'
  });

  assert.ok(result.totalDamage > 0);
  assert.ok(
    result.resolvedEvents
      .filter((event) => event.skillName === "Icerazor's Ire")
      .every((event) => event.actorType === 'player')
  );
  assert.deepEqual(
    result.procSteps
      .filter((proc) => proc.type === 'relic_proc' && proc.skill === 'Relic of the Shackles')
      .map((proc) => proc.detail),
    ['tethered', 'damage']
  );
  assert.equal(
    result.resolvedEvents.filter((event) => event.type === 'damage' && event.skillName === 'Relic of the Shackles')
      .length,
    1
  );
  const actionStart = result.steps[0].start / 1000;
  const hits = result.events.filter((event) => event.type === 'damage' && event.skillName === "Icerazor's Ire");

  assert.deepEqual(
    hits.map((event) => Math.round((event.at - actionStart) * 1000)),
    [1020, 1181, 1342]
  );
  assert.equal(
    result.events.find((event) => event.skillName === "Icerazor's Ire" && event.condition === 'Torment').at,
    hits[0].at
  );
  assert.equal(
    result.events.find((event) => event.skillName === "Icerazor's Ire" && event.condition === 'Immobilized').at,
    hits[2].at
  );
});

test('enhanced Icerazor hit traits use its replaced packet timestamps', () => {
  const result = simulate('Renegade', ["Breakrazor's Bastion", "Icerazor's Ire", { type: 'wait', durationMs: 1000 }], {
    selectedLegends: [LEGEND.RENEGADE, LEGEND.ASSASSIN],
    startingLegend: LEGEND.RENEGADE,
    selectedTraitIds: [TRAIT.AMBUSH_COMMANDER, TRAIT.LASTING_LEGACY],
    target: { defiant: true },
    initialEnergy: 100
  });
  const hitTimes = result.events
    .filter((event) => event.type === 'damage' && event.skillName === "Icerazor's Ire")
    .map((event) => event.at);
  const fervorTimes = result.events
    .filter(
      (event) => event.type === 'buff' && event.skillName === 'Ambush Commander' && event.kind === 'kallas-fervor'
    )
    .map((event) => event.at);

  assert.deepEqual(fervorTimes, hitTimes);
});

test('Citadel Orders preserve their packet, pulse, cost, and recharge profiles', () => {
  assert.deepEqual(
    [SKILL.CITADEL_BOMBARDMENT, SKILL.HEROIC_COMMAND, SKILL.ORDERS_FROM_ABOVE].map((id) => {
      const skill = revenantCatalog.skillsById.get(id);

      return [skill.energyCost, skill.cooldown, skill.castTimeMs];
    }),
    [
      [35, 15, 600],
      [10, 10, 500],
      [20, 20, 0]
    ]
  );
  const quickBombardment = simulate('Renegade', ['Citadel Bombardment'], {
    selectedLegends: [LEGEND.RENEGADE, LEGEND.ASSASSIN],
    startingLegend: LEGEND.RENEGADE,
    initialEnergy: 100,
    boons: { quickness: true }
  });

  assert.equal(quickBombardment.steps[0].fullCastMs, 600);
  const bombardment = simulate(
    'Renegade',
    ['Citadel Bombardment', 'Citadel Bombardment'],
    {
      selectedLegends: [LEGEND.RENEGADE, LEGEND.ASSASSIN],
      startingLegend: LEGEND.RENEGADE,
      selectedTraitIds: [TRAIT.VINDICATION],
      initialEnergy: 100
    },
    observationTail(2000)
  );

  assert.deepEqual(
    bombardment.steps.map((step) => [step.start, step.fullCastMs]),
    [
      [0, 600],
      [15600, 600]
    ]
  );
  const firstBombardmentHits = bombardment.events.filter(
    (event) => event.type === 'damage' && event.skillId === SKILL.CITADEL_BOMBARDMENT && event.at < 2
  );

  assert.equal(firstBombardmentHits.length, 10);
  assert.ok(firstBombardmentHits.every((event) => event.coefficient === 0.6));
  assert.deepEqual(
    firstBombardmentHits.map((event) => Math.round(event.at * 1000)),
    [845, 959, 1073, 1159, 1245, 1360, 1447, 1559, 1675, 1796]
  );
  const firstBurns = bombardment.events.filter(
    (event) =>
      event.type === 'condition' &&
      event.skillId === SKILL.CITADEL_BOMBARDMENT &&
      event.at < 2 &&
      event.condition === 'Burning' &&
      event.stacks === 1 &&
      event.duration === 1
  );

  assert.deepEqual(
    firstBurns.map((event) => Math.round(event.at * 1000)),
    firstBombardmentHits.map((event) => Math.round(event.at * 1000))
  );
  assert.equal(
    bombardment.events.filter(
      (event) =>
        event.type === 'control' &&
        event.skillName === 'Vindication' &&
        event.controlKind === 'daze' &&
        event.duration === 1
    ).length,
    2
  );

  const impossibleBombardment = simulate(
    'Renegade',
    ['Citadel Bombardment', 'Swap Legends', 'Impossible Odds', { type: 'wait', durationMs: 2000 }],
    {
      selectedLegends: [LEGEND.RENEGADE, LEGEND.ASSASSIN],
      startingLegend: LEGEND.RENEGADE,
      initialEnergy: 100
    }
  );

  assert.equal(
    impossibleBombardment.resolvedEvents.filter(
      (event) =>
        event.type === 'damage' && event.skillName === 'Impossible Odds' && event.triggeredBy === 'Citadel Bombardment'
    ).length,
    4
  );

  const orders = simulate(
    'Renegade',
    ['Orders from Above'],
    {
      selectedLegends: [LEGEND.RENEGADE, LEGEND.ASSASSIN],
      startingLegend: LEGEND.RENEGADE,
      initialEnergy: 100
    },
    observationTail(3000)
  );

  assert.equal(orders.steps[0].fullCastMs, 0);
  assert.deepEqual(
    orders.events
      .filter(
        (event) => event.type === 'buff' && event.skillId === SKILL.ORDERS_FROM_ABOVE && event.kind === 'alacrity'
      )
      .map((event) => [event.at, event.duration, event.stacks]),
    [
      [0, 2, 1],
      [1, 2, 1],
      [2, 2, 1],
      [3, 2, 1]
    ]
  );

  const righteous = simulate(
    'Renegade',
    ['Orders from Above'],
    {
      selectedLegends: [LEGEND.RENEGADE, LEGEND.ASSASSIN],
      startingLegend: LEGEND.RENEGADE,
      selectedTraitIds: [TRAIT.RIGHTEOUS_REBEL],
      initialEnergy: 100
    },
    observationTail(5000)
  );

  assert.deepEqual(
    righteous.events
      .filter(
        (event) => event.type === 'buff' && event.skillId === SKILL.ORDERS_FROM_ABOVE && event.kind === 'alacrity'
      )
      .map((event) => event.at),
    [0, 1, 2, 3, 4, 5]
  );
});

test("Kalla's Fervor chart uses the Renegade stack cap", () => {
  const effectPresentations = revenantProfession.ui.effectPresentations({
    specialization: 'Renegade',
    catalog: revenantProfession.catalog
  });
  const series = buildChartSeries(
    {
      duration: 2,
      events: Array.from({ length: 7 }, (_, index) => ({
        type: 'buff',
        at: index * 0.01,
        kind: 'kallas-fervor',
        duration: 8,
        stacks: 1,
        resolvedAudience: PLAYER_AUDIENCE
      }))
    },
    100,
    effectPresentations
  );

  assert.equal(Math.max(...series.effects["Kalla's Fervor"].map((point) => point.v)), 5);
});

test("Kalla's Fervor stacks, refreshes, and improves with Lasting Legacy", () => {
  const config = {
    selectedLegends: [LEGEND.RENEGADE, LEGEND.ASSASSIN],
    startingLegend: LEGEND.RENEGADE,
    selectedTraitIds: [TRAIT.AMBUSH_COMMANDER],
    target: { defiant: true },
    initialEnergy: 100
  };
  const base = simulate('Renegade', ['Citadel Bombardment', 'Heroic Command'], config);

  assert.equal(base.endState.profession.kallasFervor.length, 5);
  assert.deepEqual(
    base.endState.profession.kallasFervor.map((application) => Math.round(application.expiresAt * 1000)),
    [9100, 9100, 9100, 9159, 9245]
  );
  assert.ok(
    base.events.some(
      (event) =>
        event.type === 'buff' &&
        event.skillId === SKILL.HEROIC_COMMAND &&
        event.kind === 'might' &&
        event.stacks === 6 &&
        event.duration === 8
    )
  );

  const improved = simulate('Renegade', ['Citadel Bombardment', 'Heroic Command'], {
    ...config,
    selectedTraitIds: [TRAIT.AMBUSH_COMMANDER, TRAIT.LASTING_LEGACY]
  });

  assert.deepEqual(
    improved.endState.profession.kallasFervor.map((application) => Math.round(application.expiresAt * 1000)),
    [13100, 13100, 13100, 13159, 13245]
  );
  assert.ok(
    improved.events.some(
      (event) =>
        event.type === 'buff' &&
        event.skillId === SKILL.HEROIC_COMMAND &&
        event.kind === 'might' &&
        event.stacks === 9 &&
        event.duration === 8
    )
  );

  const siphon = simulate(
    'Renegade',
    ['Citadel Bombardment', { type: 'wait', durationMs: 2100 }, "Soulcleave's Summit", 'Shattershot'],
    {
      ...config,
      selectedTraitIds: [TRAIT.AMBUSH_COMMANDER, TRAIT.LASTING_LEGACY]
    }
  ).resolvedEvents.find((event) => event.skillName === "Soulcleave's Summit" && /Life Siphon/.test(event.name));

  assert.equal(siphon.flatStrikeMultiplier, 1.15);

  const nourishment = simulate('Renegade', ['Citadel Bombardment', { type: 'wait', durationMs: 2100 }, 'Shattershot'], {
    ...config,
    food: 'Cilantro Lime Sous-Vide Steak',
    stats: { precision: 3100 },
    selectedTraitIds: [TRAIT.AMBUSH_COMMANDER, TRAIT.LASTING_LEGACY]
  })
    .resolvedEvents.filter((event) => event.skillName === 'Nourishment')
    .at(-1);

  // The deterministic food proc occurs on Citadel Bombardment's second hit,
  // while two Kalla's Fervor stacks are active. The direct modifier checks
  // below cover the fully stacked Lasting Legacy multiplier.
  assert.equal(nourishment.flatStrikeMultiplier, 1.06);
  assert.ok(Math.abs(nourishment.damage - 344.5) < 1e-9);

  const modifierContext = (selectedTraitIds, condition = null) => ({
    config: { specialization: 'Renegade', selectedTraitIds, boons: {} },
    event: { actorType: 'player' },
    condition,
    time: 1,
    runtime: {
      profession: {
        core: {
          endurance: 100,
          maximumEndurance: 100
        },
        specialization: {
          kind: 'Renegade',
          state: {
            kallasFervorMaximumStacks: 5,
            kallasFervor: Array.from({ length: 6 }, () => ({
              at: 0,
              expiresAt: 10
            }))
          }
        }
      },
      boons: new Map()
    },
    query: {
      targetHasCondition: () => false,
      targetConditionStacks: () => 0
    }
  });

  assert.equal(revenantAttributeRules.modifyStrikeDamage(modifierContext([]), 1), 1.1);
  assert.equal(revenantAttributeRules.modifyConditionDamage(modifierContext([], 'Burning'), 1), 1.1);
  assert.equal(revenantAttributeRules.modifyStrikeDamage(modifierContext([TRAIT.LASTING_LEGACY]), 1), 1.25);
  assert.equal(
    revenantAttributeRules.modifyConditionDamage(modifierContext([TRAIT.LASTING_LEGACY], 'Burning'), 1),
    1.15
  );
  const additiveContext = modifierContext([
    TRAIT.DESTRUCTIVE_IMPULSES,
    TRAIT.FEROCIOUS_AGGRESSION,
    TRAIT.LASTING_LEGACY
  ]);

  additiveContext.config.boons.fury = true;
  additiveContext.config.secondaryWeapon = 'Sword';
  additiveContext.timeline = {
    activeSigilSetAt: () => ({
      strike: 1.05,
      strikeAdd: 0.05,
      condition: 1.05,
      conditionAdd: 0.05
    })
  };
  assert.equal(revenantAttributeRules.modifyStrikeDamage(additiveContext, 1.05), 1.475);
  additiveContext.condition = 'Burning';
  assert.ok(Math.abs(revenantAttributeRules.modifyConditionDamage(additiveContext, 1.05) - 1.375) < 1e-12);
});

test('Renegade critical traits and Blood Fury use their supplied intervals', () => {
  const critical = simulate('Renegade', ['Phase Traversal'], {
    selectedLegends: [LEGEND.RENEGADE, LEGEND.ASSASSIN],
    startingLegend: LEGEND.ASSASSIN,
    selectedTraitIds: [TRAIT.AMBUSH_COMMANDER, TRAIT.ENDLESS_ENMITY, TRAIT.BLOOD_FURY],
    target: { defiant: false },
    boons: { fury: false },
    stats: { precision: 4000 },
    initialEnergy: 100
  });

  assert.equal(critical.endState.profession.kallasFervor.length, 2);
  assert.ok(
    critical.events.some(
      (event) =>
        event.type === 'buff' && event.skillName === 'Endless Enmity' && event.kind === 'fury' && event.duration === 4
    )
  );

  const bleeding = simulate('Renegade', ['Shattershot'], {
    selectedLegends: [LEGEND.RENEGADE, LEGEND.ASSASSIN],
    startingLegend: LEGEND.RENEGADE,
    selectedTraitIds: [TRAIT.BLOOD_FURY],
    boons: { fury: true }
  }).resolvedEvents.find(
    (event) => event.type === 'condition' && event.skillName === 'Shattershot' && event.condition === 'Bleeding'
  );

  assert.ok(Math.abs(bleeding.naturalExpiresAt - bleeding.at - 3.75) < 1e-9);
  assert.equal(
    revenantAttributeRules.modifyConditionDuration(
      {
        config: {
          specialization: 'Renegade',
          selectedTraitIds: [TRAIT.PACT_OF_PAIN, TRAIT.YEARNING_EMPOWERMENT, TRAIT.BLOOD_FURY],
          boons: { fury: true }
        },
        condition: 'Bleeding',
        time: 1,
        runtime: { boons: new Map() }
      },
      1.2
    ),
    1.7
  );
  assert.equal(
    revenantAttributeRules.modifyConditionDuration(
      {
        config: {
          specialization: 'Renegade',
          selectedTraitIds: [TRAIT.PACT_OF_PAIN],
          attributeProvenance: {
            professionStaticRulesApplied: true
          }
        },
        condition: 'Torment',
        time: 1,
        runtime: { boons: new Map() }
      },
      1.15
    ),
    1.15
  );
});

test('Renegade critical traits consume seeded critical outcomes', () => {
  const run = (seed) =>
    simulate('Renegade', ['Phase Traversal'], {
      selectedLegends: [LEGEND.RENEGADE, LEGEND.ASSASSIN],
      startingLegend: LEGEND.ASSASSIN,
      selectedTraitIds: [TRAIT.AMBUSH_COMMANDER, TRAIT.ENDLESS_ENMITY],
      target: { defiant: false },
      boons: { fury: false },
      stats: { precision: 1945 },
      initialEnergy: 100,
      randomness: { mode: 'stochastic', seed }
    });
  const signature = (result) => {
    const hit = result.events.find((event) => event.type === 'damage' && event.skillName === 'Phase Traversal');
    const ambushCommander = result.events.some(
      (event) => event.type === 'buff' && event.skillName === 'Ambush Commander'
    );
    const endlessEnmity = result.events.some((event) => event.type === 'buff' && event.skillName === 'Endless Enmity');

    assert.equal(ambushCommander, hit.didCrit);
    assert.equal(endlessEnmity, hit.didCrit);

    return [hit.didCrit, ambushCommander, endlessEnmity];
  };

  assert.deepEqual(signature(run(7)), signature(run(7)));
  const criticalOutcomes = new Set();

  for (let seed = 1; seed <= 32; seed += 1) {
    criticalOutcomes.add(signature(run(seed))[0]);
  }

  assert.deepEqual([...criticalOutcomes].sort(), [false, true]);
});

test('Heartpiercer and Brutal Momentum apply multiplicative combat bonuses', () => {
  const context = (traitId, extra = {}) => ({
    config: {
      specialization: 'Renegade',
      selectedTraitIds: [traitId],
      boons: {},
      ...(extra.config || {})
    },
    event: { actorType: 'player' },
    condition: extra.condition,
    time: 1,
    runtime: {
      profession: {},
      boons: new Map(),
      ...(extra.runtime || {})
    },
    query: {
      targetHasCondition: () => true,
      targetConditionStacks: () => 1
    }
  });

  assert.equal(revenantAttributeRules.modifyStrikeDamage(context(TRAIT.HEARTPIERCER), 1), 1.15);
  assert.equal(
    revenantAttributeRules.modifyConditionDamage(context(TRAIT.HEARTPIERCER, { condition: 'Bleeding' }), 1),
    1.25
  );
  assert.equal(
    revenantAttributeRules.modifyCriticalChance(
      context(TRAIT.BRUTAL_MOMENTUM, {
        runtime: {
          profession: { endurance: 100, maximumEndurance: 100 }
        }
      }),
      0.2
    ),
    0.53
  );
  assert.ok(
    Math.abs(
      revenantAttributeRules.modifyCriticalChance(
        context(TRAIT.BRUTAL_MOMENTUM, {
          runtime: {
            profession: { endurance: 50, maximumEndurance: 100 }
          }
        }),
        0.2
      ) - 0.3
    ) < 1e-9
  );
});

describe('Band Together summon enhancement', () => {
  test('keeps base Icerazor timing and packets independent of Quickness', () => {
    const base = simulate(
      'Renegade',
      ["Icerazor's Ire"],
      {
        selectedLegends: [LEGEND.RENEGADE, LEGEND.ASSASSIN],
        startingLegend: LEGEND.RENEGADE,
        initialEnergy: 100
      },
      observationTail(3000)
    );

    assert.equal(base.steps[0].fullCastMs, 520);
    const quickBase = simulate('Renegade', ["Icerazor's Ire"], {
      selectedLegends: [LEGEND.RENEGADE, LEGEND.ASSASSIN],
      startingLegend: LEGEND.RENEGADE,
      initialEnergy: 100,
      boons: { quickness: true }
    });

    assert.equal(quickBase.steps[0].fullCastMs, 520);
    assert.deepEqual(
      base.events
        .filter((event) => event.type === 'damage' && event.skillName === "Icerazor's Ire")
        .map((event) => event.coefficient),
      [2, 2, 2]
    );
    assert.ok(base.events.some((event) => event.condition === 'Immobilized' && event.duration === 2));
    assert.equal(
      base.events.some((event) => event.condition === 'Chilled'),
      false
    );
  });

  test('keeps base Darkrazor timing and outgoing effects', () => {
    const darkrazor = simulate('Renegade', ["Darkrazor's Daring", { type: 'wait', durationMs: 1600 }], {
      selectedLegends: [LEGEND.RENEGADE, LEGEND.ASSASSIN],
      startingLegend: LEGEND.RENEGADE,
      initialEnergy: 100,
      boons: { quickness: true }
    });

    assert.equal(darkrazor.steps[0].fullCastMs, 500);
    assert.deepEqual(
      darkrazor.events
        .filter(
          (event) => event.skillName === "Darkrazor's Daring" && (event.type === 'damage' || event.type === 'control')
        )
        .map((event) => [event.type, Math.round((event.at - darkrazor.steps[0].end / 1000) * 1000), event.actorType]),
      [
        ['damage', 1000, 'player'],
        ['control', 1000, 'player']
      ]
    );
    assert.deepEqual(
      darkrazor.events
        .filter(
          (event) => event.skillName === "Darkrazor's Daring" && event.type === 'buff' && event.kind === 'stability'
        )
        .map((event) => [
          event.duration,
          event.stacks,
          event.audience?.recipients,
          Math.round((event.at - darkrazor.steps[0].end / 1000) * 1000)
        ]),
      [
        [1, 1, 'self', 0],
        [6, 3, 'party', 1000]
      ]
    );
  });

  test('attributes enhanced Razorclaw torment to the player', () => {
    const enhancedRazorclaw = simulate(
      'Renegade',
      ["Icerazor's Ire", "Razorclaw's Rage", { type: 'wait', durationMs: 1000 }],
      {
        selectedLegends: [LEGEND.RENEGADE, LEGEND.ASSASSIN],
        startingLegend: LEGEND.RENEGADE,
        initialEnergy: 100
      }
    );

    assert.equal(
      enhancedRazorclaw.events.find(
        (event) => event.skillName === "Razorclaw's Rage" && event.type === 'condition' && event.condition === 'Torment'
      )?.actorType,
      'player'
    );
  });

  test('makes only the next summon instant and enhanced', () => {
    const enhanced = simulate(
      'Renegade',
      ["Razorclaw's Rage", "Icerazor's Ire", "Darkrazor's Daring", { type: 'wait', durationMs: 1100 }],
      {
        selectedLegends: [LEGEND.RENEGADE, LEGEND.ASSASSIN],
        startingLegend: LEGEND.RENEGADE,
        initialEnergy: 100
      }
    );

    assert.deepEqual(
      enhanced.steps.slice(0, 3).map((step) => step.fullCastMs),
      [500, 0, 500]
    );
    assert.ok(
      enhanced.events.some(
        (event) => event.skillName === "Icerazor's Ire" && event.condition === 'Chilled' && event.duration === 1.5
      )
    );
  });

  test('retains Icerazor packet timing when the enhanced cast is instant', () => {
    const quickEnhanced = simulate(
      'Renegade',
      ["Razorclaw's Rage", "Icerazor's Ire", { type: 'wait', durationMs: 1000 }],
      {
        selectedLegends: [LEGEND.RENEGADE, LEGEND.ASSASSIN],
        startingLegend: LEGEND.RENEGADE,
        initialEnergy: 100,
        boons: { quickness: true }
      },
      observationTail(1000)
    );
    const quickIcerazorHits = quickEnhanced.events.filter(
      (event) => event.type === 'damage' && event.skillName === "Icerazor's Ire"
    );

    assert.deepEqual(
      quickIcerazorHits.map((event) => Math.round((event.at - quickEnhanced.steps[1].start / 1000) * 1000)),
      [1200, 1361, 1522]
    );
    assert.ok(
      quickEnhanced.events
        .filter((event) => event.skillName === "Icerazor's Ire" && event.type === 'condition')
        .every((event) => event.actorType === 'player')
    );
    assert.equal(
      quickEnhanced.events.find((event) => event.skillName === "Icerazor's Ire" && event.condition === 'Torment').at,
      quickIcerazorHits[0].at
    );
    assert.equal(
      quickEnhanced.events.find((event) => event.skillName === "Icerazor's Ire" && event.condition === 'Immobilized')
        .at,
      quickIcerazorHits[2].at
    );
    assert.deepEqual(
      quickEnhanced.events
        .filter((event) => event.skillName === "Icerazor's Ire" && event.condition === 'Chilled')
        .map((event) => Math.round((event.at - quickEnhanced.steps[1].start / 1000) * 1000)),
      [1200, 1361, 1522]
    );
  });

  test('adds the enhanced Darkrazor control and party boons', () => {
    const enhancedDarkrazor = simulate(
      'Renegade',
      ["Icerazor's Ire", "Darkrazor's Daring", { type: 'wait', durationMs: 1100 }],
      {
        selectedLegends: [LEGEND.RENEGADE, LEGEND.ASSASSIN],
        startingLegend: LEGEND.RENEGADE,
        initialEnergy: 100
      }
    );

    assert.deepEqual(
      enhancedDarkrazor.steps.slice(0, 2).map((step) => step.fullCastMs),
      [520, 0]
    );
    assert.ok(
      enhancedDarkrazor.events.some(
        (event) =>
          event.skillName === "Darkrazor's Daring" &&
          event.type === 'control' &&
          event.duration === 2 &&
          event.breakbar === 600 &&
          event.bonusDefianceBreak === 400
      )
    );
    assert.deepEqual(
      enhancedDarkrazor.events
        .filter((event) => event.skillName === "Darkrazor's Daring" && event.type === 'buff')
        .map((event) => [event.kind, event.duration, event.stacks, event.audience?.recipients]),
      [
        ['stability', 1, 1, 'self'],
        ['resistance', 4, 1, 'party'],
        ['protection', 4, 1, 'party'],
        ['stability', 6, 3, 'party']
      ]
    );
  });

  test('applies Razorclaw charges to concurrent summon hits', () => {
    const concurrent = simulate(
      'Renegade',
      ["Icerazor's Ire", { name: "Razorclaw's Rage", offset: 100 }],
      {
        selectedLegends: [LEGEND.RENEGADE, LEGEND.ASSASSIN],
        startingLegend: LEGEND.RENEGADE,
        initialEnergy: 100
      },
      observationTail(2000)
    );

    assert.deepEqual(
      concurrent.steps.map((step) => [step.start, step.fullCastMs]),
      [
        [0, 520],
        [100, 0]
      ]
    );
    // Every eligible hit consumes one charge at its hit time; Razorclaw has no internal cooldown.
    assert.deepEqual(
      concurrent.events
        .filter(
          (event) =>
            event.type === 'condition' &&
            event.skillName === "Razorclaw's Rage" &&
            event.stacks === 1 &&
            !event.triggeredByAlly
        )
        .map((event) => Math.round(event.at * 1000)),
      [1020, 1181, 1342]
    );
  });

  test('marks the next summon as instant in the palette', () => {
    const primed = simulate('Renegade', ["Icerazor's Ire"], {
      selectedLegends: [LEGEND.RENEGADE, LEGEND.ASSASSIN],
      startingLegend: LEGEND.RENEGADE,
      initialEnergy: 100
    });
    const razorclaw = revenantCatalog.skillsByName.get("Razorclaw's Rage");

    assert.equal(
      paletteSkillIsInstant(
        { profession: revenantProfession },
        {
          professionState: primed.endState.profession,
          time: primed.endState.time / 1000
        },
        razorclaw
      ),
      true
    );
  });
});

test('enhanced Renegade summons do not rearm Band Together', () => {
  const result = simulate(
    'Renegade',
    ["Breakrazor's Bastion", "Icerazor's Ire", 'Swap Legends', 'Swap Legends', "Icerazor's Ire"],
    {
      selectedLegends: [LEGEND.RENEGADE, LEGEND.ASSASSIN],
      startingLegend: LEGEND.RENEGADE,
      initialEnergy: 100
    }
  );

  assert.deepEqual([result.steps[1].fullCastMs, result.steps[4].fullCastMs], [0, 520]);
});

test('Band Together expires four seconds after the priming summon', () => {
  const config = {
    selectedLegends: [LEGEND.RENEGADE, LEGEND.ASSASSIN],
    startingLegend: LEGEND.RENEGADE,
    initialEnergy: 100
  };
  const withinWindow = simulate(
    'Renegade',
    ["Icerazor's Ire", { type: 'wait', durationMs: 3999 }, "Darkrazor's Daring"],
    config
  );
  const atExpiry = simulate(
    'Renegade',
    ["Icerazor's Ire", { type: 'wait', durationMs: 4000 }, "Darkrazor's Daring"],
    config
  );

  assert.equal(withinWindow.steps[2].fullCastMs, 0);
  assert.equal(atExpiry.steps[2].fullCastMs, 500);
});

test('All for One refunds Energy and halves enhanced-skill recharge', () => {
  const result = simulate('Renegade', ["Razorclaw's Rage", "Icerazor's Ire", "Icerazor's Ire"], {
    selectedLegends: [LEGEND.RENEGADE, LEGEND.ASSASSIN],
    startingLegend: LEGEND.RENEGADE,
    selectedTraitIds: [TRAIT.ALL_FOR_ONE],
    initialEnergy: 100
  });

  assert.equal(result.steps[2].start, 5500);
  const refunds = result.events.filter((event) => event.type === 'revenant.state' && event.reason === 'all-for-one');

  assert.equal(refunds.length, 1);
  assert.equal(refunds[0].state.energy, 65);
});

test("Razorclaw models party procs with the Revenant's condition stats", () => {
  const result = simulate(
    'Renegade',
    ["Razorclaw's Rage"],
    {
      selectedLegends: [LEGEND.RENEGADE, LEGEND.ASSASSIN],
      startingLegend: LEGEND.RENEGADE,
      initialEnergy: 100,
      allies: { count: 4, strikesPerSecond: 1 },
      stats: { conditionDamage: 1500, expertise: 300 }
    },
    observationTail(5000)
  );
  const partyBuff = result.events.find((event) => event.type === 'buff' && event.kind === 'razorclaws-rage');

  assert.equal(partyBuff.stacks, 4);
  assert.equal(partyBuff.duration, 5);
  assert.equal(partyBuff.resolvedAudience.recipientCount, 5);
  assert.equal(partyBuff.resolvedAudience.alliedPlayerCount, 4);
  assert.deepEqual(partyBuff.resolvedAudience.companionIds, []);
  assert.equal(partyBuff.resolvedAudience.includesSummons, false);
  const personalPackets = result.resolvedEvents.filter(
    (event) =>
      event.skillName === "Razorclaw's Rage" &&
      !event.triggeredByAlly &&
      (event.type === 'damage' || event.type === 'condition')
  );

  assert.ok(personalPackets.length > 0);
  assert.ok(personalPackets.every((event) => event.actorType === 'player'));
  const allyBleeds = result.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.skillName === "Razorclaw's Rage" && event.triggeredByAlly
  );

  assert.equal(allyBleeds.length, 16);
  assert.ok(
    allyBleeds.every((event) => event.stacks === 1 && Math.abs(event.naturalExpiresAt - event.at - 3.6) < 1e-9)
  );
});

test('Soulcleave procs both damage packets and recharges from dismissal', () => {
  const result = simulate(
    'Renegade',
    [
      "Soulcleave's Summit",
      "Icerazor's Ire",
      { type: 'wait', durationMs: 1100 },
      'Dismiss Lieutenant Soulcleave',
      "Soulcleave's Summit"
    ],
    {
      selectedLegends: [LEGEND.RENEGADE, LEGEND.ASSASSIN],
      startingLegend: LEGEND.RENEGADE,
      initialEnergy: 100,
      allies: { count: 2, strikesPerSecond: 1 }
    }
  );
  const procs = result.resolvedEvents.filter(
    (event) => event.skillName === "Soulcleave's Summit" && /Additional Strike|Life Siphon/.test(event.name)
  );

  assert.ok(procs.some((event) => event.coefficient === 0.8));
  assert.ok(procs.some((event) => event.flatStrikePowerCoeff === 0.1));
  const dismiss = result.steps.find((step) => step.skill === 'Dismiss Lieutenant Soulcleave');

  assert.equal(result.steps.at(-1).start, dismiss.end + 3000);
});

test('Assassin buffs trigger on hit and upkeep releases own their cooldowns', () => {
  const daggers = simulate('Core', ['Enchanted Daggers', 'Phase Traversal', { type: 'wait', durationMs: 1000 }], {
    selectedLegends: [LEGEND.ASSASSIN, LEGEND.DEMON],
    startingLegend: LEGEND.ASSASSIN,
    initialEnergy: 100
  });
  const siphon = daggers.resolvedEvents.find((event) => event.skillName === 'Enchanted Daggers');

  assert.equal(siphon.at, 1.5);
  assert.equal(siphon.flatStrikeBase, 1028);
  assert.equal(siphon.flatStrikePowerCoeff, 0.06);
  assert.equal(daggers.endState.profession.enchantedDaggers.charges, 5);

  const odds = simulate('Core', ['Impossible Odds', 'Phase Traversal', 'Relinquish Power', 'Impossible Odds'], {
    selectedLegends: [LEGEND.ASSASSIN, LEGEND.DEMON],
    startingLegend: LEGEND.ASSASSIN,
    initialEnergy: 100
  });

  assert.equal(odds.steps.at(-1).start, 1500);
  assert.ok(
    odds.resolvedEvents.some(
      (event) => event.skillName === 'Impossible Odds' && event.coefficient === 0.65 && event.at === 0.75
    )
  );

  const oddsWithAir = simulate('Core', ['Impossible Odds', 'Phase Traversal', { type: 'wait', durationMs: 1000 }], {
    selectedLegends: [LEGEND.ASSASSIN, LEGEND.DEMON],
    startingLegend: LEGEND.ASSASSIN,
    initialEnergy: 100,
    stats: {
      precision: 1000,
      criticalChanceBonus: 45
    },
    sigilSets: [
      { names: ['Air'], strike: 1, condition: 1 },
      { names: [], strike: 1, condition: 1 }
    ]
  });

  assert.deepEqual(
    oddsWithAir.resolvedEvents
      .filter((event) => event.skillName === 'Impossible Odds')
      .map((event) => [event.at, event.triggeredBy]),
    [
      [0.75, 'Phase Traversal'],
      [1, 'Sigil of Air']
    ]
  );
  assert.ok(
    oddsWithAir.resolvedEvents.some(
      (event) => event.skillName === 'Sigil of Air' && event.triggeredBy === 'Impossible Odds'
    )
  );

  const starved = simulate('Core', ['Impossible Odds', { type: 'wait', durationMs: 1100 }], {
    selectedLegends: [LEGEND.ASSASSIN, LEGEND.DEMON],
    startingLegend: LEGEND.ASSASSIN,
    initialEnergy: 6
  });
  const impossible = revenantCatalog.skillsByName.get('Impossible Odds');

  assert.equal(starved.schedulerState.cooldowns.get(impossible.id), 5);
  assert.equal(starved.endState.profession.activeUpkeeps.length, 0);

  const jade = revenantCatalog.skillsByName.get('Jade Winds');

  assert.equal(jade.effects[0].coefficient, 3);
  assert.equal(jade.effects[1].stacks, 6);
  assert.equal(jade.energyCost, 35);
  assert.equal(jade.cooldown, 10);
});

test('Alliance Tactics switches the legal Vindicator skill side', () => {
  const result = simulate('Vindicator', ["Nomad's Advance", 'Alliance Tactics', 'Tree Song'], {
    selectedLegends: [LEGEND.ALLIANCE, LEGEND.ASSASSIN],
    startingLegend: LEGEND.ALLIANCE,
    initialEnergy: 100
  });

  assert.equal(result.warnings.length, 0);
  assert.equal(result.endState.profession.allianceSide, 'kurzick');
});

test('Vindicator Luxon skills use supplied combat mechanics', () => {
  const skill = (name) => revenantCatalog.skillsByName.get(name);
  const nomad = skill("Nomad's Advance");

  assert.equal(nomad.cooldown, 3);
  assert.equal(nomad.energyCost, 10);
  assert.equal(nomad.castTimeMs, 960);
  assert.equal(nomad.quicknessCastTimeMs, undefined);
  assert.equal(nomad.unaffectedByQuickness, true);
  assert.equal(strikeCoefficient(nomad.effects[0]), 4);
  assert.deepEqual(
    nomad.effects.slice(1).map((effect) => [effect.boon, effect.stacks, effect.duration]),
    [['might', 1, 6]]
  );

  const scavenger = skill('Scavenger Burst');

  assert.equal(scavenger.cooldown, 3);
  assert.equal(scavenger.energyCost, 15);
  assert.equal(scavenger.effects[0].coefficient, 2.25);
  assert.deepEqual(
    scavenger.effects.slice(1).map((effect) => [effect.condition ?? effect.boon, effect.stacks, effect.duration]),
    [
      ['Burning', 2, 5],
      ['quickness', 1, 5],
      ['fury', 1, 5]
    ]
  );

  const rage = skill("Reaver's Rage");

  assert.equal(rage.cooldown, 10);
  assert.equal(rage.energyCost, 15);
  assert.equal(rage.effects[0].coefficient, 2.22);
  assert.deepEqual(
    rage.effects.filter((effect) => effect.boon === 'stability').map((effect) => [effect.stacks, effect.duration]),
    [
      [1, 1],
      [1, 6]
    ]
  );
  assert.equal(rage.effects.at(-1).controlKind, 'daze');

  const spear = skill('Spear of Archemorus');

  assert.equal(spear.cooldown, 12);
  assert.equal(spear.energyCost, 20);
  assert.equal(spear.castTimeMs, 720);
  assert.equal(spear.quicknessCastTimeMs, 480);
  assert.equal(strikeCoefficient(spear.effects[0]), 5);
  assert.equal(spear.effects[0].ticks[0].atMs, 2960);
  assert.equal(spear.effects[0].timingAnchor, 'castEnd');
  assert.equal(spear.effects[1].ticks[0].condition, 'Torment');
  assert.equal(spear.effects[1].ticks[0].stacks, 5);

  const normal = simulate('Vindicator', ['Spear of Archemorus', { name: '__wait', waitMs: 4000 }], {
    selectedLegends: [LEGEND.ALLIANCE, LEGEND.ASSASSIN],
    startingLegend: LEGEND.ALLIANCE,
    initialEnergy: 100
  });
  const quick = simulate('Vindicator', ['Spear of Archemorus'], {
    selectedLegends: [LEGEND.ALLIANCE, LEGEND.ASSASSIN],
    startingLegend: LEGEND.ALLIANCE,
    initialEnergy: 100,
    boons: { quickness: true }
  });

  assert.equal(normal.steps[0].fullCastMs, 720);
  assert.equal(quick.steps[0].fullCastMs, 480);
  assert.ok(
    Math.abs(
      normal.events.find((event) => event.type === 'damage' && event.skillName === 'Spear of Archemorus')?.at - 3.68
    ) < 1e-12
  );
});

test('Vindicator dodge traits apply current endurance and damage behavior', () => {
  const config = {
    selectedLegends: [LEGEND.ALLIANCE, LEGEND.ASSASSIN],
    startingLegend: LEGEND.ALLIANCE,
    selectedTraitIds: [TRAIT.LEVIATHAN_STRENGTH, TRAIT.REAVERS_CURSE, TRAIT.FORERUNNER_OF_DEATH],
    initialEnergy: 100,
    boons: { quickness: true, alacrity: true, vigor: true }
  };
  const result = simulate('Vindicator', ['Dodge', 'Energy Meld', 'Dodge'], config);
  const dodges = result.events.filter((event) => event.type === 'damage' && event.skillName === 'Death Drop');
  const meld = result.steps.find((step) => step.skill === 'Energy Meld');

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(
    dodges.map((event) => event.coefficient),
    [3.3, 6.6]
  );
  assert.deepEqual(
    dodges.map((event) => event.at),
    [0.16, 0.8]
  );
  assert.equal(
    revenantAttributeRules.modifyStrikeDamage(
      {
        config: {
          specialization: 'Vindicator',
          selectedTraitIds: [TRAIT.FEROCIOUS_AGGRESSION, TRAIT.FORERUNNER_OF_DEATH],
          boons: { fury: true }
        },
        event: {
          actorType: 'player',
          forerunnerOfDeathActive: true
        },
        time: 1,
        runtime: { profession: {} }
      },
      1
    ),
    1.35
  );
  assert.equal(result.steps[0].fullCastMs, 200);
  assert.equal(meld.fullCastMs, 440);
  assert.equal(result.endState.cooldowns['Energy Meld'].readyAt, meld.end + 8000);
  assert.ok(
    result.events.some(
      (event) => event.type === 'buff' && event.kind === 'forerunner-of-death' && event.duration === 10
    )
  );
});

test('Vindicator Dodge waits for the exact endurance recharge time', () => {
  const withoutVigor = simulate('Vindicator', ['Dodge', 'Dodge', 'Dodge'], {
    selectedLegends: [LEGEND.ALLIANCE, LEGEND.ASSASSIN],
    startingLegend: LEGEND.ALLIANCE,
    boons: { vigor: false }
  });
  const withVigor = simulate('Vindicator', ['Dodge', 'Dodge', 'Dodge'], {
    selectedLegends: [LEGEND.ALLIANCE, LEGEND.ASSASSIN],
    startingLegend: LEGEND.ALLIANCE,
    boons: { vigor: true }
  });

  assert.deepEqual(withoutVigor.warnings, []);
  assert.deepEqual(
    withoutVigor.steps.map((step) => step.start),
    [0, 200, 10000]
  );
  assert.deepEqual(withVigor.warnings, []);
  assert.deepEqual(
    withVigor.steps.map((step) => step.start),
    [0, 200, 6667]
  );
});

test('Vindicator resource display includes live endurance', () => {
  const core = revenantProfession.ui.resourceViews({
    specialization: 'Core',
    professionState: { energy: 40.9, endurance: 25, maximumEndurance: 100 }
  });
  const conduit = revenantProfession.ui.resourceViews({
    specialization: 'Conduit',
    professionState: { energy: 40, affinity: 3 }
  });
  const vindicator = revenantProfession.ui.resourceViews({
    specialization: 'Vindicator',
    professionState: { energy: 40, endurance: 25, maximumEndurance: 100 }
  });

  assert.deepEqual(
    core.map((view) => view.id),
    ['energy']
  );
  assert.equal(core.find((view) => view.id === 'energy').value, 40);
  assert.deepEqual(
    conduit.map((view) => view.id),
    ['energy', 'affinity']
  );
  assert.deepEqual(
    conduit.find((view) => view.id === 'affinity'),
    {
      id: 'affinity',
      singular: 'affinity',
      plural: 'affinity',
      maximum: 5,
      value: 3,
      canStart: false,
      step: 1,
      displayMode: 'pips',
      pipStyle: 'revenant-affinity',
      shortLabel: 'Aff',
      statusLabel: 'Current'
    }
  );
  assert.deepEqual(
    vindicator.map((view) => view.id),
    ['energy', 'endurance']
  );
  assert.deepEqual(
    vindicator.find((view) => view.id === 'endurance'),
    {
      id: 'endurance',
      singular: 'endurance',
      plural: 'endurance',
      maximum: 100,
      value: 25,
      canStart: false,
      step: 1,
      displayMode: 'bar',
      pipStyle: 'endurance',
      paletteSkillId: -5,
      shortLabel: 'End',
      statusLabel: 'Current'
    }
  );
});

test('Vindicator dodges reset interrupted autoattack chains', () => {
  const result = simulate('Vindicator', ['Preparation Thrust', 'Dodge', 'Preparation Thrust'], {
    selectedLegends: [LEGEND.ALLIANCE, LEGEND.ASSASSIN],
    startingLegend: LEGEND.ASSASSIN,
    primaryWeapon: 'Sword',
    secondaryWeapon: 'Sword',
    boons: { vigor: true }
  });

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(
    result.steps.map((step) => step.skill),
    ['Preparation Thrust', 'Dodge', 'Preparation Thrust']
  );
});

test('Sigil of Energy restores 50 endurance on Revenant legend swap', () => {
  const result = simulate('Vindicator', ['__combat_start', 'Dodge', 'Swap Legends', 'Dodge'], {
    selectedLegends: [LEGEND.ASSASSIN, LEGEND.ALLIANCE],
    startingLegend: LEGEND.ASSASSIN,
    sigilSets: [{ names: ['Energy'] }, { names: [] }]
  });
  const energyProc = result.events.find((event) => event.type === 'proc' && event.name === 'Sigil of Energy');
  const enduranceGain = result.events.find((event) => event.type === 'resource' && event.sourceId === 'sigil.energy');
  const dodgeStates = result.events.filter((event) => event.type === 'revenant.state' && event.reason === 'dodge');

  assert.deepEqual(result.warnings, []);
  assert.equal(energyProc.sourceSkill, 'Swap Legends');
  assert.equal(enduranceGain.amount, 50);
  assert.equal(dodgeStates.length, 2);
  assert.equal(dodgeStates[1].state.endurance, 50);
});

test('Call of the Alliance grants five endurance plus three per hit', () => {
  const result = simulate('Vindicator', ['Dodge', 'Swap Legends'], {
    selectedLegends: [LEGEND.ASSASSIN, LEGEND.ALLIANCE],
    startingLegend: LEGEND.ASSASSIN,
    selectedTraitIds: [TRAIT.SONG_OF_THE_MISTS]
  });
  const swapState = result.events.find((event) => event.type === 'revenant.state' && event.reason === 'legend-swap');

  const call = revenantCatalog.skillsById.get(SKILL.CALL_OF_THE_ALLIANCE);

  assert.equal(call.resourceGain, 8);
  assert.equal(call.effects[0].coefficient, 0.93);
  assert.ok(result.events.some((event) => event.type === 'damage' && event.name === 'Call of the Alliance'));
  assert.equal(swapState.state.endurance, 59);
});

test('Vindicator Dodge + Auto palette action uses the current chain step', () => {
  let changeCount = 0;
  const app = {
    profession: revenantProfession,
    skills: revenantCatalog.skills,
    skillById: revenantCatalog.skillsById,
    skillByName: revenantCatalog.skillsByName,
    results: {
      endState: {
        activeWeaponSet: 1,
        profession: { autoattackChains: {} }
      }
    },
    build: {
      weapons: ['Sword', 'Sword'],
      alternateWeapons: ['Greatsword', ''],
      startingWeaponSet: 1,
      rotation: []
    },
    adapter: {
      eliteSpecialization: () => 'Vindicator',
      isSkillAvailable: () => true
    },
    changed: () => {
      changeCount += 1;
    }
  };

  assert.equal(currentAutoattackSkill(app).name, 'Preparation Thrust');
  const paletteSkill = paletteActionSkills(app, 'Vindicator').find(
    (skill) => skill.name === VINDICATOR_DODGE_AUTO_ACTION
  );

  assert.equal(paletteSkill.name, VINDICATOR_DODGE_AUTO_ACTION);
  assert.equal(paletteSkillView(app, paletteSkill).draggable, true);
  assert.deepEqual(
    vindicatorDodgeAutoRotationEntries({
      specialization: 'Vindicator',
      activeAutoattack: currentAutoattackSkill(app)
    }),
    [
      {
        type: 'cast',
        skillId: SKILL.PREPARATION_THRUST
      },
      {
        type: 'cast',
        skillId: -5,
        concurrentOffsetMs: 0
      }
    ]
  );
  const firstInsertion = resolvePaletteDropItem(app, VINDICATOR_DODGE_AUTO_ACTION);

  assert.deepEqual(firstInsertion, [
    {
      type: 'cast',
      skillId: SKILL.PREPARATION_THRUST
    },
    {
      type: 'cast',
      skillId: -5,
      concurrentOffsetMs: 0
    }
  ]);
  assert.equal(insertRotationItems(app, firstInsertion), true);
  assert.deepEqual(app.build.rotation, [
    {
      type: 'cast',
      skillId: SKILL.PREPARATION_THRUST
    },
    {
      type: 'cast',
      skillId: -5,
      concurrentOffsetMs: 0
    }
  ]);
  assert.equal(changeCount, 1);

  app.build.rotation = [{ type: 'cast', skillId: 'Tail' }];
  app.rotationInsertionIndex = 0;
  const secondInsertion = resolvePaletteDropItem(app, VINDICATOR_DODGE_AUTO_ACTION);

  assert.equal(insertRotationItems(app, secondInsertion), true);
  assert.deepEqual(app.build.rotation, [
    {
      type: 'cast',
      skillId: SKILL.PREPARATION_THRUST
    },
    {
      type: 'cast',
      skillId: -5,
      concurrentOffsetMs: 0
    },
    { type: 'cast', skillId: 'Tail' }
  ]);
  assert.equal(app.rotationInsertionIndex, 2);
  assert.equal(changeCount, 2);

  app.results.endState.profession.autoattackChains[SKILL.PREPARATION_THRUST] = SKILL.BRUTAL_BLADE;
  assert.equal(currentAutoattackSkill(app).name, 'Brutal Blade');

  const combined = simulate(
    'Vindicator',
    ['Preparation Thrust', 'Brutal Blade', { name: 'Dodge', skillId: -5, offset: 0 }],
    {
      selectedLegends: [LEGEND.ALLIANCE, LEGEND.ASSASSIN],
      startingLegend: LEGEND.ASSASSIN,
      primaryWeapon: 'Sword',
      secondaryWeapon: 'Sword'
    }
  );

  assert.deepEqual(combined.warnings, []);
  assert.equal(combined.steps[1].start, combined.steps[2].start);
});

test('Vindicator legend skills preserve the Greatsword autoattack chain', () => {
  const result = simulate('Vindicator', ['Mist Swing', 'Mist Slash', 'Spear of Archemorus', 'Arcing Mists'], {
    selectedLegends: [LEGEND.ALLIANCE, LEGEND.ASSASSIN],
    startingLegend: LEGEND.ALLIANCE,
    primaryWeapon: 'Greatsword',
    secondaryWeapon: '',
    initialEnergy: 100
  });

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(
    result.steps.map((step) => step.skill),
    ['Mist Swing', 'Mist Slash', 'Spear of Archemorus', 'Arcing Mists']
  );
});

test('Imperial Guard is ordered before True Strike and defaults to an 80ms cancel', () => {
  const paletteApp = {
    profession: revenantProfession,
    skills: revenantCatalog.skills,
    build: {
      weapons: ['Greatsword', ''],
      alternateWeapons: ['Sword', 'Sword']
    },
    adapter: {
      eliteSpecialization: () => 'Vindicator',
      isSkillAvailable: () => true
    }
  };

  assert.deepEqual(
    weaponSkills(paletteApp)
      .filter((skill) => skill.slot === 'Weapon_4')
      .map((skill) => skill.name),
    ['Imperial Guard', 'True Strike']
  );

  const config = {
    selectedLegends: [LEGEND.ALLIANCE, LEGEND.ASSASSIN],
    startingLegend: LEGEND.ALLIANCE,
    initialEnergy: 100,
    primaryWeapon: 'Greatsword',
    secondaryWeapon: ''
  };
  const canceledIntoStrike = simulate('Vindicator', ['Imperial Guard', 'True Strike'], config);

  assert.deepEqual(canceledIntoStrike.warnings, []);
  assert.equal(canceledIntoStrike.steps[0].fullCastMs, 2000);
  assert.equal(canceledIntoStrike.steps[0].end, 80);
  assert.equal(canceledIntoStrike.steps[0].interrupted, true);
  assert.equal(canceledIntoStrike.steps[1].start, 80);
  assert.equal(
    canceledIntoStrike.events.find((event) => event.skillName === 'Imperial Guard' && event.kind === 'blocking')
      .duration,
    0.08
  );
  assert.equal(
    canceledIntoStrike.events.find((event) => event.skillName === 'True Strike' && event.type === 'damage').coefficient,
    1.5
  );

  const completedChannel = simulate(
    'Vindicator',
    [{ name: 'Imperial Guard', interruptMs: 2000 }, 'True Strike'],
    config
  );

  assert.deepEqual(completedChannel.warnings, []);
  assert.equal(completedChannel.steps[0].interrupted, false);
  assert.equal(completedChannel.steps[1].start, 2000);
  assert.equal(
    completedChannel.events.find((event) => event.skillName === 'Imperial Guard' && event.kind === 'blocking').duration,
    2
  );
});

test('Deathstrike weapon palette keeps the primary skill timing on cooldown', () => {
  const app = {
    profession: revenantProfession,
    skills: revenantCatalog.skills,
    results: {
      endState: {
        time: 720,
        cooldowns: {
          Deathstrike: { readyAt: 12420, remaining: 11700 }
        }
      }
    },
    build: {
      weapons: ['Sword', 'Sword'],
      alternateWeapons: ['', '']
    },
    adapter: {
      eliteSpecialization: () => 'Conduit',
      isSkillAvailable: () => true
    }
  };
  const deathstrike = weaponSkills(app).find((skill) => skill.name === 'Deathstrike');

  assert.equal(deathstrike.id, SKILL.DEATHSTRIKE);
  assert.match(paletteSkillView(app, deathstrike).title, /Cast: 1\.08s/);
  assert.doesNotMatch(paletteSkillView(app, deathstrike).title, /Instant cast/);
});
