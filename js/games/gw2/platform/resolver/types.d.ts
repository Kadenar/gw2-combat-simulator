/** Owns the resolver/types.d.ts contracts so type dependencies follow their runtime feature boundaries. */
import type { StableEventQueue } from '#kernel/events/queue.js';
import type { HandlerRegistry } from '#gw2/platform/engine/resolution/handler-registry.js';
import type {
  ScheduledEventStream,
  SchedulerRecord,
  SimulationActorType,
  SimulationEvent,
  SimulationRandom,
  Skill
} from '#gw2/platform/engine/types.js';
import type {
  Gw2CombatQuery,
  Gw2CriticalChanceContributor,
  Gw2CriticalResult,
  Gw2QueryRuntime,
  Gw2ResolvedStats
} from '#gw2/platform/combat/query/types.js';
import type {
  Gw2RuntimeConditionEntry,
  Gw2RuntimeConditionStack,
  Gw2TimedBuffApplication
} from '#gw2/platform/combat/state/types.js';
import type { Gw2ComboRuntimeState } from '#gw2/platform/combos/types.js';
import type { Gw2EventDraft, Gw2RelicRuntime } from '#gw2/platform/equipment/relics/types.js';
import type { Gw2ResolvedWeaponStrength } from '#gw2/platform/equipment/types.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';

export type Gw2ResolverEvent = SimulationEvent & {
  readonly name?: string;
  readonly skillName?: string;
  readonly parentSkillName?: string;
  readonly damageBreakdownName?: string;
  readonly skillId?: import('#gw2/platform/engine/types.js').SkillId | null;
  readonly icon?: string;
  readonly kind?: string;
  readonly duration?: number;
  readonly stacks?: number;
  readonly condition?: string;
  readonly application?: Gw2ResolvedConditionApplication;
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
  readonly weaponSet?: number;
  readonly procType?: string;
  readonly sourceSkill?: string;
  readonly detail?: string;
  readonly cooldownReduction?: number;
  readonly activationId?: string;
  readonly weaponStrength?: number;
  readonly weaponStrengthProfileId?: string;
  readonly resolvedWeaponStrength?: number;
  readonly weaponStrengthSampled?: boolean;
};

export type Gw2ResolvedConditionApplication = Gw2ResolverEvent & {
  readonly name: string;
  readonly condition: string;
  readonly stacks: number;
  readonly effectiveDuration: number;
  readonly activeDuration: number;
  readonly expiresAt: number;
  readonly naturalExpiresAt: number;
  removedAt?: number;
  damage: number;
  damagingStackSeconds: number;
  readonly damageTicks: Array<{
    at: number;
    damage: number;
    fraction: number;
  }>;
};

export interface Gw2ResolverConditionStack extends Gw2RuntimeConditionStack {
  appliedAt: number;
  expiresAt: number;
  weight: number;
  application: Gw2ResolvedConditionApplication;
}

export interface Gw2ResolverConditionState extends Gw2RuntimeConditionEntry {
  stacks: Gw2ResolverConditionStack[];
}

export interface Gw2DamageBreakdownEntry {
  name: string;
  sourceSkill: string;
  parentSkill: string;
  damageBreakdownName?: string;
  icon: string;
  skillId?: import('#gw2/platform/engine/types.js').SkillId | null;
  sourceId?: import('#gw2/platform/engine/types.js').SkillId;
  actorType?: SimulationActorType;
  summonKind?: string;
  source?: string;
  damage: number;
  strikeDamage: number;
  conditionDamage: number;
  hits: number;
  casts?: number;
  // Crit accounting is tracked only for strike hits. critHits is the expected
  // (deterministic) or actual (stochastic) number of critical strikes;
  // critEligibleHits is the number of strike hits those crits are drawn from.
  critHits?: number;
  critEligibleHits?: number;
}

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
}

export interface Gw2ResolverHelpers extends SchedulerRecord {
  conditionName(value: unknown): string;
  readonly skillsById?: ReadonlyMap<import('#gw2/platform/engine/types.js').SkillId, Skill>;
  readonly skillsByName?: ReadonlyMap<string, Skill>;
  readonly balanceProfilesById?: ReadonlyMap<
    import('#gw2/platform/engine/types.js').SkillId,
    import('#gw2/platform/engine/types.js').BalanceProfile
  >;
}

export type Gw2EventQueue = Gw2ResolverEvent[] | StableEventQueue<Gw2ResolverEvent>;

export interface Gw2ResolverRuntime extends SchedulerRecord {
  config: Gw2Config;
  traits: ReadonlySet<string | number>;
  horizon: number;
  query: Readonly<Gw2CombatQuery>;
  helpers: Gw2ResolverHelpers;
  queue: Gw2EventQueue;
  warnings: string[];
  eventFilterState: object;
  breakdown: Map<string, Gw2DamageBreakdownEntry>;
  conditions: Map<string, Gw2ConditionBreakdownEntry>;
  environmentDamage: number;
  environmentConditions: Map<string, Gw2EnvironmentConditionBreakdownEntry>;
  conditionState: Map<string, Gw2ResolverConditionState>;
  conditionApplications: Gw2ResolvedConditionApplication[];
  resolved: Gw2ResolverEvent[];
  procSteps: Gw2ProcStep[];
  procKeys: Set<string>;
  boons: Map<string, Gw2TimedBuffApplication[]>;
  totals: { strike: number; condition: number };
  firstHitTime: number | null;
  lastHitTime: number | null;
  deathTime: number | null;
  combatStartTime?: number | null;
  activeWeaponSet: number;
  combo: Gw2ComboRuntimeState;
  relic: Gw2RelicRuntime;
  profession: object;
  sigil: {
    severanceUntil: number;
    criticalProgress: number;
    readyAt: Map<string, number>;
  };
  food: { criticalProgress: number; readyAt: number };
  random: Readonly<SimulationRandom>;
  weaponStrengthRolls: Map<string, { profileId: string; value: number }>;
  weaponStrengthActivationOrder: number;
  dispatchReaction(stage: Gw2ResolverStage, event: Gw2ResolverEvent, details?: SchedulerRecord): SchedulerRecord | void;
  applyCondition(event: Gw2EventDraft): Gw2ResolvedConditionApplication | null;
  recordProc(
    type: string,
    name: string,
    at: number,
    sourceSkill?: string,
    detail?: string,
    icon?: string,
    cooldownReduction?: number | null,
    expiresAt?: number | null
  ): void;
  addBreakdown(
    name: string,
    damage: number,
    type: 'strikeDamage' | 'conditionDamage',
    hits?: number,
    source?: Gw2ResolverEvent | null,
    critical?: Gw2CriticalResult | null
  ): void;
  markDamageTime(at: number): void;
}

export interface Gw2HitResolutionContext {
  readonly stats: Gw2ResolvedStats;
  readonly critical: Gw2CriticalResult;
  // Whether this strike can crit at all (scaling strike, not flagged noCrit /
  // canCrit=false). Non-eligible hits are excluded from crit-rate reporting.
  readonly critEligible: boolean;
  readonly criticalMultiplier: number;
  readonly outgoingMultiplier: number;
  readonly weaponStrength: Gw2ResolvedWeaponStrength | null;
  readonly baseDamage: number;
  readonly damage: number;
}

export interface Gw2HitResolution {
  buildHitResolutionContext(context: Gw2ResolverRuntime, event: Gw2ResolverEvent): Gw2HitResolutionContext;
  applyResolvedHit(
    context: Gw2ResolverRuntime,
    event: Gw2ResolverEvent,
    hit: Gw2HitResolutionContext
  ): Gw2ResolverEvent;
}

export interface Gw2ConditionTickResult {
  readonly application: Gw2ResolvedConditionApplication;
  readonly damage: number;
  readonly fraction: number;
  readonly perStack: number;
  readonly stackSeconds: number;
}

export interface Gw2ConditionResolution {
  activeConditionStackCount(context: Gw2ResolverRuntime, name: string, at: number): number;
  applyCondition(context: Gw2ResolverRuntime, event: Gw2EventDraft): Gw2ResolvedConditionApplication | null;
  handleConditionTick(context: Gw2ResolverRuntime, event: Gw2ResolverEvent): Gw2ConditionTickResult | null;
  initializeEnvironment(context: Gw2ResolverRuntime): void;
  handleEnvironmentConditionTick(context: Gw2ResolverRuntime, event: Gw2ResolverEvent): void;
}

export type Gw2ResolverEventHandler = (context: Gw2ResolverRuntime, event: Gw2ResolverEvent) => unknown;

export type Gw2ResolverEventHandlers = Readonly<Record<string, Gw2ResolverEventHandler>>;

export type Gw2ResolverHandlerRegistry = HandlerRegistry<Gw2ResolverRuntime, Gw2ResolverEvent>;

export type Gw2ResolverReaction = (
  context: Gw2ResolverRuntime,
  event: Gw2ResolverEvent,
  details?: SchedulerRecord
) => SchedulerRecord | void;

export type Gw2ResolverStage =
  | 'aura.applied'
  | 'combo.resolved'
  | 'buff.applied'
  | 'damage.resolved'
  | 'condition.applied'
  | 'condition-tick.resolved'
  | 'control.resolved'
  | 'blind.resolved'
  | 'peitha.resolved'
  | 'weakness-vulnerability.resolved'
  | 'weapon-set.changed'
  | 'food-proc.created';

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
    details?: SchedulerRecord
  ): SchedulerRecord | void;
}

export interface Gw2ResolverExtensions {
  readonly reactions: Gw2ResolverReactionRegistry;
  readonly createEquipmentState: (config: Gw2Config) => Pick<Gw2ResolverRuntime, 'relic' | 'sigil' | 'food'>;
  readonly strikeMultiplier: (context: Gw2ResolverRuntime, event: Gw2ResolverEvent) => number;
  readonly conditionDurationBonus: (context: Gw2QueryRuntime | null | undefined, at: number) => number;
  readonly beforeResolveTimeline: (
    context: Gw2ResolverRuntime,
    events: readonly Gw2ResolverEvent[],
    rotationEndTime: number
  ) => void;
}

export interface Gw2ResolverResult extends SchedulerRecord {
  readonly duration: number;
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
  readonly profession: object;
}

export interface ResolveGw2TimelineOptions {
  readonly stream: ScheduledEventStream;
  readonly config: Gw2Config;
  readonly traits: ReadonlySet<string | number>;
  readonly query: Readonly<Gw2CombatQuery>;
  readonly helpers: Gw2ResolverHelpers;
  readonly createRuntimeState: (
    options: Omit<CreateGw2ResolverRuntimeStateOptions, 'applyCondition' | 'createEquipmentState'>
  ) => Gw2ResolverRuntime;
  readonly commonHandlers: Gw2ResolverEventHandlers;
  readonly reactions?: Gw2ResolverReactionRegistry;
  readonly beforeResolveTimeline: Gw2ResolverExtensions['beforeResolveTimeline'];
  readonly initializeEnvironment: Gw2ConditionResolution['initializeEnvironment'];
  readonly professionHandlers?: Gw2ResolverEventHandlers;
  readonly professionState?: object;
  readonly eventFilterState?: object;
  readonly shouldSkipEvent?: (context: Gw2ResolverRuntime, event: Gw2ResolverEvent) => boolean;
}

export interface CreateGw2ResolverRuntimeStateOptions {
  readonly config: Gw2Config;
  readonly traits?: ReadonlySet<string | number>;
  readonly horizon: number;
  readonly query: Readonly<Gw2CombatQuery>;
  readonly helpers: Gw2ResolverHelpers;
  readonly queue: Gw2EventQueue;
  readonly professionState?: object;
  readonly warnings?: string[];
  readonly eventFilterState?: object;
  readonly applyCondition: Gw2ConditionResolution['applyCondition'];
  readonly createEquipmentState: Gw2ResolverExtensions['createEquipmentState'];
  readonly reactions?: Gw2ResolverReactionRegistry;
}
