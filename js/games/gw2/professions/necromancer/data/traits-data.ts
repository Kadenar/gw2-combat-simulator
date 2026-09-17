import { SPECIALIZATIONS as CATALOG_SPECIALIZATIONS } from '#gw2/professions/necromancer/data/necromancer-api-metadata.js';
import type { Gw2ApiTrait } from '#gw2/platform/profession-definition/api-metadata-types.js';
import { createProfessionTraitData } from '#gw2/professions/shared/trait-data.js';

export const {
  specializations: SPECIALIZATIONS,
  eliteSpecs: ELITE_SPECS,
  coreSpecs: CORE_SPECS,
  traits: TRAITS,
  getActiveTraits
} = createProfessionTraitData<Gw2ApiTrait>(CATALOG_SPECIALIZATIONS);
