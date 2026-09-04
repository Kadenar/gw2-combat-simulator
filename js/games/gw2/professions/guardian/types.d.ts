import type { CanonicalCatalog, Skill, SkillId } from '#gw2/platform/engine/skills/types.js';
import type {
  CastContext,
  CastLifecycleContext,
  SchedulerContext,
  SchedulerRecord,
  SchedulerState
} from '#gw2/platform/engine/execution/types.js';
import type { SimulationActorType } from '#gw2/platform/engine/events/types.js';
import type {
  Gw2ApplicationBuild,
  Gw2Build,
  Gw2BuildAttributeRuleContext,
  Gw2CanonicalBuild
} from '#gw2/platform/builds/types.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import type { Gw2ResolverEvent, Gw2ResolverRuntime } from '#gw2/platform/resolver/types.js';
import type { ProfessionTraitSelection } from '#gw2/professions/lib/traits.js';

export type GuardianSpecializationSelection = ProfessionTraitSelection;

export interface GuardianBuild extends Gw2Build {
  specializations?: GuardianSpecializationSelection[];
  assumptions?: { readonly quickness?: boolean };
}

export interface GuardianCanonicalBuild extends Gw2CanonicalBuild {
  initialTomePages: number;
}

export interface GuardianApplicationBuild extends Gw2ApplicationBuild {
  initialTomePages: number;
}

export interface GuardianBuildAttributeRuleContext extends Omit<Gw2BuildAttributeRuleContext, 'build'> {
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
  virtueReadyAt: Record<'justice' | 'resolve' | 'courage', number>;
  lastVirtue: string;
  lastVirtuePassiveWasReady: boolean;
  autoattackChains: Record<string, SkillId>;
  availableFlips: Record<string, number>;
  symbolicAvengerStacks: number;
  symbolicAvengerUntil: number;
  symbolIgnitionStartsAt: number;
  symbolIgnitionUntil: number;
  symbolIgnitionReadyAt: number;
  zealotsResolutionReadyAt: number;
  resolutionUntil: number;
  righteousNextMightAt: number;
  furiousFocusReadyAt: number;
  spearIlluminatedArmed: boolean;
  spearIlluminatedUntil: number;
  spearLuminanceUntil: number;
}

export interface GuardianFirebrandState {
  activeTome: string;
  tomePages: number;
  maximumTomePages: number;
  tomePageInterval: number;
  nextTomePageAt: number;
  ashesCharges: number;
  ashesBurnDuration: number;
  ashesNextTriggerAt: number;
  ashesExpiresAt: number;
  nextCourageAegisAt: number;
  tomeDormantReadyAt: Record<'justice' | 'resolve' | 'courage', number>;
  swiftScholarTome: string;
  swiftScholarCount: number;
  liberatorsVowReadyAt: number;
  stalwartSpeedReadyAt: number;
  quickfireReadyAt: number;
  mantraRechargeReadyAt: Record<string, number>;
}

export interface GuardianLuminaryState {
  radiantForge: boolean;
  radiantForgeEndsAt: number;
  radiantForgeEnteredAt: number;
  radiantWeapon: string;
  radiantWeaponsUsed: Record<string, boolean>;
  glaringBurstSwordSlow: boolean;
  empoweredArmamentsUntil: number;
  piercingStanceUntil: number;
  lightAuraUntil: number;
  radiantJusticeArmed: boolean;
  radiantCourageSwordArmed: boolean;
  radiantCourageShieldArmed: boolean;
  effulgentActiveUntil: number;
  effulgentStacks: number;
}

export interface GuardianDragonhunterState {
  tetherUntil: number;
  nextShieldOfCourageAegisAt: number;
  heavyLightReadyAt: number;
}

export interface GuardianWillbenderState {
  flameGeneration: number;
  flameVirtue: GuardianVirtue | null;
  pendingWeaponCooldownReduction: Record<string, number>;
  justiceUntil: number;
  resolveUntil: number;
  courageUntil: number;
  virtueHitCounts: Record<'justice' | 'resolve' | 'courage', number>;
  lethalTempoStacks: number;
  lethalTempoUntil: number;
  triggeredVirtueEffects: number;
}

export interface GuardianState
  extends
    GuardianCoreState,
    GuardianDragonhunterState,
    GuardianFirebrandState,
    GuardianWillbenderState,
    GuardianLuminaryState {}

export interface GuardianRuntimeState {
  core: GuardianCoreState;
  specialization:
    | { kind: 'Core'; state: Record<string, never> }
    | { kind: 'Dragonhunter'; state: GuardianDragonhunterState }
    | { kind: 'Firebrand'; state: GuardianFirebrandState }
    | { kind: 'Willbender'; state: GuardianWillbenderState }
    | { kind: 'Luminary'; state: GuardianLuminaryState };
}

export type GuardianSchedulerContext = SchedulerContext<GuardianRuntimeState> & {
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
  readonly specializations?: GuardianConfig['specializations'];
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
  readonly ownerActorType?: SimulationActorType;
  readonly hits?: number;
  readonly hitIndex?: number;
  readonly totalHits?: number;
}

export type GuardianResolverContext = Gw2ResolverRuntime & {
  config: GuardianConfig;
  profession: GuardianRuntimeState;
  readonly epsilon?: number;
};

export type GuardianVirtue = 'justice' | 'resolve' | 'courage';

export type GuardianResolverEvent = Gw2ResolverEvent & {
  readonly activeTome?: string;
  readonly ashesCharges?: number;
  readonly ashesBurnDuration?: number;
  readonly ashesNextTriggerAt?: number;
  readonly ashesExpiresAt?: number;
  readonly automatic?: boolean;
  readonly cooldownReduction?: number;
  readonly duration?: number;
  readonly burningDuration?: number;
  readonly flameGeneration?: number;
  readonly isSymbol?: boolean;
  readonly justiceActive?: boolean;
  readonly nextTomePageAt?: number;
  readonly pageCost?: number;
  readonly pagesRemaining?: number;
  readonly passiveReadyAt?: number;
  readonly radiantForge?: boolean;
  readonly radiantForgeEndsAt?: number;
  readonly radiantForgeEnteredAt?: number;
  readonly radiantWeapon?: string;
  readonly sourceSkill?: string;
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
