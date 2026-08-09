import type {
  CanonicalCatalog,
  CastContext,
  CastLifecycleContext,
  SchedulerContext,
  SchedulerRecord,
  SchedulerState,
  SimulationActorType,
  Skill,
  SkillId,
} from "../../platform/engine/types.js";
import type {
  Gw2Build,
  Gw2BuildAttributeRuleContext,
  Gw2CanonicalBuild,
  Gw2Config,
  Gw2ResolverEvent,
  Gw2ResolverRuntime,
} from "../../platform/gw2/types.js";
import type { ProfessionApplicationBuild } from "../../app/profession/types.js";

export interface GuardianSpecializationSelection {
  readonly name?: string;
  readonly traits?: string;
}

export interface GuardianBuild extends Gw2Build {
  specializations?: GuardianSpecializationSelection[];
  assumptions?: { readonly quickness?: boolean };
}

export interface GuardianCanonicalBuild extends Gw2CanonicalBuild {
  initialTomePages: number;
}

export interface GuardianApplicationBuild extends ProfessionApplicationBuild {
  initialTomePages: number;
}

export interface GuardianBuildAttributeRuleContext
  extends Omit<Gw2BuildAttributeRuleContext, "build"> {
  readonly build: GuardianBuild;
}

export interface GuardianConfig extends Gw2Config {
  readonly selectedTraitIds?: readonly (string | number)[];
  readonly maximumTomePages?: number;
  readonly initialTomePages?: number;
  readonly initialEndurance?: number;
  readonly specialization?: string;
  readonly specializations?: readonly (string | { readonly name?: string })[];
}

export interface GuardianLightField {
  readonly startsAt: number;
  readonly endsAt: number;
}

export interface GuardianCoreState {
  endurance: number;
  maximumEndurance: number;
  enduranceUpdatedAt: number;
  justiceArmed: boolean;
  justiceActiveArmed: boolean;
  justiceHitCount: number;
  justiceBurns: number;
  justiceActiveBurns: number;
  justicePassiveBurns: number;
  virtueReadyAt: Record<"justice" | "resolve" | "courage", number>;
  lastVirtue: string;
  lastVirtuePassiveWasReady: boolean;
  autoattackChains: Record<string, SkillId>;
  availableFlips: Record<string, number>;
  symbolicAvengerStacks: number;
  symbolicAvengerUntil: number;
  zealotsResolutionReadyAt: number;
  resolutionUntil: number;
  righteousNextMightAt: number;
  furiousFocusReadyAt: number;
  spearIlluminatedArmed: boolean;
  spearIlluminatedUntil: number;
  spearLuminanceUntil: number;
  daybreakingSlashChainStep: number;
}

export interface GuardianFirebrandState {
  activeTome: string;
  tomePages: number;
  maximumTomePages: number;
  tomePageInterval: number;
  nextTomePageAt: number;
  ashesCharges: number;
  ashesNextTriggerAt: number;
  ashesExpiresAt: number;
  nextCourageAegisAt: number;
  swiftScholarTome: string;
  swiftScholarCount: number;
  liberatorsVowReadyAt: number;
  stalwartSpeedReadyAt: number;
  quickfireReadyAt: number;
}

export interface GuardianLuminaryState {
  radiantForge: boolean;
  radiantForgeEndsAt: number;
  radiantForgeEnteredAt: number;
  radiantWeapon: string;
  radiantWeaponsUsed: Record<string, boolean>;
  empoweredArmamentsUntil: number;
  piercingStanceUntil: number;
  lightAuraUntil: number;
  lightFields: GuardianLightField[];
  radiantJusticeArmed: boolean;
  radiantCourageSwordArmed: boolean;
  radiantCourageShieldArmed: boolean;
  effulgentActiveUntil: number;
  effulgentStacks: number;
}

export interface GuardianDragonhunterState {
  tetherUntil: number;
  nextCourageAegisAt: number;
  heavyLightReadyAt: number;
}

export interface GuardianState
  extends GuardianCoreState,
    GuardianDragonhunterState,
    GuardianFirebrandState,
    GuardianLuminaryState {}

export interface GuardianRuntimeState {
  core: GuardianCoreState;
  specialization:
    | { kind: "Core"; state: Record<string, never> }
    | { kind: "Dragonhunter"; state: GuardianDragonhunterState }
    | { kind: "Firebrand"; state: GuardianFirebrandState }
    | { kind: "Willbender"; state: Record<string, never> }
    | { kind: "Luminary"; state: GuardianLuminaryState };
}

export type GuardianSchedulerContext =
  SchedulerContext<GuardianRuntimeState> & {
    readonly config: GuardianConfig;
  };

export type GuardianCastContext = CastLifecycleContext<GuardianRuntimeState> & {
  readonly config: GuardianConfig;
};

export type GuardianPrecastContext = CastContext<GuardianRuntimeState> & {
  readonly config: GuardianConfig;
};

export interface GuardianEndStateProjectionOptions {
  readonly schedulerState: SchedulerState<GuardianRuntimeState>;
  readonly resolverState?: Partial<GuardianState> | null;
}

export interface GuardianAvailabilityContext extends SchedulerRecord {
  readonly config?: GuardianConfig;
  readonly catalog?: CanonicalCatalog;
  readonly specialization?: string;
  readonly specializations?: GuardianConfig["specializations"];
}

export interface GuardianEventExtra extends SchedulerRecord {
  readonly at?: number;
  readonly source?: string;
  readonly sourceId?: SkillId;
  readonly actorType?: SimulationActorType;
  readonly skillId?: SkillId | null;
  readonly skillName?: string;
}

export type GuardianEventContext = GuardianSchedulerContext & {
  readonly effectiveEnd?: number;
};

export interface GuardianStrikeFields extends SchedulerRecord {
  readonly at: number;
  readonly sourceId: SkillId;
  readonly skillId: SkillId | null;
  readonly skillName: string;
  readonly name: string;
  readonly coefficient: number;
  readonly source?: string;
  readonly actorType?: SimulationActorType;
  readonly hits?: number;
  readonly hitIndex?: number;
  readonly totalHits?: number;
}

export type GuardianResolverContext = Gw2ResolverRuntime & {
  config: GuardianConfig;
  profession: GuardianRuntimeState;
  readonly epsilon?: number;
};

export type GuardianVirtue = "justice" | "resolve" | "courage";

export type GuardianResolverEvent = Gw2ResolverEvent & {
  readonly activeTome?: string;
  readonly ashesCharges?: number;
  readonly ashesNextTriggerAt?: number;
  readonly ashesExpiresAt?: number;
  readonly automatic?: boolean;
  readonly isSymbol?: boolean;
  readonly nextTomePageAt?: number;
  readonly pageCost?: number;
  readonly pagesRemaining?: number;
  readonly passiveReadyAt?: number;
  readonly radiantForge?: boolean;
  readonly radiantForgeEndsAt?: number;
  readonly radiantForgeEnteredAt?: number;
  readonly radiantWeapon?: string;
  readonly specialization?: string;
  readonly tetherUntil?: number;
  readonly virtue?: GuardianVirtue;
};

export interface GuardianSkill extends Skill {
  readonly pageCost?: number;
  readonly radiantForgeSkill?: boolean;
  readonly radiantWeapon?: string;
  readonly tome?: string;
}

export interface GuardianUiContext extends SchedulerRecord {
  readonly specialization?: string;
  readonly config?: GuardianConfig;
  readonly state?: {
    readonly profession?: Partial<GuardianState>;
  };
  readonly professionState?: Partial<GuardianState>;
}
