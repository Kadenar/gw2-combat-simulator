import assert from 'node:assert/strict';
import test from 'node:test';
import { StableEventQueue } from '#kernel/events/queue.js';
import { createGw2CombatQuery } from '#gw2/platform/combat-calculation/combat-query.js';
import { testProfession } from '#tests/fixtures/profession.js';
import { createGw2ConditionResolution } from '#gw2/platform/resolver/condition-resolution.js';
import { projectResolvedEvents } from '#gw2/platform/results/resolved-events.js';
import { createGw2ResolverRuntimeState } from '#gw2/platform/resolver/runtime-state.js';

// Both phases snapshot the same natural lifetime while the resolver samples damage at tick time.
test('condition duration preserves phase context, fixed durations, and natural expiry beyond the horizon', () => {
  for (const [fixedDuration, baseMultiplier, expectedDuration] of [
    [false, 2, 6],
    [true, 2, 2],
    [false, undefined, 3],
    [false, 1.6719, 5.016],
    [false, 1.68, 5.04],
    [false, 1.0005 / 3, 1],
    [false, 1.0015 / 3, 1.002]
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
    const resolution = createGw2ConditionResolution({ reactions: { dispatch() {} } });
    const resolver = createGw2ResolverRuntimeState({
      config: {},
      horizon: 5.5,
      helpers: { conditionName: (name) => name },
      queue: new StableEventQueue()
    });
    for (const runtime of [resolver]) {
      runtime.query = {
        // Keep the full query contract while replacing only the duration and stat observations under test.
        ...createGw2CombatQuery({ profession: testProfession }),
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

    const [application] = resolution.applyCondition(resolver, event);
    assert.equal(application.effectiveDuration, expectedDuration);
    assert.equal(application.expiresAt, 4 + expectedDuration);
    assert.equal(application.naturalExpiresAt, 4 + expectedDuration);
    for (const runtime of [resolver]) {
      assert.equal(runtime.conditionState.get('Bleeding').stacks[0].expiresAt, 4 + expectedDuration);
    }

    // Process real buffer events before inspecting the scheduled owner payout.
    let eventTick = resolver.queue.dequeue();
    while (eventTick.type === 'condition_buffer') {
      resolution.handleConditionBuffer(resolver, eventTick);
      eventTick = resolver.queue.dequeue();
    }

    assert.equal(eventTick.at, 5);
    const tick = resolution.handleConditionTick(resolver, eventTick);
    assert.equal(tick.damage, 82); // Bleeding uses the tick's 1000 Condition Damage, not the application's zero.
    assert.equal(application.effectiveDuration, expectedDuration);
    // Reporting clips detached observations, preserving the live lifetime and nested settlement records.
    const [projected] = projectResolvedEvents([application], 5.5);
    assert.equal(projected.expiresAt, Math.min(5.5, 4 + expectedDuration));
    assert.equal(application.expiresAt, 4 + expectedDuration);
    assert.ok(Math.abs(projected.activeDuration - Math.min(1.5, expectedDuration)) < 1e-9);
    assert.notEqual(projected.damageTicks, application.damageTicks);
    const liveTicks = application.damageTicks.length;
    projected.damageTicks.push({ at: 99, damage: 1, fraction: 1 });
    assert.equal(application.damageTicks.length, liveTicks);
  }
});
