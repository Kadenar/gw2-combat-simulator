import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createNetwork,
  features,
  forward,
  trainSample,
  trainModel,
  predict,
  validateModel
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
    ['input', 256 + 60],
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
  const cast = (skillId) => ({ type: 'cast', skillId });
  assert.notDeepEqual(features([cast(1), cast(2), cast(3)]), features([cast(3), cast(2), cast(1)]));
  assert.notDeepEqual(features([cast(1)]), features([{ ...cast(1), concurrentOffsetMs: 50 }]));
  const rng = random(12);
  const records = [];
  for (let sample = 0; sample < 240; sample++) {
    const rotation = Array.from({ length: 2 + Math.floor(rng() * 20) }, () => cast(1 + Math.floor(rng() * 3)));
    const count = rotation.filter((command) => command.skillId === 1).length;
    records.push({ id: digest(rotation), rotation, valid: true, score: 1000 + 120 * count + 4 * count * count });
  }

  const scenario = { id: 'test-scenario' };
  const model = trainModel(records, scenario, { epochs: 120, seed: 5 });
  assert.ok(model.metrics.validationRmse < model.metrics.meanPredictorRmse * 0.7, JSON.stringify(model.metrics));
  assert.equal(model.metrics.useful, true);
  const restored = validateModel(JSON.parse(JSON.stringify(model)), scenario);
  assert.equal(predict(restored, records[0].rotation), predict(model, records[0].rotation));
  assert.throws(() => validateModel(restored, { id: 'different-build' }), /incompatible/);
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
