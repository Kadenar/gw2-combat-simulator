import assert from 'node:assert/strict';
import test from 'node:test';
import { StableEventQueue } from '#kernel/events/queue.js';
import { createGw2ConditionResolution } from '#gw2/platform/resolver/condition-resolution.js';
import { createGw2ResolverRuntimeState } from '#gw2/platform/resolver/runtime-state.js';
import { createRangerCoreState } from '#gw2/professions/ranger/core/state.js';
import { handleRangerPetSwapped } from '#gw2/professions/ranger/core/mechanics/event-handlers.js';
import { rangerPetCompanionId } from '#gw2/professions/ranger/core/mechanics/pets.js';

for (const reporting of [true, false]) {
  test(`pet swaps cancel outgoing conditions after one second with reporting=${reporting}`, () => {
    const conditions = createGw2ConditionResolution({ reactions: { dispatch() {} } });
    const context = createGw2ResolverRuntimeState({
      reporting,
      config: {},
      horizon: 3,
      query: {
        statsAt: () => ({ conditionDamage: 0 }),
        conditionDurationMultiplier: () => 1,
        conditionMultiplier: () => 1
      },
      helpers: { conditionName: (name) => name },
      queue: new StableEventQueue(),
      professionState: { core: createRangerCoreState() },
      applyCondition: conditions.applyCondition
    });
    const outgoing = rangerPetCompanionId(context);
    // Mixed owners and natural expiries distinguish cancellation from ordinary expiry.
    const cases = [
      { sourceId: 'outgoing', summonOwner: outgoing, duration: 4, removedAt: 2 },
      { sourceId: 'ownerless', duration: 4, removedAt: 2 },
      { sourceId: 'unrelated-pet', summonOwner: 'other-pet', duration: 4 },
      { sourceId: 'player', source: 'Player', summonOwner: outgoing, duration: 4 },
      { sourceId: 'early-expiry', summonOwner: outgoing, duration: 1.5 },
      { sourceId: 'boundary-expiry', summonOwner: outgoing, duration: 2 }
    ];
    const applications = cases.map(({ sourceId, source = 'ranger-pet', summonOwner, duration }) =>
      context.applyCondition({
        type: 'condition',
        at: 0,
        sourceId,
        source,
        summonOwner,
        duration,
        condition: 'Bleeding',
        stacks: 1
      })
    );
    context.queue.enqueue({ type: 'ranger.pet-swapped', at: 1, activePet: 'Smokescale', activePetSlot: 2 });
    while (context.queue.length) {
      const event = context.queue.dequeue();
      if (event.type === 'ranger.pet-swapped') {
        handleRangerPetSwapped(context, event);
        assert.notEqual(rangerPetCompanionId(context), outgoing);
        assert.equal(conditions.activeConditionStackCount(context, 'Bleeding', 1.25), 6);
        assert.equal(conditions.activeConditionStackCount(context, 'Bleeding', 1.75), 5);
        assert.equal(conditions.activeConditionStackCount(context, 'Bleeding', 2), 2);
        assert.equal(conditions.activeConditionStackCount(context, 'Bleeding', 4), 0);
      } else {
        const expected = cases.find(({ sourceId }) => sourceId === event.sourceId);
        const tick = conditions.handleConditionTick(context, event);
        assert.equal(tick !== null, expected.removedAt === undefined || event.at < expected.removedAt, event.sourceId);
      }
    }

    for (const [index, application] of applications.entries()) {
      assert.equal(application.removedAt, cases[index].removedAt, application.sourceId);
      assert.ok(application.damage > 0, application.sourceId);
    }
  });
}
