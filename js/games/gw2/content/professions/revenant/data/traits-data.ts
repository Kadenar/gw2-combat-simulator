import { SPECIALIZATIONS as CATALOG_SPECIALIZATIONS } from '#gw2/content/professions/revenant/data/revenant-api-metadata.js';
import type { RevenantApiTrait } from '#gw2/content/professions/revenant/data/revenant-api-metadata.js';
import type { RevenantSpecializationSelection } from '#gw2/content/professions/revenant/types.js';
import { createProfessionTraitData } from '#gw2/content/professions/lib/traits.js';

const traitData = createProfessionTraitData<RevenantApiTrait>(CATALOG_SPECIALIZATIONS);

export const SPECIALIZATIONS = [...traitData.specializations];
export const ELITE_SPECS = new Set(traitData.eliteSpecs);
export const CORE_SPECS = [...traitData.coreSpecs];
export const TRAITS = [...traitData.traits];

export function getActiveTraits(specializations: readonly RevenantSpecializationSelection[] = []): RevenantApiTrait[] {
  return traitData.getActiveTraits(specializations);
}
