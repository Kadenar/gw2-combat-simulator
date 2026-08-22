import type { CatalogEntity } from '../engine/types.js';

/**
 * Defines the checked shape shared by generated profession API snapshots so
 * regeneration cannot silently omit catalog presentation or identity fields.
 */
export interface Gw2ApiTrait extends CatalogEntity {
  readonly description: string;
  readonly icon: string;
  /** Legacy snapshots may derive this from their containing specialization. */
  readonly specialization?: string;
  readonly tier: number;
  /** Normalized snapshots use position; older snapshots retain the API order. */
  readonly position?: number;
  readonly order?: number;
  readonly slot?: string;
}

export interface Gw2ApiSpecialization extends CatalogEntity {
  readonly elite: boolean;
  readonly icon: string;
  readonly background: string;
  readonly minorTraits: readonly Gw2ApiTrait[];
  readonly majorTraits: readonly (readonly Gw2ApiTrait[])[];
}
