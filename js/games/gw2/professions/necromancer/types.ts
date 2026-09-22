import type { ProfessionUiCallbackContext, ProfessionUiContract } from '#gw2/platform/profession-presentation/types.js';
import type { NecromancerSchedulerFeedback } from '#gw2/professions/necromancer/core/mechanics/scheduler-feedback.js';
import type { CanonicalCatalog, Skill } from '#gw2/platform/engine/skills/types.js';
import type {
  CastContext,
  CastLifecycleContext,
  RechargeQueryDetails,
  SchedulerContext,
  SchedulerState
} from '#gw2/platform/execution/types.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import type { Gw2Build, Gw2BuildSpecialization, Gw2CanonicalBuild } from '#gw2/platform/builds/types.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { Gw2ResolverRuntime } from '#gw2/platform/resolver/runtime-state.js';
import type { Gw2QueryRuntime } from '#gw2/platform/combat/query/combat-query.js';
import type { NecromancerCoreState } from '#gw2/professions/necromancer/core/state.js';
import type { HarbingerState } from '#gw2/professions/necromancer/specializations/harbinger/state.js';
import type { ReaperState } from '#gw2/professions/necromancer/specializations/reaper/state.js';
import type { RitualistState } from '#gw2/professions/necromancer/specializations/ritualist/state.js';
import type { ScourgeState } from '#gw2/professions/necromancer/specializations/scourge/state.js';

// Module state is declared beside each state factory; re-export it for existing family type importers.
export interface NecromancerBuild extends Gw2Build {
  specializations?: Gw2BuildSpecialization[];
  selectedSkills?: Record<string, string>;
}

export interface NecromancerCanonicalBuild extends Gw2CanonicalBuild {
  initialResource: number;
  initialBlight: number;
  initialCascadingCorruptionStacks: number;
}

export interface NecromancerConfig extends Gw2Config {
  readonly initialBlight?: number;
  readonly initialCascadingCorruptionStacks?: number;
  readonly duration?: number;
  readonly professionAssumptions?: Readonly<Record<string, unknown>>;
  /** Feedback the scheduler records for its next refinement pass; written only by the refinement hook. */
  readonly _schedulerFeedback?: NecromancerSchedulerFeedback;
}

export interface NecromancerState
  extends NecromancerCoreState, ReaperState, ScourgeState, HarbingerState, RitualistState {}

export interface NecromancerRuntimeState {
  core: NecromancerCoreState;
  specialization:
    | { kind: 'Core'; state: Record<string, never> }
    | { kind: 'Reaper'; state: ReaperState }
    | { kind: 'Scourge'; state: ScourgeState }
    | { kind: 'Harbinger'; state: HarbingerState }
    | { kind: 'Ritualist'; state: RitualistState };
}

export interface NecromancerSkill extends Skill {
  readonly blightCost?: number;
  readonly dhuumfireDuration?: number;
  readonly flipParent?: string;
  readonly lifeForceCost?: number;
  readonly lifeForceGain?: number;
  readonly shroud?: string;
  readonly shroudEntry?: string;
  readonly shroudExit?: string;
  readonly shroudProfileId?: string;
  readonly minimumShroudLifeForcePercent?: number;
  readonly usableInShroud?: boolean;
  readonly shroudSlot?: number;
  readonly slotSelectable?: boolean;
}

/** Recharge queries Necromancer rules answer, beyond the shared query details. */
export interface NecromancerRechargeQuery extends RechargeQueryDetails {
  /** Set when a minion's death re-requests its summon recharge. */
  readonly minionDeathRecharge?: boolean;
}

export type NecromancerSchedulerContext = SchedulerContext<NecromancerRuntimeState> & {
  readonly catalog: CanonicalCatalog<NecromancerSkill>;
  readonly config: NecromancerConfig;
};

export type NecromancerCastContext = CastLifecycleContext<NecromancerRuntimeState> & {
  readonly catalog: CanonicalCatalog<NecromancerSkill>;
  readonly config: NecromancerConfig;
};

export type NecromancerEmissionContext = NecromancerSchedulerContext & {
  readonly effectiveEnd?: number;
};

export type NecromancerPrecastContext = CastContext<NecromancerRuntimeState> & {
  readonly catalog: CanonicalCatalog<NecromancerSkill>;
  readonly config: NecromancerConfig;
};

/** Shares skill-rule inputs across recharge and ammo hooks, including minion-death recharge handling. */
export type NecromancerSkillModifierContext = Omit<SchedulerContext<NecromancerRuntimeState>, 'config'> & {
  readonly config: NecromancerConfig;
  readonly skill?: NecromancerSkill;
  readonly minionDeathRecharge?: boolean;
};

export type NecromancerSimulationEvent = SimulationEvent & {
  readonly application?: NecromancerSimulationEvent;
  readonly cancelled?: boolean;
  readonly coefficient?: number;
  readonly condition?: string;
  readonly expiresAt?: number;
  readonly hitIndex?: number;
  readonly state?: Partial<NecromancerState>;
  readonly summonKind?: string;
};

export type NecromancerResolverEvent = Gw2ResolverEvent & {
  readonly application?: NecromancerResolverEvent;
  readonly state?: Partial<NecromancerState>;
  readonly summonCount?: number;
  readonly summonOwner?: string;
  readonly summonOwnerBase?: string;
  readonly summonCriticalChance?: number;
  readonly summonCriticalDamage?: number;
  readonly requiresMinion?: string;
  readonly requiresMinionIndex?: number;
  readonly requiresMinionGeneration?: number;
  readonly requiresMinionAttackGeneration?: number;
  readonly requiresSpirit?: string;
  readonly requiresSpiritGeneration?: number;
  /** Delay from a spirit's shared attack opportunity to its damage impact; zero marks the queued impact. */
  readonly spiritAttackDelay?: number;
  readonly mode?: string;
  readonly playerStacks?: number;
  readonly allyStacks?: number;
  readonly spell?: string;
  readonly procIndex?: number;
  readonly alliesReceiveFullBenefit?: boolean;
  readonly controlKind?: string;
  readonly effectiveDuration?: number;
};

export type NecromancerResolverContext = Gw2ResolverRuntime & {
  config: NecromancerConfig;
  profession: NecromancerRuntimeState;
  readonly state?: { readonly profession: NecromancerRuntimeState };
};

export type NecromancerQueryRuntime = Gw2QueryRuntime & {
  readonly profession?: NecromancerRuntimeState | Partial<NecromancerState> | null;
  readonly totals?: {
    readonly strike?: number;
    readonly condition?: number;
  };
};

export interface NecromancerPlanningStateProjectionOptions {
  readonly schedulerState: SchedulerState<NecromancerRuntimeState>;
}

export interface NecromancerUiContext extends Omit<ProfessionUiCallbackContext<Partial<NecromancerState>>, 'build'> {
  readonly config?: NecromancerConfig;
  readonly build?: NecromancerBuild | null;
  readonly state?: {
    readonly profession?: Partial<NecromancerState>;
  };
  readonly lifeForcePoolCapacity?: number;
}

/** UI slice whose callbacks read Necromancer end-state projections. */
export type NecromancerUiSlice = Partial<ProfessionUiContract<Partial<NecromancerState>>>;
