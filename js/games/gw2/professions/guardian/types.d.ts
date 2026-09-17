import type { CanonicalCatalog, Skill, SkillId } from '#gw2/platform/engine/skills/types.js';
import type {
  CastContext,
  CastLifecycleContext,
  SchedulerContext,
  SchedulerRecord,
  SchedulerState
} from '#gw2/platform/engine/execution/types.js';
import type { SimulationActorType } from '#gw2/platform/engine/events/events.js';
import type { Gw2ApplicationBuild, Gw2Build, Gw2CanonicalBuild } from '#gw2/platform/builds/types.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { Gw2ResolverRuntime } from '#gw2/platform/resolver/runtime-state.js';
import type { ProfessionTraitSelection } from '#gw2/professions/shared/trait-data.js';
import type { GuardianCorePublicState, GuardianCoreState } from '#gw2/professions/guardian/core/state.js';
import type { GuardianDragonhunterState } from '#gw2/professions/guardian/specializations/dragonhunter/state.js';
import type { GuardianFirebrandState } from '#gw2/professions/guardian/specializations/firebrand/state.js';
import type { GuardianLuminaryState } from '#gw2/professions/guardian/specializations/luminary/state.js';
import type { GuardianWillbenderState } from '#gw2/professions/guardian/specializations/willbender/state.js';

// Module state is declared beside each state factory; re-export it for existing family type importers.
export type {
  GuardianCorePublicState,
  GuardianCoreState,
  GuardianDragonhunterState,
  GuardianFirebrandState,
  GuardianLuminaryState,
  GuardianWillbenderState
};

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

export interface GuardianConfig extends Gw2Config {
  readonly selectedTraitIds?: readonly (string | number)[];
  readonly maximumTomePages?: number;
  readonly initialTomePages?: number;
  readonly initialEndurance?: number;
  readonly specialization?: string;
  readonly specializations?: readonly (string | { readonly name?: string })[];
}

export interface GuardianState
  extends
    GuardianCorePublicState,
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
