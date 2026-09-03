import { SPECIALIZATIONS as CATALOG_SPECIALIZATIONS } from '#gw2/professions/thief/data/thief-api-metadata.js';
import type { ThiefApiTrait } from '#gw2/professions/thief/data/thief-api-metadata.js';
import { createProfessionTraitData } from '#gw2/professions/lib/traits.js';

export const {
  specializations: SPECIALIZATIONS,
  eliteSpecs: ELITE_SPECS,
  coreSpecs: CORE_SPECS,
  traits: TRAITS,
  getActiveTraits
} = createProfessionTraitData<ThiefApiTrait>(CATALOG_SPECIALIZATIONS);
