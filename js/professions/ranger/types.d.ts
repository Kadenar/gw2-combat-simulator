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

export interface RangerApplicationBuild extends ProfessionApplicationBuild {
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

export interface RangerCoreState {
  activePet: string;
  activePetSlot: 1 | 2;
  petNames: [string, string];
  activePetSkillIds: SkillId[];
  endurance: number;
  maximumEndurance: number;
  enduranceUpdatedAt: number;
  availableFlips: Record<string, number>;
  autoattackChains: Record<string, SkillId>;
  winterBiteReady: boolean;
  tailWindReadyAt: number;
  furiousGripReadyAt: number;
  sharpenedEdgesProgress: number;
  quickDrawReadyAt: number;
  quickDrawUntil: number;
  trapCrippleActivations: Record<string, boolean>;
  bloodThirstCharges: number;
  rejuvenationReadyAt: number;
  childOfEarthReadyAt: number;
  clarionBondReadyAt: number;
  carnivoreReadyAt: number;
  goForTheThroatPetReadyAt: number;
  huntersGazeReadyAt: number;
  playerOpeningStrikeReady: boolean;
  petOpeningStrikeReady: boolean;
  poisonMasterPetAttackReady: boolean;
  poisonousStrikesCharges: number;
  poisonousStrikesExpiresAt: number;
  sharpeningStoneCharges: number;
  sharpeningStoneExpiresAt: number;
  petSwapCount: number;
  petAutoGeneration: number;
  petAutoNextAt: number;
  petAutoBusyUntil: number;
  petAutoCooldowns: Record<string, number>;
  petAutoActivationUses: Record<string, number>;
  petAutoActivationCounts: [number, number];
  petAutoOpeningBasic: boolean;
  petAutoTaskId: string;
  petCommandReadyAt: number;
  petCommandCooldowns: Record<string, number>;
  petCommandDelays: Record<string, number>;
}

export interface DruidState {
  astralForce: number;
  maximumAstralForce: number;
  celestialAvatarActive: boolean;
  celestialAvatarEndsAt: number;
  astralForceUpdatedAt: number;
  naturalMenderReadyAt: number;
}

export interface SoulbeastState {
  beastmodeActive: boolean;
  archetype: string;
  oneWolfPackUntil: number;
  oneWolfPackReadyAt: number;
  goForTheEyesReadyAt: number;
  beastlyWardenReadyAt: number;
  goForTheThroatReadyAt: number;
  bestialRageReadyAt: number;
  essenceOfSpeedReadyAt: number;
  vultureStanceReadyAt: number;
  beastAbilityActivations: Record<string, boolean>;
}

export interface UntamedState {
  rangerUnleashed: boolean;
  ambushReadyUntil: number;
  unleashedPowerReadyAt: number;
  letLooseReadyAt: number;
  debilitatingBlowsReadyAt: number;
  enhancingImpactReadyAt: number;
  ferociousSymbiosisPlayerStacks: number;
  ferociousSymbiosisPlayerUntil: number;
  ferociousSymbiosisPlayerReadyAt: number;
  ferociousSymbiosisPetStacks: number;
  ferociousSymbiosisPetUntil: number;
  ferociousSymbiosisPetReadyAt: number;
  letLooseActivations: Record<string, boolean>;
}

export interface GaleshotState {
  cycloneBowActive: boolean;
  arrows: number;
  maximumArrows: number;
  arrowsUpdatedAt: number;
  windForce: number;
  galeForceUntil: number;
  mistralUntil: number;
  wutheringWindReady: boolean;
  wutheringWindReadyAt: number;
  wutheringWindActivationIds: Record<string, boolean>;
  thrillOfTheCatchReadyAt: number;
  flockTogetherReadyAt: number;
  missileHits: number;
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
