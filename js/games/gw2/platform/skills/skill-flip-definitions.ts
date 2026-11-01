/** Explicit follow-up identities; profession mechanics own their availability and lifetime. */
import type { AutoattackChainPosition, Skill, SkillId } from '#gw2/platform/skills/types.js';

export interface SkillFlipDefinition {
  readonly parentId: SkillId;
  readonly followUpId: SkillId;
  /** Secondary commands share a parent without replacing its default follow-up. */
  readonly defaultFollowUp?: boolean;
}

export type SkillFlips = readonly SkillFlipDefinition[];

/** Validate relationships independently of display names and input order. */
export function normalizeSkillFlips(
  skills: readonly Skill[],
  declarations: SkillFlips,
  chains: ReadonlyMap<number, AutoattackChainPosition>
) {
  const ids = new Set(skills.map((skill) => Number(skill.id)));
  const parents = new Map<number, number>();
  const defaults = new Map<number, number>();
  const flips = declarations.map((declaration) => {
    const parentId = Number(declaration.parentId);
    const followUpId = Number(declaration.followUpId);

    if (!ids.has(parentId) || !ids.has(followUpId)) {
      throw new TypeError(`Skill flip references missing skill: ${parentId} -> ${followUpId}.`);
    }

    if (parentId === followUpId || parents.has(followUpId)) {
      throw new TypeError(`Skill flip has a self-reference or duplicate parent for ${followUpId}.`);
    }

    if (chains.has(parentId) && chains.get(parentId)?.root === chains.get(followUpId)?.root) {
      throw new TypeError(`Autoattack chain members cannot form a skill flip: ${parentId} -> ${followUpId}.`);
    }

    if (declaration.defaultFollowUp != null && typeof declaration.defaultFollowUp !== 'boolean') {
      throw new TypeError(`Skill flip ${parentId} -> ${followUpId} has an invalid defaultFollowUp.`);
    }

    if (declaration.defaultFollowUp !== false) {
      if (defaults.has(parentId)) throw new TypeError(`Skill ${parentId} declares multiple default follow-ups.`);

      defaults.set(parentId, followUpId);
    }

    parents.set(followUpId, parentId);
    return Object.freeze({
      parentId,
      followUpId,
      ...(declaration.defaultFollowUp === false ? { defaultFollowUp: false } : {})
    });
  });
  // Follow-up families have a stable root; cycles cannot represent a rooted family.
  for (const id of parents.keys()) {
    const seen = new Set<number>();
    let current: number | undefined = id;
    while (current != null) {
      if (seen.has(current)) throw new TypeError(`Skill flip cycle includes ${current}.`);

      seen.add(current);
      current = parents.get(current);
    }
  }

  return { flips: Object.freeze(flips), parents, defaults };
}
