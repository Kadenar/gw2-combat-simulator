import assert from 'node:assert/strict';
import test from 'node:test';

import { baseAttributeInputs } from '#gw2/platform/attributes/inputs.js';
import { createEffectEmissionService } from '#gw2/platform/effects/emission.js';
import { createEffectExpansionBudget } from '#gw2/platform/effects/expansion-budget.js';
import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';
import { countProcActivations } from '#gw2/platform/results/proc-counts.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { createCanonicalCatalog } from '#gw2/platform/skills/catalog.js';
import { captureEffectEmissions } from '#tests/helpers/effect-emission.js';
import { resolveTestGw2Events } from '#tests/helpers/gw2-resolver.js';
import { defineTestProfession } from '#tests/helpers/profession.js';

const attribution = { source: 'Trait', sourceId: 42, actorType: 'player', skillId: 42, skillName: 'Fixture trait' };
const strike = { ...attribution, type: 'damage', at: 1, coefficient: 1, skillWeapon: 'Sword' };

test('proc identity spans sibling effects and split stacks while separate emissions remain distinct', () => {
  const profile = {
    id: 42,
    name: 'Fixture trait',
    effects: [
      {
        type: 'condition',
        name: 'Burning',
        condition: 'Burning',
        stacks: 3,
        duration: 2,
        applications: 2,
        intervalMs: 500
      },
      { type: 'condition', name: 'Slow', condition: 'Slow', stacks: 1, duration: 2 }
    ]
  };
  const result = resolveTestGw2Events({
    events: [strike],
    endTime: 4,
    professionReactions: {
      'damage.resolved'(runtime, event) {
        // The same cause can launch independent periodic procs; neither cause nor stack identity can be the key.
        for (let index = 0; index < 2; index++)
          emitTraitProfile(
            { effects: runtime.effects, helpers: { balanceProfilesById: new Map([[42, profile]]) } },
            42,
            42,
            event,
            { at: 1, attribution, proc: { count: 4 } }
          );
      }
    }
  });
  const applications = result.resolvedEvents.filter((event) => event.traitId === 42);
  assert.equal(countProcActivations(applications, () => 'trait').get('trait'), 8);
  assert.equal(new Set(applications.map((event) => event.procActivation?.id)).size, 2);
  assert.ok(applications.every((event) => event.procActivation.count === 4));
  const first = applications[0];
  assert.equal(countProcActivations([first, { ...first, cancelled: true }], () => 'trait').get('trait'), 4);
});

// Distinct deliveries can share a logical activation only through a token issued by their own emitter.
test('explicit activation tokens join emissions and reject forged or foreign identities', () => {
  const { effects, events } = captureEffectEmissions();
  const proc = effects.createProcActivation(2);
  assert.ok(Object.isFrozen(proc));
  effects.emit({ kind: 'packet', proc, event: strike });
  effects.emit({
    kind: 'profile',
    proc,
    attribution,
    profile: {
      id: 42,
      name: 'Fixture',
      effects: [{ type: 'condition', condition: 'Weakness', stacks: 1, duration: 2 }]
    }
  });
  assert.equal(countProcActivations(events, () => 'trait').get('trait'), 2);
  assert.ok(events.every((event) => event.procActivation.id === proc.id));
  const foreign = captureEffectEmissions().effects.createProcActivation();
  for (const invalid of [{ ...proc }, foreign, { id: 'authored', count: 1 }])
    assert.throws(
      () => effects.emit({ kind: 'packet', proc: invalid, event: strike }),
      /created by this emission service/
    );
  for (const count of [0, -1, NaN, Infinity])
    assert.throws(() => effects.createProcActivation(count), /positive finite count/);
  assert.equal(events.length, 2);
});

test('ordinary cast emissions cannot inherit a proc identity from a copied packet', () => {
  const { effects, events } = captureEffectEmissions();
  effects.emit({ kind: 'packet', proc: true, event: strike });
  effects.emit({ kind: 'packet', event: events[0] });
  effects.emit({ kind: 'packet', proc: true, event: events[0] });
  assert.ok(events[0].procActivation);
  assert.equal(events[1].procActivation, undefined);
  assert.notEqual(events[2].procActivation.id, events[0].procActivation.id);
  assert.equal(countProcActivations(events, () => 'trait').get('trait'), 2);
});

test('proc weights require the emission option and metadata cannot author proc identity', () => {
  const { effects, events } = captureEffectEmissions();
  for (const proc of [false, null, {}, { count: 0 }, { count: -1 }, { count: NaN }, { count: Infinity }])
    assert.throws(() => effects.emit({ kind: 'packet', event: strike, proc }), /positive finite count/);

  // Both catalog authoring and procedural packets reject the retired metadata fields.
  for (const metadata of [{ procCount: 2 }, { procActivation: 'authored' }]) {
    assert.throws(() => effects.emit({ kind: 'packet', event: { ...strike, metadata } }), /unsupported field/);
    assert.throws(
      () =>
        createCanonicalCatalog({
          skills: [{ id: 42, name: 'Fixture', effects: [{ type: 'strike', coefficient: 1, metadata }] }]
        }),
      /unsupported field/
    );
  }

  assert.equal(events.length, 0);
});

test('boon and buff rewards share one trait activation even without damage', () => {
  const { effects, events } = captureEffectEmissions();
  const helpers = createCanonicalCatalog({
    balanceProfiles: [
      {
        id: 42,
        name: 'Support trait',
        effects: [
          { type: 'boon', name: 'Fury', boon: 'fury', duration: 2, stacks: 1 },
          { type: 'buff', name: 'Reward', kind: 'fixture-reward', duration: 2, stacks: 1 }
        ]
      }
    ]
  });
  emitTraitProfile({ effects, helpers }, 42, 42, undefined);
  assert.ok(events.length > 0);
  assert.ok(events.every((event) => event.procActivation.count === 1));
  assert.equal(countProcActivations(events, () => 'support').get('support'), 1);
});

// An explicit undefined activation opts out of inheritance; an omitted activation still derives from its cause.
test('authored activation fields retain precedence over effect delivery causes', () => {
  const receipts = [];
  resolveTestGw2Events({
    events: [{ ...strike, activationId: 'trigger-activation' }],
    endTime: 1,
    professionReactions: {
      'damage.resolved'(runtime, event) {
        if (event.sourceId !== 42) return;

        for (const identity of [{}, { activationId: undefined }, { activationId: 'authored-activation' }])
          receipts.push(
            runtime.effects.emit({
              kind: 'packet',
              receipt: true,
              cause: event,
              event: { ...strike, sourceId: 'derived', actorType: 'effect', ...identity }
            })
          );
      }
    }
  });
  assert.match(receipts[0].activationId, /^effect:derived:/);
  assert.equal(receipts[1].activationId, undefined);
  assert.equal(receipts[2].activationId, 'authored-activation');
  assert.ok(receipts.every((event) => event.parentEventOrder != null));
});

// Reporting consumes no combat identity, including announcements scheduled before later combat packets.
test('announcements preserve combat order and sampled damage in detailed and score output', () => {
  const run = (announcements, output = 'detailed') => {
    const references = [];
    const profession = defineTestProfession({
      id: 'emission-fixture',
      name: 'Emission fixture',
      hooks: {
        initialize(runtime) {
          if (announcements)
            for (const at of [0, 0.5, 1])
              runtime.effects.emit({
                kind: 'announcement',
                log: true,
                attribution,
                announcement: { type: 'trait', name: 'Fixture trait', at }
              });

          for (const at of [1, 2])
            references.push(runtime.effects.emit({ receipt: true, kind: 'packet', event: { ...strike, at } }));
        }
      }
    });
    const result = simulateGw2({
      profession,
      output,
      rotation: [{ type: 'wait', durationMs: 2100 }],
      config: { randomness: { mode: 'stochastic', seed: 17 } }
    });
    return { result, references };
  };

  const baseline = run(false),
    detailed = run(true),
    score = run(true, 'score');
  assert.equal(detailed.result.totalDamage, baseline.result.totalDamage);
  assert.equal(score.result.totalDamage, baseline.result.totalDamage);
  assert.deepEqual(detailed.references, baseline.references);
  assert.deepEqual(score.references, baseline.references);
  assert.equal(detailed.result.events.filter((e) => e.type === 'proc').length, 3);
  assert.ok(detailed.references.every(Object.isFrozen));
});

// Profiles and computed packets share duration, identity, and queue ordering rather than separate execution paths.
test('profile and computed grants use one submission contract', () => {
  const references = [];
  const profession = defineTestProfession({
    id: 'profile-fixture',
    name: 'Profile fixture',
    hooks: {
      initialize(runtime) {
        references.push(
          ...runtime.effects.emit({
            receipt: true,
            kind: 'profile',
            at: 1,
            profile: { id: 42, name: 'Fixture', effects: [{ type: 'boon', boon: 'fury', duration: 4, stacks: 1 }] },
            attribution
          })
        );
        references.push(
          runtime.effects.emit({
            receipt: true,
            kind: 'packet',
            event: { ...attribution, type: 'buff', at: 1, kind: 'fury', duration: 4, stacks: 1 }
          })
        );
      }
    }
  });
  const result = simulateGw2({
    profession,
    rotation: [{ type: 'wait', durationMs: 1100 }],
    config: { attributeInputs: baseAttributeInputs({ concentration: 750 }) }
  });
  const grants = result.events.filter((e) => e.type === 'buff');
  assert.deepEqual(
    grants.map((e) => [e.eventOrder, e.duration, e.sourceId]),
    references.map((e) => [e.eventOrder, 6, 42])
  );
  assert.deepEqual(
    references.map((e) => e.duration),
    [4, 4]
  );
});

// A settled condition is visible to its caller, while queued reactions remain pending until their heap turn.
test('reaction settlement preserves nested condition visibility', () => {
  const trace = [];
  resolveTestGw2Events({
    events: [{ ...strike, at: 0 }],
    endTime: 1,
    professionReactions: {
      'damage.resolved'(runtime, event) {
        runtime.effects.emit({
          kind: 'packet',
          cause: event,
          settlement: 'reaction',
          event: { ...attribution, type: 'condition', at: 0, condition: 'Poisoned', duration: 2, stacks: 1 }
        });
        assert.equal(runtime.combat.targetHasCondition('Poisoned', 0, runtime), true);
        assert.equal(runtime.combat.targetHasCondition('Weakness', 0, runtime), false);
        trace.push('caller');
        assert.throws(
          () => runtime.effects.emit({ kind: 'packet', settlement: 'reaction', event: { ...strike, at: 0 } }),
          /Reaction settlement/
        );
      },
      'condition.applied'(runtime, event) {
        trace.push(event.condition);

        if (event.condition === 'Poisoned')
          runtime.effects.emit({
            kind: 'packet',
            cause: event,
            event: { ...attribution, type: 'condition', at: 0, condition: 'Weakness', duration: 2, stacks: 1 }
          });
      }
    }
  });
  assert.deepEqual(trace, ['Poisoned', 'caller', 'Weakness']);
});

// Owned current-time announcements remain pending just like their grants, and keep the cast as attribution only.
test('same-time owner cancellation removes visible announcements and their grants', () => {
  let announcement;
  const profession = defineTestProfession({
    id: 'owned-announcement',
    name: 'Owned announcement',
    hooks: {
      initialize(runtime) {
        const owner = { id: 'trait-owner', generation: 0 };
        const cast = { activationId: 'cast-fixture', skillId: 42 };
        announcement = runtime.effects.emit({
          receipt: true,
          kind: 'announcement',
          log: true,
          owner,
          cast,
          attribution,
          announcement: { type: 'trait', name: 'Cancelled activation', at: runtime.time }
        });
        runtime.effects.emit({
          kind: 'packet',
          owner,
          cast,
          event: { ...attribution, type: 'buff', at: runtime.time, kind: 'might', stacks: 1, duration: 1 }
        });
        runtime.cancelOwner(owner);
      }
    }
  });
  const result = simulateGw2({ profession, rotation: [{ type: 'wait', durationMs: 100 }] });
  assert.equal(announcement.activationId, 'cast-fixture');
  assert.equal(
    result.events.some((event) => event.sourceId === 42),
    false
  );
  assert.equal(
    result.procSteps.some((proc) => proc.skill === 'Cancelled activation'),
    false
  );
});

// Caller-owned nested objects and read-only receipts must not retain mutable aliases into the heap.
test('queued effects snapshot nested payloads and return deeply frozen receipts', () => {
  let receipt;
  const input = {
    ...attribution,
    type: 'buff',
    at: 1,
    kind: 'fury',
    duration: 3,
    stacks: 1,
    audience: { recipients: 'party', maximumRecipients: 2 }
  };
  const profession = defineTestProfession({
    id: 'receipt-fixture',
    name: 'Receipt fixture',
    hooks: {
      initialize(runtime) {
        receipt = runtime.effects.emit({ receipt: true, kind: 'packet', event: input });
        input.audience.maximumRecipients = 5;
        assert.ok(Object.isFrozen(receipt.audience));
        assert.throws(() => {
          receipt.audience.maximumRecipients = 4;
        }, TypeError);
      }
    }
  });
  const result = simulateGw2({
    profession,
    rotation: [{ type: 'wait', durationMs: 1100 }],
    config: { allies: { count: 4, strikesPerSecond: 0 } }
  });
  assert.equal(result.events.find((event) => event.type === 'buff').resolvedAudience.recipientCount, 2);
  assert.equal(receipt.audience.maximumRecipients, 2);
});

// Expanding a trait profile inside a hit must settle each condition before the following listener queries it.
test('reaction profile applications are visible before the emitting listener resumes', () => {
  const trace = [];
  resolveTestGw2Events({
    events: [{ ...strike, at: 0 }],
    endTime: 1,
    professionReactions: {
      'damage.resolved'(runtime, cause) {
        runtime.effects.emit({
          kind: 'profile',
          cause,
          settlement: 'reaction',
          profile: {
            id: 42,
            name: 'Settled profile',
            effects: [
              { type: 'condition', condition: 'Poisoned', stacks: 1, duration: 2 },
              { type: 'condition', condition: 'Weakness', stacks: 1, duration: 2 }
            ]
          },
          attribution
        });
        assert.equal(runtime.combat.targetHasCondition('Poisoned', 0, runtime), true);
        assert.equal(runtime.combat.targetHasCondition('Weakness', 0, runtime), true);
        trace.push('caller');
      },
      'condition.applied'(_runtime, event) {
        trace.push(event.condition);
      }
    }
  });
  assert.deepEqual(trace, ['Poisoned', 'Weakness', 'caller']);
});

// Admission order establishes causality before queue priorities resolve simultaneous packets.
test('application-ordered profiles submit each sibling before the next application', () => {
  for (const includeCondition of [true, false]) {
    const trace = [];
    const cause = { ...attribution, type: 'action', at: 0, activationId: 'paired-cast', eventOrder: 17 };
    const service = createEffectEmissionService({
      collectBoonLineage: false,
      castStartedAt: () => undefined,
      expansionBudget: createEffectExpansionBudget(),
      now: () => 0,
      registerReaction: () => undefined,
      announce: () => assert.fail('unexpected announcement'),
      submit(event, delivery) {
        assert.equal(delivery.cause.activationId, cause.activationId);
        assert.equal(delivery.cause.eventOrder, cause.eventOrder);
        trace.push(event.type);
        return event;
      }
    });
    service.emit({
      kind: 'profile',
      order: 'application',
      cause,
      profile: {
        id: 42,
        name: 'Pair',
        effects: [
          { type: 'strike', coefficient: 1, applications: 2 },
          ...(includeCondition ? [{ type: 'condition', condition: 'Vulnerability', stacks: 1, duration: 2 }] : [])
        ]
      },
      attribution
    });
    assert.deepEqual(trace, includeCondition ? ['damage', 'condition', 'damage'] : ['damage', 'damage']);
  }
});

// A named trait payload retains cast identity and effect-specific ownership in the immutable submitted receipt.
test('trait profile selection validates named effects and preserves cast attribution in receipts', () => {
  const submitted = [];
  const profile = {
    id: 42,
    name: 'Fixture trait',
    effects: [
      { type: 'boon', name: 'Selected boon', boon: 'fury', duration: 2, stacks: 1, actorType: 'player' },
      { type: 'boon', name: 'Other boon', boon: 'might', duration: 2, stacks: 1, actorType: 'effect' }
    ]
  };
  const runtime = {
    helpers: createCanonicalCatalog({ balanceProfiles: [profile] }),
    effects: createEffectEmissionService({
      collectBoonLineage: false,
      castStartedAt: () => undefined,
      expansionBudget: createEffectExpansionBudget(),
      now: () => 2,
      registerReaction: () => undefined,
      submit(event, delivery) {
        submitted.push({ event, delivery });
        return event;
      },
      announce() {
        throw new Error('No announcement expected');
      }
    })
  };
  const packets = emitTraitProfile(runtime, 42, 42, null, {
    receipt: true,
    cast: { activationId: 'cast:fixture' },
    effect: { type: 'boon', name: 'Selected boon' },
    preserveName: true,
    attribution: (effect) => ({ actorType: effect.actorType, skillId: 42, skillName: profile.name, name: effect.name })
  });
  assert.equal(packets.length, 1);
  assert.equal(packets[0].kind, 'fury');
  assert.equal(packets[0].name, 'Selected boon');
  assert.equal(packets[0].actorType, 'player');
  assert.equal(packets[0].activationId, 'cast:fixture');
  assert.equal(submitted[0].delivery.cast.activationId, 'cast:fixture');
  assert.equal(submitted[0].delivery.cause, null);
  assert.ok(Object.isFrozen(packets));
  assert.ok(Object.isFrozen(packets[0]));
  assert.throws(
    () => emitTraitProfile(runtime, 42, 42, undefined, { effect: { type: 'boon', name: 'Misspelled boon' } }),
    /unknown effect key/
  );
  assert.equal(submitted.length, 1);
});

// Cancelling a mechanic removes its pending trait payload without cancelling independently granted effects.
test('trait profiles retain mechanic cancellation ownership independently of cast identity', () => {
  const helpers = createCanonicalCatalog({
    balanceProfiles: [
      {
        id: 42,
        name: 'Owned trait',
        effects: [{ type: 'boon', boon: 'might', duration: 2, stacks: 1 }]
      }
    ]
  });
  const receipts = [];
  const profession = defineTestProfession({
    id: 'owned-trait-profile',
    name: 'Owned trait profile',
    hooks: {
      initialize(runtime) {
        const owner = { id: 'trait-work', generation: 0 };
        const context = { effects: runtime.effects, helpers };
        const cast = { activationId: 'shared-cast', skillId: 42 };
        receipts.push(...emitTraitProfile(context, 42, 42, undefined, { receipt: true, at: 1, cast, owner }));
        receipts.push(...emitTraitProfile(context, 42, 42, undefined, { receipt: true, at: 1, cast }));
        runtime.cancelOwner(owner);
      }
    }
  });
  const result = simulateGw2({ profession, rotation: [{ type: 'wait', durationMs: 1100 }] });
  const grants = result.events.filter((event) => event.type === 'buff' && event.sourceId === 42);
  assert.equal(receipts.length, 2);
  assert.equal(grants.length, 1);
  assert.equal(grants[0].eventOrder, receipts[1].eventOrder);
  assert.equal(grants[0].activationId, 'shared-cast');
});
