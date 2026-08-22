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
