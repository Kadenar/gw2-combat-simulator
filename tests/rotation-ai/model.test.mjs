import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createNetwork,
  features,
  forward,
  trainSample,
  trainModel,
  predict,
  validateModel,
  trainingSplit,
  buildKey,
  FEATURES
} from '../../scripts/analysis/rotation-ai/model.mjs';
import { digest, random } from '../../scripts/analysis/rotation-ai/storage.mjs';
import { propose } from '../../scripts/analysis/rotation-ai/mutations.mjs';

test('backpropagation matches finite-difference gradients through both neural layers', () => {
  const network = createNetwork(7);
  const input = [
    [0, 0.5],
    [12, -0.3],
    [60, 0.8]
  ];
  const target = 0.7;
  const updated = structuredClone(network);
  const rate = 0.00001;
  trainSample(updated, input, target, rate, Infinity);
  for (const [field, index] of [
    ['input', 12],
    ['input', FEATURES + 60],
    ['bias', 1],
    ['output', 1],
    ['intercept', null]
  ]) {
    const loss = (shift) => {
      const changed = structuredClone(network);
      if (index == null) changed[field] += shift;
      else changed[field][index] += shift;
      return 0.5 * (forward(changed, input).prediction - target) ** 2;
    };

    const numerical = (loss(1e-6) - loss(-1e-6)) / 2e-6;
    const original = index == null ? network[field] : network[field][index];
    const next = index == null ? updated[field] : updated[field][index];
    assert.ok(Math.abs(numerical - (original - next) / rate) < 1e-6, `${field}:${index}`);
  }
});

test('features distinguish sequence order and timing; training learns held-out damage relationships', () => {
  const scenario = {
    id: 'test-scenario',
    profession: 'engineer',
    engine: 'test-engine',
    objective: 'fixed-window-player-damage',
    seconds: 1,
    config: { specialization: 'Core', selectedTraitIds: [1] },
    build: { specializations: [{ name: 'Tools', traits: '1-2-3' }] },
    prefix: []
  };
  const cast = (skillId) => ({ type: 'cast', skillId });
  assert.notDeepEqual(features([cast(1), cast(2), cast(3)], scenario), features([cast(3), cast(2), cast(1)], scenario));
  assert.notDeepEqual(features([cast(1)], scenario), features([{ ...cast(1), concurrentOffsetMs: 50 }], scenario));
  const rng = random(12);
  const records = [];
  for (let sample = 0; sample < 240; sample++) {
    const rotation = Array.from({ length: 2 + Math.floor(rng() * 20) }, () => cast(1 + Math.floor(rng() * 3)));
    const count = rotation.filter((command) => command.skillId === 1).length;
    records.push({ id: digest(rotation), rotation, valid: true, score: 1000 + 120 * count + 4 * count * count });
  }

  const model = trainModel(records, scenario, { epochs: 120, seed: 5 });
  assert.ok(model.metrics.validationRmse < model.metrics.meanPredictorRmse * 0.7, JSON.stringify(model.metrics));
  assert.equal(model.metrics.useful, true);
  const restored = validateModel(JSON.parse(JSON.stringify(model)), scenario);
  assert.equal(predict(restored, records[0].rotation, scenario), predict(model, records[0].rotation, scenario));
  assert.throws(() => validateModel(restored, { ...scenario, profession: 'mesmer' }), /incompatible/);
  restored.network.output[0] = null;
  assert.throws(() => validateModel(restored, scenario), /Corrupt/);
  assert.throws(() => trainModel(records.slice(0, 5), scenario), /at least/);
});

test('proposal generation resumes from a saved RNG state and keeps exploration active', () => {
  const rotation = [1, 2, 1, 3, 1].map((skillId) => ({ type: 'cast', skillId }));
  const record = { id: digest(rotation), valid: true, rotation, score: 100 };
  const seen = new Set([record.id]);
  const rng = random(19);
  propose([record], rotation, seen, rng, 12);
  const checkpoint = rng.state();
  const next = propose([record], rotation, seen, rng, 12);
  assert.deepEqual(propose([record], rotation, seen, random(checkpoint), 12), next);
  assert.equal(new Set(next.map(digest)).size, next.length);
  assert.ok(next.every((candidate) => candidate.every((command) => ['cast', 'wait'].includes(command.type))));
});

test('profession models condition on traits and specialize without binding to a scenario ID', () => {
  const base = {
    id: 'core',
    profession: 'engineer',
    engine: 'revision-a',
    objective: 'fixed-window-player-damage',
    seconds: 10,
    prefix: [],
    config: { specialization: 'Core', selectedTraitIds: [10, 20], stats: { power: 2000 } },
    build: { specializations: [{ name: 'Tools', traits: '1-1-1' }] }
  };
  const trait = { ...base, id: 'other-trait', config: { ...base.config, selectedTraitIds: [10, 30] } };
  const spec = { ...base, id: 'holosmith', config: { ...base.config, specialization: 'Holosmith', initialHeat: 20 } };
  const input = [{ type: 'cast', skillId: 5882 }];
  assert.notDeepEqual(features(input, base), features(input, trait));
  assert.notDeepEqual(features(input, base), features(input, spec));
  assert.deepEqual(features(input, base), features(input, { ...base, id: 'renamed-run', engine: 'not-an-input' }));
  const rng = random(15);
  const rows = [];
  for (const context of [base, trait, spec]) {
    for (let index = 0; index < 100; index++) {
      const rotation = Array.from({ length: 2 + Math.floor(rng() * 12) }, () => ({
        type: 'cast',
        skillId: 1 + Math.floor(rng() * 3)
      }));
      rows.push({ id: digest(rotation), rotation, valid: true, context, score: rotation.length * 1000 });
    }
  }

  const split = trainingSplit(rows, base);
  assert.equal(split.mode, 'held-out-builds');
  const trainingKeys = new Set(split.training.map((row) => row.buildKey));
  assert.ok(split.validation.every((row) => !trainingKeys.has(row.buildKey)));
  assert.equal(
    buildKey(base),
    buildKey({
      ...base,
      seconds: 120,
      prefix: input,
      config: { ...base.config, boons: { might: 25 }, target: { armor: 2000 } }
    })
  );
  const model = trainModel(rows, base, { epochs: 20 });
  assert.equal(model.metrics.builds, 3);
  assert.equal(model.metrics.validationMode, 'held-out-builds');
  for (const context of [
    base,
    trait,
    spec,
    { ...trait, id: 'unseen', config: { ...trait.config, selectedTraitIds: [40, 50] } }
  ]) {
    assert.equal(validateModel(model, context), model);
    assert.ok(Number.isFinite(predict(model, input, context)));
  }

  assert.notEqual(predict(model, input, base), predict(model, input, trait));
  assert.throws(() => validateModel(model, { ...base, engine: 'revision-b' }), /incompatible/);
  assert.throws(() => validateModel(model, { ...base, objective: 'kill-time' }), /incompatible/);
  assert.throws(
    () => trainModel([...rows, { ...rows[0], context: { ...base, profession: 'mesmer' } }], base),
    /share profession/
  );
  assert.throws(() => validateModel({ ...model, schema: 1 }, base), /incompatible/);
});

test('identical rotations under different windows retain context, use DPS targets, and stay in one split', () => {
  const base = {
    id: 'short',
    profession: 'engineer',
    engine: 'a',
    objective: 'fixed-window-player-damage',
    seconds: 10,
    config: {},
    build: {},
    prefix: []
  };
  const longer = { ...base, id: 'long', seconds: 20 };
  const rows = Array.from({ length: 80 }, (_, index) => {
    const rotation = [
      { type: 'cast', skillId: 1 },
      { type: 'wait', durationMs: index }
    ];
    return { id: digest(rotation), rotation, valid: true, context: base, score: 1000 + index * 100 };
  });
  const combined = [...rows, ...rows.map((row) => ({ ...row, context: longer, score: row.score * 2 }))];
  const split = trainingSplit(combined, base);
  assert.equal(split.valid.length, 160);
  assert.equal(split.mode, 'within-build');
  const trainIds = new Set(split.training.map((row) => row.id));
  assert.ok(split.validation.every((row) => !trainIds.has(row.id)));
  assert.equal(trainModel(combined, base, { epochs: 1 }).mean, trainModel(rows, base, { epochs: 1 }).mean);
});
