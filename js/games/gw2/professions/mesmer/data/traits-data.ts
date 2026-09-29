import { SPECIALIZATIONS as CATALOG_SPECIALIZATIONS } from '#gw2/professions/mesmer/data/mesmer-api-metadata.js';
import type { Gw2ApiTrait } from '#gw2/platform/profession-definition/api-metadata-types.js';
import { createProfessionTraitData } from '#gw2/professions/shared/trait-data.js';

// Generated metadata already carries the numeric tier and position used by trait selection.
export const { traits: TRAITS, getActiveTraits } = createProfessionTraitData<Gw2ApiTrait>(CATALOG_SPECIALIZATIONS);
