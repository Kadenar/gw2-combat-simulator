import type { SkillId } from '#gw2/platform/skills/types.js';
import { TRAIT_LINES } from '#gw2/professions/guardian/data/trait-lines.js';

const TRAIT_BY_ID = new Map(
  TRAIT_LINES.flatMap((specialization) => [...specialization.minorTraits, ...specialization.majorTraits.flat()]).map(
    (trait) => [Number(trait.id), trait]
  )
);

/** Trait owners share icon metadata without importing active reactions or the Core dispatcher. */
export function guardianTraitIcon(traitId: SkillId): string {
  return TRAIT_BY_ID.get(Number(traitId))?.icon || '';
}

/** Proc details identify the triggering trait separately from the invoked symbol's name. */
export function guardianTraitName(traitId: SkillId): string {
  return TRAIT_BY_ID.get(Number(traitId))?.name || '';
}
