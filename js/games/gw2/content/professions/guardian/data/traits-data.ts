import { SPECIALIZATIONS as CATALOG_SPECIALIZATIONS } from './guardian-api-metadata.js';
import type { CatalogEntity } from '../../../../platform/engine/types.js';
import type { GuardianSpecializationSelection } from '../types.js';
import { createProfessionTraitData } from '../../lib/traits.js';

const traitData = createProfessionTraitData<CatalogEntity>(CATALOG_SPECIALIZATIONS);

export const SPECIALIZATIONS = [...traitData.specializations];
export const ELITE_SPECS = new Set(traitData.eliteSpecs);
export const CORE_SPECS = [...traitData.coreSpecs];
export const TRAITS = [...traitData.traits];

export function getActiveTraits(specializations: readonly GuardianSpecializationSelection[] = []): CatalogEntity[] {
  return traitData.getActiveTraits(specializations);
}
