import { digest, random, shuffle } from './storage.mjs';

export const FEATURES = 256;
export const HIDDEN = 24;
export const FEATURE_SCHEMA = 1;

function hash(text) {
  let value = 2166136261;
  for (let index = 0; index < text.length; index++) value = Math.imul(value ^ text.charCodeAt(index), 16777619);
  return value >>> 0;
}

/** Signed feature hashing captures casts, local order, position, and supplied timing variants. */
export function features(rotation) {
  const dense = new Float64Array(FEATURES);
  const scale = 1 / Math.sqrt(Math.max(1, rotation.length));
  const add = (token, value = scale) => {
    const code = hash(token);
    dense[8 + (code % (FEATURES - 8))] += (code & 0x80000000 ? -1 : 1) * value;
  };

  const token = (command) => (command.type === 'wait' ? 'wait' : String(command.skillId));
  dense[0] = Math.log1p(rotation.length) / 8;
  for (let index = 0; index < rotation.length; index++) {
    const command = rotation[index];
    const key = token(command);
    add(`skill:${key}`);
    add(`quarter:${Math.min(3, Math.floor((index * 4) / rotation.length))}:${key}`);
    if (index > 0) add(`pair:${token(rotation[index - 1])}:${key}`);
    if (index > 1) add(`triple:${token(rotation[index - 2])}:${token(rotation[index - 1])}:${key}`);
    if (command.type === 'wait') dense[1] += command.durationMs / 120000;
    for (const [offset, field] of ['concurrentOffsetMs', 'interruptAfterMs', 'releaseAtCharges'].entries()) {
      if (command[field] != null) {
        dense[2 + offset] += scale;
        add(`${field}:${key}:${Math.round(command[field] / (field === 'releaseAtCharges' ? 1 : 25))}`);
      }
    }
  }

  return Array.from(dense, (value, index) => [index, value]).filter(([, value]) => value !== 0);
}

export function createNetwork(seed = 42) {
  const rng = random(seed);
  return {
    input: Array.from({ length: FEATURES * HIDDEN }, () => (rng() * 2 - 1) / Math.sqrt(FEATURES)),
    bias: Array(HIDDEN).fill(0),
    output: Array.from({ length: HIDDEN }, () => (rng() * 2 - 1) / Math.sqrt(HIDDEN)),
    intercept: 0
  };
}

export function forward(network, input) {
  const hidden = new Float64Array(HIDDEN);
  let prediction = network.intercept;
  for (let unit = 0; unit < HIDDEN; unit++) {
    let value = network.bias[unit];
    for (const [index, feature] of input) value += network.input[unit * FEATURES + index] * feature;
    hidden[unit] = Math.tanh(value);
    prediction += hidden[unit] * network.output[unit];
  }

  return { prediction, hidden };
}

/** One SGD update on half squared error; old output weights propagate the hidden gradient. */
export function trainSample(network, input, target, rate, clip = 3) {
  const { prediction, hidden } = forward(network, input);
  const error = Math.max(-clip, Math.min(clip, prediction - target));
  for (let unit = 0; unit < HIDDEN; unit++) {
    const delta = error * network.output[unit] * (1 - hidden[unit] ** 2);
    for (const [index, value] of input) network.input[unit * FEATURES + index] -= rate * delta * value;
    network.bias[unit] -= rate * delta;
    network.output[unit] -= rate * error * hidden[unit];
  }

  network.intercept -= rate * error;
}

function rmse(network, samples) {
  return Math.sqrt(
    samples.reduce((sum, sample) => sum + (forward(network, sample.input).prediction - sample.target) ** 2, 0) /
      samples.length
  );
}

/** Refit from all scored examples. Stable hash splits keep duplicate rotations out of both partitions. */
export function trainModel(records, scenario, { epochs = 60, seed = 42 } = {}) {
  const valid = [...new Map(records.filter((record) => record.valid).map((record) => [record.id, record])).values()];
  const training = valid.filter((record) => parseInt(record.id.slice(0, 8), 16) % 5 !== 0);
  const validation = valid.filter((record) => parseInt(record.id.slice(0, 8), 16) % 5 === 0);
  if (training.length < 16 || validation.length < 4)
    throw new Error(
      'Need at least 16 training and 4 validation rotations. Run collect with a larger evaluation budget.'
    );
  const mean = training.reduce((sum, record) => sum + record.score, 0) / training.length;
  const scale = Math.max(
    1,
    Math.sqrt(training.reduce((sum, record) => sum + (record.score - mean) ** 2, 0) / training.length)
  );
  const samples = (rows) =>
    rows.map((record) => ({ input: features(record.rotation), target: (record.score - mean) / scale }));
  const train = samples(training);
  const heldOut = samples(validation);
  const rng = random(seed);
  const network = createNetwork(seed);
  const baseline = Math.sqrt(heldOut.reduce((sum, sample) => sum + sample.target ** 2, 0) / heldOut.length);
  let best = structuredClone(network);
  let bestError = Infinity;
  let bestEpoch = 0;
  let completed = 0;
  for (let epoch = 0; epoch < epochs; epoch++) {
    const rate = 0.01 / Math.sqrt(1 + epoch / 10);
    for (const sample of shuffle(train, rng)) trainSample(network, sample.input, sample.target, rate);
    const error = rmse(network, heldOut);
    completed = epoch + 1;
    if (!Number.isFinite(error)) throw new Error('Training diverged. No model was saved.');
    if (error < bestError) {
      bestError = error;
      best = structuredClone(network);
      bestEpoch = completed;
    }

    if (completed - bestEpoch >= 15) break;
  }

  return {
    schema: 1,
    kind: 'rotation-damage-mlp',
    featureSchema: FEATURE_SCHEMA,
    scenario: scenario.id,
    features: FEATURES,
    hidden: HIDDEN,
    network: best,
    mean,
    scale,
    seed,
    dataset: digest(valid.map((record) => [record.id, record.score]).sort()),
    metrics: {
      trainingExamples: train.length,
      validationExamples: heldOut.length,
      epochs: completed,
      bestEpoch,
      trainingRmse: rmse(best, train) * scale,
      validationRmse: bestError * scale,
      meanPredictorRmse: baseline * scale,
      useful: bestError < baseline * 0.98
    }
  };
}

export function validateModel(model, scenario) {
  if (
    model.schema !== 1 ||
    model.kind !== 'rotation-damage-mlp' ||
    model.featureSchema !== FEATURE_SCHEMA ||
    model.scenario !== scenario.id ||
    model.features !== FEATURES ||
    model.hidden !== HIDDEN
  ) {
    throw new Error('Model is incompatible with this run or feature schema. Train a new model for this run.');
  }

  for (const [key, length] of [
    ['input', FEATURES * HIDDEN],
    ['bias', HIDDEN],
    ['output', HIDDEN]
  ]) {
    if (
      !Array.isArray(model.network?.[key]) ||
      model.network[key].length !== length ||
      !model.network[key].every(Number.isFinite)
    )
      throw new Error(`Corrupt model weights: ${key}`);
  }

  if (![model.network.intercept, model.mean, model.scale].every(Number.isFinite) || model.scale <= 0)
    throw new Error('Corrupt model normalization.');
  if (typeof model.metrics?.useful !== 'boolean') throw new Error('Model is missing validation metrics.');
  return model;
}

export const predict = (model, rotation) =>
  model.mean + model.scale * forward(model.network, features(rotation)).prediction;
