import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { buildChartSeries } from '#gw2/app/results/model.js';
import { insertRotationItems } from '#gw2/app/rotation/editing/actions.js';
import { resolvePaletteDropItem } from '#gw2/app/rotation/palette/interactions.js';
import {
  currentAutoattackSkill,
  paletteActionSkills,
  paletteSkillView,
  weaponSkills
} from '#gw2/app/rotation/palette/model.js';
import { baseAttributeInputs } from '#gw2/platform/attributes/inputs.js';
import { RELIC_IDS } from '#gw2/platform/equipment/relics/data.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import { revenantAppAdapter } from '#gw2/professions/revenant/app/app-definition.js';
import { revenantCatalog } from '#gw2/professions/revenant/catalog.js';
import {
  REVENANT_LEGEND_IDS as LEGEND,
  REVENANT_SKILL_IDS as SKILL,
  REVENANT_TRAIT_IDS as TRAIT
} from '#gw2/professions/revenant/data/ids.js';
import { revenantProfession } from '#gw2/professions/revenant/profession.js';
import {
  activeKallasFervorStacks,
  grantKallasFervor
} from '#gw2/professions/revenant/specializations/renegade/mechanics/kalla-and-band-together.js';
import {
  VINDICATOR_DODGE_AUTO_ACTION,
  vindicatorDodgeAutoRotationEntries
} from '#gw2/professions/revenant/specializations/vindicator/presentation.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
import { effectFields } from '#tests/helpers/effect-report.js';
import { createObservedProfessionSimulator, observedRuntime } from '#tests/helpers/observed-runtime.js';
import { revenantHit, runRevenant } from '#tests/helpers/revenant-simulation.js';

const revenantModifiers = Object.freeze({
  modifyAttributes(context, value) {
    return revenantProfession.resolveProfession(context?.config || {}).modifyAttributes(context, value);
  },
  modifyCriticalChance(context, value) {
    return revenantProfession
      .resolveProfession(context?.config || {})
      .modifyCriticalChance({ catalog: revenantCatalog, ...context }, value);
  },
  modifyStrikeDamage(context, value) {
    return revenantProfession
      .resolveProfession(context?.config || {})
      .modifyStrikeDamage({ catalog: revenantCatalog, ...context }, value);
  },
  modifyConditionDamage(context, value) {
    return revenantProfession
      .resolveProfession(context?.config || {})
      .modifyConditionDamage({ catalog: revenantCatalog, ...context }, value);
  },
  modifyConditionDuration(context, value) {
    return revenantProfession
      .resolveProfession(context?.config || {})
      .modifyConditionDuration({ catalog: revenantCatalog, ...context }, value);
  }
});

const baseConfig = Object.freeze({
  selectedLegends: [LEGEND.ASSASSIN, LEGEND.DEMON],
  startingLegend: LEGEND.ASSASSIN,
  initialEnergy: 50,
  attributeInputs: baseAttributeInputs({
    power: 2000,
    precision: 1500,
    ferocity: 500,
    conditionDamage: 1000,
    expertise: 0,
    vitality: 1000
  }),
  target: { armor: 2597, conditions: { Vulnerability: 25 } }
});

const PLAYER_AUDIENCE = Object.freeze({
  includesSelf: true,
  includesSummons: false,
  alliedPlayerCount: 0,
  companionIds: [],
  recipientCount: 1
});

const simulate = createObservedProfessionSimulator(revenantProfession, baseConfig);

const observationTail = (durationMs) => ({ kind: 'tail', durationMs });

test('Ferocious Aggression follows self Fury activation and expiry for strike and condition damage', () => {
  const fury = { at: 1, expiresAt: 2, resolvedAudience: PLAYER_AUDIENCE };
  const context = {
    config: { specialization: 'Core', selectedTraitIds: [TRAIT.FEROCIOUS_AGGRESSION], boons: {} },
    event: { actorType: 'player' },
    condition: 'Burning',
    runtime: { boons: new Map([['fury', [fury]]]), buffs: new Map([]) }
  };

  // Only self Fury grants the additive bonus, including both edges of its active window.
  for (const modify of [revenantModifiers.modifyStrikeDamage, revenantModifiers.modifyConditionDamage]) {
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
        attributeInputs: baseAttributeInputs({ precision: 3100 }),
        selectedTraitIds: [TRAIT.FEROCIOUS_AGGRESSION],
        boons: { fury }
      },
      observationTail(1000)
    );
    const food = result.resolvedEvents.find((event) => event.skillName === 'Nourishment');
    assert.ok(food);
    assert.equal(food.damage, fury ? 357 : 325);
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
  assert.equal(baseline.planningState.profession[STATE.ACTIVE_UPKEEPS].length, 0);

  const empowered = simulate(
    'Core',
    [
      'Embrace the Darkness',
      { type: 'wait', durationMs: 700 },
      'Banish Enchantment',
      { type: 'wait', durationMs: 700 },
      'Resist the Darkness'
    ],
    {
      selectedLegends: [LEGEND.DEMON, LEGEND.ASSASSIN],
      startingLegend: LEGEND.DEMON,
      initialEnergy: 100
    }
  );
  const empoweredPulses = empowered.events.filter(
    (event) => event.type === 'condition' && event.skillName === 'Embrace the Darkness' && event.condition === 'Torment'
  );

  // Activation pulse, the pulse armed by the paid activation itself, then the pulse armed by Banish Enchantment.
  assert.deepEqual(
    empoweredPulses.map((event) => event.stacks),
    [1, 2, 2]
  );
  assert.equal(empowered.planningState.profession[STATE.ACTIVE_UPKEEPS].length, 0);

  const freeSkill = simulate(
    'Core',
    [
      'Embrace the Darkness',
      { type: 'wait', durationMs: 560 },
      'Shattershot',
      { type: 'wait', durationMs: 600 },
      'Resist the Darkness'
    ],
    {
      primaryWeapon: 'Shortbow',
      secondaryWeapon: '',
      selectedLegends: [LEGEND.DEMON, LEGEND.ASSASSIN],
      startingLegend: LEGEND.DEMON,
      initialEnergy: 100
    }
  );

  // Once activation's own empowerment is spent, further empowerment is earned only by spending Energy:
  // a free attack such as Shattershot leaves the following pulse unempowered, and pulses never re-arm themselves.
  assert.deepEqual(
    freeSkill.events
      .filter(
        (event) =>
          event.type === 'condition' && event.skillName === 'Embrace the Darkness' && event.condition === 'Torment'
      )
      .map((event) => event.stacks),
    [1, 2, 1]
  );
});

test('Dwarf upkeep stops dealing damage when released', () => {
  // Releasing an upkeep cancels future pulses, independently of its hit rate or coefficients.
  const result = simulate(
    'Core',
    [
      { type: 'cast', skillId: 26557 },
      { type: 'wait', durationMs: 1100 },
      'Release Hammers',
      { type: 'wait', durationMs: 1000 }
    ],
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
  assert.equal(result.planningState.profession[STATE.ACTIVE_UPKEEPS].length, 0);
});

// A delayed player-owned Shackles strike remains eligible after swapping into Shiro.
test('Impossible Odds follows Shackles damage while its upkeep is active', () => {
  const result = simulate(
    'Renegade',
    [{ type: 'cast', skillId: 40485 }, 'Swap Legends', 'Impossible Odds', { type: 'wait', durationMs: 7000 }],
    {
      selectedLegends: [LEGEND.RENEGADE, LEGEND.ASSASSIN],
      startingLegend: LEGEND.RENEGADE,
      initialEnergy: 100,
      relic: 'Shackles'
    }
  );
  const shackles = result.events.find(
    (event) => event.type === 'damage' && event.sourceId === `relic.${RELIC_IDS.SHACKLES}`
  );
  const followups = result.events.filter(
    (event) =>
      event.type === 'damage' && event.skillName === 'Impossible Odds' && event.triggeredBy === shackles?.skillName
  );
  assert.ok(shackles);
  assert.equal(followups.length, 1);
});

test('Icerazor packets use player ownership and trigger player equipment', () => {
  const result = simulate(
    'Renegade',
    [
      { type: 'cast', skillId: 40485 },
      { type: 'wait', durationMs: 6000 }
    ],
    {
      selectedLegends: [LEGEND.RENEGADE, LEGEND.ASSASSIN],
      startingLegend: LEGEND.RENEGADE,
      initialEnergy: 100,
      relic: 'Shackles'
    }
  );

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
  const result = simulate(
    'Renegade',
    [
      { type: 'cast', skillId: 45686 },
      { type: 'cast', skillId: 40485 },
      { type: 'wait', durationMs: 1000 }
    ],
    {
      selectedLegends: [LEGEND.RENEGADE, LEGEND.ASSASSIN],
      startingLegend: LEGEND.RENEGADE,
      selectedTraitIds: [TRAIT.AMBUSH_COMMANDER, TRAIT.LASTING_LEGACY],
      target: { defiant: true },
      initialEnergy: 100
    }
  );
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
  const pending = simulate('Renegade', [{ type: 'cast', skillId: 40485 }], config);
  const landed = simulate(
    'Renegade',
    [
      { type: 'cast', skillId: 40485 },
      { type: 'wait', durationMs: 1000 }
    ],
    config
  );
  assert.equal(pending.planningState.profession[STATE.KALLAS_FERVOR].length, 0);
  assert.equal(landed.planningState.profession[STATE.KALLAS_FERVOR].length, 3);
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

test('Righteous Rebel extends Orders from Above and Bold Reversal adds Protection pulses', () => {
  // The traits preserve the pulse cadence while independently extending Alacrity and adding Protection.
  const run = (selectedTraitIds) =>
    simulate('Renegade', ['Orders from Above'], { selectedTraitIds, initialEnergy: 100 }, observationTail(6000));
  const base = run([]);
  const improved = run([TRAIT.RIGHTEOUS_REBEL]);
  const protectedRun = run([TRAIT.RIGHTEOUS_REBEL, TRAIT.BOLD_REVERSAL]);
  const pulses = (result) =>
    result.events
      .filter((event) => event.skillId === SKILL.ORDERS_FROM_ABOVE && event.kind === 'alacrity')
      .map(({ at, duration }) => ({ at, duration }));
  assert.deepEqual(base.warnings, []);
  assert.deepEqual(improved.warnings, []);
  assert.ok(pulses(base).length > 0);
  assert.ok(pulses(improved).length > pulses(base).length);
  assert.deepEqual(pulses(improved).slice(0, pulses(base).length), pulses(base));
  assert.deepEqual(
    protectedRun.events
      .filter((event) => event.skillId === SKILL.ORDERS_FROM_ABOVE && event.kind === 'protection')
      .map(({ at, duration, stacks }) => ({ at, duration, stacks })),
    pulses(improved).map(({ at }) => ({ at, duration: 1, stacks: 1 }))
  );
});

test('Ashen Demeanor grants self Fervor, Might, and Resistance on its healing-skill ICD', () => {
  const result = simulate(
    'Renegade',
    [{ type: 'cast', skillId: 45686 }, 'Swap Legends', 'Enchanted Daggers'],
    {
      selectedLegends: [LEGEND.RENEGADE, LEGEND.ASSASSIN],
      startingLegend: LEGEND.RENEGADE,
      selectedTraitIds: [TRAIT.ASHEN_DEMEANOR],
      initialEnergy: 100
    },
    observationTail(1000)
  );
  const ashen = result.events.filter((event) => event.skillName === 'Ashen Demeanor');

  assert.deepEqual(result.warnings, []);
  assert.equal(revenantCatalog.balanceProfilesById.get(TRAIT.ASHEN_DEMEANOR).cooldown, 10);
  assert.deepEqual(
    ashen
      .filter((event) => event.kind === 'kallas-fervor')
      .map(({ duration, stacks, resolvedAudience }) => ({ duration, stacks, resolvedAudience })),
    Array(3).fill({ duration: 8, stacks: 1, resolvedAudience: PLAYER_AUDIENCE })
  );
  assert.deepEqual(
    ashen
      .filter((event) => ['might', 'resistance'].includes(event.kind))
      .map(({ kind, duration, stacks, resolvedAudience }) => ({ kind, duration, stacks, resolvedAudience })),
    [
      { kind: 'might', duration: 6, stacks: 5, resolvedAudience: PLAYER_AUDIENCE },
      { kind: 'resistance', duration: 6, stacks: 1, resolvedAudience: PLAYER_AUDIENCE }
    ]
  );
});

test("Kalla's Fervor chart uses the Renegade stack cap", () => {
  const effectPresentations = revenantProfession.ui.effectPresentations({
    specialization: 'Renegade',
    balanceContext: { catalog: revenantProfession.catalog, modifierRulesById: new Map() }
  });
  const series = buildChartSeries(
    {
      rotationEndTime: 2,
      observationEndTime: 2,
      combatEndTime: 2,
      ...effectFields(
        Array.from({ length: 7 }, (_, index) => ({
          type: 'buff',
          at: index * 0.01,
          kind: 'kallas-fervor',
          duration: 8,
          stacks: 1,
          resolvedAudience: PLAYER_AUDIENCE
        })),
        2,
        { policies: [{ kind: 'kallas-fervor', maximumStacks: 5 }] }
      )
    },
    100,
    effectPresentations
  );

  assert.equal(Math.max(...series.effects["Kalla's Fervor"].map((point) => point.v)), 5);
});

test("Kalla's Fervor replaces the soonest-expiring stack at its cap", () => {
  // A probe task grants one ordinary Fervor stack per second through the live Renegade owner.
  const grant = 'test.kallas-fervor';
  for (const improved of [false, true]) {
    const run = (rotation) =>
      runRevenant(
        rotation,
        {
          specialization: 'Renegade',
          selectedLegends: [LEGEND.RENEGADE, LEGEND.ASSASSIN],
          startingLegend: LEGEND.RENEGADE,
          selectedTraitIds: improved ? [TRAIT.LASTING_LEGACY] : []
        },
        {
          extend: (native) => ({
            tasks: {
              ...native.tasks,
              [grant]: (runtime) =>
                grantKallasFervor(runtime, { sourceId: TRAIT.AMBUSH_COMMANDER, sourceName: 'Ambush Commander' })
            }
          }),
          initialize: (runtime) => [0, 1, 2, 3, 4, 5].forEach((at) => runtime.schedule(grant, at))
        }
      );
    const renegade = (result) => observedRuntime(result).profession.specialization.state;
    const duration = improved ? 12 : 8;
    // A sixth application keeps five stacks alive past the original stack's expiry without refreshing all five.
    const capped = renegade(run([{ type: 'wait', durationMs: 6000 }]));
    assert.deepEqual(
      capped.kallasFervor.map((application) => application.expiresAt),
      [1, 2, 3, 4, 5].map((at) => at + duration)
    );
    assert.equal(activeKallasFervorStacks(capped, duration, 5), 5);
    assert.equal(activeKallasFervorStacks(capped, duration + 1, 5), 4);
    // Heroic Command explicitly refreshes every stack at its completion, unlike an ordinary capped application.
    const refreshed = run([{ type: 'wait', durationMs: 6000 }, 'Heroic Command']);
    assert.deepEqual(refreshed.warnings, []);
    assert.deepEqual(
      renegade(refreshed).kallasFervor.map((application) => application.expiresAt),
      Array(5).fill(refreshed.steps.at(-1).end / 1000 + duration)
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
    const siphon = result.resolvedEvents.find(
      (event) => event.damageKind === 'life-steal' && event.parentSkillName === 'Hammer Bolt'
    );
    assert.ok(siphon);
    assert.equal(siphon.flatStrikeMultiplier, multiplier);
    assert.equal(siphon.damage, Math.floor((202 + 0.03 * 2000) * multiplier));
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

  assert.equal(base.planningState.profession[STATE.KALLAS_FERVOR].length, 5);
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
    attributeInputs: baseAttributeInputs({ precision: 3100 }),
    selectedTraitIds: [TRAIT.AMBUSH_COMMANDER, TRAIT.LASTING_LEGACY]
  })
    .resolvedEvents.filter((event) => event.skillName === 'Nourishment')
    .at(-1);

  // The food proc is derived from the first hit, so it resolves after that hit's own Kalla's Fervor grant.
  assert.equal(nourishment.flatStrikeMultiplier, 1.03);
  assert.equal(nourishment.damage, 334);

  const modifierContext = (selectedTraitIds, condition = null) => ({
    config: { specialization: 'Renegade', selectedTraitIds, boons: {} },
    event: { actorType: 'player' },
    condition,
    time: 1,
    runtime: {
      profession: {
        core: {
          endurance: { value: 100, maximum: 100, updatedAt: 0, rate: 0 }
        },
        specialization: {
          kind: 'Renegade',
          state: {
            kallasFervor: Array.from({ length: 6 }, () => ({
              at: 0,
              expiresAt: 10
            }))
          }
        }
      },
      boons: new Map(),
      buffs: new Map()
    },
    query: {
      targetHasCondition: () => false,
      targetConditionStacks: () => 0
    }
  });

  assert.equal(revenantModifiers.modifyStrikeDamage(modifierContext([]), 1), 1.1);
  assert.equal(revenantModifiers.modifyConditionDamage(modifierContext([], 'Burning'), 1), 1.1);
  assert.equal(revenantModifiers.modifyStrikeDamage(modifierContext([TRAIT.LASTING_LEGACY]), 1), 1.25);
  assert.equal(revenantModifiers.modifyConditionDamage(modifierContext([TRAIT.LASTING_LEGACY], 'Burning'), 1), 1.15);
  const additiveContext = modifierContext([
    TRAIT.DESTRUCTIVE_IMPULSES,
    TRAIT.FEROCIOUS_AGGRESSION,
    TRAIT.LASTING_LEGACY
  ]);

  additiveContext.config.boons.fury = true;
  additiveContext.config.secondaryWeapon = 'Sword';
  additiveContext.damageInputs = { strikeSigilBonus: 0.05, conditionSigilBonus: 0.05 };
  assert.equal(revenantModifiers.modifyStrikeDamage(additiveContext, 1), 1.475);
  additiveContext.condition = 'Burning';
  assert.ok(Math.abs(revenantModifiers.modifyConditionDamage(additiveContext, 1) - 1.375) < 1e-12);
});

test('Renegade critical traits consume seeded critical outcomes', () => {
  const run = (seed) =>
    simulate('Renegade', ['Phase Traversal'], {
      selectedLegends: [LEGEND.RENEGADE, LEGEND.ASSASSIN],
      startingLegend: LEGEND.ASSASSIN,
      selectedTraitIds: [TRAIT.AMBUSH_COMMANDER, TRAIT.ENDLESS_ENMITY],
      target: { defiant: false },
      boons: { fury: false },
      attributeInputs: baseAttributeInputs({ precision: 1945 }),
      initialEnergy: 100,
      randomness: { mode: 'stochastic', seed }
    });
  const signature = (result) => {
    const hit = result.resolvedEvents.find((event) => event.type === 'damage' && event.skillName === 'Phase Traversal');
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

test('Brutal Momentum proc facts follow live endurance while preserving earlier hit facts', () => {
  // Proc evaluation must read the same profession resource that spending changes, at each hit's own instant.
  const result = runRevenant(
    [{ type: 'wait', durationMs: 500 }, 'Dodge', { type: 'wait', durationMs: 1000 }],
    {
      specialization: 'Renegade',
      selectedTraitIds: [TRAIT.BRUTAL_MOMENTUM],
      attributeInputs: baseAttributeInputs({
        ...baseConfig.attributeInputs.weaponSets[0].commonTotals,
        precision: 895
      }),
      boons: {}
    },
    {
      initialize(runtime) {
        runtime.effects.emit({ kind: 'packet', event: revenantHit(0) });
        runtime.effects.emit({ kind: 'packet', event: revenantHit(1) });
      }
    }
  );
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(
    result.resolvedEvents
      .filter((event) => event.type === 'damage' && event.skillName === 'Phase Traversal')
      .map((event) => [event.at, event.criticalChance]),
    [
      [0, 0.33],
      [1, 0.1]
    ]
  );
});

describe('Band Together summon enhancement', () => {
  test('Darkrazor grants self stability before its delayed party effects', () => {
    // The summon owns player effects, with party stability and control arriving on impact.
    const result = simulate(
      'Renegade',
      [41220],
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
      [
        { type: 'cast', skillId: 40485 },
        { type: 'cast', skillId: 42949 },
        { type: 'wait', durationMs: 1000 }
      ],
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

  test('enhances only the next summon', () => {
    const enhanced = simulate(
      'Renegade',
      [{ type: 'cast', skillId: 42949 }, { type: 'cast', skillId: 40485 }, 41220, { type: 'wait', durationMs: 1100 }],
      {
        selectedLegends: [LEGEND.RENEGADE, LEGEND.ASSASSIN],
        startingLegend: LEGEND.RENEGADE,
        initialEnergy: 100
      }
    );
    assert.ok(
      enhanced.events.some(
        (event) => event.skillName === "Icerazor's Ire" && event.condition === 'Chilled' && event.duration === 1.5
      )
    );
  });

  test('enhanced Icerazor delays its hits and applies chill on each impact', () => {
    const quickEnhanced = simulate(
      'Renegade',
      [
        { type: 'cast', skillId: 42949 },
        { type: 'cast', skillId: 40485 },
        { type: 'wait', durationMs: 1000 }
      ],
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
      [{ type: 'cast', skillId: 40485 }, 41220, { type: 'wait', durationMs: 1100 }],
      {
        selectedLegends: [LEGEND.RENEGADE, LEGEND.ASSASSIN],
        startingLegend: LEGEND.RENEGADE,
        initialEnergy: 100
      }
    );

    assert.ok(
      enhancedDarkrazor.events.some(
        (event) => event.skillName === "Darkrazor's Daring" && event.type === 'control' && event.controlKind === 'daze'
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
      [
        { type: 'cast', skillId: 40485 },
        { skillId: 42949, offset: 100 }
      ],
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
            !event.metadata?.triggeredByAlly
        )
        .map((event) => event.at),
      concurrent.events
        .filter((event) => event.type === 'damage' && event.skillName === "Icerazor's Ire")
        .map((event) => event.at)
    );
  });
});

test('All for One refunds Energy and halves only enhanced-skill recharge', () => {
  // Compare identical casts so passive regeneration and authored cooldown changes cancel out.
  const rotation = [
    { type: 'cast', skillId: 42949 },
    { type: 'cast', skillId: 40485 }
  ];
  const config = {
    selectedLegends: [LEGEND.RENEGADE, LEGEND.ASSASSIN],
    startingLegend: LEGEND.RENEGADE,
    initialEnergy: 100
  };
  const base = simulate('Renegade', rotation, config);
  const traited = simulate('Renegade', rotation, { ...config, selectedTraitIds: [TRAIT.ALL_FOR_ONE] });
  assert.deepEqual(base.warnings, []);
  assert.deepEqual(traited.warnings, []);
  // Only the enhanced Icerazor refunds the authored All for One Energy once.
  assert.equal(
    traited.planningState.profession[STATE.ENERGY].value - base.planningState.profession[STATE.ENERGY].value,
    revenantCatalog.balanceProfilesById.get(TRAIT.ALL_FOR_ONE).resourceGain
  );
  assert.equal(
    traited.planningState.cooldowns[SKILL.ICERAZORS_IRE].remaining,
    base.planningState.cooldowns[SKILL.ICERAZORS_IRE].remaining / 2
  );
  assert.equal(
    traited.planningState.cooldowns[SKILL.RAZORCLAWS_RAGE].readyAt,
    base.planningState.cooldowns[SKILL.RAZORCLAWS_RAGE].readyAt
  );
});

test("Razorclaw models party procs with the Revenant's condition stats", () => {
  const result = simulate(
    'Renegade',
    [{ type: 'cast', skillId: 42949 }],
    {
      selectedLegends: [LEGEND.RENEGADE, LEGEND.ASSASSIN],
      startingLegend: LEGEND.RENEGADE,
      initialEnergy: 100,
      allies: { count: 4, strikesPerSecond: 1 },
      attributeInputs: baseAttributeInputs({ conditionDamage: 1500, expertise: 300 })
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
      !event.metadata?.triggeredByAlly &&
      (event.type === 'damage' || event.type === 'condition')
  );

  assert.ok(personalPackets.length > 0);
  assert.ok(personalPackets.every((event) => event.actorType === 'player'));
  const allyBleeds = result.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.skillName === "Razorclaw's Rage" && event.metadata?.triggeredByAlly
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
      { type: 'cast', skillId: 40485 },
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
    Math.ceil((dismiss.end + (revenantCatalog.skillsById.get(45773).manualReleaseCooldown * 1000) / 1.25) / 40) * 40
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
  assert.equal(daggers.planningState.profession[STATE.ENCHANTED_DAGGERS].charges, 5);

  const odds = simulate('Core', ['Impossible Odds', 'Phase Traversal', 'Relinquish Power', 'Impossible Odds'], {
    selectedLegends: [LEGEND.ASSASSIN, LEGEND.DEMON],
    startingLegend: LEGEND.ASSASSIN,
    initialEnergy: 100
  });

  const release = odds.steps.find((step) => step.skill === 'Relinquish Power');
  assert.equal(
    odds.steps.at(-1).start,
    release.end + (revenantCatalog.skillsById.get(27107).manualReleaseCooldown * 1000) / 1.25
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
    attributeInputs: baseAttributeInputs({
      precision: 1000,
      criticalChanceBonus: 45
    }),
    sigilSets: [
      { names: ['Air'], strike: 1, condition: 1 },
      { names: [], strike: 1, condition: 1 }
    ]
  });

  // The opening seeded critical triggers Air immediately; its same-time strike cannot bypass the Odds ICD.
  const followups = oddsWithAir.resolvedEvents.filter((event) => event.skillName === 'Impossible Odds');
  assert.deepEqual(
    followups.map((event) => event.triggeredBy),
    ['Phase Traversal']
  );
  assert.ok(
    oddsWithAir.resolvedEvents.some(
      (event) => event.skillName === 'Sigil of Air' && event.triggeredBy === 'Phase Traversal'
    )
  );

  // One Energy remains after activation: net drain reaches zero exactly on the one-second action tick.
  const starved = simulate('Core', ['Impossible Odds', { type: 'wait', durationMs: 1000 }], {
    selectedLegends: [LEGEND.ASSASSIN, LEGEND.DEMON],
    startingLegend: LEGEND.ASSASSIN,
    initialEnergy: 6
  });
  const impossible = revenantCatalog.skillsById.get(27107);

  // Starvation at one second starts the authored starvation cooldown from that boundary.
  assert.equal(
    observedRuntime(starved).cooldownController.readyAt(impossible.id),
    1 + impossible.starvationCooldown / 1.25
  );
  assert.equal(starved.planningState.profession[STATE.ACTIVE_UPKEEPS].length, 0);
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
  const result = simulate('Vindicator', ['Dodge', { type: 'cast', skillId: 62757 }, 'Dodge', 'Dodge'], config);
  const dodges = result.events.filter((event) => event.type === 'damage' && event.skillName === 'Death Drop');
  const meld = result.steps.find((step) => step.skill === 'Energy Meld');

  assert.deepEqual(result.warnings, []);
  // Reaver's Curse enhances exactly the next dodge; later dodges return to normal damage.
  assert.equal(dodges.length, 3);
  assert.equal(dodges[1].coefficient, dodges[0].coefficient * 2);
  assert.equal(dodges[2].coefficient, dodges[0].coefficient);
  assert.equal(result.planningState.profession[STATE.REAVERS_CURSE_UNTIL], 0);
  assert.equal(
    revenantModifiers.modifyStrikeDamage(
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
  const baseline = simulate('Vindicator', ['Dodge', { type: 'cast', skillId: 62757 }], {
    ...config,
    selectedTraitIds: []
  });
  assert.ok(
    result.planningState.cooldowns[SKILL.ENERGY_MELD].readyAt - meld.end <
      baseline.planningState.cooldowns[SKILL.ENERGY_MELD].readyAt - baseline.steps.at(-1).end
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
      assert.deepEqual(result.warnings, []);
      const passiveEnergy = (5 * result.steps.at(-1).end) / 1000;
      assert.ok(
        Math.abs(
          result.planningState.profession[STATE.ENERGY].value - passiveEnergy - (interruptAfterMs == null ? 25 : 0)
        ) < 1e-9
      );
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
  for (const result of [withoutVigor, withVigor])
    assert.ok(result.planningState.profession[STATE.ENDURANCE].value >= 0);
});

test('Vindicator resource display includes live endurance', () => {
  const core = revenantProfession.ui.resourceViews({
    specialization: 'Core',
    professionState: {
      [STATE.ENERGY]: { value: 40.9, maximum: 100, updatedAt: 0, rate: 5 },
      [STATE.ENDURANCE]: { value: 25, maximum: 100, updatedAt: 0, rate: 0 }
    }
  });
  const conduit = revenantProfession.ui.resourceViews({
    specialization: 'Conduit',
    professionState: {
      [STATE.ENERGY]: { value: 40, maximum: 100, updatedAt: 0, rate: 5 },
      [STATE.AFFINITY]: { value: 3, maximum: 5, rate: 0, updatedAt: 0 }
    }
  });
  const vindicator = revenantProfession.ui.resourceViews({
    specialization: 'Vindicator',
    professionState: {
      [STATE.ENERGY]: { value: 40, maximum: 100, updatedAt: 0, rate: 5 },
      [STATE.ENDURANCE]: { value: 25, maximum: 100, updatedAt: 0, rate: 0 }
    }
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
      paletteSkillId: SHARED_SKILL_IDS.DODGE,
      shortLabel: 'End',
      statusLabel: 'Current'
    }
  );
});

test('Sigil of Energy restores 50 endurance on Revenant legend swap', () => {
  // Two dodges drain endurance first so the legend-swap proc is not clipped by the endurance cap.
  const run = (names) =>
    simulate('Vindicator', ['__combat_start', 'Dodge', 'Dodge', 'Swap Legends'], {
      selectedLegends: [LEGEND.ASSASSIN, LEGEND.ALLIANCE],
      startingLegend: LEGEND.ASSASSIN,
      sigilSets: [{ names }, { names: [] }]
    });
  const result = run(['Energy']);
  const baseline = run([]);

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(
    result.procSteps.filter((step) => step.skill === 'Sigil of Energy').map((step) => step.sourceSkill),
    ['Swap Legends']
  );
  assert.equal(
    result.planningState.profession[STATE.ENDURANCE].value - baseline.planningState.profession[STATE.ENDURANCE].value,
    50
  );
});

test('Vindicator jumps pay endurance before midair Energy refunds and reset autos at landing', () => {
  // Three immediate jumps are affordable only when the first spends endurance before the swap refund.
  const result = simulate(
    'Vindicator',
    [
      '__combat_start',
      'Dodge',
      { name: 'Mist Swing', offset: 40 },
      { name: 'Swap Legends', offset: 400 },
      'Dodge',
      'Dodge',
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
  const jumps = result.steps.filter((step) => step.skill === 'Dodge');
  assert.equal(jumps.length, 3);
  assert.ok(jumps.slice(1).every((step, index) => step.start === jumps[index].end));
  assert.equal(result.steps.at(-1).start, jumps.at(-1).end);
});

test('Selfish Spirit uses its cooldown rather than ammo charges', () => {
  // Repeated channels must wait for recharge instead of consuming the erroneous imported ammo fact.
  assert.equal(revenantCatalog.skillsById.get(SKILL.SELFISH_SPIRIT).ammo, 0);
  const result = simulate('Vindicator', ['Selfish Spirit', 'Selfish Spirit'], {
    selectedLegends: [LEGEND.ALLIANCE, LEGEND.ASSASSIN],
    startingLegend: LEGEND.ALLIANCE
  });
  assert.deepEqual(result.warnings, []);
  // The channel's recharge begins when it ends; the second cast waits for that recharge.
  assert.equal(
    result.steps[1].start,
    result.steps[0].end + (revenantCatalog.skillsById.get(SKILL.SELFISH_SPIRIT).cooldown * 1000) / 1.25
  );
});

test('Vindicator Dodge + Auto palette action uses the current chain step', () => {
  let changeCount = 0;
  const app = {
    profession: revenantProfession,
    activeCatalog: revenantCatalog,
    // Palette-only actions still resolve their tooltip through the application's selected balance patch.
    patch: revenantAppAdapter.profession.resolvePatch({ id: 'current' }),
    results: {
      planningState: {
        activeWeaponSet: 1,
        ammoBySkillId: {},
        profession: { [STATE.AUTOATTACK_CHAINS]: {} }
      }
    },
    build: {
      weapons: ['Sword', 'Sword'],
      alternateWeapons: ['Greatsword', ''],
      startingWeaponSet: 1,
      rotation: []
    },
    adapter: {
      skillTooltip: revenantAppAdapter.skillTooltip,
      eliteSpecialization: () => 'Vindicator',
      // Cursor previews use the manually controlled chain state for this palette-action fixture.
      rotationPreviewAt: (app) => app.results,
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
        skillId: SHARED_SKILL_IDS.DODGE
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
      skillId: SHARED_SKILL_IDS.DODGE
    },
    {
      type: 'cast',
      skillId: SKILL.PREPARATION_THRUST,
      concurrentOffsetMs: 0
    }
  ]);
  insertRotationItems(app, firstInsertion);
  assert.deepEqual(app.build.rotation, [
    {
      type: 'cast',
      skillId: SHARED_SKILL_IDS.DODGE
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

  insertRotationItems(app, secondInsertion);
  assert.deepEqual(app.build.rotation, [
    {
      type: 'cast',
      skillId: SHARED_SKILL_IDS.DODGE
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

  app.results.planningState.profession[STATE.AUTOATTACK_CHAINS][SKILL.PREPARATION_THRUST] = SKILL.BRUTAL_BLADE;
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
    activeCatalog: revenantCatalog,
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
    [{ name: 'Imperial Guard', interruptMs: revenantCatalog.skillsById.get(62921).castTimeMs }, 'True Strike'],
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

test('Deathstrike weapon palette keeps the primary skill identity on cooldown', () => {
  const app = {
    profession: revenantProfession,
    activeCatalog: revenantCatalog,
    results: {
      planningState: {
        atSeconds: 0.72,
        ammoBySkillId: {},
        cooldowns: {
          [SKILL.DEATHSTRIKE]: { readyAt: 12420, remaining: 11700 }
        }
      }
    },
    build: {
      weapons: ['Sword', 'Sword'],
      alternateWeapons: ['', '']
    },
    adapter: {
      skillTooltip: revenantAppAdapter.skillTooltip,
      eliteSpecialization: () => 'Conduit',
      isSkillAvailable: () => true
    }
  };
  const deathstrike = weaponSkills(app).find((skill) => skill.name === 'Deathstrike');

  assert.equal(deathstrike.id, SKILL.DEATHSTRIKE);
});

// Restoring scheduler resources must preserve resolver-owned clocks in both active state slices.

// Multiple authored stacks replace the oldest entries consistently for either selected Fervor profile.
test('Kallas Fervor reports the same selected grant that updates its capped owner', async () => {
  const { withProfile } = await import('#tests/helpers/catalog-overrides.js');
  const { fervorProfile } = await import('#gw2/professions/revenant/specializations/renegade/traits/fervor.js');
  const { captureEffectEmissions } = await import('#tests/helpers/effect-emission.js');
  for (const selectedTraitIds of [[], [TRAIT.LASTING_LEGACY]]) {
    const state = {
      kallasFervor: [
        { at: 0, expiresAt: 3 },
        { at: 0, expiresAt: 4 }
      ]
    };
    const captured = captureEffectEmissions();
    const runtime = {
      time: 1,
      config: { selectedTraitIds },
      helpers: revenantCatalog,
      profession: { specialization: { kind: 'Renegade', state } },
      effects: captured.effects
    };
    const profile = fervorProfile(runtime);
    runtime.helpers = withProfile(revenantCatalog, profile.id, {
      maximumStacks: 3,
      effects: profile.effects.map((effect) => ({ ...effect, stacks: 2, duration: 6 }))
    });
    grantKallasFervor(runtime, { sourceId: TRAIT.AMBUSH_COMMANDER, sourceName: 'Fervor fixture' });
    assert.equal(captured.events[0].stacks, 2);
    assert.deepEqual(
      state.kallasFervor.map((entry) => entry.expiresAt),
      [4, 7, 7]
    );
    assert.equal(activeKallasFervorStacks(state, 4, 3), 2);
    assert.equal(activeKallasFervorStacks(state, 7, 3), 0);
    runtime.time = 2;
    grantKallasFervor(runtime, { sourceId: TRAIT.AMBUSH_COMMANDER, sourceName: 'Repeated grant' });
    assert.deepEqual(
      state.kallasFervor.map((entry) => entry.expiresAt),
      [7, 8, 8]
    );
    assert.equal(captured.events[1].stacks, 2);
  }
});

test('Fervor modifiers and observations resolve the selected profile cap without cached state', async () => {
  const { withProfile } = await import('#tests/helpers/catalog-overrides.js');
  const { fervorProfile } = await import('#gw2/professions/revenant/specializations/renegade/traits/fervor.js');
  const { renegadeEffectStates } = await import('#gw2/professions/revenant/specializations/renegade/effect-state.js');
  // An over-cap preview verifies both consumers read patch tuning rather than a state factory default.
  for (const selectedTraitIds of [[], [TRAIT.LASTING_LEGACY]]) {
    const config = { specialization: 'Renegade', selectedTraitIds };
    const native = revenantProfession.runtimeFor(config);
    const profession = native.createState(config);
    profession.specialization.state.kallasFervor = Array.from({ length: 8 }, () => ({ at: 0, expiresAt: 10 }));
    const profile = fervorProfile({ config, catalog: native.catalog });
    for (const maximumStacks of [3, 7]) {
      const catalog = withProfile(native.catalog, profile.id, { maximumStacks });
      const runtime = { profession, config, traits: new Set(selectedTraitIds), helpers: catalog, time: 1 };
      const effect = renegadeEffectStates(runtime).find(({ kind }) => kind === 'kallas-fervor');
      assert.equal(effect.countLimit, maximumStacks);
      const context = { catalog, config, runtime, time: 1, event: { actorType: 'player' } };
      assert.equal(
        revenantModifiers.modifyStrikeDamage(context, 1),
        1 + maximumStacks * profile.damageIncreasePerStack
      );
      assert.equal(
        revenantModifiers.modifyConditionDamage({ ...context, condition: 'Burning' }, 1),
        1 + maximumStacks * profile.conditionDamageIncreasePerStack
      );
    }

    assert.equal(Object.hasOwn(profession.specialization.state, 'kallasFervorMaximumStacks'), false);
  }
});
