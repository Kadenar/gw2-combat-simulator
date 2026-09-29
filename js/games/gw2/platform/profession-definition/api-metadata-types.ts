import type { CatalogEntity } from '#gw2/platform/engine/skills/types.js';

/**
 * Defines the checked shape shared by generated profession API snapshots so
 * regeneration cannot silently omit catalog presentation or identity fields.
 */
export interface Gw2ApiTrait extends CatalogEntity {
  readonly description: string;
  readonly icon: string;
  readonly specialization: string;
  readonly tier: number;
  /** Minor traits use zero; major traits use their one-based selection position. */
  readonly position: number;
  readonly slot: 'Minor' | 'Major';
}

export interface Gw2ApiSpecialization extends CatalogEntity {
  readonly elite: boolean;
  readonly icon: string;
  readonly minorTraits: readonly Gw2ApiTrait[];
  readonly majorTraits: readonly (readonly Gw2ApiTrait[])[];
}
