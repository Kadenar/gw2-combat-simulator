import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runOrdinaryOptimizer } from '../helpers/gear-optimizer.js';
import { loadProfessionAppAdapter } from '#gw2/app/profession/registry.js';
import { GearOptimizerRunner } from '#gw2/app/simulation/gear-optimizer/gear-optimizer-runner.js';
import { createGroupedOptimizer } from '#gw2/app/simulation/gear-optimizer/gear-optimizer-space.js';
import {
  createFastOptimizer,
  OPTIMIZER_SEARCH_BUDGET
} from '#gw2/app/simulation/gear-optimizer/gear-optimizer-fast.js';
import { RUNE_NAMES } from '#gw2/platform/equipment/gear/runes.js';
import { SIGIL_NAMES } from '#gw2/platform/equipment/sigils/data.js';
import { verifyOptimizerScore, applyOptimizerCandidate } from '#gw2/app/simulation/gear-optimizer/gear-optimizer.js';
import {
  groupOptimizerSpace,
  groupedEquipmentAt,
  optimizerEquivalenceKey
} from '#gw2/app/simulation/gear-optimizer/gear-optimizer-space.js';
import {
  captureGearOptimizerRequest,
  createOptimizerSpace,
  createOptimizerEvaluator,
  ordinaryEquipmentAt,
  optimizerSlots,
  optimizerWeaponSets,
  optimizerCardinality,
  optimizerScore
} from '#gw2/app/simulation/gear-optimizer/gear-optimizer.js';
import {
  retainOptimizerCandidate,
  compareOptimizerCandidates
} from '#gw2/app/simulation/gear-optimizer/gear-optimizer.js';
import {
  createOptimizerResultGroups,
  retainOptimizerGroup,
  optimizerEquipmentIdentity
} from '#gw2/app/simulation/gear-optimizer/gear-optimizer-results.js';

const adapter = await loadProfessionAppAdapter('warrior');

test('equipped identity ignores entry ordering, while display groups retain different gear with equal DPS', () => {
  const initial = request();
  const captured = request({
    prefixes: ["Berserker's", "Assassin's"],
    locks: optimizerSlots(initial.build, adapter).filter((slot) => slot !== 'Helm')
  });
  const job = createGroupedOptimizer(captured, adapter);
  const result = job.evaluateRange(0n, job.space.count);
  assert.equal(result.winners.length, 2);
  assert.equal(result.winners[0].score.dps, result.winners[1].score.dps);
  assert.equal(result.groups.all.length, 1);
  assert.notEqual(
    optimizerEquipmentIdentity(result.groups.all[0].equipment),
    optimizerEquipmentIdentity(captured.build)
  );
  const reordered = structuredClone(captured.build);
  reordered.gear = Object.fromEntries(Object.entries(reordered.gear).reverse());
  reordered.infusions = [
    { stat: 'Power', count: 8 },
    { stat: 'Precision', count: 0 },
    { stat: 'Power', count: 10 }
  ];
  assert.equal(
    optimizerEquipmentIdentity(reordered),
    optimizerEquipmentIdentity({ ...captured.build, infusions: [{ stat: 'Power', count: 18 }] })
  );
});

test('display groups retain weaker options outside the overall top twenty and cap distinct groups', () => {
  const base = runOrdinaryOptimizer(request(), adapter)[0];
  const winners = [];
  const groups = createOptimizerResultGroups();
  for (let index = 0; index < 25; index++) {
    const candidate = { ...base, key: `strong-${index}`, score: { ...base.score, dps: 100 - index } };
    retainOptimizerCandidate(winners, candidate);
    retainOptimizerGroup(groups.food, candidate, 'food', [0]);
  }

  const weaker = {
    ...base,
    key: 'weaker',
    equipment: { ...base.equipment, food: '' },
    score: { ...base.score, dps: 1 }
  };
  retainOptimizerCandidate(winners, weaker);
  retainOptimizerGroup(groups.food, weaker, 'food', [0]);
  assert.equal(winners.length, 20);
  assert.ok(!winners.includes(weaker));
  assert.deepEqual(
    groups.food.map(({ score }) => score.dps),
    [100, 1]
  );
  retainOptimizerGroup(groups.food, { ...weaker, score: { ...weaker.score, dps: 101 } }, 'food', [0]);
  assert.equal(groups.food[0].score.dps, 101);
  for (let index = 0; index < 101; index++)
    retainOptimizerGroup(
      groups.food,
      { ...base, equipment: { ...base.equipment, food: `option-${index}` }, score: { ...base.score, dps: index } },
      'food',
      [0]
    );
  assert.equal(groups.food.length, 100);
  assert.equal(groups.food.at(-1).score.dps, 3);
  const tied = [
    { ...base, equipment: { ...base.equipment, food: 'a' } },
    { ...base, equipment: { ...base.equipment, food: 'b' } }
  ];
  const ordered = [],
    reversed = [];
  for (const candidate of tied) retainOptimizerGroup(ordered, candidate, 'food', [0]);
  for (const candidate of [...tied].reverse()) retainOptimizerGroup(reversed, candidate, 'food', [0]);
  assert.deepEqual(reversed, ordered);
});

test('sigil display groups preserve permutations and usable sets; all combinations include other upgrades', () => {
  const base = runOrdinaryOptimizer(request(), adapter)[0];
  const swap = structuredClone(base);
  swap.equipment.weaponSigils[0].reverse();
  const alternate = structuredClone(base);
  alternate.equipment.weaponSigils[1].reverse();
  const food = { ...base, equipment: { ...base.equipment, food: '' } };
  const groups = createOptimizerResultGroups();
  for (const candidate of [base, swap, alternate, food]) {
    retainOptimizerGroup(groups.sigils, candidate, 'sigils', [0, 1]);
    retainOptimizerGroup(groups.all, candidate, 'all', [0, 1]);
  }

  assert.equal(groups.sigils.length, 3);
  assert.equal(groups.all.length, 4);
  const activeOnly = [];
  for (const candidate of [base, alternate]) retainOptimizerGroup(activeOnly, candidate, 'sigils', [0]);
  assert.equal(activeOnly.length, 1);
});

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
  assert.equal(full.space.ordinary.rawCount, 8n);
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
  verified = [];
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
    message = structuredClone(message);
    setImmediate(() => {
      if (this.terminated) return;
      let result;
      if (message.kind === 'init') {
        this.job =
          message.request.search === 'fast'
            ? createFastOptimizer(message.request, adapter)
            : createGroupedOptimizer(message.request, adapter);
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
      } else if (message.kind === 'refine') {
        this.job.refine(message.candidates);
        result = {
          kind: 'ready',
          count: this.job.space.count.toString(),
          rawCount: this.job.space.ordinary.rawCount.toString()
        };
      } else if (message.kind === 'chunk') {
        result = {
          kind: 'chunk',
          chunkId: message.chunkId,
          ...this.job.evaluateRange(BigInt(message.start), BigInt(message.end)),
          elapsedMs: 150
        };
      } else {
        assert.ok(message.candidates.length <= 20, 'verification messages must stay bounded');
        for (const candidate of message.candidates) {
          verifyOptimizerScore(candidate.score, optimizerScore(this.job.evaluator.evaluate(candidate.equipment)));
          this.verified.push(JSON.stringify(candidate.equipment));
        }

        result = { kind: 'verified' };
      }

      this.listeners.get('message')({ data: { ...result, requestId: message.requestId } });
    });
  }
}

test('completion verifies group winners beyond the overall top twenty using bounded batches', async () => {
  const captured = request({ rune: RUNE_NAMES, food: ['', request().build.food] });
  const workers = [];
  const searched = new Set();
  const state = await new Promise((resolve, reject) => {
    const runner = new GearOptimizerRunner(
      { buildRevision: captured.revision },
      () => {
        if (runner.state.status === 'failed') reject(new Error(runner.state.error));
        if (runner.state.status === 'complete') resolve(runner.state);
      },
      () => {
        const worker = new OptimizerTestWorker(searched);
        workers.push(worker);
        return worker;
      },
      2
    );
    runner.run(captured);
  });
  const expected = new Set(
    [...state.winners, ...Object.values(state.groups).flat()].map((candidate) => JSON.stringify(candidate.equipment))
  );
  const verified = workers.flatMap((worker) => worker.verified);
  assert.ok(expected.size > 20);
  assert.equal(verified.length, expected.size);
  assert.deepEqual(new Set(verified), expected);
});

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

test('bounded refinement stays deterministic across worker counts without rescoring equivalents', async () => {
  const captured = {
    ...request(
      { prefixes: ["Berserker's", "Assassin's", "Viper's"] },
      {
        rotation: adapter.toApplicationBuild({ rotation: ['Chop'] }).rotation,
        weapons: ['Axe', 'Axe']
      }
    ),
    search: 'fast'
  };
  const run = (count) =>
    new Promise((resolve, reject) => {
      const searchedKeys = new Set();
      const runner = new GearOptimizerRunner(
        { buildRevision: captured.revision },
        () => {
          if (runner.state.status === 'failed') reject(new Error(runner.state.error));
          if (runner.state.status === 'complete') {
            assert.equal(BigInt(searchedKeys.size), runner.state.simulations);
            assert.ok(runner.state.simulations > 256n, 'refinement must add new candidates after sampling');
            assert.ok(runner.state.simulations <= BigInt(OPTIMIZER_SEARCH_BUDGET));
            assert.ok(
              runner.state.represented < runner.state.rawCount,
              'bounded completion must not imply exhaustive coverage'
            );
            resolve(runner.state);
          }
        },
        () => new OptimizerTestWorker(searchedKeys),
        count
      );
      runner.run(captured);
    });
  const single = await run(1);
  const multiple = await run(4);
  assert.deepEqual(multiple.winners, single.winners);
  assert.deepEqual(multiple.groups, single.groups);
  assert.equal(multiple.simulations, single.simulations);
});

test('bounded search covers a small space and preserves the equipped candidate when allowed', () => {
  const captured = request({ food: ['', request().build.food] });
  const fast = createFastOptimizer(captured, adapter);
  const exact = createGroupedOptimizer(captured, adapter);
  const scores = (result) => result.winners.map(({ key, score }) => ({ key, score }));
  const result = fast.evaluateRange(0n, fast.space.count);
  assert.deepEqual(scores(result), scores(exact.evaluateRange(0n, exact.space.count)));
  fast.refine(result.winners);
  assert.equal(fast.space.count, 0n);
});

test('bounded search stops at its simulation budget even when promising neighbors remain', () => {
  const captured = request({
    prefixes: ["Berserker's", "Assassin's", "Viper's"],
    rune: RUNE_NAMES,
    sigils: [[SIGIL_NAMES, SIGIL_NAMES]]
  });
  const job = createFastOptimizer(captured, adapter);
  const winners = [];
  let checked = 0;
  while (job.space.count) {
    const result = job.evaluateRange(0n, job.space.count);
    checked += Number(result.simulations);
    assert.ok(checked <= OPTIMIZER_SEARCH_BUDGET);
    for (const winner of result.winners) retainOptimizerCandidate(winners, winner);
    job.refine(winners);
  }

  assert.equal(checked, OPTIMIZER_SEARCH_BUDGET);
  job.refine(winners);
  assert.equal(job.space.count, 0n);
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

test('successive result applies remain valid while unrelated edits still fail the revision guard', () => {
  const captured = request({ food: ['', request().build.food] });
  const [winner, another] = runOrdinaryOptimizer(captured, adapter);
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
  applyOptimizerCandidate(app, captured, another);
  assert.equal(app.build.food, another.equipment.food);
  assert.equal(app.build.rotation, rotation);
  assert.equal(changes, 2);
  assert.equal(captured.revision, app.buildRevision - 2);
  app.changed();
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

test('optimizer requirements validate numeric bounds and reject inverted toughness ranges', () => {
  for (const key of ['minToughness', 'maxToughness', 'minVitality', 'minBoonDuration', 'minQuicknessDuration']) {
    for (const value of [null, '', '10', NaN, Infinity, -1]) assert.throws(() => request({ [key]: value }), /Invalid/);
    assert.doesNotThrow(() => request({ [key]: 0 }));
  }

  for (const key of ['minBoonDuration', 'minQuicknessDuration'])
    assert.throws(() => request({ [key]: 100.1 }), /Invalid/);
  assert.throws(() => request({ minToughness: 1200, maxToughness: 1100 }), /must not exceed/);
});

test('requirements use inclusive finalized stats and reject before simulation config preparation', () => {
  const overrides = {
    rune: 'Firebrand',
    food: '',
    utility: '',
    infusions: [],
    weaponSigils: [
      ['Force', 'Accuracy'],
      ['Force', 'Accuracy']
    ]
  };
  const captured = request({}, overrides);
  const app = { build: captured.build, attributeWeaponSet: captured.build.startingWeaponSet };
  adapter.recalculate(app);
  const toughness = app.attributeData.attributes.Toughness.final;
  const vitality = app.attributeData.attributes.Vitality.final;
  const boon = app.attributeData.attributes['Boon Duration'].final;
  const quickness = boon + 30;
  const inclusive = request(
    {
      minToughness: toughness,
      maxToughness: toughness,
      minVitality: vitality,
      minBoonDuration: boon,
      minQuicknessDuration: quickness
    },
    overrides
  );
  assert.notEqual(createOptimizerEvaluator(inclusive, adapter).score(inclusive.build), null);
  assert.notEqual(createOptimizerEvaluator(captured, adapter).score(captured.build), null);
  const mustNotPrepareCombat = {
    ...adapter,
    simulationConfig() {
      assert.fail('Rejected gear must not prepare combat');
    }
  };
  for (const limits of [
    { minToughness: toughness + 1 },
    { maxToughness: toughness - 1 },
    { minVitality: vitality + 1 },
    { minBoonDuration: boon + 0.01 },
    { minQuicknessDuration: quickness + 0.01 }
  ]) {
    const rejected = request(limits, overrides);
    assert.equal(createOptimizerEvaluator(rejected, mustNotPrepareCombat).score(rejected.build), null);
  }
});

test('requirements check alternate weapon stats even when the starting set qualifies', () => {
  const base = request().build;
  const captured = request(
    { maxToughness: 1000 },
    {
      gear: Object.fromEntries(Object.keys(base.gear).map((slot) => [slot, "Berserker's"])),
      rune: '',
      food: '',
      utility: '',
      infusions: [],
      weapons: ['Axe', 'Axe'],
      alternateWeapons: ['Axe', 'Axe'],
      alternateWeaponPrefixes: ['Celestial', 'Celestial'],
      startingWeaponSet: 1
    }
  );
  assert.equal(createOptimizerEvaluator(captured, adapter).score(captured.build), null);
  const allowed = {
    ...captured,
    build: { ...captured.build, alternateWeaponPrefixes: ["Berserker's", "Berserker's"] }
  };
  assert.notEqual(createOptimizerEvaluator(allowed, adapter).score(allowed.build), null);
});

test('exact and fast searches discard failing runes while retaining coverage and display groups', () => {
  const captured = request(
    { rune: ['Firebrand', 'Fireworks'], minQuicknessDuration: 40 },
    {
      food: '',
      utility: '',
      infusions: [],
      weaponSigils: [
        ['Force', 'Accuracy'],
        ['Force', 'Accuracy']
      ]
    }
  );
  for (const create of [createGroupedOptimizer, createFastOptimizer]) {
    const job = create(captured, adapter);
    const result = job.evaluateRange(0n, job.space.count);
    assert.equal(result.represented, '2');
    assert.equal(result.simulations, '1');
    assert.deepEqual(
      result.winners.map(({ equipment }) => equipment.rune),
      ['Firebrand']
    );
    for (const candidates of Object.values(result.groups))
      assert.ok(candidates.every(({ equipment }) => equipment.rune === 'Firebrand'));
  }

  assert.deepEqual(
    runOrdinaryOptimizer(captured, adapter).map(({ equipment }) => equipment.rune),
    ['Firebrand']
  );
});

// A vitality floor must hold after swapping weapons, even if the starting set already meets it.
test('minimum vitality checks every usable weapon set', () => {
  const base = request().build;
  const initial = request(
    {},
    {
      gear: Object.fromEntries(
        Object.keys(base.gear).map((slot) => [slot, slot.includes('Weapon') ? 'Celestial' : "Berserker's"])
      ),
      weapons: ['Axe', 'Axe'],
      alternateWeapons: ['Axe', 'Axe'],
      alternateWeaponPrefixes: ["Berserker's", "Berserker's"],
      startingWeaponSet: 1,
      rune: '',
      food: '',
      utility: '',
      infusions: []
    }
  );
  const app = { build: initial.build, attributeWeaponSet: 2 };
  adapter.recalculate(app);
  const minVitality = app.attributeData.attributes.Vitality.final + 1;
  app.attributeWeaponSet = 1;
  adapter.recalculate(app);
  assert.ok(app.attributeData.attributes.Vitality.final >= minVitality);
  const captured = { ...initial, selections: { minVitality } };
  assert.equal(createOptimizerEvaluator(captured, adapter).score(captured.build), null);
  const allowed = { ...captured, build: { ...captured.build, alternateWeaponPrefixes: ['Celestial', 'Celestial'] } };
  assert.notEqual(createOptimizerEvaluator(allowed, adapter).score(allowed.build), null);
});

// Forced prefixes can be outside the shared pool and must survive grouping and fast-search refinement.
test('forced slots constrain ordinary, exact, and fast candidates including alternate weapons', () => {
  const overrides = { weapons: ['Axe', 'Axe'], alternateWeapons: ['Axe', 'Axe'] };
  const captured = request(
    {
      prefixes: ["Berserker's", "Assassin's"],
      forcedSlots: { Helm: 'Celestial', Weapon1: "Viper's", AlternateWeapon1: 'Celestial' },
      locks: optimizerSlots(request({}, overrides).build, adapter).filter(
        (slot) => !['Helm', 'Weapon1', 'AlternateWeapon1', 'Shoulders'].includes(slot)
      )
    },
    overrides
  );
  const ordinary = createOptimizerSpace(captured, adapter);
  assert.equal(ordinary.rawCount, 2n);
  assert.ok(Object.isFrozen(captured.selections.forcedSlots));
  const check = (equipment) => {
    assert.equal(equipment.gear.Helm, 'Celestial');
    assert.equal(equipment.gear.Weapon1, "Viper's");
    assert.equal(equipment.alternateWeaponPrefixes[0], 'Celestial');
    assert.ok(captured.selections.prefixes.includes(equipment.gear.Shoulders));
  };

  for (let ordinal = 0n; ordinal < ordinary.rawCount; ordinal++) check(ordinaryEquipmentAt(ordinary, ordinal));
  for (const create of [createGroupedOptimizer, createFastOptimizer]) {
    const job = create(
      create === createFastOptimizer ? { ...captured, selections: { ...captured.selections, locks: [] } } : captured,
      adapter
    );
    const result = job.evaluateRange(0n, job.space.count);
    assert.ok(result.winners.length);
    for (const candidate of [...result.winners, ...Object.values(result.groups).flat()]) check(candidate.equipment);
    if (job.refine) {
      job.refine(result.winners);
      assert.ok(job.space.count > 0n);
      for (const candidate of job.evaluateRange(0n, job.space.count).winners) check(candidate.equipment);
    }
  }
});

test('forced slots reject malformed values, unavailable slots, and conflicting locks', () => {
  for (const forcedSlots of [
    null,
    [],
    'Helm',
    { Unknown: 'Celestial' },
    { Helm: '' },
    { Helm: ['Celestial'] },
    { Helm: 'Unknown' }
  ])
    assert.throws(() => request({ forcedSlots }), /Invalid forced slot/);
  assert.throws(
    () => request({ forcedSlots: { Weapon2: 'Celestial' } }, { weapons: ['Greatsword', ''] }),
    /Invalid forced slot/
  );
  assert.throws(
    () => request({ forcedSlots: { AlternateWeapon1: 'Celestial' } }, { alternateWeapons: ['', ''] }),
    /Invalid forced slot/
  );
  const current = request().build.gear.Helm;
  assert.doesNotThrow(() => request({ locks: ['Helm'], forcedSlots: { Helm: current } }));
  assert.throws(
    () => request({ locks: ['Helm'], forcedSlots: { Helm: current === 'Celestial' ? "Berserker's" : 'Celestial' } }),
    /conflicts/
  );
});

test('workers finish exact and fast searches when every candidate fails requirements', { timeout: 10000 }, async () => {
  for (const search of ['exact', 'fast']) {
    const captured = { ...request({ maxToughness: 0 }), search };
    const state = await new Promise((resolve, reject) => {
      const runner = new GearOptimizerRunner(
        { buildRevision: captured.revision },
        () => {
          if (runner.state.status === 'failed') reject(new Error(runner.state.error));
          if (runner.state.status === 'complete') resolve(runner.state);
        },
        () => new OptimizerTestWorker()
      );
      runner.run(captured);
    });
    assert.equal(state.simulations, 0n);
    assert.equal(state.completed, state.count);
    assert.equal(state.represented, 1n);
    assert.deepEqual(state.winners, []);
  }
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

// Invalid commands must fail baseline validation; ordinary warnings still belong to usable scores.
test('optimizer rejects invalid rotation skills without suppressing other warnings', () => {
  const captured = request(
    {},
    { rotation: adapter.toApplicationBuild({ rotation: ['Chop', 'Chop'] }).rotation, weapons: ['Greatsword', ''] }
  );
  const result = createOptimizerEvaluator(captured, adapter).evaluate(captured.build);
  assert.ok(result.steps.some((step) => step.invalid));
  assert.throws(
    () => optimizerScore(result),
    (error) => {
      assert.match(error.message, /Fix invalid rotation skills.*Chop/);
      assert.equal(error.message.split('Chop').length - 1, 1);
      return true;
    }
  );
  const valid = request({}, { rotation: [], weapons: ['Greatsword', ''] });
  const detailed = createOptimizerEvaluator(valid, adapter).evaluate(valid.build);
  const warnings = ['A non-blocking simulation warning.'];
  assert.deepEqual(optimizerScore({ ...detailed, warnings }).warnings, warnings);
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
