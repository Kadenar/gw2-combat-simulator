import { SPECIALIZATIONS as CATALOG_SPECIALIZATIONS } from '#gw2/professions/revenant/data/revenant-api-metadata.js';
import type { RevenantApiTrait } from '#gw2/professions/revenant/data/revenant-api-metadata.js';
import { createProfessionTraitData } from '#gw2/professions/lib/traits.js';

export const {
  specializations: SPECIALIZATIONS,
  eliteSpecs: ELITE_SPECS,
  coreSpecs: CORE_SPECS,
  traits: TRAITS,
  getActiveTraits
} = createProfessionTraitData<RevenantApiTrait>(CATALOG_SPECIALIZATIONS);
