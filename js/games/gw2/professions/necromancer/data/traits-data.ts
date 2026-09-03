import { SPECIALIZATIONS as CATALOG_SPECIALIZATIONS } from '#gw2/professions/necromancer/data/necromancer-api-metadata.js';
import type { NecromancerApiTrait } from '#gw2/professions/necromancer/data/necromancer-api-metadata.js';
import { createProfessionTraitData, type ProfessionTraitSelection } from '#gw2/professions/lib/traits.js';

export type NecromancerSpecializationSelection = ProfessionTraitSelection;

export const {
  specializations: SPECIALIZATIONS,
  eliteSpecs: ELITE_SPECS,
  coreSpecs: CORE_SPECS,
  traits: TRAITS,
  getActiveTraits
} = createProfessionTraitData<NecromancerApiTrait>(CATALOG_SPECIALIZATIONS);
