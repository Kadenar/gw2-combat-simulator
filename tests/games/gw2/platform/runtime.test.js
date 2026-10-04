import assert from 'node:assert/strict';
import test from 'node:test';
import { MODIFIER_HOOK_NAMES } from '#gw2/platform/profession-definition/compiler/compile-contract.js';
import { createCanonicalCatalog } from '#gw2/platform/skills/catalog.js';
import { anchorResourceClock } from '#gw2/platform/combat/resources/clock.js';
import { observeGw2Runtime } from '#tests/helpers/observed-runtime.js';
import { createRuntimeEndurance } from '#gw2/platform/combat/resources/runtime-resources.js';
import { testProfession } from '#tests/fixtures/profession.js';

// The pilot owns its hooks directly; none of the production scheduler/resolver state factories are installed.
const catalog = createCanonicalCatalog({
  generated: [
    {
      id: 990001,
      name: 'Cast',
      weapon: 'Sword',
      castTimeMs: 1000,
      cooldown: 2,
      effects: [{ type: 'strike', coefficient: 1 }]
    },
    { id: 990002, name: 'Spend', castTimeMs: 0, effects: [] },
    { id: 990003, name: 'Long', castTimeMs: 2000, effects: [] },
    { id: 990004, name: 'Instant', castTimeMs: 0, effects: [{ type: 'boon', boon: 'might', stacks: 1, duration: 5 }] },
    { id: 990005, name: 'Independent', independentCast: true, castTimeMs: 1500, effects: [] },
    {
      id: 990006,
      name: 'Condition',
      castTimeMs: 0,
      effects: [{ type: 'condition', condition: 'Bleeding', stacks: 1, duration: 2 }]
    },
    { id: 990007, name: 'Ammo', castTimeMs: 0, ammo: 2, ammoRecharge: 2, ammoCastLockout: 0.5, effects: [] },
    { id: 990008, name: 'Strike', weapon: 'Sword', castTimeMs: 0, effects: [{ type: 'strike', coefficient: 1 }] },
    {
      id: 990009,
      name: 'Restricted',
      castTimeMs: 1000,
      defaultInterruptMs: 500,
      canCastConcurrently: false,
      effects: []
    }
  ],
  weapons: ['Sword']
});
const cast = (skillId, extra = {}) => ({ type: 'cast', skillId, ...extra });
const wait = (durationMs) => ({ type: 'wait', durationMs });

test('endurance spending agrees with readiness after fractional regeneration', () => {
  const pool = { endurance: 0, enduranceUpdatedAt: 0 };
  const runtime = { time: 0, config: {}, history: [] };
  const endurance = createRuntimeEndurance(runtime, {
    endurance: { state: () => pool, maximum: () => 100, regenerationRate: () => 7.5 }
  });
  endurance.spend(100);
  runtime.time = 6;
  endurance.advance();
  runtime.time = 6 + 2 / 3;
  endurance.advance();
  assert.equal(endurance.readyAt(50), runtime.time);
  endurance.spend(50);
  assert.equal(pool.endurance, 0);
  assert.throws(() => endurance.spend(1), /Insufficient endurance/);
});

test('shared lockout deadlines advance at the canonical concurrent-command boundary', () => {
  // Decimal addition must not leave readiness infinitesimally beyond its already-dispatched wake.
  const skill = {
    id: 990020,
    name: 'Lockout',
    castTimeMs: 0,
    effects: [],
    lockouts: [{ group: 'test', durationMs: 50 }]
  };
  const profession = { ...fixture(), catalog: createCanonicalCatalog({ generated: [skill] }) };
  const result = observeGw2Runtime({ profession, config, rotation: [wait(1360), cast(skill.id), cast(skill.id)] });
  assert.deepEqual(result.warnings, []);
  assert.equal(result.steps.findLast((step) => step.skillId === skill.id).start, 1410);
});
const config = {
  stats: { power: 1000, precision: 1000, ferocity: 0, conditionDamage: 0, expertise: 0 },
  target: { armor: 1000, health: 0, conditions: {} },
  randomness: { mode: 'expected', seed: 123 }
};
function fixture(hooks = {}) {
  return {
    // Use the canonical list so fixtures retain every required modifier as the contract evolves.
    ...Object.fromEntries(MODIFIER_HOOK_NAMES.map((key) => [key, testProfession[key]])),
    id: 'live-fixture',
    catalog,
    createState: () => ({
      energy: { value: 0, maximum: 10, updatedAt: 0, rate: 0 },
      accepted: [],
      completed: [],
      hits: 0
    }),
    resources: {
      energy: {
        kind: 'continuous',
        state: (runtime) => runtime.profession.energy,
        maximum: () => 10,
        initial: () => 0,
        recovery: () => 0
      }
    },
    onCastStart: (runtime, activation) => runtime.profession.accepted.push([activation.skill.name, runtime.time]),
    onCastCommit: (runtime, activation) => runtime.profession.completed.push([activation.skill.name, runtime.time]),
    ...hooks
  };
}

function run(rotation, options = {}) {
  return observeGw2Runtime({ profession: fixture(), config, rotation, ...options });
}

function packet(at, extra = {}) {
  return { type: 'damage', at, source: 'fixture', sourceId: 'hit', actorType: 'player', flatDamage: 10, ...extra };
}

test('one live state spends an actual hit gain before its estimated retry, with identical score execution', () => {
  let creates = 0;
  const contexts = new Set();
  const queries = new Set();
  const attempts = [];
  const profession = fixture({
    createState: () => {
      creates++;
      return fixture().createState();
    },
    availability(runtime, skill) {
      queries.add(runtime);
      assert.equal(Object.isFrozen(runtime), true);
      assert.equal('effects' in runtime, false);
      assert.equal('spend' in runtime.resourceController, false);
      if (skill.id !== 990002 || runtime.profession.energy.value >= 1) return { ready: true };
      attempts.push(runtime.time);
      return { ready: false, retryAt: 10, reason: 'Waiting for a hit', code: 'resource' };
    },
    onCastStart(runtime, activation) {
      contexts.add(runtime);
      fixture().onCastStart(runtime, activation);
      if (activation.skill.id === 990002) {
        runtime.profession.energy.value--;
        anchorResourceClock(runtime.profession.energy);
      }
    },
    reactions: {
      'damage.resolved': (runtime) => {
        contexts.add(runtime);
        runtime.profession.energy.value++;
        runtime.profession.hits++;
        anchorResourceClock(runtime.profession.energy);
      }
    }
  });
  const rotation = [cast(990001, { impactDelayMs: 500 }), cast(990002)];
  const detailed = run(rotation, { profession });
  assert.equal(creates, 1);
  assert.equal(contexts.size, 1);
  assert.equal(queries.size, 1);
  // Distinct per-run capabilities observe one owned state, without sharing mutation authority.
  assert.equal([...contexts][0].profession, [...queries][0].profession);
  assert.equal([...contexts][0].queries, [...queries][0]);
  assert.equal('cursor' in [...contexts][0], false);
  assert.equal('queue' in [...contexts][0], false);
  assert.deepEqual(attempts, [1, 1.5]);
  assert.deepEqual(detailed.planningState.profession.accepted.at(-1), ['Spend', 1.5]);
  assert.equal(detailed.planningState.profession.energy.value, 0);
  assert.equal(detailed.planningState.profession.hits, 1);
  const score = run(rotation, { profession, output: 'score' });
  for (const key of Object.keys(score).filter((key) => key !== 'output'))
    assert.deepEqual(detailed[key], score[key], key);
  assert.equal(creates, 2);
  assert.equal(contexts.size, 2);
  assert.equal(queries.size, 2);
});

test('continuous recovery advances to its finite threshold without polling', () => {
  const attempts = [];
  const result = run([cast(990002)], {
    profession: fixture({
      initialize(runtime) {
        runtime.profession.energy.rate = 2;
        anchorResourceClock(runtime.profession.energy);
      },
      availability(runtime) {
        attempts.push(runtime.time);
        return runtime.profession.energy.value >= 3
          ? { ready: true }
          : { ready: false, retryAt: 1.5, reason: 'Recovering', code: 'resource' };
      }
    })
  });
  assert.deepEqual(attempts.slice(0, -Object.keys(result.planningState.availability).length), [0, 1.5]);
  assert.equal(result.rotationEndTime, 1.5);
  assert.equal(result.planningState.profession.energy.value, 3);
});

test('explicit overlaps use the previous player start and waits join independent lanes', () => {
  const result = run([cast(990003), cast(990004, { concurrentOffsetMs: 500 }), cast(990005), wait(100), cast(990002)]);
  assert.deepEqual(result.planningState.profession.accepted, [
    ['Long', 0],
    ['Instant', 0.5],
    ['Independent', 0.5],
    ['Spend', 2.1]
  ]);
  assert.equal(result.rotationEndTime, 2.1);
  assert.ok(result.events.some((event) => event.type === 'buff' && event.at === 0.5));
  const backdated = run([cast(990003), wait(1000), cast(990001, { concurrentOffsetMs: 100 })]);
  assert.match(backdated.warnings[0], /cannot backdate/);
});

// Reporting follows the activation identity after deferral without retiming the player's command reservations.
test('companion steps report executed animations instead of queued reservations', () => {
  const result = run([cast(990005), cast(990003), wait(2000)], {
    profession: fixture({
      prepareEvent(_runtime, event) {
        return event.type === 'action' && event.skillId === 990005 && event.actorType === 'player' ? null : event;
      },
      onCastStart(runtime, activation) {
        if (activation.skill.id !== 990005) return;
        const action = {
          type: 'action',
          source: 'companion',
          sourceId: 990005,
          skillId: 990005,
          actorType: 'summon',
          at: 0.4,
          endsAt: 1.2,
          fullEndsAt: 1.6,
          activationId: activation.id
        };
        runtime.effects.emit({ kind: 'packet', event: action });
        runtime.effects.emit({
          kind: 'packet',
          event: { ...action, at: 2, endsAt: 3, fullEndsAt: 3, activationId: 'automatic' }
        });
      }
    })
  });
  assert.deepEqual(result.warnings, []);
  const companion = result.steps.find((step) => step.skillId === 990005);
  assert.equal(companion.start, 400);
  assert.equal(companion.end, 1200);
  assert.equal(companion.fullCastMs, 1200);
  assert.equal(companion.interrupted, true);
  const player = result.steps.find((step) => step.skillId === 990003);
  assert.equal(player.start, 0);
  assert.equal(player.end, 2000);
});

test('default interruptions and authored overrides release the actual cast lane', () => {
  for (const [extra, end] of [
    [{}, 0.5],
    [{ interruptAfterMs: 250 }, 0.25],
    [{ interruptAfterMs: 2000 }, 1]
  ]) {
    const result = run([cast(990009, extra), cast(990002)]);
    assert.deepEqual(result.planningState.profession.completed[0], [end === 1 ? 'Restricted' : 'Spend', end]);
    assert.deepEqual(result.planningState.profession.accepted[1], ['Spend', end]);
  }
});

test('forbidden concurrent commands are rejected without reserving a cast lane', () => {
  const result = run([cast(990003), cast(990009, { concurrentOffsetMs: 500 }), cast(990002)]);
  assert.match(result.warnings[0], /cannot be cast concurrently/);
  assert.deepEqual(result.planningState.profession.accepted, [
    ['Long', 0],
    ['Spend', 2]
  ]);
  assert.equal(result.rotationEndTime, 2);
});

test('completion commits cooldowns and ammo before the next command at the same instant', () => {
  const completion = [];
  const profession = fixture({
    onCastCommit(runtime, activation) {
      completion.push({
        id: activation.skill.id,
        at: runtime.time,
        readyAt: runtime.cooldownController.readyAt(activation.skill.id),
        charges: runtime.cooldownController.readAmmo(activation.skill.id)?.charges
      });
    }
  });
  const casts = run([cast(990001), cast(990001)], { profession });
  assert.deepEqual(
    casts.steps.map((step) => step.start),
    [0, 2600]
  );
  assert.equal(completion[0].readyAt, 2.6);
  const ammo = run([cast(990007), cast(990007), cast(990007)], { profession });
  assert.deepEqual(
    ammo.steps.map((step) => step.start),
    [0, 400, 1600]
  );
  assert.equal(completion.find((entry) => entry.id === 990007).charges, 1);
});

test('ammo lockouts use persistent recharge modifiers without consuming another cast entitlement', () => {
  let claims = 0;
  const result = run([cast(990007), cast(990007)], {
    profession: fixture({
      rechargeWork: (_runtime, _skill, work) => work * 0.8,
      reserveRecharge(_runtime, _skill, work) {
        claims++;
        return work * 0.5;
      }
    })
  });
  // A charge's short lockout gets the persistent reduction; its full recharge also gets the one-shot entitlement.
  assert.equal(claims, 2);
  assert.equal(result.steps[1].start, 320);
  assert.equal(result.planningState.ammoBySkillId[990007].nextRechargeAt, 0.64);
});

test('a final completion can extend input recovery before the tail is fixed once', () => {
  const result = run([cast(990001)], {
    observation: { kind: 'tail', durationMs: 500 },
    profession: fixture({
      onCastCommit(runtime) {
        runtime.castController.lockInputUntil(runtime.time + 0.4);
        runtime.schedule('recover', 1.4);
      },
      tasks: {
        recover(runtime) {
          runtime.castController.lockInputUntil(1.8);
        }
      }
    })
  });
  assert.equal(result.rotationEndTime, 1.8);
  assert.equal(result.observationEndTime, 2.3);
});

test('conditions establish first damage on a shared pulse and respect the inclusive tail cutoff', () => {
  const detailed = run([cast(990006)], { observation: { kind: 'tail', durationMs: 1500 } });
  const score = run([cast(990006)], { observation: { kind: 'tail', durationMs: 1500 }, output: 'score' });
  assert.equal(detailed.rotationEndTime, 0);
  assert.equal(detailed.firstHitTime, 1);
  assert.equal(detailed.conditionDamage, 22);
  assert.equal(detailed.totalDamage, score.totalDamage);
  assert.equal(detailed.resolvedEvents.find((event) => event.type === 'condition').activeDuration, 1.5);
  assert.equal(run([cast(990006)], { observation: { kind: 'absolute', endTimeMs: 2000 } }).conditionDamage, 44);
  assert.equal(run([cast(990006)], { observation: { kind: 'absolute', endTimeMs: 1999.999 } }).conditionDamage, 22);
});

test('condition settlement and its reactions precede command readiness and same-time strikes', () => {
  const result = run([cast(990006), wait(1000), cast(990002), cast(990008)], {
    profession: fixture({
      reactions: {
        'condition-tick.resolved': (runtime) => {
          runtime.profession.energy.value++;
        }
      },
      availability(runtime, skill) {
        return skill.id !== 990002 || runtime.profession.energy.value > 0
          ? { ready: true }
          : { ready: false, retryAt: null, reason: 'No payout', code: 'resource' };
      }
    })
  });
  assert.deepEqual(result.warnings, []);
  assert.equal(result.firstHitTime, 1);
  assert.equal(result.planningState.profession.accepted.at(-1)[1], 1);
  assert.ok(result.strikeDamage > 0);
});

test('explicit and inherited combat starts gate early hostile effects even before a marker is reached', () => {
  const result = run([cast(990006), wait(1000), { type: 'combat-start' }, cast(990006), wait(1000)]);
  assert.equal(result.firstHitTime, 2);
  assert.equal(result.conditionDamage, 22);
  assert.equal(result.combatStartTime, 1);
  const inherited = run([cast(990008)], { combatStartTime: 5 });
  assert.equal(inherited.totalDamage, 0);
  assert.equal(inherited.combatStartTime, 5);
  assert.throws(() => run([{ type: 'combat-start' }], { combatStartTime: 0 }), /one owner/);
});

test('authored combat boundaries include simultaneous impacts before the marker command drains', () => {
  // The cursor can publish its next marker without predicting casts; packets strictly before it remain excluded.
  const profession = fixture({
    onCastStart(runtime, activation) {
      fixture().onCastStart(runtime, activation);
      for (const at of [0, 0.499999, 0.5, 1]) runtime.effects.emit({ kind: 'packet', event: packet(at) });
    },
    reactions: {
      'damage.resolved'(runtime) {
        runtime.profession.hits++;
      }
    },
    onCastCommit(runtime, activation) {
      fixture().onCastCommit(runtime, activation);
      runtime.castController.lockInputUntil(runtime.time + 0.2);
    }
  });
  for (const [marker, start, hits] of [
    [{ type: 'combat-start', concurrentOffsetMs: 0 }, 0, 4],
    [{ type: 'combat-start', concurrentOffsetMs: 500 }, 0.5, 2],
    [{ type: 'combat-start' }, 2, 0]
  ]) {
    const authored = run([cast(990003), marker], { profession });
    const inherited = run([cast(990003)], { profession, combatStartTime: start });
    assert.equal(authored.combatStartTime, start);
    assert.equal(authored.planningState.profession.hits, hits);
    assert.equal(authored.totalDamage, inherited.totalDamage);
    assert.equal(authored.rotationEndTime, 2.2);
  }

  const completed = run([cast(990001), { type: 'combat-start' }]);
  assert.equal(completed.firstHitTime, 1);
  assert.ok(completed.totalDamage > 0);
});

test('absolute horizons reject unfinished commands, lanes and recovery instead of truncating', () => {
  for (const rotation of [[cast(990003)], [wait(2000)], [cast(990005)]]) {
    assert.throws(
      () => run(rotation, { observation: { kind: 'absolute', endTimeMs: 1000 } }),
      /cannot precede rotation end/
    );
  }

  assert.throws(
    () =>
      run([cast(990004)], {
        observation: { kind: 'absolute', endTimeMs: 0 },
        profession: fixture({
          onCastCommit(runtime) {
            runtime.castController.lockInputUntil(1);
          }
        })
      }),
    /cannot precede rotation end/
  );
});

test('empty rotations finalize at zero and environment work remains bounded with an unknown end', () => {
  const sizes = [];
  const profession = fixture();
  // Inspect pending engine work through execution setup, outside the mechanic contract.
  const engineInitialize = (runtime) => sizes.push(runtime.queue.length);
  const ambient = { ...config, target: { ...config.target, conditions: { Bleeding: 2 } } };
  const empty = run([], { config: ambient, profession, engineInitialize });
  const tail = run([], {
    config: ambient,
    profession,
    engineInitialize,
    observation: { kind: 'tail', durationMs: 3000 }
  });
  assert.deepEqual(sizes, [2, 2]);
  assert.equal(empty.observationEndTime, 0);
  assert.equal(empty.environmentDamage, 0);
  assert.equal(tail.rotationEndTime, 0);
  assert.equal(tail.environmentDamage, 132);
  assert.equal(tail.totalDamage, 0);
});

test('lethal siblings finish but post-death hits grant nothing while self commands and cooldowns continue', () => {
  let owner;
  const profession = fixture({
    initialize(runtime) {
      owner = runtime;
      runtime.effects.emit({ kind: 'packet', event: packet(0.5, { activationId: 'lethal' }) });
      runtime.effects.emit({ kind: 'packet', event: packet(0.5, { activationId: 'lethal' }) });
      runtime.effects.emit({ kind: 'packet', event: packet(0.5, { activationId: 'other' }) });
      runtime.effects.emit({ kind: 'packet', event: packet(1.5, { activationId: 'later' }) });
    },
    reactions: {
      'damage.resolved': (runtime) => {
        runtime.profession.hits++;
      }
    }
  });
  const options = { profession, config: { ...config, target: { ...config.target, health: 10 } } };
  const result = run([wait(1000), cast(990001)], options);
  assert.equal(result.totalDamage, 20);
  assert.equal(result.deathTime, 0.5);
  assert.equal(result.combatEndTime, 0.5);
  assert.equal(result.planningState.profession.hits, 1);
  assert.equal(result.planningState.atSeconds, 2);
  assert.equal(result.planningState.cooldowns.Cast.readyAt, 3600);
  result.planningState.profession.hits = 999;
  assert.equal(owner.profession.hits, 1);
  assert.equal(run([wait(1000), cast(990001)], { ...options, output: 'score' }).totalDamage, 20);
});

test('off-target and late packets grant no resource; hard denial does not wait for a predicted gain', () => {
  const profession = fixture({
    reactions: {
      'damage.resolved': (runtime) => {
        runtime.profession.hits++;
      }
    },
    availability(_runtime, skill) {
      return skill.id === 990002
        ? { ready: false, retryAt: null, reason: 'No resource', code: 'resource' }
        : { ready: true };
    }
  });
  const result = run([cast(990001, { offTarget: true }), cast(990002), cast(990001, { impactDelayMs: 100 })], {
    profession
  });
  assert.equal(result.totalDamage, 0);
  assert.equal(result.planningState.profession.hits, 0);
  assert.match(result.warnings[0], /No resource/);
});

// Resource legality belongs to the earliest usable cast instant, after existing cooldown work and its intervening impacts.
test('cooldown waits settle accepted resource gains before a hard affordability decision', () => {
  const simulate = (impactAt) => {
    const attempts = [];
    const result = run([cast(990002)], {
      profession: fixture({
        initialize(runtime) {
          runtime.cooldownController.startRecharge(catalog.skillsById.get(990002), 0, 2);
          runtime.effects.emit({ kind: 'packet', event: packet(impactAt) });
        },
        reactions: { 'damage.resolved': (runtime) => runtime.resourceController.grant('energy', 1) },
        availability(runtime) {
          attempts.push(runtime.time);
          return runtime.resourceController.value('energy') > 0
            ? { ready: true }
            : { ready: false, retryAt: null, reason: 'No resource', code: 'resource' };
        }
      })
    });
    return { result, attempts };
  };

  const accepted = simulate(1);
  assert.deepEqual(accepted.attempts.slice(0, -Object.keys(accepted.result.planningState.availability).length), [1.6]);
  assert.deepEqual(accepted.result.warnings, []);
  assert.equal(accepted.result.steps[0].start, 1600);
  const late = simulate(3);
  assert.deepEqual(late.attempts.slice(0, -Object.keys(late.result.planningState.availability).length), [1.6]);
  assert.equal(late.result.steps[0].invalid, true);
  assert.equal(late.result.planningState.profession.energy.value, 0);
});

test('registered internal work detaches payloads and owner cancellation cannot cancel a later generation', () => {
  const seen = [];
  run([wait(1000)], {
    profession: fixture({
      initialize(runtime) {
        const payload = { amount: 1 };
        runtime.schedule('grant', 0.5, payload, { id: 'pool', generation: 0 });
        runtime.schedule('grant', 0.5, payload, { id: 'pool', generation: 1 });
        payload.amount = 99;
        runtime.cancelOwner({ id: 'pool', generation: 0 });
      },
      tasks: {
        grant(_runtime, data) {
          seen.push(data.amount);
        }
      }
    })
  });
  assert.deepEqual(seen, [1]);
  assert.throws(
    () =>
      run([], {
        profession: fixture({
          initialize(runtime) {
            runtime.schedule('missing', 0);
          }
        })
      }),
    /No task handler/
  );
});

test('cast tasks detach snapshots, retain catalog callbacks, and preserve priority and owner lifetimes', () => {
  // Deferred work survives cast completion without cloning executable declarations or sharing mutable payloads.
  const seen = [];
  let accepted;
  const taskCatalog = createCanonicalCatalog({
    generated: [
      {
        id: 990021,
        name: 'Callback skill',
        weapon: 'Sword',
        castTimeMs: 1000,
        effects: [{ type: 'strike', coefficient: 1, when: () => true }],
        tasks: [{ type: 'authored', atMs: 500, timingAnchor: 'castEnd' }]
      }
    ]
  });
  const inspect = (runtime, data) => {
    assert.equal(data.cast.skill, taskCatalog.skillsById.get(990021));
    assert.equal(data.cast.skill.effects[0].when(), true);
    assert.notEqual(data.cast, accepted);
    assert.notEqual(data.cast.command, accepted.command);
    assert.equal(data.cast.id, accepted.id);
    assert.equal(data.cast.command.impactDelayMs, 250);
    assert.equal(data.cast.fullEnd, 1);
    seen.push([data.label ?? data.trigger.type, runtime.time]);
  };

  const result = run([cast(990021, { impactDelayMs: 250 }), wait(1000)], {
    profession: fixture({
      catalog: taskCatalog,
      onCastStart(runtime, activation) {
        accepted = activation;
        const data = { label: 'early' };
        const owner = { id: 'cast-task', generation: 0 };
        runtime.scheduleForCast('inspect', 1.5, activation, data, owner, -10);
        runtime.scheduleForCast('inspect', 1.5, activation, { label: 'cancelled' }, { ...owner, generation: 1 });
        runtime.scheduleForCast('inspect', 1.5, activation, { label: 'late' }, undefined, 20);
        data.label = 'mutated';
        owner.generation = 2;
        runtime.cancelOwner({ id: 'cast-task', generation: 1 });
        assert.throws(() => runtime.scheduleForCast('missing', 1.5, activation), /No task handler/);
        assert.throws(() => runtime.scheduleForCast('inspect', 1.5, activation, { callback() {} }), /serializable/);
        assert.throws(
          () => runtime.scheduleForCast('inspect', 1.5, { ...activation, skill: { id: 'missing' } }),
          /Unknown cast task skill/
        );
      },
      tasks: { inspect, authored: inspect }
    })
  });
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(seen, [
    ['early', 1.5],
    ['authored', 1.5],
    ['late', 1.5]
  ]);
});

test('authored waits still block explicit instant overlaps, whose effects precede the following command', () => {
  const result = run([wait(1000), cast(990004, { concurrentOffsetMs: 0 }), cast(990002)], {
    profession: fixture({
      availability(runtime, skill) {
        if (skill.id === 990002) assert.equal(runtime.combat.boonApplications('might').length, 1);
        return { ready: true };
      }
    })
  });
  assert.deepEqual(result.planningState.profession.accepted, [
    ['Instant', 1],
    ['Spend', 1]
  ]);
});

test('derived effects inherit their cause and settle before an independent same-time packet', () => {
  const observed = [];
  run([wait(1000)], {
    profession: fixture({
      initialize(runtime) {
        runtime.effects.emit({ kind: 'packet', event: packet(1, { sourceId: 'first' }) });
        runtime.effects.emit({ kind: 'packet', event: packet(1, { sourceId: 'second' }) });
      },
      reactions: {
        'damage.resolved': (runtime, event) => {
          observed.push([event.sourceId, runtime.profession.energy.value]);
          if (event.sourceId === 'first')
            runtime.effects.emit({
              kind: 'packet',
              event: { type: 'fixture.grant', at: 1, source: 'fixture', sourceId: 'gain', actorType: 'player' }
            });
        }
      },
      eventHandlers: {
        'fixture.grant': (runtime) => {
          runtime.profession.energy.value = 1;
        }
      }
    })
  });
  assert.deepEqual(observed, [
    ['first', 0],
    ['second', 1]
  ]);
});

test('transient Alacrity grants leave the permanent cooldown rate unchanged', () => {
  const result = run([cast(990001), cast(990001)], {
    profession: fixture({
      initialize(runtime) {
        runtime.effects.emit({
          kind: 'packet',
          event: {
            type: 'buff',
            kind: 'alacrity',
            at: 2,
            duration: 10,
            stacks: 1,
            source: 'fixture',
            sourceId: 'alacrity',
            actorType: 'player'
          }
        });
      }
    })
  });
  assert.equal(result.steps[1].start, 2600);
});

test('same-time condition owners finish their lethal batch without granting new post-death reactions', () => {
  const result = run([cast(990006), wait(2000), cast(990004)], {
    config: { ...config, target: { ...config.target, health: 20, conditions: { Bleeding: 1 } } }
  });
  assert.equal(result.deathTime, 1);
  assert.equal(result.environmentDamage, 22);
  assert.equal(result.conditionDamage, 22);
  assert.equal(result.combatEndTime, 1);
  assert.equal(result.planningState.atSeconds, 2);
});

test('detailed and score outputs share all numerical boundaries across the phase-2 exit scenarios', () => {
  for (const [rotation, options] of [
    [[cast(990003), cast(990004, { concurrentOffsetMs: 500 }), cast(990005)], {}],
    [[cast(990006)], { observation: { kind: 'tail', durationMs: 2500 } }],
    [[cast(990008)], { observation: { kind: 'absolute', endTimeMs: 1000 } }],
    [[cast(990008), wait(1000), cast(990004)], { config: { ...config, target: { ...config.target, health: 1 } } }],
    [[wait(1000), { type: 'combat-start' }, cast(990001)], {}]
  ]) {
    const detailed = run(rotation, options);
    const score = run(rotation, { ...options, output: 'score' });
    for (const key of Object.keys(score).filter((key) => key !== 'output'))
      assert.deepEqual(detailed[key], score[key], key);
  }
});
