// Trait data processing and lookup
// Extracts traits from specialization catalog and provides active trait resolution

import { SPECIALIZATIONS as CATALOG_SPECIALIZATIONS } from "./mesmer-api-metadata.js";

// List of all specialization names
export const SPECIALIZATIONS = CATALOG_SPECIALIZATIONS.map((spec) => spec.name);
export const ELITE_SPECS = new Set(
  CATALOG_SPECIALIZATIONS.filter((spec) => spec.elite).map((spec) => spec.name),
);
export const CORE_SPECS = CATALOG_SPECIALIZATIONS
  .filter((spec) => !spec.elite)
  .map((spec) => spec.name);

export const DEFAULT_TRAITS = "1-1-1";

const MINOR_TIERS = ["Minor Adept", "Minor Master", "Minor Grandmaster"];
const MAJOR_TIERS = ["Major Adept", "Major Master", "Major Grandmaster"];

const STAT_ANNOTATIONS: Record<string, Record<string, number>> = {
  "Malicious Sorcery": { confusionDuration: 25 },
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

export const TRAITS: MesmerTraitRecord[] = CATALOG_SPECIALIZATIONS.flatMap(
  (spec) => {
    const traits: MesmerTraitRecord[] = [];
    spec.minorTraits.forEach((trait, index) => {
      traits.push({
        id: trait.id,
        tier: MINOR_TIERS[index],
        name: trait.name,
        specialization: spec.name,
        position: 0,
        description: trait.description,
        icon: trait.icon,
        ...(STAT_ANNOTATIONS[trait.name] || {}),
      });
    });
    spec.majorTraits.forEach((tier, tierIndex) => {
      tier.forEach((trait, position) => {
        traits.push({
          id: trait.id,
          tier: MAJOR_TIERS[tierIndex],
          name: trait.name,
          specialization: spec.name,
          position: position + 1,
          description: trait.description,
          icon: trait.icon,
          ...(STAT_ANNOTATIONS[trait.name] || {}),
        });
      });
    });
    return traits;
  },
);

export interface SpecializationSelection {
  readonly name: string;
  readonly traits?: string;
}

// Extracts active traits from specialization selection array
// Each spec has format { name, traits: '1-1-1' } where picks are position in each tier (1-3)
// Returns array of trait objects with names, descriptions, and stat effects
export function getActiveTraits(
  specializations?: readonly SpecializationSelection[] | null,
): MesmerTraitRecord[] {
  const active: MesmerTraitRecord[] = [];
  const majorTiers = ["Major Adept", "Major Master", "Major Grandmaster"];
  for (const spec of specializations || []) {
    const specTraits = TRAITS.filter(
      (trait) => trait.specialization === spec.name,
    );
    const picks = (spec.traits || "").split("-").map(Number);
    active.push(...specTraits.filter((trait) => trait.position === 0));
    majorTiers.forEach((tier, index) => {
      const pick = picks[index];
      if (!pick) return;
      const trait = specTraits.find(
        (candidate) => candidate.tier === tier && candidate.position === pick,
      );
      if (trait) active.push(trait);
    });
  }
  return active;
}
