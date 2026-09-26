import assert from 'node:assert/strict';
import test from 'node:test';
import { defineNativeModule, defineNativeProfession } from '#gw2/platform/profession-definition/profession.js';
import { createResourceClock, createDiscreteResourceClock } from '#gw2/platform/combat/resources/resource-policy.js';
import { runGw2Runtime } from '#gw2/platform/simulation/runtime.js';

// Native fixtures exercise the same state and hook composition that profession waves will migrate to.
const skills = [
  {
    id: 991001,
    name: 'Hit',
    weapon: 'Sword',
    castTimeMs: 0,
    effects: [{ type: 'strike', coefficient: 1, forceCrit: true }]
  },
  {
    id: 991002,
    name: 'Channel',
    weapon: 'Sword',
    castTimeMs: 1000,
    cooldown: 2,
    effects: [{ type: 'strike', coefficient: 1, forceCrit: true }]
  },
  { id: 991003, name: 'Might', castTimeMs: 0, effects: [{ type: 'boon', boon: 'might', stacks: 1, duration: 2 }] },
  { id: 991004, name: 'Step', castTimeMs: 0, shadowstepSkill: true, effects: [] },
  {
    id: 991005,
    name: 'Field',
    castTimeMs: 0,
    effects: [],
    comboFields: [{ ownerId: 'live', fieldType: 'Fire', duration: 2 }]
  },
  {
    id: 991006,
    name: 'Blast',
    castTimeMs: 1000,
    effects: [],
    comboFinishers: [{ ownerId: 'live', finisherType: 'Blast', chance: 1 }]
  },
  { id: 991007, name: 'Spend', castTimeMs: 0, effects: [] },
  {
    id: 991009,
    name: 'Late Might',
    castTimeMs: 1000,
    effects: [{ type: 'boon', boon: 'might', duration: 2, stacks: 1 }]
  },
  { id: 991010, name: 'Dodge', castTimeMs: 0, effects: [], evades: true },
  { id: 991011, name: 'Heal', type: 'Heal', castTimeMs: 1000, effects: [] },
  { id: 991012, name: 'Elite', type: 'Elite', castTimeMs: 1000, effects: [] },
  {
    id: 991013,
    name: 'Profession strike',
    type: 'Profession',
    weapon: 'Sword',
    castTimeMs: 0,
    cooldown: 20,
    effects: [{ type: 'strike', coefficient: 1 }]
  },
  {
    id: 991008,
    name: 'Root',
    castTimeMs: 0,
    effects: [{ type: 'condition', condition: 'Immobilized', duration: 1, stacks: 1 }]
  }
];
const config = {
  stats: { power: 1000, precision: 3000, ferocity: 0, conditionDamage: 0, expertise: 0 },
  target: { armor: 1000, health: 0, conditions: {} },
  randomness: { mode: 'expected', seed: 919 }
};
const cast = (skillId) => ({ type: 'cast', skillId });
const wait = (durationMs) => ({ type: 'wait', durationMs });
function native(
  hooks = {},
  state = () => ({
    energy: createResourceClock(),
    pages: createDiscreteResourceClock(),
    endurancePool: { endurance: 0, enduranceUpdatedAt: 0 },
    starts: [],
    grants: 0
  })
) {
  const core = defineNativeModule({
    id: 'Core',
    data: { generatedSkills: skills, weapons: ['Sword'] },
    state: { create: state },
    hooks: {
      onCastStart(runtime, activation) {
        runtime.profession.core.starts.push([activation.skill.id, runtime.time]);
      },
      ...hooks
    }
  });
  return defineNativeProfession({ id: 'live', name: 'Live', modules: [core] });
}

function run(rotation, options = {}, profession = native()) {
  return runGw2Runtime({
    profession: profession.runtimeFor({ specialization: 'Core' }),
    config,
    rotation,
    ...options
  });
}

function hit(at, extra = {}) {
  return {
    type: 'damage',
    at,
    source: 'live',
    sourceId: 991001,
    skillId: 991001,
    skillName: 'Hit',
    actorType: 'player',
    coefficient: 1,
    forceCrit: true,
    weaponStrengthProfileId: 'weapon.sword',
    ...extra
  };
}

// Authored ownership survives materialization; preparation stamps packets before derived mechanics inspect them.
test('live event preparation preserves authored ownership and feeds derived combo packets', () => {
  const profession = native({
    modifyEffects(_runtime, _cast, effects) {
      return effects.map((effect) => ({
        ...effect,
        actorType: 'effect',
        ownerActorType: 'player',
        comboFinishers: [{ ownerId: 'live', finisherType: 'Projectile', chance: 1 }]
      }));
    },
    prepareEvent(_runtime, event) {
      return event.type === 'damage' ? { ...event, summonOwner: 'captured-owner' } : event;
    }
  });
  const result = run([cast(991005), cast(991001)], {}, profession);
  const damage = result.resolvedEvents.find((event) => event.type === 'damage');
  const combo = result.resolvedEvents.find((event) => event.type === 'combo');
  assert.equal(damage.ownerActorType, 'player');
  assert.equal(damage.summonOwner, 'captured-owner');
  assert.equal(combo.summonOwner, 'captured-owner');
});

// Native modifier history must grow with execution and exclude pending packets in both reporting modes.
test('live modifier hooks read executed history independently of report collection', () => {
  for (const output of ['detailed', 'score']) {
    const observations = [];
    const source = native({
      initialize(runtime) {
        runtime.emit({
          type: 'buff',
          at: 1,
          source: 'live',
          sourceId: 991003,
          actorType: 'player',
          kind: 'custom-window',
          duration: 2,
          stacks: 1
        });
        runtime.emit(hit(0.5));
        runtime.emit(hit(1.5));
      }
    }).runtimeFor({ specialization: 'Core' });
    runGw2Runtime({
      profession: {
        ...source,
        modifyStrikeDamage(context, multiplier) {
          const applied = context.events.some((event) => event.kind === 'custom-window');
          observations.push([context.time, applied]);
          return multiplier * (applied ? 2 : 1);
        }
      },
      config,
      rotation: [wait(2000)],
      output
    });
    assert.deepEqual(observations, [
      [0.5, false],
      [1.5, true]
    ]);
  }
});

test('interruption keeps a packet on the canonical boundary despite floating-point addition', () => {
  const core = defineNativeModule({
    id: 'Core',
    state: { create: () => ({}) },
    hooks: {},
    data: {
      generatedSkills: [
        {
          id: 991098,
          name: 'Boundary',
          weapon: 'Sword',
          castTimeMs: 560,
          interruptMode: 'per-packet',
          effects: [
            {
              type: 'strike',
              timingAnchor: 'castStart',
              timingScale: 'fixed',
              ticks: [239, 240, 241].map((atMs) => ({ atMs, coefficient: 1 }))
            }
          ]
        }
      ]
    }
  });
  const profession = defineNativeProfession({ id: 'native', name: 'Native', modules: [core] });
  const result = run([wait(3080), { name: 'Boundary', interruptAfterMs: 240 }], {}, profession);
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(
    result.resolvedEvents.filter((event) => event.type === 'damage').map((event) => event.at),
    [3.319, 3.32]
  );
});

test('native skill selection reevaluates actual state before reserving the selected action and its recharge', () => {
  let owner;
  const profession = native({
    initialize(runtime) {
      owner = runtime;
      runtime.cooldownController.setReadyAt(991002, 2);
      runtime.schedule('transform', 1);
    },
    modifySkillId(runtime, id) {
      return id === 991001 ? (runtime.profession.core.grants ? 991003 : 991002) : id;
    },
    tasks: {
      transform: (runtime) => {
        runtime.profession.core.grants = 1;
      }
    }
  });
  const result = run(['Hit'], {}, profession);
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(owner.profession.core.starts, [[991003, 1]]);
  assert.equal(owner.cooldowns.get(991002), 2);
  assert.equal(result.totalDamage, 0);
  assert.ok(result.events.some((event) => event.type === 'buff' && event.kind === 'might' && event.at === 1));
});

test('native duration selection composes before start mutations and rejects invalid reservations', () => {
  const core = defineNativeModule({
    id: 'Core',
    data: { generatedSkills: [skills[1]] },
    state: { create: () => ({ multiplier: 2 }) },
    hooks: {
      castDurationMs: (runtime, _skill, duration) => duration * runtime.profession.core.multiplier,
      onCastStart(runtime) {
        runtime.profession.core.multiplier = 99;
      }
    }
  });
  const elite = defineNativeModule({
    id: 'Elite',
    data: {},
    state: { create: () => ({}) },
    hooks: { castDurationMs: (_runtime, _skill, duration) => duration + 500 }
  });
  const profession = defineNativeProfession({ id: 'native', name: 'Native', modules: [core, elite] });
  const result = runGw2Runtime({
    profession: profession.runtimeFor({ specialization: 'Elite' }),
    config: { ...config, specialization: 'Elite' },
    rotation: ['Channel']
  });
  assert.deepEqual(result.warnings, []);
  const action = result.events.find((event) => event.type === 'action');
  assert.equal(action.fullEndsAt - action.at, 2.5);
  assert.equal(result.resolvedEvents.find((event) => event.type === 'damage').at, action.fullEndsAt);
  for (const duration of [-1, NaN, Infinity]) {
    let starts = 0;
    assert.throws(
      () =>
        run(
          ['Channel'],
          {},
          native({
            castDurationMs: () => duration,
            onCastStart: () => {
              starts += 1;
            }
          })
        ),
      /Cast duration must be finite and non-negative/
    );
    assert.equal(starts, 0);
  }
});

test('native field selection composes before cast-start mutations and registers one captured field', () => {
  const order = [];
  const core = defineNativeModule({
    id: 'Core',
    data: {
      generatedSkills: [
        {
          id: 991099,
          name: 'Field',
          castTimeMs: 1000,
          effects: [],
          comboFields: [{ ownerId: 'native', fieldType: 'Fire', duration: 1, startAnchor: 'castEnd' }]
        }
      ]
    },
    state: { create: () => ({ duration: 2 }) },
    hooks: {
      modifyComboFields(runtime, _cast, fields) {
        order.push('Core');
        return fields.map((field) => ({ ...field, duration: runtime.profession.core.duration }));
      },
      onCastStart(runtime) {
        runtime.profession.core.duration = 99;
      }
    }
  });
  const elite = defineNativeModule({
    id: 'Elite',
    data: {},
    state: { create: () => ({}) },
    hooks: {
      modifyComboFields(_runtime, _cast, fields) {
        order.push('Elite');
        return fields.map((field) => ({ ...field, duration: field.duration * 3 }));
      }
    }
  });
  const profession = defineNativeProfession({ id: 'native', name: 'Native', modules: [core, elite] });
  const result = runGw2Runtime({
    profession: profession.runtimeFor({ specialization: 'Elite' }),
    config: { ...config, specialization: 'Elite' },
    rotation: ['Field']
  });
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(order, ['Core', 'Elite']);
  const fields = result.events.filter((event) => event.type === 'combo_field');
  assert.equal(fields.length, 1);
  assert.equal(fields[0].at, 1);
  assert.equal(fields[0].expiresAt, 7);
  assert.equal(result.planningState.profession.duration, 99);
});

test('native hook composition creates each selected state once and supports data-only modules', () => {
  const creates = [];
  const core = defineNativeModule({
    id: 'Core',
    data: {},
    state: {
      create() {
        creates.push('Core');
        return { value: 1 };
      }
    },
    hooks: {}
  });
  const elite = defineNativeModule({
    id: 'Elite',
    data: {},
    state: {
      create() {
        creates.push('Elite');
        return { bonus: 2 };
      }
    },
    hooks: {
      initialize(runtime) {
        runtime.profession.core.value += runtime.profession.specialization.state.bonus;
      }
    }
  });
  const profession = defineNativeProfession({ id: 'native', name: 'Native', modules: [core, elite] });
  const result = runGw2Runtime({
    profession: profession.runtimeFor({ specialization: 'Elite' }),
    config,
    rotation: []
  });
  assert.deepEqual(creates, ['Core', 'Elite']);
  assert.equal(result.planningState.profession.value, 3);
  const unconverted = defineNativeModule({ id: 'Core', data: {}, state: { create: () => ({}) } });
  assert.doesNotThrow(() =>
    defineNativeProfession({ id: 'data-only', name: 'Data only', modules: [unconverted] }).runtimeFor({})
  );
  assert.throws(
    () => defineNativeModule({ id: 'Core', data: {}, state: { create: () => ({}), resolver: () => ({}) } }),
    /Unsupported native state field/
  );
});

// Core and the selected specialization reserve one recharge anchor, before either completion hook observes it.
test('live recharge anchors compose once per cast and reject nonfinite results', () => {
  const calls = [];
  const completions = [];
  const module = (id) =>
    defineNativeModule({
      id,
      data: id === 'Core' ? { generatedSkills: skills, weapons: ['Sword'] } : {},
      state: { create: () => ({}) },
      hooks: {
        rechargeStart(runtime, cast, at) {
          calls.push([id, runtime.time, cast.start]);
          return at - 0.25;
        },
        onCastComplete(runtime, cast) {
          completions.push([id, cast.rechargeStart, runtime.rechargeProgress.get(cast.skill.id).startedAt]);
        }
      }
    });
  const profession = defineNativeProfession({
    id: 'anchor',
    name: 'Anchor',
    modules: [module('Core'), module('Elite')]
  });
  const runtime = profession.runtimeFor({ specialization: 'Elite' });
  const result = runGw2Runtime({ profession: runtime, config, rotation: [cast(991002), cast(991002)] });
  assert.deepEqual(result.warnings, []);
  assert.equal(result.steps[1].start, 2120);
  assert.deepEqual(calls, [
    ['Core', 0, 0],
    ['Elite', 0, 0],
    ['Core', 2.12, 2.12],
    ['Elite', 2.12, 2.12]
  ]);
  assert.deepEqual(completions, [
    ['Core', 0.5, 0.5],
    ['Elite', 0.5, 0.5],
    ['Core', 2.62, 2.62],
    ['Elite', 2.62, 2.62]
  ]);
  assert.throws(
    () =>
      runGw2Runtime({
        profession: { ...runtime, rechargeStart: () => Infinity },
        config,
        rotation: [cast(991002)]
      }),
    /Recharge start must be finite/
  );
});

test('live public projections observe planning after death without exposing controllers or mutable report state', () => {
  let owner;
  let projections = 0;
  const core = defineNativeModule({
    id: 'Core',
    data: { generatedSkills: skills },
    state: {
      create: () => ({ uses: 0, hits: 0, privateGeneration: 1 }),
      project(input) {
        projections++;
        for (const key of ['schedulerState', 'schedulerContext', 'queue', 'query']) assert.equal(key in input, false);
        assert.equal(input.time, 3.6);
        assert.equal(input.catalog.skillsById.get(991002).name, 'Channel');
        assert.equal(input.config.target.health, 1);
        return { counts: { uses: input.profession.core.uses, hits: input.profession.core.hits } };
      }
    },
    hooks: {
      initialize(runtime) {
        owner = runtime;
      },
      onCastStart(runtime) {
        runtime.profession.core.uses++;
      },
      reactions: {
        'damage.resolved'(runtime) {
          runtime.profession.core.hits++;
        }
      }
    }
  });
  const profession = defineNativeProfession({ id: 'projection', name: 'Projection', modules: [core] });
  const options = { config: { ...config, target: { ...config.target, health: 1 } } };
  const rotation = [cast(991002), cast(991002)];
  const result = run(rotation, options, profession);
  // Planning includes self commands after death, while combat retains the earlier detached boundary.
  assert.deepEqual(result.planningState.profession.counts, { uses: 2, hits: 1 });
  assert.equal(result.planningState.cooldowns.Channel.readyAt, 5200);
  assert.equal(result.combatState.profession.uses, 1);
  assert.equal('privateGeneration' in result.planningState.profession, false);
  result.planningState.profession.counts.uses = 999;
  assert.equal(owner.profession.core.uses, 2);
  assert.equal(result.combatState.profession.uses, 1);
  const score = run(rotation, { ...options, output: 'score' }, profession);
  assert.equal(projections, 1);
  assert.equal(score.totalDamage, result.totalDamage);
});

test('critical sigils and Mistburn claim only actual eligible effects, identically in score mode', () => {
  const options = { config: { ...config, relic: 'Mistburn', sigilSets: [{ names: ['Air', 'Air'] }] } };
  const rotation = [cast(991003), cast(991003), cast(991001), cast(991001), wait(1000)];
  const detailed = run(rotation, options);
  assert.equal(
    detailed.resolvedEvents.filter((event) => event.type === 'damage' && event.sourceId === 'sigil.air').length,
    1
  );
  assert.equal(
    detailed.resolvedEvents.filter((event) => event.type === 'buff' && event.sourceId === 'relic.mistburn').length,
    1
  );
  const score = run(rotation, { ...options, output: 'score' });
  assert.equal(detailed.totalDamage, score.totalDamage);
  assert.equal(detailed.dps, score.dps);
  const missed = run([{ ...cast(991001), offTarget: true }, wait(1000)], options);
  assert.equal(missed.totalDamage, 0);
  assert.equal(missed.procSteps.length, 0);
});

test('Doom survives an off-target hit and is consumed once by the next actual hit', () => {
  let live;
  const profession = native({
    initialize(runtime) {
      live = runtime;
      runtime.emit({ type: 'weapon_set', at: 0, weaponSet: 2, source: 'live', sourceId: 'swap', actorType: 'player' });
      runtime.emit(hit(0.1, { offTarget: true }));
      runtime.emit(hit(0.2));
      runtime.emit(hit(0.3));
    }
  });
  const result = run(
    [wait(1500)],
    { combatStartTime: 0, config: { ...config, sigilSets: [{ names: [] }, { names: ['Doom'] }] } },
    profession
  );
  const poison = result.resolvedEvents.filter((event) => event.type === 'condition' && event.sourceId === 'sigil.doom');
  assert.equal(poison.length, 1);
  assert.equal(poison[0].at, 0.2);
  assert.equal(live.sigil.doomPending, false);
});

test('resource grants, capacity limits and recovery use the one live pool at readiness boundaries', () => {
  const profession = native({
    resources: {
      energy: {
        kind: 'continuous',
        state: (runtime) => runtime.profession.core.energy,
        maximum: () => 5,
        initial: () => 0,
        recovery: () => 1
      }
    },
    initialize(runtime) {
      runtime.schedule('grant', 0.5);
    },
    tasks: {
      grant(runtime) {
        runtime.resourceController.grant('energy', 100);
      }
    },
    availability(runtime, skill) {
      if (skill.id !== 991007) return { ready: true };
      const readyAt = runtime.resourceController.readyAt('energy', 5);
      return readyAt === runtime.time
        ? { ready: true }
        : { ready: false, retryAt: readyAt, reason: 'Recovering energy', code: 'energy' };
    },
    onCastStart(runtime, activation) {
      if (activation.skill.id === 991007) runtime.resourceController.spend('energy', 5);
    }
  });
  const result = run([cast(991007)], {}, profession);
  assert.equal(result.rotationEndTime, 0.5);
  assert.equal(result.planningState.profession.energy.value, 0);
  assert.throws(
    () =>
      run(
        [],
        {},
        native({
          resources: {
            energy: {
              kind: 'continuous',
              state: (runtime) => runtime.profession.core.energy,
              maximum: () => 5,
              initial: () => 0,
              recovery: () => 0
            }
          },
          initialize(runtime) {
            runtime.resourceController.grant('energy', NaN);
          }
        })
      ),
    /finite and non-negative/
  );
});

test('discrete resource grants preserve a running cadence through overflow and later spending', () => {
  const seen = [];
  const profession = native({
    resources: {
      tomePages: {
        kind: 'discrete',
        state: (runtime) => runtime.profession.core.pages,
        maximum: () => 2,
        initial: () => 2,
        recovery: () => ({ interval: 1, amount: 1, start: 'first-spend' })
      }
    },
    initialize(runtime) {
      runtime.resourceController.spend('tomePages', 1);
      runtime.schedule('overflow', 0.5);
      runtime.schedule('read', 1);
    },
    tasks: {
      overflow(runtime) {
        runtime.resourceController.grant('tomePages', 10);
        runtime.resourceController.spend('tomePages', 1);
      },
      read(runtime) {
        seen.push(runtime.resourceController.value('tomePages'));
      }
    }
  });
  run([wait(1000)], {}, profession);
  assert.deepEqual(seen, [2]);
});

test('Energy sigils restore the selected endurance pool after actual Vigor recovery', () => {
  const profession = native({
    endurance: {
      state: (runtime) => runtime.profession.core.endurancePool,
      maximum: () => 100,
      regenerationRate: (_runtime, vigor) => (vigor ? 10 : 5)
    },
    initialize(runtime) {
      runtime.endurance.spend(100);
      runtime.emit({
        type: 'buff',
        kind: 'vigor',
        at: 1,
        duration: 10,
        stacks: 1,
        source: 'live',
        sourceId: 'vigor',
        actorType: 'player'
      });
      runtime.emit({ type: 'weapon_set', at: 2, weaponSet: 2, source: 'live', sourceId: 'swap', actorType: 'player' });
    }
  });
  const result = run(
    [wait(2000)],
    { combatStartTime: 0, config: { ...config, sigilSets: [{ names: [] }, { names: ['Energy'] }] } },
    profession
  );
  assert.equal(result.planningState.profession.endurancePool.endurance, 65);
});

test('live endurance initialization honors explicit values, selected capacity, and finite input validation', () => {
  const profession = native({
    endurance: {
      state: (runtime) => runtime.profession.core.endurancePool,
      maximum: () => 150,
      regenerationRate: () => 0
    }
  });
  for (const [initialEndurance, expected] of [
    [undefined, 150],
    [0, 0],
    [25, 25],
    [-1, 0],
    [200, 150]
  ]) {
    const result = run([wait(100)], { config: { ...config, initialEndurance } }, profession);
    assert.equal(result.planningState.profession.endurancePool.endurance, expected);
  }

  for (const initialEndurance of [NaN, Infinity, -Infinity])
    assert.throws(
      () => run([wait(100)], { config: { ...config, initialEndurance } }, profession),
      /Initial endurance must be finite/
    );
});

test('live combo fields bind at the finisher boundary and actual outcomes trigger relics once', () => {
  const rotation = [cast(991005), cast(991006), wait(1000)];
  const detailed = run(rotation, { config: { ...config, relic: 'Visionary' } });
  assert.equal(detailed.events.filter((event) => event.type === 'combo').length, 1);
  assert.ok(detailed.resolvedEvents.some((event) => event.type === 'buff' && event.kind === 'might'));
  assert.equal(detailed.procSteps.filter((proc) => proc.skill === 'Relic of the Visionary').length, 1);
  assert.deepEqual(detailed.warnings, []);
  const score = run(rotation, { output: 'score', config: { ...config, relic: 'Visionary' } });
  assert.equal(detailed.totalDamage, score.totalDamage);
  const expired = run([cast(991005), wait(2000), cast(991006)]);
  assert.equal(expired.events.filter((event) => event.type === 'combo').length, 0);
});

test('missed and precombat impacts retain self combos while their hostile outcomes remain excluded', () => {
  // A finisher is a field interaction, so target eligibility applies to each outcome rather than the attempt.
  for (const precombat of [false, true]) {
    for (const finisherType of ['Blast', 'Projectile']) {
      for (const output of ['detailed', 'score']) {
        let owner;
        const profession = native({
          initialize(runtime) {
            owner = runtime;
            runtime.emit({
              type: 'combo_field',
              ownerActorType: 'player',
              at: 0,
              source: 'live',
              sourceId: 'fixture-field',
              actorType: 'player',
              fieldId: 'field',
              ownerId: 'live',
              fieldType: 'Fire',
              expiresAt: 3
            });
            runtime.emit(
              hit(1, { offTarget: !precombat, comboFinishers: [{ ownerId: 'live', finisherType, chance: 1 }] })
            );
          }
        });
        const result = run([wait(2000), ...(precombat ? [{ type: 'combat-start' }] : [])], { output }, profession);
        assert.equal(result.totalDamage, 0);
        assert.equal(owner.boons.has('might'), finisherType === 'Blast');
        if (output === 'detailed')
          assert.equal(
            result.resolvedEvents.some((event) => event.type === 'condition' || event.type === 'damage'),
            false
          );
      }
    }
  }
});

test('Fireworks eligibility uses inferred profession weapon strength in detailed and score execution', () => {
  // The materialized strike has no explicit profile override; the hit resolver supplies the selected profile.
  for (const output of ['detailed', 'score']) {
    let owner;
    const result = run(
      [cast(991013)],
      { output, config: { ...config, relic: 'Fireworks' } },
      native({
        initialize(runtime) {
          owner = runtime;
        }
      })
    );
    assert.equal(owner.relic.state.buffUntil, 6);
    assert.ok(result.totalDamage > 0);
  }
});

test('cast variant descriptions capture acceptance state before later actions mutate it', () => {
  const result = run(
    [cast(991001), cast(991001)],
    {},
    native({
      castDetail(runtime) {
        return `Variant: ${runtime.profession.core.grants}`;
      },
      onCastStart(runtime) {
        runtime.profession.core.grants++;
      }
    })
  );
  assert.deepEqual(
    result.steps.map((step) => step.detail),
    ['Variant: 0', 'Variant: 1']
  );
  assert.deepEqual(
    result.events.filter((event) => event.type === 'action').map((event) => event.detail),
    ['Variant: 0', 'Variant: 1']
  );
});

// The saved assumption is a real initial field, including its documented precedence over overlapping authored fields.
test('a permanent combo field exists before the first finisher and retains one owner through later casts', () => {
  const options = { config: { ...config, professionAssumptions: { permanentComboField: 'Ice' } } };
  const result = run([cast(991006), cast(991005), cast(991006)], options);
  const assumed = result.events.filter(
    (event) => event.type === 'combo_field' && event.sourceId === 'assumption.permanent-combo-field'
  );
  assert.equal(assumed.length, 1);
  assert.equal(assumed[0].at, 0);
  assert.equal(assumed[0].ownerId, 'live');
  assert.deepEqual(
    result.events.filter((event) => event.type === 'combo').map((event) => event.fieldType),
    ['Ice', 'Ice']
  );
  assert.deepEqual(result.warnings, []);
  assert.equal(
    run([cast(991006)]).events.some((event) => event.type === 'combo'),
    false
  );
});

test('Peitha conditions wait for actual impact and cannot leak beyond the observation window', () => {
  const options = { config: { ...config, relic: 'Peitha' } };
  const short = run([cast(991004)], options);
  assert.equal(short.resolvedEvents.filter((event) => event.type === 'condition').length, 0);
  const observed = run([cast(991004), wait(1500)], options);
  assert.equal(observed.resolvedEvents.find((event) => event.type === 'condition').at, 0.24);
  assert.ok(observed.conditionDamage > 0);
});

test('recharge entitlements are reserved once at acceptance and completion observes actual cooldown state', () => {
  const calls = [];
  const profession = native({
    reserveRecharge(runtime, skill, work) {
      calls.push(['reserve', runtime.time]);
      runtime.profession.core.grants++;
      return skill.id === 991002 ? work / 2 : work;
    },
    onCastComplete(runtime, activation) {
      if (activation.skill.id === 991002)
        calls.push(['complete', runtime.time, runtime.cooldowns.get(activation.skill.id)]);
    }
  });
  const result = run([cast(991002), cast(991002)], {}, profession);
  assert.deepEqual(calls, [
    ['reserve', 0],
    ['complete', 1, 1.8],
    ['reserve', 1.8],
    ['complete', 2.8, 2.8 + 0.8]
  ]);
  assert.equal(result.planningState.profession.grants, 2);
});

test('rejected and cancelled commands preserve recharge entitlements', () => {
  // Only accepted casts that commit may consume an entitlement; retries and cancellations leave it available.
  const profession = native({
    availability(_runtime, skill) {
      return skill.id === 991007 ? { ready: false, reason: 'Blocked fixture' } : { ready: true };
    },
    reserveRecharge(runtime, _skill, work) {
      runtime.profession.core.grants++;
      return work;
    }
  });
  const result = run([cast(991007), { ...cast(991002), interruptAfterMs: 100 }], {}, profession);
  assert.equal(result.planningState.profession.grants, 0);
  assert.equal(result.warnings.length, 1);
});

test('score mode retains execution facts for queries while omitting presentation collections', () => {
  let context;
  const profession = native({
    initialize(runtime) {
      context = runtime;
    }
  });
  run([cast(991003), cast(991001), wait(1000)], { output: 'score' }, profession);
  assert.ok(context.history.some((event) => event.type === 'buff'));
  assert.equal(context.breakdown.size, 0);
  assert.equal(context.resolved.length, 0);
  assert.equal(context.steps.length, 0);
});

// These boundary cases catch future-state leakage and repeated claims without relying on saved rotations.
test('boon duration snapshots the weapon set at application, and history excludes pending buffs', () => {
  const observed = [];
  const profession = native({
    initialize(runtime) {
      runtime.emit({
        type: 'weapon_set',
        at: 0.5,
        weaponSet: 2,
        source: 'live',
        sourceId: 'swap',
        actorType: 'player'
      });
      runtime.schedule('inspect', 0.75);
    },
    tasks: {
      inspect(runtime) {
        observed.push(runtime.query.timeline.buffStacksAt('might', runtime.time, 0, 25));
      }
    }
  });
  const result = run(
    [cast(991009)],
    { config: { ...config, weaponSetStats: [{ concentration: 0 }, { concentration: 1500 }] } },
    profession
  );
  assert.deepEqual(observed, [0]);
  assert.equal(result.resolvedEvents.find((event) => event.type === 'buff' && event.kind === 'might').duration, 4);
});

test('live cooldown queries observe completion and reset, and reject a future clock', () => {
  const seen = [];
  const profession = native({
    onCastComplete(runtime, activation) {
      if (activation.skill.id === 991002) seen.push(runtime.query.timeline.skillOnCooldownAt(991002, runtime.time));
    },
    onCastStart(runtime, activation) {
      if (activation.skill.id === 991001) {
        seen.push(runtime.query.timeline.skillOnCooldownAt(991002, runtime.time));
        assert.throws(() => runtime.query.timeline.skillOnCooldownAt(991002, runtime.time + 1), /current clock/);
      }
    }
  });
  run([cast(991002), { type: 'cooldown-reset' }, cast(991001)], {}, profession);
  assert.deepEqual(seen, [true, false]);
});

test('Shackles claims an actual immobilize once and rejects missed applications', () => {
  const options = { config: { ...config, relic: 'Shackles' } };
  const result = run([cast(991008), cast(991008), wait(5000)], options);
  assert.equal(
    result.resolvedEvents.filter((event) => event.type === 'damage' && event.sourceId === 'relic.shackles').length,
    1
  );
  const missed = run([{ ...cast(991008), offTarget: true }, wait(5000)], options);
  assert.equal(missed.totalDamage, 0);
  assert.equal(missed.procSteps.length, 0);
});

test('Mirage claims actual evades once per cooldown without a timeline replay', () => {
  const result = run([cast(991010), cast(991010), wait(1500)], { config: { ...config, relic: 'Mirage' } });
  assert.equal(
    result.resolvedEvents.filter((event) => event.type === 'condition' && event.sourceId === 'relic.mirage').length,
    1
  );
  assert.ok(result.conditionDamage > 0);
});

test('slot relic buffs activate at completion or delayed arrival and survive an authored precast swap', () => {
  const director = run([cast(991011), cast(991001)], { config: { ...config, relic: 'Director' } });
  assert.equal(director.procSteps.find((proc) => proc.skill === 'Relic of the Director').start, 1000);
  const early = run([cast(991012)], { config: { ...config, relic: 'Mount Balrior' } });
  assert.equal(early.procSteps.length, 0);
  const arrived = run([cast(991012), wait(1000)], { config: { ...config, relic: 'Mount Balrior' } });
  assert.equal(arrived.procSteps.find((proc) => proc.skill === 'Relic of Mount Balrior').start, 2000);
  const prepared = run([cast(991011), { type: 'combat-start' }, cast(991001)], {
    config: { ...config, relic: 'Thief', precastRelics: ['Director'] }
  });
  assert.equal(prepared.procSteps.filter((proc) => proc.skill === 'Relic of the Director').length, 1);
});

test('an accepted control opener establishes combat for sigils before the first damage payout', () => {
  const profession = native({
    initialize(runtime) {
      runtime.emit({
        type: 'control',
        at: 0,
        source: 'live',
        sourceId: 'control',
        actorType: 'player',
        controlKind: 'stun'
      });
    }
  });
  const result = run(
    [cast(991001), wait(1000)],
    { config: { ...config, sigilSets: [{ names: ['Severance'] }] } },
    profession
  );
  assert.equal(result.procSteps.filter((proc) => proc.skill === 'Sigil of Severance').length, 1);
});

test('precombat control notifications cannot start live producers before an explicit combat boundary', () => {
  // Both authored markers and inherited preview boundaries must anchor producers at combat entry.
  for (const inherited of [false, true]) {
    const starts = [];
    const profession = native({
      initialize(runtime) {
        runtime.emit({
          type: 'control',
          at: 0,
          source: 'live',
          sourceId: 'control',
          actorType: 'player',
          controlKind: 'stun'
        });
      },
      onCombatStart(runtime) {
        starts.push(runtime.time);
      }
    });
    const rotation = [wait(1000), ...(inherited ? [] : [{ type: 'combat-start' }]), cast(991001)];
    const result = run(rotation, inherited ? { combatStartTime: 1 } : {}, profession);
    assert.deepEqual(starts, [1]);
    assert.equal(
      result.events.some((event) => event.type === 'control' && event.at === 0),
      true
    );
  }
});

test('seeded equipment and combo execution produces identical detailed and score totals', () => {
  const rotation = [cast(991005), cast(991006), cast(991001), wait(4000), cast(991001), wait(1000)];
  const options = {
    config: {
      ...config,
      randomness: { mode: 'seeded', seed: 77 },
      relic: 'Visionary',
      sigilSets: [{ names: ['Air', 'Earth'] }]
    }
  };
  const detailed = run(rotation, options);
  const score = run(rotation, { ...options, output: 'score' });
  assert.equal(detailed.totalDamage, score.totalDamage);
  assert.equal(detailed.conditionDamage, score.conditionDamage);
  assert.equal(detailed.dps, score.dps);
});

test('Aristocracy records one actual stack claim and Brawler respects a pending combat marker', () => {
  const source = { source: 'live', sourceId: 'test', actorType: 'player', skillName: 'Test' };
  const aristocracy = native({
    initialize(runtime) {
      for (const at of [0, 0, 1.04])
        runtime.emit({ ...source, type: 'condition', condition: 'Weakness', stacks: 1, duration: 2, at });
    }
  });
  const stacks = run([wait(1500)], { config: { ...config, relic: 'Aristocracy' } }, aristocracy);
  assert.deepEqual(
    stacks.procSteps.map((proc) => proc.effectState.stacks),
    [1, 2]
  );
  const brawler = native({
    initialize(runtime) {
      runtime.emit({ ...source, type: 'buff', kind: 'protection', duration: 2, stacks: 1, at: 0 });
    }
  });
  const rotation = [wait(1000), { type: 'combat-start' }, cast(991001)];
  assert.equal(run(rotation, { config: { ...config, relic: 'Brawler' } }, brawler).procSteps.length, 0);
  assert.equal(
    run(rotation, { config: { ...config, relic: 'Brawler', precastRelics: ['Brawler'] } }, brawler).procSteps.length,
    1
  );
});
