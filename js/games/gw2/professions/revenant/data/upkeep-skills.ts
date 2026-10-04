import type { Skill, SkillId } from '#gw2/platform/skills/types.js';
import type { RevenantSkill } from '#gw2/professions/revenant/types.js';

/** A legend-dependent upkeep never substitutes an ordinary flip when its destination has no consume. */
export function revenantUpkeepConsumeId(skill: RevenantSkill, legendId: string): SkillId | undefined {
  return skill.upkeepConsumeByLegendId != null
    ? skill.upkeepConsumeByLegendId[legendId]
    : (skill.flipSkillId ?? undefined);
}

/** Derive and validate consume ownership from the selected parents, never from a second relationship table. */
export function revenantFacetParents(
  skillsById: ReadonlyMap<SkillId, RevenantSkill>
): ReadonlyMap<SkillId, RevenantSkill> {
  const parents = new Map<SkillId, RevenantSkill>();
  for (const facet of skillsById.values()) {
    if (!facet.facet) continue;
    const consumes =
      facet.upkeepConsumeByLegendId != null ? Object.values(facet.upkeepConsumeByLegendId) : [facet.flipSkillId];
    for (const consumeId of consumes) {
      if (consumeId == null || !skillsById.get(consumeId)?.consume)
        throw new Error(`Facet ${facet.id} references a missing or invalid consume ${consumeId}.`);
      const previous = parents.get(consumeId);
      if (previous && previous.id !== facet.id)
        throw new Error(`Consume ${consumeId} has ambiguous facet parents ${previous.id} and ${facet.id}.`);
      parents.set(consumeId, facet);
    }
  }

  return parents;
}

/** Upkeeps are the skills that declare a sustained Energy drain. */
export function isRevenantUpkeep(skill: Skill | null | undefined): boolean {
  return skill?.upkeepCost != null;
}

/**
 * A release is the free flip of an upkeep parent; facet consumes are Herald-owned instead. Callers supply their own
 * catalog lookup so live owners, the palette, and log reconstruction share one identity rule.
 */
export function isRevenantUpkeepRelease(
  skill: Skill | null | undefined,
  skillFor: (id: SkillId) => Skill | null | undefined
): boolean {
  if (!skill || skill.consume || skill.flipParentId == null) return false;
  return isRevenantUpkeep(skillFor(Number(skill.flipParentId)));
}
