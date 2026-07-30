import type {
  CanonicalCatalog,
  CastContext,
  CastLifecycleContext,
  ScheduledTask,
  SimulationEvent,
  SchedulerState,
  SchedulerContext,
  SchedulerRecord,
  Skill,
  SkillId,
} from "../../platform/engine/types.js";
import type {
  Gw2Build,
  Gw2CanonicalBuild,
  Gw2Config,
} from "../../platform/gw2/types.js";
import type {
  Gw2ResolverEvent,
  Gw2ResolverRuntime,
} from "../../platform/gw2/types.js";
import type {
  ProfessionApplicationBuild,
  ProfessionBuildAssumptions,
} from "../../app/profession/types.js";

export interface RevenantSpecializationSelection {
  readonly name?: string;
  readonly traits?: string;
}

export interface RevenantSkill extends Skill {
  readonly affinityOnHit?: boolean;
  readonly consume?: boolean;
  readonly comboField?: string;
  readonly duration?: number;
  readonly displayName?: string;
  readonly energyCost?: number;
  readonly facet?: boolean;
  readonly legendId?: string;
  readonly manualReleaseCooldown?: number;
  readonly paletteLegendId?: string;
  readonly starvationCooldown?: number;
  readonly upkeepCost?: number;
}

export type RevenantDodge =
  | "Death Drop"
  | "Saint of zu Heltzer"
  | "Imperial Impact";
export type RevenantAllianceSide = "luxon" | "kurzick";

export interface RevenantBuild extends Gw2Build {
  assumptions?: ProfessionBuildAssumptions;
  specializations?: RevenantSpecializationSelection[];
  selectedLegends?: string[];
  startingLegend?: string;
  selectedDodge?: RevenantDodge;
  allianceSide?: RevenantAllianceSide;
  initialEnergy?: number;
  playerHealthFraction?: number;
}

export interface RevenantCanonicalBuild extends Gw2CanonicalBuild {
  assumptions: SchedulerRecord;
  selectedLegends: string[];
  startingLegend: string;
  selectedDodge: RevenantDodge;
  allianceSide: RevenantAllianceSide;
  initialEnergy: number;
}

export interface RevenantApplicationBuild
  extends ProfessionApplicationBuild {
  initialEnergy: number;
  selectedLegends: string[];
  startingLegend: string;
  selectedDodge: RevenantDodge;
  allianceSide: RevenantAllianceSide;
}

export interface RevenantConfig extends Gw2Config {
  readonly specialization?: string;
  readonly selectedLegends?: readonly string[];
  readonly startingLegend?: string;
  readonly initialEnergy?: number;
  readonly allianceSide?: RevenantAllianceSide;
  readonly selectedDodge?: RevenantDodge;
  readonly selfConditionCount?: number;
  readonly targetsHit?: number;
  readonly targetCount?: number;
}

export interface RevenantTimedStack extends SchedulerRecord {
  at: number;
  expiresAt: number;
}

export interface RevenantChargeState extends SchedulerRecord {
  charges: number;
  expiresAt: number;
  readyAt: number;
}

export interface RevenantUpkeepState extends SchedulerRecord {
  skillId: SkillId;
  upkeepCost: number;
  empoweredNextPulse: boolean;
  nextAlliedProcAt: number | null;
  nextAffinityAt: number | null;
}

export interface RevenantSelfCondition extends SchedulerRecord {
  readonly condition: string;
  readonly stacks: number;
  readonly at: number;
  readonly expiresAt: number;
  readonly sourceId: SkillId;
  readonly skillName: string;
}

export interface RevenantState extends SchedulerRecord {
  energy: number;
  maximumEnergy: number;
  energyUpdatedAt: number;
  activeLegendId: string;
  activeLoadoutId: string;
  selectedLegendIds: string[];
  legendSwapReadyAt: number;
  activeUpkeeps: RevenantUpkeepState[];
  availableFlips: Record<string, boolean>;
  autoattackChains: Record<string, SkillId>;
  abyssalStrikeSecondCast: boolean;
  allianceSide: RevenantAllianceSide;
  endurance: number;
  maximumEndurance: number;
  enduranceUpdatedAt: number;
  selectedDodge: RevenantDodge;
  reaversCurseUntil: number;
  forerunnerOfDeathUntil: number;
  affinity: number;
  cosmicWisdomUntil: number;
  conduitForm: string;
  beguilingHazeCharges: number;
  beguilingHazeReadyAt: number;
  beguilingHazeMainReservations: string[];
  bandTogetherReady: boolean;
  bandTogetherExpiresAt: number;
  kallasFervor: RevenantTimedStack[];
  renegadeCriticalProgress: number;
  enchantedDaggers: RevenantChargeState;
  razorclawsRage: RevenantChargeState;
  battleScars: RevenantTimedStack[];
  crushingAbyss: number[];
  combatBeganAt: number | null;
  nextThrillOfCombatAt: number | null;
  exposeDefensesUsed: boolean;
  selfConditionDurationMultiplier: number;
  selfConditions: RevenantSelfCondition[];
  selfConditionCount: number;
  activeLegendSummons: Record<string, number>;
  traitProcReadyAt: Record<string, number | boolean>;
}

export type RevenantSchedulerContext = SchedulerContext<RevenantState> & {
  readonly catalog: CanonicalCatalog<RevenantSkill>;
  readonly config: RevenantConfig;
  readonly schedulerPolicy: SchedulerContext<
    RevenantState
  >["schedulerPolicy"] & {
    readonly combatBeganAt?: () => number | null;
    readonly critical?: (
      context: RevenantSchedulerContext,
      event: SimulationEvent,
    ) => { readonly chance?: number };
    readonly isCombatActive?: () => boolean;
    readonly requireCriticalFacts?: () => void;
  };
};

export type RevenantCastContext = CastLifecycleContext<RevenantState> & {
  readonly catalog: CanonicalCatalog<RevenantSkill>;
  readonly config: RevenantConfig;
  readonly skill: RevenantSkill;
};

export type RevenantPrecastContext = CastContext<RevenantState> & {
  readonly catalog: CanonicalCatalog<RevenantSkill>;
  readonly config: RevenantConfig;
  readonly skill: RevenantSkill;
};

export type RevenantRechargeContext = RevenantSchedulerContext &
  SchedulerRecord & {
    readonly skill?: RevenantSkill;
    readonly at: number;
    readonly start?: number;
    readonly hasBuff?: (kind: string, at?: number) => boolean;
  };

export interface RevenantEnergyContext {
  readonly config?: RevenantConfig;
  readonly state?:
    | SchedulerState<RevenantState>
    | Partial<RevenantState>;
  readonly professionState?: Partial<RevenantState>;
  readonly start?: number;
  readonly time?: number;
  readonly epsilon?: number;
  readonly hasBuff?: (kind: string, at?: number) => boolean;
}

export type RevenantScheduledTask<
  TPayload extends SchedulerRecord = SchedulerRecord,
> = ScheduledTask<TPayload>;

export type RevenantSimulationEvent = SimulationEvent & {
  readonly __order?: number;
  readonly weaponSet?: number;
};

export type RevenantResolverEvent = Gw2ResolverEvent & {
  readonly lifeSiphon?: boolean;
  readonly state?: Partial<RevenantState>;
};

export type RevenantResolverContext = Gw2ResolverRuntime & {
  config: RevenantConfig;
  profession: RevenantState;
};

export interface RevenantUiContext extends SchedulerRecord {
  readonly specialization?: string;
  readonly config?: RevenantConfig;
  readonly build?: RevenantBuild;
  readonly state?: {
    readonly profession?: Partial<RevenantState>;
  };
  readonly professionState?: Partial<RevenantState>;
  readonly initialEnergy?: number;
  readonly cooldowns?: Readonly<
    Record<string, { readonly remaining?: number }>
  >;
  readonly entry?: unknown;
  readonly rotation?: readonly unknown[];
  readonly index?: number;
  readonly time?: number;
}
