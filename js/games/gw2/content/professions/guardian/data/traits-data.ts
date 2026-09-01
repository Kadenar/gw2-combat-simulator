import { SPECIALIZATIONS as CATALOG_SPECIALIZATIONS } from '#gw2/content/professions/guardian/data/guardian-api-metadata.js';
import type { CatalogEntity } from '#gw2/platform/engine/types.js';
import type { GuardianSpecializationSelection } from '#gw2/content/professions/guardian/types.js';
import { createProfessionTraitData } from '#gw2/content/professions/lib/traits.js';

const traitData = createProfessionTraitData<CatalogEntity>(CATALOG_SPECIALIZATIONS);

export const SPECIALIZATIONS = [...traitData.specializations];
export const ELITE_SPECS = new Set(traitData.eliteSpecs);
export const CORE_SPECS = [...traitData.coreSpecs];
export const TRAITS = [...traitData.traits];

export const getActiveTraits: (specializations?: readonly GuardianSpecializationSelection[]) => CatalogEntity[] =
  traitData.getActiveTraits;
