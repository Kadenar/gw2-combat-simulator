import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createCanonicalCatalog } from '#gw2/platform/skills/catalog.js';
import { createCooldownController } from '#gw2/platform/execution/cooldowns.js';
import { defineTestProfession } from '#tests/helpers/profession.js';
import { testProfession } from '#tests/fixtures/profession.js';

// A full reload clears pending charges so the next spend starts a fresh recharge queue.
test('ammo restoration resets full-pool recharge', () => {
  const skill = { id: 980012, ammo: 2 };
  const state = { time: 0 };
  const controller = createCooldownController({ clock: state, rechargeDuration: () => 10 });
  controller.spendAmmo(skill, 0);
  controller.spendAmmo(skill, 0);
  assert.equal(controller.restoreAmmo(skill, -1, 1), 0);
  assert.equal(controller.restoreAmmo(skill, 1, 1), 1);
  assert.equal(controller.readAmmo(skill.id).nextRechargeAt, 10);
  assert.equal(controller.restoreAmmo(skill, 20, 2), 1);
  assert.deepEqual(controller.readAmmo(skill.id).recharges, []);
  assert.equal(controller.readAmmo(skill.id).nextRechargeAt, null);
  assert.equal(controller.restoreAmmo(skill, 1, 3), 0);
  controller.spendAmmo(skill, 6);
  assert.equal(controller.refreshAmmo(skill, 10).charges, 1);
  assert.equal(controller.refreshAmmo(skill, 16).charges, 2);
  assert.equal(controller.restoreAmmo({ id: 980013 }, 1, 16), 0);
});

// Staggered spends share one recharge queue; partial restoration preserves the active timer.
test('ammo charges recover sequentially and partial restoration preserves active progress', () => {
  for (const reload of [false, true]) {
    const skill = { id: 980014, ammo: 2 };
    const state = { time: 0 };
    const controller = createCooldownController({
      clock: state,
      rechargeDuration: () => 16,
      rechargeIntervals: (_skill, start, end) => [{ start, end, rate: 1.25 }]
    });
    controller.spendAmmo(skill, 0.6);
    controller.spendAmmo(skill, 1.6);
    const ammo = controller.readAmmo(skill.id);
    assert.equal(ammo.nextRechargeAt, 16.6);
    if (reload) {
      assert.equal(controller.restoreAmmo(skill, 1, 5), 1);
      assert.equal(ammo.charges, 1);
      assert.deepEqual(ammo.recharges, [{ startedAt: 0.6, work: 20 }]);
      assert.equal(ammo.nextRechargeAt, 16.6);
    }

    assert.equal(controller.refreshAmmo(skill, 16.599).charges, reload ? 1 : 0);
    assert.equal(controller.refreshAmmo(skill, 16.6).charges, reload ? 2 : 1);
    assert.equal(ammo.nextRechargeAt, reload ? null : 32.6);
    assert.equal(controller.refreshAmmo(skill, 17.6).charges, reload ? 2 : 1);
    assert.equal(controller.refreshAmmo(skill, 32.6).charges, 2);
    assert.deepEqual(ammo.recharges, []);
  }
});

// Spending a restored round queues its full interval behind the active recharge.
test('a partially restored charge waits for the active recharge when spent again', () => {
  const skill = { id: 980016, ammo: 2 };
  const state = { time: 0 };
  const controller = createCooldownController({
    clock: state,
    rechargeDuration: () => 16,
    rechargeIntervals: (_skill, start, end) => [{ start, end, rate: 1.25 }]
  });
  controller.spendAmmo(skill, 0.6);
  controller.spendAmmo(skill, 1.6);
  controller.restoreAmmo(skill, 1, 8);
  controller.spendAmmo(skill, 9);
  assert.equal(controller.readAmmo(skill.id).nextRechargeAt, 16.6);
  assert.equal(controller.refreshAmmo(skill, 17.6).charges, 1);
  assert.equal(controller.refreshAmmo(skill, 25).charges, 1);
  assert.equal(controller.refreshAmmo(skill, 32.6).charges, 2);
});

// Recharge-rate windows advance only the active charge; queued charges cannot bank elapsed progress.
test('queued charges preserve active progress across recharge rate changes', () => {
  const skill = { id: 980017, ammo: 2 };
  const state = { time: 0 };
  const controller = createCooldownController({
    clock: state,
    rechargeDuration: () => 10,
    rechargeIntervals: (_skill, start, end) =>
      [
        { start: 0, end: 4, rate: 1 },
        { start: 4, end: 8, rate: 1.25 },
        { start: 8, end: Infinity, rate: 1 }
      ]
        .map((interval) => ({ ...interval, start: Math.max(start, interval.start), end: Math.min(end, interval.end) }))
        .filter((interval) => interval.end > interval.start)
  });
  controller.spendAmmo(skill, 0);
  controller.spendAmmo(skill, 2);
  assert.equal(controller.refreshAmmo(skill, 8).charges, 0);
  assert.equal(controller.refreshAmmo(skill, 9).charges, 1);
  assert.equal(controller.readAmmo(skill.id).nextRechargeAt, 19);
  assert.equal(controller.refreshAmmo(skill, 11).charges, 1);
  assert.equal(controller.refreshAmmo(skill, 19).charges, 2);
});

// Different committed recharge durations do not reorder the queue or replace active progress.
test('restoration removes queued charges even when later charges have shorter recharge', () => {
  const skill = { id: 980015, ammo: 3 };
  const state = { time: 0 };
  const controller = createCooldownController({ clock: state, rechargeDuration: () => 20 });
  controller.spendAmmo(skill, 0, 20);
  controller.spendAmmo(skill, 1, 10);
  controller.spendAmmo(skill, 2, 5);
  assert.equal(controller.restoreAmmo(skill, 2, 3), 2);
  assert.deepEqual(controller.readAmmo(skill.id).recharges, [{ startedAt: 0, work: 20 }]);
  assert.equal(controller.refreshAmmo(skill, 7).charges, 2);
  assert.equal(controller.refreshAmmo(skill, 20).charges, 3);
});

// Shared control markers carry explicit ownership even when the rotation has no skill casts.
test('combat-start and cooldown-reset markers declare environment ownership', () => {
  const result = simulateGw2({
    profession: testProfession,
    rotation: [{ type: 'cooldown-reset' }, { type: 'combat-start' }]
  });
  for (const sourceId of ['cooldown-reset', 'combat-start']) {
    const event = result.events.find((entry) => entry.sourceId === sourceId);
    assert.ok(event, `${sourceId} marker must be emitted`);
    assert.equal(event.actorType, 'environment');
  }
});

// Flat reductions consume work once, carrying excess to the next charge and capping at a full pool.
test('ammo recharge reductions advance the queue without multiplying progress', () => {
  const skill = { id: 980000, ammo: 3, ammoRecharge: 12 };
  const state = { time: 0 };
  const controller = createCooldownController({ clock: state, rechargeDuration: () => 12 });
  controller.spendAmmo(skill, 0);
  controller.spendAmmo(skill, 4);
  controller.spendAmmo(skill, 8);

  assert.equal(controller.reduceSkillRecharge(skill, 2, 11), 2);
  assert.equal(controller.readAmmo(skill.id).charges, 1);
  assert.equal(controller.readAmmo(skill.id).nextRechargeAt, 22);
  assert.equal(controller.hasCooldown(skill.id), false);

  assert.equal(controller.reduceSkillRecharge(skill, 2, 13), 2);
  assert.equal(controller.readAmmo(skill.id).charges, 1);
  assert.equal(controller.readAmmo(skill.id).nextRechargeAt, 20);
  assert.equal(controller.reduceSkillRecharge(skill, 20, 15), 17);
  assert.deepEqual(controller.readAmmo(skill.id), {
    charges: 3,
    maximum: 3,
    recharges: [],
    nextRechargeAt: null
  });
});

test('skill recharge reduction routes ordinary and ammo skills through one capped contract', () => {
  const ordinary = { id: 980010 };
  const ammo = { id: 980011, ammo: 2, ammoRecharge: 12 };
  const state = {
    time: 0
  };
  const controller = createCooldownController({ clock: state, rechargeDuration: () => 12 });

  controller.setReadyAt(ordinary.id, 10);
  controller.spendAmmo(ammo, 0);

  assert.equal(controller.reduceSkillRecharge(ordinary, 3, 4), 3);
  assert.equal(controller.readyAt(ordinary.id), 7);
  assert.equal(controller.reduceSkillRecharge(ordinary, 10, 4), 3);
  assert.equal(controller.readyAt(ordinary.id), 4);
  assert.equal(controller.reduceSkillRecharge(ammo, 5, 4), 5);
  assert.equal(controller.readAmmo(ammo.id).nextRechargeAt, 7);
});

test('skill recharge reduction accepts game-specific base-to-wall-time conversion', () => {
  const ordinary = { id: 980012, cooldown: 10 };
  const ammo = { id: 980013, ammo: 2, ammoRecharge: 10 };
  const state = { time: 0 };
  const controller = createCooldownController({
    clock: state,
    rechargeDuration: () => 8,
    rechargeIntervals: (_skill, start, end) => [{ start, end, rate: 1.25 }]
  });

  controller.spendAmmo(ammo, 0);

  controller.setReadyAt(ordinary.id, 8);
  assert.equal(controller.reduceSkillRecharge(ordinary, 1, 0), 0.8);
  assert.equal(controller.readyAt(ordinary.id), 7.2);
  assert.equal(controller.reduceSkillRecharge(ammo, 1, 0), 0.8);
  assert.equal(controller.readAmmo(ammo.id).nextRechargeAt, 7.2);
});

function temporalCatalog() {
  return createCanonicalCatalog({
    generated: [
      {
        id: 980001,
        name: 'Long Cast',
        castTimeMs: 1000,
        effects: []
      },
      {
        id: 980002,
        name: 'Instant Cast',
        castTimeMs: 0,
        effects: []
      },
      {
        id: 980003,
        name: 'Gated Cast',
        castTimeMs: 0,
        effects: []
      }
    ]
  });
}

test('tasks during a cast run before a later concurrent command', () => {
  const profession = defineTestProfession({
    id: 'temporal-order',
    name: 'Temporal Order',
    catalog: temporalCatalog(),
    resources: {
      createState: () => ({ log: [] })
    },
    hooks: {
      initialize(context) {
        context.schedule('fixture.record', 0.25, { value: 'task' });
      },
      onCastStart(context, { skill }) {
        if (skill.name === 'Instant Cast') {
          context.profession.log.push('concurrent-start');
        }
      },
      tasks: {
        'fixture.record': (context, task) => {
          context.profession.log.push(task.value);
        }
      }
    }
  });
  const scheduled = simulateGw2({ profession, rotation: ['Long Cast', { name: 'Instant Cast', offset: 500 }] });

  assert.deepEqual(scheduled.planningState.profession.log, ['task', 'concurrent-start']);
  assert.deepEqual(
    scheduled.steps.map((step) => step.start),
    [0, 500]
  );
});

test('consecutive concurrent casts chain offsets from the preceding cast', () => {
  const profession = defineTestProfession({
    id: 'temporal-concurrent-chain',
    name: 'Temporal Concurrent Chain',
    catalog: temporalCatalog()
  });
  const scheduled = simulateGw2({
    profession,
    rotation: ['Long Cast', { name: 'Gated Cast', offset: 500 }, { name: 'Instant Cast', offset: 100 }]
  });

  assert.deepEqual(
    scheduled.events
      .filter((event) => event.type === 'action')
      .map((event) => [event.skillName, Math.round(event.at * 1000)]),
    [
      ['Long Cast', 0],
      ['Gated Cast', 500],
      ['Instant Cast', 600]
    ]
  );
  assert.deepEqual(
    scheduled.steps.map((step) => [step.ri, step.skill, step.start]),
    [
      [0, 'Long Cast', 0],
      [1, 'Gated Cast', 500],
      [2, 'Instant Cast', 600]
    ]
  );
  assert.deepEqual(scheduled.warnings, []);
});

test('an intermediate task can make a waiting cast available', () => {
  const profession = defineTestProfession({
    id: 'temporal-readiness',
    name: 'Temporal Readiness',
    catalog: temporalCatalog(),
    resources: {
      createState: () => ({ ready: false })
    },
    hooks: {
      availability(context, skill) {
        if (skill.name !== 'Gated Cast' || context.profession.ready) {
          return { ready: true };
        }

        return {
          ready: false,
          retryAt: 10,
          code: 'fixture.waiting',
          reason: 'Waiting for the readiness task.'
        };
      },
      initialize(context) {
        context.schedule('fixture.ready', 2, {});
      },
      tasks: {
        'fixture.ready': (context) => {
          context.profession.ready = true;
        }
      }
    }
  });
  const scheduled = simulateGw2({ profession, rotation: ['Gated Cast'] });

  assert.equal(scheduled.steps[0].start, 2000);
  assert.deepEqual(scheduled.warnings, []);
});

test('a concurrent instant waits until its finite cooldown expires', () => {
  const profession = defineTestProfession({
    id: 'temporal-concurrent-wait',
    name: 'Temporal Concurrent Wait',
    catalog: temporalCatalog(),
    hooks: {
      initialize(context) {
        context.cooldownController.setReadyAt(980002, context.config.readyAt);
      }
    }
  });
  const queued = simulateGw2({
    profession,
    config: { readyAt: 0.6 },
    rotation: ['Long Cast', { name: 'Instant Cast', offset: 100 }]
  });
  const afterParent = simulateGw2({
    profession,
    config: { readyAt: 1.2 },
    rotation: ['Long Cast', { name: 'Instant Cast', offset: 100 }, 'Gated Cast']
  });

  assert.deepEqual(
    queued.steps.map((step) => step.start),
    [0, 600]
  );
  assert.deepEqual(queued.warnings, []);
  assert.deepEqual(
    afterParent.steps.map((step) => step.start),
    [0, 1200, 1200]
  );
  assert.deepEqual(afterParent.warnings, []);
});

test('skill-group lockouts block only skills in the same group', () => {
  const lockouts = [{ group: 'fixture.shatter', durationMs: 50 }];
  const catalog = createCanonicalCatalog({
    generated: [
      {
        id: 980010,
        name: 'Shatter One',
        castTimeMs: 0,
        lockouts,
        effects: []
      },
      {
        id: 980011,
        name: 'Unrelated Instant',
        castTimeMs: 0,
        effects: []
      },
      {
        id: 980012,
        name: 'Shatter Two',
        castTimeMs: 0,
        lockouts,
        effects: []
      }
    ]
  });
  const profession = defineTestProfession({
    id: 'temporal-group-lockout',
    name: 'Temporal Group Lockout',
    catalog
  });

  const scheduled = simulateGw2({ profession, rotation: ['Shatter One', 'Unrelated Instant', 'Shatter Two'] });

  // Only the shared cooldown group delays the final input; unrelated instants remain available.
  assert.deepEqual(
    scheduled.steps.map((step) => [step.skill, step.start]),
    [
      ['Shatter One', 0],
      ['Unrelated Instant', 0],
      ['Shatter Two', 50]
    ]
  );
  assert.deepEqual(scheduled.warnings, []);
});

test('queued instant casts use the combat marker when their requested overlap has passed', () => {
  const result = simulateGw2({
    profession: testProfession,
    rotation: [
      { type: 'cast', skillId: 900001 },
      { type: 'combat-start', concurrentOffsetMs: 500 },
      { type: 'cast', skillId: 900002, concurrentOffsetMs: 0 }
    ]
  });

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(
    result.steps.map((step) => [step.skill, step.start]),
    [
      ['Fixture Slash', 0],
      ['Combat Start', 500],
      ['Fixture Charge', 500]
    ]
  );
});

test('independent casts use a separate serial cast lane', () => {
  const profession = defineTestProfession({
    id: 'independent-casts',
    name: 'Independent Casts',
    catalog: createCanonicalCatalog({
      generated: [
        {
          id: 910001,
          name: 'Player Cast One',
          castTimeMs: 1000,
          effects: []
        },
        {
          id: 910002,
          name: 'Companion Cast',
          castTimeMs: 2000,
          independentCast: true,
          effects: []
        },
        {
          id: 910003,
          name: 'Player Cast Two',
          castTimeMs: 500,
          effects: []
        }
      ]
    })
  });
  const result = simulateGw2({ profession, rotation: ['Player Cast One', 'Companion Cast', 'Player Cast Two'] });
  const [first, companion, second] = result.steps;

  assert.equal(first.start, 0);
  assert.equal(companion.start, 0);
  assert.equal(second.start, first.end);

  // Explicit offsets overlap the player but cannot overlap a companion's serial animations.
  const queued = simulateGw2({
    profession,
    rotation: [
      'Player Cast One',
      { type: 'cast', skillId: 910002, concurrentOffsetMs: 120 },
      { type: 'cast', skillId: 910002, concurrentOffsetMs: 240 },
      { type: 'cast', skillId: 910002, concurrentOffsetMs: 120 }
    ]
  });
  assert.deepEqual(queued.warnings, []);
  assert.equal(queued.steps[1].start, 120);
  assert.equal(queued.steps[2].start, queued.steps[1].end);
  assert.equal(queued.steps[3].start, queued.steps[2].end);
});
