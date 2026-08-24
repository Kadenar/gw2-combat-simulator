import type {
  AmmoState,
  BalanceProfile,
  CanonicalCatalog,
  CastCommand,
  ScheduledTask,
  SchedulerContext,
  SchedulerPolicy,
  SchedulerRecord,
  SchedulerState,
  SimulationEvent,
  SimulationEventInput,
  SimulationActorType,
  ConditionTick,
  ConditionEffect,
  SkillEffect,
  StrikeEffect,
  StrikeTick,
  Skill,
  SkillFragment,
  SkillId
} from '../../platform/engine/types.js';
import type {
  Gw2Build,
  Gw2BuildAttributeRuleContext,
  Gw2CanonicalBuild,
  Gw2Config,
  Gw2ConditionResolution,
  Gw2CriticalResult,
  Gw2ResolverEvent,
  Gw2ResolverRuntime
} from '../../platform/gw2/types.js';
import type { ProfessionApplicationBuild } from '../../app/profession/types.js';

export interface MesmerSpecializationSelection {
  readonly name: string;
  readonly traits?: string;
}

export interface MesmerBuild extends Gw2Build {
  specializations?: MesmerSpecializationSelection[];
  assumptions?: SchedulerRecord & {
    readonly fury?: boolean;
    readonly alacrity?: boolean;
    readonly regeneration?: boolean;
  };
  initialResource?: number;
  weaponmasterTraining?: boolean;
}

export interface MesmerCanonicalBuild extends Gw2CanonicalBuild {
  initialResource: number;
}

export interface MesmerApplicationBuild extends ProfessionApplicationBuild {
  initialResource: number;
}

export interface MesmerBuildAttributeRuleContext extends Omit<Gw2BuildAttributeRuleContext, 'build'> {
  readonly build: MesmerBuild;
}

export type MesmerSelectedSkill = SkillId | Skill;

/**
 * Prepared Mesmer scheduler configuration. The scheduler always has an active
 * specialization and primary weapon, even when they came from defaults.
 */
export interface MesmerConfig extends Gw2Config {
  readonly specialization: string;
  readonly primaryWeapon: string;
  readonly weaponSet2Primary?: string;
  readonly weaponSet2Secondary?: string;
  readonly initialResource?: number;
  readonly infiniteForge?: boolean;
  readonly weaponmasterTraining?: boolean;
  readonly selectedSkills?: readonly MesmerSelectedSkill[] | Readonly<Record<string, MesmerSelectedSkill>>;
  readonly selectedTraits?: readonly SkillId[];
  readonly selectedTraitIds?: readonly SkillId[];
}

/**
 * One active illusion clone tracked by Mesmer profession state.
 */
export interface MesmerClone {
  id: number;
  createdAt: number;
  weapon: string;
  ownerId?: string;
  attackSequenceIndex?: number;
  nextAttackAt?: number;
}

/**
 * A resource gain deferred to a scheduler task time.
 */
export interface MesmerPendingResource extends SchedulerRecord {
  at: number;
  count: number;
  weapon?: string | null;
  reason?: string;
  cause?: MesmerResourceCause;
}

export interface MesmerResourceCause extends SchedulerRecord {
  readonly kind?: string;
  readonly sourceSkillId?: SkillId;
  readonly traitId?: number;
  readonly traitName?: string;
}

/**
 * Serializable per-skill ammo snapshot captured when a Continuum Split begins.
 * Unlike the engine `AmmoState`, recharge is stored as a remaining duration so
 * it can be replayed relative to the restoration time.
 */
export interface MesmerContinuumAmmo {
  charges: number;
  maximum: number;
  rechargeDuration: number;
  nextRechargeRemaining: number | null;
}

/**
 * Snapshot of scheduler state taken at a Continuum Split and restored at the
 * matching Continuum Shift.
 */
export interface MesmerContinuumSnapshot {
  splitId: SkillId;
  splitReady: number | undefined;
  openAt: number;
  remainingCooldowns: Map<SkillId, number>;
  ammo: Map<SkillId, MesmerContinuumAmmo>;
  autoattackChains: Record<string, SkillId>;
  expiresAt: number;
}

/**
 * Mutable Mesmer profession state. Collections are plain objects (keyed by
 * skill id or name) so the state serializes without custom Map handling; only
 * engine-level `state.cooldowns`/`state.ammo` remain Maps.
 */
export interface MesmerCoreState {
  clones: MesmerClone[];
  pendingResources: MesmerPendingResource[];
  trackedSkillHits: Record<string, number[]>;
  traitReadyAt: Record<string, number>;
  counterspellAvailable: boolean;
  availableFlips: Record<string, MesmerAvailableFlip>;
  autoattackChains: Record<string, SkillId>;
  sharperImagesProgress: number;
  masterFencerProgress: number;
  ineptitudeReadyAt: number;
  clarityUntil: number;
  hasExplicitCombatStart: boolean;
  combatStartTime: number;
}

export interface MesmerChronomancerState {
  continuum: MesmerContinuumSnapshot | null;
  timeBombUntil: number;
}

export interface MesmerMirageState {
  ambushUntil: number;
  ambushSource: string;
  cloneAmbushUntil: number;
  riddleOfSandReady: boolean;
  mirrors: MesmerMirageMirror[];
}

export interface MesmerMirageMirror {
  availableAt: number;
  expiresAt: number;
  source: string;
}

export interface MesmerVirtuosoState {
  numericResource: number;
  nextForgeAt: number;
  bloodsongProgress: number;
}

export interface MesmerTroubadourState {
  numericResource: number;
  instruments: Record<string, number>;
  lastInstrument: string;
}

export interface MesmerProfessionState
  extends MesmerCoreState, MesmerChronomancerState, MesmerMirageState, MesmerVirtuosoState, MesmerTroubadourState {}

export interface MesmerRuntimeState {
  core: MesmerCoreState;
  specialization:
    | { kind: 'Core'; state: Record<string, never> }
    | { kind: 'Chronomancer'; state: MesmerChronomancerState }
    | { kind: 'Mirage'; state: MesmerMirageState }
    | { kind: 'Virtuoso'; state: MesmerVirtuosoState }
    | { kind: 'Troubadour'; state: MesmerTroubadourState };
}

/**
 * Resolver-only Mesmer profession state. Scheduler-gated blades and their
 * bleeding triggers are fully materialized before this state is created.
 */
export interface MesmerResolverState {
  ineptitudeReadyAt: number;
}

export interface MesmerAvailableFlip {
  readonly availableAt: number;
  readonly expiresAt: number;
  readonly persistent?: boolean;
}

export type MesmerResolverContext = Gw2ResolverRuntime & {
  config: MesmerConfig;
  profession: MesmerResolverState;
};

export type MesmerApplyCondition = Gw2ConditionResolution['applyCondition'];

export type MesmerResolverEvent = Gw2ResolverEvent & {
  readonly count?: number;
};

/**
 * Resource label/limit descriptor selected by elite specialization.
 */
export interface MesmerResourceDefinition {
  singular: string;
  plural: string;
  maximum: number;
}

/**
 * Projected Mesmer state exposed in public results.
 */
export interface MesmerStateSnapshot {
  cloneCount: number;
  numericResource: number;
  instruments: [string, number][];
  continuumActive: boolean;
  counterspellAvailable: boolean;
  availableFlips: [string, MesmerAvailableFlip][];
  autoattackChains: [string, SkillId][];
  nextForgeAt: number;
  bloodsongProgress: number;
  sharperImagesProgress: number;
  masterFencerProgress: number;
  ineptitudeReadyAt: number;
  clarityUntil: number;
  ambushUntil: number;
  mirrors: MesmerMirageMirror[];
  riddleOfSandReady: boolean;
  timeBombUntil: number;
}

/**
 * A skill's Mesmer resource behavior. `mode` selects the handler family (for
 * example `"phantasm"`); remaining fields are mechanic-specific metadata.
 */
export interface MesmerSkillResource {
  readonly mode?: string;
  readonly count?: number;
  readonly timingAnchor?: 'castStart' | 'castEnd';
  readonly atMs?: number;
  readonly [field: string]: unknown;
}

export interface MesmerMechanic extends SchedulerRecord {
  readonly flipParentId?: number;
  readonly flipChildId?: number;
}

export interface MesmerStrikeEffect extends StrikeEffect {
  readonly castProgress?: number;
  readonly requiredTrait?: number;
}

export interface MesmerConditionEffect extends ConditionEffect {
  readonly condition: string;
  readonly duration: number;
  readonly packetLabel?: string;
  /** Restricts a phantasm-owned condition to one summoned entity. */
  readonly phantasmEntityIndex?: number;
}

export type MesmerDamageGroup = Partial<MesmerStrikeEffect> & {
  readonly type?: 'strike';
};

export interface MesmerConditionApplication extends SchedulerRecord {
  readonly name: string;
  readonly duration: number;
  readonly stacks?: number;
  readonly applications?: number;
  readonly atMs?: number;
  readonly intervalMs?: number;
  readonly timingAnchor?: 'castStart' | 'castEnd';
  readonly timingScale?: 'cast' | 'fixed';
  readonly ticks?: readonly ConditionTick[];
}

export interface MesmerEventExtra extends SchedulerRecord {
  readonly name?: string;
  readonly parentSkillName?: string;
  readonly source?: string;
  readonly sourceId?: SkillId;
  readonly skillId?: SkillId | null;
  readonly actorType?: SimulationActorType;
  /** Identifies damage or conditions produced by a shatter skill. */
  readonly shatter?: boolean;
  /** Marks packets that may receive shatter traits; clone repeat strikes can opt out while every blade opts in. */
  readonly shatterTraitEligible?: boolean;
}

export type MesmerSkillEffect =
  MesmerStrikeEffect | MesmerConditionEffect | Exclude<SkillEffect, StrikeEffect | ConditionEffect>;

export type MesmerTrackedHitDamage = MesmerDamageGroup & {
  readonly duration: number;
  readonly hitsRequired: number;
  readonly name: string;
  readonly skillId?: SkillId;
  readonly ticks?: readonly StrikeTick[];
};

/**
 * Catalog skill augmented with the Mesmer-specific identity fields consulted by
 * handler selection and catalog preparation.
 */
export interface MesmerSkill extends Skill {
  readonly id: number;
  readonly ambush?: boolean;
  readonly duration?: number;
  readonly phantasm?: boolean;
  readonly blade?: boolean;
  readonly pulseCount?: number;
  readonly boonlessCoefficient?: number;
  readonly applyConditionsOnInterrupt?: boolean;
  readonly armedAtStart?: boolean;
  readonly flipDelay?: number;
  readonly flipDuration?: number;
  readonly maxCloneEffects?: readonly MesmerConditionEffect[];
  readonly parentCooldownIncrease?: number;
  readonly phantasmSummonProgress?: number;
  readonly trackedHitDamage?: MesmerTrackedHitDamage;
  readonly effects?: readonly MesmerSkillEffect[];
  readonly resource?: MesmerSkillResource | null;
  readonly mesmerMechanic?: MesmerMechanic;
  readonly mesmerEffects?: readonly MesmerSkillEffect[];
}

export interface MesmerUiContext extends SchedulerRecord {
  readonly specialization?: string;
  readonly config?: Partial<MesmerConfig>;
  readonly build?: Partial<MesmerBuild>;
  readonly catalog?: CanonicalCatalog;
  readonly state?: {
    readonly profession?: Partial<MesmerProfessionState>;
  };
  readonly professionState?: Partial<MesmerProfessionState>;
  readonly value?: number;
}

/**
 * Partial Mesmer mechanic metadata accepted while the canonical catalog is
 * assembled. Identity-only generated skills and mechanics-only fragments both
 * pass through the same handler preparation boundary.
 */
export type MesmerSkillCatalogFragment = SkillFragment & {
  readonly id: number;
};

/**
 * Scheduler-local Mesmer runtime. Explicit dependencies are attached to one
 * scheduler context and never projected into public results.
 */
export interface MesmerRuntime {
  context: MesmerSchedulerContext;
  traits: ReadonlySet<number>;
  resourceDefinition: MesmerResourceDefinition;
  skillsById: ReadonlyMap<SkillId, MesmerSkill>;
  flipSkillsByParent: ReadonlyMap<SkillId, MesmerSkill>;
  activeEmission: MesmerActiveEmission | null;
  castDetails: Map<string, MesmerCastDetails>;
  weaponStrength: Readonly<Record<string, number>>;
  cloneAttacks: Readonly<Record<string, MesmerCloneAttack>>;
  ambushAttacks: Record<string, MesmerAmbushAttack>;
  phantasmAttackTimings: Record<number, MesmerPhantasmAttackTiming>;
  phantasmPolicy: MesmerPhantasmPolicy;
  traitDamage: Record<string, MesmerTraitDamage>;
  shatters: Record<number, MesmerShatter>;
  shatterResolvers: Record<string, MesmerShatterResolver>;
  shatterResolvedHandlers: MesmerShatterResolvedHandler[];
  skillCompletionHandlers: MesmerSkillCompletionHandler[];
  instruments: Record<number, MesmerInstrument>;
  balanceProfile: (id: SkillId) => BalanceProfile | undefined;
  controlSkills: Set<number>;
  blindSkills: Set<number>;
  aristocracySkills: Set<number>;
  peithaSkills: Set<number>;
  peithaProjectileDelays: Record<number, number>;
  activePrimaryWeapon: MesmerActivePrimaryWeapon;
  addEvent: MesmerAddEvent;
  addTraitProc: MesmerAddTraitProc;
  addCondition: MesmerAddCondition;
  addDamage: MesmerAddDamage;
  cloneAttackScheduler: MesmerCloneAttackScheduler;
  destroyClone: MesmerDestroyClone;
  resources: MesmerResourceController;
  expected: MesmerExpectedProcTracker;
  actions: MesmerProfessionActionController;
  continuum?: MesmerContinuumController;
  mirage?: MesmerMirageController;
  skillEffects: MesmerSkillEffectController;
}

/** Specialization-provided variations applied by the shared phantasm lifecycle. */
export interface MesmerPhantasmPolicy {
  readonly spawnModifiers: Readonly<
    Record<number, { readonly countMultiplier: number; readonly damageMultiplier: number }>
  >;
  readonly repeat?: {
    readonly label: string;
    readonly traitName: string;
    readonly damageMultiplier: number;
  };
  readonly bonusStrike?: {
    readonly name: string;
    readonly traitName: string;
    readonly damage: MesmerTraitDamage;
  };
  readonly conversionTiming: 'spawn' | 'blade-tick';
}

export interface MesmerActiveEmission {
  readonly skill: MesmerSkill;
  readonly effectiveEnd: number;
  readonly activationId: string;
}

export interface MesmerCastDetails {
  earlyResourceAt?: number | null;
  earlyResourceOwnerId?: string;
  resourceScheduledDuringCast?: boolean;
  reservedShatterResources?: boolean;
  shatterSpendCommitted?: boolean;
  shatterSpent?: number | null;
}

export interface MesmerContinuumController {
  beginContinuumSplit(
    skill: MesmerSkill,
    at: number,
    spendDetails?: MesmerResourceSpendDetails
  ): MesmerShatterResolution;
  restoreContinuum(at: number, reason: string): void;
}

export type MesmerCatalog = CanonicalCatalog<MesmerSkill>;

export interface MesmerSchedulerPolicy extends SchedulerPolicy<MesmerRuntimeState> {
  critical(context: SchedulerContext<MesmerRuntimeState>, event: SimulationEvent): Gw2CriticalResult;
  isCombatActive(): boolean;
  combatBeganAt(): number | null;
  requireCriticalFacts(): void;
}

export type MesmerSchedulerContext = Omit<
  SchedulerContext<MesmerRuntimeState>,
  'config' | 'catalog' | 'schedulerPolicy'
> & {
  readonly config: MesmerConfig;
  readonly catalog: MesmerCatalog;
  readonly schedulerPolicy: MesmerSchedulerPolicy;
  mesmerRuntime?: MesmerRuntime;
};

export type MesmerHandlerContext = MesmerSchedulerContext & {
  readonly mesmerRuntime: MesmerRuntime;
};

export type MesmerPrecastContext = MesmerSchedulerContext & {
  readonly command: CastCommand;
  readonly commandIndex: number;
  readonly skill: MesmerSkill;
  readonly start: number;
  readonly ammo: AmmoState | null;
};

export type MesmerCastContext = MesmerPrecastContext & {
  readonly action: SimulationEvent;
  readonly fullEnd: number;
  readonly effectiveEnd: number;
  readonly rechargeDuration: number;
  readonly ammoLockoutDuration: number;
  readonly rechargeStart: number;
  readonly rechargeReadyAt: number | null;
  readonly reservationId: string;
};

/** One group of first shatter strikes used by shared traits such as Maim the Disillusioned. */
export interface MesmerShatterTraitHit {
  readonly at: number;
  readonly count: number;
}

/** Inputs passed to the resolver that owns a shatter family's packet behavior. */
export interface MesmerShatterResolverRequest {
  readonly skill: MesmerSkill;
  readonly shatter: MesmerShatter;
  readonly at: number;
  readonly castStart: number;
  readonly spent: number;
}

export type MesmerShatterResolver = (
  context: MesmerCastContext,
  request: MesmerShatterResolverRequest
) => readonly MesmerShatterTraitHit[];

/** Runtime result passed to specialization mechanics after a shatter successfully resolves. */
export interface MesmerShatterResolution {
  readonly skill: MesmerSkill;
  readonly at: number;
  readonly spent: number;
  readonly traitHits: readonly MesmerShatterTraitHit[];
}

/** Active-specialization completion override for skills that replace the shared cast path. */
export type MesmerSkillCompletionHandler = (
  context: MesmerCastContext,
  skill: MesmerSkill,
  at: number
) => boolean | MesmerShatterResolution;

export type MesmerShatterResolvedHandler = (context: MesmerCastContext, resolution: MesmerShatterResolution) => void;

/**
 * Shared event callbacks passed from the scheduler integration layer into the
 * focused Mesmer mechanic controllers.
 */
export type MesmerAddEvent = (
  event: SchedulerRecord & {
    readonly type: string;
    readonly at: number;
    readonly source?: string;
    readonly sourceId?: SkillId;
  }
) => SimulationEvent | null;
export type MesmerAddTraitProc = (
  name: string,
  at: number,
  sourceSkill?: string,
  detail?: string
) => SimulationEvent | null;
export type MesmerAddCondition = (
  skillName: string,
  at: number,
  condition: MesmerConditionApplication,
  source?: string,
  label?: string,
  extra?: MesmerEventExtra
) => readonly SimulationEvent[];
export type MesmerAddDamage = (
  skill: Skill,
  at: number,
  group: MesmerDamageGroup,
  extra?: MesmerEventExtra
) => readonly SimulationEvent[];
export type MesmerActivePrimaryWeapon = () => string;
export type MesmerDestroyClone = (clone: MesmerClone, at: number) => void;
export type MesmerQueueResources = (
  at: number,
  count: number,
  weapon: string | null | undefined,
  reason: string,
  cause?: MesmerResourceCause
) => void;

/** Completed resource gain exposed to active specialization reactions. */
export interface MesmerResourceGain {
  readonly at: number;
  readonly gained: number;
  readonly reason: string;
  readonly cause: MesmerResourceCause;
  readonly createdClones: readonly MesmerClone[];
}

export interface MesmerCloneAttackScheduler {
  handleTask(cloneId: number, at: number): void;
  initializeClone(clone: MesmerClone): MesmerClone;
  nextAttackAt(): number;
  scheduleAt(at: number): void;
}

export interface MesmerResourceController {
  addGainHandler(handler: (gain: MesmerResourceGain) => void): void;
  gainResources(
    at: number,
    count: number,
    weapon: string | null | undefined,
    reason?: string,
    cause?: MesmerResourceCause
  ): void;
  markCompounding(at: number, count: number): void;
  queueResources: MesmerQueueResources;
}

export type MesmerExpectedProcCandidate = {
  readonly type: 'hit';
  readonly at: number;
  readonly event: SimulationEvent;
} & SchedulerRecord;

/** Virtuoso-owned expected reactions to bleeding and blade critical hits. */
export type MesmerVirtuosoExpectedProcCandidate = (
  | { readonly type: 'bleeding'; readonly at: number; readonly stacks: number }
  | { readonly type: 'blade'; readonly at: number; readonly event: SimulationEvent }
) &
  SchedulerRecord;

export interface MesmerExpectedProcTracker {
  process(candidate: MesmerExpectedProcCandidate): void;
}

export interface MesmerMirageCloakOptions {
  readonly duration?: number;
  readonly grantCloneCloak?: boolean;
}

export interface MesmerMirageController {
  createMirrors(at: number, count: number, source: string): void;
  executeCloneAmbushes(at: number, clones?: readonly MesmerClone[]): void;
  executePlayerAmbush(skill: MesmerSkill, at: number, castStart?: number): void;
  grantMirageCloak(at: number, source: string, options?: MesmerMirageCloakOptions): void;
  handleMirageShatter(skill: MesmerSkill, at: number, spent: number): void;
  pickUpMirror(at: number, source: string): boolean;
}

export interface MesmerExceptionalProfileOptions {
  readonly phantasmSummonAt?: number;
  readonly playerEffectEnd?: number;
  readonly skipDirectResource?: boolean;
}

export interface MesmerSkillEffectController {
  schedule(skill: MesmerSkill, at: number, castStart?: number, options?: MesmerExceptionalProfileOptions): boolean;
}

export interface MesmerResourceSpendDetails {
  readonly sourceSkill?: string;
  readonly rotationIndex?: number | null;
}

export interface MesmerProfessionActionController {
  commitReservedResources(at: number, reserved: number, details?: MesmerResourceSpendDetails): number;
  consumeResources(at: number, details?: MesmerResourceSpendDetails): number;
  currentResource(): number;
  handleShatter(
    context: MesmerCastContext,
    skill: MesmerSkill,
    at: number,
    resourcesSpent?: number | null,
    castStart?: number
  ): MesmerShatterResolution | null;
  reserveResources(): number;
  restoreReservedResources(spent: number): void;
  triggerShatterTraits(resolution: MesmerShatterResolution): void;
}

export type MesmerEmitDerivedEvent = (cause: SimulationEvent, event: SimulationEventInput) => unknown;

export type MesmerRefreshAmmo = (skill: MesmerSkill, at: number) => AmmoState | null;

export type MesmerState = SchedulerState<MesmerRuntimeState> | Pick<MesmerProfessionState, 'clones'>;

export interface MesmerProjectedFlip {
  readonly availableAt: number;
  readonly expiresAt: number | null;
  readonly remaining: number | null;
  readonly persistent: boolean;
}

export interface MesmerProjectedInstrument {
  readonly name: string;
  readonly expiresAt: number;
  readonly remaining: number;
}

export interface MesmerEndState extends SchedulerRecord {
  readonly resource: number;
  readonly resourceDefinition: MesmerResourceDefinition;
  readonly clarityRemaining: number;
  readonly counterspellAvailable: boolean;
  readonly availableAmbush: {
    readonly name: string;
    readonly source: string;
    readonly expiresAt: number;
    readonly remaining: number;
  } | null;
  readonly availableMirrors?: number;
  readonly activeInstruments?: readonly MesmerProjectedInstrument[];
  readonly availableFlips: Readonly<Record<string, MesmerProjectedFlip>>;
  readonly autoattackChains: Readonly<Record<string, SkillId>>;
  readonly continuumActive: boolean;
  readonly continuumRemaining: number;
}

export interface MesmerSchedulerTaskPayloads {
  readonly cloneAttack: { readonly cloneId: number };
  readonly resourceGain: MesmerPendingResource;
  readonly expectedProc: MesmerExpectedProcCandidate;
  readonly virtuosoExpectedProc: MesmerVirtuosoExpectedProcCandidate;
  readonly deadlyBladesCritical: { readonly event: Extract<SimulationEvent, { readonly type: 'damage' }> };
  readonly chaoticInterruption: { readonly skillId: SkillId; readonly skillName: string };
  readonly bladeSpend: {
    readonly reservationId: string;
    readonly sourceSkill: string;
    readonly rotationIndex: number;
  };
  readonly continuumExpire: { readonly expiresAt: number };
  readonly infiniteForge: SchedulerRecord;
  readonly signetIllusionsPassive: SchedulerRecord;
}

export type MesmerSchedulerTask<TPayload extends keyof MesmerSchedulerTaskPayloads> = Omit<
  ScheduledTask<MesmerSchedulerTaskPayloads[TPayload]>,
  'payload'
> & {
  readonly payload: MesmerSchedulerTaskPayloads[TPayload];
};

export interface MesmerRechargeContext extends SchedulerRecord {
  readonly skill: MesmerSkill;
  readonly config: MesmerConfig;
  readonly ammoCastLockout?: boolean;
  readonly mesmerRuntime?: MesmerRuntime;
}

export interface MesmerMaximumAmmoContext extends SchedulerRecord {
  readonly skill: MesmerSkill;
  readonly mesmerRuntime?: MesmerRuntime;
}

/**
 * One condition or boon packet attached to an illusion attack.
 */
export interface MesmerAttackStatus extends MesmerConditionApplication {
  readonly stacks?: number;
}

export interface MesmerCloneAttackStep {
  readonly id?: SkillId;
  readonly name?: string;
  readonly coefficient: number;
  readonly hits: number;
  /** Observed clone cast duration, in milliseconds. */
  readonly castTimeMs?: number;
  /** Damage offset from clone cast start, in milliseconds. */
  readonly damageAtMs?: number;
  readonly ticks?: readonly StrikeTick[];
  /** The interval between hit ticks, if applicable. */
  readonly interval: number;
  readonly conditions?: readonly MesmerAttackStatus[];
}

export interface MesmerCloneAttackBase {
  readonly weaponStrength: number;
  readonly firstAttackDelay?: number;
}

export interface MesmerDirectCloneAttack extends MesmerCloneAttackBase, MesmerCloneAttackStep {
  readonly sequence?: undefined;
}

export interface MesmerSequencedCloneAttack extends MesmerCloneAttackBase {
  readonly sequence: readonly [MesmerCloneAttackStep, ...MesmerCloneAttackStep[]];
}

export type MesmerCloneAttack = MesmerDirectCloneAttack | MesmerSequencedCloneAttack;

export interface MesmerAmbushStrike {
  readonly coefficient: number;
  readonly hits: number;
  readonly castTimeMs?: number;
  readonly damageAtMs?: number;
  readonly ticks?: readonly MesmerAttackTimingTick[];
  readonly conditions?: readonly MesmerAttackStatus[];
}

export interface MesmerAmbushAttack {
  readonly balanceProfileId?: SkillId;
  readonly id: number;
  readonly name: string;
  readonly icon: string;
  readonly description: string;
  readonly castTimeMs: number;
  readonly cooldown: number;
  readonly player: MesmerAmbushStrike;
  readonly clone: MesmerAmbushStrike;
  readonly playerBoons?: readonly MesmerAttackStatus[];
  readonly cloneBoons?: readonly MesmerAttackStatus[];
  readonly vulnerability?: {
    readonly duration: number;
    readonly stacks: number;
  };
  readonly createsClone?: boolean;
  readonly control?: boolean;
}

export interface MesmerAttackTimingTick {
  readonly atMs: number;
}

export interface MesmerPhantasmAttackTiming {
  readonly castTimeMs: number;
  readonly damageAtMs: number;
  readonly damageAtMsByEntity?: readonly number[];
  readonly spawnAtMs: number;
  readonly repeatDamageAtMs: number;
  readonly repeatDamageAtMsByEntity?: readonly number[];
  readonly repeatSpawnAtMs: number;
  readonly conversionTicks?: readonly MesmerAttackTimingTick[];
  readonly damageTicks?: Readonly<Record<string, readonly MesmerAttackTimingTick[]>>;
  readonly damageTicksByEntity?: readonly Readonly<Record<string, readonly MesmerAttackTimingTick[]>>[];
  readonly repeatDamageTicks?: Readonly<Record<string, readonly MesmerAttackTimingTick[]>>;
  readonly repeatDamageTicksByEntity?: readonly Readonly<Record<string, readonly MesmerAttackTimingTick[]>>[];
  readonly phantasmalBladeDelayAfterSpawnMs?: number;
  readonly estimated?: boolean;
}

export interface MesmerTraitDamage {
  readonly balanceProfileId?: SkillId;
  readonly coefficient: number;
  readonly hits: number;
  readonly intervalMs?: number;
  readonly cooldown?: number;
  readonly weaponStrength?: number;
  readonly duration?: number;
  readonly damageIncrease?: number;
}

export interface MesmerShatter {
  readonly balanceProfileId?: SkillId;
  readonly slot: number;
  readonly kind: string;
  readonly resolver: string;
  readonly coefficients: readonly number[];
  readonly minimumResource?: number;
  readonly consumesResources?: boolean;
  readonly resetBySignetOfIllusions?: boolean;
  readonly hitsPerSource?: number;
  readonly strikeIntervalMs?: number;
  readonly rechargeReductionPerSource?: number;
  readonly resourceSpendProgress?: number;
  readonly damageAtMs?: number;
  readonly ticks?: readonly MesmerAttackTimingTick[];
}

export interface MesmerInstrument {
  readonly balanceProfileId?: SkillId;
  readonly slot: number;
  readonly instrument: string;
  readonly coefficient: number;
  readonly hits: number;
  readonly damageAtMs?: number;
  readonly intervalMs?: number;
  readonly conditions?: readonly MesmerAttackStatus[];
}
