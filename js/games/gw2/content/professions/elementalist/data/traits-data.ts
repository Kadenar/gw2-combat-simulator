import { SPECIALIZATIONS as CATALOG_SPECIALIZATIONS } from '#gw2/content/professions/elementalist/data/elementalist-api-metadata.js';
import type { ElementalistApiTrait } from '#gw2/content/professions/elementalist/data/elementalist-api-metadata.js';
import type { ElementalistBuildSpecialization } from '#gw2/content/professions/elementalist/types.js';
import { createProfessionTraitData } from '#gw2/content/professions/lib/traits.js';

export { DEFAULT_TRAITS } from '#gw2/content/professions/lib/traits.js';

const traitData = createProfessionTraitData<ElementalistApiTrait>(CATALOG_SPECIALIZATIONS);

export const SPECIALIZATIONS = [...traitData.specializations];
export const ELITE_SPECS = new Set(traitData.eliteSpecs);
export const CORE_SPECS = [...traitData.coreSpecs];
export const TRAITS: readonly ElementalistApiTrait[] = Object.freeze([...traitData.traits]);

export function getActiveTraits(
  specializations: readonly ElementalistBuildSpecialization[] = []
): ElementalistApiTrait[] {
  return traitData.getActiveTraits(specializations);
}
