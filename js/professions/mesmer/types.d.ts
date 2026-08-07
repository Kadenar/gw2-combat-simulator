import type {
  AmmoState,
  CanonicalCatalog,
  CastCommand,
  ScheduledTask,
  SchedulerContext,
  SchedulerPolicy,
  SchedulerRecord,
  SchedulerState,
  SimulationEvent,
  SimulationEventInput,
  ConditionEffect,
  SkillEffect,
  StrikeEffect,
  Skill,
  SkillFragment,
  SkillId,
} from "../../platform/engine/types.js";
import type {
  Gw2ConditionApplication,
  Gw2Build,
  Gw2BuildAttributeRuleContext,
  Gw2CanonicalBuild,
  Gw2Config,
  Gw2ConditionResolution,
  Gw2CriticalResult,
  Gw2DamageGroup,
  Gw2ResolverEvent,
  Gw2ResolverRuntime,
  Gw2SchedulerEventFactory,
} from "../../platform/gw2/types.js";
import type { ProfessionApplicationBuild } from "../../app/profession/types.js";

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

export interface MesmerBuildAttributeRuleContext extends Omit<
  Gw2BuildAttributeRuleContext,
  "build"
> {
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
  readonly selectedSkills?:
    | readonly MesmerSelectedSkill[]
    | Readonly<Record<string, MesmerSelectedSkill>>;
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
  extends
    MesmerCoreState,
    MesmerChronomancerState,
    MesmerMirageState,
    MesmerVirtuosoState,
    MesmerTroubadourState {}

export interface MesmerRuntimeState {
  core: MesmerCoreState;
  specialization:
    | { kind: "Core"; state: Record<string, never> }
    | { kind: "Chronomancer"; state: MesmerChronomancerState }
    | { kind: "Mirage"; state: MesmerMirageState }
    | { kind: "Virtuoso"; state: MesmerVirtuosoState }
    | { kind: "Troubadour"; state: MesmerTroubadourState };
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

export type MesmerApplyCondition = Gw2ConditionResolution["applyCondition"];

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
  ineptitudeReadyAt: number;
  clarityUntil: number;
  ambushUntil: number;
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
  readonly timingAnchor?: "castStart" | "castEnd";
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
}

export type MesmerSkillEffect =
  | MesmerStrikeEffect
  | MesmerConditionEffect
  | Exclude<SkillEffect, StrikeEffect | ConditionEffect>;

export interface MesmerTrackedHitDamage extends Gw2DamageGroup {
  readonly duration: number;
  readonly hitsRequired: number;
  readonly name: string;
  readonly skillId?: SkillId;
  readonly ticks?: readonly {
    readonly atMs: number;
    readonly coefficient: number;
  }[];
}

/**
 * Catalog skill augmented with the Mesmer-specific identity fields consulted by
 * handler selection and catalog preparation.
 */
export interface MesmerSkill extends Skill {
  readonly id: number;
  readonly ambush?: boolean;
  readonly phantasm?: boolean;
  readonly blade?: boolean;
  readonly pulseCount?: number;
  readonly boonlessCoefficient?: number;
  readonly baseCoefficient?: number;
  readonly instrumentDamageIncrease?: number;
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
  traitDamage: Record<string, MesmerTraitDamage>;
  shatters: Record<number, MesmerShatter>;
  instruments: Record<number, MesmerInstrument>;
  controlSkills: Set<number>;
  blindSkills: Set<number>;
  aristocracySkills: Set<number>;
  peithaSkills: Set<number>;
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
  continuum: MesmerContinuumController;
  mirage: MesmerMirageController;
  skillEffects: MesmerSkillEffectController;
}

export interface MesmerActiveEmission {
  readonly skill: MesmerSkill;
  readonly effectiveEnd: number;
  readonly activationId: string;
}

export interface MesmerCastDetails {
  reservedShatterResources?: boolean;
  shatterSpendCommitted?: boolean;
  shatterSpent?: number | null;
}

export interface MesmerContinuumController {
  beginContinuumSplit(skill: MesmerSkill, at: number): void;
  restoreContinuum(at: number, reason: string): void;
}

export type MesmerCatalog = CanonicalCatalog<MesmerSkill>;

export interface MesmerSchedulerPolicy extends SchedulerPolicy<MesmerRuntimeState> {
  critical(
    context: SchedulerContext<MesmerRuntimeState>,
    event: SimulationEvent,
  ): Gw2CriticalResult;
  isCombatActive(): boolean;
  combatBeganAt(): number | null;
  requireCriticalFacts(): void;
}

export type MesmerSchedulerContext = Omit<
  SchedulerContext<MesmerRuntimeState>,
  "config" | "catalog" | "schedulerPolicy"
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

/**
 * Shared event callbacks passed from the scheduler integration layer into the
 * focused Mesmer mechanic controllers.
 */
export type MesmerAddEvent = Gw2SchedulerEventFactory["addEvent"];
export type MesmerAddTraitProc = Gw2SchedulerEventFactory["addTraitProc"];
export type MesmerAddCondition = Gw2SchedulerEventFactory["addCondition"];
export type MesmerAddDamage = Gw2SchedulerEventFactory["addDamage"];
export type MesmerActivePrimaryWeapon = () => string;
export type MesmerCurrentResource = () => number;
export type MesmerDestroyClone = (clone: MesmerClone, at: number) => void;
export type MesmerQueueResources = (
  at: number,
  count: number,
  weapon: string | null | undefined,
  reason: string,
  cause?: MesmerResourceCause,
) => void;

export interface MesmerCloneAttackScheduler {
  handleTask(cloneId: number, at: number): void;
  initializeClone(clone: MesmerClone): MesmerClone;
  nextAttackAt(): number;
  scheduleAt(at: number): void;
}

export interface MesmerResourceController {
  gainResources(
    at: number,
    count: number,
    weapon: string | null | undefined,
    reason?: string,
    cause?: MesmerResourceCause,
  ): void;
  markCompounding(at: number, count: number): void;
  queueResources: MesmerQueueResources;
  setAmbushCreatedClones(
    handler: (at: number, clones: readonly MesmerClone[]) => void,
  ): void;
}

export type MesmerExpectedProcCandidate = (
  | {
      readonly type: "bleeding";
      readonly at: number;
      readonly stacks: number;
    }
  | {
      readonly type: "hit";
      readonly at: number;
      readonly event: SimulationEvent;
    }
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
  executeCloneAmbushes(at: number, clones?: readonly MesmerClone[]): void;
  executePlayerAmbush(skill: MesmerSkill, at: number): void;
  grantMirageCloak(
    at: number,
    source: string,
    options?: MesmerMirageCloakOptions,
  ): void;
  handleMirageShatter(skill: MesmerSkill, at: number, spent: number): void;
  handlePostSkill(skill: MesmerSkill, at: number): void;
}

export interface MesmerExceptionalProfileOptions {
  readonly phantasmSummonAt?: number;
  readonly playerEffectEnd?: number;
}

export interface MesmerSkillEffectController {
  schedule(
    skill: MesmerSkill,
    at: number,
    castStart?: number,
    options?: MesmerExceptionalProfileOptions,
  ): boolean;
}

export interface MesmerResourceSpendDetails {
  readonly sourceSkill?: string;
  readonly rotationIndex?: number | null;
}

export interface MesmerShatterTraitOptions {
  readonly skipMaim?: boolean;
}

export interface MesmerProfessionActionController {
  commitReservedResources(
    at: number,
    reserved: number,
    details?: MesmerResourceSpendDetails,
  ): number;
  consumeResources(at: number, details?: MesmerResourceSpendDetails): number;
  currentResource(): number;
  handleCrescendo(skill: MesmerSkill, at: number): void;
  handleInstrument(skill: MesmerSkill, at: number): void;
  handleShatter(
    skill: MesmerSkill,
    at: number,
    resourcesSpent?: number | null,
  ): boolean;
  reserveResources(): number;
  restoreReservedResources(spent: number): void;
  triggerShatterTraits(
    skill: MesmerSkill,
    at: number,
    spent: number,
    bladeSong?: boolean,
    options?: MesmerShatterTraitOptions,
  ): void;
}

export type MesmerEmitDerivedCondition = (
  cause: SimulationEvent,
  event: SimulationEventInput,
) => unknown;

export type MesmerRefreshAmmo = (
  skill: MesmerSkill,
  at: number,
) => AmmoState | null;

export type MesmerState =
  | SchedulerState<MesmerRuntimeState>
  | Pick<MesmerProfessionState, "clones">;

export interface MesmerProjectedFlip {
  readonly availableAt: number;
  readonly expiresAt: number | null;
  readonly remaining: number | null;
  readonly persistent: boolean;
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
  readonly availableFlips: Readonly<Record<string, MesmerProjectedFlip>>;
  readonly autoattackChains: Readonly<Record<string, SkillId>>;
  readonly continuumActive: boolean;
  readonly continuumRemaining: number;
}

export interface MesmerSchedulerTaskPayloads {
  readonly cloneAttack: { readonly cloneId: number };
  readonly resourceGain: MesmerPendingResource;
  readonly expectedProc: MesmerExpectedProcCandidate;
  readonly bladeSpend: {
    readonly reservationId: string;
    readonly sourceSkill: string;
    readonly rotationIndex: number;
  };
  readonly continuumExpire: { readonly expiresAt: number };
  readonly infiniteForge: SchedulerRecord;
  readonly signetEtherRelock: { readonly skillId: SkillId };
  readonly signetIllusionsPassive: SchedulerRecord;
}

export type MesmerSchedulerTask<
  TPayload extends keyof MesmerSchedulerTaskPayloads,
> = Omit<ScheduledTask<MesmerSchedulerTaskPayloads[TPayload]>, "payload"> & {
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
export interface MesmerAttackStatus extends Gw2ConditionApplication {
  readonly stacks?: number;
}

export interface MesmerCloneAttackStep {
  readonly name?: string;
  readonly coefficient: number;
  readonly hits: number;
  readonly hitOffsets?: number[];
  /** The interval between hit ticks, if applicable. */
  readonly interval: number;
  readonly conditions?: readonly MesmerAttackStatus[];
}

export interface MesmerCloneAttackBase {
  readonly weaponStrength: number;
  readonly firstAttackDelay?: number;
}

export interface MesmerDirectCloneAttack
  extends MesmerCloneAttackBase, MesmerCloneAttackStep {
  readonly sequence?: undefined;
}

export interface MesmerSequencedCloneAttack extends MesmerCloneAttackBase {
  readonly sequence: readonly [
    MesmerCloneAttackStep,
    ...MesmerCloneAttackStep[],
  ];
}

export type MesmerCloneAttack =
  | MesmerDirectCloneAttack
  | MesmerSequencedCloneAttack;

export interface MesmerAmbushStrike {
  readonly coefficient: number;
  readonly hits: number;
  readonly castTimeMs?: number;
  readonly conditions?: readonly MesmerAttackStatus[];
}

export interface MesmerAmbushAttack {
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
  readonly spawnAtMs: number;
  readonly chronophantasmaDamageAtMs: number;
  readonly chronophantasmaSpawnAtMs: number;
  readonly virtuosoBladeTicks?: readonly MesmerAttackTimingTick[];
  readonly damageTicks?: Readonly<
    Record<string, readonly MesmerAttackTimingTick[]>
  >;
  readonly phantasmalBladeDelayAfterSpawnMs?: number;
  readonly estimated?: boolean;
}

export interface MesmerTraitDamage {
  readonly coefficient: number;
  readonly hits: number;
  readonly interval?: number;
  readonly cooldown?: number;
  readonly weaponStrength?: number;
  readonly duration?: number;
  readonly damageIncrease?: number;
}

export interface MesmerShatter {
  readonly slot: number;
  readonly kind: string;
  readonly coefficients: readonly number[];
  readonly rechargeReductionPerSource?: number;
  readonly resourceSpendProgress?: number;
  readonly packetDelays?: readonly number[];
}

export interface MesmerInstrument {
  readonly slot: number;
  readonly instrument: string;
  readonly coefficient: number;
  readonly hits: number;
  readonly conditions?: readonly MesmerAttackStatus[];
}
