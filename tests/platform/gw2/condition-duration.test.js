import assert from 'node:assert/strict';
import test from 'node:test';
import { StableEventQueue } from '#kernel/events/queue.js';
import { createGw2CombatObserver } from '#gw2/platform/scheduler/combat-observer.js';
import { createMaterializerState } from '#gw2/platform/scheduler/materializer-state.js';
import { createGw2ConditionResolution } from '#gw2/platform/resolver/condition-resolution.js';
import { createGw2ResolverRuntimeState } from '#gw2/platform/resolver/runtime-state.js';

// Both phases snapshot the same natural lifetime while the resolver samples damage at tick time.
test('condition duration preserves phase context, fixed durations, and natural expiry beyond the horizon', () => {
  for (const [fixedDuration, baseMultiplier, expectedDuration] of [
    [false, 2, 6],
    [true, 2, 2],
    [false, undefined, 3]
  ]) {
    const event = {
      type: 'condition',
      at: 4,
      source: 'Fixture',
      actorType: 'player',
      condition: 'Bleeding',
      duration: 2,
      stacks: 1,
      fixedDuration
    };
    const scheduler = createMaterializerState({}, null, false);
    const resolution = createGw2ConditionResolution({ reactions: { dispatch() {} } });
    const resolver = createGw2ResolverRuntimeState({
      config: {},
      horizon: 5.5,
      helpers: { conditionName: (name) => name },
      queue: new StableEventQueue(),
      applyCondition: resolution.applyCondition
    });
    for (const runtime of [scheduler, resolver]) {
      runtime.query = {
        statsAt(at, application, queriedRuntime) {
          assert.equal(queriedRuntime, runtime);
          assert.equal(application.at, 4);
          return { conditionDamage: at === 4 ? 0 : 1000, durationMultiplier: at === 4 ? 1.5 : 2 };
        },
        conditionDurationMultiplier(name, at, stats, application, queriedRuntime) {
          assert.equal(fixedDuration, false);
          assert.equal(name, 'Bleeding');
          assert.equal(at, 4);
          assert.equal(application, event);
          assert.equal(queriedRuntime, runtime);
          return stats.durationMultiplier;
        },
        conditionMultiplier: () => 1,
        ...(baseMultiplier == null
          ? {}
          : {
              conditionBaseDurationMultiplier(name, at, application, queriedRuntime) {
                assert.equal(fixedDuration, false);
                assert.equal(name, 'Bleeding');
                assert.equal(at, 4);
                assert.equal(application, event);
                assert.equal(queriedRuntime, runtime);
                return baseMultiplier;
              }
            })
      };
    }

    createGw2CombatObserver(scheduler).observe({ hasExplicitCombatStart: false }, event);
    const application = resolver.applyCondition(event);
    assert.equal(application.effectiveDuration, expectedDuration);
    assert.equal(application.expiresAt, 5.5);
    assert.equal(application.naturalExpiresAt, 4 + expectedDuration);
    for (const runtime of [scheduler, resolver]) {
      assert.equal(runtime.conditionState.get('Bleeding').stacks[0].expiresAt, 4 + expectedDuration);
    }

    const tick = resolution.handleConditionTick(resolver, { at: 5, application, fraction: 1 });
    assert.equal(tick.damage, 82); // Bleeding uses the tick's 1000 Condition Damage, not the application's zero.
    assert.equal(application.effectiveDuration, expectedDuration);
  }
});
