import { SPECIALIZATIONS as CATALOG_SPECIALIZATIONS } from '#gw2/content/professions/necromancer/data/necromancer-api-metadata.js';
import type { NecromancerApiTrait } from '#gw2/content/professions/necromancer/data/necromancer-api-metadata.js';
import { createProfessionTraitData } from '#gw2/content/professions/lib/traits.js';

export interface NecromancerSpecializationSelection {
  readonly name?: string;
  readonly traits?: string;
}

export const {
  specializations: SPECIALIZATIONS,
  eliteSpecs: ELITE_SPECS,
  coreSpecs: CORE_SPECS,
  traits: TRAITS,
  getActiveTraits
} = createProfessionTraitData<NecromancerApiTrait>(CATALOG_SPECIALIZATIONS);
