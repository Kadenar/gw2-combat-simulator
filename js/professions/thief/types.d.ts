import type {
  CanonicalCatalog,
  CastContext,
  CastLifecycleContext,
  ScheduledTask,
  SchedulerContext,
  SchedulerRecord,
  SchedulerState,
  SimulationEvent,
  Skill,
  SkillId,
} from "../../platform/engine/types.js";
import type {
  Gw2Build,
  Gw2BuildSpecialization,
  Gw2CanonicalBuild,
  Gw2Config,
  Gw2EventDraft,
  Gw2HitResolutionContext,
  Gw2QueryRuntime,
  Gw2ResolverEvent,
  Gw2ResolverRuntime,
  Gw2WeaponMatcherContext,
} from "../../platform/gw2/types.js";
import type {
  ProfessionApplicationBuild,
  ProfessionBuildAssumptions,
} from "../../app/profession/types.js";

export type ThiefDodge =
  | "Dodge"
  | "Lotus Training"
  | "Bounding Dodger"
  | "Unhindered Combatant";

export interface ThiefSpecializationSelection extends Gw2BuildSpecialization {}

export interface ThiefBuild extends Gw2Build {
  assumptions?: ProfessionBuildAssumptions;
  specializations?: ThiefSpecializationSelection[];
  selectedSkills?: Record<string, string>;
  selectedDodge?: ThiefDodge;
  initialInitiative?: number;
  initialShadowForce?: number;
}

export interface ThiefCanonicalBuild extends Gw2CanonicalBuild {
  assumptions: SchedulerRecord;
  selectedDodge: ThiefDodge;
  initialInitiative: number;
  initialShadowForce: number;
}

export interface ThiefApplicationBuild extends ProfessionApplicationBuild {
  selectedDodge: ThiefDodge;
  initialInitiative: number;
  initialShadowForce: number;
}

export interface ThiefDeterministicChoices extends SchedulerRecord {
  readonly forgedSurferBombsHit?: number;
  readonly stolenSkillChoice?: string;
  readonly deadeyeStolenSkillChoice?: string;
}

export interface ThiefConfig extends Gw2Config {
  readonly specialization?: string;
  readonly assumptions?: ProfessionBuildAssumptions;
  readonly professionAssumptions?: ProfessionBuildAssumptions;
  readonly selectedSkills?:
    | readonly (string | Skill)[]
    | Readonly<Record<string, string | Skill>>;
  readonly selectedDodge?: ThiefDodge;
  readonly initialInitiative?: number;
  readonly initialShadowForce?: number;
  readonly deterministicChoices?: ThiefDeterministicChoices;
}

export interface ThievesGuildState extends SchedulerRecord {
  readonly variant: string;
  readonly expiresAt: number;
}

export interface ThiefCoreState {
  initiative: number;
  maximumInitiative: number;
  initiativeUpdatedAt: number;
  stealthUntil: number;
  revealedUntil: number;
  storedStolenSkillId: SkillId | null;
  storedStolenSkillCount: number;
  professionSkillId: SkillId;
  kneeling: boolean;
  endurance: number;
  maximumEndurance: number;
  enduranceUpdatedAt: number;
  maximumHealth: number;
  leadAttacksStacks: number;
  leadAttacksUntil: number;
  leadAttackExpirations: number[];
  fluidStrikesUntil: number;
  quickPocketsReadyAt: number;
  spearChainStage: number;
  spearPreviousSkillId: SkillId | null;
  spearLastWasFinisher: boolean;
  distractingThrowBuffUntil: number;
  spiderVenomCharges: number;
  spiderVenomExpiresAt: number;
  spiderVenomGeneration: number;
  thousandNeedlesPrepared: boolean;
  thousandNeedlesArmedAt: number;
  thousandNeedlesGeneration: number;
  activeThievesGuild: ThievesGuildState | null;
  thievesGuildVariant: string;
  assassinsSignetActiveUntil: number;
  assassinsSignetPassiveDisabledUntil: number;
  availableFlips: Record<string, number>;
  autoattackChains: Record<string, SkillId>;
  traitProcProgress: Record<string, number>;
  traitProcReadyAt: Record<string, number>;
}

export interface DaredevilState {
  selectedDodge: ThiefDodge;
  boundingDamageUntil: number;
  lotusConditionDamageUntil: number;
  palmStrikeUntil: number;
  weakeningStrikeReady: boolean;
}

export interface DeadeyeState {
  usesMaliciousStealthAttacks: boolean;
  markedTargetId: string | null;
  markExpiresAt: number;
  markGeneration: number;
  malice: number;
  maximumMalice: number;
  maliceCriticalProgress: number;
  maliceResolvedActivations: Record<string, boolean>;
  maleficentSevenTriggered: boolean;
  deadeyeRelicUntil: number;
  stealthAttackCharges: number;
  stealthAttackExpiresAt: number;
}

export interface SpecterState {
  shadowForce: number;
  maximumShadowForce: number;
  shadowForcePoolCapacity: number;
  shadowShroudActive: boolean;
  shadowForceUpdatedAt: number;
  darkSentryReadyAt: number;
  darkSentryReadyAtByAlly: Record<string, number>;
}

export type ThiefArtifactKind = "offensive" | "defensive";
export type ThiefDoubleEdgeOutcome = "success" | "backfire";

export interface ThiefArtifactSlot extends SchedulerRecord {
  readonly kind: ThiefArtifactKind;
  readonly skillId: SkillId;
}

export interface ThiefBackfireState extends SchedulerRecord {
  readonly activeUntil: number;
  readonly skillName: string;
}

export interface ThiefAntiquarySummon extends SchedulerRecord {
  readonly skillId: SkillId;
  readonly name: string;
  readonly expiresAt: number;
}

export interface AntiquaryState {
  initiativePipRows: number;
  artifactSlots: ThiefArtifactSlot[];
  artifactUsesRemaining: number;
  scoundrelsLuck: number;
  scoundrelsLuckReadyAt: number;
  improvisationReadyAt: number;
  backfireState: Record<string, ThiefBackfireState>;
  initiativeSpentSincePilfer: number;
  activeAntiquarySummons: ThiefAntiquarySummon[];
  nextSkrittScufflePilferAt: number;
  antiquaryDamageUntil: number;
  combatHighExpiresAt: number;
  combatHighStacks: number;
  stealthAttackCharges: number;
  stealthAttackExpiresAt: number;
  artifactStealthAttacksRemaining?: number;
  artifactStealthAttackExpiresAt?: number;
  mistburnCharges: number;
  mistburnExpiresAt: number;
  mistburnGeneration: number;
  kryptisDamageUntil: number;
  chakInitiativeRefundUntil: number;
  holoUtilityCooldownReduction: number;
  holoUtilityCooldownReductionExpiresAt: number;
  holoUtilityCooldownReductionExpirations: number[];
  forgedSurferGeneration: number;
  forgedSurferMaximumBombHits: number;
  canachCoinIndex: number;
}

export interface ThiefState
  extends ThiefCoreState,
    DaredevilState,
    DeadeyeState,
    SpecterState,
    AntiquaryState {}

export interface ThiefRuntimeState {
  core: ThiefCoreState;
  specialization:
    | { kind: "Core"; state: Record<string, never> }
    | { kind: "Daredevil"; state: DaredevilState }
    | { kind: "Deadeye"; state: DeadeyeState }
    | { kind: "Specter"; state: SpecterState }
    | { kind: "Antiquary"; state: AntiquaryState };
}

export interface ThiefSummonCondition extends SchedulerRecord {
  readonly condition: string;
  readonly duration: number;
  readonly stacks: number;
}

export interface ThiefSummonStrike extends SchedulerRecord {
  readonly name: string;
  readonly coefficientPerHit: number;
  readonly hits?: number;
  readonly initialDelay: number;
  readonly interval?: number;
  readonly skillId?: SkillId;
  readonly conditions?: readonly ThiefSummonCondition[];
}

export interface ThiefSummonDefinition extends SchedulerRecord {
  readonly name: string;
  readonly displayName?: string;
  readonly variant?: string;
  readonly weapon: string;
  readonly weaponStrengthProfileId: string;
  readonly attacks?: readonly ThiefSummonStrike[];
}

export interface ThiefSummonAttack extends SchedulerRecord {
  readonly basePower: number;
  readonly criticalChance: number;
  readonly criticalDamage: number;
  readonly duration: number;
  readonly fallbackAttacks?: readonly ThiefSummonStrike[];
  readonly summons: readonly ThiefSummonDefinition[];
}

export interface ThiefSkill extends Skill {
  readonly artifactKind?: ThiefArtifactKind;
  readonly backfire?: boolean;
  readonly doubleEdge?: boolean;
  readonly dualWieldFollowup?: boolean;
  readonly dualWieldOpener?: boolean;
  readonly enduranceGain?: number;
  readonly ignoresStealthWeaponReplacement?: boolean;
  readonly initiativeCost?: number;
  readonly kneelSkill?: boolean;
  readonly malicious?: boolean;
  readonly movementSkill?: boolean;
  readonly shadowstepSkill?: boolean;
  readonly preservesStealth?: boolean;
  readonly shadowShroudSkill?: boolean;
  readonly spearStealthAttack?: boolean;
  readonly stealthAttack?: boolean;
  readonly summonAttack?: ThiefSummonAttack;
}

export type ThiefSchedulerContext = SchedulerContext<ThiefRuntimeState> & {
  readonly catalog: CanonicalCatalog<ThiefSkill>;
  readonly config: ThiefConfig;
};

export type ThiefPrecastContext = CastContext<ThiefRuntimeState> & {
  readonly catalog: CanonicalCatalog<ThiefSkill>;
  readonly config: ThiefConfig;
  readonly skill: ThiefSkill;
};

export type ThiefCastContext = CastLifecycleContext<ThiefRuntimeState> & {
  readonly catalog: CanonicalCatalog<ThiefSkill>;
  readonly config: ThiefConfig;
  readonly skill: ThiefSkill;
};

export type ThiefResourceContext = ThiefSchedulerContext & {
  readonly start?: number;
};

export type ThiefEmissionContext = ThiefSchedulerContext & {
  readonly skill?: ThiefSkill;
};

export type ThiefScheduledTask<TPayload = SchedulerRecord> = Omit<
  ScheduledTask<TPayload>,
  "payload"
> & { readonly payload: TPayload };

export type ThiefSimulationEvent = SimulationEvent & {
  readonly application?: ThiefSimulationEvent;
  readonly bonusAboveNinetyStacks?: number;
  readonly cancelled?: boolean;
  readonly coefficient?: number;
  readonly condition?: string;
  readonly deadeyeMaliceSnapshot?: number;
  readonly reason?: string;
  readonly state?: Partial<ThiefState>;
  readonly triggeredByAlly?: number;
};

export type ThiefResolverEvent = Gw2ResolverEvent & {
  readonly application?: ThiefResolverEvent;
  readonly bonusAboveNinetyStacks?: number;
  readonly deadeyeMaliceSnapshot?: number;
  readonly lifeSiphon?: boolean;
  readonly state?: Partial<ThiefState>;
  readonly triggeredByAlly?: number;
};

export type ThiefResolverContext = Gw2ResolverRuntime & {
  config: ThiefConfig;
  profession: ThiefRuntimeState;
  readonly state?: { readonly profession: ThiefRuntimeState };
};

export interface ThiefResolverReactionDetails extends SchedulerRecord {
  readonly hitContext?: Gw2HitResolutionContext;
  readonly applyCondition?: (
    context: Gw2ResolverRuntime,
    event: Gw2EventDraft,
  ) => unknown;
}

export type ThiefQueryRuntime = Gw2QueryRuntime & {
  readonly profession?: ThiefRuntimeState | Partial<ThiefState> | null;
  readonly totals?: {
    readonly strike?: number;
    readonly condition?: number;
  };
};

export interface ThiefEndStateProjectionOptions {
  readonly schedulerState: SchedulerState<ThiefRuntimeState>;
}

export interface ThiefUiContext extends SchedulerRecord {
  readonly specialization?: string;
  readonly config?: ThiefConfig;
  readonly build?: ThiefBuild;
  readonly state?: {
    readonly profession?: ThiefRuntimeState | Partial<ThiefState>;
  };
  readonly professionState?: ThiefRuntimeState | Partial<ThiefState>;
  readonly initialInitiative?: number;
  readonly initialShadowForce?: number;
  readonly time?: number;
}

export interface ThiefWeaponMatcherContext extends Gw2WeaponMatcherContext {
  readonly catalog?: CanonicalCatalog<ThiefSkill> | null;
  readonly config?: ThiefConfig;
  readonly state?: {
    readonly profession?: ThiefRuntimeState | Partial<ThiefState>;
  };
  readonly professionState?: ThiefRuntimeState | Partial<ThiefState>;
  readonly specialization?: string;
}
