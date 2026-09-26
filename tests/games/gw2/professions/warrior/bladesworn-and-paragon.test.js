import { assertFlooredDamageMultiplier } from '#tests/helpers/rounded-damage.js';
import assert from 'node:assert/strict';
import { canonicalTime } from '#kernel/core/clock.js';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { loadProfession, loadProfessionAppAdapter, professionOptions } from '#gw2/app/profession-registry.js';
import { buildChartSeries } from '#gw2/app/results/model.js';
import { skillBreakdownRows } from '#gw2/app/results/skill-breakdown.js';
import { warriorCatalog, warriorProfession } from '#gw2/professions/warrior/profession.js';
import { WARRIOR_SKILL_IDS as ID, WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import { createObservedProfessionSimulator } from '#tests/helpers/observed-runtime.js';
import {
  dragonChargeTickOffsetSeconds,
  dragonChargesForDurationMs
} from '#gw2/professions/warrior/data/dragon-charges.js';
import {
  DRAGON_TRIGGER_TICK_RESOURCE_REASON,
  dragonChargesToAdrenalineSpent
} from '#gw2/professions/warrior/specializations/bladesworn/mechanics/dragon-trigger.js';
import {
  BLADESWORN_BALANCE_PROFILE_IDS,
  BLADESWORN_BALANCE_PROFILES
} from '#gw2/professions/warrior/specializations/bladesworn/profiles.js';

// Read the balance profile the mechanic uses so balance patches cannot drift from these expectations.
const DRAGON_TRIGGER_PROFILE = BLADESWORN_BALANCE_PROFILES.find(
  ({ id }) => id === BLADESWORN_BALANCE_PROFILE_IDS.dragonTrigger
);
const DRAGON_TRIGGER_ENTRY_FLOW = DRAGON_TRIGGER_PROFILE.threshold;
const DRAGON_TRIGGER_TICK_FLOW = DRAGON_TRIGGER_PROFILE.resourceCost;
const DRAGON_TRIGGER_DURATION_SECONDS = DRAGON_TRIGGER_PROFILE.cooldown;

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

const simulate = createObservedProfessionSimulator(warriorProfession, baseConfig);

test('Bladesworn gates gunsaber and Dragon Slash state', () => {
  const blocked = simulate('Bladesworn', ['Swift Cut'], {
    initialResource: 100
  });

  assert.match(blocked.warnings[0], /Unsheathe the gunsaber/);
  assert.equal(blocked.planningState.profession.gunsaberActive, false);

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
  assert.equal(result.planningState.profession.gunsaberActive, true);
  assert.equal(result.planningState.profession.dragonTriggerActive, false);
  assert.equal(result.planningState.profession.maximumAdrenaline, 0);
  assert.equal(result.totalDamage > 0, true);
});

test('Sharp as the Wind selects condition Gunsaber variants and their secondary effects', () => {
  // Runtime-selected variants retain their parent presentation while using separate combat identities.
  for (const [parentId, variantId] of [
    [ID.SWIFT_CUT, ID.SHARP_SWIFT_CUT],
    [ID.STEEL_DIVIDE, ID.SHARP_STEEL_DIVIDE],
    [ID.EXPLOSIVE_THRUST, ID.SHARP_EXPLOSIVE_THRUST],
    [ID.BLOOMING_FIRE, ID.SHARP_BLOOMING_FIRE],
    [ID.ARTILLERY_SLASH, ID.SHARP_ARTILLERY_SLASH],
    [ID.CYCLONE_TRIGGER, ID.SHARP_CYCLONE_TRIGGER],
    [ID.BREAK_STEP, ID.SHARP_BREAK_STEP],
    [ID.DRAGON_SLASH_FORCE, ID.SHARP_DRAGON_SLASH_FORCE],
    [ID.DRAGON_SLASH_BOOST, ID.SHARP_DRAGON_SLASH_BOOST],
    [ID.DRAGON_SLASH_REACH, ID.SHARP_DRAGON_SLASH_REACH]
  ]) {
    assert.equal(warriorCatalog.skillsById.get(variantId).icon, warriorCatalog.skillsById.get(parentId).icon);
  }

  const result = simulate(
    'Bladesworn',
    [
      ID.UNSHEATHE_GUNSABER,
      ID.SWIFT_CUT,
      ID.STEEL_DIVIDE,
      ID.EXPLOSIVE_THRUST,
      ID.BLOOMING_FIRE,
      ID.ARTILLERY_SLASH,
      ID.CYCLONE_TRIGGER,
      ID.BREAK_STEP
    ],
    { initialResource: 100, selectedTraitIds: [TRAIT.SHARP_AS_THE_WIND] }
  );
  const conditionsFor = (skillId) =>
    result.events
      .filter((event) => event.type === 'condition' && event.skillId === skillId)
      .map(({ condition, stacks, duration }) => [condition, stacks, duration]);
  const coefficientsFor = (skillId) =>
    result.events
      .filter((event) => event.type === 'damage' && event.skillId === skillId)
      .map((event) => Number(event.coefficient.toFixed(6)));

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(coefficientsFor(ID.SHARP_SWIFT_CUT), [0.3, 0.1]);
  assert.deepEqual(conditionsFor(ID.SHARP_SWIFT_CUT), [['Bleeding', 2, 3]]);
  assert.deepEqual(coefficientsFor(ID.SHARP_STEEL_DIVIDE), [0.4, 0.1]);
  assert.deepEqual(conditionsFor(ID.SHARP_STEEL_DIVIDE), [['Bleeding', 1, 3]]);
  assert.deepEqual(coefficientsFor(ID.SHARP_EXPLOSIVE_THRUST), [0.6, 0.1]);
  assert.deepEqual(conditionsFor(ID.SHARP_EXPLOSIVE_THRUST), [['Bleeding', 1, 4]]);
  assert.deepEqual(coefficientsFor(ID.SHARP_BLOOMING_FIRE), [0.5, 0.1, 0.1, 0.1]);
  assert.deepEqual(conditionsFor(ID.SHARP_BLOOMING_FIRE), [
    ['Burning', 1, 3],
    ['Burning', 1, 3],
    ['Burning', 1, 3]
  ]);
  assert.deepEqual(coefficientsFor(ID.SHARP_ARTILLERY_SLASH), [2]);
  assert.deepEqual(conditionsFor(ID.SHARP_ARTILLERY_SLASH), [['Bleeding', 4, 7]]);
  assert.deepEqual(coefficientsFor(ID.SHARP_CYCLONE_TRIGGER), [1]);
  assert.deepEqual(conditionsFor(ID.SHARP_CYCLONE_TRIGGER), [
    ['Burning', 1, 5],
    ['Burning', 1, 5]
  ]);
  assert.equal(
    result.events.find(
      (event) => event.type === 'buff' && event.kind === 'aegis' && event.skillId === ID.SHARP_CYCLONE_TRIGGER
    )?.duration,
    5
  );
  assert.deepEqual(coefficientsFor(ID.SHARP_BREAK_STEP), [0.1]);
  assert.deepEqual(conditionsFor(ID.SHARP_BREAK_STEP), [['Burning', 1, 8]]);
  assert.equal(
    result.events.find((event) => event.type === 'damage' && event.skillId === ID.SHARP_ARTILLERY_SLASH)
      ?.comboFinishers?.[0]?.finisherType,
    'Projectile'
  );
  assert.equal(
    result.events.find((event) => event.type === 'damage' && event.skillId === ID.SHARP_BREAK_STEP)?.comboFinishers?.[0]
      ?.finisherType,
    'Leap'
  );
  assert.deepEqual(
    result.events
      .filter((event) => event.type === 'buff' && event.kind === 'positive-flow')
      .map(({ stacks, duration }) => [stacks, duration]),
    [[2, 5]]
  );
});

test('Sharp as the Wind scales each Dragon Slash burning payload with charge', () => {
  for (const [skillId, variantId, coefficient, minimumDuration, maximumDuration] of [
    [ID.DRAGON_SLASH_FORCE, ID.SHARP_DRAGON_SLASH_FORCE, 3, 2, 4],
    [ID.DRAGON_SLASH_BOOST, ID.SHARP_DRAGON_SLASH_BOOST, 2.4, 1.5, 3.25],
    [ID.DRAGON_SLASH_REACH, ID.SHARP_DRAGON_SLASH_REACH, 1.5, 1, 2]
  ]) {
    for (const [charges, expectedStacks, expectedDuration] of [
      [1, 1, minimumDuration],
      [5, 1 + (19 * 4) / 9, minimumDuration + ((maximumDuration - minimumDuration) * 4) / 9],
      [10, 20, maximumDuration]
    ]) {
      const result = simulate('Bladesworn', [ID.DRAGON_TRIGGER, { skillId, releaseAtCharges: charges }], {
        initialResource: 100,
        selectedTraitIds: [TRAIT.SHARP_AS_THE_WIND]
      });
      const damage = result.events.find((event) => event.type === 'damage' && event.skillId === variantId);
      const burning = result.events.filter(
        (event) => event.type === 'condition' && event.skillId === variantId && event.condition === 'Burning'
      );

      assert.deepEqual(result.warnings, []);
      assert.equal(damage.coefficient, coefficient);
      // Full stacks are independent applications; a final fractional packet preserves partial-charge scaling.
      assert.equal(
        burning.reduce((total, event) => total + event.stacks, 0),
        expectedStacks
      );
      assert.equal(burning.length, Math.ceil(expectedStacks));
      assert.ok(burning.every((event) => event.stacks > 0 && event.stacks <= 1 && event.duration === expectedDuration));
      assert.ok(burning.every((event) => event.at === damage.at));
    }
  }
});

test('Dragon Slash—Force lands 520ms after release', () => {
  for (const selectedTraitIds of [[], [TRAIT.SHARP_AS_THE_WIND]]) {
    const result = simulate('Bladesworn', [ID.DRAGON_TRIGGER, ID.DRAGON_SLASH_FORCE], {
      initialResource: 100,
      selectedTraitIds
    });
    const slash = result.steps.find((step) => step.skill === 'Dragon Slash—Force');
    const hit = result.events.find(
      (event) => event.type === 'damage' && [ID.DRAGON_SLASH_FORCE, ID.SHARP_DRAGON_SLASH_FORCE].includes(event.skillId)
    );

    assert.equal(canonicalTime(hit.at - slash.start / 1000), 0.52);
  }
});

test('Dragon Trigger spends its profile Flow cost on entry and expires after its profile duration', () => {
  const blocked = simulate('Bladesworn', ['Dragon Trigger'], {
    initialResource: DRAGON_TRIGGER_ENTRY_FLOW - 1
  });

  assert.match(blocked.warnings[0], new RegExp(`requires at least ${DRAGON_TRIGGER_ENTRY_FLOW} flow`));
  assert.equal(blocked.planningState.profession.flow, DRAGON_TRIGGER_ENTRY_FLOW - 1);

  const active = simulate('Bladesworn', ['Dragon Trigger'], {
    initialResource: DRAGON_TRIGGER_ENTRY_FLOW
  });

  assert.deepEqual(active.warnings, []);
  const entry = active.events.find((event) => event.type === 'resource' && event.reason === 'dragon trigger entry');

  // Entry consumes the minimum activation pool even before a charge tick is reached.
  assert.equal(entry.amount, -DRAGON_TRIGGER_ENTRY_FLOW);
  assert.equal(entry.value, 0);
  assert.equal(active.planningState.profession.flow, 0);
  assert.equal(entry.maximumFlow, 100);
  assert.equal(entry.deadline - entry.at, DRAGON_TRIGGER_DURATION_SECONDS);

  const expired = simulate(
    'Bladesworn',
    ['Dragon Trigger', { type: 'wait', durationMs: DRAGON_TRIGGER_DURATION_SECONDS * 1000 + 1 }],
    {
      initialResource: 100
    }
  );

  assert.equal(expired.planningState.profession.dragonTriggerActive, false);
  assert.equal(expired.planningState.profession.dragonCharges, 0);
});

test('Dragon Trigger entry covers the first interval and later charges spend Flow', () => {
  // Keep this charge before combat so passive regeneration cannot mask either resource deduction.
  const result = simulate(
    'Bladesworn',
    [
      ID.DRAGON_TRIGGER,
      { type: 'wait', durationMs: dragonChargeTickOffsetSeconds(2) * 1000 },
      { type: 'combat-start' }
    ],
    { initialResource: 100 }
  );
  assert.deepEqual(result.warnings, []);
  const entry = result.events.find((event) => event.reason === 'dragon trigger entry');
  const [first, second] = result.events.filter((event) => event.reason === DRAGON_TRIGGER_TICK_RESOURCE_REASON);
  assert.equal(entry.value, 100 - DRAGON_TRIGGER_ENTRY_FLOW);
  assert.equal(first.value, 1);
  assert.equal(first.at, 0.24);
  assert.equal(first.flowAfter, 100 - DRAGON_TRIGGER_ENTRY_FLOW);
  assert.equal(first.flowSpent, 0);
  assert.equal(second.value, 2);
  assert.equal(second.at, 0.48);
  assert.equal(second.flowAfter, 100 - DRAGON_TRIGGER_ENTRY_FLOW - DRAGON_TRIGGER_TICK_FLOW);
  assert.equal(second.flowSpent, DRAGON_TRIGGER_TICK_FLOW);
});

test('Dragon Trigger defers recharge while charging and still blocks re-entry', () => {
  const active = simulate('Bladesworn', [ID.DRAGON_TRIGGER, { type: 'wait', durationMs: 1000 }], {
    initialResource: 100
  });
  assert.deepEqual(active.warnings, []);
  assert.equal(active.planningState.profession.dragonTriggerActive, true);
  assert.equal(active.planningState.cooldowns['Dragon Trigger'], undefined);

  const repeated = simulate('Bladesworn', [ID.DRAGON_TRIGGER, ID.DRAGON_TRIGGER], { initialResource: 100 });
  assert.match(repeated.warnings[0], /Dragon Trigger is already active/);
});

test('Every Dragon Slash starts Dragon Trigger recharge at cast initiation', () => {
  // Check both skill variants and recharge modifiers without depending on a saved rotation.
  for (const skillId of [ID.DRAGON_SLASH_FORCE, ID.DRAGON_SLASH_BOOST, ID.DRAGON_SLASH_REACH]) {
    for (const selectedTraitIds of [[], [TRAIT.SHARP_AS_THE_WIND]]) {
      for (const alacrity of [false, true]) {
        const result = simulate('Bladesworn', [ID.DRAGON_TRIGGER, { skillId, releaseAtCharges: 1 }], {
          initialResource: 100,
          selectedTraitIds,
          boons: { alacrity }
        });
        const slash = result.steps.at(-1);
        assert.deepEqual(result.warnings, []);
        assert.equal(result.planningState.profession.dragonTriggerActive, false);
        assert.equal(result.planningState.cooldowns['Dragon Trigger'].readyAt, slash.start + 6400);
      }
    }
  }
});

test('Leaving Dragon Trigger starts recharge at the exit timestamp', () => {
  // Expiry uses its deadline even when a wait advances beyond it; sheathing waits for the shared swap cooldown.
  for (const [exit, exitAt] of [
    [{ type: 'wait', durationMs: 31000 }, 30000],
    [ID.SHEATHE_GUNSABER, 4000]
  ]) {
    const result = simulate(
      'Bladesworn',
      ['__combat_start', ID.DRAGON_TRIGGER, { type: 'wait', durationMs: 1000 }, exit],
      {
        initialResource: 100
      }
    );
    assert.deepEqual(result.warnings, []);
    assert.equal(result.planningState.profession.dragonTriggerActive, false);
    assert.equal(result.planningState.profession.dragonCharges, 0);
    assert.equal(result.planningState.cooldowns['Dragon Trigger'].readyAt, exitAt + 6400);
  }
});

test('Dragon Trigger spends Flow at fixed 240 ms intervals', () => {
  assert.deepEqual(
    Array.from({ length: 10 }, (_, index) => dragonChargeTickOffsetSeconds(index + 1) * 1000),
    [240, 480, 720, 960, 1200, 1440, 1680, 1920, 2160, 2400]
  );
  assert.deepEqual(
    Array.from({ length: 5 }, (_, index) => dragonChargeTickOffsetSeconds(index + 1) * 1000),
    [240, 480, 720, 960, 1200]
  );
  assert.equal(dragonChargesForDurationMs(1240, 10, 1), 5);
  assert.equal(dragonChargesForDurationMs(720, 10, 2), 6);

  for (const [rotation, expectedSeconds] of [
    [[ID.DRAGON_TRIGGER, ID.DRAGON_SLASH_FORCE], 2.4],
    [[ID.TACTICAL_RELOAD, ID.DRAGON_TRIGGER, ID.DRAGON_SLASH_FORCE], 1.2]
  ]) {
    const result = simulate('Bladesworn', rotation, { initialResource: 100 });
    const release = result.events.find(
      (event) =>
        event.type === 'resource' && event.resource === 'dragon charges' && event.reason === 'profession mechanic'
    );
    assert.equal(release.chargingSeconds, expectedSeconds);
    assert.equal(release.flowSpent, (expectedSeconds / 0.24 - 1) * DRAGON_TRIGGER_TICK_FLOW);
    const entry = result.events.find((event) => event.reason === 'dragon trigger entry');
    const ticks = result.events.filter((event) => event.reason === 'dragon trigger charge');
    if (expectedSeconds === 2.4) assert.ok(Math.abs(ticks.at(-1).flowAfter - 40) < 1e-9);
    assert.deepEqual(
      ticks.map((tick) => canonicalTime(tick.at - entry.at)),
      Array.from({ length: expectedSeconds / 0.24 }, (_, index) => ((index + 1) * 240) / 1000)
    );
  }
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
      },
      { kind: 'tail', durationMs: 1 }
    );

    assert.deepEqual(result.warnings, []);
    const spend = result.events.find(
      (event) =>
        event.type === 'resource' && event.resource === 'dragon charges' && event.reason === 'profession mechanic'
    );
    const slash = result.events.find((event) => event.type === 'action' && event.skillName === 'Dragon Slash—Force');
    const berserkersPower = result.events.find((event) => event.type === 'buff' && event.name === "Berserker's Power");

    assert.equal(spend.adrenalineBarsSpent, bars);
    assert.equal(berserkersPower.stacks, powerStacks);
    assert.equal(berserkersPower.at, slash.endsAt);
    assert.equal(berserkersPower.priority, 5);
    assert.equal(
      result.events.find((event) => event.type === 'buff' && event.name === 'Burst Precision').duration,
      precisionDuration
    );
  }
});

test('Burst Mastery restores twenty percent of Dragon Slash Flow spent', () => {
  const rotation = ['Dragon Trigger', { name: 'Dragon Slash—Force', releaseAtCharges: 4 }];
  const baseline = simulate('Bladesworn', rotation, { initialResource: 100 }, { kind: 'tail', durationMs: 1 });
  const mastered = simulate(
    'Bladesworn',
    rotation,
    {
      initialResource: 100,
      selectedTraitIds: [TRAIT.BURST_MASTERY]
    },
    { kind: 'tail', durationMs: 1 }
  );

  const slash = mastered.events.find((event) => event.type === 'action' && event.skillName === 'Dragon Slash—Force');
  const swiftness = mastered.events.find(
    (event) => event.type === 'buff' && event.sourceId === TRAIT.BURST_MASTERY && event.kind === 'swiftness'
  );
  assert.equal(mastered.planningState.profession.flow - baseline.planningState.profession.flow, 3);
  assert.equal(swiftness.duration, 3);
  assert.equal(swiftness.at, slash.endsAt);
  assert.equal(swiftness.priority, 5);
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
  assert.equal(braveStride.planningState.profession.flow - baseline.planningState.profession.flow, 5);

  const berserkerBaseline = simulate('Berserker', [ID.SUNDERING_LEAP]);
  const berserkerBraveStride = simulate('Berserker', [ID.SUNDERING_LEAP], {
    selectedTraitIds: [TRAIT.BRAVE_STRIDE]
  });
  assert.equal(
    berserkerBraveStride.planningState.profession.adrenaline - berserkerBaseline.planningState.profession.adrenaline,
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
    assert.equal(result.planningState.profession.dragonTriggerActive, false);
    assert.equal(result.planningState.profession.dragonCharges, 0);
  }
});

test('Dragon Trigger stalls below its Flow cost and resumes after rebuilding', () => {
  const result = simulate(
    'Bladesworn',
    ['__combat_start', 'Dragon Trigger', { name: 'Dragon Slash—Force', releaseAtCharges: 4 }],
    {
      initialResource: 15
    }
  );

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
      event.type === 'resource' && event.reason === 'profession mechanic' && event.skillId === ID.DRAGON_SLASH_FORCE
  );

  assert.equal(spend.amount, -4);
  assert.equal(spend.activationId, result.steps.find((step) => step.skillId === ID.DRAGON_SLASH_FORCE).activationId);
  assert.equal(spend.flowSpent, 15);
  assert.equal(spend.adrenalineBarsSpent, 1);
});

test('Flow balance accounts for Stabilizer, entry spending, regeneration, and stalled charges', () => {
  const result = simulate(
    'Bladesworn',
    ['__combat_start', ID.FLOW_STABILIZER, ID.DRAGON_TRIGGER, ID.DRAGON_SLASH_FORCE],
    {
      initialResource: 0,
      boons: { fury: true }
    }
  );
  const entry = result.events.find((event) => event.reason === 'dragon trigger entry');
  const ticks = result.events.filter((event) => event.reason === DRAGON_TRIGGER_TICK_RESOURCE_REASON);

  // Independently balance every charge: Fury's 15 pays entry, while base and Stabilizer regenerate on 40 ms ticks.
  assert.deepEqual(result.warnings, []);
  assert.equal(entry.value, 0);
  assert.equal(entry.amount, -DRAGON_TRIGGER_ENTRY_FLOW);
  for (const tick of ticks) {
    const regenerationTicks = Math.floor(Math.round(tick.at * 1_000_000) / 40_000);
    const gained = regenerationTicks * 0.08 + Math.min(regenerationTicks, 200) * 0.16;
    assert.ok(Math.abs(tick.flowAfter - (gained - (tick.value - 1) * DRAGON_TRIGGER_TICK_FLOW)) < 1e-9);
  }

  assert.ok(ticks.some((tick) => !tick.granted));
  assert.equal(ticks.at(-1).value, 10);
  assert.equal(
    result.events.find((event) => event.resource === 'dragon charges' && event.reason === 'profession mechanic')
      .flowSpent,
    45
  );
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
  assert.match(slash.invalidReason, /it reached 1/);
  assert.equal(
    result.events.some((event) => event.type === 'damage' && event.skillId === ID.DRAGON_SLASH_FORCE),
    false
  );
});

test('Bladesworn preserves partial charge time across fragmented advancement', () => {
  // Cursor waits must not reset the live charge cadence or resource tick owner.
  const charge = (durations) =>
    simulate(
      'Bladesworn',
      ['__combat_start', ID.DRAGON_TRIGGER, ...durations.map((durationMs) => ({ type: 'wait', durationMs }))],
      { initialResource: 100 }
    ).planningState.profession;
  assert.equal(charge([50, 50, 50, 50]).dragonCharges, 0);
  assert.equal(charge([50, 50, 50, 50, 40]).dragonCharges, 1);
  const fragmented = charge([50, 50, 50, 50, 40, 240, 280, 240, 240, 240, 240, 280, 240, 240]);
  const combined = charge([2480]);
  assert.equal(fragmented.dragonCharges, 10);
  assert.equal(fragmented.dragonCharges, combined.dragonCharges);
  assert.ok(Math.abs(fragmented.flow - combined.flow) < 1e-9);
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
  assert.equal(spent.planningState.ammo['Artillery Slash'].charges, 0);
  assert.equal(reloaded.planningState.ammo['Artillery Slash'].charges, 1);
  assert.equal(fired.planningState.ammo['Artillery Slash'].charges, 0);
  assert.equal(hits.length, 2);
  assert.ok(hits[0].coefficient > hits[1].coefficient);
  assert.ok(fired.events.some((event) => event.skillId === ID.ARTILLERY_SLASH && event.controlKind === 'daze'));
});

test("Dragon's Roar consumes its magazine and Gunstinger reloads it", () => {
  const spent = simulate('Bladesworn', [ID.DRAGONS_ROAR]);
  const reloaded = simulate('Bladesworn', [ID.DRAGONS_ROAR, ID.GUNSTINGER]);
  const fired = simulate('Bladesworn', [ID.DRAGONS_ROAR, ID.GUNSTINGER, ID.DRAGONS_ROAR]);

  for (const result of [spent, reloaded, fired]) assert.deepEqual(result.warnings, []);
  assert.equal(spent.planningState.ammo["Dragon's Roar"].charges, 0);
  assert.ok(reloaded.planningState.ammo["Dragon's Roar"].charges > 0);
  assert.equal(fired.planningState.ammo["Dragon's Roar"].charges, 0);
});

test('Gunsaber attacks resolve bundle strength and distinguish secondary explosions', () => {
  // Mixed attacks need separate tags so explosion modifiers cannot affect their ordinary strikes.
  for (const skillId of [ID.EXPLOSIVE_THRUST, ID.BLOOMING_FIRE]) {
    const result = simulate('Bladesworn', [ID.UNSHEATHE_GUNSABER, ID.SWIFT_CUT, ID.STEEL_DIVIDE, skillId]);
    const hits = result.resolvedEvents.filter((event) => event.type === 'damage' && event.skillId === skillId);

    assert.deepEqual(result.warnings, []);
    assert.ok(hits.some((event) => event.damageKind === 'explosion'));
    assert.ok(hits.some((event) => event.damageKind !== 'explosion'));
    assert.ok(hits.every((event) => event.weaponStrengthProfileId === 'bundle.exotic'));
  }
});

test('Precombat Positive Flow survives an explicit combat start while base regeneration waits for combat', () => {
  // The 8 s Positive Flow window grants 4 Flow/s before combat; the 2 Flow/s base rate only starts at the marker.
  const precombat = simulate('Bladesworn', [ID.FLOW_STABILIZER, { type: 'wait', durationMs: 8500 }, '__combat_start'], {
    initialResource: 0
  });

  assert.deepEqual(precombat.warnings, []);
  assert.ok(Math.abs(precombat.planningState.profession.flow - 32) < 1e-9);
  for (const [atSeconds, value] of [
    [8.49, '0 stacks'],
    [8.5, '1 stack']
  ]) {
    const display = warriorProfession.ui
      .rotationStateSnapshot({
        specialization: 'Bladesworn',
        professionState: precombat.planningState.profession,
        atSeconds,
        result: precombat
      })
      .find((item) => item.id === 'positive-flow');
    assert.equal(display.value, value);
  }
});

test('Flow Stabilizer, Tactical Reload, and adrenaline conversion drive Flow', () => {
  const baseline = simulate('Bladesworn', ['__combat_start', { type: 'wait', durationMs: 9000 }], {
    initialResource: 0
  });

  assert.ok(Math.abs(baseline.planningState.profession.flow - 18) < 1e-9);

  const stabilized = simulate(
    'Bladesworn',
    ['__combat_start', ID.FLOW_STABILIZER, { type: 'wait', durationMs: 8500 }],
    {
      initialResource: 0
    }
  );
  const unstabilized = simulate('Bladesworn', ['__combat_start', { type: 'wait', durationMs: 8500 }], {
    initialResource: 0
  });

  // The 8.5 s observation includes regeneration through the 8.48 s tick.
  assert.ok(Math.abs(stabilized.planningState.profession.flow - 48.96) < 1e-9);
  assert.ok(Math.abs(unstabilized.planningState.profession.flow - 16.96) < 1e-9);
  assert.ok(
    Math.abs(stabilized.planningState.profession.flow - unstabilized.planningState.profession.flow - 32) < 1e-9
  );
  assert.equal(
    stabilized.events.some(
      (event) => event.type === 'buff' && event.kind === 'positive-flow' && event.stacks === 2 && event.duration === 8
    ),
    true
  );

  // A reload preserves count recharge even when it briefly fills the magazine.
  const spent = simulate('Bladesworn', ['__combat_start', ID.FLOW_STABILIZER]);
  const retainedRecharge = simulate('Bladesworn', [
    '__combat_start',
    ID.FLOW_STABILIZER,
    ID.TACTICAL_RELOAD,
    ID.FLOW_STABILIZER
  ]);

  assert.deepEqual(retainedRecharge.warnings, []);
  assert.equal(
    retainedRecharge.planningState.ammo['Flow Stabilizer'].charges,
    spent.planningState.ammo['Flow Stabilizer'].charges
  );
  assert.ok(spent.planningState.ammo['Flow Stabilizer'].nextRechargeAt > 0);
  assert.equal(
    retainedRecharge.planningState.ammo['Flow Stabilizer'].nextRechargeAt,
    spent.planningState.ammo['Flow Stabilizer'].nextRechargeAt
  );

  const overlapping = simulate(
    'Bladesworn',
    [
      '__combat_start',
      { type: 'wait', durationMs: 2000 },
      ID.FLOW_STABILIZER,
      { type: 'wait', durationMs: 2000 },
      ID.FLOW_STABILIZER,
      { type: 'wait', durationMs: 4000 }
    ],
    { initialResource: 0 }
  );

  assert.ok(Math.abs(overlapping.planningState.profession.flow - 71) < 1e-9);
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
      professionState: overlapping.planningState.profession,
      atSeconds: overlapping.planningState.atSeconds,
      result: overlapping
    })
    .find((item) => item.id === 'positive-flow');

  assert.deepEqual(positiveFlowState, {
    id: 'positive-flow',
    label: 'Positive Flow',
    value: '5 stacks · 2.0s',
    title: 'Positive Flow (5 stacks; time until the next temporary stack expires)'
  });

  const firstCast = simulate('Bladesworn', ['__combat_start', ID.FLOW_STABILIZER], {
    initialResource: 0
  });
  const castWithFury = simulate('Bladesworn', ['__combat_start', ID.FLOW_STABILIZER], {
    initialResource: 0,
    boons: { fury: true }
  });

  assert.equal(firstCast.planningState.profession.flow, 0);
  assert.equal(castWithFury.planningState.profession.flow, 15);

  const converted = simulate('Bladesworn', ['__combat_start', ID.SIGNET_OF_FURY], {
    initialResource: 0
  });

  const idle = simulate(
    'Bladesworn',
    ['__combat_start', { type: 'wait', durationMs: converted.planningState.atSeconds * 1000 }],
    {
      initialResource: 0
    }
  );
  assert.ok(
    Math.abs(
      converted.planningState.profession.flow -
        idle.planningState.profession.flow -
        warriorCatalog.skillsById.get(ID.SIGNET_OF_FURY).adrenalineGain
    ) < 1e-9
  );
  assert.equal(converted.planningState.profession.adrenaline, 0);

  const accelerated = simulate(
    'Bladesworn',
    ['__combat_start', ID.TACTICAL_RELOAD, ID.DRAGON_TRIGGER, ID.DRAGON_SLASH_FORCE],
    {
      initialResource: 100
    }
  );

  assert.deepEqual(accelerated.warnings, []);
  const normal = simulate('Bladesworn', ['__combat_start', ID.DRAGON_TRIGGER, ID.DRAGON_SLASH_FORCE], {
    initialResource: 100
  });
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

  assert.deepEqual(concurrentTrigger.warnings, ['Dragon Trigger: Dragon Trigger cannot be cast concurrently.']);
  assert.equal(concurrentTrigger.steps.find((step) => step.skill === 'Dragon Trigger').invalid, true);
  const utility = simulate('Bladesworn', [ID.DRAGON_TRIGGER, ID.TRIGGERGUARD, ID.FLICKER_STEP], {
    initialResource: 100
  });

  assert.deepEqual(utility.warnings, []);
  assert.equal(
    utility.events.some((event) => event.type === 'buff' && event.kind === 'aegis'),
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
  assert.ok(pending.planningState.cooldowns['Dragon Trigger'].remaining > 0);
  assert.equal(cleared.planningState.cooldowns['Dragon Trigger'], undefined);
  assert.equal(
    reset.events.some(
      (event) => event.type === 'damage' && event.skillId === ID.DRAGONSPIKE_MINE && event.damageKind === 'explosion'
    ),
    true
  );
});

// Peitha triggers on activation and lands after the skill's measured missile travel, not the relic default.
test('Flicker Step triggers Peitha on activation with its measured impact delay', () => {
  const result = simulate('Bladesworn', [ID.DRAGON_TRIGGER, ID.FLICKER_STEP, { name: '__wait', waitMs: 1000 }], {
    initialResource: 100,
    relic: 'Peitha'
  });
  const cast = result.events.find((event) => event.type === 'action' && event.skillId === ID.FLICKER_STEP);
  const triggers = result.events.filter((event) => event.type === 'peitha');
  const torment = result.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.skillName === 'Relic of Peitha'
  );

  assert.deepEqual(result.warnings, []);
  assert.equal(triggers.length, 1);
  assert.equal(triggers[0].at, cast.at);
  assert.equal(torment.length, 1);
  assert.ok(Math.abs(torment[0].at - cast.at - 0.24) < 1e-9);
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
  // Blooming Fire floors each of its three explosions separately before their damage is summed.
  assertFlooredDamageMultiplier(strikeDamage(overcharged, 'explosion'), strikeDamage(base, 'explosion'), 1.15, 3);
  assertFlooredDamageMultiplier(strikeDamage(supercharged, 'explosion'), strikeDamage(base, 'explosion'), 1.2, 3);
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
  assertFlooredDamageMultiplier(roarDamage(roarSupercharged), roarDamage(roarBase), 1.2);

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
  assert.equal(locked.planningState.ammo['Overcharged Cartridges'].charges, 0);
  assert.equal(
    locked.planningState.profession.overchargedCartridgeWindows.find((window) => window.supercharged).expiresAt,
    canonicalTime(lockedBuffs[1].at + 8)
  );
});

test('Paragon weapon bursts spend one of three adrenaline bars', () => {
  const result = simulate('Paragon', ['Eviscerate'], { initialResource: 30 });

  assert.deepEqual(result.warnings, []);
  assert.equal(result.planningState.profession.maximumAdrenaline, 30);
  // The burst spends ten, then its hit restores one adrenaline.
  assert.equal(result.planningState.profession.adrenaline, 21);
});

test('Paragon chants consume adrenaline and start a refrain', () => {
  const result = simulate('Paragon', ['Chant of Action'], {
    initialResource: 30
  });

  assert.deepEqual(result.warnings, []);
  assert.equal(result.planningState.profession.maximumAdrenaline, 30);
  assert.equal(result.planningState.profession.adrenaline, 20);
  assert.equal(result.planningState.profession.motivation, 4);
  assert.equal(result.planningState.profession.activeRefrain, 'Chant of Action');
  assert.equal(
    result.events.some((event) => event.type === 'warrior.paragon-state'),
    false
  );
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

  assert.equal(result.planningState.profession.motivation, 3);
});

test('Rally the Valiant grants motivation when a burst starts', () => {
  const selectedTraitIds = [TRAIT.CALL_TO_ACTION, TRAIT.RALLY_THE_VALIANT];
  const result = simulate('Paragon', ['__combat_start', 'Breaching Strike'], {
    initialResource: 10,
    selectedTraitIds
  });

  assert.equal(result.planningState.profession.motivation, 8);
  assert.equal(
    result.events.some((event) => event.type === 'warrior.paragon-state'),
    false
  );

  const withoutRally = simulate('Paragon', ['__combat_start', 'Breaching Strike'], {
    initialResource: 10,
    selectedTraitIds: [TRAIT.CALL_TO_ACTION]
  });

  assert.equal(withoutRally.planningState.profession.motivation, 4);
});

test('Signet active buffs ignore boon duration and mastery requires activation', () => {
  // Concentration affects boons, but must not extend the signet's unique active buff.
  const active = (stats) =>
    simulate('Core', [ID.SIGNET_OF_FURY], { stats }).events.find((event) => event.kind === 'signet-of-fury-active');
  assert.equal(active({ concentration: 1500 }).duration, active({ concentration: 0 }).duration);

  const mastered = simulate('Core', [ID.SIGNET_OF_FURY], { selectedTraitIds: [TRAIT.SIGNET_MASTERY] });
  const action = mastered.events.find((event) => event.type === 'action' && event.skillId === ID.SIGNET_OF_FURY);
  assert.equal(mastered.events.find((event) => event.kind === 'signet-mastery').at, action.endsAt);

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
  assert.ok(ready.planningState.profession.adrenaline > 0);
  assert.ok(cooling.planningState.cooldowns['Signet of Rage'].remaining > 0);
  assert.equal(cooling.planningState.profession.adrenaline, 0);
  assert.ok(recovered.planningState.profession.adrenaline > 0);
});

test('Lesser Signet of Might procs use the signet skill icon', () => {
  const result = simulate('Core', ['Throw Bolas'], {
    selectedTraitIds: [TRAIT.SIGNET_MASTERY],
    target: { health: 1 }
  });
  const proc = result.procSteps.find((step) => step.skill === 'Lesser Signet of Might');
  const strike = result.events.find((event) => event.type === 'damage' && event.skillId === ID.THROW_BOLAS);
  const lesser = result.resolvedEvents.find((event) => event.skillName === 'Lesser Signet of Might');

  assert.equal(proc?.icon, warriorCatalog.skillsById.get(ID.SIGNET_OF_MIGHT).icon);
  assert.equal(lesser.at, strike.at);
  assert.equal(lesser.priority, 5);
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

test('two-stack Gunsaber traits grant and display their full Positive Flow rate until expiry', () => {
  // Trait packets, resource integration, and the state bar must agree on the same two-stack, five-second window.
  for (const trait of [TRAIT.UNSEEN_SWORD, TRAIT.SHARP_AS_THE_WIND]) {
    for (const [durationMs, expectedFlow] of [
      [1000, 6],
      [6000, 32]
    ]) {
      const result = simulate('Bladesworn', ['__combat_start', ID.UNSHEATHE_GUNSABER, { type: 'wait', durationMs }], {
        initialResource: 0,
        selectedTraitIds: [trait]
      });
      assert.deepEqual(result.warnings, []);
      const buff = result.events.find((event) => event.kind === 'positive-flow');
      assert.equal(buff.stacks, 2);
      assert.equal(buff.duration, 5);
      assert.ok(Math.abs(result.planningState.profession.flow - expectedFlow) < 1e-9);
      const display = warriorProfession.ui
        .rotationStateSnapshot({
          specialization: 'Bladesworn',
          professionState: result.planningState.profession,
          atSeconds: result.planningState.atSeconds,
          result
        })
        .find((item) => item.id === 'positive-flow');
      assert.equal(display?.value, durationMs === 1000 ? '3 stacks · 4.0s' : '1 stack');
    }
  }
});

test('Bladesworn swap and Dragon Trigger traits use supplied behavior', () => {
  // Without an explicit marker, combat begins at the first hit; an earlier unsheathe is out of combat.
  const outOfCombat = simulate('Bladesworn', ['Unsheathe Gunsaber', { type: 'wait', durationMs: 5000 }], {
    initialResource: 0,
    selectedTraitIds: [TRAIT.UNSEEN_SWORD]
  });

  assert.equal(
    outOfCombat.events.some((event) => event.name === 'Unseen Sword' || event.kind === 'positive-flow'),
    false
  );

  const afterFirstHit = simulate('Bladesworn', ['Chop', 'Unsheathe Gunsaber'], {
    initialResource: 0,
    primaryWeapon: 'Axe',
    secondaryWeapon: 'Axe',
    selectedTraitIds: [TRAIT.UNSEEN_SWORD]
  });
  const firstChopHit = afterFirstHit.events.find((event) => event.type === 'damage' && event.skillId === ID.CHOP);
  const unseenSword = afterFirstHit.events.filter((event) => event.type === 'damage' && event.name === 'Unseen Sword');

  assert.equal(unseenSword.length, 1);
  assert.ok(unseenSword[0].at >= firstChopHit.at);
  // Trait activations reach the panel with their actual trigger, alongside their separate damage packet.
  const swordProcs = afterFirstHit.procSteps.filter((proc) => proc.skill === 'Unseen Sword');
  assert.equal(swordProcs.length, 1);
  assert.equal(swordProcs[0].type, 'trait_proc');
  assert.equal(swordProcs[0].sourceSkill, 'Unsheathe Gunsaber');
  assert.equal(swordProcs[0].start, Math.round(unseenSword[0].at * 1000));

  const swap = simulate('Bladesworn', ['__combat_start', 'Unsheathe Gunsaber', { type: 'wait', durationMs: 5000 }], {
    initialResource: 0,
    selectedTraitIds: [TRAIT.UNSEEN_SWORD]
  });

  assert.equal(swap.events.find((event) => event.name === 'Unseen Sword').coefficient, 1.2);
  assert.equal(swap.resolvedEvents.find((event) => event.name === 'Unseen Sword').skillId, 62847);
  assert.equal(skillBreakdownRows(swap).find((entry) => entry.name === 'Unseen Sword').hits, 1);
  assert.equal(swap.events.find((event) => event.kind === 'positive-flow').duration, 5);
  assert.ok(Math.abs(swap.planningState.profession.flow - 30) < 1e-9);

  const combatOnly = simulate(
    'Bladesworn',
    ['Unsheathe Gunsaber', 'Sheathe Gunsaber', '__combat_start', 'Dragon Trigger'],
    {
      initialResource: 100,
      selectedTraitIds: [TRAIT.UNSEEN_SWORD]
    }
  );

  // Precombat swaps must not proc the trait, regardless of the time spent waiting for swap cooldowns.
  assert.deepEqual(
    combatOnly.resolvedEvents.filter((event) => event.name === 'Unseen Sword').map((event) => event.at),
    [combatOnly.events.find((event) => event.type === 'combat_start').at]
  );
  const triggerProcs = combatOnly.procSteps.filter((proc) => proc.skill === 'Unseen Sword');
  assert.equal(triggerProcs.length, 1);
  assert.equal(triggerProcs[0].sourceSkill, 'Dragon Trigger');

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
    trigger.events.some((event) => event.controlKind === 'stun'),
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
  bolasHits.forEach((hit, index) => assertFlooredDamageMultiplier(hit.damage, baselineBolasHits[index].damage, 1.15));
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
  const coefficients = [10, 20, 30].map((initialResource) => {
    const result = simulate('Core', [ID.EVISCERATE], { initialResource });
    assert.deepEqual(result.warnings, []);
    return result.events.find((event) => event.type === 'damage').coefficient;
  });
  const eviscerate = warriorCatalog.skillsById.get(ID.EVISCERATE);

  assert.deepEqual(coefficients, [2, 2.5, 3]);
  assert.equal(eviscerate.cooldown, 8);
  assert.equal(eviscerate.comboFinishers[0].finisherType, 'Leap');
  assert.deepEqual(
    eviscerate.effects.find((effect) => effect.type === 'boon'),
    {
      type: 'boon',
      boon: 'might',
      duration: 5,
      stacks: 5
    }
  );
});

test('Warrior is exposed through the shared application registry', async () => {
  assert.equal(
    professionOptions.some((profession) => profession.id === 'warrior'),
    true
  );
  assert.equal(await loadProfession('warrior'), warriorProfession);
  assert.equal(typeof (await loadProfessionAppAdapter('warrior')).recalculate, 'function');

  const html = await readFile(new URL('../../../../../dist/site/warrior.html', import.meta.url), 'utf8');

  assert.match(html, /data-profession="warrior"/);
  assert.match(html, /assets\/entry-[^"']+\.js/);
});
