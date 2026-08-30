import { SPECIALIZATIONS as CATALOG_SPECIALIZATIONS } from '#gw2/content/professions/necromancer/data/necromancer-api-metadata.js';
import type { NecromancerApiTrait } from '#gw2/content/professions/necromancer/data/necromancer-api-metadata.js';
import { createProfessionTraitData } from '#gw2/content/professions/lib/traits.js';

export interface NecromancerSpecializationSelection {
  readonly name?: string;
  readonly traits?: string;
}

const traitData = createProfessionTraitData<NecromancerApiTrait>(CATALOG_SPECIALIZATIONS);

export const SPECIALIZATIONS = [...traitData.specializations];
export const ELITE_SPECS = new Set(traitData.eliteSpecs);
export const CORE_SPECS = [...traitData.coreSpecs];
export const TRAITS = [...traitData.traits];

export function getActiveTraits(
  specializations: readonly NecromancerSpecializationSelection[] = []
): NecromancerApiTrait[] {
  return traitData.getActiveTraits(specializations);
}
