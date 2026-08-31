import { SPECIALIZATIONS as CATALOG_SPECIALIZATIONS } from '#gw2/content/professions/ranger/data/ranger-api-metadata.js';
import type { CatalogEntity } from '#gw2/platform/engine/types.js';
import type { RangerSpecializationSelection } from '#gw2/content/professions/ranger/types.js';
import { createProfessionTraitData } from '#gw2/content/professions/lib/traits.js';

const traitData = createProfessionTraitData<CatalogEntity>(CATALOG_SPECIALIZATIONS);

export const SPECIALIZATIONS = [...traitData.specializations];
export const ELITE_SPECS = new Set(traitData.eliteSpecs);
export const CORE_SPECS = [...traitData.coreSpecs];
export const TRAITS = [...traitData.traits];

export function getActiveTraits(specializations: readonly RangerSpecializationSelection[] = []): CatalogEntity[] {
  return traitData.getActiveTraits(specializations);
}
