import { attributeSeed } from '#gw2/platform/builds/attribute-inputs.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';

/** Combat attributes: configured stats, their resolved form, and the static per-weapon-set view stat queries start from. */

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
  readonly professionCriticalChanceBonus?: number;
}

/** A mutable working copy of combat attributes, as profession modifier rules build them. */
export type Gw2MutableStats = { -readonly [Key in keyof Gw2Stats]: Gw2Stats[Key] };

/** Keys whose resolved values support numeric attribute adjustments. */
export type Gw2NumericStatKey = {
  [Key in keyof Gw2ResolvedStats]-?: Gw2ResolvedStats[Key] extends number ? Key : never;
}[keyof Gw2ResolvedStats];

export interface Gw2ResolvedStats {
  readonly uncappedBoonDurationBonus?: number;
  readonly criticalChanceBonus?: number;
  readonly professionCriticalChanceBonus?: number;
  readonly power: number;
  readonly precision: number;
  readonly toughness: number;
  readonly vitality: number;
  readonly ferocity: number;
  readonly conditionDamage: number;
  readonly expertise: number;
  readonly concentration: number;
  readonly healingPower: number;
  readonly boonDurationBonus: number;
  readonly boonDurationBonuses: Readonly<Record<string, number>>;
  readonly conditionDurationBonus: number;
  readonly conditionDurationBonuses: Readonly<Record<string, number>>;
}

/** Overlays one-based weapon-set attributes on the base simulation stats. */
export function gw2StatsForWeaponSet(config: Gw2Config, weaponSet = config.startingWeaponSet): Gw2Stats {
  return attributeSeed(config, weaponSet).commonTotals;
}

/** Resolves the unprocessed weapon-set seed; the attribute evaluator owns boon grants. */
export function gw2StaticAttributes(config: Gw2Config, weaponSet = config.startingWeaponSet): Gw2ResolvedStats {
  const stats = gw2StatsForWeaponSet(config, weaponSet);
  return {
    criticalChanceBonus: stats.criticalChanceBonus ?? 0,
    uncappedBoonDurationBonus: stats.uncappedBoonDurationBonus ?? 0,
    power: stats.power || 0,
    precision: stats.precision || 0,
    toughness: stats.toughness || 0,
    vitality: stats.vitality || 0,
    ferocity: stats.ferocity || 0,
    conditionDamage: stats.conditionDamage || 0,
    expertise: stats.expertise || 0,
    concentration: stats.concentration || 0,
    healingPower: stats.healingPower || 0,
    boonDurationBonus: stats.boonDurationBonus || 0,
    boonDurationBonuses: {
      ...(stats.boonDurationBonuses || {})
    },
    conditionDurationBonus: stats.conditionDurationBonus || 0,
    conditionDurationBonuses: {
      ...(stats.conditionDurationBonuses || {})
    }
  };
}
