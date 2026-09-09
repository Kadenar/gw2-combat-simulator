import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { loadProfession, loadProfessionAppAdapter, professionOptions } from '#gw2/app/profession/registry.js';
import { buildChartSeries, skillBreakdownRows } from '#gw2/app/results/model.js';
import { warriorCatalog } from '#gw2/professions/warrior/catalog.js';
import { WARRIOR_SKILL_IDS as ID, WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import { warriorProfession } from '#gw2/professions/warrior/definition.js';
import { createProfessionSimulator } from '../../helpers/profession-simulation.js';
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

const simulate = createProfessionSimulator(warriorProfession, baseConfig);

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

// Release follows charge events, so skill activation timings can change independently.
test('Bladesworn releases at the requested charge count and clamps to the trait cap', () => {
  for (const [releaseAtCharges, selectedTraitIds, expectedCharges] of [
    [undefined, [], 10],
    [3, [], 3],
    [10, [TRAIT.DARING_DRAGON], 5]
  ]) {
    const result = simulate('Bladesworn', [ID.DRAGON_TRIGGER, { skillId: ID.DRAGON_SLASH_FORCE, releaseAtCharges }], {
      initialResource: 100,
      selectedTraitIds
    });
    const lastTick = result.events.filter((event) => event.reason === DRAGON_TRIGGER_TICK_RESOURCE_REASON).at(-1);
    const slash = result.steps.find((step) => step.skill === 'Dragon Slash—Force');

    assert.deepEqual(result.warnings, []);
    assert.equal(lastTick.value, expectedCharges);
    assert.ok(Math.abs(slash.start / 1000 - lastTick.at) <= 0.001);
    assert.equal(result.endState.profession.dragonTriggerActive, false);
    assert.equal(result.endState.profession.dragonCharges, 0);
  }
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

// All-round attacks consume their magazine; reload skills make a follow-up available.
test('Artillery Slash consumes all ammo and Tactical Reload restores a round', () => {
  const spent = simulate('Bladesworn', [ID.UNSHEATHE_GUNSABER, ID.ARTILLERY_SLASH]);
  const reloaded = simulate('Bladesworn', [ID.UNSHEATHE_GUNSABER, ID.ARTILLERY_SLASH, ID.TACTICAL_RELOAD]);
  const fired = simulate('Bladesworn', [
    ID.UNSHEATHE_GUNSABER,
    ID.ARTILLERY_SLASH,
    ID.TACTICAL_RELOAD,
    ID.ARTILLERY_SLASH
  ]);
  const hits = fired.events.filter((event) => event.type === 'damage' && event.skillId === ID.ARTILLERY_SLASH);

  for (const result of [spent, reloaded, fired]) assert.deepEqual(result.warnings, []);
  assert.equal(spent.endState.ammo['Artillery Slash'].charges, 0);
  assert.equal(reloaded.endState.ammo['Artillery Slash'].charges, 1);
  assert.equal(fired.endState.ammo['Artillery Slash'].charges, 0);
  assert.equal(hits.length, 2);
  assert.ok(hits[0].coefficient > hits[1].coefficient);
  assert.ok(fired.events.some((event) => event.skillId === ID.ARTILLERY_SLASH && event.controlKind === 'daze'));
});

test("Dragon's Roar consumes its magazine and Gunstinger reloads it", () => {
  const spent = simulate('Bladesworn', [ID.DRAGONS_ROAR]);
  const reloaded = simulate('Bladesworn', [ID.DRAGONS_ROAR, ID.GUNSTINGER]);
  const fired = simulate('Bladesworn', [ID.DRAGONS_ROAR, ID.GUNSTINGER, ID.DRAGONS_ROAR]);

  for (const result of [spent, reloaded, fired]) assert.deepEqual(result.warnings, []);
  assert.equal(spent.endState.ammo["Dragon's Roar"].charges, 0);
  assert.ok(reloaded.endState.ammo["Dragon's Roar"].charges > 0);
  assert.equal(fired.endState.ammo["Dragon's Roar"].charges, 0);
});

test('Gunsaber attacks resolve bundle strength and distinguish secondary explosions', () => {
  // Mixed attacks need separate tags so explosion modifiers cannot affect their ordinary strikes.
  for (const skillId of [ID.EXPLOSIVE_THRUST, ID.BLOOMING_FIRE]) {
    const result = simulate('Bladesworn', [ID.UNSHEATHE_GUNSABER, ID.SWIFT_CUT, ID.STEEL_DIVIDE, skillId]);
    const hits = result.resolvedEvents.filter((event) => event.type === 'damage' && event.skillId === skillId);

    assert.deepEqual(result.warnings, []);
    assert.ok(hits.some((event) => event.damageKind === 'explosion'));
    assert.ok(hits.some((event) => event.damageKind !== 'explosion'));
    assert.ok(hits.every((event) => event.weaponStrengthProfileId === 'bundle.ascended'));
  }
});

test('Flow Stabilizer, Tactical Reload, and adrenaline conversion drive Flow', () => {
  const baseline = simulate('Bladesworn', [{ type: 'wait', durationMs: 9000 }], { initialResource: 0 });

  assert.equal(baseline.endState.profession.flow, 18);

  const stabilized = simulate('Bladesworn', [ID.FLOW_STABILIZER, { type: 'wait', durationMs: 8500 }], {
    initialResource: 0
  });
  const unstabilized = simulate('Bladesworn', [{ type: 'wait', durationMs: 8500 }], { initialResource: 0 });

  assert.equal(stabilized.endState.profession.flow, 49);
  assert.equal(unstabilized.endState.profession.flow, 17);
  assert.equal(stabilized.endState.profession.flow - unstabilized.endState.profession.flow, 32);
  assert.equal(
    stabilized.events.some(
      (event) => event.type === 'buff' && event.kind === 'positive-flow' && event.stacks === 2 && event.duration === 8
    ),
    true
  );

  // A reload preserves count recharge even when it briefly fills the magazine.
  const spent = simulate('Bladesworn', [ID.FLOW_STABILIZER]);
  const retainedRecharge = simulate('Bladesworn', [ID.FLOW_STABILIZER, ID.TACTICAL_RELOAD, ID.FLOW_STABILIZER]);

  assert.deepEqual(retainedRecharge.warnings, []);
  assert.equal(
    retainedRecharge.endState.ammo['Flow Stabilizer'].charges,
    spent.endState.ammo['Flow Stabilizer'].charges
  );
  assert.ok(spent.endState.ammo['Flow Stabilizer'].nextRechargeAt > 0);
  assert.equal(
    retainedRecharge.endState.ammo['Flow Stabilizer'].nextRechargeAt,
    spent.endState.ammo['Flow Stabilizer'].nextRechargeAt
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

  const idle = simulate('Bladesworn', [{ type: 'wait', durationMs: converted.endState.time }], { initialResource: 0 });
  assert.ok(
    Math.abs(
      converted.endState.profession.flow -
        idle.endState.profession.flow -
        warriorCatalog.skillsById.get(ID.SIGNET_OF_FURY).adrenalineGain
    ) < 1e-9
  );
  assert.equal(converted.endState.profession.adrenaline, 0);

  const accelerated = simulate('Bladesworn', [ID.TACTICAL_RELOAD, ID.DRAGON_TRIGGER, ID.DRAGON_SLASH_FORCE], {
    initialResource: 100
  });

  assert.deepEqual(accelerated.warnings, []);
  const normal = simulate('Bladesworn', [ID.DRAGON_TRIGGER, ID.DRAGON_SLASH_FORCE], { initialResource: 100 });
  const chargeTicks = (result) => result.events.filter((event) => event.reason === DRAGON_TRIGGER_TICK_RESOURCE_REASON);
  assert.equal(chargeTicks(accelerated).at(-1).value, chargeTicks(normal).at(-1).value);
  assert.ok(chargeTicks(accelerated).length < chargeTicks(normal).length);
});

test('Dragon Slash scales from each minimum to maximum coefficient', () => {
  // Exercise charge scaling without freezing the authored balance coefficients.
  for (const skillId of [ID.DRAGON_SLASH_FORCE, ID.DRAGON_SLASH_BOOST, ID.DRAGON_SLASH_REACH]) {
    const skill = warriorCatalog.skillsById.get(skillId);
    const partial = simulate('Bladesworn', [ID.DRAGON_TRIGGER, { skillId, releaseAtCharges: 1 }], {
      initialResource: 100
    });
    const full = simulate('Bladesworn', [ID.DRAGON_TRIGGER, skillId], {
      initialResource: 100
    });
    const intermediate = simulate('Bladesworn', [ID.DRAGON_TRIGGER, { skillId, releaseAtCharges: 3 }], {
      initialResource: 100
    });

    assert.equal(
      partial.events.find((event) => event.type === 'damage' && event.skillId === skillId).coefficient,
      skill.dragonSlashMinimumCoefficient
    );
    assert.equal(
      full.events.find((event) => event.type === 'damage' && event.skillId === skillId).coefficient,
      skill.dragonSlashMaximumCoefficient
    );
    assert.ok(
      Math.abs(
        intermediate.events.find((event) => event.type === 'damage' && event.skillId === skillId).coefficient -
          (skill.dragonSlashMinimumCoefficient +
            (skill.dragonSlashMaximumCoefficient - skill.dragonSlashMinimumCoefficient) * (2 / 9))
      ) < 1e-9
    );
  }
});

test('Dragon Trigger utilities expose defense, shadowstep ammo, and cooldown reset', () => {
  const concurrentTrigger = simulate(
    'Bladesworn',
    [ID.OVERCHARGED_CARTRIDGES, { skillId: ID.DRAGON_TRIGGER, offset: 100 }],
    { initialResource: 100 }
  );

  assert.deepEqual(concurrentTrigger.warnings, ['Dragon Trigger cannot be cast concurrently.']);
  assert.equal(concurrentTrigger.steps.find((step) => step.skill === 'Dragon Trigger').invalid, true);
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
  // The mine clears a pending recharge rather than waiting for it to finish.
  const pending = simulate('Bladesworn', [ID.DRAGON_TRIGGER, { skillId: ID.DRAGON_SLASH_FORCE, releaseAtCharges: 1 }], {
    initialResource: 100
  });
  const cleared = simulate(
    'Bladesworn',
    [ID.DRAGON_TRIGGER, { skillId: ID.DRAGON_SLASH_FORCE, releaseAtCharges: 1 }, ID.DRAGONSPIKE_MINE],
    { initialResource: 100 }
  );
  assert.ok(pending.endState.cooldowns['Dragon Trigger'].remaining > 0);
  assert.equal(cleared.endState.cooldowns['Dragon Trigger'], undefined);
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

test('Paragon chant opening boons reach the caster and party', () => {
  // Each chant must share its opening boons with the caster as well as allied players.
  for (const [skillId, kinds] of [
    [ID.CHANT_OF_ACTION, ['might', 'fury']],
    [ID.CHANT_OF_RECUPERATION, ['vigor']],
    [ID.CHANT_OF_FREEDOM, ['stability']]
  ]) {
    const result = simulate('Paragon', [skillId], {
      initialResource: 10,
      allies: { count: 4 }
    });
    const boons = result.events.filter((event) => event.type === 'buff' && event.skillId === skillId);

    assert.deepEqual(result.warnings, []);
    assert.deepEqual(
      boons.map((event) => event.kind),
      kinds
    );
    for (const boon of boons) {
      assert.equal(boon.audience.recipients, 'party');
      assert.equal(boon.resolvedAudience.includesSelf, true);
      assert.equal(boon.resolvedAudience.alliedPlayerCount, 4);
    }
  }
});

test('Paragon Action refrain boons reach the caster and party', () => {
  const result = simulate('Paragon', [ID.CHANT_OF_ACTION, { type: 'wait', durationMs: 3100 }], {
    initialResource: 10,
    allies: { count: 4 }
  });
  const boons = result.events.filter((event) => event.type === 'buff' && event.skillId === ID.CHANT_OF_ACTION);
  const refrain = boons.filter((event) => event.at > boons[0].at);

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(
    refrain.map((event) => event.kind),
    ['might', 'fury']
  );
  for (const boon of refrain) {
    assert.equal(boon.audience.recipients, 'party');
    assert.equal(boon.resolvedAudience.includesSelf, true);
    assert.equal(boon.resolvedAudience.alliedPlayerCount, 4);
  }
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

test('Signet active buffs ignore boon duration and mastery requires activation', () => {
  // Concentration affects boons, but must not extend the signet's unique active buff.
  const active = (stats) =>
    simulate('Core', [ID.SIGNET_OF_FURY], { stats }).events.find((event) => event.kind === 'signet-of-fury-active');
  assert.equal(active({ concentration: 1500 }).duration, active({ concentration: 0 }).duration);

  const noAutomaticPrecast = simulate('Core', ['__combat_start'], {
    selectedTraitIds: [TRAIT.SIGNET_MASTERY]
  });

  assert.equal(
    noAutomaticPrecast.events.some((event) => event.kind === 'signet-mastery'),
    false
  );
});

test('Signet of Rage suspends passive adrenaline until its cooldown ends', () => {
  // Compare ready, cooling-down, and recovered states using the authored recharge duration.
  const config = { initialResource: 0, selectedSkills: ['Signet of Rage'] };
  const wait = { type: 'wait', durationMs: 6000 };
  const ready = simulate('Core', ['__combat_start', wait], config);
  const cooling = simulate('Core', ['__combat_start', ID.SIGNET_OF_RAGE, wait], config);
  const recovered = simulate(
    'Core',
    [
      '__combat_start',
      ID.SIGNET_OF_RAGE,
      {
        type: 'wait',
        durationMs: warriorCatalog.skillsById.get(ID.SIGNET_OF_RAGE).cooldown * 1000 + wait.durationMs
      }
    ],
    config
  );

  for (const result of [ready, cooling, recovered]) assert.deepEqual(result.warnings, []);
  assert.ok(ready.endState.profession.adrenaline > 0);
  assert.ok(cooling.endState.cooldowns['Signet of Rage'].remaining > 0);
  assert.equal(cooling.endState.profession.adrenaline, 0);
  assert.ok(recovered.endState.profession.adrenaline > 0);
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
  const effectPresentations = warriorProfession.ui.effectPresentations({
    specialization: 'Core',
    catalog: warriorProfession.catalog
  });

  assert.equal(
    Math.max(
      ...buildChartSeries(result, 100, effectPresentations).effects["Berserker's Power"].map((point) => point.v)
    ),
    4
  );
});

test('Eviscerate damage scales with adrenaline spent', () => {
  // Higher resource tiers select stronger burst damage without pinning balance values.
  const coefficients = [10, 20, 30].map((initialResource) => {
    const result = simulate('Core', [ID.EVISCERATE], { initialResource });
    assert.deepEqual(result.warnings, []);
    return result.events.find((event) => event.type === 'damage').coefficient;
  });
  assert.ok(coefficients[0] < coefficients[1]);
  assert.ok(coefficients[1] < coefficients[2]);
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
