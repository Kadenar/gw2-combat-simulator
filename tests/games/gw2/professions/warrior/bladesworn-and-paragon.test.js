import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
import { BOON } from '#gw2/platform/constants.js';
import { baseAttributeInputs } from '#gw2/platform/attributes/inputs.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { assertFlooredDamageMultiplier } from '#tests/helpers/rounded-damage.js';
import assert from 'node:assert/strict';
import { canonicalTime } from '#kernel/core/clock.js';
import test from 'node:test';
import { buildChartSeries } from '#gw2/app/results/model.js';
import { warriorCatalog, warriorProfession } from '#gw2/professions/warrior/profession.js';
import { WARRIOR_SKILL_IDS as ID, WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import { createObservedProfessionSimulator, observedRuntime } from '#tests/helpers/observed-runtime.js';
import { dragonChargeTickOffsetSeconds } from '#gw2/professions/warrior/data/dragon-charges.js';
import {
  DRAGON_TRIGGER_TICK_RESOURCE_REASON,
  dragonChargesToAdrenalineSpent
} from '#gw2/professions/warrior/specializations/bladesworn/mechanics/dragon-trigger.js';

// Resource contracts read the selected skill's charging parameters.
const DRAGON_TRIGGER_SKILL = warriorProfession.catalog.skillsById.get(ID.DRAGON_TRIGGER);
const DRAGON_TRIGGER_ENTRY_FLOW = DRAGON_TRIGGER_SKILL.entryResourceCost;
const DRAGON_TRIGGER_TICK_FLOW = DRAGON_TRIGGER_SKILL.resourceCost;
const DRAGON_TRIGGER_DURATION_SECONDS = DRAGON_TRIGGER_SKILL.duration;

const baseConfig = Object.freeze({
  attributeInputs: baseAttributeInputs({
    power: 2000,
    precision: 1500,
    ferocity: 500,
    conditionDamage: 1000,
    expertise: 0,
    vitality: 1000
  }),
  target: {
    armor: 2597,
    health: 3_970_000,
    defiant: true,
    conditions: { Vulnerability: 25 }
  }
});

const simulate = createObservedProfessionSimulator(warriorProfession, baseConfig);

test('Bladesworn gates gunsaber and Dragon Slash state', () => {
  const blocked = simulate('Bladesworn', [{ type: 'cast', skillId: 62966 }], {
    initialResource: 100
  });

  assert.match(blocked.warnings[0].message, /Unsheathe the gunsaber/);
  assert.equal(blocked.planningState.profession[STATE.GUNSABER_ACTIVE], false);

  const standardWeaponBlocked = simulate('Bladesworn', ['Unsheathe Gunsaber', 'Chop'], {
    initialResource: 100,
    primaryWeapon: 'Axe',
    secondaryWeapon: 'Axe'
  });

  assert.match(standardWeaponBlocked.warnings[0].message, /Sheathe the gunsaber/);

  const result = simulate(
    'Bladesworn',
    ['Unsheathe Gunsaber', { type: 'cast', skillId: 62966 }, 'Dragon Trigger', { type: 'cast', skillId: 62797 }],
    {
      initialResource: 100
    }
  );

  assert.deepEqual(result.warnings, []);
  assert.equal(result.planningState.profession[STATE.GUNSABER_ACTIVE], true);
  assert.equal(result.planningState.profession[STATE.DRAGON_TRIGGER_ACTIVE], false);
  assert.equal(result.planningState.profession[STATE.ADRENALINE].maximum, 0);
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
    result.resolvedEvents
      .filter((event) => event.type === 'condition' && event.skillId === skillId)
      .map(({ condition, stacks, duration }) => [condition, stacks, duration]);
  const coefficientsFor = (skillId) =>
    result.events
      .filter((event) => event.type === 'damage' && event.skillId === skillId)
      .map((event) => Number(event.coefficient.toFixed(6)));

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(coefficientsFor(ID.SHARP_SWIFT_CUT), [0.3, 0.1]);
  assert.deepEqual(conditionsFor(ID.SHARP_SWIFT_CUT), [
    ['Bleeding', 1, 3],
    ['Bleeding', 1, 3]
  ]);
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
  assert.deepEqual(
    conditionsFor(ID.SHARP_ARTILLERY_SLASH),
    Array.from({ length: 4 }, () => ['Bleeding', 1, 7])
  );
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
      const burning = result.resolvedEvents.filter(
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

test('Dragon Trigger spends its skill Flow cost on entry and expires after its skill duration', () => {
  const blocked = simulate('Bladesworn', ['Dragon Trigger'], {
    initialResource: DRAGON_TRIGGER_ENTRY_FLOW - 1
  });

  assert.match(blocked.warnings[0].message, new RegExp(`requires at least ${DRAGON_TRIGGER_ENTRY_FLOW} flow`));
  assert.equal(blocked.planningState.profession[STATE.FLOW].value, DRAGON_TRIGGER_ENTRY_FLOW - 1);

  const active = simulate('Bladesworn', ['Dragon Trigger'], {
    initialResource: DRAGON_TRIGGER_ENTRY_FLOW
  });

  assert.deepEqual(active.warnings, []);
  const entry = active.events.find((event) => event.type === 'resource' && event.reason === 'dragon trigger entry');

  // Entry consumes the minimum activation pool even before a charge tick is reached.
  assert.equal(entry.amount, -DRAGON_TRIGGER_ENTRY_FLOW);
  assert.equal(entry.value, 0);
  assert.equal(active.planningState.profession[STATE.FLOW].value, 0);
  assert.equal(entry.deadline - entry.at, DRAGON_TRIGGER_DURATION_SECONDS);

  const expired = simulate(
    'Bladesworn',
    ['Dragon Trigger', { type: 'wait', durationMs: DRAGON_TRIGGER_DURATION_SECONDS * 1000 + 1 }],
    {
      initialResource: 100
    }
  );

  assert.equal(expired.planningState.profession[STATE.DRAGON_TRIGGER_ACTIVE], false);
  assert.equal(expired.planningState.profession[STATE.DRAGON_CHARGES].value, 0);
});

test('Dragon Trigger entry covers the first interval and later charges spend Flow', () => {
  // Keep this charge before combat so passive regeneration cannot mask either resource deduction.
  const result = simulate(
    'Bladesworn',
    [
      ID.DRAGON_TRIGGER,
      { type: 'wait', durationMs: dragonChargeTickOffsetSeconds(2, false) * 1000 },
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
  assert.equal(active.planningState.profession[STATE.DRAGON_TRIGGER_ACTIVE], true);
  assert.equal(active.planningState.cooldowns[ID.DRAGON_TRIGGER], undefined);

  const repeated = simulate('Bladesworn', [ID.DRAGON_TRIGGER, ID.DRAGON_TRIGGER], { initialResource: 100 });
  assert.match(repeated.warnings[0].message, /Dragon Trigger is already active/);
});

test('Every Dragon Slash starts Dragon Trigger recharge at cast initiation', () => {
  // Check both skill variants and recharge modifiers without depending on a saved rotation.
  for (const skillId of [ID.DRAGON_SLASH_FORCE, ID.DRAGON_SLASH_BOOST, ID.DRAGON_SLASH_REACH]) {
    for (const selectedTraitIds of [[], [TRAIT.SHARP_AS_THE_WIND], [TRAIT.VERSATILE_POWER]]) {
      for (const alacrity of [false, true]) {
        const result = simulate('Bladesworn', [ID.DRAGON_TRIGGER, { skillId, releaseAtCharges: 1 }], {
          initialResource: 100,
          selectedTraitIds,
          boons: { alacrity }
        });
        const slash = result.steps.at(-1);
        assert.deepEqual(result.warnings, []);
        assert.equal(result.planningState.profession[STATE.DRAGON_TRIGGER_ACTIVE], false);
        const rechargeMs = selectedTraitIds.includes(TRAIT.VERSATILE_POWER) ? 5440 : 6400;
        assert.equal(result.planningState.cooldowns[ID.DRAGON_TRIGGER].readyAt, slash.start + rechargeMs);
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
    // Versatile Power also reduces recharge when charging ends without a slash.
    for (const selectedTraitIds of [[], [TRAIT.VERSATILE_POWER]]) {
      const result = simulate(
        'Bladesworn',
        ['__combat_start', ID.DRAGON_TRIGGER, { type: 'wait', durationMs: 1000 }, exit],
        {
          initialResource: 100,
          selectedTraitIds
        }
      );
      assert.deepEqual(result.warnings, []);
      assert.equal(result.planningState.profession[STATE.DRAGON_TRIGGER_ACTIVE], false);
      assert.equal(result.planningState.profession[STATE.DRAGON_CHARGES].value, 0);
      const rechargeMs = selectedTraitIds.includes(TRAIT.VERSATILE_POWER) ? 5440 : 6400;
      assert.equal(result.planningState.cooldowns[ID.DRAGON_TRIGGER].readyAt, exitAt + rechargeMs);
    }
  }
});

test('Dragon charges map to adrenaline-spend trait tiers', () => {
  assert.deepEqual([0, 1, 4, 5, 9, 10].map(dragonChargesToAdrenalineSpent), [0, 10, 10, 20, 20, 30]);
});

test('Dragon Slash charge tiers drive adrenaline-spend traits', () => {
  for (const [charges, powerStacks, precisionDuration] of [
    [4, 2, 2],
    [5, 3, 2],
    [10, 4, 4]
  ]) {
    const result = simulate(
      'Bladesworn',
      ['Dragon Trigger', { skillId: 62797, releaseAtCharges: charges }],
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

    assert.equal(-spend.amount, charges);
    assert.equal(berserkersPower.stacks, powerStacks);
    assert.equal(berserkersPower.at, slash.endsAt);
    assert.equal(berserkersPower.priority, 5);
    assert.equal(
      result.events.find((event) => event.type === 'buff' && event.name === 'Burst Precision').duration,
      precisionDuration
    );
  }
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
  assert.equal(
    braveStride.planningState.profession[STATE.FLOW].value - baseline.planningState.profession[STATE.FLOW].value,
    5
  );

  const berserkerBaseline = simulate('Berserker', [ID.SUNDERING_LEAP]);
  const berserkerBraveStride = simulate('Berserker', [ID.SUNDERING_LEAP], {
    selectedTraitIds: [TRAIT.BRAVE_STRIDE]
  });
  assert.equal(
    berserkerBraveStride.planningState.profession[STATE.ADRENALINE].value -
      berserkerBaseline.planningState.profession[STATE.ADRENALINE].value,
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
    assert.equal(result.planningState.profession[STATE.DRAGON_TRIGGER_ACTIVE], false);
    assert.equal(result.planningState.profession[STATE.DRAGON_CHARGES].value, 0);
  }
});

test('Dragon Trigger stalls below its Flow cost and resumes after rebuilding', () => {
  const result = simulate('Bladesworn', ['__combat_start', 'Dragon Trigger', { skillId: 62797, releaseAtCharges: 4 }], {
    initialResource: 15
  });

  assert.deepEqual(result.warnings, []);
  const ticks = result.events.filter(
    (event) => event.type === 'resource' && event.reason === DRAGON_TRIGGER_TICK_RESOURCE_REASON
  );

  assert.equal(
    ticks.some((tick) => tick.flowSpent === 0),
    true
  );
  assert.ok(ticks.at(-1).flowSpent > 0);
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
  assert.equal(dragonChargesToAdrenalineSpent(-spend.amount), 10);
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

  assert.ok(ticks.some((tick) => tick.flowSpent === 0));
  assert.equal(ticks.at(-1).value, 10);
  assert.equal(
    result.events.find((event) => event.resource === 'dragon charges' && event.reason === 'profession mechanic')
      .flowSpent,
    45
  );
});

test('Dragon Slash reports unreachable Flow-gated requests', () => {
  const result = simulate('Bladesworn', ['Dragon Trigger', { skillId: 62797, releaseAtCharges: 4 }, '__combat_start'], {
    initialResource: 15
  });
  const slash = result.steps.find((step) => step.skill === 'Dragon Slash—Force');

  assert.equal(slash.invalid, true);
  assert.match(slash.invalidReason, /could not reach 4 charges/);
  assert.match(slash.invalidReason, /it reached 1/);
  assert.equal(
    result.events.some((event) => event.type === 'damage' && event.skillId === ID.DRAGON_SLASH_FORCE),
    false
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
  assert.equal(spent.planningState.ammoBySkillId[ID.ARTILLERY_SLASH].charges, 0);
  assert.equal(reloaded.planningState.ammoBySkillId[ID.ARTILLERY_SLASH].charges, 1);
  assert.equal(fired.planningState.ammoBySkillId[ID.ARTILLERY_SLASH].charges, 0);
  assert.equal(hits.length, 2);
  assert.ok(hits[0].coefficient > hits[1].coefficient);
  assert.ok(fired.events.some((event) => event.skillId === ID.ARTILLERY_SLASH && event.controlKind === 'daze'));
});

test("Dragon's Roar consumes its magazine and Gunstinger reloads it", () => {
  const spent = simulate('Bladesworn', [ID.DRAGONS_ROAR]);
  const reloaded = simulate('Bladesworn', [ID.DRAGONS_ROAR, ID.GUNSTINGER]);
  const fired = simulate('Bladesworn', [ID.DRAGONS_ROAR, ID.GUNSTINGER, ID.DRAGONS_ROAR]);

  for (const result of [spent, reloaded, fired]) assert.deepEqual(result.warnings, []);
  assert.equal(spent.planningState.ammoBySkillId[ID.DRAGONS_ROAR].charges, 0);
  assert.ok(reloaded.planningState.ammoBySkillId[ID.DRAGONS_ROAR].charges > 0);
  assert.equal(fired.planningState.ammoBySkillId[ID.DRAGONS_ROAR].charges, 0);
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
  assert.ok(Math.abs(precombat.planningState.profession[STATE.FLOW].value - 32) < 1e-9);
  for (const [atSeconds, value] of [
    [8.49, '0 stacks'],
    [8.5, '1 stack']
  ]) {
    const display = warriorProfession.ui
      .rotationStateSnapshot({
        balanceContext: withPatchPreview(warriorProfession).resolvePatch().balanceContext,
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

  assert.ok(Math.abs(baseline.planningState.profession[STATE.FLOW].value - 18) < 1e-9);

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
  assert.ok(Math.abs(stabilized.planningState.profession[STATE.FLOW].value - 48.96) < 1e-9);
  assert.ok(Math.abs(unstabilized.planningState.profession[STATE.FLOW].value - 16.96) < 1e-9);
  assert.ok(
    Math.abs(
      stabilized.planningState.profession[STATE.FLOW].value -
        unstabilized.planningState.profession[STATE.FLOW].value -
        32
    ) < 1e-9
  );
  assert.equal(
    stabilized.events.some(
      (event) => event.type === 'buff' && event.kind === 'positive-flow' && event.stacks === 2 && event.duration === 8
    ),
    true
  );

  // Refilling to full clears the old timer; spending again starts a fresh recharge.
  const spent = simulate('Bladesworn', ['__combat_start', ID.FLOW_STABILIZER]);
  const freshRecharge = simulate('Bladesworn', [
    '__combat_start',
    ID.FLOW_STABILIZER,
    ID.TACTICAL_RELOAD,
    ID.FLOW_STABILIZER
  ]);

  assert.deepEqual(freshRecharge.warnings, []);
  assert.equal(
    freshRecharge.planningState.ammoBySkillId[ID.FLOW_STABILIZER].charges,
    spent.planningState.ammoBySkillId[ID.FLOW_STABILIZER].charges
  );
  assert.ok(spent.planningState.ammoBySkillId[ID.FLOW_STABILIZER].nextRechargeAt > 0);
  // Compare the public deadline with the fresh queue owned by the cooldown controller.
  const recharge = observedRuntime(freshRecharge).cooldownController.readAmmo(ID.FLOW_STABILIZER).recharges[0];
  assert.equal(
    freshRecharge.planningState.ammoBySkillId[ID.FLOW_STABILIZER].nextRechargeAt,
    recharge.startedAt + recharge.work / 1.25
  );
  assert.ok(
    freshRecharge.planningState.ammoBySkillId[ID.FLOW_STABILIZER].nextRechargeAt >
      spent.planningState.ammoBySkillId[ID.FLOW_STABILIZER].nextRechargeAt
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

  assert.ok(Math.abs(overlapping.planningState.profession[STATE.FLOW].value - 71) < 1e-9);
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
      balanceContext: withPatchPreview(warriorProfession).resolvePatch().balanceContext,
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

  assert.equal(firstCast.planningState.profession[STATE.FLOW].value, 0);
  assert.equal(castWithFury.planningState.profession[STATE.FLOW].value, 15);

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
      converted.planningState.profession[STATE.FLOW].value -
        idle.planningState.profession[STATE.FLOW].value -
        warriorCatalog.skillsById
          .get(ID.SIGNET_OF_FURY)
          .sideEffects.find(({ do: action }) => action.type === 'warrior.grant-combat-resource').do.amount
    ) < 1e-9
  );
  assert.equal(converted.planningState.profession[STATE.ADRENALINE].value, 0);

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

test('Dragon Trigger utilities expose defense, shadowstep ammo, and cooldown reset', () => {
  const concurrentTrigger = simulate(
    'Bladesworn',
    [ID.OVERCHARGED_CARTRIDGES, { skillId: ID.DRAGON_TRIGGER, offset: 100 }],
    { initialResource: 100 }
  );

  assert.deepEqual(
    concurrentTrigger.warnings.map(({ message, at }) => [message, at]),
    [['Dragon Trigger: Dragon Trigger cannot be cast concurrently.', 0]]
  );
  assert.equal(concurrentTrigger.steps.find((step) => step.skill === 'Dragon Trigger').invalid, true);
  const utility = simulate('Bladesworn', [ID.DRAGON_TRIGGER, ID.TRIGGERGUARD, ID.FLICKER_STEP], {
    initialResource: 100
  });

  assert.deepEqual(utility.warnings, []);
  assert.equal(
    utility.events.some((event) => event.type === 'buff' && event.kind === 'aegis'),
    true
  );

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
  assert.ok(pending.planningState.cooldowns[ID.DRAGON_TRIGGER].remaining > 0);
  assert.equal(cleared.planningState.cooldowns[ID.DRAGON_TRIGGER], undefined);
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
    attributeInputs: baseAttributeInputs({ precision: 0, ferocity: 0 }),
    target: { conditions: {} }
  });
  const overcharged = simulate('Bladesworn', [ID.OVERCHARGED_CARTRIDGES, ID.UNSHEATHE_GUNSABER, ID.BLOOMING_FIRE], {
    initialResource: 100,
    attributeInputs: baseAttributeInputs({ precision: 0, ferocity: 0 }),
    target: { conditions: {} }
  });
  const supercharged = simulate(
    'Bladesworn',
    [ID.OVERCHARGED_CARTRIDGES, ID.OVERCHARGED_CARTRIDGES, ID.UNSHEATHE_GUNSABER, ID.BLOOMING_FIRE],
    {
      initialResource: 100,
      attributeInputs: baseAttributeInputs({ precision: 0, ferocity: 0 }),
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
    attributeInputs: baseAttributeInputs({ precision: 0, ferocity: 0 }),
    target: { conditions: {} }
  });
  const roarSupercharged = simulate(
    'Bladesworn',
    [ID.OVERCHARGED_CARTRIDGES, ID.OVERCHARGED_CARTRIDGES, ID.DRAGONS_ROAR],
    {
      selectedTraitIds: [TRAIT.PEAK_PERFORMANCE],
      attributeInputs: baseAttributeInputs({ precision: 0, ferocity: 0 }),
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
  assert.equal(locked.planningState.ammoBySkillId[ID.OVERCHARGED_CARTRIDGES].charges, 0);
  assert.equal(
    locked.planningState.profession[STATE.OVERCHARGED_CARTRIDGE_WINDOWS].find((window) => window.supercharged)
      .expiresAt,
    canonicalTime(lockedBuffs[1].at + 8)
  );
});

test('Paragon weapon bursts spend one of three adrenaline bars', () => {
  const result = simulate('Paragon', ['Eviscerate'], { initialResource: 30 });

  assert.deepEqual(result.warnings, []);
  assert.equal(result.planningState.profession[STATE.ADRENALINE].maximum, 30);
  // The burst spends ten, then its hit restores one adrenaline.
  assert.equal(result.planningState.profession[STATE.ADRENALINE].value, 21);
});

test('Paragon chants consume adrenaline and start a refrain', () => {
  const result = simulate('Paragon', ['Chant of Action'], {
    initialResource: 30
  });

  assert.deepEqual(result.warnings, []);
  assert.equal(result.planningState.profession[STATE.ADRENALINE].maximum, 30);
  assert.equal(result.planningState.profession[STATE.ADRENALINE].value, 20);
  assert.equal(result.planningState.profession[STATE.MOTIVATION].value, 4);
  assert.equal(result.planningState.profession[STATE.ACTIVE_REFRAIN], 'Chant of Action');
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

  assert.equal(result.planningState.profession[STATE.MOTIVATION].value, 3);
});

test('Rally the Valiant grants motivation when a burst starts', () => {
  const selectedTraitIds = [TRAIT.CALL_TO_ACTION, TRAIT.RALLY_THE_VALIANT];
  const result = simulate('Paragon', ['__combat_start', 'Breaching Strike'], {
    initialResource: 10,
    selectedTraitIds
  });

  assert.equal(result.planningState.profession[STATE.MOTIVATION].value, 8);
  assert.equal(
    result.events.some((event) => event.type === 'warrior.paragon-state'),
    false
  );

  const withoutRally = simulate('Paragon', ['__combat_start', 'Breaching Strike'], {
    initialResource: 10,
    selectedTraitIds: [TRAIT.CALL_TO_ACTION]
  });

  assert.equal(withoutRally.planningState.profession[STATE.MOTIVATION].value, 4);
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
  const config = { initialResource: 0, selectedSkillIds: [14355] };
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
  assert.ok(ready.planningState.profession[STATE.ADRENALINE].value > 0);
  assert.ok(cooling.planningState.cooldowns[ID.SIGNET_OF_RAGE].remaining > 0);
  assert.equal(cooling.planningState.profession[STATE.ADRENALINE].value, 0);
  assert.ok(recovered.planningState.profession[STATE.ADRENALINE].value > 0);
});

test('Lesser Signet of Might resolves after its triggering strike', () => {
  const result = simulate('Core', ['Throw Bolas'], {
    selectedTraitIds: [TRAIT.SIGNET_MASTERY],
    target: { health: 1 }
  });
  const strike = result.events.find((event) => event.type === 'damage' && event.skillId === ID.THROW_BOLAS);
  const lesser = result.resolvedEvents.find((event) => event.skillName === 'Lesser Signet of Might');

  assert.ok(result.procSteps.some((step) => step.skill === 'Lesser Signet of Might'));
  assert.equal(lesser.at, strike.at);
  assert.ok(
    result.resolvedEvents.indexOf(lesser) >
      result.resolvedEvents.findIndex(
        (event) => event === strike || (event.type === 'damage' && event.skillId === ID.THROW_BOLAS)
      )
  );
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
    attributeInputs: baseAttributeInputs({ precision: 0, ferocity: 1000 })
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
      assert.ok(Math.abs(result.planningState.profession[STATE.FLOW].value - expectedFlow) < 1e-9);
      const display = warriorProfession.ui
        .rotationStateSnapshot({
          balanceContext: withPatchPreview(warriorProfession).resolvePatch().balanceContext,
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

test('Bladesworn ammunition and explosion traits retain stack chronology', () => {
  const result = simulate('Bladesworn', ['Unsheathe Gunsaber', { type: 'cast', skillId: 62930 }], {
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
    balanceContext: withPatchPreview(warriorProfession).resolvePatch().balanceContext,
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
      boon: BOON.MIGHT,
      duration: 5,
      stacks: 5
    }
  );
});
