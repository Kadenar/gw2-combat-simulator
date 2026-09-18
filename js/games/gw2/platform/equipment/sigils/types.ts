/** Owns the equipment/sigils/types.ts contracts so type dependencies follow their runtime feature boundaries. */

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

export interface Gw2SigilDataEntry {
  readonly stackingStats?: Readonly<Record<string, number>>;
  readonly criticalChance?: number;
  readonly strikeDamageA?: number;
  readonly strikeDamageM?: number;
  readonly nightStrikeDamageM?: number;
  readonly conditionDamageA?: number;
  readonly conditionDuration?: number;
  readonly bleedingDuration?: number;
  readonly burningDuration?: number;
  readonly poisonDuration?: number;
  readonly tormentDuration?: number;
  readonly boonDuration?: number;
  readonly procPrecision?: number;
  readonly procFerocity?: number;
  readonly icon: string;
  readonly [field: string]: unknown;
}
