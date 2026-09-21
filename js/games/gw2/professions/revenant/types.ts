import type { ProfessionUiCallbackContext, ProfessionUiContract } from '#gw2/platform/profession-presentation/types.js';
import type { CanonicalCatalog, Skill, SkillId } from '#gw2/platform/engine/skills/types.js';
import type {
  CastContext,
  CastLifecycleContext,
  ScheduledTask,
  SchedulerContext
} from '#gw2/platform/execution/types.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import type {
  Gw2ApplicationBuild,
  Gw2Build,
  Gw2CanonicalBuild,
  ProfessionBuildAssumptions
} from '#gw2/platform/builds/types.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { Gw2ResolverRuntime } from '#gw2/platform/resolver/runtime-state.js';
import type { ProfessionTraitSelection } from '#gw2/professions/shared/trait-data.js';
import type { RevenantCoreState } from '#gw2/professions/revenant/core/state.js';
import type { ConduitState } from '#gw2/professions/revenant/specializations/conduit/state.js';
import type { HeraldState } from '#gw2/professions/revenant/specializations/herald/state.js';
import type { RenegadeState } from '#gw2/professions/revenant/specializations/renegade/state.js';
import type { VindicatorState } from '#gw2/professions/revenant/specializations/vindicator/state.js';

// Module state is declared beside each state factory; re-export it for existing family type importers.
export interface RevenantSkill extends Skill {
  readonly affinityOnHit?: boolean;
  readonly consume?: boolean;
  readonly duration?: number;
  readonly displayName?: string;
  readonly energyCost?: number;
  readonly facet?: boolean;
  readonly legendId?: string;
  readonly manualReleaseCooldown?: number;
  readonly paletteLegendId?: string;
  readonly starvationCooldown?: number;
  readonly triggerIntervalMs?: number;
  readonly upkeepCost?: number;
  readonly upkeepConsumeByLegendId?: Readonly<Record<string, SkillId>>;
  readonly upkeepConsumeId?: SkillId;
  readonly upkeepPulse?: {
    readonly kind: string;
    readonly duration: number;
    readonly stacks: number;
  };
  readonly pulseInterval?: number;
}

export interface RevenantBuild extends Gw2Build {
  assumptions?: ProfessionBuildAssumptions;
  specializations?: ProfessionTraitSelection[];
  selectedLegends?: string[];
  startingLegend?: string;
  initialEnergy?: number;
}

export interface RevenantCanonicalBuild extends Gw2CanonicalBuild {
  selectedLegends: string[];
  startingLegend: string;
  initialEnergy: number;
}

export interface RevenantApplicationBuild extends Gw2ApplicationBuild {
  initialEnergy: number;
  selectedLegends: string[];
  startingLegend: string;
}

export interface RevenantConfig extends Gw2Config {
  readonly specialization?: string;
  readonly selectedLegends?: readonly string[];
  readonly startingLegend?: string;
  readonly initialEnergy?: number;
  readonly selfConditionCount?: number;
}

export interface RevenantTimedStack {
  at: number;
  expiresAt: number;
}

export interface RevenantState extends RevenantCoreState, HeraldState, RenegadeState, VindicatorState, ConduitState {}

export interface RevenantRuntimeState {
  core: RevenantCoreState;
  specialization:
    | { kind: 'Core'; state: Record<string, never> }
    | { kind: 'Herald'; state: HeraldState }
    | { kind: 'Renegade'; state: RenegadeState }
    | { kind: 'Vindicator'; state: VindicatorState }
    | { kind: 'Conduit'; state: ConduitState };
}

export type RevenantSchedulerContext = SchedulerContext<RevenantRuntimeState> & {
  readonly catalog: CanonicalCatalog<RevenantSkill>;
  readonly config: RevenantConfig;
  readonly schedulerPolicy: SchedulerContext<RevenantRuntimeState>['schedulerPolicy'] & {
    readonly combatBeganAt?: () => number | null;
    readonly critical?: (context: RevenantSchedulerContext, event: SimulationEvent) => { readonly chance?: number };
    readonly isCombatActive?: () => boolean;
    readonly requireCriticalFacts?: () => void;
  };
};

export type RevenantCastContext = CastLifecycleContext<RevenantRuntimeState> & {
  readonly catalog: CanonicalCatalog<RevenantSkill>;
  readonly config: RevenantConfig;
  readonly skill: RevenantSkill;
};

export type RevenantPrecastContext = CastContext<RevenantRuntimeState> & {
  readonly catalog: CanonicalCatalog<RevenantSkill>;
  readonly config: RevenantConfig;
  readonly skill: RevenantSkill;
};

export type RevenantRechargeContext = RevenantSchedulerContext & {
  readonly skill?: RevenantSkill;
  readonly at: number;
  readonly start?: number;
  readonly hasBuff?: (kind: string, at?: number) => boolean;
};

/** Explicit cost inputs shared by simulation and palette calculations. */
export interface RevenantEnergyCostInput {
  readonly specialization: string;
  readonly state: Readonly<
    Partial<Pick<RevenantState, 'activeUpkeeps' | 'beguilingHazeCharges' | 'energyCostOverrides'>>
  >;
  readonly traits: ReadonlySet<SkillId>;
}

export type RevenantScheduledTask<TPayload extends object = object> = ScheduledTask<TPayload>;

export type RevenantSimulationEvent = SimulationEvent & {
  readonly eventOrder?: number;
  readonly weaponSet?: number;
};

export type RevenantResolverEvent = Gw2ResolverEvent & {
  readonly lifeSiphon?: boolean;
  readonly state?: Partial<RevenantState>;
};

export type RevenantResolverContext = Gw2ResolverRuntime & {
  config: RevenantConfig;
  profession: RevenantRuntimeState;
};

export interface RevenantUiContext extends Omit<
  ProfessionUiCallbackContext<Partial<RevenantState>>,
  'build' | 'cooldowns' | 'entry' | 'rotation'
> {
  readonly config?: RevenantConfig;
  readonly build?: RevenantBuild | null;
  readonly state?: {
    readonly profession?: Partial<RevenantState>;
  };
  readonly initialEnergy?: number;
  readonly cooldowns?: Readonly<Record<string, { readonly remaining?: number }>>;
  readonly entry?: unknown;
  readonly rotation?: readonly unknown[];
}

/** UI slice whose callbacks read Revenant end-state projections. */
export type RevenantUiSlice = Partial<ProfessionUiContract<Partial<RevenantState>>>;
