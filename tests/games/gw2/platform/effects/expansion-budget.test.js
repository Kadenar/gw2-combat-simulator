import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createEffectExpansionBudget,
  effectApplicationCount,
  MAX_EFFECT_EXPANSION
} from '#gw2/platform/effects/expansion-budget.js';
import { createEffectEmissionService } from '#gw2/platform/effects/emission.js';
import { materializeSkillEffectApplications } from '#gw2/platform/effects/materializer.js';
import { normalizeSkillEffects } from '#gw2/platform/effects/validation.js';
import { createGw2ConditionResolution } from '#gw2/platform/resolver/condition-resolution.js';
import { createGw2ResolverRuntimeState } from '#gw2/platform/resolver/runtime-state.js';
import { createGw2CombatQuery } from '#gw2/platform/combat-calculation/combat-query.js';
import { StableEventQueue } from '#kernel/events/queue.js';
import { testProfession } from '#tests/fixtures/profession.js';
import { resolveTestGw2Events } from '#tests/helpers/gw2-resolver.js';

const attribution = { source: 'Expansion probe', sourceId: 42, actorType: 'player' };
const strike = (hits) => ({ type: 'strike', coefficient: 6, hits, atMs: 0 });
const repeated = (applications) => ({
  type: 'boon',
  boon: 'might',
  stacks: 1,
  duration: 1,
  applications,
  intervalMs: 1
});

// Count boundaries are checked without allocating the accepted maximum or any rejected packet batch.
test('authored repetition requires bounded safe integers', () => {
  for (const effect of [strike, repeated]) {
    for (const count of [0, -1, 1.5, MAX_EFFECT_EXPANSION + 1, Number.MAX_SAFE_INTEGER, 1e20]) {
      assert.throws(
        () => normalizeSkillEffects([effect(count)], 'budget fixture'),
        /budget fixture.*positive safe integer/
      );
    }

    const [normalized] = normalizeSkillEffects([effect(MAX_EFFECT_EXPANSION)], 'budget fixture');
    assert.equal(effectApplicationCount(normalized, 'budget fixture'), MAX_EFFECT_EXPANSION);
  }
});

// Length guards must run before reading even the first oversized tick or effect entry.
test('oversized explicit arrays are rejected before traversal', () => {
  const oversized = new Array(MAX_EFFECT_EXPANSION + 1);
  Object.defineProperty(oversized, 0, {
    get() {
      throw new Error('oversized array was traversed');
    }
  });
  assert.throws(() => normalizeSkillEffects(oversized, 'budget fixture'), /expansion limit/);
  for (const type of ['strike', 'condition']) {
    assert.throws(
      () => normalizeSkillEffects([{ type, ticks: oversized }], 'budget fixture'),
      /ticks.*positive safe integer/
    );
    assert.throws(
      () =>
        materializeSkillEffectApplications({
          skill: { id: 42, name: 'Budget fixture' },
          effect: { type, ticks: oversized },
          start: 0,
          fullEnd: 0,
          baseEvent: attribution
        }),
      /Budget fixture.*positive safe integer/
    );
  }
});

// Reusing individually bounded tick arrays cannot multiply the allocation ceiling across one effect list.
test('catalog preflight rejects excessive combined expansion before copying any tick', () => {
  const ticks = new Array(MAX_EFFECT_EXPANSION / 2 + 1);
  Object.defineProperty(ticks, 0, {
    get() {
      throw new Error('tick normalization started');
    }
  });
  assert.throws(
    () =>
      normalizeSkillEffects(
        [
          { type: 'strike', ticks },
          { type: 'strike', ticks }
        ],
        'combined fixture'
      ),
    /combined fixture requires a positive safe integer count/
  );
});

// Authored condition stacks retain fractional weights while both aggregate and explicit forms reject unsafe expansion.
test('condition authoring bounds stack records without requiring integral weights', () => {
  const application = { condition: 'Bleeding', stacks: 1.5, duration: 1 };
  for (const stacks of [1.5, MAX_EFFECT_EXPANSION, MAX_EFFECT_EXPANSION + 0.1, 1e20]) {
    for (const effect of [
      { type: 'condition', ...application, stacks },
      { type: 'condition', ticks: [{ ...application, stacks, atMs: 0 }] }
    ]) {
      if (stacks > MAX_EFFECT_EXPANSION)
        assert.throws(() => normalizeSkillEffects([effect], 'condition fixture'), /stacks.*positive safe integer/);
      else assert.equal(normalizeSkillEffects([effect], 'condition fixture').length, 1);
    }
  }
});

// Direct materializer consumers receive the same bounds even when no catalog normalization precedes the call.
test('standalone materialization rejects excessive counts before constructing packets', () => {
  const baseEvent = {
    get source() {
      throw new Error('packet construction started');
    }
  };
  for (const effect of [
    strike(1e20),
    repeated(MAX_EFFECT_EXPANSION + 1),
    { type: 'condition', condition: 'Bleeding', duration: 1, stacks: 1e20 }
  ]) {
    assert.throws(
      () =>
        materializeSkillEffectApplications({
          skill: { id: 42, name: 'Budget fixture' },
          effect,
          start: 0,
          fullEnd: 0,
          baseEvent
        }),
      /Budget fixture.*positive safe integer/
    );
  }
});

// Reserving a rejected batch does not consume capacity; each simulation owns its own independent counter.
test('expansion reservations are atomic and cumulative', () => {
  const budget = createEffectExpansionBudget(4);
  budget.reserve(3, 'first effect');
  assert.throws(() => budget.reserve(2, 'second effect'), /second effect.*requested 2, remaining 1/);
  budget.reserve(1, 'last effect');
  assert.throws(() => budget.reserve(1, 'exhausted'), /remaining 0/);
  for (const count of [-1, 0.5, Infinity, 1e20]) assert.throws(() => budget.reserve(count, 'invalid'), RangeError);
  createEffectExpansionBudget(4).reserve(4, 'separate simulation');
});

// A multi-effect profile is preflighted as one batch before callbacks can produce state or packets.
test('profile budget rejection precedes attribution, registration, transforms and submission', () => {
  const effects = createEffectEmissionService({
    expansionBudget: createEffectExpansionBudget(3),
    now: () => 0,
    registerReaction() {
      assert.fail('reaction registered');
    },
    submit() {
      assert.fail('packet submitted');
    },
    announce() {
      assert.fail('announcement submitted');
    }
  });
  assert.throws(
    () =>
      effects.emit({
        kind: 'profile',
        profile: { id: 42, name: 'Budget fixture', effects: [strike(2), strike(2)] },
        attribution() {
          assert.fail('attribution read');
        },
        transform() {
          assert.fail('transform called');
        }
      }),
    /Budget fixture.*requested 4, remaining 3/
  );
});

// Profile packets are charged once, including discarded transforms; scalar packets and announcements share the counter.
test('emission counts each packet once and preserves coefficient splitting and attribution', () => {
  const submitted = [];
  const budget = createEffectExpansionBudget(5);
  const effects = createEffectEmissionService({
    expansionBudget: budget,
    now: () => 0,
    registerReaction: () => undefined,
    submit(event) {
      submitted.push(event);
      return event;
    },
    announce(request) {
      return { ...attribution, type: 'proc', ...request.announcement };
    }
  });
  const profile = { id: 42, name: 'Budget fixture', effects: [strike(2)] };
  effects.emit({ kind: 'profile', profile, attribution });
  assert.deepEqual(
    submitted.map((event) => [event.coefficient, event.sourceId, event.hitIndex, event.totalHits]),
    [
      [3, 42, 1, 2],
      [3, 42, 2, 2]
    ]
  );
  effects.emit({ kind: 'profile', profile: { ...profile, effects: [strike(1)] }, attribution, transform: () => null });
  effects.emit({ kind: 'packet', event: { ...attribution, type: 'marker', at: 0 } });
  effects.emit({ kind: 'announcement', announcement: { type: 'trait', name: 'Probe', at: 0 } });
  assert.equal(submitted.length, 3);
  assert.throws(
    () => effects.emit({ kind: 'packet', event: { ...attribution, type: 'marker', at: 0 } }),
    /remaining 0/
  );
  assert.equal(submitted.length, 3);
});

// A condition application reserves all of its stack records before reactions or state insertion, including fractional weight.
test('conditions share the packet budget and reject a whole stack batch without partial application', () => {
  const budget = createEffectExpansionBudget(5);
  const reactions = [];
  const conditions = createGw2ConditionResolution({
    expansionBudget: budget,
    reactions: {
      dispatch(stage) {
        reactions.push(stage);
      }
    }
  });
  const runtime = createGw2ResolverRuntimeState({
    config: {},
    horizon: 2,
    helpers: { conditionName: (name) => name },
    queue: new StableEventQueue(),
    query: createGw2CombatQuery({ profession: testProfession })
  });
  const effects = createEffectEmissionService({
    expansionBudget: budget,
    now: () => 0,
    registerReaction: () => undefined,
    submit(event) {
      conditions.applyCondition(runtime, event);
      return event;
    },
    announce() {
      assert.fail();
    }
  });
  const event = { ...attribution, type: 'condition', at: 0, condition: 'Bleeding', duration: 1, stacks: 1.5 };
  effects.emit({ kind: 'packet', event });
  assert.deepEqual(
    runtime.conditionState.get('Bleeding').stacks.map((stack) => stack.weight),
    [1, 0.5]
  );
  const beforeReactions = reactions.length;
  const beforeQueue = runtime.queue.length;
  assert.throws(
    () => effects.emit({ kind: 'packet', event }),
    /condition=Bleeding source=42.*requested 2, remaining 1/
  );
  assert.equal(runtime.conditionState.get('Bleeding').stacks.length, 2);
  assert.equal(reactions.length, beforeReactions);
  assert.equal(runtime.queue.length, beforeQueue);
});

// Public runtime ingress cannot bypass the per-stack bound through computed packets in either output mode.
test('runtime rejects enormous computed condition applications before recording stack state', () => {
  for (const output of ['detailed', 'score']) {
    let runtime;
    let applied = 0;
    assert.throws(
      () =>
        resolveTestGw2Events({
          output,
          endTime: 1,
          engineInitialize(owner) {
            runtime = owner;
          },
          professionReactions: {
            'condition.applied'() {
              applied++;
            }
          },
          events: [{ ...attribution, type: 'condition', at: 0, condition: 'Bleeding', duration: 1, stacks: 1e20 }]
        }),
      /expansion budget.*condition=Bleeding source=42/
    );
    assert.equal(runtime.conditionState.size, 0);
    assert.equal(applied, 0);
  }
});
