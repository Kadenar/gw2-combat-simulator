import assert from 'node:assert/strict';
import test from 'node:test';
import { necromancerCatalog } from '#gw2/professions/necromancer/catalog.js';
import { necromancerProfession } from '#gw2/professions/necromancer/definition.js';
import { advanceNecromancerState } from '#gw2/professions/necromancer/core/mechanics/life-force.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { createProfessionSimulator } from '../../helpers/profession-simulation.js';

const simulate = createProfessionSimulator(necromancerProfession, {
  stats: { power: 2000, precision: 1000, conditionDamage: 1000, vitality: 1000 },
  target: { armor: 2597, conditions: {} }
});
const wait = (durationMs) => ({ type: 'wait', durationMs });

// Direct clock checks include repeated timestamps that a rotation can collapse away.
function advance(config, targets) {
  const events = [];
  const context = {
    config,
    catalog: necromancerCatalog,
    state: {
      profession: necromancerProfession.resolveRuntime(config).createProfessionState(config),
      cooldowns: new Map()
    },
    epsilon: 0.000001,
    events,
    emit: (event) => {
      events.push(event);
      return event;
    }
  };
  for (const at of targets) advanceNecromancerState(context, at);
  return context.state.profession.core;
}

test('NEC-001 Eternal Life preserves earned resources and caps only its own regeneration', () => {
  for (const targets of [[0], [0.1], [1, 1, 2]]) {
    const state = advance({ initialResource: 100, selectedTraitIds: [TRAIT.ETERNAL_LIFE] }, targets);
    assert.equal(state.lifeForce, 100);
  }

  assert.equal(advance({ initialResource: 65, selectedTraitIds: [TRAIT.ETERNAL_LIFE] }, [1, 2]).lifeForce, 66);
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
    packets.map((event) => [event.at - summon.end / 1000, event.coefficient]),
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
    assert.equal(result.endState.profession.lifeForce, 8 + observations.at(-1).conditionCount);
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
    assert.equal(result.endState.profession.activeShroud === 'death', accepted);
    assert.equal(result.endState.profession.lifeForce, accepted ? 11 : 9);
    if (accepted) assert.deepEqual(result.warnings, []);
    else assert.match(result.warnings.join(' '), /requires 10 life force/);
  }

  const minion = simulate('Core', ['Summon Blood Fiend', wait(4000)], {
    initialResource: 0,
    selectedSkills: { heal: 'Summon Blood Fiend' },
    selectedTraitIds: [TRAIT.SPITEFUL_FORTITUDE],
    target: { health: 1000000, startingHealthFraction: 0.4 }
  });
  assert.equal(minion.endState.profession.lifeForce, 0);
  // Percentage gains normalize to the enlarged pool, apply Gluttony once, and cannot overflow its cap.
  for (const [initialResource, expected] of [
    [0, 2.64],
    [99, 120]
  ]) {
    const result = simulate('Core', ['Rending Claws'], {
      initialResource,
      primaryWeapon: 'Axe',
      selectedTraitIds: [TRAIT.SPITEFUL_FORTITUDE, TRAIT.GLUTTONY, TRAIT.SOUL_BATTERY],
      target: { health: 1000000, startingHealthFraction: 0.4 }
    });
    assert.ok(Math.abs(result.endState.profession.lifeForce - expected) < 1e-8);
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
  assert.equal(feedback.endState.profession.blight, baseline.endState.profession.blight);
  assert.ok(feedback.endState.profession.lifeForce > baseline.endState.profession.lifeForce);
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
    assert.equal(Number(result.endState.profession.activeMinions['blood-fiend'] || 0), interrupted ? 0 : 1);
    assert.equal(Boolean(result.endState.profession.availableFlips[ID.TASTE_OF_DEATH]), !interrupted);
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
    assert.equal(result.endState.profession.lifeForce, lifeForce);
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
      assert.ok(Math.abs(whole.endState.profession.lifeForce - split.endState.profession.lifeForce) < 1e-8);
      assert.equal(whole.endState.profession.activeShroud, split.endState.profession.activeShroud);
    }
  }

  const config = { initialResource: 0, selectedSkills: { utility1: 'Signet of Undeath' } };
  assert.equal(advance(config, [3, 3]).lifeForce, advance(config, [3]).lifeForce);
});
