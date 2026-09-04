import { SPECIALIZATIONS as CATALOG_SPECIALIZATIONS } from '#gw2/professions/guardian/data/guardian-api-metadata.js';
import type { CatalogEntity } from '#gw2/platform/engine/skills/types.js';
import { createProfessionTraitData } from '#gw2/professions/lib/traits.js';

export const {
  specializations: SPECIALIZATIONS,
  eliteSpecs: ELITE_SPECS,
  coreSpecs: CORE_SPECS,
  traits: TRAITS,
  getActiveTraits
} = createProfessionTraitData<CatalogEntity>(CATALOG_SPECIALIZATIONS);
