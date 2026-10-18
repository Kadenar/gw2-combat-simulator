import type { SimulationEvent } from '#gw2/platform/events/events.js';

/** One labelled share of a strike's critical chance, retained so reports can explain the final chance. */
export interface Gw2CriticalChanceContributor {
  readonly id: string;
  readonly label: string;
  readonly amount: number;
}

/**
 * The in-flight combat packet shared by producers, combat queries, reactions, and reports. Resolver-private condition
 * scheduling references are layered on inside resolver/ and never belong to this public packet shape.
 */
export type Gw2ResolverEvent = SimulationEvent & {
  readonly damageBreakdownName?: string;
  /** The displayed critical outcome controls procs while this hit's damage uses an average multiplier. */
  readonly averagedCriticalDamage?: boolean;
  readonly condition?: string;
  readonly fraction?: number;
  readonly fixedDuration?: boolean;
  readonly coefficient?: number;
  readonly coefficientModifiers?: readonly {
    readonly kind?: string;
    readonly threshold?: number;
    readonly multiplier?: number;
  }[];
  readonly flatDamage?: number;
  /** Non-condition damage over time can scale with live Condition Damage without outgoing modifiers. */
  readonly flatDamageConditionCoeff?: number;
  readonly flatStrikeBase?: number;
  readonly flatStrikePowerCoeff?: number;
  readonly flatStrikeMultiplier?: number;
  readonly flatStrikeHealthThreshold?: number;
  readonly flatStrikeThresholdMultiplier?: number;
  readonly summonDamagePerCoefficient?: number;
  readonly summonBasePower?: number;
  readonly summonBasePrecision?: number;
  readonly summonBaseFerocity?: number;
  readonly summonBaseConditionDamage?: number;
  readonly summonBaseExpertise?: number;
  readonly summonInheritsCriticalAttributes?: boolean;
  readonly independentSummonStrike?: boolean;
  readonly summonInheritsAttributes?: boolean;
  readonly summonIgnoresBoons?: boolean;
  readonly summonUsesMight?: boolean;
  readonly summonUsesEquipmentModifiers?: boolean;
  readonly summonUsesProfessionModifiers?: boolean;
  readonly canCrit?: boolean;
  readonly forceCrit?: boolean;
  readonly canTriggerCriticalTraits?: boolean;
  /**
   * Resolver's derived verdict on whether the strike could crit: false for flat
   * strikes and for `canCrit:false` hits. Consumers should read this
   * rather than re-deriving from the raw input flags.
   */
  readonly critEligible?: boolean;
  readonly criticalChance?: number;
  readonly criticalChanceBeforeCap?: number;
  readonly criticalChanceContributors?: readonly Gw2CriticalChanceContributor[];
  readonly criticalDamage?: number;
  readonly didCrit?: boolean;
  readonly hits?: number;
  readonly resolvedWeaponStrength?: number;
  readonly weaponStrengthSampled?: boolean;
};
