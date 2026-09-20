import type { CriticalSigilDiagnostics } from '#gw2/platform/equipment/sigils/diagnostics.js';
import type { Gw2CombatQuery, Gw2CriticalChanceContributor } from '#gw2/platform/combat/query/combat-query.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import type { ScheduledEventStream } from '#gw2/platform/engine/events/scheduled-stream.js';
import type { HandlerRegistry } from '#gw2/platform/engine/resolution/handler-registry.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import type { Gw2ConditionWork } from '#gw2/platform/resolver/condition-resolution.js';
import type { Gw2DamageBreakdownEntry } from '#gw2/platform/resolver/hit-resolution.js';
import type { Gw2ResolverRuntime } from '#gw2/platform/resolver/runtime-state.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import type { Gw2ProfessionContract } from '#gw2/platform/simulation/types.js';
import type { SimulationRandom } from '#kernel/core/simulation-random.js';
import type { StableEventQueue } from '#kernel/events/queue.js';

/** Owns the resolver/types.ts contracts so type dependencies follow their runtime feature boundaries. */

// Resolution consumes kernel randomness and generic records without execution dependencies.

export type Gw2ResolverEvent = SimulationEvent &
  Gw2ConditionWork & {
    readonly damageBreakdownName?: string;
    readonly skillId?: import('#gw2/platform/engine/skills/types.js').SkillId | null;
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
    readonly noCrit?: boolean;
    readonly forceCrit?: boolean;
    readonly canTriggerCriticalTraits?: boolean;
    /**
     * Resolver's derived verdict on whether the strike could crit: false for flat
     * strikes and for `noCrit`/`canCrit:false` hits. Consumers should read this
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

export interface Gw2EnvironmentConditionTick {
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
  conditionName(value: unknown): string;
  readonly skillsById?: ReadonlyMap<import('#gw2/platform/engine/skills/types.js').SkillId, Skill>;
  readonly skillsByName?: ReadonlyMap<string, Skill>;
  readonly balanceProfilesById?: ReadonlyMap<
    import('#gw2/platform/engine/skills/types.js').SkillId,
    import('#gw2/platform/engine/skills/types.js').BalanceProfile
  >;
}

export type Gw2EventQueue = StableEventQueue<Gw2ResolverEvent>;

export type Gw2ResolverEventHandler = (context: Gw2ResolverRuntime, event: Gw2ResolverEvent) => unknown;

export type Gw2ResolverEventHandlers = Readonly<Record<string, Gw2ResolverEventHandler>>;

export type Gw2ResolverHandlerRegistry = HandlerRegistry<Gw2ResolverRuntime, Gw2ResolverEvent>;

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
  | 'control.resolved'
  | 'blind.resolved'
  | 'peitha.resolved';

export type Gw2ResolverReactions = Readonly<Partial<Record<Gw2ResolverStage, Gw2ResolverReaction>>>;

export interface Gw2ResolverReactionHook {
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

export interface Gw2ResolverResult {
  /** Absolute timeline boundaries in seconds, independent of the DPS start. */
  readonly rotationEndTime: number;
  readonly observationEndTime: number;
  readonly combatEndTime: number;
  readonly combatStartTime: number | null;
  readonly hasExplicitCombatStart: boolean;
  readonly dpsStartTime: number;
  readonly dpsWindow: number;
  readonly firstHitTime: number | null;
  readonly lastHitTime: number | null;
  readonly deathTime: number | null;
  readonly totalDamage: number;
  readonly dps: number;
  readonly strikeDamage: number;
  readonly conditionDamage: number;
  readonly environmentDamage: number;
  readonly environmentDps: number;
  readonly breakdown: Gw2DamageBreakdownEntry[];
  readonly conditionBreakdown: Array<{
    name: string;
    damage: number;
    dps: number;
    averageStacks: number;
  }>;
  readonly environmentConditionBreakdown: Array<{
    name: string;
    damage: number;
    dps: number;
    averageStacks: number;
    stacks: number;
    damageTicks: Gw2EnvironmentConditionTick[];
  }>;
  readonly events: readonly SimulationEvent[];
  readonly resolvedEvents: Gw2ResolverEvent[];
  readonly procSteps: Gw2ProcStep[];
  readonly warnings: string[];
  readonly casts: Array<{ name: string; count: number }>;
  readonly randomness: {
    mode: SimulationRandom['mode'];
    seed: number;
  };
  /** Resolved event state through combatEndTime, not a resumable player snapshot. */
  readonly combatState: {
    readonly atSeconds: number;
    readonly profession: object;
  };
}

export interface ResolveGw2TimelineOptions {
  readonly sigilDiagnostics?: CriticalSigilDiagnostics;
  readonly damageDiagnostics?: boolean;
  readonly onPhase?: (phase: 'resolution' | 'reporting', durationMs: number) => void;
  readonly output?: 'detailed' | 'score';
  readonly stream: ScheduledEventStream;
  readonly config: Gw2Config;
  readonly profession: Gw2ProfessionContract;
  readonly traits: ReadonlySet<string | number>;
  /** Focused resolver tests can supply combat facts independently of profession attributes. */
  readonly query?: Readonly<Gw2CombatQuery>;
  readonly helpers?: Gw2ResolverHelpers;
}
