import type {
  CanonicalCatalog,
  CastLifecycleContext,
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
  Gw2ResolverEvent,
  Gw2ResolverRuntime,
} from "../../platform/gw2/types.js";

export interface WarriorBuild extends Gw2Build {
  specializations?: Gw2BuildSpecialization[];
  assumptions?: SchedulerRecord;
  initialResource?: number;
  selectedSkills?: Record<string, string>;
}

export interface WarriorCanonicalBuild extends Gw2CanonicalBuild {
  assumptions: SchedulerRecord;
  initialResource: number;
}

export interface WarriorConfig extends Gw2Config {
  readonly specialization?: string;
  readonly initialResource?: number;
  readonly selectedSkills?:
    readonly string[] | Readonly<Record<string, string>>;
}

export interface WarriorCoreState {
  adrenaline: number;
  resource: number;
  maximumAdrenaline: number;
  lastResourceAt: number;
  autoattackChains: Record<string, SkillId>;
  availableFlips: Record<string, number | boolean | SchedulerRecord>;
  burstPowerExpiries: number[];
  signetMasteryExpiries: number[];
  targetControlledUntil: number;
  soldierFocusReadyAt: number;
  traitProcReadyAt: Record<string, number>;
}

export interface BerserkerState {
  berserkActive: boolean;
  berserkUntil: number;
}

export interface SpellbreakerState {
  attackerInsightExpiries: number[];
  fullCounterActiveUntil: number;
}

export interface BladeswornState {
  flow: number;
  maximumFlow: number;
  flowUpdatedAt: number;
  gunsaberActive: boolean;
  dragonTriggerActive: boolean;
  dragonTriggerStartedAt: number;
  nextDragonChargeAt: number;
  dragonCharges: number;
  fierceAsFireExpiries: number[];
  gunsAndGloryUntil: number;
}

export interface ParagonState {
  motivation: number;
  maximumMotivation: number;
  activeRefrain: string;
  nextRefrainAt: number;
}

export interface WarriorState
  extends
    WarriorCoreState,
    BerserkerState,
    SpellbreakerState,
    BladeswornState,
    ParagonState {}

export interface WarriorRuntimeState {
  core: WarriorCoreState;
  specialization:
    | { kind: "Core"; state: Record<string, never> }
    | { kind: "Berserker"; state: BerserkerState }
    | { kind: "Spellbreaker"; state: SpellbreakerState }
    | { kind: "Bladesworn"; state: BladeswornState }
    | { kind: "Paragon"; state: ParagonState };
}

export interface WarriorSkill extends Skill {
  readonly adrenalineCost?: number;
  readonly adrenalineGain?: number;
  readonly flowGain?: number;
  readonly burst?: boolean;
  readonly burstTier?: number;
  readonly primalBurst?: boolean;
  readonly gunsaberSkill?: boolean;
  readonly dragonSlash?: boolean;
  readonly dragonSlashMaximumCoefficient?: number;
}

export type WarriorSchedulerContext = SchedulerContext<WarriorRuntimeState> &
  SchedulerRecord & {
    readonly catalog: CanonicalCatalog<WarriorSkill>;
    readonly config: WarriorConfig;
  };

export type WarriorCastContext = CastLifecycleContext<WarriorRuntimeState> & {
  readonly catalog: CanonicalCatalog<WarriorSkill>;
  readonly config: WarriorConfig;
};

export type WarriorSimulationEvent = SimulationEvent & {
  readonly coefficient?: number;
  readonly condition?: string;
  readonly resourceAmount?: number;
  readonly state?: Partial<WarriorState>;
};

export type WarriorResolverEvent = Gw2ResolverEvent & {
  readonly resourceAmount?: number;
  readonly state?: Partial<WarriorState>;
};

export type WarriorResolverContext = Gw2ResolverRuntime & {
  config: WarriorConfig;
  profession: WarriorRuntimeState;
};

export interface WarriorEndStateProjectionOptions {
  readonly schedulerState: SchedulerState<WarriorRuntimeState>;
  readonly resolverState?: Partial<WarriorState> | null;
}

export interface WarriorUiContext extends SchedulerRecord {
  readonly specialization?: string;
  readonly config?: WarriorConfig;
  readonly build?: WarriorBuild;
  readonly state?: {
    readonly profession?: WarriorRuntimeState | Partial<WarriorState>;
  };
  readonly professionState?: WarriorRuntimeState | Partial<WarriorState>;
  readonly initialResource?: number;
  readonly activeWeaponSet?: number;
}
