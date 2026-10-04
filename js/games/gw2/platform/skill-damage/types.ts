/** Serializable skill damage preview contracts shared by the application, its worker, and the evaluator. */
import type { Gw2ModifierContribution } from '#gw2/platform/combat/modifiers.js';
import type { SkillId } from '#gw2/platform/engine/skills/types.js';
import type { SkillDamageCastOptions } from '#gw2/platform/profession-presentation/skill-damage.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';

/** Damage state for one occurrence; no cast eligibility or trigger-history fields cross this boundary. */
export interface SkillDamageContext {
  readonly startingWeaponSet?: number;
  readonly initialResource?: number;
  readonly profession?: Readonly<Record<string, unknown>>;
}

export type DamageUnit = 'activation' | 'occurrence' | 'charge' | 'pulse';
export type DamageInputs = Readonly<Record<string, number | string | boolean>>;
export type DamageEffectReference =
  | { readonly kind: 'skill'; readonly id: SkillId }
  | { readonly kind: 'profile'; readonly id: SkillId; readonly ownerId: SkillId }
  | { readonly kind: 'relic'; readonly id: number }
  | { readonly kind: 'sigil'; readonly id: number }
  | { readonly kind: 'food'; readonly id: string }
  | { readonly kind: 'profession'; readonly id: string };

/** One assumed occurrence, evaluated directly using the content owner's payload. */
export interface SkillDamageOccurrence {
  readonly id: string;
  readonly effect: DamageEffectReference;
  readonly name: string;
  readonly source: 'Skill' | 'Profession' | 'Trait' | 'Relic' | 'Sigil' | 'Rune' | 'Food';
  readonly icon: string;
  readonly unit: DamageUnit;
  readonly inputs?: DamageInputs;
  readonly assumptions?: readonly string[];
  readonly cast?: Partial<SkillDamageCastOptions>;
  readonly config?: SkillDamageContext;
  readonly variants?: readonly {
    readonly id: string;
    readonly label: string;
    readonly inputs?: DamageInputs;
    readonly cast?: Partial<SkillDamageCastOptions>;
  }[];
  readonly primaryVariantId?: string;
}

export interface SkillDamageRequest {
  readonly config: Gw2Config;
  readonly occurrences: readonly SkillDamageOccurrence[];
}

/** Strike facts aggregated from the measured cast's damage diagnostics. */
export interface SkillDamageStrikeBreakdown {
  readonly weaponStrength: number | null;
  readonly power: number;
  /** Totals across counted hits, before modifiers, without crits, at crit, and the averaged result. */
  readonly baseDamage: number;
  readonly nonCriticalDamage: number;
  readonly criticalDamage: number;
  readonly averageDamage: number;
  readonly criticalChance: number;
  readonly criticalDamageMultiplier: number;
  readonly averagedCriticalMultiplier: number;
  readonly outgoingMultiplier: number;
  readonly contributors: readonly Gw2ModifierContribution[];
  /** True when hits used different outgoing multipliers; the breakdown then shows the first hit's factors. */
  readonly variesAcrossHits: boolean;
}

/** One damaging condition the measured cast applied, aggregated across its applications. */
export interface SkillDamageConditionRow {
  readonly condition: string;
  readonly stacks: number;
  readonly baseDurationSeconds: number;
  readonly effectiveDurationSeconds: number;
  readonly durationMultiplier: number;
  readonly baseDurationMultiplier: number;
  readonly durationContributors: readonly Gw2ModifierContribution[];
  readonly conditionDamage: number | null;
  /** Damage per stack-second before outgoing condition modifiers, from the first damaging sample. */
  readonly rate: number | null;
  readonly multiplier: number | null;
  readonly damageContributors: readonly Gw2ModifierContribution[];
  readonly damage: number;
}

/** The damage of one measured cast. */
export interface SkillDamageMeasurement {
  readonly castSeconds: number;
  readonly hits: number;
  readonly coefficient: number;
  readonly strike: number;
  readonly conditionDamage: number;
  readonly total: number;
  readonly strikeBreakdown: SkillDamageStrikeBreakdown | null;
  readonly conditions: readonly SkillDamageConditionRow[];
}

export type DamageCalculationStatus = 'measured' | 'zero' | 'missing-input' | 'unsupported' | 'failed';

export interface SkillDamageVariantMeasurement {
  readonly id: string;
  readonly label: string;
  readonly measurement: SkillDamageMeasurement | null;
  readonly status: DamageCalculationStatus;
  readonly reason?: string;
}

/** Failure is a calculation issue, never a statement about whether an occurrence can activate. */
export interface SkillDamageOccurrenceResult {
  readonly id: string;
  readonly measurement: SkillDamageMeasurement | null;
  readonly status: DamageCalculationStatus;
  readonly reason?: string;
  readonly assumptions: readonly string[];
  readonly unit: DamageUnit;
  readonly damaging: boolean;
  readonly variants: readonly SkillDamageVariantMeasurement[];
  readonly primaryVariantId?: string;
}

export interface SkillDamageEvaluation {
  readonly occurrences: readonly SkillDamageOccurrenceResult[];
}
