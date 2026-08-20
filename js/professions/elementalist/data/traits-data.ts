import { SPECIALIZATIONS as CATALOG_SPECIALIZATIONS } from './elementalist-api-metadata.js';
import type { ElementalistApiTrait } from './elementalist-api-metadata.js';
import type { ElementalistBuildSpecialization } from '../types.js';
import { createProfessionTraitData } from '../../lib/traits.js';

export { DEFAULT_TRAITS } from '../../lib/traits.js';

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
