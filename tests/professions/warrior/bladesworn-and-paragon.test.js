import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { loadProfession, loadProfessionAppAdapter, professionOptions } from '#gw2/app/profession/registry.js';
import { buildChartSeries, skillBreakdownRows } from '#gw2/app/rotation/result/model.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { warriorCatalog } from '#gw2/professions/warrior/catalog.js';
import { WARRIOR_SKILL_IDS as ID, WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import { warriorProfession } from '#gw2/professions/warrior/definition.js';
import {
  DRAGON_TRIGGER_DURATION_SECONDS,
  DRAGON_TRIGGER_FLOW_COST,
  DRAGON_TRIGGER_TICK_RESOURCE_REASON,
  dragonChargesToAdrenalineSpent,
  projectDragonCharges
} from '#gw2/professions/warrior/specializations/bladesworn/mechanics/dragon-trigger.js';
import { advanceBladesworn } from '#gw2/professions/warrior/specializations/bladesworn/mechanics/gunsaber-and-trigger.js';
import { createBladeswornState } from '#gw2/professions/warrior/specializations/bladesworn/state.js';

const baseConfig = Object.freeze({
  stats: {
    power: 2000,
    precision: 1500,
    ferocity: 500,
    conditionDamage: 1000,
    expertise: 0,
    vitality: 1000
  },
  target: {
    armor: 2597,
    health: 3_970_000,
    defiant: true,
    conditions: { Vulnerability: 25 }
  }
});

function simulate(specialization, rotation, config = {}, observationPolicy = undefined) {
  return simulateGw2({
    profession: warriorProfession,
    rotation,
    config: {
      ...baseConfig,
      ...config,
      specialization,
      stats: { ...baseConfig.stats, ...(config.stats || {}) },
      target: { ...baseConfig.target, ...(config.target || {}) }
    },
    mode: 'sequence',
    observationPolicy
  });
}

test('Bladesworn gates gunsaber and Dragon Slash state', () => {
  const blocked = simulate('Bladesworn', ['Swift Cut'], {
    initialResource: 100
  });

  assert.match(blocked.warnings[0], /Unsheathe the gunsaber/);
  assert.equal(blocked.endState.profession.gunsaberActive, false);

  const standardWeaponBlocked = simulate('Bladesworn', ['Unsheathe Gunsaber', 'Chop'], {
    initialResource: 100,
    primaryWeapon: 'Axe',
    secondaryWeapon: 'Axe'
  });

  assert.match(standardWeaponBlocked.warnings[0], /Sheathe the gunsaber/);

  const result = simulate('Bladesworn', ['Unsheathe Gunsaber', 'Swift Cut', 'Dragon Trigger', 'Dragon Slash—Force'], {
    initialResource: 100
  });

  assert.deepEqual(result.warnings, []);
  assert.equal(result.endState.profession.gunsaberActive, true);
  assert.equal(result.endState.profession.dragonTriggerActive, false);
  assert.equal(result.endState.profession.maximumAdrenaline, 0);
  assert.equal(result.totalDamage > 0, true);
  assert.equal(result.steps.find((step) => step.skill === 'Dragon Slash—Force').start, 3459);
});

test('Dragon Trigger requires 15 Flow and expires after 30 seconds', () => {
  const blocked = simulate('Bladesworn', ['Dragon Trigger'], {
    initialResource: DRAGON_TRIGGER_FLOW_COST - 1
  });

  assert.match(blocked.warnings[0], /requires at least 15 flow/);

  const active = simulate('Bladesworn', ['Dragon Trigger'], {
    initialResource: DRAGON_TRIGGER_FLOW_COST
  });

  assert.deepEqual(active.warnings, []);
  const entry = active.events.find((event) => event.type === 'resource' && event.reason === 'dragon trigger entry');

  assert.equal(entry.maximumFlow, 100);
  assert.equal(entry.deadline - entry.at, DRAGON_TRIGGER_DURATION_SECONDS);

  const expired = simulate('Bladesworn', ['Dragon Trigger', { type: 'wait', durationMs: 30001 }], {
    initialResource: 100
  });

  assert.equal(expired.endState.profession.dragonTriggerActive, false);
  assert.equal(expired.endState.profession.dragonCharges, 0);
});

test('projectDragonCharges covers exact-fit, stalled, and accelerated windows', () => {
  const project = (overrides = {}) =>
    projectDragonCharges({
      startTime: 0,
      flow: 50,
      maximumFlow: 100,
      maximumCharges: 10,
      chargesPerInterval: 1,
      flowPerInterval: 5,
      flowRateSegments: [],
      deadline: 2.5,
      ...overrides
    });

  const exactFit = project();

  assert.equal(exactFit.length, 10);
  assert.deepEqual(exactFit.at(-1), {
    at: 2.5,
    charges: 10,
    flowAfter: 0,
    granted: true
  });

  const stalled = project({
    flow: 3,
    maximumCharges: 1,
    flowRateSegments: [{ start: 0, end: 2.5, flowPerSecond: 4 }]
  });

  assert.deepEqual(stalled.slice(0, 2), [
    { at: 0.25, charges: 0, flowAfter: 4, granted: false },
    { at: 0.5, charges: 1, flowAfter: 0, granted: true }
  ]);

  const daringDragon = project({
    maximumCharges: 5,
    flowPerInterval: 10
  });

  assert.equal(daringDragon.length, 5);
  assert.equal(daringDragon.at(-1).at, 1.25);
  assert.equal(daringDragon.at(-1).charges, 5);

  const tacticalReload = project({
    flow: 25,
    chargesPerInterval: 2
  });

  assert.equal(tacticalReload.length, 5);
  assert.equal(tacticalReload.at(-1).at, 1.25);
  assert.equal(tacticalReload.at(-1).charges, 10);

  const empty = project({ flow: 0, flowRateSegments: [] });

  assert.equal(
    empty.every((tick) => tick.flowAfter === 0),
    true
  );
  assert.equal(
    empty.every((tick) => tick.granted === false),
    true
  );
});

test('Dragon charges map to adrenaline-spend trait tiers', () => {
  assert.deepEqual([0, 1, 4, 5, 9, 10].map(dragonChargesToAdrenalineSpent), [0, 10, 10, 20, 20, 30]);
});

test('Dragon Slash charge tiers drive adrenaline-spend traits', () => {
  for (const [charges, bars, powerStacks, precisionDuration] of [
    [4, 1, 2, 2],
    [5, 2, 3, 2],
    [10, 3, 4, 4]
  ]) {
    const result = simulate(
      'Bladesworn',
      ['Dragon Trigger', { name: 'Dragon Slash—Force', releaseAtCharges: charges }],
      {
        initialResource: 100,
        selectedTraitIds: [TRAIT.BERSERKERS_POWER, TRAIT.BURST_PRECISION]
      }
    );

    assert.deepEqual(result.warnings, []);
    const spend = result.events.find(
      (event) =>
        event.type === 'resource' && event.resource === 'dragon charges' && event.reason === 'profession mechanic'
    );

    assert.equal(spend.adrenalineBarsSpent, bars);
    assert.equal(
      result.events.find((event) => event.type === 'buff' && event.name === "Berserker's Power").stacks,
      powerStacks
    );
    assert.equal(
      result.events.find((event) => event.type === 'buff' && event.name === 'Burst Precision').duration,
      precisionDuration
    );
  }
});

test('Burst Mastery restores twenty percent of Dragon Slash Flow spent', () => {
  const rotation = ['Dragon Trigger', { name: 'Dragon Slash—Force', releaseAtCharges: 4 }];
  const baseline = simulate('Bladesworn', rotation, { initialResource: 100 });
  const mastered = simulate('Bladesworn', rotation, {
    initialResource: 100,
    selectedTraitIds: [TRAIT.BURST_MASTERY]
  });

  assert.equal(mastered.endState.profession.flow - baseline.endState.profession.flow, 4);
  assert.equal(
    mastered.events.some(
      (event) => event.type === 'buff' && event.name === 'Burst Mastery — Swiftness' && event.duration === 3
    ),
    true
  );
});

test('Brave Stride reads movement classification from elite skill slices', () => {
  const rotation = [ID.UNSHEATHE_GUNSABER, ID.BREAK_STEP];
  const baseline = simulate('Bladesworn', rotation, { initialResource: 20 });
  const braveStride = simulate('Bladesworn', rotation, {
    initialResource: 20,
    selectedTraitIds: [TRAIT.BRAVE_STRIDE]
  });

  assert.deepEqual(baseline.warnings, []);
  assert.deepEqual(braveStride.warnings, []);
  assert.equal(braveStride.endState.profession.flow - baseline.endState.profession.flow, 5);

  const berserkerBaseline = simulate('Berserker', [ID.SUNDERING_LEAP]);
  const berserkerBraveStride = simulate('Berserker', [ID.SUNDERING_LEAP], {
    selectedTraitIds: [TRAIT.BRAVE_STRIDE]
  });
  assert.equal(
    berserkerBraveStride.endState.profession.adrenaline - berserkerBaseline.endState.profession.adrenaline,
    5
  );
});

test('Bladesworn automatically releases Dragon Slash at the requested charge count', () => {
  const full = simulate('Bladesworn', ['Dragon Trigger', 'Dragon Slash—Force'], { initialResource: 100 });

  assert.deepEqual(full.warnings, []);
  assert.equal(full.steps.find((step) => step.skill === 'Dragon Slash—Force').start, 2500);
  assert.equal(
    full.events.find((event) => event.type === 'damage' && event.skillId === ID.DRAGON_SLASH_FORCE).coefficient,
    20.4
  );

  const partial = simulate('Bladesworn', ['Dragon Trigger', { name: 'Dragon Slash—Force', releaseAtCharges: 3 }], {
    initialResource: 100
  });

  assert.deepEqual(partial.warnings, []);
  assert.equal(partial.steps.find((step) => step.skill === 'Dragon Slash—Force').start, 750);
  assert.ok(
    Math.abs(
      partial.events.find((event) => event.type === 'damage' && event.skillId === ID.DRAGON_SLASH_FORCE).coefficient -
        (1.16 + (20.4 - 1.16) * (2 / 9))
    ) < 1e-9
  );
});

test('Daring Dragon automatically releases at its five-charge maximum', () => {
  const result = simulate('Bladesworn', ['Dragon Trigger', { name: 'Dragon Slash—Force', releaseAtCharges: 10 }], {
    initialResource: 100,
    selectedTraitIds: [TRAIT.DARING_DRAGON]
  });

  assert.deepEqual(result.warnings, []);
  assert.equal(result.steps.find((step) => step.skill === 'Dragon Slash—Force').start, 1250);
  assert.equal(
    result.events.find((event) => event.type === 'damage' && event.skillId === ID.DRAGON_SLASH_FORCE).coefficient,
    20.4
  );
});

test('Dragon Trigger stalls below its Flow cost and resumes after rebuilding', () => {
  const result = simulate('Bladesworn', ['Dragon Trigger', { name: 'Dragon Slash—Force', releaseAtCharges: 4 }], {
    initialResource: 15
  });

  assert.deepEqual(result.warnings, []);
  const ticks = result.events.filter(
    (event) => event.type === 'resource' && event.reason === DRAGON_TRIGGER_TICK_RESOURCE_REASON
  );

  assert.equal(
    ticks.some((tick) => tick.granted === false),
    true
  );
  assert.equal(ticks.at(-1).granted, true);
  assert.equal(ticks.at(-1).value, 4);
  assert.ok(ticks.every((tick) => tick.flowAfter >= 0));
  assert.ok(
    Math.abs(result.steps.find((step) => step.skill === 'Dragon Slash—Force').start / 1000 - ticks.at(-1).at) <= 0.001
  );
  const spend = result.events.find(
    (event) =>
      event.type === 'resource' && event.reason === 'profession mechanic' && event.sourceSkill === 'Dragon Slash—Force'
  );

  assert.equal(spend.amount, -4);
  assert.equal(spend.rotationIndex, 1);
  assert.equal(spend.flowSpent, 20);
  assert.equal(spend.adrenalineBarsSpent, 1);
});

test('Dragon Slash reports unreachable Flow-gated requests', () => {
  const result = simulate(
    'Bladesworn',
    ['Dragon Trigger', { name: 'Dragon Slash—Force', releaseAtCharges: 4 }, '__combat_start'],
    { initialResource: 15 }
  );
  const slash = result.steps.find((step) => step.skill === 'Dragon Slash—Force');

  assert.equal(slash.invalid, true);
  assert.match(slash.invalidReason, /could not reach 4 charges/);
  assert.match(slash.invalidReason, /it reached 3/);
  assert.equal(
    result.events.some((event) => event.type === 'damage' && event.skillId === ID.DRAGON_SLASH_FORCE),
    false
  );
});

test('Dragon Trigger resource ticks match the shared projection', () => {
  const result = simulate(
    'Bladesworn',
    ['Dragon Trigger', 'Flow Stabilizer', { name: 'Dragon Slash—Force', releaseAtCharges: 4 }],
    { initialResource: 15 }
  );

  assert.deepEqual(result.warnings, []);
  const entry = result.events.find((event) => event.type === 'resource' && event.reason === 'dragon trigger entry');
  const actual = result.events
    .filter((event) => event.type === 'resource' && event.reason === DRAGON_TRIGGER_TICK_RESOURCE_REASON)
    .map(({ at, value, flowAfter, granted }) => ({
      at,
      charges: value,
      flowAfter,
      granted
    }));
  const projected = projectDragonCharges({
    startTime: entry.at,
    firstTickAt: entry.nextChargeAt,
    flow: entry.value,
    maximumFlow: entry.maximumFlow,
    maximumCharges: entry.maximumCharges,
    chargesPerInterval: entry.chargesPerInterval,
    flowPerInterval: entry.flowPerInterval,
    flowRateSegments: entry.flowRateSegments,
    deadline: entry.deadline
  }).slice(0, actual.length);

  assert.deepEqual(actual, projected);
  assert.equal(
    entry.flowRateSegments.some((segment) => segment.flowPerSecond === 6),
    true
  );
});

test('Bladesworn preserves partial charge time across fragmented advancement', () => {
  const state = createBladeswornState({ initialResource: 100 });

  state.dragonTriggerActive = true;
  state.dragonTriggerStartedAt = 0;
  state.dragonTriggerChargeDeadline = 2.5;
  state.nextDragonChargeAt = 0.25;
  const context = {
    epsilon: 1e-9,
    config: {},
    events: [],
    emit(event) {
      this.events.push(event);

      return event;
    },
    hasExplicitCombatStart: false,
    state: {
      profession: {
        specialization: { kind: 'Bladesworn', state }
      }
    }
  };

  for (const target of [0.05, 0.1, 0.15, 0.2, 0.24]) {
    advanceBladesworn(context, target);
  }

  assert.equal(state.dragonCharges, 0);
  advanceBladesworn(context, 0.25);
  assert.equal(state.dragonCharges, 1);
  for (let target = 0.5; target <= 2.5; target += 0.25) {
    advanceBladesworn(context, Number(target.toFixed(2)));
  }

  assert.equal(state.dragonCharges, 10);
  assert.equal(state.flow, 54.5);
  assert.deepEqual(
    context.events.map(({ at, value, flowAfter, granted }) => ({
      at,
      value,
      flowAfter,
      granted
    })),
    projectDragonCharges({
      startTime: 0,
      flow: 100,
      maximumFlow: 100,
      maximumCharges: 10,
      chargesPerInterval: 1,
      flowPerInterval: 5,
      flowRateSegments: [{ start: 0, end: 2.5, flowPerSecond: 2 }],
      deadline: 2.5
    }).map(({ at, charges, flowAfter, granted }) => ({
      at,
      value: charges,
      flowAfter,
      granted
    }))
  );
});

test('Bladesworn gunsaber skills expose icons and current PvE ammo', () => {
  const gunsaberSkillIds = [
    ID.SWIFT_CUT,
    ID.STEEL_DIVIDE,
    ID.EXPLOSIVE_THRUST,
    ID.BLOOMING_FIRE,
    ID.ARTILLERY_SLASH,
    ID.CYCLONE_TRIGGER,
    ID.BREAK_STEP,
    ID.DRAGON_SLASH_FORCE,
    ID.DRAGON_SLASH_BOOST,
    ID.DRAGON_SLASH_REACH,
    ID.FLICKER_STEP,
    ID.TRIGGERGUARD
  ];

  assert.equal(
    gunsaberSkillIds.every((skillId) => /^https:\/\/.+\.png$/i.test(warriorCatalog.skillsById.get(skillId).icon)),
    true
  );

  for (const [skillId, ammo, ammoRecharge] of [
    [ID.BLOOMING_FIRE, 2, 10],
    [ID.ARTILLERY_SLASH, 2, 15],
    [ID.CYCLONE_TRIGGER, 2, 20],
    [ID.BREAK_STEP, 2, 20],
    [ID.FLICKER_STEP, 3, 20],
    [ID.TRIGGERGUARD, 2, 30]
  ]) {
    const skill = warriorCatalog.skillsById.get(skillId);

    assert.equal(skill.ammo, ammo);
    assert.equal(skill.ammoRecharge, ammoRecharge);
    assert.equal(skill.cooldown, ammoRecharge);
  }

  const ammoResult = simulate('Bladesworn', ['Unsheathe Gunsaber', 'Blooming Fire', 'Blooming Fire', 'Blooming Fire'], {
    initialResource: 100
  });

  assert.deepEqual(ammoResult.warnings, []);
  assert.deepEqual(
    ammoResult.steps.filter((step) => step.skill === 'Blooming Fire').map((step) => step.start),
    [0, 2903, 10_903]
  );
});

test('Bladesworn gunsaber packets use the requested coefficients and explosion tags', () => {
  const result = simulate(
    'Bladesworn',
    [
      ID.UNSHEATHE_GUNSABER,
      ID.SWIFT_CUT,
      ID.STEEL_DIVIDE,
      ID.EXPLOSIVE_THRUST,
      ID.BLOOMING_FIRE,
      ID.CYCLONE_TRIGGER,
      ID.BREAK_STEP
    ],
    { initialResource: 100 }
  );

  assert.deepEqual(result.warnings, []);
  const damage = result.events.filter((event) => event.type === 'damage');

  assert.deepEqual(
    damage.map((event) => Number(event.coefficient.toFixed(6))),
    [0.9, 0.255, 1.1, 0.255, 1.35, 0.408, 0.8, 0.4, 0.4, 0.4, 2.5, 0.5]
  );
  assert.deepEqual(
    damage.map((event) => event.damageKind),
    [
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      'explosion',
      undefined,
      'explosion',
      'explosion',
      'explosion',
      undefined,
      'explosion'
    ]
  );
  assert.equal(
    result.resolvedEvents
      .filter((event) => event.type === 'damage')
      .every((event) => event.weaponStrengthProfileId === 'bundle.ascended' && event.resolvedWeaponStrength === 968.5),
    true
  );
  assert.equal(
    result.events.some((event) => event.type === 'buff' && event.kind === 'aegis' && event.duration === 3),
    true
  );
  assert.equal(
    result.events.some((event) => event.type === 'buff' && event.kind === 'fury' && event.duration === 5),
    true
  );
});

test('Bladesworn ammo lockouts, all-count attacks, and reloads are modeled', () => {
  assert.equal(warriorCatalog.skillsById.get(ID.ARTILLERY_SLASH).ammo, 2);
  const artillery = simulate(
    'Bladesworn',
    [ID.UNSHEATHE_GUNSABER, ID.ARTILLERY_SLASH, ID.TACTICAL_RELOAD, ID.ARTILLERY_SLASH],
    { initialResource: 100 }
  );

  assert.deepEqual(artillery.warnings, []);
  assert.deepEqual(
    artillery.steps.filter((step) => step.skill === 'Artillery Slash').map((step) => step.start),
    [0, 3022]
  );
  assert.deepEqual(
    artillery.events
      .filter((event) => event.type === 'damage' && event.skillId === ID.ARTILLERY_SLASH)
      .map((event) => event.coefficient),
    [3, 2]
  );
  assert.equal(
    artillery.events.some(
      (event) => event.type === 'control' && event.skillId === ID.ARTILLERY_SLASH && event.controlKind === 'daze'
    ),
    true
  );
  assert.equal(
    artillery.events.find((event) => event.type === 'action' && event.skillId === ID.ARTILLERY_SLASH).rechargeReadyAt,
    16.0215
  );

  const pistol = simulate(
    'Bladesworn',
    [ID.DRAGONS_ROAR, ID.GUNSTINGER, ID.DRAGONS_ROAR, { name: '__wait', waitMs: 500 }],
    { primaryWeapon: 'Pistol', secondaryWeapon: 'Pistol' }
  );

  assert.deepEqual(pistol.warnings, []);
  assert.deepEqual(
    pistol.steps.slice(0, 3).map((step) => step.start),
    [0, 840, 1840]
  );
  const roarPackets = pistol.events.filter((event) => event.type === 'damage' && event.skillId === ID.DRAGONS_ROAR);

  assert.equal(roarPackets.length, 9);
  assert.deepEqual(
    roarPackets.slice(0, 6).map((event) => Math.round(event.at * 1000)),
    [720, 960, 1200, 1440, 1680, 1920]
  );
  assert.equal(
    roarPackets.every((event) => event.coefficient === 0.75 && event.damageKind === 'explosion'),
    true
  );
  assert.equal(
    pistol.events.find((event) => event.type === 'action' && event.skillId === ID.DRAGONS_ROAR).rechargeReadyAt,
    5.84
  );
  assert.equal(
    pistol.events.some(
      (event) =>
        event.type === 'condition' &&
        event.skillId === ID.GUNSTINGER &&
        event.condition === 'Vulnerability' &&
        event.stacks === 5 &&
        event.duration === 8
    ),
    true
  );
  assert.equal(warriorCatalog.skillsById.get(ID.GUNSTINGER).cooldown, 15);
  assert.equal(warriorCatalog.skillsById.get(ID.GUNSTINGER).ammo, 0);
});

test('Flow Stabilizer, Tactical Reload, and adrenaline conversion drive Flow', () => {
  const baseline = simulate('Bladesworn', [{ type: 'wait', durationMs: 9000 }], { initialResource: 0 });

  assert.equal(baseline.endState.profession.flow, 18);

  const stabilized = simulate('Bladesworn', [ID.FLOW_STABILIZER, { type: 'wait', durationMs: 8500 }], {
    initialResource: 0
  });
  const unstabilized = simulate('Bladesworn', [{ type: 'wait', durationMs: 8500 }], { initialResource: 0 });

  assert.equal(warriorCatalog.skillsById.get(ID.FLOW_STABILIZER).castTimeMs, 0);
  assert.equal(stabilized.endState.profession.flow, 49);
  assert.equal(unstabilized.endState.profession.flow, 17);
  assert.equal(stabilized.endState.profession.flow - unstabilized.endState.profession.flow, 32);
  assert.equal(
    stabilized.events.some(
      (event) => event.type === 'buff' && event.kind === 'positive-flow' && event.stacks === 2 && event.duration === 8
    ),
    true
  );

  const retainedRecharge = simulate(
    'Bladesworn',
    [
      ID.FLOW_STABILIZER,
      { type: 'wait', durationMs: 1000 },
      ID.TACTICAL_RELOAD,
      ID.FLOW_STABILIZER,
      { type: 'wait', durationMs: 1000 },
      ID.FLOW_STABILIZER,
      { type: 'wait', durationMs: 27172 },
      ID.FLOW_STABILIZER
    ],
    { initialResource: 0 }
  );

  assert.deepEqual(retainedRecharge.warnings, []);
  assert.deepEqual(
    retainedRecharge.steps.filter((step) => step.skill === 'Flow Stabilizer').map((step) => step.start),
    [0, 1828, 2828, 30000]
  );

  const overlapping = simulate(
    'Bladesworn',
    [
      { type: 'wait', durationMs: 2000 },
      ID.FLOW_STABILIZER,
      { type: 'wait', durationMs: 2000 },
      ID.FLOW_STABILIZER,
      { type: 'wait', durationMs: 4000 }
    ],
    { initialResource: 0 }
  );

  assert.equal(overlapping.endState.profession.flow, 71);
  assert.deepEqual(
    overlapping.events
      .filter((event) => event.type === 'buff' && event.kind === 'positive-flow')
      .map((event) => [event.at, event.stacks, event.duration]),
    [
      [2, 2, 8],
      [4, 2, 8]
    ]
  );
  const positiveFlowState = warriorProfession.ui
    .rotationStateSnapshot({
      specialization: 'Bladesworn',
      professionState: overlapping.endState.profession,
      atSeconds: overlapping.endState.time / 1000,
      result: overlapping
    })
    .find((item) => item.id === 'positive-flow');

  assert.deepEqual(positiveFlowState, {
    id: 'positive-flow',
    label: 'Positive Flow',
    value: '4 stacks · 2.0s',
    title: 'Positive Flow active (4 stacks; time until the next stack expires)'
  });

  const firstCast = simulate('Bladesworn', [ID.FLOW_STABILIZER], {
    initialResource: 0
  });
  const castWithFury = simulate('Bladesworn', [ID.FLOW_STABILIZER], {
    initialResource: 0,
    boons: { fury: true }
  });

  assert.equal(firstCast.endState.profession.flow, 0);
  assert.equal(castWithFury.endState.profession.flow, 15);

  const converted = simulate('Bladesworn', [ID.SIGNET_OF_FURY], {
    initialResource: 0
  });

  assert.equal(converted.endState.profession.flow, 31.05);

  const accelerated = simulate('Bladesworn', [ID.TACTICAL_RELOAD, ID.DRAGON_TRIGGER, ID.DRAGON_SLASH_FORCE], {
    initialResource: 100
  });

  assert.deepEqual(accelerated.warnings, []);
  assert.equal(accelerated.steps.find((step) => step.skill.startsWith('Dragon Slash')).start, 2078);
});

test('Dragon Slash scales from each minimum to maximum coefficient', () => {
  for (const [skillId, minimum, maximum] of [
    [ID.DRAGON_SLASH_FORCE, 1.16, 20.4],
    [ID.DRAGON_SLASH_BOOST, 0.92, 16.3],
    [ID.DRAGON_SLASH_REACH, 0.56, 10.21]
  ]) {
    const partial = simulate('Bladesworn', [ID.DRAGON_TRIGGER, { skillId, releaseAtCharges: 1 }], {
      initialResource: 100
    });
    const full = simulate('Bladesworn', [ID.DRAGON_TRIGGER, skillId], {
      initialResource: 100
    });

    assert.equal(
      partial.events.find((event) => event.type === 'damage' && event.skillId === skillId).coefficient,
      minimum
    );
    assert.equal(
      full.events.find((event) => event.type === 'damage' && event.skillId === skillId).coefficient,
      maximum
    );
  }
});

test('Dragon Trigger utilities expose defense, shadowstep ammo, and cooldown reset', () => {
  assert.equal(warriorCatalog.skillsById.get(ID.DRAGON_TRIGGER).castTimeMs, 0);
  assert.equal(warriorCatalog.skillsById.get(ID.DRAGON_TRIGGER).canCastConcurrently, false);
  assert.equal(Object.hasOwn(warriorCatalog.skillsById.get(ID.DRAGON_TRIGGER), 'quicknessCastTimeMs'), false);
  const concurrentTrigger = simulate(
    'Bladesworn',
    [ID.OVERCHARGED_CARTRIDGES, { skillId: ID.DRAGON_TRIGGER, offset: 100 }],
    { initialResource: 100 }
  );

  assert.deepEqual(concurrentTrigger.warnings, ['Dragon Trigger cannot be cast concurrently.']);
  assert.equal(concurrentTrigger.steps.find((step) => step.skill === 'Dragon Trigger').invalid, true);
  assert.equal(warriorCatalog.skillsById.get(ID.TRIGGERGUARD).castTimeMs, 0);
  assert.equal(Object.hasOwn(warriorCatalog.skillsById.get(ID.TRIGGERGUARD), 'quicknessCastTimeMs'), false);
  const utility = simulate('Bladesworn', [ID.DRAGON_TRIGGER, ID.TRIGGERGUARD, ID.FLICKER_STEP], {
    initialResource: 100
  });

  assert.deepEqual(utility.warnings, []);
  assert.equal(
    utility.events.some((event) => event.type === 'buff' && event.kind === 'aegis' && event.duration === 2),
    true
  );
  assert.equal(warriorCatalog.skillsById.get(ID.FLICKER_STEP).shadowstepSkill, true);

  const reset = simulate(
    'Bladesworn',
    [
      ID.DRAGON_TRIGGER,
      { skillId: ID.DRAGON_SLASH_FORCE, releaseAtCharges: 1 },
      ID.DRAGONSPIKE_MINE,
      ID.DRAGON_TRIGGER,
      { skillId: ID.DRAGON_SLASH_FORCE, releaseAtCharges: 1 }
    ],
    { initialResource: 100 }
  );

  assert.deepEqual(reset.warnings, []);
  assert.deepEqual(
    reset.steps.filter((step) => step.skill === 'Dragon Trigger').map((step) => step.start),
    [0, 2770]
  );
  assert.equal(
    reset.events.some(
      (event) => event.type === 'damage' && event.skillId === ID.DRAGONSPIKE_MINE && event.damageKind === 'explosion'
    ),
    true
  );
});

test('Overcharged Cartridges buffs explosion damage and burning', () => {
  // Mixed-packet skills prove Cartridges modifies only their explicitly tagged secondary explosions.
  const strikeDamage = (result, damageKind) =>
    result.resolvedEvents
      .filter(
        (event) => event.type === 'damage' && event.skillId === ID.BLOOMING_FIRE && event.damageKind === damageKind
      )
      .reduce((sum, event) => sum + event.damage, 0);
  const base = simulate('Bladesworn', [ID.UNSHEATHE_GUNSABER, ID.BLOOMING_FIRE], {
    initialResource: 100,
    stats: { precision: 0, ferocity: 0 },
    target: { conditions: {} }
  });
  const overcharged = simulate('Bladesworn', [ID.OVERCHARGED_CARTRIDGES, ID.UNSHEATHE_GUNSABER, ID.BLOOMING_FIRE], {
    initialResource: 100,
    stats: { precision: 0, ferocity: 0 },
    target: { conditions: {} }
  });
  const supercharged = simulate(
    'Bladesworn',
    [ID.OVERCHARGED_CARTRIDGES, ID.OVERCHARGED_CARTRIDGES, ID.UNSHEATHE_GUNSABER, ID.BLOOMING_FIRE],
    {
      initialResource: 100,
      stats: { precision: 0, ferocity: 0 },
      target: { conditions: {} }
    }
  );

  assert.ok(Math.abs(strikeDamage(overcharged) / strikeDamage(base) - 1) < 1e-9);
  assert.ok(Math.abs(strikeDamage(supercharged) / strikeDamage(base) - 1) < 1e-9);
  assert.ok(Math.abs(strikeDamage(overcharged, 'explosion') / strikeDamage(base, 'explosion') - 1.15) < 1e-9);
  assert.ok(Math.abs(strikeDamage(supercharged, 'explosion') / strikeDamage(base, 'explosion') - 1.2) < 1e-9);
  assert.deepEqual(
    overcharged.events.filter((event) => event.condition === 'Burning').map((event) => event.duration),
    [3, 3, 3]
  );
  assert.deepEqual(
    supercharged.events.filter((event) => event.condition === 'Burning').map((event) => event.duration),
    [5, 5, 5]
  );

  const roarBase = simulate('Bladesworn', [ID.DRAGONS_ROAR], {
    selectedTraitIds: [TRAIT.PEAK_PERFORMANCE],
    stats: { precision: 0, ferocity: 0 },
    target: { conditions: {} }
  });
  const roarSupercharged = simulate(
    'Bladesworn',
    [ID.OVERCHARGED_CARTRIDGES, ID.OVERCHARGED_CARTRIDGES, ID.DRAGONS_ROAR],
    {
      selectedTraitIds: [TRAIT.PEAK_PERFORMANCE],
      stats: { precision: 0, ferocity: 0 },
      target: { conditions: {} }
    }
  );
  const roarDamage = (result) =>
    result.resolvedEvents
      .filter((event) => event.type === 'damage' && event.skillId === ID.DRAGONS_ROAR)
      .reduce((sum, event) => sum + event.damage, 0);

  assert.equal(
    roarSupercharged.resolvedEvents
      .filter((event) => event.type === 'damage' && event.skillId === ID.DRAGONS_ROAR)
      .every((event) => event.damageKind === 'explosion' && event.weaponStrengthProfileId === 'weapon.pistol'),
    true
  );
  assert.ok(Math.abs(roarDamage(roarSupercharged) / roarDamage(roarBase) - 1.2) < 1e-9);

  const timed = simulate('Bladesworn', [ID.OVERCHARGED_CARTRIDGES, ID.OVERCHARGED_CARTRIDGES], {
    boons: { quickness: true }
  });

  assert.deepEqual(
    timed.events
      .filter((event) => ['overcharged-cartridges', 'supercharged-cartridges'].includes(event.kind))
      .map((event) => [event.kind, Number(event.at.toFixed(2))]),
    [
      ['overcharged-cartridges', 0.28],
      ['supercharged-cartridges', 1.88]
    ]
  );
  const cartridgeState = warriorProfession.ui
    .rotationStateSnapshot({
      specialization: 'Bladesworn',
      professionState: timed.endState.profession,
      atSeconds: timed.endState.time / 1000,
      result: timed
    })
    .find((item) => item.id === 'supercharged-cartridges');

  assert.equal(cartridgeState.label, 'Supercharged Cartridges');
  assert.equal(cartridgeState.title, 'Supercharged Cartridges active (+20% damage)');

  const locked = simulate(
    'Bladesworn',
    [ID.OVERCHARGED_CARTRIDGES, ID.OVERCHARGED_CARTRIDGES, ID.TACTICAL_RELOAD, ID.OVERCHARGED_CARTRIDGES],
    { boons: { quickness: true } }
  );
  const lockedBuffs = locked.events.filter((event) =>
    ['overcharged-cartridges', 'supercharged-cartridges'].includes(event.kind)
  );

  assert.deepEqual(
    lockedBuffs.map((event) => event.kind),
    ['overcharged-cartridges', 'supercharged-cartridges']
  );
  assert.equal(locked.steps.filter((step) => step.skill === 'Overcharged Cartridges').length, 3);
  assert.equal(locked.endState.ammo['Overcharged Cartridges'].charges, 0);
  assert.equal(
    locked.endState.profession.overchargedCartridgeWindows.find((window) => window.supercharged).expiresAt,
    lockedBuffs[1].at + 8
  );
});

test('Paragon chants consume adrenaline and start a refrain', () => {
  const result = simulate('Paragon', ['Chant of Action'], {
    initialResource: 10
  });

  assert.deepEqual(result.warnings, []);
  assert.equal(result.endState.profession.maximumAdrenaline, 10);
  assert.equal(result.endState.profession.adrenaline, 0);
  assert.equal(result.endState.profession.motivation, 4);
  assert.equal(result.endState.profession.activeRefrain, 'Chant of Action');
});

test('Rally the Valiant grants motivation when a burst starts', () => {
  const selectedTraitIds = [TRAIT.CALL_TO_ACTION, TRAIT.RALLY_THE_VALIANT];
  const result = simulate('Paragon', ['__combat_start', 'Breaching Strike'], {
    initialResource: 10,
    selectedTraitIds
  });

  assert.equal(result.endState.profession.motivation, 8);

  const withoutRally = simulate('Paragon', ['__combat_start', 'Breaching Strike'], {
    initialResource: 10,
    selectedTraitIds: [TRAIT.CALL_TO_ACTION]
  });

  assert.equal(withoutRally.endState.profession.motivation, 4);
});

test('Warrior signets use the supplied active effects and passive downtime', () => {
  const fury = warriorCatalog.skillsById.get(ID.SIGNET_OF_FURY);
  const might = warriorCatalog.skillsById.get(ID.SIGNET_OF_MIGHT);
  const rage = warriorCatalog.skillsById.get(ID.SIGNET_OF_RAGE);

  assert.equal(fury.cooldown, 16);
  assert.equal(fury.adrenalineGain, 30);
  assert.deepEqual(fury.effects, [
    {
      type: 'buff',
      kind: 'signet-of-fury-active',
      duration: 4,
      atMs: 40,
      timingAnchor: 'castStart',
      timingScale: 'fixed',
      stacks: 1
    }
  ]);
  assert.equal(might.cooldown, 20);
  assert.equal(
    might.effects.some(
      (effect) => effect.type === 'boon' && effect.boon === 'might' && effect.stacks === 10 && effect.duration === 6
    ),
    true
  );
  assert.equal(rage.cooldown, 40);
  assert.equal(rage.adrenalineGain, undefined);

  const fixedFuryDuration = simulate('Core', ['Signet of Fury'], {
    stats: { concentration: 1500 }
  }).events.find((event) => event.kind === 'signet-of-fury-active');

  assert.equal(fixedFuryDuration.at, 0.04);
  assert.equal(fixedFuryDuration.duration, 4);

  const noAutomaticPrecast = simulate('Core', ['__combat_start'], {
    selectedTraitIds: [TRAIT.SIGNET_MASTERY]
  });

  assert.equal(
    noAutomaticPrecast.events.some((event) => event.kind === 'signet-mastery'),
    false
  );

  const result = simulate(
    'Core',
    ['__combat_start', { type: 'wait', durationMs: 3000 }, 'Signet of Rage', { type: 'wait', durationMs: 42000 }],
    { initialResource: 0, selectedSkills: ['Signet of Rage'] }
  );

  assert.deepEqual(result.warnings, []);
  assert.equal(result.endState.profession.adrenaline, 4);
  assert.deepEqual(
    result.events
      .filter((event) => event.type === 'buff' && event.skillName === 'Signet of Rage')
      .map(({ kind, stacks, duration }) => ({ kind, stacks, duration })),
    [
      { kind: 'fury', stacks: 1, duration: 25 },
      { kind: 'might', stacks: 5, duration: 25 },
      { kind: 'swiftness', stacks: 1, duration: 25 }
    ]
  );
});

test('Lesser Signet of Might procs use the signet skill icon', () => {
  const result = simulate('Core', ['Throw Bolas'], {
    selectedTraitIds: [TRAIT.SIGNET_MASTERY],
    target: { health: 1 }
  });
  const proc = result.procSteps.find((step) => step.skill === 'Lesser Signet of Might');

  assert.equal(proc?.icon, warriorCatalog.skillsById.get(ID.SIGNET_OF_MIGHT).icon);
});

test('Burst Precision duration follows the adrenaline stage', () => {
  for (const [initialResource, duration] of [
    [10, 2],
    [20, 2],
    [30, 4]
  ]) {
    const result = simulate('Core', ['Eviscerate'], {
      initialResource,
      selectedTraitIds: [TRAIT.BURST_PRECISION]
    });

    assert.deepEqual(result.warnings, []);
    assert.equal(result.events.find((event) => event.kind === 'burst-precision').duration, duration);
  }

  const result = simulate('Core', ['Eviscerate', 'Throw Bolas'], {
    initialResource: 30,
    selectedTraitIds: [TRAIT.BURST_PRECISION],
    stats: { precision: 0, ferocity: 1000 }
  });
  const eviscerate = result.resolvedEvents.find((event) => event.type === 'damage' && event.skillId === ID.EVISCERATE);
  const followUp = result.resolvedEvents.find((event) => event.type === 'damage' && event.skillId === ID.THROW_BOLAS);

  assert.equal(eviscerate.criticalChance, 1);
  assert.ok(Math.abs(followUp.criticalDamage - eviscerate.criticalDamage - 250 / 1500) < 1e-9);
});

test('Bladesworn swap and Dragon Trigger traits use supplied behavior', () => {
  const swap = simulate('Bladesworn', ['Unsheathe Gunsaber', { type: 'wait', durationMs: 5000 }], {
    initialResource: 0,
    selectedTraitIds: [TRAIT.UNSEEN_SWORD]
  });

  assert.equal(swap.events.find((event) => event.name === 'Unseen Sword').coefficient, 1.2);
  assert.equal(swap.resolvedEvents.find((event) => event.name === 'Unseen Sword').skillId, 62847);
  assert.equal(skillBreakdownRows(swap).find((entry) => entry.name === 'Unseen Sword').hits, 1);
  assert.equal(swap.events.find((event) => event.kind === 'positive-flow').duration, 5);
  assert.equal(swap.endState.profession.flow, 20);

  const combatOnly = simulate(
    'Bladesworn',
    ['Unsheathe Gunsaber', 'Sheathe Gunsaber', '__combat_start', 'Dragon Trigger'],
    {
      initialResource: 100,
      selectedTraitIds: [TRAIT.UNSEEN_SWORD]
    }
  );

  assert.deepEqual(
    combatOnly.resolvedEvents.filter((event) => event.name === 'Unseen Sword').map((event) => event.at),
    [0]
  );

  const trigger = simulate('Bladesworn', ['Dragon Trigger', 'Dragon Slash—Force'], {
    initialResource: 100,
    selectedTraitIds: [TRAIT.DRAGONSCALE_DEFENSE, TRAIT.UNYIELDING_DRAGON, TRAIT.DARING_DRAGON]
  });

  assert.deepEqual(trigger.warnings, []);
  assert.equal(
    trigger.events.some((event) => event.kind === 'stability' && event.duration === 3),
    true
  );
  assert.equal(
    trigger.events.some((event) => event.controlKind === 'stun' && event.duration === 1),
    true
  );
  assert.equal(
    trigger.events.some(
      (event) => event.kind === 'alacrity' && event.duration === 10 && event.audience?.recipients === 'party'
    ),
    true
  );
});

test('Bladesworn ammunition and explosion traits retain stack chronology', () => {
  const result = simulate('Bladesworn', ['Unsheathe Gunsaber', 'Blooming Fire'], {
    initialResource: 100,
    selectedTraitIds: [TRAIT.FIERCE_AS_FIRE, TRAIT.LUSH_FOREST, TRAIT.GUNS_AND_GLORY]
  });

  assert.deepEqual(result.warnings, []);
  assert.equal(
    result.events.some((event) => event.kind === 'fierce-as-fire' && event.stacks === 1 && event.duration === 15),
    true
  );
  assert.equal(
    result.events.some((event) => event.type === 'proc' && event.sourceId === TRAIT.LUSH_FOREST),
    true
  );
  assert.equal(result.events.filter((event) => event.kind === 'guns-and-glory').at(-1).duration, 9);
});

test('Strength and Tactics traits react to dodge, burst, cripple, and control', () => {
  const result = simulate('Core', ['Dodge', 'Eviscerate', 'Throw Bolas', 'Stomp'], {
    initialResource: 30,
    selectedTraitIds: [
      TRAIT.RECKLESS_DODGE,
      TRAIT.BUILDING_MOMENTUM,
      TRAIT.BERSERKERS_POWER,
      TRAIT.MARCHING_ORDERS,
      TRAIT.SOLDIERS_COMFORT,
      TRAIT.LEG_SPECIALIST,
      TRAIT.BODY_BLOW,
      TRAIT.AGGRESSIVE_ONSLAUGHT
    ]
  });

  assert.deepEqual(result.warnings, []);
  assert.equal(result.events.find((event) => event.name === 'Reckless Dodge').coefficient, 1.5);
  assert.equal(
    result.events.find((event) => event.type === 'damage' && event.skillId === ID.EVISCERATE).coefficient,
    3
  );
  const berserkersPower = result.events.find((event) => event.kind === 'berserkers-power');

  assert.deepEqual({ stacks: berserkersPower.stacks, duration: berserkersPower.duration }, { stacks: 4, duration: 15 });
  assert.equal(
    result.events.some((event) => event.name === "Soldier's Focus — Might" && event.stacks === 3),
    true
  );
  assert.equal(
    result.events.some((event) => event.name === "Soldier's Comfort" && event.duration === 4),
    true
  );
  assert.equal(
    result.events.some((event) => event.name === 'Body Blow — Weakness' && event.duration === 3),
    true
  );
  assert.equal(
    result.events.some((event) => event.name === 'Aggressive Onslaught' && event.duration === 3),
    true
  );
  assert.ok(result.endState.profession.endurance > 50);
});

test("Berserker's Power retains applications beyond its visible stack cap", () => {
  const rotation = [
    'Eviscerate',
    'Signet of Fury',
    'Eviscerate',
    'Throw Bolas',
    { type: 'wait', durationMs: 7000 },
    'Throw Bolas'
  ];
  const config = { initialResource: 30 };
  const result = simulate('Core', rotation, {
    ...config,
    selectedTraitIds: [TRAIT.BERSERKERS_POWER]
  });
  const baseline = simulate('Core', rotation, config);
  const applications = result.events.filter((event) => event.kind === 'berserkers-power');
  const bolasHits = result.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.skillId === ID.THROW_BOLAS
  );
  const baselineBolasHits = baseline.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.skillId === ID.THROW_BOLAS
  );

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(
    applications.map(({ stacks, duration }) => [stacks, duration]),
    [
      [4, 15],
      [4, 15]
    ]
  );
  assert.equal(bolasHits.length, 2);
  assert.deepEqual(
    bolasHits.map((hit, index) => Number((hit.damage / baselineBolasHits[index].damage).toFixed(9))),
    [1.15, 1.15]
  );
  assert.equal(Math.max(...buildChartSeries(result, 100).effects["Berserker's Power"].map((point) => point.v)), 4);
});

test('Axe packets and burst coefficients use the supplied PvE values', () => {
  assert.deepEqual(
    [ID.CHOP, ID.DOUBLE_CHOP, ID.TRIPLE_CHOP].map((skillId) =>
      warriorCatalog.skillsById
        .get(skillId)
        .effects.filter((effect) => effect.type === 'strike')
        .map((effect) => [effect.coefficient, effect.hits])
    ),
    [
      [[0.7, 1]],
      [
        [0.45, 1],
        [1.05, 1]
      ],
      [
        [1.5, 2],
        [1.6, 1]
      ]
    ]
  );
  const throwAxe = warriorCatalog.skillsById.get(ID.THROW_AXE);

  assert.deepEqual([throwAxe.ammo, throwAxe.ammoCastLockout, throwAxe.ammoRecharge], [2, 1, 10]);
  assert.equal(warriorCatalog.skillsById.get(ID.CYCLONE_AXE).cooldown, 6);
  assert.equal(warriorCatalog.skillsById.get(ID.DUAL_STRIKE).cooldown, 12);
  assert.equal(
    warriorCatalog.skillsById.get(ID.DUAL_STRIKE).effects.find((effect) => effect.type === 'boon')?.stacks,
    1
  );
  assert.equal(warriorCatalog.skillsById.get(ID.WHIRLING_AXE).cooldown, 15);
  assert.equal(warriorCatalog.skillsById.get(ID.EVISCERATE).cooldown, 8);
  assert.equal(warriorCatalog.skillsById.get(ID.DECAPITATE).cooldown, 0);

  for (const [resource, coefficient] of [
    [10, 2],
    [20, 2.5],
    [30, 3]
  ]) {
    const result = simulate('Core', ['Eviscerate'], {
      initialResource: resource
    });

    assert.equal(result.events.find((event) => event.type === 'damage').coefficient, coefficient);
  }
});

test('Warrior is exposed through the shared application registry', async () => {
  assert.equal(
    professionOptions.some((profession) => profession.id === 'warrior'),
    true
  );
  assert.equal(await loadProfession('warrior'), warriorProfession);
  assert.equal(typeof (await loadProfessionAppAdapter('warrior')).recalculate, 'function');

  const html = await readFile(new URL('../../../dist/site/warrior.html', import.meta.url), 'utf8');

  assert.match(html, /data-profession="warrior"/);
  assert.match(html, /assets\/app-[^"']+\.js/);
});
