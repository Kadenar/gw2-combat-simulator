import { SPECIALIZATIONS as CATALOG_SPECIALIZATIONS } from './engineer-api-metadata.js';
import type { EngineerApiTrait } from './engineer-api-metadata.js';
import type { EngineerSpecializationSelection } from '../types.js';
import { createProfessionTraitData } from '../../lib/traits.js';

const traitData = createProfessionTraitData<EngineerApiTrait>(CATALOG_SPECIALIZATIONS);

export const SPECIALIZATIONS = [...traitData.specializations];
export const ELITE_SPECS = new Set(traitData.eliteSpecs);
export const CORE_SPECS = [...traitData.coreSpecs];
export const TRAITS = [...traitData.traits];

export function getActiveTraits(specializations: readonly EngineerSpecializationSelection[] = []): EngineerApiTrait[] {
  return traitData.getActiveTraits(specializations);
}
