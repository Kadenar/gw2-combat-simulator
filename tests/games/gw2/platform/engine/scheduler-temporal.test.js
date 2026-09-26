import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createCanonicalCatalog } from '#gw2/platform/engine/skills/canonical-skill-catalog.js';
import { createCooldownController } from '#gw2/platform/execution/cooldowns.js';
import { defineProfession } from '#gw2/platform/engine/profession/contract.js';
import { testProfession } from '#tests/fixtures/profession.js';

// Reloading to full may retain a pending timer, but neither policy may erase a cast lockout.
test('ammo restoration preserves lockouts and explicitly retains or resets full-pool recharge', () => {
  for (const policy of ['retain', 'reset']) {
    const skill = { id: 980012, ammo: 2 };
    const state = { time: 0, ammo: new Map(), rechargeProgress: new Map(), cooldowns: new Map() };
    const controller = createCooldownController({ state, rechargeDuration: () => 10 });
    controller.spendAmmo(skill, 0);
    controller.spendAmmo(skill, 0);
    controller.setAmmoLockout(skill, 5, 0);
    assert.equal(controller.restoreAmmo(skill, -1, 1, policy), 0);
    assert.equal(controller.restoreAmmo(skill, 1, 1, policy), 1);
    assert.equal(state.cooldowns.get(skill.id), 5);
    assert.equal(state.ammo.get(skill.id).nextRechargeAt, 10);
    assert.equal(controller.restoreAmmo(skill, 20, 2, policy), 1);
    assert.equal(state.cooldowns.get(skill.id), 5);
    assert.equal(state.ammo.get(skill.id).nextRechargeAt, policy === 'retain' ? 10 : null);
    assert.equal(controller.restoreAmmo(skill, 1, 3, policy), 0);
    controller.spendAmmo(skill, 6);
    assert.equal(controller.refreshAmmo(skill, 10).charges, policy === 'retain' ? 2 : 1);
    assert.equal(controller.refreshAmmo(skill, 16).charges, 2);
    assert.equal(controller.restoreAmmo({ id: 980013 }, 1, 16, policy), 0);
  }
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

test('ammo recharge reductions carry overflow until maximum charges', () => {
  const skill = { id: 980000, ammo: 3, ammoRecharge: 12 };
  const state = {
    time: 0,
    ammo: new Map(),
    rechargeProgress: new Map(),
    cooldowns: new Map()
  };
  const controller = createCooldownController({
    state,
    rechargeDuration: () => 12
  });

  controller.spendAmmo(skill, 0);
  controller.spendAmmo(skill, 0);
  controller.spendAmmo(skill, 0);

  const zeroToOne = controller.reduceSkillRecharge(skill, 1, 11.3);

  assert.equal(zeroToOne, 1);
  assert.equal(state.ammo.get(skill.id).charges, 0);
  controller.refreshAmmo(skill, 11.32);
  assert.equal(state.ammo.get(skill.id).charges, 1);
  assert.equal(Math.round(state.ammo.get(skill.id).nextRechargeAt * 1000), 23020);
  assert.equal(state.cooldowns.has(skill.id), false);

  const oneToTwo = controller.reduceSkillRecharge(skill, 5, 20);

  assert.equal(oneToTwo, 5);
  assert.equal(state.ammo.get(skill.id).charges, 2);
  assert.equal(Math.round(state.ammo.get(skill.id).nextRechargeAt * 1000), 30020);

  const twoToThree = controller.reduceSkillRecharge(skill, 5, 29);

  assert.equal(Math.round(twoToThree * 1000), 1020);
  assert.deepEqual(state.ammo.get(skill.id), {
    charges: 3,
    maximum: 3,
    rechargeWork: 12,
    nextRechargeAt: null
  });
});

// Returning charges must preserve cast lockouts shorter than, equal to, or longer than count recharge.
test('ammo recharge reduction preserves independent cast lockouts', () => {
  for (const lockout of [0, 5, 10, 15]) {
    const skill = { id: 980000, ammo: 2 };
    const state = { time: 0, ammo: new Map(), rechargeProgress: new Map(), cooldowns: new Map() };
    const controller = createCooldownController({ state, rechargeDuration: () => 10 });
    controller.spendAmmo(skill, 0);
    controller.spendAmmo(skill, 0);
    if (lockout) controller.setAmmoLockout(skill, lockout, 0);

    controller.reduceSkillRecharge(skill, 2, 1);
    assert.equal(state.ammo.get(skill.id).charges, 0);
    assert.equal(state.cooldowns.get(skill.id), Math.max(lockout, 8));

    controller.reduceSkillRecharge(skill, 8, 1);
    assert.equal(state.ammo.get(skill.id).charges, 1);
    assert.equal(state.cooldowns.get(skill.id) ?? 0, lockout);
    controller.refreshAmmo(skill, Math.max(1, lockout));
    assert.equal(state.cooldowns.has(skill.id), false);
  }
});

test('a recovered ammo charge cannot cast before its lockout expires', () => {
  const catalog = createCanonicalCatalog({
    generated: [
      { id: 980000, name: 'Ammo Cast', ammo: 2, ammoRecharge: 10, ammoCastLockout: 5, castTimeMs: 0, effects: [] }
    ]
  });
  let recoveredCharges;
  const profession = defineProfession({
    id: 'ammo-lockout',
    name: 'Ammo Lockout',
    catalog,
    hooks: {
      initialize(context) {
        const skill = catalog.skillsById.get(980000);
        context.cooldownController.spendAmmo(skill, 0);
        context.cooldownController.spendAmmo(skill, 0);
        context.cooldownController.setAmmoLockout(skill, 5, 0);
        context.schedule('recover-ammo', 1, {});
      },
      tasks: {
        'recover-ammo': (context) => {
          const skill = catalog.skillsById.get(980000);
          context.cooldownController.reduceSkillRecharge(skill, 10, context.time);
          recoveredCharges = context.ammo.get(skill.id).charges;
        }
      }
    }
  });
  const result = simulateGw2({ profession, rotation: ['Ammo Cast', { type: 'cooldown-reset' }, 'Ammo Cast'] });

  assert.equal(recoveredCharges, 1);
  assert.deepEqual(
    result.steps.filter((step) => step.skill === 'Ammo Cast').map((step) => step.start),
    [4000, 4000]
  );
  assert.deepEqual(result.warnings, []);
});

test('skill recharge reduction routes ordinary and ammo skills through one capped contract', () => {
  const ordinary = { id: 980010 };
  const ammo = { id: 980011, ammo: 2, ammoRecharge: 12 };
  const state = {
    time: 0,
    ammo: new Map(),
    rechargeProgress: new Map(),
    cooldowns: new Map([[ordinary.id, 10]])
  };
  const controller = createCooldownController({
    state,
    rechargeDuration: () => 12
  });

  controller.spendAmmo(ammo, 0);

  assert.equal(controller.reduceSkillRecharge(ordinary, 3, 4), 3);
  assert.equal(state.cooldowns.get(ordinary.id), 7);
  assert.equal(controller.reduceSkillRecharge(ordinary, 10, 4), 3);
  assert.equal(state.cooldowns.get(ordinary.id), 4);
  assert.equal(controller.reduceSkillRecharge(ammo, 5, 4), 5);
  assert.equal(state.ammo.get(ammo.id).nextRechargeAt, 7);
});

test('skill recharge reduction accepts game-specific base-to-wall-time conversion', () => {
  const ordinary = { id: 980012, cooldown: 10 };
  const ammo = { id: 980013, ammo: 2, ammoRecharge: 10 };
  const state = { time: 0, ammo: new Map(), rechargeProgress: new Map(), cooldowns: new Map([[ordinary.id, 8]]) };
  const controller = createCooldownController({
    state,
    rechargeDuration: () => 8,
    rate: () => 1.25
  });

  controller.spendAmmo(ammo, 0);

  assert.equal(controller.reduceSkillRecharge(ordinary, 1, 0), 0.8);
  assert.equal(state.cooldowns.get(ordinary.id), 7.2);
  assert.equal(controller.reduceSkillRecharge(ammo, 1, 0), 0.8);
  assert.equal(state.ammo.get(ammo.id).nextRechargeAt, 7.2);
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
  const profession = defineProfession({
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
  const profession = defineProfession({
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
  const profession = defineProfession({
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
  const profession = defineProfession({
    id: 'temporal-concurrent-wait',
    name: 'Temporal Concurrent Wait',
    catalog: temporalCatalog(),
    hooks: {
      initialize(context) {
        context.cooldowns.set(980002, context.config.readyAt);
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
  const profession = defineProfession({
    id: 'temporal-group-lockout',
    name: 'Temporal Group Lockout',
    catalog
  });

  const scheduled = simulateGw2({ profession, rotation: ['Shatter One', 'Unrelated Instant', 'Shatter Two'] });

  assert.deepEqual(
    scheduled.steps.map((step) => ({
      skill: step.skill,
      start: step.start,
      end: step.end,
      fullCastMs: step.fullCastMs
    })),
    [
      {
        skill: 'Shatter One',
        start: 0,
        end: 0,
        fullCastMs: 0
      },
      {
        skill: 'Unrelated Instant',
        start: 0,
        end: 0,
        fullCastMs: 0
      },
      {
        skill: 'Shatter Two',
        start: 50,
        end: 50,
        fullCastMs: 0
      }
    ]
  );

  assert.deepEqual(scheduled.warnings, []);
});

test('interrupted casts complete at their effective end', () => {
  const profession = defineProfession({
    id: 'temporal-interrupt',
    name: 'Temporal Interrupt',
    catalog: temporalCatalog(),
    resources: {
      createState: () => ({ completions: [] })
    },
    hooks: {
      onCastComplete(context, cast) {
        context.profession.completions.push({
          skill: cast.skill.name,
          clock: context.time,
          effectiveEnd: cast.effectiveEnd
        });
      }
    }
  });
  const scheduled = simulateGw2({ profession, rotation: [{ name: 'Long Cast', interruptMs: 250 }] });

  assert.equal(scheduled.steps[0].end, 250);
  assert.equal(scheduled.steps[0].interrupted, true);
  assert.deepEqual(scheduled.planningState.profession.completions, [
    {
      skill: 'Long Cast',
      clock: 0.25,
      effectiveEnd: 0.25
    }
  ]);
});

test('committed interrupted casts retain their lane while cancelled attempts release it', () => {
  const catalog = createCanonicalCatalog({
    generated: [
      {
        id: 980010,
        name: 'Retained Aftercast',
        castTimeMs: 1000,
        cooldown: 10,
        interruptCommitMs: 400,
        retainsCastLockoutAfterInterrupt: true,
        effects: []
      },
      {
        id: 980011,
        name: 'Swap Weapons',
        type: 'Action',
        castTimeMs: 0,
        effects: []
      },
      {
        id: 980012,
        name: 'Instant Cast',
        castTimeMs: 0,
        effects: []
      },
      {
        id: 980013,
        name: 'Following Cast',
        castTimeMs: 200,
        effects: []
      }
    ]
  });
  const profession = defineProfession({
    id: 'temporal-retained-aftercast',
    name: 'Temporal Retained Aftercast',
    catalog
  });
  const scheduled = simulateGw2({
    profession,
    rotation: [{ name: 'Retained Aftercast', interruptMs: 400 }, 'Swap Weapons', 'Instant Cast', 'Following Cast']
  });
  const uninterrupted = simulateGw2({ profession, rotation: ['Retained Aftercast'] });
  // Below commitment, the next cast starts at the cancellation instead of the full aftercast boundary.
  const cancelled = simulateGw2({
    profession,
    rotation: [{ name: 'Retained Aftercast', interruptMs: 200 }, 'Following Cast']
  });
  assert.equal(cancelled.steps[0].cancelledBeforeCommit, true);
  assert.equal(cancelled.steps[0].castLockoutEnd, undefined);
  assert.equal(cancelled.steps[1].start, 200);
  const interruptedAction = scheduled.events.find(
    (event) => event.type === 'action' && event.skillName === 'Retained Aftercast'
  );
  const followingAction = scheduled.events.find(
    (event) => event.type === 'action' && event.skillName === 'Following Cast'
  );
  const swapAction = scheduled.events.find((event) => event.type === 'action' && event.skillName === 'Swap Weapons');
  const instantAction = scheduled.events.find((event) => event.type === 'action' && event.skillName === 'Instant Cast');
  const uninterruptedAction = uninterrupted.events.find(
    (event) => event.type === 'action' && event.skillName === 'Retained Aftercast'
  );

  assert.equal(interruptedAction.endsAt, 0.4);
  assert.equal(interruptedAction.castLockoutEndsAt, 1);
  assert.equal(scheduled.planningState.cooldowns[interruptedAction.skillName].readyAt / 1000, 8.4);
  assert.equal(scheduled.planningState.cooldowns[interruptedAction.skillName].readyAt / 1000, 8.4);
  assert.equal(scheduled.steps[0].end, 400);
  assert.equal(scheduled.steps[0].castLockoutEnd, 1000);
  assert.equal(swapAction.at, 0.4);
  assert.equal(instantAction.at, 0.4);
  assert.equal(followingAction.at, 1);
  assert.equal(scheduled.steps[1].start, 400);
  assert.equal(scheduled.steps[2].start, 400);
  assert.equal(scheduled.steps[3].start, 1000);
  assert.equal(uninterruptedAction.endsAt, 1);
  assert.equal(uninterrupted.planningState.cooldowns[uninterruptedAction.skillName].readyAt / 1000, 9);
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
  const profession = defineProfession({
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
  assert.equal(first.end, 1000);
  assert.equal(companion.start, 0);
  assert.equal(companion.end, 2000);
  assert.equal(second.start, 1000);
  assert.equal(second.end, 1500);
  assert.equal(result.planningState.atSeconds, 2);

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
