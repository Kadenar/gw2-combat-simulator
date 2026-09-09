import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  currentAutoattackSkill,
  paletteActionSkills,
  paletteSkillIsInstant,
  weaponSkills,
  paletteSkillView
} from '#gw2/app/rotation/palette/model.js';
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
import { handleRevenantState } from '#gw2/professions/revenant/state.js';
import { createRenegadeState } from '#gw2/professions/revenant/specializations/renegade/state.js';
import {
  activeKallasFervorStacks,
  castHeroicCommand,
  grantKallasFervor
} from '#gw2/professions/revenant/specializations/renegade/mechanics/kalla-and-band-together.js';

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

test('Ferocious Aggression follows self Fury activation and expiry for strike and condition damage', () => {
  const fury = { at: 1, expiresAt: 2, resolvedAudience: PLAYER_AUDIENCE };
  const context = {
    config: { specialization: 'Core', selectedTraitIds: [TRAIT.FEROCIOUS_AGGRESSION], boons: {} },
    event: { actorType: 'player' },
    condition: 'Burning',
    runtime: { boons: new Map([['fury', [fury]]]) }
  };

  // Only self Fury grants the additive bonus, including both edges of its active window.
  for (const modify of [revenantAttributeRules.modifyStrikeDamage, revenantAttributeRules.modifyConditionDamage]) {
    for (const [time, expected] of [
      [0, 1],
      [1, 1.1],
      [1.5, 1.1],
      [2, 1]
    ]) {
      assert.equal(modify({ ...context, time }, 1), expected);
    }

    fury.resolvedAudience = { ...PLAYER_AUDIENCE, includesSelf: false, alliedPlayerCount: 1 };
    assert.equal(modify({ ...context, time: 1 }, 1), 1);
    fury.resolvedAudience = PLAYER_AUDIENCE;
    assert.equal(modify({ ...context, config: { ...context.config, selectedTraitIds: [] }, time: 1 }, 1), 1);
    assert.equal(modify({ ...context, config: { ...context.config, boons: { fury: true } }, time: 2 }, 1), 1.1);
  }
});

test('Demon attacks apply conditions and control with their impacts', () => {
  // Effects stay tied to their impact even when projectile delays or balance values change.
  const config = { selectedLegends: [LEGEND.DEMON, LEGEND.ASSASSIN], startingLegend: LEGEND.DEMON, initialEnergy: 100 };
  const banish = simulate('Core', ['Banish Enchantment'], config);
  const hits = banish.events.filter((event) => event.type === 'damage' && event.skillName === 'Banish Enchantment');
  assert.deepEqual(banish.warnings, []);
  assert.ok(hits.length > 0);
  for (const condition of ['Chilled', 'Torment']) {
    assert.deepEqual(
      banish.events
        .filter((event) => event.skillName === 'Banish Enchantment' && event.condition === condition)
        .map((event) => event.at),
      hits.map((event) => event.at)
    );
  }

  const anguish = simulate('Core', ['Call to Anguish', 'Unyielding Impact'], config);
  assert.deepEqual(anguish.warnings, []);
  const impact = anguish.events.find((event) => event.type === 'damage' && event.skillName === 'Call to Anguish');
  assert.equal(
    anguish.events.find((event) => event.skillName === 'Call to Anguish' && event.condition === 'Chilled').at,
    impact.at
  );
  assert.equal(
    anguish.events.find((event) => event.skillName === 'Call to Anguish' && event.type === 'control').at,
    impact.at
  );
  assert.deepEqual(
    anguish.events
      .filter((event) => event.type === 'condition' && event.skillName === 'Unyielding Impact')
      .map((event) => event.condition),
    ['Burning', 'Torment', 'Poisoned']
  );
});

test('Ferocious Aggression increases food life steal only while Fury is active', () => {
  // Food is resolver-created flat damage and must receive the same life-steal bonus as skill siphons.
  for (const fury of [false, true]) {
    const result = simulate(
      'Core',
      ['Hammer Bolt', 'Hammer Bolt'],
      {
        primaryWeapon: 'Hammer',
        food: 'Cilantro Lime Sous-Vide Steak',
        stats: { precision: 3100 },
        selectedTraitIds: [TRAIT.FEROCIOUS_AGGRESSION],
        boons: { fury }
      },
      observationTail(1000)
    );
    const food = result.resolvedEvents.find((event) => event.skillName === 'Nourishment');
    assert.ok(food);
    assert.ok(Math.abs(food.damage - (fury ? 357.5 : 325)) < 1e-9);
  }
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

test('Dwarf upkeep stops dealing damage when released', () => {
  // Releasing an upkeep cancels future pulses, independently of its hit rate or coefficients.
  const result = simulate(
    'Core',
    ['Vengeful Hammers', { type: 'wait', durationMs: 1100 }, 'Release Hammers', { type: 'wait', durationMs: 1000 }],
    {
      selectedLegends: [LEGEND.DWARF, LEGEND.ASSASSIN],
      startingLegend: LEGEND.DWARF,
      initialEnergy: 100
    }
  );
  const hits = result.events.filter((event) => event.type === 'damage' && event.skillName === 'Vengeful Hammers');
  const release = result.steps.find((step) => step.skill === 'Release Hammers');
  assert.deepEqual(result.warnings, []);
  assert.ok(hits.length > 0);
  assert.ok(hits.every((event) => event.at <= release.end / 1000));
  assert.equal(result.endState.profession.activeUpkeeps.length, 0);
});

// Use isolated strike times to distinguish the 250 ms ICD from the independent strike delay.
test('Impossible Odds uses a 250 ms interval and 250 ms delay for player-owned strikes', () => {
  const profession = {
    ...revenantProfession,
    resolveRuntime(config) {
      const runtime = revenantProfession.resolveRuntime(config);
      return {
        ...runtime,
        initialize(context) {
          runtime.initialize(context);
          for (const [at, source, actorType] of [
            [1, 'Unlabelled equipment', 'effect'],
            [1.249, 'Relic', 'effect'],
            [1.25, 'Sigil', 'effect'],
            [1.5, 'Player', 'player'],
            [2, 'Summon', 'summon']
          ]) {
            context.emit({
              type: 'damage',
              at,
              coefficient: 1,
              weaponStrength: 1000,
              skillName: source,
              source,
              sourceId: source,
              actorType,
              ownerActorType: 'player'
            });
          }
        }
      };
    }
  };
  const run = createProfessionSimulator(profession, baseConfig);
  const result = run('Core', ['Impossible Odds', { type: 'wait', durationMs: 3000 }], { initialEnergy: 100 });
  assert.deepEqual(
    result.events
      .filter((event) => event.type === 'damage' && event.skillName === 'Impossible Odds')
      .map((event) => [event.at, event.triggeredBy]),
    [
      [1.25, 'Unlabelled equipment'],
      [1.5, 'Sigil'],
      [1.75, 'Player']
    ]
  );
});

// A delayed player-owned Shackles strike remains eligible after swapping into Shiro.
test('Impossible Odds follows Shackles damage while its upkeep is active', () => {
  const result = simulate(
    'Renegade',
    ["Icerazor's Ire", 'Swap Legends', 'Impossible Odds', { type: 'wait', durationMs: 7000 }],
    {
      selectedLegends: [LEGEND.RENEGADE, LEGEND.ASSASSIN],
      startingLegend: LEGEND.RENEGADE,
      initialEnergy: 100,
      relic: 'Shackles'
    }
  );
  const shackles = result.events.find((event) => event.type === 'damage' && event.sourceId === 'relic.shackles');
  const followups = result.events.filter(
    (event) =>
      event.type === 'damage' && event.skillName === 'Impossible Odds' && event.triggeredBy === shackles?.skillName
  );
  assert.ok(shackles);
  assert.equal(followups.length, 1);
  assert.ok(Math.abs(followups[0].at - shackles.at - 0.25) < 1e-12);
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
  const hits = result.events.filter((event) => event.type === 'damage' && event.skillName === "Icerazor's Ire");

  assert.ok(hits.length > 0);
  assert.equal(
    result.events.find((event) => event.skillName === "Icerazor's Ire" && event.condition === 'Torment').at,
    hits[0].at
  );
  assert.equal(
    result.events.find((event) => event.skillName === "Icerazor's Ire" && event.condition === 'Immobilized').at,
    hits.at(-1).at
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

test('Icerazor grants Fervor only after its projectiles land', () => {
  const config = {
    selectedLegends: [LEGEND.RENEGADE, LEGEND.ASSASSIN],
    startingLegend: LEGEND.RENEGADE,
    selectedTraitIds: [TRAIT.AMBUSH_COMMANDER],
    target: { defiant: true }
  };
  // Summoning reserves future impacts; it must not grant their stacks during the cast.
  const pending = simulate('Renegade', ["Icerazor's Ire"], config);
  const landed = simulate('Renegade', ["Icerazor's Ire", { type: 'wait', durationMs: 1000 }], config);
  assert.equal(pending.endState.profession.kallasFervor.length, 0);
  assert.equal(landed.endState.profession.kallasFervor.length, 3);
});

test('Citadel Bombardment burns on each hit and Vindication triggers once per cast', () => {
  const result = simulate(
    'Renegade',
    ['Citadel Bombardment'],
    {
      selectedTraitIds: [TRAIT.VINDICATION],
      initialEnergy: 100
    },
    observationTail(3000)
  );
  const hits = result.events.filter((event) => event.type === 'damage' && event.skillId === SKILL.CITADEL_BOMBARDMENT);
  const burns = result.events.filter(
    (event) => event.skillId === SKILL.CITADEL_BOMBARDMENT && event.condition === 'Burning'
  );
  assert.deepEqual(result.warnings, []);
  assert.ok(hits.length > 1);
  assert.deepEqual(
    burns.map((event) => event.at),
    hits.map((event) => event.at)
  );
  assert.equal(
    result.events.filter(
      (event) => event.type === 'control' && event.skillName === 'Vindication' && event.controlKind === 'daze'
    ).length,
    1
  );
});

test('Righteous Rebel extends Orders from Above with additional alacrity pulses', () => {
  // The trait adds pulses while preserving the base pulse cadence and duration.
  const run = (selectedTraitIds) =>
    simulate('Renegade', ['Orders from Above'], { selectedTraitIds, initialEnergy: 100 }, observationTail(6000));
  const base = run([]);
  const improved = run([TRAIT.RIGHTEOUS_REBEL]);
  const pulses = (result) =>
    result.events
      .filter((event) => event.skillId === SKILL.ORDERS_FROM_ABOVE && event.kind === 'alacrity')
      .map(({ at, duration }) => ({ at, duration }));
  assert.deepEqual(base.warnings, []);
  assert.deepEqual(improved.warnings, []);
  assert.ok(pulses(base).length > 0);
  assert.ok(pulses(improved).length > pulses(base).length);
  assert.deepEqual(pulses(improved).slice(0, pulses(base).length), pulses(base));
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

test("Kalla's Fervor replaces the soonest-expiring stack at its cap", () => {
  for (const improved of [false, true]) {
    const state = createRenegadeState();
    const events = [];
    const context = {
      config: { selectedTraitIds: improved ? [TRAIT.LASTING_LEGACY] : [] },
      catalog: revenantCatalog,
      start: 6,
      effectiveEnd: 6,
      fullEnd: 6,
      epsilon: 1e-9,
      state: { profession: { core: {}, specialization: { kind: 'Renegade', state } } },
      events,
      emit: (event) => events.push(event),
      emitDerived: (_cause, event) => events.push(event)
    };
    const duration = improved ? 12 : 8;
    // A sixth application keeps five stacks alive past the original stack's expiry without refreshing all five.
    for (const at of [0, 1, 2, 3, 4, 5]) {
      assert.equal(grantKallasFervor(context, { at, sourceId: TRAIT.AMBUSH_COMMANDER }), true);
    }

    assert.deepEqual(
      state.kallasFervor.map((application) => application.expiresAt),
      [1, 2, 3, 4, 5].map((at) => at + duration)
    );
    assert.equal(activeKallasFervorStacks(state, duration), 5);
    assert.equal(activeKallasFervorStacks(state, duration + 1), 4);
    // Heroic Command explicitly refreshes every stack, unlike an ordinary capped application.
    castHeroicCommand(context, revenantCatalog.skillsById.get(SKILL.HEROIC_COMMAND));
    assert.deepEqual(
      state.kallasFervor.map((application) => application.expiresAt),
      Array(5).fill(6 + duration)
    );
  }
});

test('Dark projectile life steal receives the live Kalla bonus exactly once', () => {
  // Combo damage is recreated by the resolver; scheduler-only multipliers must not disappear or apply twice.
  for (const [traits, multiplier] of [
    [[TRAIT.AMBUSH_COMMANDER], 1.1],
    [[TRAIT.AMBUSH_COMMANDER, TRAIT.LASTING_LEGACY], 1.15],
    [[TRAIT.AMBUSH_COMMANDER, TRAIT.LASTING_LEGACY, TRAIT.FEROCIOUS_AGGRESSION], 1.25]
  ]) {
    const result = simulate(
      'Renegade',
      ['Citadel Bombardment', { type: 'wait', durationMs: 2100 }, 'Field of the Mists', 'Hammer Bolt'],
      {
        selectedLegends: [LEGEND.RENEGADE, LEGEND.ASSASSIN],
        startingLegend: LEGEND.RENEGADE,
        primaryWeapon: 'Hammer',
        boons: { fury: true },
        selectedTraitIds: traits,
        target: { defiant: true },
        initialEnergy: 100
      },
      observationTail(1000)
    );
    const siphon = result.resolvedEvents.find((event) => event.lifeSiphon && event.parentSkillName === 'Hammer Bolt');
    assert.ok(siphon);
    assert.equal(siphon.flatStrikeMultiplier, multiplier);
    assert.ok(Math.abs(siphon.damage - (202 + 0.03 * 2000) * multiplier) < 1e-9);
  }
});

test("Kalla's Fervor stacks, refreshes, and improves with Lasting Legacy", () => {
  const config = {
    selectedLegends: [LEGEND.RENEGADE, LEGEND.ASSASSIN],
    startingLegend: LEGEND.RENEGADE,
    selectedTraitIds: [TRAIT.AMBUSH_COMMANDER],
    target: { defiant: true },
    initialEnergy: 100
  };
  // Let the projectiles land before testing Heroic Command's full-stack refresh and Might conversion.
  const rotation = ['Citadel Bombardment', { type: 'wait', durationMs: 2000 }, 'Heroic Command'];
  const base = simulate('Renegade', rotation, config);

  assert.equal(base.endState.profession.kallasFervor.length, 5);
  assert.ok(
    base.events.some(
      (event) =>
        event.type === 'buff' &&
        event.skillId === SKILL.HEROIC_COMMAND &&
        event.kind === 'might' &&
        event.stacks === 10 &&
        event.duration === 8
    )
  );

  const improved = simulate('Renegade', rotation, {
    ...config,
    selectedTraitIds: [TRAIT.AMBUSH_COMMANDER, TRAIT.LASTING_LEGACY]
  });

  assert.ok(
    improved.events.some(
      (event) =>
        event.type === 'buff' &&
        event.skillId === SKILL.HEROIC_COMMAND &&
        event.kind === 'might' &&
        event.stacks === 15 &&
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
  // before that hit grants the second Kalla's Fervor stack. The direct modifier checks
  // below cover the fully stacked Lasting Legacy multiplier.
  assert.equal(nourishment.flatStrikeMultiplier, 1.03);
  assert.ok(Math.abs(nourishment.damage - 334.75) < 1e-9);

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
  test('Darkrazor grants self stability before its delayed party effects', () => {
    // The summon owns player effects, with party stability and control arriving on impact.
    const result = simulate(
      'Renegade',
      ["Darkrazor's Daring"],
      {
        selectedLegends: [LEGEND.RENEGADE, LEGEND.ASSASSIN],
        startingLegend: LEGEND.RENEGADE,
        initialEnergy: 100
      },
      observationTail(2000)
    );
    const effects = result.events.filter((event) => event.skillName === "Darkrazor's Daring");
    const hit = effects.find((event) => event.type === 'damage');
    const control = effects.find((event) => event.type === 'control');
    const self = effects.find((event) => event.kind === 'stability' && event.audience?.recipients === 'self');
    const party = effects.find((event) => event.kind === 'stability' && event.audience?.recipients === 'party');
    assert.deepEqual(result.warnings, []);
    assert.equal(hit.actorType, 'player');
    assert.equal(control.actorType, 'player');
    assert.equal(control.at, hit.at);
    assert.equal(party.at, hit.at);
    assert.ok(self.at < party.at);
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

    assert.ok(enhanced.steps[0].fullCastMs > 0);
    assert.equal(enhanced.steps[1].fullCastMs, 0);
    assert.ok(enhanced.steps[2].fullCastMs > 0);
    assert.ok(
      enhanced.events.some(
        (event) => event.skillName === "Icerazor's Ire" && event.condition === 'Chilled' && event.duration === 1.5
      )
    );
  });

  test('enhanced Icerazor delays its hits and applies chill on each impact', () => {
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

    assert.ok(quickIcerazorHits.length > 0);
    assert.ok(quickIcerazorHits.every((event) => event.at > quickEnhanced.steps[1].end / 1000));
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
      quickIcerazorHits.at(-1).at
    );
    assert.deepEqual(
      quickEnhanced.events
        .filter((event) => event.skillName === "Icerazor's Ire" && event.condition === 'Chilled')
        .map((event) => event.at),
      quickIcerazorHits.map((event) => event.at)
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

    assert.deepEqual(concurrent.warnings, []);
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
        .map((event) => event.at),
      concurrent.events
        .filter((event) => event.type === 'damage' && event.skillName === "Icerazor's Ire")
        .map((event) => event.at)
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

  assert.equal(result.steps[1].fullCastMs, 0);
  assert.ok(result.steps[4].fullCastMs > 0);
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
  assert.ok(atExpiry.steps[2].fullCastMs > 0);
});

test('All for One refunds Energy and halves only enhanced-skill recharge', () => {
  // Compare identical casts so passive regeneration and authored cooldown changes cancel out.
  const rotation = ["Razorclaw's Rage", "Icerazor's Ire"];
  const config = {
    selectedLegends: [LEGEND.RENEGADE, LEGEND.ASSASSIN],
    startingLegend: LEGEND.RENEGADE,
    initialEnergy: 100
  };
  const base = simulate('Renegade', rotation, config);
  const traited = simulate('Renegade', rotation, { ...config, selectedTraitIds: [TRAIT.ALL_FOR_ONE] });
  assert.deepEqual(base.warnings, []);
  assert.deepEqual(traited.warnings, []);
  assert.ok(traited.endState.profession.energy > base.endState.profession.energy);
  assert.equal(
    traited.endState.cooldowns["Icerazor's Ire"].remaining,
    base.endState.cooldowns["Icerazor's Ire"].remaining / 2
  );
  assert.equal(
    traited.endState.cooldowns["Razorclaw's Rage"].readyAt,
    base.endState.cooldowns["Razorclaw's Rage"].readyAt
  );
  assert.equal(
    traited.events.filter((event) => event.type === 'revenant.state' && event.reason === 'all-for-one').length,
    1
  );
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

  assert.ok(procs.some((event) => /Additional Strike/.test(event.name)));
  assert.ok(procs.some((event) => /Life Siphon/.test(event.name) && event.flatStrikePowerCoeff > 0));
  const dismiss = result.steps.find((step) => step.skill === 'Dismiss Lieutenant Soulcleave');

  assert.equal(
    result.steps.at(-1).start,
    dismiss.end + revenantCatalog.skillsByName.get("Soulcleave's Summit").manualReleaseCooldown * 1000
  );
});

test('Assassin buffs trigger on hit and upkeep releases own their cooldowns', () => {
  const daggers = simulate('Core', ['Enchanted Daggers', 'Phase Traversal', { type: 'wait', durationMs: 1000 }], {
    selectedLegends: [LEGEND.ASSASSIN, LEGEND.DEMON],
    startingLegend: LEGEND.ASSASSIN,
    initialEnergy: 100
  });
  const siphon = daggers.resolvedEvents.find(
    (event) => event.type === 'damage' && event.skillName === 'Enchanted Daggers'
  );

  const traversal = daggers.resolvedEvents.find(
    (event) => event.type === 'damage' && event.skillName === 'Phase Traversal'
  );
  // Each hit consumes one dagger and schedules its siphon after the triggering strike.
  assert.ok(siphon.at > traversal.at);
  assert.ok(siphon.flatStrikeBase > 0);
  assert.equal(daggers.endState.profession.enchantedDaggers.charges, 5);

  const odds = simulate('Core', ['Impossible Odds', 'Phase Traversal', 'Relinquish Power', 'Impossible Odds'], {
    selectedLegends: [LEGEND.ASSASSIN, LEGEND.DEMON],
    startingLegend: LEGEND.ASSASSIN,
    initialEnergy: 100
  });

  const release = odds.steps.find((step) => step.skill === 'Relinquish Power');
  assert.equal(
    odds.steps.at(-1).start,
    release.end + revenantCatalog.skillsByName.get('Impossible Odds').manualReleaseCooldown * 1000
  );
  assert.ok(
    odds.resolvedEvents.some(
      (event) => event.skillName === 'Impossible Odds' && event.triggeredBy === 'Phase Traversal'
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

  // Equipment triggered by the delayed strike can cause another eligible follow-up.
  const followups = oddsWithAir.resolvedEvents.filter((event) => event.skillName === 'Impossible Odds');
  assert.deepEqual(
    followups.map((event) => event.triggeredBy),
    ['Phase Traversal', 'Sigil of Air']
  );
  assert.ok(followups[1].at > followups[0].at);
  assert.ok(
    oddsWithAir.resolvedEvents.some(
      (event) => event.skillName === 'Sigil of Air' && event.triggeredBy === 'Impossible Odds'
    )
  );

  // One Energy remains after activation: net drain reaches zero exactly on the one-second action tick.
  const starved = simulate('Core', ['Impossible Odds', { type: 'wait', durationMs: 1000 }], {
    selectedLegends: [LEGEND.ASSASSIN, LEGEND.DEMON],
    startingLegend: LEGEND.ASSASSIN,
    initialEnergy: 6
  });
  const impossible = revenantCatalog.skillsByName.get('Impossible Odds');

  const starvation = starved.events.find(
    (event) => event.type === 'revenant.state' && event.reason === 'upkeep-starved'
  );
  assert.equal(starvation?.at, 1);
  assert.equal(starved.schedulerState.cooldowns.get(impossible.id) - starvation.at, impossible.starvationCooldown);
  assert.equal(starved.endState.profession.activeUpkeeps.length, 0);
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

test('Spear of Archemorus applies torment with its delayed impact', () => {
  const result = simulate(
    'Vindicator',
    ['Spear of Archemorus'],
    {
      selectedLegends: [LEGEND.ALLIANCE, LEGEND.ASSASSIN],
      startingLegend: LEGEND.ALLIANCE,
      initialEnergy: 100
    },
    observationTail(4000)
  );
  const hit = result.events.find((event) => event.type === 'damage' && event.skillName === 'Spear of Archemorus');
  const torment = result.events.find(
    (event) => event.skillName === 'Spear of Archemorus' && event.condition === 'Torment'
  );
  // The projectile persists beyond the cast and carries its condition to the same impact.
  assert.deepEqual(result.warnings, []);
  assert.ok(hit.at > result.steps[0].end / 1000);
  assert.equal(torment.at, hit.at);
});

test('Vindicator dodge traits apply current endurance and damage behavior', () => {
  const config = {
    selectedLegends: [LEGEND.ALLIANCE, LEGEND.ASSASSIN],
    startingLegend: LEGEND.ALLIANCE,
    selectedTraitIds: [TRAIT.LEVIATHAN_STRENGTH, TRAIT.REAVERS_CURSE, TRAIT.FORERUNNER_OF_DEATH],
    initialEnergy: 100,
    boons: { quickness: true, alacrity: true, vigor: true }
  };
  const result = simulate('Vindicator', ['Dodge', 'Energy Meld', 'Dodge', 'Dodge'], config);
  const dodges = result.events.filter((event) => event.type === 'damage' && event.skillName === 'Death Drop');
  const meld = result.steps.find((step) => step.skill === 'Energy Meld');

  assert.deepEqual(result.warnings, []);
  // Reaver's Curse enhances exactly the next dodge; later dodges return to normal damage.
  assert.equal(dodges.length, 3);
  assert.equal(dodges[1].coefficient, dodges[0].coefficient * 2);
  assert.equal(dodges[2].coefficient, dodges[0].coefficient);
  assert.equal(result.endState.profession.reaversCurseUntil, 0);
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
  const baseline = simulate('Vindicator', ['Dodge', 'Energy Meld'], { ...config, selectedTraitIds: [] });
  assert.ok(
    result.endState.cooldowns['Energy Meld'].readyAt - meld.end <
      baseline.endState.cooldowns['Energy Meld'].readyAt - baseline.steps.at(-1).end
  );
  assert.ok(
    result.events.some(
      (event) => event.type === 'buff' && event.kind === 'forerunner-of-death' && event.duration === 10
    )
  );
});

test('both Energy Meld variants grant resources only on completed casts', () => {
  // Isolate the 25-Energy refund from passive regeneration so cancellation checks do not depend on cast timing.
  for (const skillId of [SKILL.ENERGY_MELD, SKILL.ENERGY_MELD_ID_72058]) {
    for (const interruptAfterMs of [undefined, 200]) {
      const result = simulate('Vindicator', ['__combat_start', { skillId, interruptAfterMs }], {
        initialEnergy: 0,
        selectedTraitIds: [TRAIT.ANGSIYANS_TRUST],
        boons: { quickness: true }
      });
      const meld = result.events.filter((event) => event.type === 'revenant.state' && event.reason === 'energy-meld');

      assert.deepEqual(result.warnings, []);
      assert.equal(meld.length, interruptAfterMs == null ? 1 : 0);
      const passiveEnergy = (5 * result.steps.at(-1).end) / 1000;
      assert.ok(
        Math.abs(result.endState.profession.energy - passiveEnergy - (interruptAfterMs == null ? 25 : 0)) < 1e-9
      );
      if (meld.length) assert.equal(meld[0].at, result.steps.at(-1).end / 1000);
    }
  }
});

test('Vindicator Dodge waits for endurance and Vigor shortens that wait', () => {
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
  assert.equal(withoutVigor.steps[1].start, withoutVigor.steps[0].end);
  assert.ok(withoutVigor.steps[2].start > withoutVigor.steps[1].end);
  assert.deepEqual(withVigor.warnings, []);
  assert.equal(withVigor.steps[1].start, withVigor.steps[0].end);
  // Vigor accelerates regeneration; neither path can spend endurance below zero.
  assert.ok(withVigor.steps[2].start < withoutVigor.steps[2].start);
  for (const result of [withoutVigor, withVigor]) {
    assert.ok(
      result.events
        .filter((event) => event.type === 'revenant.state' && event.reason === 'dodge')
        .every((event) => event.state.endurance >= 0)
    );
  }
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
      paletteSkillId: 23275,
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
  assert.ok(result.events.some((event) => event.type === 'damage' && event.name === 'Call of the Alliance'));
  const baseline = simulate('Vindicator', ['Dodge', 'Swap Legends'], {
    selectedLegends: [LEGEND.ASSASSIN, LEGEND.ALLIANCE],
    startingLegend: LEGEND.ASSASSIN
  });
  const baselineSwap = baseline.events.find(
    (event) => event.type === 'revenant.state' && event.reason === 'legend-swap'
  );
  assert.equal(swapState.state.endurance - baselineSwap.state.endurance, call.resourceGain);
});

test('Vindicator jumps pay endurance before midair Energy refunds and reset autos at landing', () => {
  // Three immediate jumps are affordable only when the first spends endurance before the swap refund.
  const result = simulate(
    'Vindicator',
    [
      '__combat_start',
      'Dodge Jump',
      { name: 'Mist Swing', offset: 40 },
      { name: 'Swap Legends', offset: 400 },
      'Dodge Jump',
      'Dodge Jump',
      'Mist Swing'
    ],
    {
      selectedLegends: [LEGEND.ALLIANCE, LEGEND.ASSASSIN],
      startingLegend: LEGEND.ALLIANCE,
      sigilSets: [{ names: ['Energy'] }, { names: [] }],
      primaryWeapon: 'Greatsword',
      secondaryWeapon: ''
    }
  );
  assert.deepEqual(result.warnings, []);
  const jumps = result.steps.filter((step) => step.skill === 'Dodge Jump');
  assert.equal(jumps.length, 3);
  assert.ok(jumps.slice(1).every((step, index) => step.start === jumps[index].end));
  assert.equal(result.steps.at(-1).start, jumps.at(-1).end);
  assert.equal(
    result.events.find((entry) => entry.type === 'revenant.state' && entry.reason === 'dodge-jump').state.endurance,
    50
  );
});

test('Selfish Spirit uses its cooldown rather than ammo charges', () => {
  // Repeated channels must wait for recharge instead of consuming the erroneous imported ammo fact.
  assert.equal(revenantCatalog.skillsById.get(SKILL.SELFISH_SPIRIT).ammo, 0);
  const result = simulate('Vindicator', ['Selfish Spirit', 'Selfish Spirit'], {
    selectedLegends: [LEGEND.ALLIANCE, LEGEND.ASSASSIN],
    startingLegend: LEGEND.ALLIANCE
  });
  assert.deepEqual(result.warnings, []);
  const action = result.events.find((event) => event.type === 'action' && event.skillId === SKILL.SELFISH_SPIRIT);
  assert.ok(action.rechargeReadyAt > action.endsAt);
  assert.equal(result.steps[1].start, Math.round(action.rechargeReadyAt * 1000));
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

  // Manual dodges occupy the full jump and advertise both animation phases.
  const jump = paletteActionSkills(app, 'Vindicator').find((skill) => skill.id === 23275);
  assert.equal(paletteSkillIsInstant(app, { specialization: 'Vindicator' }, jump), false);
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
        skillId: 23275
      },
      {
        type: 'cast',
        skillId: SKILL.PREPARATION_THRUST,
        concurrentOffsetMs: 0
      }
    ]
  );
  const firstInsertion = resolvePaletteDropItem(app, VINDICATOR_DODGE_AUTO_ACTION);

  assert.deepEqual(firstInsertion, [
    {
      type: 'cast',
      skillId: 23275
    },
    {
      type: 'cast',
      skillId: SKILL.PREPARATION_THRUST,
      concurrentOffsetMs: 0
    }
  ]);
  assert.equal(insertRotationItems(app, firstInsertion), true);
  assert.deepEqual(app.build.rotation, [
    {
      type: 'cast',
      skillId: 23275
    },
    {
      type: 'cast',
      skillId: SKILL.PREPARATION_THRUST,
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
      skillId: 23275
    },
    {
      type: 'cast',
      skillId: SKILL.PREPARATION_THRUST,
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
    ['Preparation Thrust', ...vindicatorDodgeAutoRotationEntries({ activeAutoattack: currentAutoattackSkill(app) })],
    {
      selectedLegends: [LEGEND.ALLIANCE, LEGEND.ASSASSIN],
      startingLegend: LEGEND.ASSASSIN,
      boons: { quickness: true },
      primaryWeapon: 'Sword',
      secondaryWeapon: 'Sword'
    }
  );

  assert.deepEqual(combined.warnings, []);
  assert.equal(combined.steps[1].start, combined.steps[2].start);
  assert.ok(combined.steps[1].fullCastMs > 0);
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

test('Imperial Guard exposes True Strike after cancellation or completion', () => {
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
  assert.equal(canceledIntoStrike.steps[0].interrupted, true);
  assert.equal(canceledIntoStrike.steps[1].start, canceledIntoStrike.steps[0].end);
  assert.equal(
    canceledIntoStrike.events.find((event) => event.skillName === 'Imperial Guard' && event.kind === 'blocking')
      .duration,
    (canceledIntoStrike.steps[0].end - canceledIntoStrike.steps[0].start) / 1000
  );
  assert.ok(canceledIntoStrike.events.some((event) => event.skillName === 'True Strike' && event.type === 'damage'));

  const completedChannel = simulate(
    'Vindicator',
    [
      { name: 'Imperial Guard', interruptMs: revenantCatalog.skillsByName.get('Imperial Guard').castTimeMs },
      'True Strike'
    ],
    config
  );

  assert.deepEqual(completedChannel.warnings, []);
  assert.equal(completedChannel.steps[0].interrupted, false);
  assert.equal(completedChannel.steps[1].start, completedChannel.steps[0].end);
  assert.equal(
    completedChannel.events.find((event) => event.skillName === 'Imperial Guard' && event.kind === 'blocking').duration,
    (completedChannel.steps[0].end - completedChannel.steps[0].start) / 1000
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
  assert.equal(deathstrike.castTimeMs, revenantCatalog.skillsById.get(SKILL.DEATHSTRIKE).castTimeMs);
  assert.doesNotMatch(paletteSkillView(app, deathstrike).title, /Instant cast/);
});

// Restoring scheduler resources must preserve resolver-owned clocks in both active state slices.
test('Revenant restoration preserves resolver-owned trait and Soulcleave clocks', () => {
  const revenant = {
    profession: {
      core: { energy: 10, traitProcReadyAt: { chargedMistsReadyAt: 8 } },
      specialization: { kind: 'Renegade', state: { kallasFervor: 1, soulcleaveReadyAt: 9 } }
    }
  };
  handleRevenantState(revenant, {
    state: {
      energy: 20,
      kallasFervor: 2,
      traitProcReadyAt: { chargedMistsReadyAt: 1 },
      soulcleaveReadyAt: 3
    }
  });
  assert.equal(revenant.profession.core.energy, 20);
  assert.equal(revenant.profession.specialization.state.kallasFervor, 2);
  assert.deepEqual(revenant.profession.core.traitProcReadyAt, { chargedMistsReadyAt: 8 });
  assert.equal(revenant.profession.specialization.state.soulcleaveReadyAt, 9);
});
