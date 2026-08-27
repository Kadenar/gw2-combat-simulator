import { SPECIALIZATIONS as CATALOG_SPECIALIZATIONS } from './thief-api-metadata.js';
import type { ThiefApiTrait } from './thief-api-metadata.js';
import type { ThiefSpecializationSelection } from '../types.js';
import { createProfessionTraitData } from '../../lib/traits.js';

const traitData = createProfessionTraitData<ThiefApiTrait>(CATALOG_SPECIALIZATIONS);

export const SPECIALIZATIONS = [...traitData.specializations];
export const ELITE_SPECS = new Set(traitData.eliteSpecs);
export const CORE_SPECS = [...traitData.coreSpecs];
export const TRAITS = [...traitData.traits];

export function getActiveTraits(specializations: readonly ThiefSpecializationSelection[] = []): ThiefApiTrait[] {
  return traitData.getActiveTraits(specializations);
}
