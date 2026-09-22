import { SPECIALIZATIONS as CATALOG_SPECIALIZATIONS } from '#gw2/professions/mesmer/data/mesmer-api-metadata.js';
import type { Gw2ApiTrait } from '#gw2/platform/profession-definition/api-metadata-types.js';
import { createProfessionTraitData } from '#gw2/professions/shared/trait-data.js';

export { DEFAULT_TRAITS } from '#gw2/professions/shared/trait-data.js';

const MINOR_TIERS = ['Minor Adept', 'Minor Master', 'Minor Grandmaster'];

const MAJOR_TIERS = ['Major Adept', 'Major Master', 'Major Grandmaster'];

export interface MesmerTraitRecord {
  readonly [key: string]: unknown;
  readonly id: number | string;
  readonly tier: string;
  readonly name: string;
  readonly specialization: string;
  readonly position: number;
  readonly description: string;
  readonly icon: string;
}

export const {
  specializations: SPECIALIZATIONS,
  eliteSpecs: ELITE_SPECS,
  coreSpecs: CORE_SPECS,
  traits: TRAITS,
  getActiveTraits
} = createProfessionTraitData<Gw2ApiTrait, MesmerTraitRecord>(CATALOG_SPECIALIZATIONS, {
  mapTrait(trait, { specialization, kind, tier, position }) {
    const tierName = kind === 'minor' ? MINOR_TIERS[tier] : MAJOR_TIERS[tier];

    return {
      id: trait.id,
      tier: tierName,
      name: trait.name,
      specialization,
      position,
      description: trait.description,
      icon: trait.icon
    };
  }
});
