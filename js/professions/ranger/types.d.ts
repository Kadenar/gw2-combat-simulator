import type {
  CanonicalCatalog,
  CastLifecycleContext,
  SchedulerContext,
  SchedulerRecord,
  SchedulerState,
  Skill,
  SkillId,
} from "../../platform/engine/types.js";
import type {
  Gw2Build,
  Gw2CanonicalBuild,
  Gw2Config,
  Gw2ResolverEvent,
  Gw2ResolverRuntime,
} from "../../platform/gw2/types.js";
import type { ProfessionApplicationBuild } from "../../app/profession/types.js";

export interface RangerSpecializationSelection {
  readonly name?: string;
  readonly traits?: string;
}

export type RangerInitialUntamedState = "Pet" | "Ranger";

export interface RangerBuild extends Gw2Build {
  specializations?: RangerSpecializationSelection[];
  assumptions?: RangerAssumptions;
  selectedPet?: string;
  selectedHammerSkillIds?: number[];
  initialUntamedState?: RangerInitialUntamedState;
}

export interface RangerAssumptions extends Record<string, unknown> {
  readonly flanking?: boolean;
  readonly targetDefiant?: boolean;
}

export interface RangerCanonicalBuild extends Gw2CanonicalBuild {
  initialAstralForce: number;
  initialArrows: number;
  selectedPet: string;
  selectedHammerSkillIds: number[];
  initialUntamedState: RangerInitialUntamedState;
}

export interface RangerApplicationBuild extends ProfessionApplicationBuild {
  initialAstralForce: number;
  initialArrows: number;
  selectedPet: string;
  selectedHammerSkillIds: number[];
  initialUntamedState: RangerInitialUntamedState;
}

export interface RangerConfig extends Gw2Config {
  readonly specialization?: string;
  readonly specializations?: readonly (string | { readonly name?: string })[];
  readonly selectedTraitIds?: readonly (string | number)[];
  readonly initialAstralForce?: number;
  readonly initialArrows?: number;
  readonly selectedPet?: string;
  readonly selectedHammerSkillIds?: readonly number[];
  readonly initialUntamedState?: RangerInitialUntamedState;
  readonly assumptions?: RangerAssumptions;
  readonly professionAssumptions?: RangerAssumptions;
}

export interface RangerPetDefinition {
  readonly id: number;
  readonly name: string;
  readonly icon: string;
  readonly description: string;
  readonly family: string;
  readonly archetype: string;
  readonly skillIds: readonly SkillId[];
  readonly beastmodeSkillIds: readonly SkillId[];
}

export interface RangerCoreState {
  activePet: string;
  activePetSkillIds: SkillId[];
  availableFlips: Record<string, SkillId>;
  autoattackChains: Record<string, SkillId>;
}

export interface DruidState {
  astralForce: number;
  maximumAstralForce: number;
  celestialAvatarActive: boolean;
  celestialAvatarEndsAt: number;
}

export interface SoulbeastState {
  beastmodeActive: boolean;
  archetype: string;
  oneWolfPackUntil: number;
  oneWolfPackReadyAt: number;
}

export interface UntamedState {
  rangerUnleashed: boolean;
  ambushReadyUntil: number;
}

export interface GaleshotState {
  cycloneBowActive: boolean;
  arrows: number;
  maximumArrows: number;
  arrowsUpdatedAt: number;
  windForce: number;
}

export interface RangerState extends RangerCoreState {
  astralForce?: number;
  maximumAstralForce?: number;
  celestialAvatarActive?: boolean;
  celestialAvatarEndsAt?: number;
  beastmodeActive?: boolean;
  archetype?: string;
  oneWolfPackUntil?: number;
  oneWolfPackReadyAt?: number;
  rangerUnleashed?: boolean;
  ambushReadyUntil?: number;
  cycloneBowActive?: boolean;
  arrows?: number;
  maximumArrows?: number;
  arrowsUpdatedAt?: number;
  windForce?: number;
}

export interface RangerRuntimeState {
  core: RangerCoreState;
  specialization:
    | { kind: "Core"; state: Record<string, never> }
    | { kind: "Druid"; state: DruidState }
    | { kind: "Soulbeast"; state: SoulbeastState }
    | { kind: "Untamed"; state: UntamedState }
    | { kind: "Galeshot"; state: GaleshotState };
}

export type RangerSchedulerContext = SchedulerContext<RangerRuntimeState> & {
  readonly config: RangerConfig;
};
export type RangerCastContext = CastLifecycleContext<RangerRuntimeState> & {
  readonly config: RangerConfig;
};
export type RangerPrecastContext = RangerCastContext;
export type RangerResolverContext = Gw2ResolverRuntime & {
  config: RangerConfig;
  profession: RangerRuntimeState;
};
export type RangerResolverEvent = Gw2ResolverEvent;

export interface RangerEndStateProjectionOptions {
  readonly schedulerState: SchedulerState<RangerRuntimeState>;
  readonly resolverState?: Partial<RangerState> | null;
}

export interface RangerSkill extends Skill {
  readonly petSkill?: boolean;
  readonly celestialAvatarSkill?: boolean;
  readonly beastmodeSkill?: boolean;
  readonly unleashedPetSkill?: boolean;
  readonly unleashedHammerSkill?: boolean;
  readonly cycloneBowSkill?: boolean;
  readonly arrowCost?: number;
  readonly arrowsRestored?: number;
  readonly petNames?: readonly string[];
}

export interface RangerUiContext extends SchedulerRecord {
  readonly specialization?: string;
  readonly config?: RangerConfig;
  readonly catalog?: CanonicalCatalog;
  readonly state?: {
    readonly profession?: RangerRuntimeState | Partial<RangerState>;
  };
  readonly professionState?: RangerRuntimeState | Partial<RangerState>;
  readonly build?: RangerBuild;
  readonly initialAstralForce?: number;
  readonly initialArrows?: number;
}

export interface RangerUiSelection extends SchedulerRecord {
  readonly key?: string;
  readonly index?: number;
  readonly skillId?: SkillId;
  readonly value?: string;
}
