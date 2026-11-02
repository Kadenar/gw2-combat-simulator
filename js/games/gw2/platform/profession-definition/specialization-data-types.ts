/** Maintained specialization and trait presentation, separate from authored combat behavior. */
import type { CatalogEntity } from '#gw2/platform/skills/types.js';

export interface Gw2TraitData extends CatalogEntity {
  readonly icon: string;
}

export interface Gw2SpecializationData extends CatalogEntity {
  readonly elite: boolean;
  readonly icon: string;
  readonly minorTraits: readonly Gw2TraitData[];
  readonly majorTraits: readonly (readonly Gw2TraitData[])[];
}
