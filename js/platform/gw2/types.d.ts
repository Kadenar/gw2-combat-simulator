import type {
  CanonicalCatalog,
  NormalizedProfessionContract,
  ProfessionSource,
  ScheduledEventStream,
  SchedulerRunResult,
  SchedulerState,
  SchedulerStep,
  SchedulerRecord,
  SimulationRandom,
  SimulationRandomnessConfig,
  SimulationActorType,
  SimulationEvent,
  SimulationEventBase,
  Skill,
  ScheduledTask,
  SchedulerContext,
  SchedulerPolicy,
} from "../engine/types.js";
import type { StableEventQueue } from "../engine/event-queue.js";
import type { HandlerRegistry } from "../engine/handler-registry.js";

export type ComboFieldType =
  | "Dark"
  | "Ethereal"
  | "Fire"
  | "Ice"
  | "Light"
  | "Lightning"
  | "Poison"
  | "Smoke"
  | "Water";

export type ComboFinisherType = "Blast" | "Leap" | "Projectile" | "Whirl";

export type ComboFieldBinding =
  | { readonly kind: "field-id"; readonly fieldId: string }
  | { readonly kind: "field-type"; readonly fieldType: ComboFieldType }
  | { readonly kind: "none" };

export interface ComboFieldEvent extends SimulationEventBase<"combo_field"> {
  readonly fieldId: string;
  readonly fieldType: ComboFieldType;
  readonly expiresAt: number;
  readonly ownerId: string;
  readonly ownerActorType: SimulationActorType;
}

export interface ComboFinisherEvent extends SimulationEventBase<"combo_finisher"> {
  readonly attemptId: string;
  readonly finisherType: ComboFinisherType;
  readonly fieldBinding: ComboFieldBinding;
  readonly effectAt: number;
  readonly chance: number;
  readonly applications: number;
  readonly successfulCombos: number;
  readonly parentEventOrder?: number;
}

export interface ComboEvent extends SimulationEventBase<"combo"> {
  readonly comboId: string;
  readonly attemptId: string;
  readonly fieldId: string;
  readonly fieldType: ComboFieldType;
  readonly finisherType: ComboFinisherType;
  readonly fieldSourceId: import("../engine/types.js").SkillId;
  readonly bindingKind: ComboFieldBinding["kind"];
  readonly applicationCount: number;
  readonly outcome: Readonly<Record<string, unknown>>;
}

export interface Gw2ComboRuntimeState extends SchedulerRecord {
  readonly fields: Map<string, ComboFieldEvent>;
  readonly handledAttemptIds: Set<string>;
  readonly deterministicProgress: Map<string, number>;
  readonly warningKeys: Set<string>;
}

export interface Gw2Stats extends SchedulerRecord {
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
  readonly boonDurationBonuses?: Readonly<Record<string, number>>;
  readonly conditionDurationBonus?: number;
  readonly conditionDurationBonuses?: Readonly<Record<string, number>>;
  readonly criticalChanceBonus?: number;
}

export interface Gw2SigilSet extends SchedulerRecord {
  readonly names?: readonly string[];
  readonly boonDurationBonus?: number;
  readonly criticalChanceBonus?: number;
  readonly strikeAdd?: number;
  readonly strike?: number;
  readonly nightStrikeMultiplier?: number;
  readonly conditionAdd?: number;
  readonly condition?: number;
  readonly conditionDurationBonus?: number;
  readonly conditionDurationBonuses?: Readonly<Record<string, number>>;
}

export interface Gw2WeaponDataEntry {
  readonly wielding: string;
  readonly weaponStrengthProfileId: string;
  readonly weaponStrength: number;
}

export interface Gw2WeaponStrengthProfile {
  readonly id: string;
  readonly min: number;
  readonly max: number;
}

export interface Gw2ResolvedWeaponStrength {
  readonly activationId: string | null;
  readonly profileId: string;
  readonly value: number;
  readonly sampled: boolean;
}

export interface Gw2SigilProc extends SchedulerRecord {
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

export interface Gw2Config extends SchedulerRecord {
  readonly stats?: Gw2Stats;
  readonly weaponSetStats?: readonly Gw2Stats[];
  readonly attributes?: Gw2Stats;
  readonly boons?: Readonly<Record<string, boolean | number>>;
  readonly sharePlayerBoonsWithSummons?: boolean;
  readonly startingWeaponSet?: number;
  readonly primaryWeapon?: string;
  readonly secondaryWeapon?: string;
  readonly weaponSet2Primary?: string;
  readonly weaponSet2Secondary?: string;
  readonly sigilSets?: readonly Gw2SigilSet[];
  readonly traitIds?: readonly (string | number)[];
  readonly selectedTraitIds?: readonly (string | number)[];
  readonly selectedTraits?: readonly (string | number)[];
  readonly relic?: string;
  readonly food?: string;
  readonly timeOfDay?: "day" | "night";
  readonly randomness?: SimulationRandomnessConfig;
  readonly attributeProvenance?: Partial<Gw2AttributeProvenance>;
  readonly alacrityRechargeRate?: number;
  readonly target?: Gw2TargetConfig;
  readonly modifiers?: {
    readonly strike?: number;
    readonly condition?: number;
  };
}

export type Gw2BuffAudience = "all" | "summon" | "summon-trait";

export interface Gw2TargetConfig extends SchedulerRecord {
  readonly vulnerability?: number | boolean;
  readonly slowed?: number | boolean;
  readonly conditions?: Readonly<Record<string, number | boolean>>;
  readonly health?: number;
  readonly armor?: number;
  readonly moving?: boolean;
  readonly confusionActivationsPerSecond?: number;
  readonly disabled?: boolean;
  readonly defianceBroken?: boolean;
}

export interface Gw2RuntimeConditionStack extends SchedulerRecord {
  readonly appliedAt?: number;
  readonly expiresAt?: number;
  readonly removedAt?: number;
  readonly weight?: number;
  readonly stacks?: number;
}

export interface Gw2RuntimeConditionEntry extends SchedulerRecord {
  readonly stacks: Gw2RuntimeConditionStack[];
}

export interface Gw2RuntimeStateLike extends SchedulerRecord {
  readonly conditionState?: Map<string, Gw2RuntimeConditionEntry>;
}

export interface Gw2TimedBuffApplication {
  readonly at: number;
  readonly expiresAt: number;
  readonly stacks: number;
  readonly source?: string;
  readonly affectsSelf?: boolean;
  readonly affectsSummons?: boolean;
  readonly alliedPlayerCount?: number;
  readonly companionIds?: readonly string[];
  readonly recipientCount?: number;
}

export interface Gw2RelicState extends SchedulerRecord {
  readyAt?: number;
  buffUntil?: number;
  stacks?: number;
  expiresAt?: number;
}

export interface Gw2RelicRuntimeContext extends SchedulerRecord {
  readonly combatStartTime?: number | null;
  readonly relic?: Gw2RelicRuntime;
}

export interface Gw2RelicMaterializerContext {
  emitDerived(cause: SimulationEvent, event: Gw2EventDraft): SimulationEvent;
}

export interface Gw2RelicContext extends SchedulerRecord {
  readonly config: Gw2Config;
  readonly totals: { strike: number; condition: number };
  readonly resolved: SchedulerRecord[];
  readonly queue: Gw2EventQueue;
  readonly combatStartTime?: number | null;
  readonly relic?: Gw2RelicRuntime;
  recordProc(
    kind: string,
    name: string,
    at: number,
    sourceSkill?: string,
    detail?: string,
    icon?: string,
    cooldownReduction?: number | null,
  ): unknown;
  addBreakdown(
    name: string,
    amount: number,
    kind: string,
    hits?: unknown,
  ): unknown;
}

export interface Gw2EventDraft extends SchedulerRecord {
  readonly type: string;
  readonly at: number;
  readonly source: string;
  readonly sourceId?: import("../engine/types.js").SkillId;
  readonly actorType?: SimulationActorType;
  readonly name?: string;
  readonly skillName?: string;
  readonly parentSkillName?: string;
  readonly damageBreakdownName?: string;
  readonly skillId?: import("../engine/types.js").SkillId | null;
  readonly icon?: string;
  readonly kind?: string;
  readonly duration?: number;
  readonly stacks?: number;
  readonly condition?: string;
  readonly fixedDuration?: boolean;
}

export type Gw2ApplyCondition = (
  context: Gw2RelicContext,
  event: Gw2EventDraft,
) => unknown;

export interface Gw2ConditionHelpers {
  activeConditionStackCount(
    context: Gw2RelicContext,
    condition: string,
    at: number,
  ): number;
  applyCondition: Gw2ApplyCondition;
}

export interface Gw2RelicRule {
  readonly createState?: () => Gw2RelicState;
  readonly materializeBoon?: (
    context: Gw2RelicMaterializerContext,
    state: Gw2RelicState,
    event: SimulationEvent,
  ) => unknown;
  readonly materializeCondition?: (
    context: Gw2RelicMaterializerContext,
    state: Gw2RelicState,
    event: SimulationEvent,
  ) => unknown;
  readonly control?: (
    context: Gw2RelicContext,
    state: Gw2RelicState,
    event: SimulationEvent,
    helpers: Gw2ConditionHelpers,
  ) => unknown;
  readonly timeline?: (
    context: Gw2RelicContext,
    state: Gw2RelicState,
    events: readonly SimulationEvent[],
    rotationEndTime: number,
  ) => unknown;
  readonly weaknessVulnerability?: (
    context: Gw2RelicRuntimeContext,
    state: Gw2RelicState,
    event: SimulationEvent,
  ) => unknown;
  readonly boon?: (
    context: Gw2RelicContext,
    state: Gw2RelicState,
    event: SimulationEvent,
  ) => unknown;
  readonly blastCombo?: (
    context: Gw2RelicContext,
    state: Gw2RelicState,
    event: SimulationEvent,
  ) => unknown;
  readonly strikeMultiplier?: (
    context: Gw2RelicContext,
    state: Gw2RelicState,
    event: SimulationEvent,
  ) => number;
  readonly outgoingDamageBonus?: (
    context: Gw2RelicRuntimeContext,
    state: Gw2RelicState,
    damageType: "strike" | "condition",
    at: number,
    event: SimulationEvent | null,
  ) => number;
  readonly criticalChanceBonus?: (
    context: Gw2RelicRuntimeContext,
    state: Gw2RelicState,
    event: SimulationEvent,
    mightStacks: number,
  ) => number;
  readonly afterHit?: (
    context: Gw2RelicContext,
    state: Gw2RelicState,
    event: SimulationEvent,
    skill: Skill | null | undefined,
  ) => unknown;
  readonly conditionDurationBonus?: (
    context: Gw2RelicContext,
    state: Gw2RelicState,
    at: number,
  ) => number;
  readonly condition?: (
    context: Gw2RelicContext,
    state: Gw2RelicState,
    application: SimulationEvent,
    helpers: Gw2ConditionHelpers,
  ) => unknown;
  readonly damageResolved?: (
    context: Gw2RelicContext,
    state: Gw2RelicState,
    event: SimulationEvent,
  ) => unknown;
  readonly peitha?: (
    context: Gw2RelicContext,
    state: Gw2RelicState,
    event: SimulationEvent,
    applyCondition: Gw2ApplyCondition,
  ) => unknown;
}

export interface Gw2RelicRuntime {
  readonly name: string;
  readonly rules: Readonly<Gw2RelicRule>;
  readonly state: Gw2RelicState;
}

export interface Gw2QueryRuntime extends Gw2RuntimeStateLike {
  readonly boons?: Map<string, Gw2TimedBuffApplication[]>;
  readonly activeWeaponSet?: number;
  readonly sigil?: { readonly severanceUntil?: number };
  readonly relic?: Gw2RelicRuntime;
  readonly profession?: object | null;
}

export interface Gw2CriticalChanceContributor {
  readonly id: string;
  readonly label: string;
  readonly amount: number;
}

export interface Gw2CriticalResult {
  chance: number;
  damage: number;
  didCrit?: boolean | null;
  readonly chanceBeforeCap?: number;
  readonly contributors?: readonly Gw2CriticalChanceContributor[];
}

export interface Gw2CombatQuery {
  statsAt(
    time: number,
    event?: SimulationEvent | null,
    runtime?: Gw2QueryRuntime | null,
  ): Gw2ResolvedStats;
  mightStacksAt(
    time: number,
    runtime?: Gw2QueryRuntime | null,
    event?: SimulationEvent | null,
  ): number;
  furyActiveAt(
    time: number,
    runtime?: Gw2QueryRuntime | null,
    event?: SimulationEvent | null,
  ): boolean;
  vulnerabilityStacksAt(time: number, runtime?: Gw2QueryRuntime | null): number;
  critical(
    event: SimulationEvent,
    time: number,
    runtime?: Gw2QueryRuntime | null,
  ): Gw2CriticalResult;
  strikeMultiplier(
    event: SimulationEvent,
    time: number,
    runtime?: Gw2QueryRuntime | null,
  ): number;
  conditionMultiplier(
    name: string,
    time: number,
    event?: SimulationEvent | null,
    runtime?: Gw2QueryRuntime | null,
  ): number;
  conditionDurationMultiplier(
    name: string,
    time: number,
    stats?: Gw2ResolvedStats,
    event?: SimulationEvent | null,
    runtime?: Gw2QueryRuntime | null,
  ): number;
  conditionBaseDurationMultiplier(
    name: string,
    time: number,
    event?: SimulationEvent | null,
    runtime?: Gw2QueryRuntime | null,
  ): number;
  targetConditionStacks(
    condition: string,
    time: number,
    runtime?: Gw2QueryRuntime | null,
  ): number;
  targetHasCondition(
    condition: string,
    time: number,
    runtime?: Gw2QueryRuntime | null,
  ): boolean;
  readonly activeWeaponSetAt: Gw2TimelineIndex["activeWeaponSetAt"];
  readonly activeSigilSetAt: Gw2TimelineIndex["activeSigilSetAt"];
  readonly timedStacks: Gw2TimelineIndex["timedStacks"];
  readonly timeline: Readonly<Gw2TimelineIndex>;
}

export interface Gw2TriggerMaterializer {
  readonly state: SchedulerRecord;
  initialize(context: SchedulerContext): void;
  onEventScheduled(context: SchedulerContext, event: SimulationEvent): void;
  handleTask(
    context: SchedulerContext,
    task: ScheduledTask<SchedulerRecord>,
  ): void;
  critical(event: SimulationEvent): Gw2CriticalResult;
  rollRandom(probability: number, stream?: string): boolean;
  isCombatActive(): boolean;
  combatBeganAt(): number | null;
  requireCriticalFacts(): void;
}

export interface Gw2SchedulerPolicy extends SchedulerPolicy {
  critical(
    context: SchedulerContext,
    event: SimulationEvent,
  ): Gw2CriticalResult;
  rollRandom(probability: number, stream?: string): boolean;
  isCombatActive(): boolean;
  combatBeganAt(): number | null;
  requireCriticalFacts(): void;
}

export interface Gw2ResolvedStats extends SchedulerRecord {
  readonly power: number;
  readonly precision: number;
  readonly toughness: number;
  readonly vitality: number;
  readonly ferocity: number;
  readonly conditionDamage: number;
  readonly expertise: number;
  readonly concentration: number;
  readonly healingPower: number;
  readonly conditionDurationBonus: number;
  readonly conditionDurationBonuses: Readonly<Record<string, number>>;
}

export interface Gw2TimelineIndex {
  buffStacksAt(
    kind: string,
    time: number,
    duration: number,
    maximum: number,
    audience?: Gw2BuffAudience,
    companionId?: string | null,
  ): number;
  timedStacks(
    kind: string,
    time: number,
    duration: number,
    maximum: number,
  ): number;
  timedActive(kind: string, time: number): boolean;
  vigorActiveAt(time: number): boolean;
  activeWeaponSetAt(time: number): number;
  activeSigilSetAt(time: number): Gw2SigilSet;
  skillOnCooldownAt(
    skillId: import("../engine/types.js").SkillId,
    time: number,
  ): boolean;
}

export interface Gw2WeaponMatcherContext extends SchedulerRecord {
  readonly catalog?: CanonicalCatalog | null;
  readonly config?: Gw2Config;
  readonly state?: object;
  readonly weaponBarPreview?: boolean;
  readonly weaponData?: Readonly<
    Record<string, { readonly wielding?: string }>
  >;
}

export type Gw2WeaponSkillMatcher = (
  skill: Skill,
  weaponSet?: readonly (string | undefined)[],
  context?: Gw2WeaponMatcherContext,
) => boolean;

export type Gw2ResolverEvent = SimulationEvent & {
  readonly causalOrder?: number;
  readonly __order?: number;
  readonly name?: string;
  readonly skillName?: string;
  readonly parentSkillName?: string;
  readonly damageBreakdownName?: string;
  readonly skillId?: import("../engine/types.js").SkillId | null;
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
  readonly summonUsesProfessionModifiers?: boolean;
  readonly summonIgnoresMight?: boolean;
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
  skillId?: import("../engine/types.js").SkillId | null;
  sourceId?: import("../engine/types.js").SkillId;
  actorType?: SimulationActorType;
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
}

export interface Gw2ResolverHelpers extends SchedulerRecord {
  conditionName(value: unknown): string;
  weaponStrength(event: Gw2ResolverEvent, config: Gw2Config): number;
  readonly skillsById?: ReadonlyMap<
    import("../engine/types.js").SkillId,
    Skill
  >;
  readonly skillsByName?: ReadonlyMap<string, Skill>;
}

export type Gw2EventQueue =
  Gw2ResolverEvent[] | StableEventQueue<Gw2ResolverEvent>;

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
  recordProc(
    type: string,
    name: string,
    at: number,
    sourceSkill?: string,
    detail?: string,
    icon?: string,
    cooldownReduction?: number | null,
  ): void;
  addBreakdown(
    name: string,
    damage: number,
    type: "strikeDamage" | "conditionDamage",
    hits?: number,
    source?: Gw2ResolverEvent | null,
    critical?: Gw2CriticalResult | null,
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
  buildHitResolutionContext(
    context: Gw2ResolverRuntime,
    event: Gw2ResolverEvent,
  ): Gw2HitResolutionContext;
  applyResolvedHit(
    context: Gw2ResolverRuntime,
    event: Gw2ResolverEvent,
    hit: Gw2HitResolutionContext,
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
  activeConditionStackCount(
    context: Gw2ResolverRuntime,
    name: string,
    at: number,
  ): number;
  applyCondition(
    context: Gw2ResolverRuntime,
    event: Gw2EventDraft,
  ): Gw2ResolvedConditionApplication | null;
  handleConditionTick(
    context: Gw2ResolverRuntime,
    event: Gw2ResolverEvent,
  ): Gw2ConditionTickResult | null;
}

export type Gw2ResolverEventHandler = (
  context: Gw2ResolverRuntime,
  event: Gw2ResolverEvent,
) => unknown;

export type Gw2ResolverEventHandlers = Readonly<
  Record<string, Gw2ResolverEventHandler>
>;

export type Gw2ResolverHandlerRegistry = HandlerRegistry<
  Gw2ResolverRuntime,
  Gw2ResolverEvent
>;

export type Gw2ResolverReaction = (
  context: Gw2ResolverRuntime,
  event: Gw2ResolverEvent,
  details?: SchedulerRecord,
) => SchedulerRecord | void;

export type Gw2ResolverStage =
  | "aura.applied"
  | "blast-combo.resolved"
  | "combo.resolved"
  | "buff.applied"
  | "damage.resolved"
  | "condition.applied"
  | "condition-tick.resolved"
  | "control.resolved"
  | "blind.resolved"
  | "peitha.resolved"
  | "weakness-vulnerability.resolved"
  | "weapon-set.changed"
  | "food-proc.created";

export type Gw2ResolverReactions = Readonly<
  Partial<Record<Gw2ResolverStage, Gw2ResolverReaction>>
>;

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
    details?: SchedulerRecord,
  ): SchedulerRecord | void;
}

export interface Gw2ResolverExtensions {
  readonly reactions: Gw2ResolverReactionRegistry;
  readonly createEquipmentState: (
    config: Gw2Config,
  ) => Pick<Gw2ResolverRuntime, "relic" | "sigil" | "food">;
  readonly strikeMultiplier: (
    context: Gw2ResolverRuntime,
    event: Gw2ResolverEvent,
  ) => number;
  readonly conditionDurationBonus: (
    context: Gw2QueryRuntime | null | undefined,
    at: number,
  ) => number;
  readonly beforeResolveTimeline: (
    context: Gw2ResolverRuntime,
    events: readonly Gw2ResolverEvent[],
    rotationEndTime: number,
  ) => void;
}

export interface Gw2ResolverResult extends SchedulerRecord {
  readonly duration: number;
  readonly dpsStartTime: number;
  readonly dpsWindow: number;
  readonly firstHitTime: number | null;
  readonly lastHitTime: number | null;
  readonly deathTime: number | null;
  readonly totalDamage: number;
  readonly dps: number;
  readonly strikeDamage: number;
  readonly conditionDamage: number;
  readonly breakdown: Gw2DamageBreakdownEntry[];
  readonly conditionBreakdown: Array<{
    name: string;
    damage: number;
    dps: number;
    averageStacks: number;
  }>;
  readonly events: readonly SimulationEvent[];
  readonly resolvedEvents: Gw2ResolverEvent[];
  readonly procSteps: Gw2ProcStep[];
  readonly warnings: string[];
  readonly casts: Array<{ name: string; count: number }>;
  readonly randomness: {
    mode: SimulationRandom["mode"];
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
    options: Omit<CreateGw2ResolverRuntimeStateOptions, "createEquipmentState">,
  ) => Gw2ResolverRuntime;
  readonly commonHandlers: Gw2ResolverEventHandlers;
  readonly beforeResolveTimeline: Gw2ResolverExtensions["beforeResolveTimeline"];
  readonly professionHandlers?: Gw2ResolverEventHandlers;
  readonly professionState?: object;
  readonly eventFilterState?: object;
  readonly shouldSkipEvent?: (
    context: Gw2ResolverRuntime,
    event: Gw2ResolverEvent,
  ) => boolean;
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
  readonly createEquipmentState: Gw2ResolverExtensions["createEquipmentState"];
}

export interface Gw2ProfessionContract extends Omit<
  NormalizedProfessionContract,
  "eventHandlers" | "eventReactions" | "simulation" | "projectEndState"
> {
  readonly eventHandlers: Gw2ResolverEventHandlers;
  readonly eventReactions: Gw2ResolverReactions;
  readonly simulation:
    | (SchedulerRecord & {
        readonly refineSchedulerConfig?: (
          config: Gw2Config,
          result: Gw2SimulationResult,
        ) => Gw2Config | null | undefined;
        readonly projectEndState?: (options: {
          readonly config: Gw2Config;
          readonly schedulerContext: SchedulerContext;
          readonly schedulerState: SchedulerState;
          readonly resolverState: object;
          readonly cooldowns: Gw2SimulationEndState["cooldowns"];
          readonly ammo: Gw2SimulationEndState["ammo"];
          readonly profession: unknown;
        }) =>
          | {
              readonly cooldowns?: Gw2SimulationEndState["cooldowns"];
              readonly ammo?: Gw2SimulationEndState["ammo"];
              readonly profession?: unknown;
            }
          | null
          | undefined;
      })
    | null;
  readonly projectEndState: (options: {
    readonly config: Gw2Config;
    readonly schedulerContext: SchedulerContext;
    readonly schedulerState: SchedulerState;
    readonly resolverState: object;
  }) => unknown;
}

export interface Gw2SimulationEndState {
  readonly time: number;
  readonly cooldowns: Readonly<
    Record<string, { readyAt: number; remaining: number }>
  >;
  readonly ammo: Readonly<Record<string, unknown>>;
  readonly activeWeaponSet: number;
  readonly profession: unknown;
}

export interface Gw2SimulationResult extends Gw2ResolverResult {
  readonly steps: readonly SchedulerStep[];
  readonly endState: Gw2SimulationEndState;
  readonly schedulerState: SchedulerState;
  readonly snapshot: unknown;
  readonly warnings: string[];
}

export interface Gw2DeclarativeSimulationOptions {
  readonly profession: Gw2ProfessionContract | ProfessionSource;
  readonly rotation: readonly unknown[];
  readonly config?: Gw2Config;
}

export type Gw2NumericAttributes = Record<string, number>;

export type Gw2AttributeEffectRounding = "none" | "round" | "floor";

interface Gw2AttributeEffectBase {
  readonly source: string;
  readonly enabled?: boolean;
}

export interface Gw2FlatAttributeEffect extends Gw2AttributeEffectBase {
  readonly kind: "flat";
  readonly to: string;
  readonly amount: number;
  readonly feedsConversions: boolean;
}

export interface Gw2ConversionAttributeEffect extends Gw2AttributeEffectBase {
  readonly kind: "conversion";
  readonly from: string;
  readonly to: string;
  readonly multiplier: number;
  readonly addend?: number;
  readonly rounding: Gw2AttributeEffectRounding;
  readonly input: "common" | "eligible";
}

export type Gw2AttributeEffect =
  Gw2FlatAttributeEffect | Gw2ConversionAttributeEffect;

export interface Gw2AttributeBreakdown {
  final: number;
  base: number;
  gear: number;
  runes: number;
  food: number;
  utility: number;
  jbc: number;
  traits: number;
  sigils: number;
  infusions: number;
}

export type Gw2AttributeMap = Record<string, Gw2AttributeBreakdown>;

export interface Gw2Build extends SchedulerRecord {
  gear?: Record<string, string>;
  alternateWeaponPrefixes?: string[];
  weapons?: string[];
  alternateWeapons?: string[];
  rune?: string;
  weaponSigils?: string[][];
  relic?: string;
  food?: string;
  utility?: string;
  jadeBotCore?: boolean;
  specializations?: unknown[];
  infusions?: Array<{ stat?: string; count?: number }>;
}

export interface Gw2BuildSpecialization {
  name: string;
  traits: string;
}

export interface Gw2BuildInfusion {
  stat: string;
  count: number;
}

export interface Gw2CanonicalBuild extends SchedulerRecord {
  schemaVersion: number;
  profession: string;
  gear: Record<string, string>;
  alternateWeaponPrefixes: string[];
  weapons: string[];
  alternateWeapons: string[];
  rune: string;
  weaponSigils: string[][];
  relic: string;
  food: string;
  utility: string;
  jadeBotCore: boolean;
  specializations: Gw2BuildSpecialization[];
  selectedSkills: Record<string, string>;
  assumptions: SchedulerRecord;
  infusions: Gw2BuildInfusion[];
  startingWeaponSet: number;
  targetHealth: number;
  targetArmor: number;
  rotation: import("../engine/types.js").RotationCommand[];
  selectedSkillIds?: import("../engine/types.js").SkillId[];
  sigils?: string[];
}

export interface Gw2BuildValidationResult {
  readonly valid: boolean;
  readonly errors: string[];
}

export interface Gw2BuildCodecContext<
  TBuild extends Gw2CanonicalBuild = Gw2CanonicalBuild,
> {
  readonly saved: SchedulerRecord;
  readonly defaults: TBuild;
}

export interface Gw2SlotLoadoutContext<
  TBuild extends Gw2CanonicalBuild = Gw2CanonicalBuild,
> {
  readonly build: TBuild;
  readonly specialization: string;
  readonly catalog: CanonicalCatalog;
}

export interface Gw2SlotLoadout<
  TBuild extends Gw2CanonicalBuild = Gw2CanonicalBuild,
> extends SchedulerRecord {
  normalizeBuild(
    build: TBuild,
    context: Gw2SlotLoadoutContext<TBuild>,
  ): Partial<TBuild> & SchedulerRecord;
  validateBuild(
    build: TBuild,
    context: Gw2SlotLoadoutContext<TBuild>,
  ): readonly unknown[];
}

export interface Gw2BuildCodecOptions<
  TBuild extends Gw2CanonicalBuild = Gw2CanonicalBuild,
> {
  readonly professionId: string;
  readonly schemaVersion: number;
  readonly catalog: CanonicalCatalog;
  readonly createDefaults: () => TBuild;
  readonly migrations?: Readonly<
    Record<number, (saved: SchedulerRecord) => SchedulerRecord>
  >;
  readonly normalizeExtra?: (
    build: TBuild,
    context: Gw2BuildCodecContext<TBuild>,
  ) => TBuild;
  readonly validateExtra?: (
    build: TBuild,
  ) => unknown[] | { readonly errors?: readonly unknown[] } | null | undefined;
  readonly legacyGearAliases?: Readonly<Record<string, string>>;
  readonly slotLoadout?: Gw2SlotLoadout<TBuild> | null;
}

export interface Gw2ApplicationBuild extends SchedulerRecord {
  schemaVersion: number;
  profession: string;
  gear: Record<string, string>;
  alternateWeaponPrefixes: string[];
  weapons: string[];
  alternateWeapons: string[];
  rune: string;
  weaponSigils: string[][];
  relic: string;
  food: string;
  utility: string;
  jadeBotCore: boolean;
  specializations: Gw2BuildSpecialization[];
  selectedSkills: Record<string, string>;
  assumptions: SchedulerRecord;
  infusions: Gw2BuildInfusion[];
  startingWeaponSet: number;
  targetHealth: number;
  targetArmor: number;
  rotation: import("../engine/types.js").LegacyRotationItem[];
}

export interface Gw2BuildCodec<
  TBuild extends Gw2CanonicalBuild = Gw2CanonicalBuild,
> {
  migrateBuild(candidate: unknown): TBuild;
  validateBuild(build: unknown): Gw2BuildValidationResult;
  toApplicationBuild(candidate: unknown): Gw2ApplicationBuild;
}

export interface Gw2BuildValidationOptions {
  readonly professionId: string;
  readonly schemaVersion: number;
  readonly catalog: CanonicalCatalog;
  readonly slotLoadout?: Gw2SlotLoadout | null;
}

export type Gw2TraitCoverageStatus = "implemented" | "out-of-model" | "pending";

export interface Gw2TraitCoverageEffectInput extends SchedulerRecord {
  readonly description?: unknown;
  readonly status?: unknown;
  readonly reason?: unknown;
}

export interface Gw2TraitCoverageEntryInput extends SchedulerRecord {
  readonly traitId?: unknown;
  readonly status?: unknown;
  readonly effects?: unknown;
  readonly tests?: unknown;
  readonly reason?: unknown;
}

export interface Gw2TraitCoverageEffect {
  readonly description: string;
  readonly status: Gw2TraitCoverageStatus;
  readonly reason: string | null;
}

export interface Gw2TraitCoverageTestEvidence {
  readonly file: string;
  readonly name: string;
}

export interface Gw2TraitCoverageEntry {
  readonly traitId: number;
  readonly status: Gw2TraitCoverageStatus;
  readonly effects: readonly Gw2TraitCoverageEffect[];
  readonly tests: readonly Gw2TraitCoverageTestEvidence[];
  readonly reason: string | null;
}

export interface Gw2TraitCoverageCatalog {
  readonly traits?: readonly import("../engine/types.js").CatalogEntity[];
}

export interface Gw2AttributeCommonContext {
  conversionPool: Gw2NumericAttributes;
  conversionPoolNoFood: Gw2NumericAttributes;
  runeDurations: Gw2NumericAttributes;
  foodDurations: Gw2NumericAttributes;
  sigilDurations: Gw2NumericAttributes;
  sigilCriticalChance: number;
}

export interface Gw2CommonAttributeResult extends SchedulerRecord {
  attributes: Gw2AttributeMap;
  gear: Record<string, string>;
  alternateWeaponPrefixes: string[];
  weapons: string[];
  alternateWeapons: string[];
  runes: string;
  weaponSigils: string[][];
  relic: string;
  food: string;
  utility: string;
  jadeBotCore: boolean;
  specializations: unknown[];
  commonContext: Gw2AttributeCommonContext;
}

export interface Gw2FinalizedAttributeResult extends SchedulerRecord {
  attributes: Gw2AttributeMap;
  gear: Record<string, string>;
  alternateWeaponPrefixes: string[];
  weapons: string[];
  alternateWeapons: string[];
  runes: string;
  weaponSigils: string[][];
  relic: string;
  food: string;
  utility: string;
  jadeBotCore: boolean;
  specializations: unknown[];
  activeTraits: unknown;
}

export interface Gw2AttributeData {
  BASE_STATS?: Readonly<Gw2NumericAttributes>;
  FOOD_DATA?: Readonly<
    Record<
      string,
      {
        readonly isConverted?: boolean;
        readonly stats?: Readonly<Gw2NumericAttributes>;
        readonly durations?: Readonly<Gw2NumericAttributes>;
      }
    >
  >;
  GEAR_SLOTS?: readonly string[];
  GEAR_STATS?: Readonly<
    Record<string, Readonly<Record<string, Readonly<Gw2NumericAttributes>>>>
  >;
  INFUSION_BONUS?: number;
  JBC_BONUS?: Readonly<Gw2NumericAttributes>;
  RUNE_DATA?: Readonly<
    Record<
      string,
      {
        readonly stats?: Readonly<Gw2NumericAttributes>;
        readonly durations?: Readonly<Gw2NumericAttributes>;
      }
    >
  >;
  SIGIL_DATA?: Readonly<
    Record<
      string,
      {
        readonly criticalChance?: number;
        readonly strikeDamageA?: number;
        readonly nightStrikeDamageM?: number;
        readonly conditionDamageA?: number;
        readonly conditionDuration?: number;
        readonly bleedingDuration?: number;
        readonly burningDuration?: number;
        readonly poisonDuration?: number;
        readonly tormentDuration?: number;
        readonly boonDuration?: number;
      } & SchedulerRecord
    >
  >;
  UTILITY_CONVERSION_RATES?: Readonly<Gw2NumericAttributes>;
  UTILITY_DATA?: Readonly<
    Record<string, readonly { readonly from: string; readonly to: string }[]>
  >;
  UTILITY_STAT_DATA?: Readonly<Record<string, Readonly<Gw2NumericAttributes>>>;
  WEAPON_DATA?: Readonly<Record<string, Gw2WeaponDataEntry>>;
}

export interface Gw2BuildAttributeRuleContext {
  readonly build: Gw2Build;
  readonly selectedSkills: readonly Skill[];
  readonly weaponSet: number;
  readonly disabledTrait: string | null;
}

export type Gw2ApplyBuildAttributeRules = (
  common: Gw2CommonAttributeResult,
  context: Gw2BuildAttributeRuleContext,
) => Gw2FinalizedAttributeResult;

export type Gw2CalculateAttributes = (
  build: Gw2Build,
  selectedSkills?: readonly Skill[],
  weaponSet?: number,
  disabledTrait?: string | null,
) => Gw2FinalizedAttributeResult;

export type Gw2ModifierTarget =
  | "criticalChance"
  | "criticalDamage"
  | "strikeDamage"
  | "conditionDamage"
  | "conditionDuration";

export type Gw2DamageModifierTarget = "strikeDamage" | "conditionDamage";

export type Gw2ModifierOperation = "add" | "damage-additive" | "multiply";

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
}

export type Gw2ModifierNumericResolver = (
  context: Gw2ModifierContext,
  target: Gw2ModifierTarget,
) => number;

export interface Gw2ModifierRule {
  readonly id: string;
  readonly label?: string;
  readonly target: Gw2ModifierTarget | readonly Gw2ModifierTarget[];
  readonly operation: Gw2ModifierOperation;
  readonly amount?: number | Gw2ModifierNumericResolver;
  readonly factor?: number | Gw2ModifierNumericResolver;
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
  readonly when: ((context: Gw2ModifierContext) => boolean) | null;
  readonly order: number;
  readonly declarationIndex: number;
}

export type Gw2IncludeSigilPolicy =
  boolean | ((context: Gw2ModifierContext) => boolean);

export interface Gw2DamageBucketPolicy {
  readonly includeSigil: Gw2IncludeSigilPolicy;
}

export type Gw2DamageBucketPolicies = Partial<
  Record<
    Gw2DamageModifierTarget,
    { readonly includeSigil?: Gw2IncludeSigilPolicy }
  >
>;

export type Gw2ModifierHook = (
  context: Gw2ModifierContext,
  initialValue: number,
) => number;

export interface Gw2ModifierHooks {
  readonly modifyCriticalChance: Gw2ModifierHook;
  readonly modifyCriticalDamage: Gw2ModifierHook;
  readonly modifyStrikeDamage: Gw2ModifierHook;
  readonly modifyConditionDamage: Gw2ModifierHook;
  readonly modifyConditionDuration: Gw2ModifierHook;
}

export interface Gw2AttributeProvenance {
  readonly professionStaticRulesApplied: boolean;
  readonly calculatedWeaponSet: number;
  readonly calculatedPrimaryWeapon: string;
}
