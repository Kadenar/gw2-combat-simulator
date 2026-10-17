import { createEffectExpansionBudget } from '#gw2/platform/effects/expansion-budget.js';
import { captureEffectEmissions } from '#tests/helpers/effect-emission.js';
import assert from 'node:assert/strict';
import test from 'node:test';

import { StableEventQueue } from '#kernel/events/queue.js';
import { createGw2CombatQuery } from '#gw2/platform/combat-calculation/combat-query.js';
import { createGw2ConditionResolution } from '#gw2/platform/resolver/condition-resolution.js';
import { createGw2EquipmentReactionContributions } from '#gw2/platform/resolver/equipment-reactions.js';
import { createGw2ResolverReactionRegistry, GW2_RESOLVER_STAGES } from '#gw2/platform/resolver/reaction-registry.js';
import { composeRuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { createGw2ResolverRuntimeState } from '#gw2/platform/resolver/runtime-state.js';
import { testProfession } from '#tests/fixtures/profession.js';
import { resolveTestGw2Events } from '#tests/helpers/gw2-resolver.js';

test('GW2 resolver registry orders notifications stably and discards their results', () => {
  const calls = [];
  const professionReactions = {
    'damage.resolved': () => {
      calls.push('profession');

      return { owner: 'profession' };
    }
  };
  const registry = createGw2ResolverReactionRegistry({
    professionReactions,
    contributions: {
      'damage.resolved': [
        {
          id: 'common.early',
          order: -100,
          handler: () => calls.push('early')
        },
        {
          id: 'common.tie-a',
          order: 100,
          handler: () => calls.push('tie-a')
        },
        {
          id: 'common.tie-b',
          order: 100,
          handler: () => {
            calls.push('tie-b');

            return { owner: 'last' };
          }
        }
      ]
    }
  });

  assert.equal(registry.dispatch('damage.resolved', {}, { type: 'damage', at: 0 }), undefined);
  assert.deepEqual(calls, ['early', 'profession', 'tie-a', 'tie-b']);
  assert.equal(
    registry.dispatch(
      'condition.applied',
      {},
      { type: 'condition', condition: 'Blindness', stacks: 1, duration: 3, at: 0 }
    ),
    undefined
  );
});

// Transform semantics do not depend on whether contributors belong to a module, nested module, or registry.
test('pre-hit patches propagate across module and registry boundaries without mutating the input', () => {
  const first = () => ({ coefficient: 2, forceCrit: true });
  const observe = (_context, event) => {
    assert.equal(event.coefficient, 2);
  };

  const last = (_context, event) => ({ coefficient: event.coefficient * 3 });
  const module = (...handlers) =>
    composeRuntimeHooks(handlers.map((handler) => ({ reactions: { 'damage.resolving': handler } })));
  const contributions = (handlers) => ({
    'damage.resolving': handlers.map((handler, order) => ({ id: String(order), order, handler }))
  });
  const nested = composeRuntimeHooks([module(first), module(observe, last)]);
  const registries = [
    createGw2ResolverReactionRegistry({ professionReactions: module(first, observe, last).reactions }),
    createGw2ResolverReactionRegistry({ professionReactions: nested.reactions }),
    createGw2ResolverReactionRegistry({ contributions: contributions([first, observe, last]) }),
    createGw2ResolverReactionRegistry({
      professionReactions: module(observe, last).reactions,
      contributions: { 'damage.resolving': [{ id: 'early', order: -1, handler: first }] }
    })
  ];
  const event = Object.freeze({ type: 'damage', at: 0, coefficient: 1 });
  for (const registry of registries)
    assert.deepEqual(registry.dispatch('damage.resolving', {}, event), { coefficient: 6, forceCrit: true });
  assert.equal(event.coefficient, 1);
});

// Returned notification objects never change what later listeners observe, even in nested composition.
test('every notification stage preserves the original event and returns nothing', () => {
  const event = Object.freeze({ type: 'damage', at: 0, coefficient: 1 });
  for (const stage of GW2_RESOLVER_STAGES.filter((stage) => stage !== 'damage.resolving')) {
    let calls = 0;
    const first = { reactions: { [stage]: () => ({ coefficient: 99 }) } };
    const next = {
      reactions: {
        [stage]: (_context, actual) => {
          calls++;
          assert.equal(actual, event);
          return { coefficient: 100 };
        }
      }
    };
    const single = composeRuntimeHooks([first]);
    const nested = composeRuntimeHooks([single, composeRuntimeHooks([next])]);
    assert.equal(single.reactions[stage]({}, event, {}), undefined);
    assert.equal(nested.reactions[stage]({}, event, {}), undefined);
    const registry = createGw2ResolverReactionRegistry({ professionReactions: nested.reactions });
    assert.equal(registry.dispatch(stage, {}, event), undefined);
    assert.equal(calls, 2);
  }
});

// Generic buffs share the stage with boons but must not activate relic boon rules.
test('relic boon reactions accept standard boons and ignore generic buffs', () => {
  const seen = [];
  const reactions = createGw2ResolverReactionRegistry({ contributions: createGw2EquipmentReactionContributions() });
  const context = { relic: { state: {}, rules: { boon: (_ctx, _state, event) => seen.push(event) } } };
  const boon = { type: 'buff', at: 0, kind: 'might' };
  const legacyBoon = { type: 'buff', at: 0, boon: 'fury' };
  reactions.dispatch('buff.applied', context, { type: 'buff', at: 0, kind: 'generic-buff' });
  reactions.dispatch('buff.applied', context, boon);
  reactions.dispatch('buff.applied', context, legacyBoon);
  assert.deepEqual(seen, [boon, legacyBoon]);
});

test('GW2 resolver registry rejects unknown stages and duplicate hook ids', () => {
  assert.throws(
    () => createGw2ResolverReactionRegistry({ professionReactions: { damage: () => {} } }),
    /unknown stage: damage/
  );
  assert.throws(
    () =>
      createGw2ResolverReactionRegistry({
        contributions: {
          'buff.applied': [
            { id: 'same', order: 0, handler: () => {} },
            { id: 'same', order: 1, handler: () => {} }
          ]
        }
      }),
    /Duplicate reaction buff\.applied hook id: same/
  );
});

test('condition stage runs once per stack after insertion, including profession and relic recursion', () => {
  const trace = [];
  const professionReactions = {
    'condition.applied': (context, application, details) => {
      assert.equal(details.applyCondition, undefined);
      // Reactions observe the application through canonical state before producing nested conditions.
      assert.ok(
        context.conditionState.get(application.condition).stacks.some((stack) => stack.application === application)
      );
      trace.push({
        condition: application.condition,
        queued: context.queue.length,
        active: details.activeConditionStackCount(context, application.condition, application.at)
      });

      // Profession reactions use the runtime capability directly; no resolver
      // callback needs to be threaded through reaction details.
      if (application.sourceId === 'fixture.bleed') {
        conditions.applyCondition(context, {
          type: 'condition',
          at: application.at,
          source: 'Fixture reaction',
          sourceId: 'fixture.reaction-weakness',
          condition: 'Weakness',
          duration: 1,
          stacks: 1
        });
      }
    }
  };
  const reactions = createGw2ResolverReactionRegistry({
    professionReactions,
    contributions: createGw2EquipmentReactionContributions()
  });
  const conditions = createGw2ConditionResolution({
    expansionBudget: createEffectExpansionBudget(),
    reactions: reactions,
    config: { target: { conditions: { Bleeding: 1 } } }
  });
  const queue = new StableEventQueue();
  const context = createGw2ResolverRuntimeState({
    config: {
      relic: 'Fractal',
      target: { conditions: { Bleeding: 1 } }
    },
    traits: new Set(),
    horizon: 10,
    query: {
      ...createGw2CombatQuery({ profession: testProfession }),
      statsAt: () => ({
        power: 1000,
        precision: 1000,
        toughness: 1000,
        vitality: 1000,
        ferocity: 0,
        conditionDamage: 0,
        expertise: 0,
        concentration: 0,
        healingPower: 0
      }),
      conditionDurationMultiplier: () => 1
    },
    helpers: { conditionName: (value) => String(value) },
    queue,
    effects: captureEffectEmissions({ submit: (event) => conditions.applyCondition(context, event) }).effects
  });

  assert.equal(typeof context.effects.emit, 'function');
  assert.deepEqual(
    conditions.applyCondition(context, {
      type: 'condition',
      at: 0,
      source: 'Fixture',
      condition: 'Bleeding',
      duration: 0,
      stacks: 6
    }),
    []
  );
  assert.deepEqual(trace, []);

  const [application] = conditions.applyCondition(context, {
    type: 'condition',
    at: 0,
    source: 'Fixture',
    sourceId: 'fixture.bleed',
    skillName: 'Fixture Bleed',
    condition: 'Bleeding',
    duration: 2,
    stacks: 5
  });

  assert.equal(application.condition, 'Bleeding');
  assert.deepEqual(
    trace.map((entry) => entry.condition),
    Array.from({ length: 5 }, () => ['Bleeding', 'Weakness']).flat()
  );
  assert.deepEqual(
    trace.map((entry) => entry.active),
    [2, 1, 3, 1, 4, 1, 5, 1, 6, 1]
  );

  conditions.applyCondition(context, {
    type: 'condition',
    at: 0.1,
    source: 'Fixture',
    sourceId: 'fixture.trigger-bleed',
    skillName: 'Trigger Bleed',
    condition: 'Bleeding',
    duration: 2,
    stacks: 1
  });

  assert.deepEqual(
    trace.map((entry) => entry.condition),
    [
      ...Array.from({ length: 5 }, () => ['Bleeding', 'Weakness']).flat(),
      'Bleeding',
      'Burning',
      'Burning',
      'Torment',
      'Torment',
      'Torment'
    ]
  );
  assert.deepEqual(
    trace.map((entry) => entry.active),
    [2, 1, 3, 1, 4, 1, 5, 1, 6, 1, 7, 1, 2, 1, 2, 3]
  );
  assert.ok(trace.every((entry) => entry.queued > 0));
});

test('resolver duration queries use accepted relic state and preserve causal ordering', () => {
  const config = { relic: 'Aristocracy' };
  const events = [1, 1, 1.001].map((at) => ({
    type: 'condition',
    at,
    source: 'Fixture',
    sourceId: 'fixture.bleed',
    actorType: 'player',
    condition: 'Bleeding',
    duration: 1,
    stacks: 1
  }));
  events.splice(1, 0, {
    type: 'condition',
    condition: 'Vulnerability',
    stacks: 1,
    duration: 5,
    at: 1,
    source: 'Fixture',
    sourceId: 'fixture.trigger',
    actorType: 'player'
  });
  const durations = [];
  const liveBonuses = [];
  resolveTestGw2Events({
    config,
    ...{ events, endTime: 3 },
    professionReactions: {
      'condition.applied': (context, application) => {
        if (application.condition !== 'Bleeding') return;

        durations.push(application.effectiveDuration);
        // Live state must exclude the queued trigger until its handler has run.
        liveBonuses.push(
          context.combat.conditionDurationMultiplier(
            'Bleeding',
            1.001,
            context.combat.statsAt(1.001, application),
            application
          )
        );
      }
    }
  });
  assert.deepEqual(durations, [1, 1, 1.03]);
  assert.deepEqual(liveBonuses, [1, 1.03, 1.03]);
});
