import { SPECIALIZATIONS as CATALOG_SPECIALIZATIONS } from '#gw2/professions/warrior/data/warrior-api-metadata.js';
import type { WarriorApiTrait } from '#gw2/professions/warrior/data/warrior-api-metadata.js';
import { createProfessionTraitData, type ProfessionTraitSelection } from '#gw2/professions/lib/traits.js';

export type WarriorSpecializationSelection = ProfessionTraitSelection;

export const { traits: TRAITS, getActiveTraits } = createProfessionTraitData<WarriorApiTrait>(CATALOG_SPECIALIZATIONS);
