import type {
  CanonicalCatalog,
  CastContext,
  CastLifecycleContext,
  SchedulerContext,
  SchedulerRecord,
  SchedulerState,
  SimulationEvent,
  Skill,
  SkillId
} from '../../platform/engine/types.js';
import type {
  Gw2Build,
  Gw2BuildSpecialization,
  Gw2CanonicalBuild,
  Gw2Config,
  Gw2EventDraft,
  Gw2HitResolutionContext,
  Gw2QueryRuntime,
  Gw2ResolverEvent,
  Gw2ResolverRuntime
} from '../../platform/gw2/types.js';

export interface NecromancerBuild extends Gw2Build {
  specializations?: Gw2BuildSpecialization[];
  assumptions?: SchedulerRecord;
  initialResource?: number;
  initialBlight?: number;
  initialCascadingCorruptionStacks?: number;
  selectedSkills?: Record<string, string>;
}

export interface NecromancerCanonicalBuild extends Gw2CanonicalBuild {
  assumptions: SchedulerRecord;
  initialResource: number;
  initialBlight: number;
  initialCascadingCorruptionStacks: number;
}

export interface NecromancerConfig extends Gw2Config {
  readonly specialization?: string;
  readonly initialResource?: number;
  readonly initialBlight?: number;
  readonly initialCascadingCorruptionStacks?: number;
  readonly duration?: number;
  readonly selectedSkills?: readonly string[] | Readonly<Record<string, string>>;
  readonly professionAssumptions?: Readonly<Record<string, unknown>>;
}

export interface NecromancerSelfCondition extends SchedulerRecord {
  readonly condition: string;
  readonly stacks: number;
  readonly duration?: number;
  readonly appliedAt: number;
  readonly expiresAt: number;
  readonly sourceSkillId?: SkillId;
  readonly sourceSkillName?: string;
}

export interface NecromancerWeaponSpellRecipient extends SchedulerRecord {
  stacks: number;
  nextAt: number;
}

export interface NecromancerWeaponSpellState extends SchedulerRecord {
  readonly skillId?: SkillId;
  readonly skillName?: string;
  readonly appliedAt?: number;
  readonly expiresAt?: number;
  readonly recipients?: Record<string, NecromancerWeaponSpellRecipient>;
}

export interface NecromancerTasteForBloodApplication {
  readonly at: number;
  readonly expiresAt: number;
  stacks: number;
}

export interface NecromancerCoreState {
  lifeForce: number;
  resource: number;
  maximumLifeForce: number;
  maximumHealth: number;
  lifeForcePoolCapacity: number;
  activeShroud: string;
  activeShroudEntryId?: SkillId | null;
  activeShroudExitId?: SkillId | null;
  activeShroudProfileId?: string;
  shroudEnteredAt: number;
  lastResourceAt: number;
  soulShards: number;
  soulShardExpiries: number[];
  carapaceExpiries: number[];
  activeMinions: Record<string, number>;
  minionGenerations: Record<string, number>;
  minionAttackGenerations: Record<string, number>;
  minionAttackAnchors: Record<string, number>;
  minionAttackCycleOffsets: Record<string, number>;
  availableFlips: Record<string, boolean | number | SchedulerRecord>;
  autoattackChains: Record<string, SkillId>;
  selfConditions: NecromancerSelfCondition[];
  plagueSendingArmed: boolean;
  plagueSendingEntrySkillId: SkillId | null;
  lichEndsAt: number;
  pendingShroudEntryId?: SkillId | null;
  signetNextLifeForceAt: number;
  vampirismNextAt: number;
  targetChilledUntil: number;
  targetControlledUntil: number;
  dreadUntil: number;
  fearOfDeathReadyAt: number;
  vampiricPresenceReadyAt: number;
  barbedPrecisionProgress: number;
  spitefulFortitudeLifeForce: number;
  traitProcReadyAt: Record<string, number>;
  tasteForBloodBuffs: Record<string, NecromancerTasteForBloodApplication[]>;
}

export interface ReaperState {
  chillingNovaProgress: number;
  chillingNovaReadyAt: number;
  chillingVictoryReadyAt: number;
}

export interface ScourgeState {
  shades: number[];
  demonicLoreReadyAt: number;
  nourishingAshesReadyAt: number;
}

export interface HarbingerState {
  nextBlightAt?: number;
  blight: number;
  blightExpiries: number[];
  cascadingCorruptionStacks: number;
  meltdownUntil: number;
}

export interface RitualistState {
  activeSpirits: Record<string, boolean>;
  spiritGenerations: Record<string, number>;
  spiritInitialUntil: Record<string, number>;
  spiritBusyUntil: Record<string, number>;
  spiritAutoAnchorAt: number;
  resummonedSpiritAutoCycle: boolean;
  weaponSpells: Record<string, NecromancerWeaponSpellState>;
  soulTwistingAvailable: boolean;
  pendingSoulTwistSkill?: SkillId | null;
  painfulBondUntil: number;
  painfulBondPulseAnchorAt: number;
}

export interface NecromancerState
  extends NecromancerCoreState, ReaperState, ScourgeState, HarbingerState, RitualistState {}

export interface NecromancerRuntimeState {
  core: NecromancerCoreState;
  specialization:
    | { kind: 'Core'; state: Record<string, never> }
    | { kind: 'Reaper'; state: ReaperState }
    | { kind: 'Scourge'; state: ScourgeState }
    | { kind: 'Harbinger'; state: HarbingerState }
    | { kind: 'Ritualist'; state: RitualistState };
}

export interface NecromancerSkill extends Skill {
  readonly blightCost?: number;
  readonly dhuumfireDuration?: number;
  readonly flipParent?: string;
  readonly lifeForceCost?: number;
  readonly lifeForceGain?: number;
  readonly shroud?: string;
  readonly shroudDrainPercent?: number;
  readonly shroudEntry?: string;
  readonly shroudExit?: string;
  readonly shroudProfileId?: string;
  readonly minimumShroudLifeForcePercent?: number;
  readonly usableInShroud?: boolean;
  readonly shroudSlot?: number;
  readonly slotSelectable?: boolean;
}

export type NecromancerSchedulerContext = SchedulerContext<NecromancerRuntimeState> & {
  readonly catalog: CanonicalCatalog<NecromancerSkill>;
  readonly config: NecromancerConfig;
};

export type NecromancerCastContext = CastLifecycleContext<NecromancerRuntimeState> & {
  readonly catalog: CanonicalCatalog<NecromancerSkill>;
  readonly config: NecromancerConfig;
};

export type NecromancerEmissionContext = NecromancerSchedulerContext & {
  readonly effectiveEnd?: number;
};

export type NecromancerPrecastContext = CastContext<NecromancerRuntimeState> & {
  readonly catalog: CanonicalCatalog<NecromancerSkill>;
  readonly config: NecromancerConfig;
};

export type NecromancerCastModifierContext = Omit<
  CastContext<NecromancerRuntimeState>,
  'config' | 'skill' | 'state'
> & {
  readonly config: NecromancerConfig;
  readonly skill?: NecromancerSkill;
  readonly state: SchedulerState<NecromancerRuntimeState>;
  readonly start: number;
  readonly hasBuff?: (name: string, at: number) => boolean;
};

export type NecromancerRechargeModifierContext = Omit<SchedulerContext<NecromancerRuntimeState>, 'config'> & {
  readonly config: NecromancerConfig;
  readonly skill?: NecromancerSkill;
  readonly minionDeathRecharge?: boolean;
};

export type NecromancerAmmoModifierContext = NecromancerRechargeModifierContext & {
  readonly skill?: NecromancerSkill;
};

export type NecromancerSimulationEvent = SimulationEvent & {
  readonly activeSpirits?: number;
  readonly anguishConditionalDamage?: boolean;
  readonly application?: NecromancerSimulationEvent;
  readonly cancelled?: boolean;
  readonly coefficient?: number;
  readonly condition?: string;
  readonly essenceBlastDamagePerSpirit?: number;
  readonly dhuumfireDuration?: number;
  readonly dhuumfireInterval?: number;
  readonly expiresAt?: number;
  readonly hitIndex?: number;
  readonly necromancerBlight?: number;
  readonly necromancerShroudSkillOne?: boolean;
  readonly spirit?: string;
  readonly spiritAttackType?: string;
  readonly state?: Partial<NecromancerState>;
  readonly summonKind?: string;
};

export type NecromancerResolverEvent = Gw2ResolverEvent & {
  readonly activeSpirits?: number;
  readonly anguishConditionalDamage?: boolean;
  readonly application?: NecromancerResolverEvent;
  readonly coefficient?: number;
  readonly essenceBlastDamagePerSpirit?: number;
  readonly dhuumfireDuration?: number;
  readonly dhuumfireInterval?: number;
  readonly necromancerBlight?: number;
  readonly necromancerShroudSkillOne?: boolean;
  readonly spirit?: string;
  readonly spiritAttackType?: string;
  readonly state?: Partial<NecromancerState>;
  readonly summonKind?: string;
  readonly summonCount?: number;
  readonly summonOwner?: string;
  readonly summonOwnerBase?: string;
  readonly summonBasePower?: number;
  readonly summonDamagePerCoefficient?: number;
  readonly summonCriticalChance?: number;
  readonly summonCriticalDamage?: number;
  readonly independentSummonStrike?: boolean;
  readonly requiresMinion?: string;
  readonly requiresMinionIndex?: number;
  readonly requiresMinionGeneration?: number;
  readonly requiresMinionAttackGeneration?: number;
  readonly requiresSpirit?: string;
  readonly requiresSpiritGeneration?: number;
  readonly mode?: string;
  readonly recipients?: readonly string[];
  readonly alliedPlayerCount?: number;
  readonly recipientCount?: number;
  readonly playerStacks?: number;
  readonly allyStacks?: number;
  readonly spell?: string;
  readonly triggeredByAlly?: number;
  readonly procIndex?: number;
  readonly alliesReceiveFullBenefit?: boolean;
  readonly controlKind?: string;
  readonly effectiveDuration?: number;
};

export type NecromancerResolverContext = Gw2ResolverRuntime & {
  config: NecromancerConfig;
  profession: NecromancerRuntimeState;
  readonly state?: { readonly profession: NecromancerRuntimeState };
};

export interface NecromancerResolverReactionDetails extends SchedulerRecord {
  readonly hitContext?: Gw2HitResolutionContext;
  readonly applyCondition?: (context: Gw2ResolverRuntime, event: Gw2EventDraft) => unknown;
}

export type NecromancerQueryRuntime = Gw2QueryRuntime & {
  readonly profession?: NecromancerRuntimeState | Partial<NecromancerState> | null;
  readonly totals?: {
    readonly strike?: number;
    readonly condition?: number;
  };
};

export interface NecromancerEndStateProjectionOptions {
  readonly schedulerState: SchedulerState<NecromancerRuntimeState>;
  readonly resolverState?: Partial<NecromancerState> | null;
}

export interface NecromancerUiContext extends SchedulerRecord {
  readonly specialization?: string;
  readonly config?: NecromancerConfig;
  readonly build?: NecromancerBuild;
  readonly state?: {
    readonly profession?: Partial<NecromancerState>;
  };
  readonly professionState?: Partial<NecromancerState>;
  readonly lifeForcePoolCapacity?: number;
  readonly value?: number;
  readonly initialResource?: number;
  readonly initialBlight?: number;
  readonly initialCascadingCorruptionStacks?: number;
}
