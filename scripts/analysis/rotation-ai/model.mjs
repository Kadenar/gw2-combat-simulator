import { digest, random, shuffle } from './storage.mjs';

const ROTATION_FEATURES = 256;
export const FEATURES = 768;
export const HIDDEN = 32;
export const FEATURE_SCHEMA = 2;

function hash(text) {
  let value = 2166136261;
  for (let index = 0; index < text.length; index++) value = Math.imul(value ^ text.charCodeAt(index), 16777619);
  return value >>> 0;
}

/** Signed feature hashing captures casts, local order, position, and supplied timing variants. */
export function features(rotation, scenario) {
  const dense = new Float64Array(FEATURES);
  const scale = 1 / Math.sqrt(Math.max(1, rotation.length));
  const add = (token, value = scale) => {
    const code = hash(token);
    dense[8 + (code % (ROTATION_FEATURES - 8))] += (code & 0x80000000 ? -1 : 1) * value;
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

  if (!scenario?.config || !scenario?.build || !(scenario.seconds > 0))
    throw new Error('Build context is required for model features.');
  const contextAdd = (key, value = 1) => {
    const code = hash(key);
    dense[ROTATION_FEATURES + (code % (FEATURES - ROTATION_FEATURES))] += (code & 0x80000000 ? -1 : 1) * value;
  };

  const walk = (value, key) => {
    if (Array.isArray(value)) {
      const identities = /selectedTraitIds|selectedMorphSkillIds/.test(key);
      value.forEach((item, index) => {
        if (identities) contextAdd(`${key}=${item}`);
        else walk(item, `${key}[${index}]`);
      });
    } else if (value && typeof value === 'object') {
      for (const name of Object.keys(value).sort()) walk(value[name], `${key}.${name}`);
    } else if (typeof value === 'number' && Number.isFinite(value)) {
      contextAdd(`${key}:present`, 0.25);
      contextAdd(key, (Math.sign(value) * Math.log1p(Math.abs(value))) / 10);
    } else if (typeof value === 'string' || typeof value === 'boolean') contextAdd(`${key}=${value}`);
  };

  const config = { ...scenario.config };
  delete config.randomness;
  delete config.attributeProvenance;
  walk(config, 'config');
  // These identities complement final attributes and resolved trait IDs with equipment and traitline choices.
  walk(buildDescriptor(scenario), 'build');
  walk(scenario.prefix || [], 'precast');
  walk(scenario.seconds, 'seconds');
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

/** Exclude encounter/rotation settings so one build cannot leak across a build-level split through another duration. */
export function buildDescriptor(scenario) {
  const keys = [
    'gear',
    'weapons',
    'alternateWeapons',
    'alternateWeaponPrefixes',
    'weaponSigils',
    'rune',
    'relic',
    'food',
    'utility',
    'infusions',
    'jadeBotCore',
    'specializations',
    'selectedSkills',
    'selectedMorphSkillIds'
  ];
  return {
    profession: scenario.profession,
    ...Object.fromEntries(
      keys.filter((key) => scenario.build[key] !== undefined).map((key) => [key, scenario.build[key]])
    ),
    specialization: scenario.config.specialization,
    selectedTraitIds: [...(scenario.config.selectedTraitIds || [])].sort((a, b) => String(a).localeCompare(String(b)))
  };
}

export const buildKey = (scenario) => digest(buildDescriptor(scenario));

function grouped(rows) {
  const groups = new Map();
  for (const row of rows) {
    const key = row.buildKey;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }

  return [...groups.values()];
}

function balancedMean(rows, value) {
  const groups = grouped(rows);
  return (
    groups.reduce((sum, group) => sum + group.reduce((total, row) => total + value(row), 0) / group.length, 0) /
    groups.length
  );
}

function rmse(network, samples) {
  return Math.sqrt(balancedMean(samples, (sample) => (forward(network, sample.input).prediction - sample.target) ** 2));
}

export function trainingSplit(records, scenario) {
  const unique = new Map();
  for (const record of records.filter((row) => row.valid)) {
    const context = record.context || scenario;
    if (
      context.profession !== scenario.profession ||
      context.engine !== scenario.engine ||
      context.objective !== scenario.objective
    )
      throw new Error('Training examples must share profession, engine version, and objective.');
    if (
      !(context.seconds > 0) ||
      !Number.isFinite(context.seconds) ||
      !Number.isFinite(record.score) ||
      record.score < 0
    )
      throw new Error('Invalid training score or duration.');
    unique.set(`${context.id}:${record.id}`, { ...record, context, buildKey: buildKey(context) });
  }

  const valid = [...unique.values()].sort((a, b) => `${a.context.id}:${a.id}`.localeCompare(`${b.context.id}:${b.id}`));
  const keys = [...new Set(valid.map((row) => row.buildKey))].sort();
  let training, validation;
  if (keys.length > 1) {
    let heldOut = keys.filter((key) => parseInt(key.slice(0, 8), 16) % 5 === 0);
    if (!heldOut.length) heldOut = [keys.at(-1)];
    if (heldOut.length === keys.length) heldOut = heldOut.slice(1);
    const validationKeys = new Set(heldOut);
    training = valid.filter((row) => !validationKeys.has(row.buildKey));
    validation = valid.filter((row) => validationKeys.has(row.buildKey));
  } else {
    // Keep the same rotation in the same partition even if scored under different windows/assumptions.
    training = valid.filter((row) => parseInt(row.id.slice(0, 8), 16) % 5 !== 0);
    validation = valid.filter((row) => parseInt(row.id.slice(0, 8), 16) % 5 === 0);
  }

  return { valid, training, validation, mode: keys.length > 1 ? 'held-out-builds' : 'within-build', keys };
}

/** A profession model learns DPS (not raw totals) with equal build weighting and whole-build validation. */
export function trainModel(records, scenario, { epochs = 60, seed = 42 } = {}) {
  const { valid, training, validation, mode, keys } = trainingSplit(records, scenario);
  if (training.length < 16 || validation.length < 4)
    throw new Error(
      'Need at least 16 training and 4 validation rotations. Collect more examples in the registered builds.'
    );
  const mean = balancedMean(training, (record) => record.score / record.context.seconds);
  const scale = Math.max(
    1,
    Math.sqrt(balancedMean(training, (record) => (record.score / record.context.seconds - mean) ** 2))
  );
  const samples = (rows) =>
    rows.map((record) => ({
      buildKey: record.buildKey,
      input: features(record.rotation, record.context),
      target: (record.score / record.context.seconds - mean) / scale
    }));
  const train = samples(training);
  const heldOut = samples(validation);
  const groups = grouped(train);
  const perBuild = Math.min(256, Math.max(...groups.map((group) => group.length)));
  const rng = random(seed);
  const network = createNetwork(seed);
  const baseline = Math.sqrt(balancedMean(heldOut, (sample) => sample.target ** 2));
  let best = structuredClone(network);
  let bestError = Infinity;
  let bestEpoch = 0;
  let completed = 0;
  for (let epoch = 0; epoch < epochs; epoch++) {
    const rate = 0.01 / Math.sqrt(1 + epoch / 10);
    const batch = groups.flatMap((group) => {
      const ordered = shuffle(group, rng);
      return Array.from({ length: perBuild }, (_, index) => ordered[index % ordered.length]);
    });
    for (const sample of shuffle(batch, rng)) trainSample(network, sample.input, sample.target, rate);
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
    schema: 2,
    kind: 'profession-rotation-mlp',
    featureSchema: FEATURE_SCHEMA,
    profession: scenario.profession,
    engine: scenario.engine,
    objective: scenario.objective,
    target: 'fixed-window-dps',
    features: FEATURES,
    hidden: HIDDEN,
    network: best,
    mean,
    scale,
    seed,
    dataset: digest(valid.map((record) => [record.context.id, record.id, record.score])),
    metrics: {
      trainingExamples: train.length,
      validationExamples: heldOut.length,
      builds: keys.length,
      scenarios: new Set(valid.map((row) => row.context.id)).size,
      validationMode: mode,
      trainingBuilds: [...new Set(training.map((row) => row.buildKey))],
      validationBuilds: [...new Set(validation.map((row) => row.buildKey))],
      validationByBuild: grouped(heldOut).map((group) => ({
        build: group[0].buildKey,
        examples: group.length,
        rmse: rmse(best, group) * scale
      })),
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
    model.schema !== 2 ||
    model.kind !== 'profession-rotation-mlp' ||
    model.featureSchema !== FEATURE_SCHEMA ||
    model.profession !== scenario.profession ||
    model.engine !== scenario.engine ||
    model.objective !== scenario.objective ||
    model.target !== 'fixed-window-dps' ||
    model.features !== FEATURES ||
    model.hidden !== HIDDEN
  ) {
    throw new Error(
      'Model is incompatible with this profession, engine, objective, or feature schema. Retrain the shared profession model.'
    );
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

export function predict(model, rotation, scenario) {
  return (
    scenario.seconds * (model.mean + model.scale * forward(model.network, features(rotation, scenario)).prediction)
  );
}
