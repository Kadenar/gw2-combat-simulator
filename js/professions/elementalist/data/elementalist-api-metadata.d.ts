import type { CatalogEntity, Skill } from "../../../platform/engine/types.js";

export interface ElementalistApiTrait extends CatalogEntity {
  readonly description: string;
  readonly icon: string;
  readonly specialization: string;
  readonly tier: number;
  readonly position: number;
  readonly slot: string;
}

export interface ElementalistApiSpecialization extends CatalogEntity {
  readonly elite: boolean;
  readonly icon: string;
  readonly background: string;
  readonly minorTraits: readonly ElementalistApiTrait[];
  readonly majorTraits: readonly (readonly ElementalistApiTrait[])[];
}

export const DATA_SNAPSHOT: string;
export const SPECIALIZATIONS: readonly ElementalistApiSpecialization[];
export const SKILLS: readonly Skill[];
