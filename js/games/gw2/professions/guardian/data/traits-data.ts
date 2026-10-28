import type { CatalogEntity } from '#gw2/platform/skills/types.js';
import { SPECIALIZATIONS as CATALOG_SPECIALIZATIONS } from '#gw2/professions/guardian/data/guardian-api-metadata.js';
import { createProfessionTraitData } from '#gw2/professions/shared/trait-data.js';

export const { traits: TRAITS } = createProfessionTraitData<CatalogEntity>(CATALOG_SPECIALIZATIONS);
