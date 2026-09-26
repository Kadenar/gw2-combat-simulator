import assert from 'node:assert/strict';
import test from 'node:test';
import { necromancerCatalog, necromancerProfession } from '#gw2/professions/necromancer/profession.js';

import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';

import {
  createObservedProfessionSimulator,
  observeGw2Runtime,
  observedRuntime
} from '#tests/helpers/observed-runtime.js';
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

const simulate = createObservedProfessionSimulator(necromancerProfession, baseConfig);
const wait = (durationMs) => ({ type: 'wait', durationMs });

// A queued observation before launch sees the original state; canceled throws never spend it.
test('elixir state commits chronologically and cancelled throws leave it untouched', () => {
  for (const cancelled of [false, true]) {
    const config = {
      ...baseConfig,
      specialization: 'Harbinger',
      initialBlight: 20,
      initialCascadingCorruptionStacks: 15,
      selectedSkills: { utility1: 'Elixir of Risk' },
      selectedTraitIds: [TRAIT.CASCADING_CORRUPTION]
    };
    const native = necromancerProfession.runtimeFor(config);
    const observations = [];
    const result = observeGw2Runtime({
      config,
      rotation: [
        { type: 'cast', skillId: ID.ELIXIR_OF_RISK, ...(cancelled ? { interruptAfterMs: 100 } : {}) },
        wait(1000)
      ],
      profession: {
        ...native,
        onCastStart(runtime, cast) {
          native.onCastStart(runtime, cast);
          runtime.schedule('test.observe', runtime.time + 0.2);
        },
        tasks: {
          ...native.tasks,
          'test.observe'(runtime) {
            const state = runtime.profession.specialization.state;
            observations.push([state.blight, state.cascadingCorruptionStacks, state.meltdownUntil]);
          }
        }
      }
    });
    assert.deepEqual(observations, [[20, 15, 0]]);
    const state = observedRuntime(result).profession.specialization.state;
    assert.equal(state.blight, cancelled ? 20 : 25);
    assert.equal(state.cascadingCorruptionStacks, cancelled ? 15 : 0);
    assert.equal(state.meltdownUntil > 0, !cancelled);
    assert.equal(result.totalDamage > 0, !cancelled);
    assert.deepEqual(result.warnings, []);
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
  assert.ok(observedRuntime(result).profession.specialization.state.meltdownUntil > proc.at);
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
  assert.ok(
    !clipped.resolvedEvents.some(
      (event) => event.skillId === ID.CASCADING_CORRUPTION && ['damage', 'condition'].includes(event.type)
    )
  );
});

// Acceptance and in-flight observations preserve the old spirit until actual summon completion.
test('spirit replacement changes generation and busy state only at completion', () => {
  const config = {
    ...baseConfig,
    specialization: 'Ritualist',
    initialResource: 100,
    selectedTraitIds: [TRAIT.SOUL_TWISTING]
  };
  const native = necromancerProfession.runtimeFor(config);
  const starts = [];
  const midway = [];
  const completed = [];
  const observe = (runtime) => {
    const state = runtime.profession.specialization.state;
    return [state.spiritGenerations.wanderlust || 0, state.spiritBusyUntil.wanderlust];
  };

  const result = observeGw2Runtime({
    config,
    rotation: ["Ritualist's Shroud", 'Wanderlust', 'Wanderlust'],
    profession: {
      ...native,
      onCastStart(runtime, cast) {
        native.onCastStart(runtime, cast);
        if (cast.skill.id !== ID.WANDERLUST) return;
        starts.push(observe(runtime));
        runtime.schedule('test.observe', (cast.start + cast.fullEnd) / 2);
      },
      onCastComplete(runtime, cast) {
        native.onCastComplete(runtime, cast);
        if (cast.skill.id === ID.WANDERLUST) completed.push(observe(runtime));
      },
      tasks: {
        ...native.tasks,
        'test.observe'(runtime) {
          midway.push(observe(runtime));
        }
      }
    }
  });
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(midway, starts);
  assert.deepEqual(
    starts.map(([generation]) => generation),
    [0, 1]
  );
  assert.deepEqual(
    completed.map(([generation]) => generation),
    [1, 2]
  );
  assert.ok(completed[1][1] > completed[0][1]);
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

// Partitioned waits, including repeated boundaries, must not restart passive producers.
function advance(config, targets) {
  return simulate(
    'Core',
    targets.map((at, index) => wait((at - (targets[index - 1] ?? 0)) * 1000)),
    config
  ).planningState.profession;
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
    // The strike grants from the current condition count before its following Torment application.
    assert.equal(result.planningState.profession.lifeForce.value, 8 + expected);
  }

  const torch = simulate('Core', ['Blood Curse', 'Oppressive Collapse'], {
    primaryWeapon: 'Scepter',
    secondaryWeapon: 'Torch'
  });
  assert.deepEqual(torch.warnings, []);
  // Might samples the accepted strike before this cast applies its own Torment.
  assert.equal(
    torch.events.find((event) => event.type === 'buff' && event.skillId === ID.OPPRESSIVE_COLLAPSE).stacks,
    2
  );

  // Both consumers cap the live distinct-condition count without emitting replay observations.
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
    else assert.match(result.warnings.join(' '), /requires more life force/);
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

// Accepted strikes fund the following form transition in the same execution.
test('Spiteful Fortitude life force funds the next shroud entry', () => {
  const result = simulate(
    'Core',
    ['Rending Claws', 'Death Shroud'],
    spitefulFortitude({
      initialResource: 9,
      primaryWeapon: 'Axe',
      target: { health: 1000000, startingHealthFraction: 0.4 }
    })
  );
  assert.deepEqual(result.warnings, []);
  assert.equal(result.planningState.profession.activeShroud, 'death');
});

// Same-time strikes before the crossing strike are still above half health and cannot grant life force.
test('Spiteful Fortitude grants start at the strike that crosses half health', () => {
  const health = 1000000;
  const config = (startingHealthFraction) =>
    spitefulFortitude({ primaryWeapon: 'Dagger', target: { health, startingHealthFraction } });
  const [first, second] = simulate('Core', ['Necrotic Slash'], config(1)).resolvedEvents.filter(
    (event) => event.type === 'damage' && event.skillId === ID.NECROTIC_SLASH
  );
  assert.equal(first.at, second.at);
  const result = simulate('Core', ['Necrotic Slash'], config(0.5 + (first.damage + second.damage / 2) / health));
  assert.deepEqual(result.warnings, []);
  assert.equal(result.planningState.profession.lifeForce.value, 1);
});

// A packet beyond the observation end never reaches the resource owner.
test('hit life force beyond the observation end is not granted', () => {
  const result = simulate(
    'Core',
    ['Rending Claws', { name: 'Ghastly Claws', impactDelayMs: 5000 }],
    spitefulFortitude({ primaryWeapon: 'Axe', target: { health: 1000000, startingHealthFraction: 0.4 } })
  );
  assert.deepEqual(result.warnings, []);
  assert.equal(result.planningState.profession.lifeForce.value, 2);
});

// Death prevents later hits and their grants while retaining the lethal strike's gain.
test('Spiteful Fortitude grants stop at target death', () => {
  const config = (health) =>
    spitefulFortitude({ primaryWeapon: 'Axe', target: { health, startingHealthFraction: 0.4 } });
  // A surviving target shows both strikes qualify; the lethal first strike leaves the second unresolved.
  assert.equal(simulate('Core', ['Rending Claws'], config(1000000)).planningState.profession.lifeForce.value, 2);
  const result = simulate('Core', ['Rending Claws'], config(1000));
  const strikes = result.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.skillId === ID.RENDING_CLAWS
  );
  assert.deepEqual(result.warnings, []);
  assert.equal(strikes.length, 1);
  assert.equal(result.deathTime, strikes[0].at);
  assert.equal(result.planningState.profession.lifeForce.value, 1);
});

// Actual half-health damage changes cooldown readiness before the next command is accepted.
test('Spiteful Fortitude and Gravedigger share the actual half-health transition', () => {
  const duskStrike = simulate('Reaper', ['Dusk Strike'], {
    primaryWeapon: 'Greatsword',
    target: { health: 0, conditions: {} }
  }).totalDamage;
  const health = 1000000;
  const result = simulate(
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
  // Every accepted strike qualifies, alongside Dusk Strike's own fixed grant.
  const strikes = result.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.actorType === 'player' && event.coefficient > 0
  );
  assert.equal(result.planningState.profession.lifeForce.value, strikes.length + 2 * 2);
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
    assert.equal(result.planningState.profession.activeShroud, lifeForce ? '' : 'lich');
  }
});

test('shroud depletion waits for its 40 ms detection tick across fractional observations', () => {
  for (const waits of [[3360], [3340, 10, 10]]) {
    const result = simulate('Core', ['Death Shroud', ...waits.map(wait)], { initialResource: 10 });
    assert.deepEqual(result.warnings, []);
    const exit = result.events.find(
      (event) => event.sourceId === 'necromancer.shroud-exit' && event.type === 'weapon_set'
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
