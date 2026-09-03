import { SPECIALIZATIONS as CATALOG_SPECIALIZATIONS } from '#gw2/professions/elementalist/data/elementalist-api-metadata.js';
import type { ElementalistApiTrait } from '#gw2/professions/elementalist/data/elementalist-api-metadata.js';

import { createProfessionTraitData } from '#gw2/professions/lib/traits.js';

export { DEFAULT_TRAITS } from '#gw2/professions/lib/traits.js';

export const {
  specializations: SPECIALIZATIONS,
  eliteSpecs: ELITE_SPECS,
  coreSpecs: CORE_SPECS,
  traits: TRAITS,
  getActiveTraits
} = createProfessionTraitData<ElementalistApiTrait>(CATALOG_SPECIALIZATIONS);
