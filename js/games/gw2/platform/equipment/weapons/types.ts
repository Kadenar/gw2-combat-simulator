/** Owns the equipment/weapons/types.ts contracts so type dependencies follow their runtime feature boundaries. */
import type { CanonicalCatalog, Skill } from '#gw2/platform/engine/skills/types.js';
import type { Gw2Build } from '#gw2/platform/builds/types.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';

/** Equipment selection and live state shared by scheduler eligibility and weapon-bar previews. */
export interface Gw2WeaponMatcherContext {
  readonly specialization?: string;
  readonly build?: Gw2Build | null;
  /** Matchers normalize the profession-specific projection before reading live state. */
  readonly professionState?: unknown;
  readonly weaponSet?: number;
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

export interface Gw2WeaponDataEntry {
  readonly wielding: string;
  readonly weaponStrengthProfileId: string;
  readonly weaponStrength: number;
}

export interface Gw2WeaponStrengthProfile {
  readonly id: string;
  readonly min: number;
  readonly max: number;
}

export interface Gw2ResolvedWeaponStrength {
  readonly activationId: string | null;
  readonly profileId: string;
  readonly value: number;
  readonly sampled: boolean;
}
