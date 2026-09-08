import path from 'node:path';
import { readdir } from 'node:fs/promises';
import { digest, readJson, writeJson, readRecords } from './storage.mjs';

export function compatibleContext(context, scenario) {
  if (
    context.profession !== scenario.profession ||
    context.engine !== scenario.engine ||
    context.objective !== scenario.objective
  ) {
    throw new Error(
      'Profession training data must share profession, engine version, and objective. Use a separate models directory after engine changes.'
    );
  }
}

export async function initializeBank(directory, scenario) {
  const expected = {
    schema: 1,
    profession: scenario.profession,
    engine: scenario.engine,
    objective: scenario.objective
  };
  let metadata;
  try {
    metadata = await readJson(path.join(directory, 'bank.json'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  if (metadata && digest(metadata) !== digest(expected))
    throw new Error(
      'Profession model bank is incompatible. Use --models with a new directory and re-ingest compatible runs.'
    );
  if (!metadata) await writeJson(path.join(directory, 'bank.json'), expected);
}

/** Store portable context + scored examples, not references to mutable run files. Caller holds the bank lock. */
export async function contributeRun(directory, run, scenario, records = null) {
  const file = path.join(directory, 'datasets', `${scenario.id}.json`);
  let previous = null;
  try {
    previous = await readJson(file);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  if (previous && digest(previous.context) !== digest(scenario)) throw new Error('Corrupt profession dataset context.');
  const unique = new Map((previous?.records || []).map((record) => [record.id, record]));
  for (const record of (records || (await readRecords(run, scenario))).filter((row) => row.valid)) {
    const existing = unique.get(record.id);
    if (existing && existing.score !== record.score)
      throw new Error('Conflicting simulator scores for an identical scenario and rotation.');
    unique.set(record.id, { id: record.id, rotation: record.rotation, valid: true, score: record.score });
  }

  await writeJson(file, { schema: 1, context: scenario, records: [...unique.values()] });
}

export async function trainingCorpus(directory, scenario) {
  const folder = path.join(directory, 'datasets');
  const files = (await readdir(folder)).filter((name) => name.endsWith('.json')).sort();
  const examples = [];
  for (const file of files) {
    const dataset = await readJson(path.join(folder, file));
    const { id, ...payload } = dataset.context;
    if (dataset.schema !== 1 || id !== digest(payload) || file !== `${id}.json`)
      throw new Error('Corrupt profession dataset.');
    compatibleContext(dataset.context, scenario);
    for (const record of dataset.records) {
      if (!record.valid || record.id !== digest(record.rotation) || !Number.isFinite(record.score) || record.score < 0)
        throw new Error('Corrupt profession training example.');
      examples.push({ ...record, context: dataset.context });
    }
  }

  return examples;
}
