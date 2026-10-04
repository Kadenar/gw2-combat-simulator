import type { SkillId } from '#gw2/platform/skills/types.js';
import { SPECIALIZATIONS } from '#gw2/professions/guardian/data/guardian-api-metadata.js';

const TRAIT_BY_ID = new Map(
  SPECIALIZATIONS.flatMap((specialization) => [
    ...specialization.minorTraits,
    ...specialization.majorTraits.flat()
  ]).map((trait) => [Number(trait.id), trait])
);

/** Trait owners share icon metadata without importing active reactions or the Core dispatcher. */
export function guardianTraitIcon(traitId: SkillId): string {
  return TRAIT_BY_ID.get(Number(traitId))?.icon || '';
}
