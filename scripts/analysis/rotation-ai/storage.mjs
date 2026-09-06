import { createHash, randomUUID } from 'node:crypto';
import { readFile, writeFile, rename, mkdir, readdir, open, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
export const SCHEMA = 1;

export function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .filter((key) => value[key] !== undefined)
        .map((key) => [key, canonical(value[key])])
    );
  }

  return value;
}

export const digest = (value) =>
  createHash('sha256')
    .update(JSON.stringify(canonical(value)))
    .digest('hex');
export const readJson = async (file) => JSON.parse(await readFile(file, 'utf8'));

/** Same-directory rename leaves either the previous complete checkpoint or the new one. */
export async function writeJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`);
  try {
    await rename(temporary, file);
  } catch (error) {
    await unlink(temporary).catch(() => {});
    throw error;
  }
}

/** Fingerprint the code actually executed, including config/build preparation. */
export async function engineFingerprint() {
  const hash = createHash('sha256');
  async function visit(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name, 'en'));
    for (const entry of entries) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(file);
      else if (entry.name.endsWith('.js')) {
        hash.update(path.relative(ROOT, file).split(path.sep).join('/'));
        hash.update(await readFile(file));
      }
    }
  }

  await visit(path.join(ROOT, 'dist/js'));
  hash.update(await readFile(new URL('./engine.mjs', import.meta.url)));
  return hash.digest('hex');
}

export async function loadRun(directory) {
  const scenario = await readJson(path.join(directory, 'scenario.json'));
  if (scenario.schema !== SCHEMA) throw new Error('Unsupported run schema. Initialize a new run.');
  const { id, ...payload } = scenario;
  if (id !== digest(payload))
    throw new Error('scenario.json has changed. Initialize a new run instead of mixing experiments.');
  if (scenario.engine !== (await engineFingerprint())) {
    throw new Error(
      'Simulator code changed. Initialize a new run and ingest your rotations again to regenerate scores.'
    );
  }

  return scenario;
}

/** One writer per run; never remove another process's lock automatically. */
export async function lockRun(directory, operation) {
  await mkdir(directory, { recursive: true });
  const file = path.join(directory, 'run.lock');
  let handle;
  try {
    handle = await open(file, 'wx');
  } catch (error) {
    if (error.code === 'EEXIST')
      throw new Error(
        `Run is locked: ${file}. Stop its other command first. After a crash, remove only this lock file once no process is using the run.`,
        { cause: error }
      );
    throw error;
  }

  try {
    await handle.writeFile(JSON.stringify({ pid: process.pid, operation, started: new Date().toISOString() }));
  } catch (error) {
    await handle.close();
    await unlink(file);
    throw error;
  }

  return async () => {
    await handle.close();
    await unlink(file);
  };
}

export async function readRecords(directory, scenario) {
  let text;
  try {
    text = await readFile(path.join(directory, 'dataset.jsonl'), 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }

  const unique = new Map();
  for (const [index, line] of text.split('\n').entries()) {
    if (!line.trim()) continue;
    let record;
    try {
      record = JSON.parse(line);
    } catch {
      throw new Error(
        `dataset.jsonl line ${index + 1} is incomplete or invalid. Back up the file and repair that line before continuing.`
      );
    }

    if (record.scenario !== scenario.id || record.id !== digest(record.rotation) || typeof record.valid !== 'boolean') {
      throw new Error(`dataset.jsonl line ${index + 1} belongs to a different run or is corrupt.`);
    }

    if (record.valid && (!Number.isFinite(record.score) || record.score < 0))
      throw new Error(`Invalid score on dataset line ${index + 1}.`);
    unique.set(record.id, record);
  }

  return [...unique.values()];
}

export async function appendRecords(directory, scenario, records) {
  if (!records.length) return;
  await writeFile(
    path.join(directory, 'dataset.jsonl'),
    records.map((record) => JSON.stringify({ ...record, scenario: scenario.id })).join('\n') + '\n',
    { flag: 'a' }
  );
}

/** A serializable PRNG makes interrupted searches reproducible, independent of worker timing. */
export function random(initial = 42) {
  let state = initial >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };

  next.state = () => state;
  return next;
}

export function shuffle(items, rng) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const other = Math.floor(rng() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }

  return result;
}
