import type { CatalogEntity, Skill } from '../../../platform/engine/types.js';

// Typed boundary for the generated Revenant API metadata snapshot.
export interface RevenantApiTrait extends CatalogEntity {
  readonly description: string;
  readonly icon: string;
  readonly specialization: string;
  readonly tier: number;
  readonly position: number;
  readonly slot: string;
}

export interface RevenantApiSpecialization extends CatalogEntity {
  readonly elite: boolean;
  readonly icon: string;
  readonly background: string;
  readonly minorTraits: readonly RevenantApiTrait[];
  readonly majorTraits: readonly (readonly RevenantApiTrait[])[];
}

export const DATA_SNAPSHOT: string;
export const SPECIALIZATIONS: readonly RevenantApiSpecialization[];
export const SKILLS: readonly Skill[];
