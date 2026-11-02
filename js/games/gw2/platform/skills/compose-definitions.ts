import type { Skill, SkillDefinition } from '#gw2/platform/skills/types.js';

/** Combine owner-local families without allowing an object spread to silently replace a skill identity. */
export function composeSkillDefinitions<TSkill extends Skill = Skill>(
  ...families: readonly Readonly<Record<string, SkillDefinition<TSkill>>>[]
): Readonly<Record<string, SkillDefinition<TSkill>>> {
  const definitions: Record<string, SkillDefinition<TSkill>> = {};
  for (const family of families) {
    for (const [id, definition] of Object.entries(family)) {
      if (Object.hasOwn(definitions, id)) throw new TypeError(`Duplicate skill definition ID ${id}.`);

      definitions[id] = definition;
    }
  }

  return Object.freeze(definitions);
}

/** Give keyed owner declarations their identities before combining them with generated module skills. */
export function materializeSkillDefinitions<TSkill extends Skill = Skill>(
  definitions: Readonly<Record<string, SkillDefinition<TSkill>>>
): readonly TSkill[] {
  return Object.freeze(
    Object.entries(definitions).map(([key, definition]) => {
      const numericId = Number(key);
      const id = Number.isSafeInteger(numericId) && String(numericId) === key ? numericId : key;
      return Object.freeze({ ...definition, id }) as TSkill;
    })
  );
}
