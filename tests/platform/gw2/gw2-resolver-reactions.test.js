import assert from 'node:assert/strict';
import test from 'node:test';

import { createEventQueue } from '#kernel/events/queue.js';
import { createGw2ConditionResolution } from '#gw2/platform/resolver/condition-resolution.js';
import { createGw2ResolverExtensions } from '#gw2/platform/resolver/extensions.js';
import { createGw2ResolverReactionRegistry } from '#gw2/platform/resolver/reaction-registry.js';
import { createGw2ResolverRuntimeState } from '#gw2/platform/resolver/runtime-state.js';

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
      trace.push({
        condition: application.condition,
        applications: context.conditionApplications.length,
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
    config: { relic: 'Fractal' },
    professionReactions
  });
  const conditions = createGw2ConditionResolution({
    reactions: extensions.reactions,
    config: { target: { conditions: { Bleeding: 1 } } }
  });
  const queue = createEventQueue();
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
    applyCondition: conditions.applyCondition,
    createEquipmentState: extensions.createEquipmentState
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
    trace.map((entry) => entry.applications),
    [1, 2, 3, 4, 5]
  );
  assert.deepEqual(
    trace.map((entry) => entry.active),
    [6, 1, 7, 2, 3]
  );
  assert.ok(trace.every((entry) => entry.queued > 0));
});
