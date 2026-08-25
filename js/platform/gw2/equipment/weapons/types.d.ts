/** Owns the equipment/weapons/types.d.ts contracts so type dependencies follow their runtime feature boundaries. */
import type { CanonicalCatalog, SchedulerRecord, Skill } from '../../../engine/types.js';
import type { Gw2Config } from '../../simulation/config.js';

export interface Gw2WeaponMatcherContext extends SchedulerRecord {
  readonly catalog?: CanonicalCatalog | null;
  readonly config?: Gw2Config;
  readonly state?: object;
  readonly weaponBarPreview?: boolean;
  readonly weaponData?: Readonly<Record<string, { readonly wielding?: string }>>;
}

export type Gw2WeaponSkillMatcher = (
  skill: Skill,
  weaponSet?: readonly (string | undefined)[],
  context?: Gw2WeaponMatcherContext
) => boolean;
