import { SPECIALIZATIONS as CATALOG_SPECIALIZATIONS } from '#gw2/content/professions/thief/data/thief-api-metadata.js';
import type { ThiefApiTrait } from '#gw2/content/professions/thief/data/thief-api-metadata.js';
import type { ThiefSpecializationSelection } from '#gw2/content/professions/thief/types.js';
import { createProfessionTraitData } from '#gw2/content/professions/lib/traits.js';

const traitData = createProfessionTraitData<ThiefApiTrait>(CATALOG_SPECIALIZATIONS);

export const SPECIALIZATIONS = [...traitData.specializations];
export const ELITE_SPECS = new Set(traitData.eliteSpecs);
export const CORE_SPECS = [...traitData.coreSpecs];
export const TRAITS = [...traitData.traits];

export const getActiveTraits: (specializations?: readonly ThiefSpecializationSelection[]) => ThiefApiTrait[] =
  traitData.getActiveTraits;
