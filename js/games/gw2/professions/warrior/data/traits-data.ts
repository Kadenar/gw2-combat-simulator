import type { Gw2ApiTrait } from '#gw2/platform/profession-definition/api-metadata-types.js';
import { createProfessionTraitData } from '#gw2/professions/shared/trait-data.js';
import { SPECIALIZATIONS as CATALOG_SPECIALIZATIONS } from '#gw2/professions/warrior/data/warrior-api-metadata.js';

export const { traits: TRAITS } = createProfessionTraitData<Gw2ApiTrait>(CATALOG_SPECIALIZATIONS);
