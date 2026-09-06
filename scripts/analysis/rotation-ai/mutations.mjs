import { digest, shuffle } from './storage.mjs';
import { MAX_COMMANDS, validateBody } from './engine.mjs';
import { predict } from './model.mjs';

export function actionVocabulary(records, additional = []) {
  const actions = new Map();
  for (const command of [...records.flatMap((record) => record.rotation), ...additional]) {
    validateBody([command]);
    // Timing is a relationship to neighbors; copied casts start with their canonical identity/charge choice.
    const action =
      command.type === 'wait'
        ? { type: 'wait', durationMs: Math.min(1000, command.durationMs) }
        : {
            type: 'cast',
            skillId: command.skillId,
            ...(command.releaseAtCharges == null ? {} : { releaseAtCharges: command.releaseAtCharges })
          };
    actions.set(digest(action), action);
  }

  for (const durationMs of [50, 100, 250, 500]) {
    const action = { type: 'wait', durationMs };
    actions.set(digest(action), action);
  }

  return [...actions.values()];
}

/** Larger block edits and crossovers can escape single-cast local optima. Legality stays engine-owned. */
export function mutate(parent, donor, actions, rng) {
  const result = structuredClone(parent);
  const pick = (length) => Math.floor(rng() * length);
  const index = pick(result.length);
  const operation = pick(7);
  if (operation === 0 && result.length > 1) result.splice(index, 1);
  else if (operation === 1) result.splice(index, 0, structuredClone(actions[pick(actions.length)]));
  else if (operation === 2) result[index] = structuredClone(actions[pick(actions.length)]);
  else if (operation === 3) {
    const count = Math.min(result.length - index, 1 + pick(4));
    const block = result.splice(index, count);
    result.splice(pick(result.length + 1), 0, ...block);
  } else if (operation === 4 && donor.length) {
    const start = pick(donor.length);
    const block = structuredClone(donor.slice(start, start + 1 + pick(6)));
    result.splice(index, 1 + pick(Math.min(6, result.length - index)), ...block);
  } else if (operation === 5) {
    const command = result[index];
    const field =
      command.type === 'wait'
        ? 'durationMs'
        : command.concurrentOffsetMs != null
          ? 'concurrentOffsetMs'
          : command.interruptAfterMs != null
            ? 'interruptAfterMs'
            : null;
    if (field) command[field] = Math.max(0, command[field] + (rng() < 0.5 ? -1 : 1) * [10, 25, 50, 100][pick(4)]);
    else result.splice(index, 0, structuredClone(actions[pick(actions.length)]));
  } else {
    const other = pick(result.length);
    [result[index], result[other]] = [result[other], result[index]];
  }

  return result.slice(0, MAX_COMMANDS - 1);
}

export function propose(records, actions, seen, rng, count, model = null, exploration = 0.3) {
  const valid = records.filter((record) => record.valid).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  if (!valid.length) throw new Error('No valid seed rotations. Ingest a warning-free rotation first.');
  const elites = valid.slice(0, 24);
  const proposals = new Map();
  const target = model?.metrics.useful ? count * 4 : count;
  for (let attempt = 0; attempt < target * 50 && proposals.size < target; attempt++) {
    const parents = rng() < 0.75 ? elites : valid;
    const parent = parents[Math.floor(rng() * parents.length)].rotation;
    const donor = valid[Math.floor(rng() * valid.length)].rotation;
    let rotation = mutate(parent, donor, actions, rng);
    if (rng() < 0.2) rotation = mutate(rotation, donor, actions, rng);
    const id = digest(rotation);
    if (!seen.has(id) && !proposals.has(id)) proposals.set(id, rotation);
  }

  const pool = [...proposals.values()];
  if (!model?.metrics.useful) return pool.slice(0, count);
  // Reserve independent random candidates so the predictor cannot permanently hide a useful region.
  const randomCount = Math.ceil(count * exploration);
  const selected = shuffle(pool, rng).slice(0, randomCount);
  const selectedIds = new Set(selected.map(digest));
  const ranked = pool
    .filter((rotation) => !selectedIds.has(digest(rotation)))
    .map((rotation) => ({ rotation, score: predict(model, rotation) }))
    .sort((a, b) => b.score - a.score);
  return [...selected, ...ranked.slice(0, count - selected.length).map((item) => item.rotation)];
}
