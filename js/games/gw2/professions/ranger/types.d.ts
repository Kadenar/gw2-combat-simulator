import type { CanonicalCatalog, Skill, SkillId } from '#gw2/platform/engine/skills/types.js';
import type {
  CastLifecycleContext,
  SchedulerContext,
  SchedulerRecord,
  SchedulerState
} from '#gw2/platform/engine/execution/types.js';
import type { Gw2ApplicationBuild, Gw2Build, Gw2CanonicalBuild } from '#gw2/platform/builds/types.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { Gw2ResolverRuntime } from '#gw2/platform/resolver/runtime-state.js';
import type { ProfessionTraitSelection } from '#gw2/professions/lib/trait-data.js';
import type { RangerCoreState } from '#gw2/professions/ranger/core/state.js';
import type { DruidState } from '#gw2/professions/ranger/specializations/druid/state.js';
import type { GaleshotState } from '#gw2/professions/ranger/specializations/galeshot/state.js';
import type { SoulbeastState } from '#gw2/professions/ranger/specializations/soulbeast/state.js';
import type { RangerInitialUntamedState, UntamedState } from '#gw2/professions/ranger/specializations/untamed/state.js';

// Module state is declared beside each state factory; re-export it for existing family type importers.
export type { DruidState, GaleshotState, RangerCoreState, RangerInitialUntamedState, SoulbeastState, UntamedState };

export type RangerSpecializationSelection = ProfessionTraitSelection;

export interface RangerBuild extends Gw2Build {
  specializations?: RangerSpecializationSelection[];
  assumptions?: RangerAssumptions;
  selectedPet?: string;
  selectedPet2?: string;
  selectedHammerSkillIds?: number[];
  initialUntamedState?: RangerInitialUntamedState;
}

export interface RangerAssumptions extends Record<string, unknown> {
  readonly targetDefiant?: boolean;
}

export interface RangerCanonicalBuild extends Gw2CanonicalBuild {
  initialAstralForce: number;
  initialArrows: number;
  selectedPet: string;
  selectedPet2: string;
  selectedHammerSkillIds: number[];
  initialUntamedState: RangerInitialUntamedState;
}

export interface RangerApplicationBuild extends Gw2ApplicationBuild {
  initialAstralForce: number;
  initialArrows: number;
  selectedPet: string;
  selectedPet2: string;
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
  readonly selectedPet2?: string;
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
  ferociousSymbiosisPlayerStacks?: number;
  ferociousSymbiosisPlayerUntil?: number;
  ferociousSymbiosisPetStacks?: number;
  ferociousSymbiosisPetUntil?: number;
  cycloneBowActive?: boolean;
  arrows?: number;
  maximumArrows?: number;
  arrowsUpdatedAt?: number;
  windForce?: number;
  galeForceUntil?: number;
  mistralUntil?: number;
  wutheringWindReady?: boolean;
  wutheringWindReadyAt?: number;
  wutheringWindActivationIds?: Record<string, boolean>;
  thrillOfTheCatchReadyAt?: number;
  flockTogetherReadyAt?: number;
  missileHits?: number;
}

export interface RangerRuntimeState {
  core: RangerCoreState;
  specialization:
    | { kind: 'Core'; state: Record<string, never> }
    | { kind: 'Druid'; state: DruidState }
    | { kind: 'Soulbeast'; state: SoulbeastState }
    | { kind: 'Untamed'; state: UntamedState }
    | { kind: 'Galeshot'; state: GaleshotState };
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
  readonly petFamilySkill?: boolean;
  readonly petAutonomousSkill?: boolean;
  readonly celestialAvatarSkill?: boolean;
  readonly beastmodeSkill?: boolean;
  readonly unleashedPetSkill?: boolean;
  readonly unleashedAmbushSkill?: boolean;
  readonly unleashedHammerSkill?: boolean;
  readonly cycloneBowSkill?: boolean;
  readonly arrowCost?: number;
  readonly arrowsRestored?: number;
  readonly windForceGain?: number;
  readonly windForceApplyMs?: number;
  readonly petNames?: readonly string[];
  readonly missileHits?: number;
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
  readonly selectedPet2?: string;
}

export interface RangerUiSelection extends SchedulerRecord {
  readonly key?: string;
  readonly index?: number;
  readonly skillId?: SkillId;
  readonly value?: string;
}
