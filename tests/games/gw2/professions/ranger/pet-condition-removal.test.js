import { createEffectExpansionBudget } from '#gw2/platform/effects/expansion-budget.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createGw2CombatQuery } from '#gw2/platform/combat-calculation/combat-query.js';
import { testProfession } from '#tests/fixtures/profession.js';
import { StableEventQueue } from '#kernel/events/queue.js';
import { createGw2ConditionResolution } from '#gw2/platform/resolver/condition-resolution.js';
import { createGw2ResolverRuntimeState } from '#gw2/platform/resolver/runtime-state.js';
import { createRangerCoreState } from '#gw2/professions/ranger/core/state.js';
import { handleRangerPetSwapped } from '#gw2/professions/ranger/core/mechanics/event-handlers.js';
import { rangerPetCompanionId } from '#gw2/professions/ranger/core/mechanics/pets.js';
import { observeRuntimeEffects } from '#gw2/platform/results/observe-effects.js';
import { effectStateValue } from '#gw2/platform/combat/effect-state.js';

for (const reporting of [true, false]) {
  test(`pet retirement cancels independent conditions immediately with reporting=${reporting}`, () => {
    const conditions = createGw2ConditionResolution({
      expansionBudget: createEffectExpansionBudget(),
      reactions: { dispatch() {} }
    });
    const context = createGw2ResolverRuntimeState({
      reporting,
      config: {},
      horizon: 3,
      query: {
        ...createGw2CombatQuery({ profession: testProfession }),
        statsAt: () => ({ conditionDamage: 0 }),
        conditionDurationMultiplier: () => 1,
        conditionMultiplier: () => 1
      },
      helpers: { conditionName: (name) => name },
      queue: new StableEventQueue(),
      professionState: { core: createRangerCoreState() }
    });
    const outgoing = rangerPetCompanionId(context);
    const swappedAt = 1.5;
    // Removal cancels unpaid pet damage, including buffered remainders, without touching other owners.
    const cases = [
      { sourceId: 'outgoing', summonOwner: outgoing, duration: 4, retired: true },
      { sourceId: 'expired-buffer', summonOwner: outgoing, duration: 1.2, retired: true },
      { sourceId: 'unrelated-pet', summonOwner: 'other-pet', duration: 4 },
      { sourceId: 'ranger-stats', actorType: 'player', duration: 4 }
    ];
    const applications = cases.flatMap(({ sourceId, actorType = 'summon', summonOwner, duration }) =>
      conditions.applyCondition(context, {
        type: 'condition',
        at: 0,
        sourceId,
        source: 'ranger-pet',
        actorType,
        independentConditionOwner: actorType === 'summon',
        summonOwner,
        duration,
        condition: 'Bleeding',
        stacks: 1
      })
    );
    context.queue.enqueue({ type: 'ranger.pet-swapped', at: swappedAt, activePet: 'Smokescale', activePetSlot: 2 });
    const observationRuntime = { ...context, time: 1, equipmentBuffPolicies: [] };
    const observeBleeding = () =>
      observeRuntimeEffects(observationRuntime, {}).find((effect) => effect.kind === 'Bleeding');
    assert.equal(effectStateValue(observeBleeding(), swappedAt).count, 3);
    const paidAfterSwap = new Set();
    while (context.queue.length) {
      const event = context.queue.dequeue();
      if (event.type === 'ranger.pet-swapped') {
        handleRangerPetSwapped(context, event);
        assert.equal(effectStateValue(observeBleeding(), swappedAt).count, 2);
        assert.notEqual(rangerPetCompanionId(context), outgoing);
        assert.equal(conditions.activeConditionStackCount(context, 'Bleeding', swappedAt), 2);
      } else if (event.type === 'condition_buffer') {
        conditions.handleConditionBuffer(context, event);
      } else {
        const tick = conditions.handleConditionTick(context, event);
        for (const { application } of tick?.contributions ?? []) {
          if (event.at >= swappedAt) {
            paidAfterSwap.add(application.sourceId);
            assert.notEqual(application.summonOwner, outgoing);
          }
        }
      }
    }

    assert.deepEqual(paidAfterSwap, new Set(['unrelated-pet', 'ranger-stats']));
    for (const [index, application] of applications.entries()) {
      assert.equal(application.removedAt, cases[index].retired ? swappedAt : undefined, application.sourceId);
      assert.ok(application.damage > 0, 'damage settled before retirement remains credited');
    }
  });
}
