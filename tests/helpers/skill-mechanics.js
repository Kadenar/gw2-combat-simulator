import assert from 'node:assert/strict';

// Verify exact catalog membership, unique IDs, and the identity of each family's original fragments.
export function assertComposedCatalog(aggregate, families) {
  const entries = families.flatMap((family) => Object.entries(family));

  assert.equal(new Set(entries.map(([skillId]) => skillId)).size, entries.length);
  assert.deepEqual(
    Object.keys(aggregate).sort((left, right) => Number(left) - Number(right)),
    entries.map(([skillId]) => skillId).sort((left, right) => Number(left) - Number(right))
  );
  for (const [skillId, fragment] of entries) assert.equal(aggregate[skillId], fragment, skillId);
}

/**
 * Composes owner-local skill declarations for inventory tests while rejecting
 * duplicate IDs that an object spread would silently overwrite.
 */
export function composeSkillMechanics(profession, fragments) {
  const result = {};

  for (const fragment of fragments) {
    for (const [skillId, mechanics] of Object.entries(fragment)) {
      if (Object.hasOwn(result, skillId)) {
        throw new TypeError(`Duplicate ${profession} skill mechanics ID ${skillId}.`);
      }

      result[skillId] = mechanics;
    }
  }

  return Object.freeze(result);
}
