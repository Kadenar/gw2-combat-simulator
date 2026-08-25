/** Owns the combat/modifiers/types.d.ts contracts so type dependencies follow their runtime feature boundaries. */
import type { CatalogEntity, SchedulerRecord, SimulationEvent } from '../../../engine/types.js';
import type {
  Gw2CombatQuery,
  Gw2CriticalChanceContributor,
  Gw2QueryRuntime,
  Gw2ResolvedStats,
  Gw2TimelineIndex
} from '../query/types.js';
import type { Gw2Config } from '../../simulation/config.js';

export type Gw2ModifierTarget =
  | 'criticalChance'
  | 'criticalDamage'
  | 'strikeDamage'
  | 'conditionDamage'
  | 'conditionDuration'
  | 'attributePower'
  | 'attributePrecision'
  | 'attributeFerocity'
  | 'attributeConditionDamage'
  | 'attributeHealingPower'
  | 'attributeVitality';

export type Gw2DamageModifierTarget = 'strikeDamage' | 'conditionDamage';

export type Gw2ModifierOperation = 'add' | 'damage-additive' | 'multiply';

export interface Gw2ModifierContext extends SchedulerRecord {
  readonly config?: Gw2Config;
  readonly time: number;
  readonly event?: SimulationEvent | null;
  readonly condition?: string | null;
  readonly traits?: ReadonlySet<string | number>;
  readonly query?: Readonly<Gw2CombatQuery>;
  readonly timeline?: Readonly<Gw2TimelineIndex>;
  readonly events?: readonly SimulationEvent[];
  readonly runtime?: Gw2QueryRuntime | null;
  readonly damageAdditiveBonus?: number;
  readonly criticalChanceContributors?: Gw2CriticalChanceContributor[];
}

export interface Gw2TraitContext extends SchedulerRecord {
  readonly traits?: ReadonlySet<string | number>;
  readonly config?: Gw2Config;
  readonly catalog?: { readonly traits?: readonly CatalogEntity[] };
}

export type Gw2ModifierNumericResolver = (
  context: Gw2ModifierContext,
  target: Gw2ModifierTarget,
  parameters: Readonly<Record<string, number>>
) => number;

export interface Gw2ModifierRule {
  readonly id: string;
  readonly label?: string;
  readonly target: Gw2ModifierTarget | readonly Gw2ModifierTarget[];
  readonly operation: Gw2ModifierOperation;
  readonly amount?: number | Gw2ModifierNumericResolver;
  readonly factor?: number | Gw2ModifierNumericResolver;
  /** Named patchable inputs for resolver-backed amounts or factors. */
  readonly parameters?: Readonly<Record<string, number>>;
  readonly when?: (context: Gw2ModifierContext) => boolean;
  readonly order?: number;
}

export interface Gw2NormalizedModifierRule {
  readonly id: string;
  readonly label: string | null;
  readonly targets: readonly Gw2ModifierTarget[];
  readonly operation: Gw2ModifierOperation;
  readonly amount?: number | Gw2ModifierNumericResolver;
  readonly factor?: number | Gw2ModifierNumericResolver;
  readonly parameters: Readonly<Record<string, number>>;
  readonly when: ((context: Gw2ModifierContext) => boolean) | null;
  readonly order: number;
  readonly declarationIndex: number;
}

export type Gw2IncludeSigilPolicy = boolean | ((context: Gw2ModifierContext) => boolean);

export interface Gw2DamageBucketPolicy {
  readonly includeSigil: Gw2IncludeSigilPolicy;
}

export type Gw2DamageBucketPolicies = Partial<
  Record<Gw2DamageModifierTarget, { readonly includeSigil?: Gw2IncludeSigilPolicy }>
>;

export type Gw2ModifierHook = (context: Gw2ModifierContext, initialValue: number) => number;

export type Gw2AttributeModifierHook = (
  context: Gw2ModifierContext,
  initialValue: Gw2ResolvedStats
) => Gw2ResolvedStats;

export interface Gw2ModifierHooks {
  readonly modifyAttributes: Gw2AttributeModifierHook;
  readonly modifyCriticalChance: Gw2ModifierHook;
  readonly modifyCriticalDamage: Gw2ModifierHook;
  readonly modifyStrikeDamage: Gw2ModifierHook;
  readonly modifyConditionDamage: Gw2ModifierHook;
  readonly modifyConditionDuration: Gw2ModifierHook;
}
