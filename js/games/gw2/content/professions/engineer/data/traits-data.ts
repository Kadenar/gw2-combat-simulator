import { SPECIALIZATIONS as CATALOG_SPECIALIZATIONS } from '#gw2/content/professions/engineer/data/engineer-api-metadata.js';
import type { EngineerApiTrait } from '#gw2/content/professions/engineer/data/engineer-api-metadata.js';
import { createProfessionTraitData } from '#gw2/content/professions/lib/traits.js';

export const {
  specializations: SPECIALIZATIONS,
  eliteSpecs: ELITE_SPECS,
  coreSpecs: CORE_SPECS,
  traits: TRAITS,
  getActiveTraits
} = createProfessionTraitData<EngineerApiTrait>(CATALOG_SPECIALIZATIONS);
