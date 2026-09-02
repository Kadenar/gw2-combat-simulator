import { SPECIALIZATIONS as CATALOG_SPECIALIZATIONS } from '#gw2/content/professions/warrior/data/warrior-api-metadata.js';
import type { WarriorApiTrait } from '#gw2/content/professions/warrior/data/warrior-api-metadata.js';
import { createProfessionTraitData } from '#gw2/content/professions/lib/traits.js';

export interface WarriorSpecializationSelection {
  readonly name?: string;
  readonly traits?: string;
}

export const { traits: TRAITS, getActiveTraits } = createProfessionTraitData<WarriorApiTrait>(CATALOG_SPECIALIZATIONS);
