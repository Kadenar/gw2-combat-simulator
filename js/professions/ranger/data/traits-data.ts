import { SPECIALIZATIONS as CATALOG_SPECIALIZATIONS } from './ranger-api-metadata.js';
import type { CatalogEntity } from '../../../platform/engine/types.js';
import type { RangerSpecializationSelection } from '../types.js';
import { createProfessionTraitData } from '../../lib/traits.js';

const traitData = createProfessionTraitData<CatalogEntity>(CATALOG_SPECIALIZATIONS);

export const SPECIALIZATIONS = [...traitData.specializations];
export const ELITE_SPECS = new Set(traitData.eliteSpecs);
export const CORE_SPECS = [...traitData.coreSpecs];
export const TRAITS = [...traitData.traits];

export function getActiveTraits(specializations: readonly RangerSpecializationSelection[] = []): CatalogEntity[] {
  return traitData.getActiveTraits(specializations);
}
