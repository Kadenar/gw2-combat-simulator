import type { Gw2ApiTrait } from '#gw2/platform/profession-definition/api-metadata-types.js';
import { SPECIALIZATIONS as CATALOG_SPECIALIZATIONS } from '#gw2/professions/mesmer/data/mesmer-api-metadata.js';
import { createProfessionTraitData } from '#gw2/professions/shared/trait-data.js';

// Trait selection follows the generated specialization arrays; the flat catalog supplies identity and presentation.
export const { traits: TRAITS } = createProfessionTraitData<Gw2ApiTrait>(CATALOG_SPECIALIZATIONS);
