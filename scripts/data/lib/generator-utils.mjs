import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { format, resolveConfig } from 'prettier';

/** Emit local asset specifiers as static URLs so Vite can bundle generated skill artwork. */
export function serializeWithLocalImages(value, space) {
  return JSON.stringify(value, null, space).replace(
    /"@images\/[a-zA-Z0-9/_.-]+"/g,
    (asset) => `new URL(${asset}, import.meta.url).href`
  );
}

/** Converts display names into valid identifiers, including names that start with a digit. */
export function constantName(value) {
  const normalized = String(value || '')
    .normalize('NFKD')
    .replace(/['\u2019]/g, '')
    .replace(/[^a-z0-9]+/gi, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();
  return /^\d/.test(normalized) ? `SKILL_${normalized}` : normalized;
}

/** Read the current identity bindings on each refresh, including updates made earlier in this process. */
export async function committedIdentities(target) {
  const source = await readFile(target, 'utf8');
  const url = pathToFileURL(target);
  url.searchParams.set('revision', createHash('sha256').update(source).digest('hex'));
  return import(url.href);
}

/** Require an explicit baseline so a misspelled or removed export cannot silently disable identity anchoring. */
function requireIdentityMap(value, name) {
  if (value == null || typeof value !== 'object' || Array.isArray(value))
    throw new TypeError(`${name}: required committed identity map is missing or invalid`);

  return value;
}

/** Allocate new names by ID, reserving actual authored/committed keys rather than API display-name order. */
export function stableEntries(entries, committed, fixed = [], authoredKeys = {}) {
  requireIdentityMap(committed, 'stableEntries');
  const keyById = new Map(Object.entries(committed).map(([key, id]) => [id, key]));
  const fixedIds = new Set(fixed.map(({ id }) => id));
  const records = new Map();
  for (const [name, value] of entries) {
    const id = Number(value);

    if (fixedIds.has(id)) continue;

    const key = authoredKeys[id] ?? keyById.get(id);
    const base = constantName(name);

    if (!key && !base) continue;

    const record = { id, name: String(name ?? ''), base, key };
    const previous = records.get(id);

    // Prefer a usable display name, then lexical order, when independent sources disagree on the same ID.
    if (
      !previous ||
      (!previous.base && base) ||
      (Boolean(previous.base) === Boolean(base) && record.name < previous.name)
    )
      records.set(id, record);
  }

  const reserved = new Set([...Object.keys(committed), ...fixed.map(({ key }) => key), ...Object.values(authoredKeys)]);
  const groups = new Map();
  for (const record of records.values()) {
    if (record.key) continue;

    const group = groups.get(record.base) ?? [];
    group.push(record);
    groups.set(record.base, group);
  }

  for (const [base, group] of groups) {
    group.sort((left, right) => left.id - right.id);
    for (const [index, record] of group.entries())
      record.key = index === 0 && !reserved.has(base) ? base : `${base}_ID_${record.id}`;
  }

  return [...fixed, ...[...records.values()].map(({ key, id, name }) => ({ key, id, name }))];
}

/** Flatten the API's minor and tiered major traits into the common identity input. */
export function traitIdentities(specializations) {
  return specializations
    .flatMap(({ minorTraits, majorTraits }) => [...minorTraits, ...majorTraits.flat()])
    .map(({ name, id }) => [name, id]);
}

/** List every collision, invalid key, removal, and retargeted binding in one named map. */
function identityProblems(name, entries, committed) {
  requireIdentityMap(committed, name);
  const errors = [];
  const keys = new Map();
  for (const { key, id } of entries) {
    if (!/^[A-Z_][A-Z0-9_]*$/.test(key)) errors.push(`invalid key ${key}`);

    if (keys.has(key)) errors.push(`duplicate key ${key}`);

    if (!Number.isSafeInteger(id)) errors.push(`invalid ID ${key}: ${id}`);

    keys.set(key, id);
  }

  for (const [key, id] of Object.entries(committed)) {
    if (!keys.has(key)) errors.push(`missing committed key ${key}: ${id}`);
    else if (keys.get(key) !== id) errors.push(`retargeted key ${key}: ${id} -> ${keys.get(key)}`);
  }

  return errors.length ? `${name}: ${errors.join('; ')}` : '';
}

/** Validate every named map before rendering any, so one run reports the problems of all maps together. */
export function declarations(maps) {
  const problems = maps
    .map(({ name, entries, committed }) => identityProblems(name, entries, committed))
    .filter(Boolean);

  // A missing binding means no generator input supplies that ID any more; say how to resolve it either way.
  if (problems.some((problem) => problem.includes('missing committed key')))
    problems.push(
      'Missing keys: author the identity in the generator (fixed or supplemental records) to keep it, ' +
        'or delete its committed declaration together with its consumers to remove it.'
    );

  if (problems.length) throw new Error(problems.join('\n'));

  return maps.map(({ name, entries }) =>
    [
      `export const ${name} = Object.freeze({`,
      ...entries.map((entry) => `  ${entry.key}: ${entry.id},${entry.name == null ? '' : ` // ${entry.name}`}`),
      '});'
    ].join('\n')
  );
}

/** Assemble the common profession ID artifact and require both named exports before allocating any keys. */
export async function generateProfessionIds({
  profession,
  generator,
  skills,
  specializations,
  fixedSkills = [],
  skillKeys = {},
  extraSource = ''
}) {
  const target = fileURLToPath(new URL(`../../../js/games/gw2/professions/${profession}/data/ids.ts`, import.meta.url));
  const committed = await committedIdentities(target);
  const prefix = profession.toUpperCase();
  const skillMap = requireIdentityMap(committed[`${prefix}_SKILL_IDS`], `${prefix}_SKILL_IDS`);
  const traitMap = requireIdentityMap(committed[`${prefix}_TRAIT_IDS`], `${prefix}_TRAIT_IDS`);
  const skillEntries = stableEntries(
    skills.map(({ name, id }) => [name, id]),
    skillMap,
    fixedSkills,
    skillKeys
  );
  const traitEntries = stableEntries(traitIdentities(specializations), traitMap);
  const [skillDeclaration, traitDeclaration] = declarations([
    { name: `${prefix}_SKILL_IDS`, entries: skillEntries, committed: skillMap },
    { name: `${prefix}_TRAIT_IDS`, entries: traitEntries, committed: traitMap }
  ]);
  const source = [
    `// Generated by scripts/data/${generator}.mjs.`,
    '// Committed constants keep mechanic references independent from metadata loading.',
    '',
    skillDeclaration,
    '',
    traitDeclaration,
    // Profession-specific declarations stay visually separate from the shared maps.
    ...(extraSource ? ['', extraSource] : []),
    ''
  ].join('\n');
  return {
    files: [{ target, source, summary: `${skillEntries.length} skill and ${traitEntries.length} trait IDs` }],
    keyById: new Map(skillEntries.map(({ id, key }) => [id, key]))
  };
}

/** Format every prepared output before the first write, then report each successfully published artifact. */
export async function writeGeneratedFiles(files, { log = console.log } = {}) {
  const formatted = await Promise.all(
    files.map(async (file) => {
      try {
        const source = await format(file.source, { ...(await resolveConfig(file.target)), filepath: file.target });

        return { ...file, source };
      } catch (error) {
        // Prettier reports only a position, so name the artifact whose generated source is invalid.
        throw new Error(`Generated source for ${file.target} is invalid: ${error.message}`, { cause: error });
      }
    })
  );
  for (const { target, source, summary = 'generated source' } of formatted) {
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, source, 'utf8');
    log(`Wrote ${summary} to ${target}.`);
  }

  return formatted;
}

/** Runs async generator work with a fixed worker count while preserving input order. */
export async function mapConcurrent(values, limit, callback) {
  const output = new Array(values.length);
  let next = 0;

  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (next < values.length) {
        const index = next++;

        output[index] = await callback(values[index]);
      }
    })
  );

  return output;
}
