import { SPECIALIZATIONS as CATALOG_SPECIALIZATIONS } from '#gw2/content/professions/guardian/data/guardian-api-metadata.js';
import type { CatalogEntity } from '#gw2/platform/engine/types.js';
import { createProfessionTraitData } from '#gw2/content/professions/lib/traits.js';

export const {
  specializations: SPECIALIZATIONS,
  eliteSpecs: ELITE_SPECS,
  coreSpecs: CORE_SPECS,
  traits: TRAITS,
  getActiveTraits
} = createProfessionTraitData<CatalogEntity>(CATALOG_SPECIALIZATIONS);
