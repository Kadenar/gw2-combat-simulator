import type { Gw2CriticalChanceContributor } from '#gw2/platform/combat/query/combat-query.js';
import type { SimulationEvent } from '#gw2/platform/events/events.js';
import type { Gw2ConditionWork } from '#gw2/platform/resolver/condition-resolution.js';
import type { Gw2ResolverRuntime } from '#gw2/platform/resolver/runtime-state.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import type { StableEventQueue } from '#kernel/events/queue.js';

/** Resolver event, breakdown, and reaction contracts; resolution consumes kernel randomness without execution dependencies. */

export type Gw2ResolverEvent = SimulationEvent &
  Gw2ConditionWork & {
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

export interface Gw2ConditionBreakdownEntry {
  name: string;
  damage: number;
  stackSeconds: number;
}

interface Gw2EnvironmentConditionTick {
  readonly at: number;
  readonly damage: number;
}

export interface Gw2EnvironmentConditionBreakdownEntry extends Gw2ConditionBreakdownEntry {
  readonly stacks: number;
  bufferedRate?: number;
  damageTicks: Gw2EnvironmentConditionTick[];
}

export interface Gw2ProcStep {
  ri: number;
  type: string;
  skill: string;
  sourceSkill: string;
  detail: string;
  icon: string;
  start: number;
  end: number;
  cooldownReduction?: number;
  /** Absolute effect-expiry time in milliseconds when the proc starts a timed state. */
  expiresAt?: number;
  /** Stack state after activation; a missing expiry keeps it until the next state or the result horizon. */
  effectState?: { readonly stacks: number; readonly maximumStacks: number };
}

export interface Gw2ResolverHelpers {
  readonly balanceDataContext?: { readonly professionId: string; readonly patchId: string };
  conditionName(value: unknown): string;
  readonly skillsById?: ReadonlyMap<import('#gw2/platform/skills/types.js').SkillId, Skill>;
  readonly skillsByName?: ReadonlyMap<string, Skill>;
  readonly balanceProfilesById?: ReadonlyMap<
    import('#gw2/platform/skills/types.js').SkillId,
    import('#gw2/platform/skills/types.js').BalanceProfile
  >;
}

export type Gw2EventQueue = StableEventQueue<Gw2ResolverEvent>;

type Gw2ResolverEventHandler = (context: Gw2ResolverRuntime, event: Gw2ResolverEvent) => unknown;

export type Gw2ResolverEventHandlers = Readonly<Record<string, Gw2ResolverEventHandler>>;

export type Gw2ResolverReaction = (
  context: Gw2ResolverRuntime,
  event: Gw2ResolverEvent,
  details?: Record<string, unknown>
) => Record<string, unknown> | void;

export type Gw2ResolverStage =
  | 'aura.applied'
  | 'combo.resolved'
  | 'buff.applied'
  | 'damage.resolving'
  | 'damage.resolved'
  | 'condition.applied'
  | 'condition-tick.resolved'
  | 'control.resolved';

export type Gw2ResolverReactions = Readonly<Partial<Record<Gw2ResolverStage, Gw2ResolverReaction>>>;

interface Gw2ResolverReactionHook {
  readonly id: string;
  readonly order: number;
  readonly handler: Gw2ResolverReaction;
}

export type Gw2ResolverReactionContributions = Readonly<
  Partial<Record<Gw2ResolverStage, readonly Gw2ResolverReactionHook[]>>
>;

export interface Gw2ResolverReactionRegistry {
  dispatch(
    stage: Gw2ResolverStage,
    context: Gw2ResolverRuntime,
    event: Gw2ResolverEvent,
    details?: Record<string, unknown>
  ): Record<string, unknown> | void;
}
