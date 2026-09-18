/** Owns the combat/types.ts contracts so type dependencies follow their runtime feature boundaries. */

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
