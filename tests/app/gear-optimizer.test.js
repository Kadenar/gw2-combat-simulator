import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadProfessionAppAdapter } from '#gw2/app/profession/registry.js';
import { GearOptimizerRunner } from '#gw2/app/simulation/gear-optimizer-runner.js';
import { createGroupedOptimizer } from '#gw2/app/simulation/gear-optimizer-space.js';
import { verifyOptimizerScore, applyOptimizerCandidate } from '#gw2/app/simulation/gear-optimizer.js';
import {
  groupOptimizerSpace,
  groupedEquipmentAt,
  optimizerEquivalenceKey,
  estimateOptimizerCount
} from '#gw2/app/simulation/gear-optimizer-space.js';
import {
  captureGearOptimizerRequest,
  createOptimizerSpace,
  createOptimizerEvaluator,
  ordinaryEquipmentAt,
  optimizerSlots,
  optimizerWeaponSets,
  optimizerCardinality,
  optimizerScore,
  runOrdinaryOptimizer
} from '#gw2/app/simulation/gear-optimizer.js';
import { retainOptimizerCandidate, compareOptimizerCandidates } from '#gw2/app/simulation/gear-optimizer.js';

const adapter = await loadProfessionAppAdapter('warrior');

test('equal integer vectors merge before evaluation without losing coverage or representatives', () => {
  const initial = request();
  const captured = request(
    {
      prefixes: ["Berserker's", "Assassin's"],
      locks: optimizerSlots(initial.build, adapter).filter((slot) => !['Shoulders', 'Leggins', 'Chest'].includes(slot))
    },
    { rotation: adapter.toApplicationBuild({ rotation: ['Chop'] }).rotation, weapons: ['Axe', 'Axe'] }
  );
  const full = createGroupedOptimizer(captured, adapter);
  const cached = full.evaluateRange(0n, full.space.count);
  assert.equal(full.space.count, 7n);
  assert.equal(estimateOptimizerCount(full.space.ordinary, adapter), 8n);
  assert.equal(cached.represented, '8');
  assert.equal(cached.simulations, '7');
  const ordinary = runOrdinaryOptimizer({ ...captured, limit: 20 }, adapter);
  const distinct = [];
  for (const candidate of ordinary)
    retainOptimizerCandidate(distinct, {
      ...candidate,
      key: optimizerEquivalenceKey(candidate.equipment, full.space.ordinary, adapter)
    });
  assert.deepEqual(cached.winners, distinct.sort(compareOptimizerCandidates));
});

test('preparation fails at its memory budget instead of returning a truncated exact search', () => {
  const initial = request();
  const captured = request({
    prefixes: ["Berserker's", "Assassin's"],
    locks: optimizerSlots(initial.build, adapter).filter((slot) => slot !== 'Helm')
  });
  const ordinary = createOptimizerSpace(captured, adapter);
  assert.equal(groupOptimizerSpace(ordinary, adapter, 2).count, 2n);
  assert.throws(() => groupOptimizerSpace(ordinary, adapter, 1), /preparation memory limit/);
  assert.throws(() => groupOptimizerSpace(ordinary, adapter, 0), /Invalid optimizer preparation limit/);
});

test('local top twenty merging deduplicates before truncation and uses unrounded score ties', () => {
  const base = runOrdinaryOptimizer(request(), adapter)[0];
  const candidates = Array.from({ length: 25 }, (_, index) => ({
    ...base,
    key: String(index).padStart(2, '0'),
    score: { ...base.score, dps: index / 1000 },
    represented: '1'
  }));
  const left = [],
    right = [],
    merged = [];
  for (const candidate of [...candidates, ...candidates].reverse())
    retainOptimizerCandidate(left, structuredClone(candidate));
  for (const candidate of candidates) retainOptimizerCandidate(right, structuredClone(candidate));
  for (const candidate of [...right, ...left]) retainOptimizerCandidate(merged, structuredClone(candidate));
  assert.deepEqual(
    merged.map(({ key }) => key),
    candidates
      .slice(5)
      .reverse()
      .map(({ key }) => key)
  );
});

test('a worker crash and stale messages cannot publish a complete exhaustive result', () => {
  const captured = request();
  const worker = new OptimizerTestWorker();
  const runner = new GearOptimizerRunner(
    { buildRevision: captured.revision },
    () => {},
    () => worker
  );
  runner.run(captured);
  worker.listeners.get('message')({ data: { kind: 'verified', requestId: -1 } });
  assert.equal(runner.state.status, 'preparing');
  worker.listeners.get('error')({ message: 'Worker crashed' });
  assert.equal(runner.state.status, 'failed');
  assert.match(runner.state.error, /crashed/);
  assert.equal(worker.terminated, true);
});

// Real enumeration/evaluation behind a tiny transport fake isolates partitioning and message ownership.
class OptimizerTestWorker {
  listeners = new Map();
  terminated = false;
  job = null;
  constructor(searchedKeys = new Set()) {
    this.searchedKeys = searchedKeys;
  }
  addEventListener(kind, listener) {
    this.listeners.set(kind, listener);
  }
  terminate() {
    this.terminated = true;
  }
  postMessage(message) {
    setImmediate(() => {
      if (this.terminated) return;
      let result;
      if (message.kind === 'init') {
        this.job = createGroupedOptimizer(message.request, adapter);
        const score = this.job.evaluator.score;
        this.job.evaluator.score = (equipment) => {
          const key = optimizerEquivalenceKey(equipment, this.job.space.ordinary, adapter);
          assert.ok(
            !this.searchedKeys.has(key),
            'a unique combination must never be simulated by two ranges or workers'
          );
          this.searchedKeys.add(key);
          return score(equipment);
        };

        result = {
          kind: 'ready',
          count: this.job.space.count.toString(),
          rawCount: this.job.space.ordinary.rawCount.toString(),
          baseline: optimizerScore(this.job.evaluator.evaluate(ordinaryEquipmentAt(this.job.space.ordinary, 0n)))
        };
      } else if (message.kind === 'chunk') {
        result = {
          kind: 'chunk',
          chunkId: message.chunkId,
          ...this.job.evaluateRange(BigInt(message.start), BigInt(message.end)),
          elapsedMs: 150
        };
      } else {
        for (const candidate of message.candidates)
          verifyOptimizerScore(candidate.score, optimizerScore(this.job.evaluator.evaluate(candidate.equipment)));
        result = { kind: 'verified' };
      }

      this.listeners.get('message')({ data: { ...result, requestId: message.requestId } });
    });
  }
}

test('selectable worker pools evaluate each unique candidate once and retain identical winners', async () => {
  const initial = request();
  const captured = request({
    prefixes: ["Berserker's", "Assassin's"],
    food: ['', initial.build.food],
    utility: ['', initial.build.utility],
    locks: optimizerSlots(initial.build, adapter).filter((slot) => !['Shoulders', 'Leggins', 'Chest'].includes(slot))
  });
  const run = (count) =>
    new Promise((resolve, reject) => {
      const searchedKeys = new Set();
      let spawned = 0;
      const runner = new GearOptimizerRunner(
        { buildRevision: captured.revision },
        () => {
          if (runner.state.status === 'complete') {
            assert.equal(BigInt(searchedKeys.size), runner.state.count);
            assert.equal(spawned, Math.min(count, Number(runner.state.count)));
            resolve(runner.state);
          }

          if (runner.state.status === 'failed') reject(new Error(runner.state.error));
        },
        () => {
          spawned++;
          return new OptimizerTestWorker(searchedKeys);
        },
        2
      );
      runner.run(captured, count);
    });
  const single = await run(1);
  for (const count of [2, 4]) {
    const multiple = await run(count);
    assert.deepEqual(single.winners, multiple.winners);
    assert.equal(multiple.represented, 32n);
    assert.equal(multiple.count, 28n);
    assert.equal(multiple.simulations, 28n);
    assert.equal(multiple.completed, multiple.count);
  }
});

test('invalid worker counts cannot replace an active optimizer job', () => {
  const captured = request();
  const worker = new OptimizerTestWorker();
  const runner = new GearOptimizerRunner(
    { buildRevision: captured.revision },
    () => {},
    () => worker
  );
  runner.run(captured, 1);
  for (const count of [0, -1, 1.5, NaN, 5]) assert.throws(() => runner.run(captured, count), /workers/);
  assert.equal(worker.terminated, false);
  assert.equal(runner.state.status, 'preparing');
  runner.cancel();
});

test('cancel, stale revisions, constructor and postMessage failures never report complete', async () => {
  const captured = request();
  const app = { buildRevision: captured.revision };
  const worker = new OptimizerTestWorker();
  const runner = new GearOptimizerRunner(
    app,
    () => {},
    () => worker
  );
  runner.run(captured);
  runner.cancel();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(worker.terminated, true);
  assert.equal(runner.state.status, 'canceled');
  for (const factory of [
    () => {
      throw new Error('Constructor failed');
    },
    () => ({
      addEventListener() {},
      terminate() {},
      postMessage() {
        throw new Error('Post failed');
      }
    })
  ]) {
    const failed = new GearOptimizerRunner(app, () => {}, factory);
    failed.run(captured);
    assert.equal(failed.state.status, 'failed');
  }

  app.buildRevision++;
  runner.run(captured);
  assert.equal(runner.state.status, 'failed');
  assert.match(runner.state.error, /stale/);
});

test('verification mismatches fail and Apply mutates equipment once with a revision guard', () => {
  const captured = request();
  const winner = runOrdinaryOptimizer(captured, adapter)[0];
  assert.throws(
    () => verifyOptimizerScore(winner.score, { ...winner.score, dps: winner.score.dps + 1 }),
    /correctness failure/
  );
  let changes = 0;
  const app = {
    build: structuredClone(captured.build),
    contentId: captured.contentId,
    patchId: captured.patchId,
    buildRevision: captured.revision,
    changed() {
      changes++;
      this.buildRevision++;
    }
  };
  const rotation = app.build.rotation;
  applyOptimizerCandidate(app, captured, winner);
  assert.equal(app.build.rotation, rotation);
  assert.equal(changes, 1);
  assert.throws(() => applyOptimizerCandidate(app, captured, winner), /stale/);
});

test('explicit None upgrades validate and survive normal build persistence', () => {
  const captured = request({ rune: [''], relic: [''], food: [''], utility: [''] });
  const equipment = ordinaryEquipmentAt(createOptimizerSpace(captured, adapter), 0n);
  const build = { ...captured.build, ...equipment };
  assert.equal(adapter.profession.validateBuild(build).valid, true);
  const restored = adapter.toApplicationBuild(adapter.profession.migrateBuild(build));
  for (const key of ['rune', 'relic', 'food', 'utility']) assert.equal(restored[key], '');
});

test('unique totals preserve every ordinary vector and multiplicity with unequal slots', () => {
  const initial = request();
  const captured = request({
    prefixes: ["Berserker's", "Assassin's"],
    locks: optimizerSlots(initial.build, adapter).filter((slot) => !['Shoulders', 'Gloves', 'Helm'].includes(slot))
  });
  const ordinary = createOptimizerSpace(captured, adapter);
  const grouped = groupOptimizerSpace(ordinary, adapter);
  assert.equal(ordinary.rawCount, 8n);
  assert.equal(grouped.count, 6n);
  const collect = (count, at) => {
    const vectors = new Map();
    for (let i = 0n; i < count; i++) {
      const { equipment, represented } = at(i);
      const key = optimizerEquivalenceKey(equipment, ordinary, adapter);
      vectors.set(key, (vectors.get(key) || 0n) + represented);
    }

    return vectors;
  };

  assert.deepEqual(
    collect(grouped.count, (i) => groupedEquipmentAt(grouped, i)),
    collect(ordinary.rawCount, (i) => ({ equipment: ordinaryEquipmentAt(ordinary, i), represented: 1n }))
  );
  const evaluator = createOptimizerEvaluator(captured, adapter);
  const bruteScores = new Map();
  for (let i = 0n; i < ordinary.rawCount; i++) {
    const equipment = ordinaryEquipmentAt(ordinary, i);
    bruteScores.set(
      optimizerEquivalenceKey(equipment, ordinary, adapter),
      optimizerScore(evaluator.evaluate(equipment))
    );
  }

  for (let i = 0n; i < grouped.count; i++) {
    const { equipment } = groupedEquipmentAt(grouped, i);
    assert.deepEqual(
      optimizerScore(evaluator.evaluate(equipment)),
      bruteScores.get(optimizerEquivalenceKey(equipment, ordinary, adapter))
    );
  }
});

// Tiny ordinary builds isolate enumeration contracts without saved-rotation regressions.
function request(selections = {}, overrides = {}) {
  const build = adapter.toApplicationBuild(adapter.profession.createBuildDefaults());
  Object.assign(build, overrides);
  const app = {
    contentId: adapter.id,
    adapter,
    profession: adapter.profession,
    build,
    buildRevision: 7,
    patchId: 'current'
  };
  return captureGearOptimizerRequest(app, selections);
}

test('snapshot is immutable; empty selections retain current equipment', () => {
  const captured = request();
  const space = createOptimizerSpace(captured, adapter);
  assert.equal(space.rawCount, 1n);
  assert.ok(Object.isFrozen(captured.build.gear));
  assert.equal(ordinaryEquipmentAt(space, 0n).gear.Helm, captured.build.gear.Helm);
  assert.throws(() => ordinaryEquipmentAt(space, 1n), /outside search/);
});

test('mixed prefixes, locks outside candidates, independent sigils, and infusion endpoints', () => {
  const initial = request();
  const locks = optimizerSlots(initial.build, adapter).filter((slot) => !['Helm', 'Shoulders'].includes(slot));
  const captured = request({
    prefixes: ["Assassin's", "Berserker's", "Assassin's"],
    locks,
    infusionStats: ['Power', 'Precision'],
    infusionCount: 2,
    sigils: [
      [
        ['Force', 'Accuracy'],
        ['Accuracy', 'Force']
      ]
    ]
  });
  const space = createOptimizerSpace(captured, adapter);
  assert.equal(space.rawCount, 24n);
  const assignments = Array.from({ length: 24 }, (_, index) => ordinaryEquipmentAt(space, BigInt(index)));
  assert.equal(new Set(assignments.map((equipment) => JSON.stringify(equipment))).size, 24);
  assert.ok(assignments.some((equipment) => equipment.gear.Helm !== equipment.gear.Shoulders));
  assert.ok(
    assignments.every((equipment) => equipment.infusions.reduce((sum, infusion) => sum + infusion.count, 0) === 2)
  );
  assert.ok(
    assignments.some((equipment) => equipment.infusions.length === 1 && equipment.infusions[0].stat === 'Precision')
  );
  const locked = request({ prefixes: ["Viper's"], locks: optimizerSlots(initial.build, adapter) });
  assert.equal(ordinaryEquipmentAt(createOptimizerSpace(locked, adapter), 0n).gear.Helm, initial.build.gear.Helm);
});

test('two-handed and alternate-set prefixes use actual slots and explicit fallback values', () => {
  const captured = request(
    {},
    { weapons: ['Greatsword', ''], alternateWeapons: ['Axe', 'Axe'], alternateWeaponPrefixes: undefined }
  );
  const slots = optimizerSlots(captured.build, adapter);
  assert.ok(!slots.includes('Weapon2'));
  assert.ok(slots.includes('AlternateWeapon2'));
  assert.deepEqual(captured.build.alternateWeaponPrefixes, [captured.build.gear.Weapon1, captured.build.gear.Weapon2]);
});

// Exhaustive tiny products check that stat merging preserves both weapon sets, upgrade identities, and exact ties.
test('unique ordinals preserve independent weapon budgets, upgrades, and canonical representatives', () => {
  const initial = request({}, { weapons: ['Greatsword', ''], alternateWeapons: ['Axe', 'Axe'] });
  const captured = request(
    {
      prefixes: ["Berserker's", "Assassin's", "Viper's"],
      locks: optimizerSlots(initial.build, adapter).filter(
        (slot) => !['Helm', 'Weapon1', 'AlternateWeapon1', 'AlternateWeapon2'].includes(slot)
      ),
      food: ['', initial.build.food],
      sigils: [
        [
          ['Force', 'Accuracy'],
          ['Accuracy', 'Force']
        ]
      ],
      infusionStats: ['Power', 'Precision'],
      infusionCount: 2
    },
    initial.build
  );
  const ordinary = createOptimizerSpace(captured, adapter);
  const grouped = groupOptimizerSpace(ordinary, adapter);
  const expected = new Map();
  for (let i = 0n; i < ordinary.rawCount; i++) {
    const equipment = ordinaryEquipmentAt(ordinary, i);
    const key = optimizerEquivalenceKey(equipment, ordinary, adapter);
    const encoded = JSON.stringify(equipment);
    const previous = expected.get(key);
    expected.set(key, {
      represented: (previous?.represented || 0n) + 1n,
      encoded: previous && previous.encoded < encoded ? previous.encoded : encoded
    });
  }

  assert.equal(grouped.count, BigInt(expected.size));
  const actual = new Map();
  for (let i = 0n; i < grouped.count; i++) {
    const { equipment, represented } = groupedEquipmentAt(grouped, i);
    const key = optimizerEquivalenceKey(equipment, ordinary, adapter);
    assert.ok(!actual.has(key), 'every dispatched ordinal must have a distinct combat key');
    actual.set(key, { represented, encoded: JSON.stringify(equipment) });
  }

  assert.deepEqual(actual, expected);
});

test('only usable weapon sets contribute search dimensions and equivalence', async () => {
  const both = request({}, { weapons: ['Axe', 'Axe'], alternateWeapons: ['Greatsword', ''], startingWeaponSet: 2 });
  assert.deepEqual(optimizerWeaponSets(both.build, adapter), [0, 1]);
  assert.ok(optimizerSlots(both.build, adapter).includes('AlternateWeapon1'));
  const empty = request({}, { alternateWeapons: ['', ''] });
  assert.deepEqual(optimizerWeaponSets(empty.build, adapter), [0]);
  const single = createOptimizerSpace(empty, adapter);
  const equipment = ordinaryEquipmentAt(single, 0n);
  const hidden = structuredClone(equipment);
  hidden.alternateWeaponPrefixes = ["Viper's", "Viper's"];
  hidden.weaponSigils[1] = ['Force', 'Impact'];
  assert.equal(optimizerEquivalenceKey(equipment, single, adapter), optimizerEquivalenceKey(hidden, single, adapter));

  const engineer = await loadProfessionAppAdapter('engineer');
  const build = engineer.toApplicationBuild(engineer.profession.createBuildDefaults());
  assert.ok(build.alternateWeapons[0]);
  assert.deepEqual(optimizerWeaponSets(build, engineer), [0]);
  assert.ok(!optimizerSlots(build, engineer).includes('AlternateWeapon1'));
  // A build starting on set 2 must keep its actual active equipment even when combat swapping is unavailable.
  build.startingWeaponSet = 2;
  assert.deepEqual(optimizerWeaponSets(build, engineer), [1]);
  assert.ok(optimizerSlots(build, engineer).includes('AlternateWeapon1'));
  assert.ok(!optimizerSlots(build, engineer).includes('Weapon1'));
  const bladesworn = request(
    {},
    {
      specializations: [...both.build.specializations.slice(0, 2), { name: 'Bladesworn', traits: '1-1-1' }],
      selectedSkills: {
        Heal: 'Healing Signet',
        Utility1: 'Signet of Might',
        Utility2: 'Signet of Fury',
        Utility3: 'Throw Bolas',
        Elite: 'Signet of Rage'
      },
      startingWeaponSet: 2
    }
  );
  assert.deepEqual(optimizerWeaponSets(bladesworn.build, adapter), [1]);
});

test('a rotation swapping to a valid second set retains its independent equipment and damage', () => {
  const initial = request({}, { weapons: ['Axe', 'Axe'], alternateWeapons: ['Axe', 'Axe'] });
  const captured = request(
    {
      prefixes: ["Berserker's", "Viper's"],
      locks: optimizerSlots(initial.build, adapter).filter((slot) => slot !== 'AlternateWeapon1')
    },
    {
      ...initial.build,
      rotation: adapter.toApplicationBuild({ rotation: ['Chop', 'Swap Weapons', 'Chop'] }).rotation
    }
  );
  const job = createGroupedOptimizer(captured, adapter);
  const result = job.evaluateRange(0n, job.space.count);
  assert.equal(result.winners.length, 2);
  assert.notEqual(result.winners[0].score.dps, result.winners[1].score.dps);
  for (const candidate of result.winners) {
    assert.equal(candidate.equipment.gear.Weapon1, captured.build.gear.Weapon1);
    const detailed = job.evaluator.evaluate(candidate.equipment);
    assert.equal(detailed.endState.activeWeaponSet, 2);
    assert.deepEqual(candidate.score, optimizerScore(detailed));
  }
});

// Compare every tiny ordinary assignment, including duplicates, against the merged result's actual detailed score.
test('gear, rune and infusion totals merge with exact score and representative parity', () => {
  const initial = request();
  for (const selections of [
    { rune: ['Berserker', 'Elementalist'], infusionStats: ['Power', 'Condition Damage'], infusionCount: 15 },
    {
      prefixes: ["Berserker's", "Assassin's"],
      locks: optimizerSlots(initial.build, adapter).filter((slot) => slot !== 'Chest'),
      infusionStats: ['Power', 'Precision'],
      infusionCount: 8
    }
  ]) {
    const captured = request(selections, {
      rotation: adapter.toApplicationBuild({ rotation: ['Chop'] }).rotation,
      weapons: ['Axe', 'Axe'],
      utility: 'Superior Sharpening Stone'
    });
    const job = createGroupedOptimizer(captured, adapter);
    const expected = new Map();
    for (let i = 0n; i < job.space.ordinary.rawCount; i++) {
      const equipment = ordinaryEquipmentAt(job.space.ordinary, i);
      const key = optimizerEquivalenceKey(equipment, job.space.ordinary, adapter);
      const score = optimizerScore(job.evaluator.evaluate(equipment));
      const prior = expected.get(key);
      if (prior) assert.deepEqual(score, prior.score);
      expected.set(key, {
        key,
        score,
        equipment: prior && JSON.stringify(prior.equipment) < JSON.stringify(equipment) ? prior.equipment : equipment,
        represented: String(BigInt(prior?.represented || '0') + 1n)
      });
    }

    assert.equal(job.space.count, job.space.ordinary.rawCount - 1n);
    const result = job.evaluateRange(0n, job.space.count);
    assert.equal(result.represented, job.space.ordinary.rawCount.toString());
    assert.deepEqual(result.winners, [...expected.values()].sort(compareOptimizerCandidates).slice(0, captured.limit));
  }
});

test('equal rune primaries do not erase differing duration bonuses', () => {
  const captured = request({ rune: ['Fire', 'Strength'] });
  const job = createGroupedOptimizer(captured, adapter);
  assert.equal(job.space.count, 2n);
  const first = groupedEquipmentAt(job.space, 0n).equipment;
  const second = groupedEquipmentAt(job.space, 1n).equipment;
  assert.notEqual(
    optimizerEquivalenceKey(first, job.space.ordinary, adapter),
    optimizerEquivalenceKey(second, job.space.ordinary, adapter)
  );
});

test('reject invalid inputs without reducing search; preserve count precision and zero infusions', () => {
  assert.throws(() => request({ prefixes: ['Unknown'] }), /Unknown/);
  assert.throws(() => request({ food: ['Unknown'], locks: ['food'] }), /Unknown/);
  assert.throws(() => request({ infusionCount: 1.5 }), /integer/);
  assert.throws(() => request({ sigils: [[['Force'], ['Force']]] }), /legal pair/);
  assert.throws(() => request({ sigils: [[], [['Force']]] }, { alternateWeapons: ['', ''] }), /not available/);
  assert.equal(optimizerCardinality([3n ** 40n, 19n]), 230995643722081647219n);
  const space = createOptimizerSpace(request({ infusionCount: 0, infusionStats: ['Power', 'Precision'] }), adapter);
  assert.equal(space.rawCount, 1n);
  assert.deepEqual(ordinaryEquipmentAt(space, 0n).infusions, []);
  assert.throws(() => optimizerScore({ dps: NaN }), /non-finite/);
});

test('ordinary evaluator preserves deterministic configuration and isolates consecutive builds', () => {
  const captured = request(
    {},
    { rotation: adapter.toApplicationBuild({ rotation: ['Chop'] }).rotation, weapons: ['Axe', 'Axe'] }
  );
  const evaluator = createOptimizerEvaluator(captured, adapter);
  const equipment = ordinaryEquipmentAt(createOptimizerSpace(captured, adapter), 0n);
  const original = optimizerScore(evaluator.evaluate(equipment));
  const other = structuredClone(equipment);
  other.gear.Helm = "Viper's";
  evaluator.evaluate(other);
  assert.deepEqual(optimizerScore(evaluator.evaluate(equipment)), original);
  assert.equal(runOrdinaryOptimizer(captured, adapter)[0].score.dps, original.dps);
  assert.ok(original.totalDamage > 0);
});
