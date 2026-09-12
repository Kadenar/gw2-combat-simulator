import assert from 'node:assert/strict';
import test from 'node:test';

import { StableEventQueue } from '#kernel/events/queue.js';
import { createGw2CombatQuery } from '#gw2/platform/combat/query/combat-query.js';
import { buildScheduledEventStream } from '#gw2/platform/engine/events/scheduled-stream.js';
import { createGw2ConditionResolution } from '#gw2/platform/resolver/condition-resolution.js';
import { createGw2ResolverExtensions } from '#gw2/platform/resolver/extensions.js';
import { createGw2ResolverReactionRegistry } from '#gw2/platform/resolver/reaction-registry.js';
import { createGw2ResolverRuntimeState } from '#gw2/platform/resolver/runtime-state.js';
import { testProfession } from '../../fixtures/test-profession.js';
import { resolveTestGw2Stream } from '../../helpers/gw2-resolver.js';

test('GW2 resolver registry orders hooks stably and returns the last result', () => {
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

  assert.deepEqual(registry.dispatch('damage.resolved', {}, { type: 'damage', at: 0 }), { owner: 'last' });
  assert.deepEqual(calls, ['early', 'profession', 'tie-a', 'tie-b']);
  assert.equal(registry.dispatch('blind.resolved', {}, { type: 'blind', at: 0 }), undefined);
});

// Generic buffs share the stage with boons but must not activate relic boon rules.
test('relic boon reactions accept standard boons and ignore generic buffs', () => {
  const seen = [];
  const { reactions } = createGw2ResolverExtensions();
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
    /Duplicate eventReactions\.buff\.applied hook id: same/
  );
});

test('condition stage runs once after state and ticks, including profession and relic recursion', () => {
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
        context.applyCondition({
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
  const extensions = createGw2ResolverExtensions({
    professionReactions
  });
  const conditions = createGw2ConditionResolution({
    reactions: extensions.reactions,
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
    applyCondition: conditions.applyCondition
  });

  assert.equal(typeof context.applyCondition, 'function');
  assert.equal(
    context.applyCondition({
      type: 'condition',
      at: 0,
      source: 'Fixture',
      condition: 'Bleeding',
      duration: 0,
      stacks: 6
    }),
    null
  );
  assert.deepEqual(trace, []);

  const application = context.applyCondition({
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
    ['Bleeding', 'Weakness']
  );
  assert.deepEqual(
    trace.map((entry) => entry.active),
    [6, 1]
  );

  context.applyCondition({
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
    ['Bleeding', 'Weakness', 'Bleeding', 'Burning', 'Torment']
  );
  assert.deepEqual(
    trace.map((entry) => entry.active),
    [6, 1, 7, 2, 3]
  );
  assert.ok(trace.every((entry) => entry.queued > 0));
});

test('resolver duration queries use live relic state while historical queries replay new triggers', () => {
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
  const query = createGw2CombatQuery({ profession: testProfession, config, events });
  assert.equal(query.conditionDurationMultiplier('Bleeding', 1.001), 1);
  events.splice(1, 0, {
    type: 'weakness_vulnerability',
    at: 1,
    source: 'Fixture',
    sourceId: 'fixture.trigger',
    actorType: 'player'
  });
  // A new trigger invalidates historical replay, but cannot boost applications at its own timestamp.
  assert.equal(query.conditionDurationMultiplier('Bleeding', 1), 1);
  assert.equal(query.conditionDurationMultiplier('Bleeding', 1.001), 1.03);
  const durations = [];
  const liveBonuses = [];
  resolveTestGw2Stream({
    config,
    stream: buildScheduledEventStream({ events, rotationEndTime: 3 }),
    professionReactions: {
      'condition.applied': (context, application) => {
        durations.push(application.effectiveDuration);
        // Live state must exclude the queued trigger until its handler has run.
        liveBonuses.push(context.query.conditionDurationMultiplier('Bleeding', 1.001, undefined, application, context));
      }
    }
  });
  assert.deepEqual(durations, [1, 1, 1.03]);
  assert.deepEqual(liveBonuses, [1, 1.03, 1.03]);
});
