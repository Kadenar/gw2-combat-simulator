import { SPECIALIZATIONS as CATALOG_SPECIALIZATIONS } from '#gw2/professions/warrior/data/warrior-api-metadata.js';
import type { Gw2ApiTrait } from '#gw2/platform/profession-definition/api-metadata-types.js';
import { createProfessionTraitData, type ProfessionTraitSelection } from '#gw2/professions/shared/trait-data.js';

export type WarriorSpecializationSelection = ProfessionTraitSelection;

export const { traits: TRAITS, getActiveTraits } = createProfessionTraitData<Gw2ApiTrait>(CATALOG_SPECIALIZATIONS);
