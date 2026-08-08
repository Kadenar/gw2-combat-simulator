import type { CatalogEntity, Skill } from "../../../platform/engine/types.js";

export interface WarriorApiTrait extends CatalogEntity {
  readonly description: string;
  readonly icon: string;
  readonly specialization: string;
  readonly tier: number;
  readonly position: number;
  readonly slot: string;
}

export interface WarriorApiSpecialization extends CatalogEntity {
  readonly elite: boolean;
  readonly icon: string;
  readonly background: string;
  readonly minorTraits: readonly WarriorApiTrait[];
  readonly majorTraits: readonly (readonly WarriorApiTrait[])[];
}

export const DATA_SNAPSHOT: string;
export const SPECIALIZATIONS: readonly WarriorApiSpecialization[];
export const SKILLS: readonly Skill[];
