import assert from 'node:assert/strict';
import test from 'node:test';
import { necromancerCatalog, necromancerProfession } from '#gw2/professions/necromancer/profession.js';
import { createScheduler } from '#gw2/platform/execution/scheduler.js';
import { createGw2SchedulerPolicy } from '#gw2/platform/execution/gw2-policy/policy.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { createProfessionPassSimulator, createProfessionSimulator } from '#tests/helpers/profession-simulation.js';
import {
  addBlight,
  consumeBlight,
  createHarbingerState,
  purgeHarbingerTimedState
} from '#gw2/professions/necromancer/specializations/harbinger/state.js';
import { buildChartSeries } from '#gw2/app/results/model.js';
import { bindHarbingerUi } from '#gw2/professions/necromancer/specializations/harbinger/presentation.js';

const harbingerUi = bindHarbingerUi(necromancerCatalog);

const baseConfig = {
  stats: { power: 2000, precision: 1000, conditionDamage: 1000, vitality: 1000 },
  target: { armor: 2597, conditions: {} }
};
const simulate = createProfessionSimulator(necromancerProfession, baseConfig);
const simulateWithPasses = createProfessionPassSimulator(necromancerProfession, baseConfig);
const wait = (durationMs) => ({ type: 'wait', durationMs });

// Planning an elixir must not expose future Blight or Meltdown to intervening resource observations.
test('elixir state commits chronologically and cancelled throws leave it untouched', () => {
  const safeInterruptMs = necromancerCatalog.skillsById.get(ID.ELIXIR_OF_RISK).interruptCommitMs;
  for (const interruptAfterMs of [undefined, 1, safeInterruptMs - 40, safeInterruptMs]) {
    const config = {
      ...baseConfig,
      specialization: 'Harbinger',
      initialResource: 100,
      initialBlight: 20,
      selectedSkills: { utility1: 'Elixir of Risk' },
      selectedTraitIds: [TRAIT.CASCADING_CORRUPTION]
    };
    const scheduler = createScheduler({
      profession: necromancerProfession,
      config,
      schedulerPolicy: createGw2SchedulerPolicy(config)
    });
    const state = scheduler.state.profession.specialization.state;
    state.cascadingCorruptionStacks = 15;
    assert.equal(
      scheduler.cast({ skillId: ID.ELIXIR_OF_RISK, ...(interruptAfterMs == null ? {} : { interruptAfterMs }) }),
      true
    );
    assert.equal(state.blight, 20);
    assert.equal(state.meltdownUntil, 0);
    if (interruptAfterMs != null && interruptAfterMs < safeInterruptMs) {
      scheduler.advanceTo(1);
      assert.equal(state.blight, 20);
      assert.equal(state.cascadingCorruptionStacks, 15);
      assert.equal(state.meltdownUntil, 0);
      assert.ok(!scheduler.events.some((event) => event.type === 'damage'));
      continue;
    }

    const commitAt = scheduler.context.tasks.nextAt('necromancer.harbinger-blight-commit');
    // Resource timing stays at its measured frame regardless of the safe-interruption cutoff.
    assert.equal(commitAt, 9 * 0.04);
    scheduler.advanceTo(commitAt / 2);
    assert.equal(state.blight, 20);
    assert.equal(state.meltdownUntil, 0);
    const observations = scheduler.events.filter((event) => event.type === 'necromancer.life-force');
    assert.ok(observations.length > 0);
    assert.ok(observations.every((event) => Object.keys(event.state).join() === 'lifeForce'));
    scheduler.advanceTo(commitAt);
    assert.equal(state.blight, 15);
    assert.equal(state.cascadingCorruptionStacks, 0);
    assert.ok(state.meltdownUntil > commitAt);
    assert.equal(scheduler.events.find((event) => event.name === 'Meltdown').at, commitAt);
    const impactAt = scheduler.context.tasks.nextAt('necromancer.harbinger-elixir-impact');
    assert.ok(impactAt > commitAt);
    scheduler.advanceTo((commitAt + impactAt) / 2);
    assert.equal(state.blight, 15);
    scheduler.advanceTo(impactAt);
    assert.equal(state.blight, 25);
    scheduler.advanceTo(1);
    const strike = scheduler.events.find((event) => event.type === 'damage' && event.skillId === ID.ELIXIR_OF_RISK);
    assert.equal(strike.at, impactAt);
    const gain = scheduler.events.find((event) => event.reason === 'blight-gained');
    assert.equal(gain.at, impactAt);
    assert.ok(gain.eventOrder < strike.eventOrder);
    assert.equal(strike.metadata.necromancerBlight, 15);
    assert.deepEqual(scheduler.warnings, []);
  }
});

// Meltdown activates with consumption, but its explosion observes later resources and the observation horizon.
test('Cascading Corruption delays its packets while Meltdown applies to the triggering strike', () => {
  const config = {
    initialResource: 100,
    initialBlight: 20,
    initialCascadingCorruptionStacks: 15,
    selectedTraitIds: [TRAIT.CASCADING_CORRUPTION, TRAIT.WICKED_CORRUPTION]
  };
  const rotation = ['Harbinger Shroud', 'Devouring Cut'];
  const clipped = simulate('Harbinger', rotation, config);
  const result = simulate('Harbinger', rotation, config, { kind: 'tail', durationMs: 1000 });
  assert.deepEqual(result.warnings, []);
  const proc = result.events.find((event) => event.name === 'Meltdown');
  const trigger = result.resolvedEvents.find((event) => event.type === 'damage' && event.skillId === ID.DEVOURING_CUT);
  const packets = result.resolvedEvents.filter(
    (event) => event.skillId === ID.CASCADING_CORRUPTION && ['damage', 'condition'].includes(event.type)
  );
  assert.equal(proc.at, trigger.at);
  const publication = result.events.find(
    (event) => event.type === 'necromancer.blight' && event.at === proc.at && event.state.meltdownUntil > proc.at
  );
  assert.ok(publication.eventOrder < trigger.eventOrder);
  assert.equal(packets.length, 2);
  assert.ok(packets.every((event) => Math.round((event.at - proc.at) * 1000) === 17 * 40));
  assert.ok(
    result.events.some(
      (event) =>
        event.kind === 'harbinger-blight' && event.at > proc.at && event.at < packets[0].at && event.stacks === 17
    )
  );
  // The trigger uses its post-cost 15 stacks; the explosion includes the intervening two-stack shroud tick.
  const expectedDamage = (packet, blight) =>
    Math.floor(
      ((baseConfig.stats.power * packet.resolvedWeaponStrength * packet.coefficient) / baseConfig.target.armor) *
        (1 + 0.1 + blight * 0.01) *
        (1 + packet.criticalChance * (packet.criticalDamage - 1))
    );
  assert.equal(trigger.damage, expectedDamage(trigger, 15));
  const explosion = packets.find((event) => event.type === 'damage');
  assert.equal(explosion.damage, expectedDamage(explosion, 17));
  assert.ok(!clipped.resolvedEvents.some((event) => event.skillId === ID.CASCADING_CORRUPTION));
});

// Replacement must keep the old spirit's generation and readiness live until the summon completes.
test('spirit replacement changes generation and busy state only at completion', () => {
  const config = { ...baseConfig, specialization: 'Ritualist', initialResource: 100 };
  const scheduler = createScheduler({
    profession: necromancerProfession,
    config,
    schedulerPolicy: createGw2SchedulerPolicy(config)
  });
  scheduler.cast({ skillId: ID.RITUALISTS_SHROUD });
  const state = scheduler.state.profession.specialization.state;
  for (const generation of [1, 2]) {
    scheduler.context.cooldownController.clear(ID.WANDERLUST);
    const previousBusy = state.spiritBusyUntil.wanderlust;
    assert.equal(scheduler.cast({ skillId: ID.WANDERLUST }), true);
    const action = scheduler.events.filter((event) => event.type === 'action').at(-1);
    scheduler.advanceTo((action.at + action.endsAt) / 2);
    assert.equal(state.spiritGenerations.wanderlust || 0, generation - 1);
    assert.equal(state.spiritBusyUntil.wanderlust, previousBusy);
    scheduler.advanceTo(action.endsAt);
    assert.equal(state.spiritGenerations.wanderlust, generation);
    assert.equal(state.activeSpirits.wanderlust, true);
    assert.ok(state.spiritBusyUntil.wanderlust >= action.endsAt);
  }

  assert.deepEqual(scheduler.warnings, []);
});

// Cap refreshes keep their positions, and expiry must preserve the order used by later spends.
test('Blight cap refreshes survive spending from the end of the stack array', () => {
  const state = createHarbingerState({ initialBlight: 10 });
  addBlight(state, 15, 5);
  assert.equal(addBlight(state, 2, 10), 0);
  assert.equal(consumeBlight(state, 5, 11), 5);
  purgeHarbingerTimedState(state, 26);
  assert.equal(state.blight, 12);
  consumeBlight(state, 10, 26);
  assert.deepEqual(state.blightExpiries, [35, 35]);
});

// A tick crossed during a cast must be available to its completion-time empowerment and spending.
test('Blight skill consumption follows earlier shroud gains', () => {
  const result = simulate('Harbinger', ['Harbinger Shroud', wait(800), 'Devouring Cut'], {
    initialResource: 100,
    initialBlight: 4
  });
  assert.deepEqual(result.warnings, []);
  const updates = result.events.filter((event) => event.kind === 'harbinger-blight');
  assert.ok(updates.every((event, index) => index === 0 || event.at >= updates[index - 1].at));
  assert.equal(updates.find((event) => event.at === 1).stacks, 6);
  assert.equal(result.planningState.profession.blight, 1);
  assert.equal(
    result.events.find((event) => event.type === 'damage' && event.skillId === ID.DEVOURING_CUT).metadata
      .blightEmpowered,
    true
  );
});

// Large scheduler advances must produce the same stack lifetimes as stepping through each resource tick.
test('Blight accrual and expiry are independent of wait granularity', () => {
  const run = (waits) =>
    simulate('Harbinger', ['Harbinger Shroud', ...waits], { initialResource: 100, initialBlight: 25 });
  const coarse = run([wait(30000)]);
  const fine = run(Array.from({ length: 30 }, () => wait(1000)));
  assert.deepEqual(coarse.warnings, []);
  assert.deepEqual(fine.warnings, []);
  assert.deepEqual(coarse.planningState.profession.blightExpiries, fine.planningState.profession.blightExpiries);
});

// Initial resource windows contribute before any skill emits a change, including through precombat waits.
test('Blight chart includes initial stacks and expires them at their actual deadline', () => {
  const result = simulate('Harbinger', [wait(5000), { type: 'combat-start' }, wait(25000)], { initialBlight: 12 });
  const series = buildChartSeries(result, 250, harbingerUi.effectPresentations());
  assert.equal(series.effects.Blight[0].v, 12);
  assert.equal(series.effectSummaries.Blight.averageStacks, (12 * 20) / 25);
  assert.equal(result.planningState.profession.blight, 0);
  assert.ok(result.events.some((event) => event.kind === 'harbinger-blight' && event.at === 25 && event.stacks === 0));
});

// Both voluntary and depleted exits skip recharge only before an explicit combat boundary.
test('shroud exits before combat leave entry ready without weakening combat recharge', () => {
  for (const [specialization, entry, exit] of [
    ['Core', 'Death Shroud', 'End Death Shroud'],
    ['Reaper', "Reaper's Shroud", "Exit Reaper's Shroud"],
    ['Harbinger', 'Harbinger Shroud', 'Exit Harbinger Shroud']
  ]) {
    const precombat = simulate(specialization, [entry, exit, { type: 'combat-start' }, entry], {
      initialResource: 100
    });
    assert.deepEqual(precombat.warnings, [], specialization);
    assert.equal(precombat.steps.filter((step) => step.skill === entry).at(-1).start / 1000, precombat.combatStartTime);
    for (const prefix of [[], [{ type: 'combat-start' }]]) {
      const combat = simulate(specialization, [...prefix, entry, exit], { initialResource: 100 });
      assert.ok(combat.planningState.cooldowns[entry].remaining > 0, specialization);
    }

    const depleted = simulate(specialization, [entry, wait(40000), { type: 'combat-start' }], { initialResource: 100 });
    assert.equal(depleted.planningState.cooldowns[entry], undefined, specialization);
  }
});

// Direct clock checks include repeated timestamps that a rotation can collapse away.
function advance(config, targets) {
  const { context } = createScheduler({
    profession: necromancerProfession,
    config,
    schedulerPolicy: createGw2SchedulerPolicy(config)
  });
  for (const at of targets) context.advanceTo(at);
  return context.state.profession.core;
}

test('NEC-001 Eternal Life preserves earned resources and caps only its own regeneration', () => {
  for (const targets of [[0], [0.1], [1, 1, 2]]) {
    const state = advance({ initialResource: 100, selectedTraitIds: [TRAIT.ETERNAL_LIFE] }, targets);
    assert.equal(state.lifeForce.value, 100);
  }

  assert.equal(advance({ initialResource: 65, selectedTraitIds: [TRAIT.ETERNAL_LIFE] }, [1, 2]).lifeForce.value, 66);
});

test('NEC-002 transformed follow-ups require an unexpired, unconsumed parent activation', () => {
  for (const [actions, denied] of [
    [['Terrify'], 1],
    [['Infusing Terror', 'Terrify', 'Terrify'], 1],
    [['Infusing Terror', wait(10000), 'Terrify'], 1],
    [['Infusing Terror', 'Terrify', 'Life Rend', 'Life Slash'], 0]
  ]) {
    const result = simulate('Reaper', ["Reaper's Shroud", ...actions], { initialResource: 100 });
    assert.equal(result.warnings.length, denied);
    for (const warning of result.warnings) assert.match(warning, /Terrify.*not currently armed/);
  }

  const lich = simulate('Core', ['Lich Form', 'March of Undeath'], { selectedSkills: { elite: 'Lich Form' } });
  assert.match(lich.warnings.join(' '), /not currently armed/);
});

test('NEC-004 temporary horrors retain authored strike ticks and observation clipping', () => {
  const config = { selectedSkills: { elite: 'Lich Form' } };
  const run = (durationMs) => simulate('Core', ['Lich Form', 'Summon Madness'], config, { kind: 'tail', durationMs });
  const result = run(15000);
  assert.deepEqual(result.warnings, []);
  const summon = result.steps.find((step) => step.skillId === ID.SUMMON_MADNESS);
  const packets = result.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.sourceId === 'unstable-horror.0'
  );
  assert.deepEqual(
    packets.map((event) => [Number((event.at - summon.end / 1000).toFixed(9)), event.coefficient]),
    [
      [1, 0.33],
      [6, 1.25]
    ]
  );
  assert.ok(packets.every((event) => event.damage > 0));
  const clipped = run(1500).resolvedEvents.filter(
    (event) => event.type === 'damage' && event.sourceId === 'unstable-horror.0'
  );
  assert.equal(clipped.length, 1);
  assert.equal(clipped[0].coefficient, 0.33);
});

test('NEC-006 condition scaling observes live distinct conditions and their expiry', () => {
  for (const [prefix, expected] of [
    [[], 0],
    [['Blood Curse'], 1],
    [['Blood Curse', 'Rending Curse'], 1],
    [['Blood Curse', wait(12000)], 0]
  ]) {
    const result = simulate('Core', [...prefix, 'Devouring Darkness'], {
      primaryWeapon: 'Scepter',
      initialResource: 0,
      selectedTraitIds: [TRAIT.LINGERING_CURSE]
    });
    assert.deepEqual(result.warnings, []);
    const torment = result.resolvedEvents.filter(
      (event) => event.type === 'condition' && event.skillId === ID.DEVOURING_DARKNESS
    );
    assert.equal(
      torment.reduce((sum, event) => sum + event.stacks, 0),
      expected
    );
    const observations = result.resolvedEvents.filter((event) => event.type === 'necromancer.target-condition-count');
    assert.equal(observations[0].conditionCount, expected);
    // The completion-time resource query includes conditions present at that gain boundary.
    assert.equal(result.planningState.profession.lifeForce.value, 8 + observations.at(-1).conditionCount);
  }

  const torch = simulate('Core', ['Blood Curse', 'Oppressive Collapse'], {
    primaryWeapon: 'Scepter',
    secondaryWeapon: 'Torch'
  });
  assert.deepEqual(torch.warnings, []);
  const count = torch.resolvedEvents.find(
    (event) => event.type === 'necromancer.target-condition-count'
  ).conditionCount;
  assert.equal(count, 2);
  assert.equal(
    torch.events.find((event) => event.type === 'buff' && event.skillId === ID.OPPRESSIVE_COLLAPSE).stacks,
    count * 2
  );

  // Permanent conditions at the consumer cap make resolver feedback unable to change either outcome.
  const cappedConditions = Object.fromEntries(
    ['Bleeding', 'Burning', 'Torment', 'Confusion', 'Poisoned', 'Chilled', 'Crippled'].map((condition) => [
      condition,
      true
    ])
  );
  const capped = simulate('Core', ['Devouring Darkness', 'Oppressive Collapse'], {
    primaryWeapon: 'Scepter',
    secondaryWeapon: 'Torch',
    initialResource: 0,
    selectedTraitIds: [TRAIT.LINGERING_CURSE],
    target: { conditions: cappedConditions }
  });
  assert.deepEqual(capped.warnings, []);
  assert.equal(capped.resolvedEvents.filter((event) => event.type === 'necromancer.target-condition-count').length, 0);
  assert.equal(
    capped.resolvedEvents
      .filter((event) => event.type === 'condition' && event.skillId === ID.DEVOURING_DARKNESS)
      .reduce((sum, event) => sum + event.stacks, 0),
    5
  );
  assert.equal(
    capped.events.find((event) => event.type === 'buff' && event.skillId === ID.OPPRESSIVE_COLLAPSE).stacks,
    14
  );
});

test('NEC-007 strike life force is spendable by the next shroud entry', () => {
  for (const [startingHealthFraction, accepted] of [
    [0.4, true],
    [1, false]
  ]) {
    const result = simulate('Core', ['Rending Claws', 'Death Shroud'], {
      initialResource: 9,
      primaryWeapon: 'Axe',
      selectedTraitIds: [TRAIT.SPITEFUL_FORTITUDE],
      target: { health: 1000000, startingHealthFraction }
    });
    assert.equal(result.planningState.profession.activeShroud === 'death', accepted);
    assert.equal(result.planningState.profession.lifeForce.value, accepted ? 11 : 9);
    if (accepted) assert.deepEqual(result.warnings, []);
    else assert.match(result.warnings.join(' '), /requires 10 life force/);
  }

  const minion = simulate('Core', ['Summon Blood Fiend', wait(4000)], {
    initialResource: 0,
    selectedSkills: { heal: 'Summon Blood Fiend' },
    selectedTraitIds: [TRAIT.SPITEFUL_FORTITUDE],
    target: { health: 1000000, startingHealthFraction: 0.4 }
  });
  assert.equal(minion.planningState.profession.lifeForce.value, 0);
  // Percentage gains apply Gluttony once and cannot overflow the meter, including with Soul Battery.
  for (const [initialResource, expected] of [
    [0, 2.2],
    [99, 100]
  ]) {
    const result = simulate('Core', ['Rending Claws'], {
      initialResource,
      primaryWeapon: 'Axe',
      selectedTraitIds: [TRAIT.SPITEFUL_FORTITUDE, TRAIT.GLUTTONY, TRAIT.SOUL_BATTERY],
      target: { health: 1000000, startingHealthFraction: 0.4 }
    });
    assert.ok(Math.abs(result.planningState.profession.lifeForce.value - expected) < 1e-8);
  }
});

// Life-force feedback must not expose cast-end Blight to the channel's earlier strike packets.
test('NEC-007 resource gains preserve Harbinger damage observations before the Blight tick', () => {
  const run = (traits) =>
    simulate('Harbinger', ['Harbinger Shroud', 'Dark Barrage'], {
      initialResource: 100,
      selectedTraitIds: [TRAIT.WICKED_CORRUPTION, ...traits],
      target: { health: 1000000, startingHealthFraction: 0.4 }
    });
  const baseline = run([]);
  const feedback = run([TRAIT.SPITEFUL_FORTITUDE]);
  const strikes = (result) =>
    result.resolvedEvents.filter((event) => event.type === 'damage').map((event) => [event.at, event.damage]);
  assert.deepEqual(baseline.warnings, []);
  assert.deepEqual(feedback.warnings, []);
  assert.ok(strikes(baseline).length > 0);
  assert.deepEqual(strikes(feedback), strikes(baseline));
  assert.equal(feedback.planningState.profession.blight, baseline.planningState.profession.blight);
  assert.ok(feedback.planningState.profession.lifeForce.value > baseline.planningState.profession.lifeForce.value);
});

const spitefulFortitude = (config) => ({ initialResource: 0, selectedTraitIds: [TRAIT.SPITEFUL_FORTITUDE], ...config });

// The first pass only discovers the half-health boundary; the second grants and verifies the same strike gains.
test('Spiteful Fortitude life force is predicted in the pass that refinement verifies', () => {
  const { result, passes } = simulateWithPasses(
    'Core',
    ['Rending Claws', 'Death Shroud'],
    spitefulFortitude({
      initialResource: 9,
      primaryWeapon: 'Axe',
      target: { health: 1000000, startingHealthFraction: 0.4 }
    })
  );
  assert.deepEqual(result.warnings, []);
  assert.equal(passes, 2);
  assert.equal(result.planningState.profession.activeShroud, 'death');
});

// Same-time strikes resolved before the crossing strike are still above half health and must not be predicted.
test('Spiteful Fortitude predictions start at the strike that crosses half health', () => {
  const health = 1000000;
  const config = (startingHealthFraction) =>
    spitefulFortitude({ primaryWeapon: 'Dagger', target: { health, startingHealthFraction } });
  const [first, second] = simulate('Core', ['Necrotic Slash'], config(1)).resolvedEvents.filter(
    (event) => event.type === 'damage' && event.skillId === ID.NECROTIC_SLASH
  );
  assert.equal(first.at, second.at);
  const { result, passes } = simulateWithPasses(
    'Core',
    ['Necrotic Slash'],
    config(0.5 + (first.damage + second.damage / 2) / health)
  );
  assert.equal(result.resolvedEvents.filter((event) => event.type === 'necromancer.life-force-gain').length, 1);
  assert.equal(passes, 2);
  assert.equal(result.planningState.profession.lifeForce.value, 1);
});

// Delayed packets land after the observation end, where neither the resolver nor the resource clock reaches them.
test('hit life force beyond the observation end does not force a replay pass', () => {
  const { result, passes } = simulateWithPasses(
    'Core',
    ['Rending Claws', { name: 'Ghastly Claws', impactDelayMs: 5000 }],
    spitefulFortitude({ primaryWeapon: 'Axe', target: { health: 1000000, startingHealthFraction: 0.4 } })
  );
  assert.deepEqual(result.warnings, []);
  assert.equal(passes, 2);
  assert.equal(result.planningState.profession.lifeForce.value, 2);
});

// The resolver observes no strike after target death, so predictions stop there instead of forcing a replay.
test('Spiteful Fortitude predictions stop at target death', () => {
  const config = (health) =>
    spitefulFortitude({ primaryWeapon: 'Axe', target: { health, startingHealthFraction: 0.4 } });
  // A surviving target shows both strikes qualify; the lethal first strike leaves the second unresolved.
  assert.equal(simulate('Core', ['Rending Claws'], config(1000000)).planningState.profession.lifeForce.value, 2);
  const { result, passes } = simulateWithPasses('Core', ['Rending Claws'], config(1000));
  const strikes = result.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.skillId === ID.RENDING_CLAWS
  );
  assert.deepEqual(result.warnings, []);
  assert.equal(strikes.length, 1);
  assert.equal(result.deathTime, strikes[0].at);
  assert.equal(passes, 2);
  assert.equal(result.planningState.profession.lifeForce.value, 1);
});

// Gravedigger's reset moves every later strike; predicting from the new schedule avoids replaying the old timestamps.
test('Spiteful Fortitude converges in two passes when Gravedigger resets reshape the schedule', () => {
  const duskStrike = simulate('Reaper', ['Dusk Strike'], {
    primaryWeapon: 'Greatsword',
    target: { health: 0, conditions: {} }
  }).totalDamage;
  const health = 1000000;
  const { result, passes } = simulateWithPasses(
    'Reaper',
    ['Dusk Strike', 'Gravedigger', 'Gravedigger', 'Dusk Strike'],
    spitefulFortitude({
      primaryWeapon: 'Greatsword',
      target: { health, startingHealthFraction: 0.5 + duskStrike / (2 * health), conditions: {} }
    })
  );
  const gravediggers = result.steps.filter((step) => step.skill === 'Gravedigger');
  assert.deepEqual(result.warnings, []);
  assert.equal(result.deathTime, null);
  assert.equal(gravediggers[1].start, gravediggers[0].end);
  assert.equal(passes, 2);
  // The opening strike crosses half health, so every player strike from it onward grants life force.
  assert.deepEqual(
    result.resolvedEvents.filter((event) => event.type === 'necromancer.life-force-gain').map((event) => event.at),
    result.resolvedEvents
      .filter((event) => event.type === 'damage' && event.actorType === 'player' && event.coefficient > 0)
      .map((event) => event.at)
  );
});

test('NEC-009 interrupted minion summons commit no creature, command, or attacks', () => {
  for (const interrupted of [true, false]) {
    const result = simulate(
      'Core',
      [
        interrupted ? { type: 'cast', skillId: ID.SUMMON_BLOOD_FIEND, interruptAfterMs: 100 } : 'Summon Blood Fiend',
        wait(4000)
      ],
      { selectedSkills: { heal: 'Summon Blood Fiend' } }
    );
    assert.deepEqual(result.warnings, []);
    assert.equal(Number(result.planningState.profession.activeMinions['blood-fiend'] || 0), interrupted ? 0 : 1);
    assert.equal(Boolean(result.planningState.profession.availableFlips[ID.TASTE_OF_DEATH]), !interrupted);
    assert.equal(
      result.resolvedEvents.some((event) => event.type === 'damage' && event.actorType === 'summon'),
      !interrupted
    );
  }
});

test('NEC-010 Lich grants its ending life force exactly once', () => {
  const config = { initialResource: 0, selectedSkills: { elite: 'Lich Form' } };
  for (const [actions, lifeForce] of [
    [[], 0],
    [['Exit Lich Form'], 15],
    [[wait(21000)], 15],
    [['Exit Lich Form', wait(21000)], 15]
  ]) {
    const result = simulate('Core', ['Lich Form', ...actions], config);
    assert.deepEqual(result.warnings, []);
    assert.equal(result.planningState.profession.lifeForce.value, lifeForce);
    // Expiry must publish the form transition even though resource events carry only life force.
    assert.equal(
      result.events.filter((event) => event.type === 'necromancer.state').at(-1).state.activeShroud,
      lifeForce ? '' : 'lich'
    );
  }
});

test('shroud depletion waits for its 40 ms detection tick across fractional observations', () => {
  for (const waits of [[3360], [3340, 10, 10]]) {
    const result = simulate('Core', ['Death Shroud', ...waits.map(wait)], { initialResource: 10 });
    assert.deepEqual(result.warnings, []);
    const exit = result.events.find(
      (event) => event.sourceId === 'necromancer.life-force-depleted' && event.type === 'weapon_set'
    );
    assert.equal(exit?.at, 3.36);
  }
});

test('NEC-012 passive gains, cap, and depletion are invariant under wait partitioning', () => {
  for (const initialResource of [100, 10]) {
    for (const selectedTraitIds of [[], [TRAIT.ETERNAL_LIFE]]) {
      const config = { initialResource, selectedTraitIds, selectedSkills: { utility1: 'Signet of Undeath' } };
      const whole = simulate('Core', ['Death Shroud', wait(8000)], config);
      const split = simulate('Core', ['Death Shroud', ...[1000, 2000, 1000, 1000, 1000, 2000].map(wait)], config);
      assert.deepEqual(whole.warnings, []);
      assert.deepEqual(split.warnings, []);
      assert.ok(
        Math.abs(whole.planningState.profession.lifeForce.value - split.planningState.profession.lifeForce.value) < 1e-8
      );
      assert.equal(whole.planningState.profession.activeShroud, split.planningState.profession.activeShroud);
    }
  }

  const config = { initialResource: 0, selectedSkills: { utility1: 'Signet of Undeath' } };
  assert.equal(advance(config, [3, 3]).lifeForce.value, advance(config, [3]).lifeForce.value);
});
