import { SPECIALIZATIONS as CATALOG_SPECIALIZATIONS } from '#gw2/professions/necromancer/data/necromancer-api-metadata.js';
import type { Gw2ApiTrait } from '#gw2/platform/profession-definition/api-metadata-types.js';
import { createProfessionTraitData, type ProfessionTraitSelection } from '#gw2/professions/lib/trait-data.js';

export type NecromancerSpecializationSelection = ProfessionTraitSelection;

export const {
  specializations: SPECIALIZATIONS,
  eliteSpecs: ELITE_SPECS,
  coreSpecs: CORE_SPECS,
  traits: TRAITS,
  getActiveTraits
} = createProfessionTraitData<Gw2ApiTrait>(CATALOG_SPECIALIZATIONS);
