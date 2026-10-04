import assert from 'node:assert/strict';
import test from 'node:test';
import { MODIFIER_HOOK_NAMES } from '#gw2/platform/profession-definition/compiler/compile-contract.js';
import { createCanonicalCatalog } from '#gw2/platform/skills/catalog.js';
import { createEffectReactions } from '#gw2/platform/resolver/effect-reactions.js';
import { materializeSkillEffectApplications } from '#gw2/platform/effects/materializer.js';
import { observeGw2Runtime, observedRuntime } from '#tests/helpers/observed-runtime.js';
import { testProfession } from '#tests/fixtures/profession.js';
import { applySideEffect } from '#gw2/platform/effects/action-dispatch.js';

const grant = (amount) => ({ type: 'resourceGrant', resource: 'energy', amount });
const reaction = (doAction = grant(1), extra = {}) => ({
  on: 'damage.resolved',
  actor: 'player',
  packets: 'each',
  do: doAction,
  ...extra
});
const strike = (reactions, extra = {}) => ({
  type: 'strike',
  coefficient: 1,
  atMs: 100,
  timingAnchor: 'castStart',
  timingScale: 'fixed',
  reactions,
  ...extra
});
const wait = (durationMs) => ({ type: 'wait', durationMs });
const cast = (extra = {}) => ({ type: 'cast', skillId: 990101, ...extra });
function catalogFor(effects, skill = {}, balanceProfiles = []) {
  return createCanonicalCatalog({
    generated: [{ id: 990101, name: 'Reaction fixture', weapon: 'Sword', castTimeMs: 0, effects, ...skill }],
    balanceProfiles
  });
}

function run(
  effects,
  { skill = {}, hooks = {}, rotation = [cast(), wait(1000)], config = {}, profiles = [], output } = {}
) {
  return observeGw2Runtime({
    output,
    config: { stats: { power: 1000, precision: 1000 }, target: { armor: 1000, conditions: {} }, ...config },
    rotation,
    profession: {
      // Use the canonical list so fixtures retain every required modifier as the contract evolves.
      ...Object.fromEntries(MODIFIER_HOOK_NAMES.map((key) => [key, testProfession[key]])),
      id: 'fixture',
      catalog: catalogFor(effects, skill, profiles),
      createState: () => ({ energy: { value: 0, maximum: 100, updatedAt: 0, rate: 0 } }),
      resources: {
        energy: {
          kind: 'continuous',
          state: (runtime) => runtime.profession.energy,
          maximum: () => 100,
          initial: () => 0,
          recovery: () => 0
        }
      },
      ...hooks
    }
  });
}

const energy = (result) => observedRuntime(result).profession.energy.value;

// Formula-backed grants use the same dispatch for endurance and other pools and reject invalid results before mutation.
test('resource formulas resolve read-only facts and live parameters through ordinary pool dispatch', () => {
  const calls = [];
  const queries = { time: 2 };
  const context = { kind: 'effect', skill: { id: 1 }, trigger: { event: {} } };
  const services = {
    queries,
    resourceController: { grant: (resource, amount) => calls.push([resource, amount]) },
    endurance: { grant: (amount) => calls.push(['endurance', amount]) }
  };
  const amount = {
    parameters: { value: 3 },
    validate: () => {},
    resolve: (facts, trigger, parameters) => {
      assert.equal(facts, queries);
      assert.equal(trigger, context);
      return parameters.value * facts.time;
    }
  };
  for (const resource of ['energy', 'endurance'])
    applySideEffect(services, context, { type: 'resourceGrant', resource, amount });
  assert.deepEqual(calls, [
    ['energy', 6],
    ['endurance', 6]
  ]);
  for (const value of [-1, NaN, Infinity])
    assert.throws(
      () =>
        applySideEffect(services, context, {
          type: 'resourceGrant',
          resource: 'endurance',
          amount: { ...amount, parameters: { value } }
        }),
      /finite and non-negative/
    );
  assert.equal(calls.length, 2);
});

// Recipes are validated at their declaration stage and evaluated only after their owning reaction accepts a packet.
test('resource formula validation retains trigger identity and miss gating', () => {
  let resolved = 0;
  const stages = [];
  const amount = {
    parameters: { value: 7 },
    validate: (parameters, on) => {
      assert.equal(parameters.value, 7);
      stages.push(on);
    },
    resolve: (_queries, _context, parameters) => {
      resolved++;
      return parameters.value;
    }
  };
  assert.equal(energy(run([strike([reaction(grant(amount))])])), 7);
  assert.equal(resolved, 1);
  assert.equal(
    energy(run([strike([reaction(grant(amount))])], { rotation: [cast({ offTarget: true }), wait(1000)] })),
    0
  );
  assert.equal(resolved, 1);
  assert.ok(stages.every((stage) => stage === 'damage.resolved'));
  assert.throws(() => catalogFor([strike([reaction(grant({ ...amount, resolve: undefined }))])]), /resolver/);
});

// Runtime stack expansion keeps first-packet rewards singular while each-application rewards observe every stack.
test('Burning splitting preserves first/each reactions across timed pulses and repeated casts', () => {
  const result = run(
    [
      {
        type: 'condition',
        ticks: [100, 400].map((atMs) => ({ atMs, condition: 'Burning', stacks: 2.5, duration: 1 })),
        timingAnchor: 'castStart',
        reactions: [
          reaction(grant(10), { on: 'condition.applied', packets: 'first' }),
          reaction(grant(1), { on: 'condition.applied' })
        ]
      }
    ],
    { rotation: [cast(), wait(1000), cast(), wait(1000)] }
  );
  assert.deepEqual(result.warnings, []);
  assert.equal(energy(result), 32);
});

// First means authored packet one; a miss never promotes a later packet or an unrelated same-ID effect.
test('effect reactions retain per-effect first/each ownership and targeting', () => {
  for (const missFirst of [false, true]) {
    const result = run(
      [
        strike([reaction(grant(7), { packets: 'first' }), reaction()], {
          coefficient: undefined,
          atMs: undefined,
          ticks: [
            { atMs: 100, coefficient: 1 },
            { atMs: 200, coefficient: 1 }
          ]
        }),
        strike(undefined, { atMs: 300 })
      ],
      {
        hooks: {
          prepareEvent: (_runtime, event) =>
            event.type === 'damage' && event.at === 0.1 && missFirst ? { ...event, offTarget: true } : event
        }
      }
    );
    assert.deepEqual(result.warnings, []);
    assert.equal(energy(result), missFirst ? 1 : 9);
  }

  assert.equal(energy(run([strike([reaction()])], { rotation: [cast({ offTarget: true }), wait(1000)] })), 0);
  assert.equal(energy(run([strike([reaction()])], { rotation: [cast(), wait(1000), { type: 'combat-start' }] })), 0);
  assert.equal(energy(run([strike([reaction(grant(200))])])), 100);
});

// A serializable delayed packet keeps its declaration, while its owner still controls cancellation.
test('owner cancellation gates deferred authored reactions', () => {
  for (const cancel of [false, true]) {
    const result = run([], {
      hooks: {
        onCastStart(runtime, accepted) {
          const effect = strike([reaction(grant(8), { when: () => true })], { atMs: 500 });
          const owner = { id: 'fixture.summon', generation: 1 };
          const [{ event }] = materializeSkillEffectApplications({
            skill: accepted.skill,
            effect,
            start: runtime.time,
            fullEnd: runtime.time,
            reactionGroup: runtime.effectReactions.register(accepted.skill, effect),
            baseEvent: {
              source: 'fixture',
              sourceId: accepted.skill.id,
              actorType: 'player',
              skillId: accepted.skill.id
            }
          });
          runtime.effects.emit({ kind: 'packet', event: structuredClone(event), ...{ owner } });
          if (cancel) runtime.cancelOwner(owner);
        }
      }
    });
    assert.equal(energy(result), cancel ? 0 : 8);
  }
});

// Surviving launched projectiles own rewards even after the cast reservation has retired.
test('reaction timing follows impact delay, commitment, observation and target death', () => {
  const effects = [strike([reaction()], { atMs: 800, persistsAfterInterrupt: true })];
  const skill = { castTimeMs: 600, interruptCommitMs: 200 };
  assert.equal(energy(run(effects, { skill, rotation: [cast({ interruptAfterMs: 100 }), wait(1000)] })), 0);
  assert.equal(energy(run(effects, { skill, rotation: [cast({ interruptAfterMs: 400 }), wait(1000)] })), 1);
  assert.equal(energy(run(effects, { skill, rotation: [cast({ impactDelayMs: 500 }), wait(400)] })), 0);
  assert.equal(energy(run(effects, { skill, rotation: [cast({ impactDelayMs: 500 }), wait(1400)] })), 1);
  assert.equal(energy(run([strike(undefined), ...effects], { skill, config: { target: { health: 1, armor: 1 } } })), 0);
});

// Conditions reward accepted applications, including fractional stacks, rather than later damage ticks.
test('condition and control reactions run before profession observers with ordered actions', () => {
  const observed = [];
  const result = run(
    [
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 0.5,
        duration: 2,
        reactions: [reaction([grant(2), grant({ skillField: 'resourceGain' })], { on: 'condition.applied' })]
      },
      { type: 'control', controlKind: 'daze', reactions: [reaction(grant(4), { on: 'control.resolved' })] },
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 1,
        duration: 2,
        reactions: [reaction(grant(90), { on: 'condition.applied' })]
      }
    ],
    {
      skill: { resourceGain: 3 },
      rotation: [cast(), wait(3000)],
      hooks: {
        prepareEvent: (_runtime, event) => (event.condition === 'Poisoned' ? { ...event, offTarget: true } : event),
        reactions: {
          'condition.applied': (runtime) => observed.push(runtime.profession.energy.value),
          'control.resolved': (runtime) => observed.push(runtime.profession.energy.value)
        }
      }
    }
  );
  assert.deepEqual(observed, [5, 9]);
  assert.equal(energy(result), 9);
});

// Selection attaches only the chosen effect's reactions, with no skill-ID fallback for replacement or removed packets.
test('variants and explicit summon ownership select their own reaction groups', () => {
  const base = strike([reaction(grant(1))]);
  const replacement = strike([reaction(grant(6), { actor: 'summon' })], { actorType: 'summon' });
  const profiles = [{ id: 'fixture.variant', name: 'Variant', profileKind: 'trait', effects: [replacement] }];
  for (const keep of [true, false]) {
    const result = run([base], {
      profiles,
      skill: {
        effectVariants: [
          {
            when: () => true,
            profileId: 'fixture.variant',
            transform: (_runtime, _cast, effects) => (keep ? effects : [])
          }
        ]
      }
    });
    assert.equal(energy(result), keep ? 6 : 0);
  }
});

// A derived clone of a triggering packet must not recursively inherit that packet's grant declaration.
test('custom actions share typed contexts and derived packets do not inherit reactions', () => {
  const contexts = [];
  const result = run([strike([reaction({ type: 'fixture.copy' })])], {
    skill: { sideEffects: [{ on: 'castCommit', do: { type: 'fixture.copy' } }] },
    hooks: {
      sideEffectHandlers: {
        'fixture.copy'(runtime, context) {
          contexts.push(context.kind);
          if (context.kind === 'effect') {
            runtime.resourceController.grant('energy', 1);
            runtime.effects.emit({
              kind: 'packet',
              cause: context.trigger.event,
              event: { ...structuredClone(context.trigger.event), sourceId: 'copy' }
            });
            runtime.effects.emit({
              kind: 'packet',
              event: { ...structuredClone(context.trigger.event), at: runtime.time + 0.1, sourceId: 'delayed-copy' },
              ...{ cause: context.trigger.event, owner: { id: 'copy-owner', generation: 1 } }
            });
          }
        }
      }
    }
  });
  assert.deepEqual(contexts, ['cast', 'effect']);
  assert.equal(energy(result), 1);
});

// Shared emitters opt in through authored effects; their packets retain only serializable reaction references.
test('procedural profile actions retain causality and authored skill tasks stay serializable', () => {
  let taskCast;
  const result = run([strike([reaction({ type: 'emitProfile', profileId: 'fixture.reward' }, { when: () => true })])], {
    profiles: [
      {
        id: 'fixture.reward',
        name: 'Reward',
        profileKind: 'trait',
        effects: [strike([reaction(grant(5), { actor: 'effect' })], { atMs: 0 })]
      }
    ],
    skill: { tasks: [{ type: 'fixture.task', atMs: 300, timingScale: 'fixed' }] },
    hooks: {
      tasks: {
        'fixture.task': (_runtime, data) => {
          taskCast = data.cast;
        }
      }
    }
  });
  assert.equal(energy(result), 5);
  assert.equal(taskCast.skill.id, 990101);
  assert.equal(typeof taskCast.skill.effects[0].reactions[0].when, 'function');
  const hits = result.events.filter((event) => event.type === 'damage');
  assert.equal(hits[1].parentEventOrder, hits[0].eventOrder);
  assert.doesNotThrow(() => structuredClone(hits));
});

// Critical-dependent declarations reuse the resolver outcome and work in score-only simulations too.
test('resolved critical facts are shared without a second roll or reporting dependency', () => {
  for (const output of ['detailed', 'score']) {
    const seen = [];
    const result = run(
      [
        strike([
          reaction(grant(3), {
            when: (_runtime, trigger) => {
              seen.push(trigger.details.hitContext.critical.didCrit);
              return trigger.details.hitContext.critical.didCrit;
            }
          })
        ])
      ],
      {
        output,
        hooks: { prepareEvent: (_runtime, event) => (event.type === 'damage' ? { ...event, didCrit: true } : event) }
      }
    );
    assert.equal(energy(result), 3);
    assert.deepEqual(seen, [true]);
  }
});

// Invalid authoring fails both at catalog assembly and after a runtime variant supplies a new declaration.
test('reaction validation rejects incompatible stages, malformed actions and missing runtime handlers', () => {
  for (const bad of [
    reaction(grant(1), { on: 'condition.applied' }),
    reaction(grant(1), { actor: 'any' }),
    reaction(grant(1), { packets: 'first-successful' }),
    reaction(grant(-1)),
    reaction(grant({ skillField: 'absent' })),
    reaction({ type: 'flipArm', skillId: 990101, durationSec: 1 }),
    reaction({ type: 'flipConsume', skillId: 990101 }),
    reaction([]),
    reaction(null),
    reaction({ type: 'emitProfile', profileId: 'missing' }),
    reaction(grant(1), { when: true })
  ])
    assert.throws(() => catalogFor([strike([bad])]));
  assert.throws(() => run([strike([reaction({ type: 'fixture.missing' })])]), /handler/);
  assert.throws(
    () =>
      run([strike([])], {
        profiles: [{ id: 'variant', name: 'Variant', profileKind: 'trait', effects: [] }],
        skill: {
          effectVariants: [{ when: () => true, profileId: 'variant', transform: () => [strike([reaction(grant(-1))])] }]
        }
      }),
    /non-negative/
  );
});

// Interning repeated declarations avoids a per-cast or per-hit retained registry entry.
test('reaction registry interns shared declarations across repeated materialization', () => {
  const catalog = catalogFor([strike([reaction()])]);
  const skill = catalog.skills[0];
  const registry = createEffectReactions(catalog, {
    hasHandler: () => false,
    apply: () => assert.fail('Registration cannot dispatch actions.')
  });
  const ids = new Set();
  for (let index = 0; index < 1000; index++) ids.add(registry.register(skill, { ...skill.effects[0] }));
  assert.equal(ids.size, 1);
});

// A finisher carries its authored packet identity through selection/chance without passing reactions to combo damage.
test('resolved combo reactions retain finisher provenance, acceptance gates, and observer ordering', () => {
  for (const [field, chance, expected] of [
    [true, 1, 7],
    [false, 1, 0],
    [true, 0, 0]
  ]) {
    const seen = [];
    const result = run(
      [
        strike([reaction(grant(7), { on: 'combo.resolved' })], {
          comboFinishers: [
            { ownerId: 'fixture', finisherType: 'Projectile', chance, ambiguousFieldSelection: 'oldest' }
          ]
        }),
        // A sibling packet with the same skill identity must not borrow the first packet's reaction.
        strike(undefined, {
          atMs: 200,
          comboFinishers: [{ ownerId: 'fixture', finisherType: 'Blast', ambiguousFieldSelection: 'oldest' }]
        })
      ],
      {
        skill: {
          comboFields: field ? [{ ownerId: 'fixture', fieldType: 'Fire', duration: 1, startAnchor: 'castStart' }] : []
        },
        hooks: {
          reactions: {
            'combo.resolved'(runtime, event) {
              seen.push({
                energy: runtime.profession.energy.value,
                reaction: event.effectReaction,
                activation: event.activationId
              });
            }
          }
        }
      }
    );
    assert.deepEqual(result.warnings, []);
    assert.equal(energy(result), expected);
    if (expected) {
      assert.equal(seen[0].energy, 7);
      assert.equal(seen[0].reaction.packet, 1);
      assert.ok(seen[0].activation);
      assert.equal(seen[1].reaction, undefined);
      assert.ok(result.resolvedEvents.some((event) => event.type === 'condition' && event.condition === 'Burning'));
    }
  }

  assert.throws(() => catalogFor([strike([reaction(grant(1), { on: 'combo.resolved' })])]), /invalid effect reaction/);
});
