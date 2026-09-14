/** Converts display text into stable uppercase identifiers for generated source. */
export function constantName(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/['\u2019]/g, '')
    .replace(/[^a-z0-9]+/gi, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();
}

/** Assigns deterministic source keys while preserving duplicate display names by ID. */
export function stableEntries(entries) {
  const result = [];
  const keys = new Set();

  for (const [name, id] of entries) {
    const base = constantName(name);

    if (!base) continue;
    const key = keys.has(base) ? `${base}_ID_${id}` : base;

    keys.add(base);
    result.push({ key, id: Number(id), name: String(name) });
  }

  return result;
}

/** Formats one generated ID map so all data generators emit the same stable source shape. */
export function declaration(name, entries, prefix = []) {
  return [
    `export const ${name} = Object.freeze({`,
    ...prefix.map((line) => `  ${line}`),
    ...entries.map((entry) => `  ${entry.key}: ${entry.id}, // ${entry.name}`),
    '});'
  ].join('\n');
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
