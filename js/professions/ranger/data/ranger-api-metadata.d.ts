import type { CatalogEntity, Skill } from "../../../platform/engine/types.js";

export const DATA_SNAPSHOT: string;
export const SPECIALIZATIONS: readonly (CatalogEntity & {
  readonly elite: boolean;
  readonly minorTraits: readonly CatalogEntity[];
  readonly majorTraits: readonly (readonly CatalogEntity[])[];
})[];
export const SKILLS: readonly Skill[];
