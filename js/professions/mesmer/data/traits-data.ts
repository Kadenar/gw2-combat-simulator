import { SPECIALIZATIONS as CATALOG_SPECIALIZATIONS } from './mesmer-api-metadata.js';
import type { MesmerApiTrait } from './mesmer-api-metadata.js';
import { createProfessionTraitData } from '../../lib/traits.js';

export { DEFAULT_TRAITS } from '../../lib/traits.js';

const MINOR_TIERS = ['Minor Adept', 'Minor Master', 'Minor Grandmaster'];

const MAJOR_TIERS = ['Major Adept', 'Major Master', 'Major Grandmaster'];

const STAT_ANNOTATIONS: Record<string, Record<string, number>> = {
  'Malicious Sorcery': {
    confusionDuration: 25
  }
};

export interface MesmerTraitRecord {
  readonly id: number | string;
  readonly tier: string;
  readonly name: string;
  readonly specialization: string;
  readonly position: number;
  readonly description: string;
  readonly icon: string;
  readonly [annotation: string]: number | string;
}

export interface SpecializationSelection {
  readonly name: string;
  readonly traits?: string;
}

const traitData = createProfessionTraitData<MesmerApiTrait, MesmerTraitRecord>(CATALOG_SPECIALIZATIONS, {
  mapTrait(trait, { specialization, kind, tier, position }) {
    const tierName = kind === 'minor' ? MINOR_TIERS[tier] : MAJOR_TIERS[tier];

    return {
      id: trait.id,
      tier: tierName,
      name: trait.name,
      specialization,
      position,
      description: trait.description,
      icon: trait.icon,
      ...(STAT_ANNOTATIONS[trait.name] || {})
    };
  }
});

export const SPECIALIZATIONS = [...traitData.specializations];
export const ELITE_SPECS = new Set(traitData.eliteSpecs);
export const CORE_SPECS = [...traitData.coreSpecs];
export const TRAITS: MesmerTraitRecord[] = [...traitData.traits];

export function getActiveTraits(specializations?: readonly SpecializationSelection[] | null): MesmerTraitRecord[] {
  return traitData.getActiveTraits(specializations);
}
