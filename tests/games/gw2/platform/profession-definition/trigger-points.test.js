import {
  onTriggerPoint,
  compileTriggerPoints,
  compileProfessionRules
} from '#gw2/platform/profession-definition/trigger-rules.js';
import { defineNativeModule, defineNativeProfession } from '#gw2/platform/profession-definition/profession.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import { defineTriggerPoint } from '#gw2/platform/profession-definition/trigger-points.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { observeGw2Runtime, observedRuntime } from '#tests/helpers/observed-runtime.js';
import assert from 'node:assert/strict';
import test from 'node:test';

const strike = {
  id: 1,
  name: 'Strike',
  type: 'Weapon',
  weapon: 'Sword',
  castTimeMs: 0,
  cooldown: 0,
  effects: [{ type: 'strike', coefficient: 1 }]
};
const burst = {
  id: 2,
  name: 'Burst',
  type: 'Utility',
  castTimeMs: 0,
  cooldown: 5,
  effects: [{ type: 'strike', coefficient: 1 }]
};
const struck = defineTriggerPoint('fixture.struck', [103, 101, 102]);

test('cast-stage invocation carries the accepted cast identity as cause without adopting it as the proc identity', () => {
  // Delayed completion identifies the accepted action rather than synthesizing a new or anonymous parent.
  const requests = [];
  const hooks = compileProfessionRules({ traitTriggers: [{ trait: 101, on: 'castCommit', invoke: 2 }] });
  const runtime = {
    time: 3,
    config: { selectedTraitIds: [101] },
    helpers: { skillsById: new Map([[2, burst]]) },
    effects: { emit: (request) => requests.push(request) }
  };
  hooks.onCastCommit(runtime, { id: 'accepted:cast', skill: strike });
  assert.equal(requests[0].cause.activationId, 'accepted:cast');
  assert.equal(requests[0].cause.skillId, strike.id);
  assert.equal(requests[0].cause.at, 3);
  assert.equal(requests[0].attribution.skillId, burst.id);
  assert.equal(requests[0].attribution.activationId, undefined);
});

// JavaScript callers receive the same authoring rejection as TypeScript instead of silent listener omissions.
test('point registration rejects unbound listeners and invalid declarations', () => {
  assert.throws(
    () => defineTrait({ id: 101, name: 'Raw', triggers: [{ on: struck, run() {} }] }),
    /use onTriggerPoint/
  );
  for (const id of [NaN, Infinity, -Infinity])
    assert.throws(() => defineTriggerPoint('fixture.invalid', [id]), /invalid trait/);
  for (const declaration of [
    { emit: NaN },
    { invoke: '' },
    { invoke: 2, announce: 'yes' },
    { emit: 101, effects: 1 },
    { run() {}, unknown: true }
  ])
    assert.throws(() => onTriggerPoint(struck, declaration), /trigger/);
});

test('a missing declarative cause cannot consume a proc claim or skill recharge', () => {
  for (const cooldown of ['profile', 'skill']) {
    const point = defineTriggerPoint('fixture.cause', [101]);
    const declaration = onTriggerPoint(point, { ...(cooldown === 'skill' ? { invoke: 2 } : { emit: 101 }), cooldown });
    const [listener] = compileTriggerPoints([{ ...declaration, trait: 101 }]).get(point.id);
    const claims = [];
    const runtime = {
      config: { selectedTraitIds: [101] },
      queries: {},
      procs: {
        claim() {
          claims.push('proc');
        }
      },
      cooldownController: {
        startRecharge() {
          claims.push('recharge');
        }
      }
    };
    for (const input of [{}, { cause: { at: NaN } }, { cause: { at: Infinity } }])
      assert.throws(() => listener(runtime, input), /cause with a finite time/);
    assert.deepEqual(claims, []);
    // Unselected declarations do not inspect or claim their boundary at all.
    runtime.config.selectedTraitIds = [];
    listener(runtime, {});
    assert.deepEqual(claims, []);
  }
});
// The fixture mechanic fires its point once per completed cast, carrying the accepted action as cause.
const fireStruck = {
  onCastCommit(runtime, cast) {
    runtime.fireTrigger(struck, {
      skillId: cast.skill.id,
      cause: {
        type: 'action',
        at: runtime.time,
        source: 'fixture',
        sourceId: cast.skill.id,
        actorType: 'player',
        skillId: cast.skill.id,
        skillName: cast.skill.name
      }
    });
  }
};

function family(traits, eliteTraits = [], hooks = fireStruck) {
  const metadata = (list) => list.map(({ id, name }) => ({ id, name }));
  return defineNativeProfession({
    id: 'fixture',
    name: 'Fixture',
    modules: [
      defineNativeModule({
        id: 'Core',
        data: { generatedSkills: [strike, burst], traits: metadata(traits) },
        state: { create: () => ({}) },
        hooks,
        traitDefinitions: traits
      }),
      defineNativeModule({
        id: 'Elite',
        data: { traits: metadata(eliteTraits) },
        state: { create: () => ({}) },
        traitDefinitions: eliteTraits
      })
    ]
  });
}

const listener = (id, calls, point = struck) =>
  defineTrait({
    id,
    name: `Trait ${id}`,
    triggers: [
      onTriggerPoint(point, {
        when: () => {
          calls.push(`when ${id}`);
          return true;
        },
        run: (_runtime, input) => calls.push(`run ${id} ${input.skillId}`)
      })
    ]
  });

test('point listeners run in the declared order across Core and elite, checking selection before when', () => {
  const calls = [];
  const profession = family([listener(101, calls), listener(102, calls)], [listener(103, calls)]);
  simulateGw2({
    profession,
    rotation: [1],
    config: { specialization: 'Elite', selectedTraitIds: [101, 103] }
  });
  assert.deepEqual(calls, ['when 103', 'run 103 1', 'when 101', 'run 101 1']);
});

test('intrinsic listeners opt out of the selection gate explicitly', () => {
  const calls = [];
  const intrinsic = defineTrait({
    id: 103,
    name: 'Intrinsic minor',
    triggers: [onTriggerPoint(struck, { requiresSelection: false, run: () => calls.push('run 103') })]
  });
  const profession = family([listener(101, calls), listener(102, calls)], [intrinsic]);
  simulateGw2({ profession, rotation: [1], config: { specialization: 'Elite', selectedTraitIds: [] } });
  assert.deepEqual(calls, ['run 103']);
  assert.throws(
    () =>
      defineTrait({
        id: 101,
        name: 'Bad',
        triggers: [onTriggerPoint(struck, { requiresSelection: 'no', run: () => {} })]
      }),
    /requiresSelection must be boolean/
  );
});

test('declarative point payloads keep trait attribution and the firing cause', () => {
  const profile = {
    id: 101,
    name: 'Emitting trait',
    balance: { effects: [{ type: 'condition', condition: 'Bleeding', stacks: 1, duration: 1 }] },
    triggers: [onTriggerPoint(struck, { emit: 101 })]
  };
  const calls = [];
  const profession = family([defineTrait(profile), listener(102, calls)], [listener(103, calls)]);
  const result = simulateGw2({ profession, rotation: [1], config: { selectedTraitIds: [101] } });
  const bleeding = result.events.filter((event) => event.type === 'condition' && event.sourceId === 101);
  assert.equal(bleeding.length, 1);
  assert.equal(bleeding[0].source, 'Trait');
  assert.equal(bleeding[0].skillName, 'Strike');
});

test('isolated payload runtimes compile no listeners but still list invoked skills as trait occurrences', () => {
  const invoking = defineTrait({ id: 101, name: 'Invoker', triggers: [onTriggerPoint(struck, { invoke: 2 })] });
  const calls = [];
  const profession = family([invoking, listener(102, calls)], [listener(103, calls)]);
  const config = { selectedTraitIds: [101, 102] };
  assert.equal(profession.runtimeFor(config).triggerListeners.get('fixture.struck').length, 2);
  const isolated = profession.runtimeFor(config, { traitTriggers: false });
  assert.equal(isolated.triggerListeners.size, 0);
  assert.deepEqual(
    isolated.damageEffects.map(({ id, ownerId, sourceIds, name }) => ({ id, ownerId, sourceIds, name })),
    [{ id: 'trait-skill.101.2', ownerId: 101, sourceIds: [2], name: 'Burst' }]
  );
});

// Both registration paths must reject an unselected or disabled producer before eligibility or cooldown admission.
for (const stage of ['point', 'castStart', 'castCommit', 'damage.resolved']) {
  test(`${stage} activation gates precede predicates and proc claims`, () => {
    const point = defineTriggerPoint('fixture.activation', [109]);
    for (const selected of [false, true]) {
      for (const traitTriggers of [false, true]) {
        const calls = [];
        const reaction = {
          cooldown: 'profile',
          when() {
            calls.push('eligible');
            return true;
          },
          run() {
            calls.push('activated');
          }
        };
        const trait = defineTrait({
          id: 109,
          name: 'Gated producer',
          balance: { internalCooldown: 1 },
          triggers: [stage === 'point' ? onTriggerPoint(point, reaction) : { on: stage, ...reaction }]
        });
        const source = family([trait], [], {
          onCastCommit(runtime, cast) {
            runtime.fireTrigger(point, { activationId: cast.id });
          }
        });
        const config = { selectedTraitIds: selected ? [109] : [] };
        const result = observeGw2Runtime({
          profession: source.runtimeFor(config, { traitTriggers }),
          config,
          rotation: [1]
        });
        const active = selected && traitTriggers;
        assert.deepEqual(result.warnings, []);
        assert.deepEqual(calls, active ? ['eligible', 'activated'] : []);
        assert.deepEqual(Object.keys(observedRuntime(result).procs.snapshot()), active ? ['109'] : []);
      }
    }
  });
}

// Explicit payload admission is independent of activation discovery; disabling producers must not erase its owner.
test('isolated registration preserves selected value policies and admitted lifetime handlers', () => {
  const calls = [];
  const point = defineTriggerPoint('fixture.admission', [109]);
  const trait = defineTrait({
    id: 109,
    name: 'Admitted payload',
    modifierRules: [{ id: 'fixture.passive', target: 'strikeDamage', operation: 'multiply', factor: 2 }],
    rechargeRules: [{ when: () => true, multiplier: 0.5 }],
    triggers: [
      onTriggerPoint(point, { requiresSelection: false, run: () => calls.push('new point activation') }),
      { on: 'castCommit', requiresSelection: false, run: () => calls.push('new stage activation') }
    ],
    hooks: {
      boonDuration: (_runtime, _event, _base, scaled) => scaled + 2
    },
    lifetime: {
      tasks: {
        'fixture.admitted-task'(_runtime, payload) {
          calls.push(`task ${payload.activationId}`);
        }
      },
      eventHandlers: {
        'fixture.admitted-event'(_runtime, event) {
          calls.push(`event ${event.activationId}`);
        }
      }
    }
  });
  const source = family([trait], [], {
    initialize(runtime) {
      runtime.schedule('fixture.admitted-task', 0.5, { activationId: 'explicit-payload' });
      runtime.effects.emit({
        kind: 'packet',
        event: {
          type: 'fixture.admitted-event',
          at: 0.25,
          source: 'Trait',
          sourceId: 109,
          actorType: 'effect',
          activationId: 'explicit-payload'
        }
      });
    },
    onCastCommit(runtime, cast) {
      runtime.fireTrigger(point, { activationId: cast.id });
    }
  });
  for (const selectedTraitIds of [[], [109]]) {
    calls.length = 0;
    const config = { selectedTraitIds };
    const isolated = source.runtimeFor(config, { traitTriggers: false });
    const query = { config, helpers: isolated.catalog };
    assert.equal(isolated.modifyStrikeDamage(query, 10), selectedTraitIds.length ? 20 : 10);
    assert.equal(isolated.rechargeWork(query, burst, 10), selectedTraitIds.length ? 5 : 10);
    assert.equal(isolated.boonDuration(query, { type: 'buff', kind: 'fury' }, 1, 4), 6);
    const result = observeGw2Runtime({
      profession: isolated,
      config,
      rotation: [1, { type: 'wait', durationMs: 1000 }]
    });
    assert.deepEqual(result.warnings, []);
    assert.deepEqual(calls, ['event explicit-payload', 'task explicit-payload']);
  }
});

test('a skill cooldown shares the invoked skill recharge with direct casts', () => {
  const invoking = defineTrait({
    id: 101,
    name: 'Invoker',
    triggers: [{ on: 'castCommit', when: (_runtime, cast) => cast.skill.id === 1, invoke: 2, cooldown: 'skill' }]
  });
  const burstHits = (rotation, selectedTraitIds = [101]) =>
    simulateGw2({ profession: family([invoking], [], {}), rotation, config: { selectedTraitIds } })
      .events.filter((event) => event.type === 'damage' && event.skillId === 2)
      .map((event) => [event.source === 'Trait', event.at]);
  // A triggered burst starts the shared recharge, delaying the direct cast that is otherwise immediate.
  assert.deepEqual(burstHits([1, 2], []), [[false, 0]]);
  const [triggered, direct] = burstHits([1, 2]);
  assert.deepEqual(triggered, [true, 0]);
  assert.equal(direct[0], false);
  assert.ok(direct[1] > 0);
  // A direct cast on recharge leaves no triggered burst.
  assert.deepEqual(
    burstHits([2, 1]).map(([fromTrait]) => fromTrait),
    [false]
  );
});

test('order lists, reactions, and point options are validated when declared and compiled', () => {
  const calls = [];
  assert.throws(() => defineTriggerPoint('Fixture Point', [1]), /<profession>\.<boundary>/);
  assert.throws(() => defineTriggerPoint('fixture.point', [1, '1']), /twice/);
  assert.throws(
    () => defineTrait({ id: 101, name: 'Ordered', triggers: [onTriggerPoint(struck, { order: 1, run: () => {} })] }),
    /cannot set order/
  );
  assert.throws(
    () => defineTrait({ id: 101, name: 'Two', triggers: [onTriggerPoint(struck, { emit: 101, run: () => {} })] }),
    /exactly one/
  );
  assert.throws(
    () => defineTrait({ id: 101, name: 'Skill', triggers: [onTriggerPoint(struck, { emit: 101, cooldown: 'skill' })] }),
    /requires invoke/
  );
  // A listener absent from the list, a listed trait without a listener, and a repeated listener all fail.
  assert.throws(
    () => family([listener(101, calls), listener(102, calls), listener(104, calls)], [listener(103, calls)]),
    /104 listens to fixture.struck but is missing/
  );
  assert.throws(() => family([listener(101, calls), listener(102, calls)]), /lists trait 103, which has no listener/);
  const twice = defineTrait({
    id: 101,
    name: 'Twice',
    triggers: [onTriggerPoint(struck, { run: () => {} }), onTriggerPoint(struck, { run: () => {} })]
  });
  assert.throws(() => family([twice, listener(102, calls)], [listener(103, calls)]), /more than once/);
  const impostor = defineTriggerPoint('fixture.struck', [103, 101, 102]);
  assert.throws(
    () => family([listener(101, calls, impostor), listener(102, calls)], [listener(103, calls)]),
    /declared more than once/
  );
});

// Nested boundaries settle synchronously before the current listener and the next ordered listener continue.
test('nested trigger points preserve causal listener ordering', () => {
  const outer = defineTriggerPoint('fixture.outer', [101, 102]);
  const inner = defineTriggerPoint('fixture.inner', [103]);
  const calls = [];
  const profession = family(
    [
      defineTrait({
        id: 101,
        name: 'First',
        triggers: [
          onTriggerPoint(outer, {
            run(runtime, input) {
              calls.push('before');
              runtime.fireTrigger(inner, input);
              calls.push('after');
            }
          })
        ]
      }),
      defineTrait({
        id: 102,
        name: 'Second',
        triggers: [
          onTriggerPoint(outer, {
            run() {
              calls.push('next');
            }
          })
        ]
      })
    ],
    [
      defineTrait({
        id: 103,
        name: 'Nested',
        triggers: [
          onTriggerPoint(inner, {
            run(_runtime, input) {
              calls.push(input.activationId);
            }
          })
        ]
      })
    ],
    {
      onCastCommit(runtime, cast) {
        runtime.fireTrigger(outer, { activationId: cast.id, at: runtime.time });
      }
    }
  );
  simulateGw2({ profession, rotation: [1], config: { specialization: 'Elite', selectedTraitIds: [101, 102, 103] } });
  assert.deepEqual(calls, ['before', 'cast:1', 'after', 'next']);
});

// Duration adjustments are value hooks and compose once after ordinary shared duration scaling.
test('trait boon duration hooks validate and compose in Core then elite order', () => {
  const core = defineTrait({
    id: 101,
    name: 'Core duration',
    hooks: {
      boonDuration(_context, _event, _base, scaled) {
        return scaled + 2;
      }
    }
  });
  const elite = defineTrait({
    id: 103,
    name: 'Elite duration',
    hooks: {
      boonDuration(_context, _event, _base, scaled) {
        return scaled * 3;
      }
    }
  });
  const profession = family([core], [elite], {}).runtimeFor({ specialization: 'Elite' });
  assert.equal(profession.boonDuration({}, { type: 'buff', kind: 'fury' }, 1, 4), 18);
  assert.throws(
    () => defineTrait({ id: 104, name: 'Invalid duration', hooks: { boonDuration: 3 } }),
    /boonDuration must be a function/
  );
});
