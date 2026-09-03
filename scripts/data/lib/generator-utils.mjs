/** Converts display text into stable uppercase identifiers for generated source. */
export function constantName(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/['\u2019]/g, '')
    .replace(/[^a-z0-9]+/gi, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();
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
