import type { Gw2ModifierContribution } from '#gw2/platform/combat/modifiers.js';
import type { CastCommand } from '#gw2/platform/execution/types.js';
import type { MechanicContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
/** Serializable skill damage preview contracts shared by the application, its worker, and the evaluator. */

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
  /** Panel-wide damage state, shared by the stat strip and each occurrence before row-specific overrides. */
  readonly inputs?: DamageInputs;
  readonly occurrences: readonly SkillDamageOccurrence[];
}

/** Strike facts aggregated from the measured cast's damage diagnostics. */
export interface SkillDamageStrikeBreakdown {
  readonly weaponStrength: number | null;
  readonly power: number;
  /** Totals across counted hits, before modifiers, without crits, and at crit. */
  readonly baseDamage: number;
  readonly nonCriticalDamage: number;
  readonly criticalDamage: number;
  readonly criticalChance: number;
  readonly criticalDamageMultiplier: number;
  readonly averagedCriticalMultiplier: number;
  readonly outgoingMultiplier: number;
  readonly contributors: readonly Gw2ModifierContribution[];
  /** True when hit inputs or factors differ; first-hit details cannot explain the total with one formula. */
  readonly variesAcrossHits: boolean;
}

/** Applications of a damaging condition with matching duration and sampled damage facts, aggregated into one row. */
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

/** Content owns damage state independently of the combat history normally needed to reach it. */
export interface DamageEffectDefinition {
  readonly id: string;
  readonly name: string;
  readonly icon?: string;
  readonly source: 'Profession' | 'Trait';
  readonly ownerId?: SkillId;
  readonly unit: DamageUnit;
  readonly inputs?: DamageInputs;
  readonly assumptions?: readonly string[];
  readonly sourceIds: readonly SkillId[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Heterogeneous content retains the selected profession's runtime at dispatch.
  readonly emit: (runtime: MechanicContext<any>, inputs: DamageInputs) => void;
}

/** Cast-command fields an occurrence may set on its measured cast, such as a Dragon Charge release threshold. */
export type SkillDamageCastOptions = Pick<CastCommand, 'releaseAtCharges' | 'releaseDelayMs' | 'doubleEdgeOutcome'>;
