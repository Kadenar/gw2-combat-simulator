/** Owns the equipment/types.ts contracts so type dependencies follow their runtime feature boundaries. */

export interface Gw2Stats {
  readonly power?: number;
  readonly precision?: number;
  readonly toughness?: number;
  readonly vitality?: number;
  readonly ferocity?: number;
  readonly conditionDamage?: number;
  readonly expertise?: number;
  readonly concentration?: number;
  readonly healingPower?: number;
  readonly boonDurationBonus?: number;
  /** Flat percentage points added after applying the normal boon-duration cap. */
  readonly uncappedBoonDurationBonus?: number;
  readonly boonDurationBonuses?: Readonly<Record<string, number>>;
  readonly conditionDurationBonus?: number;
  readonly conditionDurationBonuses?: Readonly<Record<string, number>>;
  readonly criticalChanceBonus?: number;
}

/** A mutable working copy of combat attributes, as profession modifier rules build them. */
export type Gw2MutableStats = { -readonly [Key in keyof Gw2Stats]: Gw2Stats[Key] };

export interface Gw2SigilSet {
  readonly names?: readonly string[];
  readonly boonDurationBonus?: number;
  readonly criticalChanceBonus?: number;
  readonly strikeAdd?: number;
  readonly strike?: number;
  readonly strikeMultiplier?: number;
  readonly nightStrikeMultiplier?: number;
  readonly conditionAdd?: number;
  readonly condition?: number;
  readonly conditionDurationBonus?: number;
  readonly conditionDurationBonuses?: Readonly<Record<string, number>>;
}

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

export interface Gw2SigilProc {
  readonly trigger: string;
  readonly cooldown: number;
  readonly effect: string;
  readonly icon?: string;
  readonly coefficient?: number;
  readonly weaponStrength?: number;
  readonly weaponStrengthProfileId?: string;
  readonly canCrit?: boolean;
  readonly condition?: string;
  readonly stacks?: number;
  readonly duration?: number;
  readonly amount?: number;
}
