import type { ProfessionUiCallbackContext, ProfessionUiContract } from '#gw2/platform/engine/profession/types.js';
import type { CanonicalCatalog, Skill, SkillId } from '#gw2/platform/engine/skills/types.js';
import type {
  CastContext,
  CastLifecycleContext,
  SchedulerContext,
  SchedulerState
} from '#gw2/platform/engine/execution/types.js';
import type { EffectMetadata, SimulationActorType } from '#gw2/platform/engine/events/events.js';
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
export interface GuardianBuild extends Gw2Build {
  specializations?: ProfessionTraitSelection[];
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

export interface GuardianAvailabilityContext {
  readonly config?: GuardianConfig;
  readonly catalog?: CanonicalCatalog;
  readonly specialization?: string;
  readonly specializations?: GuardianConfig['specializations'];
}

/** Fields emitted by Guardian mechanics and read by its resolver and presentation. */
export interface GuardianEventExtra {
  readonly virtue?: GuardianVirtue;
  readonly passiveReadyAt?: number;
  readonly priority?: number;
  readonly tetherUntil?: number;
  readonly applicationIndex?: number;
  readonly totalApplications?: number;
  readonly weaponSet?: number;
  readonly mechanicSwap?: boolean;
  readonly weaponLine?: string | null;
  readonly activeTome?: string;
  readonly tome?: string;
  readonly pageCost?: number;
  readonly pagesRemaining?: number;
  readonly nextTomePageAt?: number;
  readonly ashesCharges?: number;
  readonly ashesBurnDuration?: number;
  readonly ashesNextTriggerAt?: number;
  readonly ashesExpiresAt?: number;
  readonly radiantForge?: boolean;
  readonly radiantForgeEndsAt?: number;
  readonly radiantForgeEnteredAt?: number;
  readonly radiantWeapon?: string;
  readonly duration?: number;
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

export interface GuardianStrikeFields {
  readonly skillWeapon?: string;
  readonly isSymbol?: boolean;
  readonly triggeredBy?: string;
  readonly activationId?: string;
  readonly comboFields?: readonly { readonly ownerId: string; readonly fieldType: string; readonly duration: number }[];
  readonly metadata?: EffectMetadata;
  readonly priority?: number;
  readonly offTarget?: boolean;
  readonly weaponStrengthProfileId?: string;
  readonly stackCount?: number;
  readonly willbenderFlames?: boolean;
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
};

export type GuardianVirtue = 'justice' | 'resolve' | 'courage';

export type GuardianResolverEvent = Gw2ResolverEvent & {
  // Derived tether conditions retain the application identity of their custom pulse event.
  readonly applicationIndex?: number;
  readonly totalApplications?: number;
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

export interface GuardianUiContext extends ProfessionUiCallbackContext<Partial<GuardianState>> {
  readonly config?: GuardianConfig;
  readonly state?: {
    readonly profession?: Partial<GuardianState>;
  };
}

/** UI slice whose callbacks read Guardian end-state projections. */
export type GuardianUiSlice = Partial<ProfessionUiContract<Partial<GuardianState>>>;
