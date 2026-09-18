/** Owns the simulation/types.ts contracts so type dependencies follow their runtime feature boundaries. */
import type {
  NormalizedProfessionContract,
  ProfessionSimulationDefinition,
  ProfessionApplicationContract,
  ProfessionSource
} from '#gw2/platform/engine/profession/types.js';
import type { SchedulerContext, SchedulerState, SchedulerStep } from '#gw2/platform/engine/execution/types.js';
import type { ObservationPolicy } from '#kernel/execution/observation.js';
import type {
  Gw2ResolverEventHandlers,
  Gw2ResolverReactions,
  Gw2ResolverResult
} from '#gw2/platform/resolver/types.js';
import type { Gw2Build } from '#gw2/platform/builds/types.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import type { RotationApm } from '#gw2/platform/results/rotation-apm.js';

/** GW2 simulation policy: one optional refinement pass over the scheduler config. */
export interface Gw2SimulationDefinition extends ProfessionSimulationDefinition {
  readonly refineSchedulerConfig?: (config: Gw2Config, result: Gw2SimulationResult) => Gw2Config | null | undefined;
}

export interface Gw2ProfessionContract<
  TProfessionState extends object = object,
  TBuild extends Gw2Build = Gw2Build
> extends NormalizedProfessionContract<TProfessionState, Gw2ResolverEventHandlers, Gw2ResolverReactions, TBuild> {
  readonly simulation: Gw2SimulationDefinition | null;
  readonly projectEndState: (options: {
    readonly config: Gw2Config;
    readonly schedulerContext: SchedulerContext;
    readonly schedulerState: SchedulerState;
    readonly resolverState: object;
  }) => unknown;
}

/** Joins the application surface to a runtime source whose GW2 resolver callbacks remain type checked. */
export type Gw2ProfessionSource<TProfessionState extends object = any> = ProfessionApplicationContract<
  Gw2SimulationDefinition,
  Gw2Build
> &
  ProfessionSource<TProfessionState, Gw2ProfessionContract<TProfessionState>, Gw2SimulationDefinition, Gw2Build>;

export interface Gw2SimulationEndState {
  /** Resolution-end clock in milliseconds, including any observation tail. */
  readonly time: number;
  readonly cooldowns: Readonly<Record<string, { readyAt: number; remaining: number }>>;
  /** Name-keyed live scheduler ammo; absent entries do not imply full charges. Prefer ammoBySkillId for identity. */
  readonly ammo: Readonly<Record<string, unknown>>;
  /** ID-keyed ammo avoids collisions between distinct skills sharing a display name. */
  readonly ammoBySkillId: Readonly<Record<string, unknown>>;
  readonly activeWeaponSet: number;
  readonly profession: unknown;
}

export interface Gw2SimulationResult extends Gw2ResolverResult {
  readonly rotationApm: RotationApm;
  readonly steps: readonly SchedulerStep[];
  readonly endState: Gw2SimulationEndState;
  readonly schedulerState: SchedulerState;
  readonly snapshot: unknown;
  readonly warnings: string[];
}

export interface Gw2DeclarativeSimulationOptions {
  /** Capture formula facts only in the final detailed pass; never persisted as build configuration. */
  readonly damageDiagnostics?: boolean;
  /** Optional profiler receives phase durations; normal simulations avoid clock reads. */
  readonly onPhase?: (phase: 'scheduling' | 'resolution' | 'reporting' | 'refinement', durationMs: number) => void;
  readonly profession: Gw2ProfessionSource;
  readonly rotation: readonly unknown[];
  readonly config?: Gw2Config;
  readonly observationPolicy?: ObservationPolicy;
}

/** Numeric output deliberately omits histories and end-state projections. */
export type Gw2SimulationScore = Pick<
  Gw2ResolverResult,
  | 'duration'
  | 'combatStartTime'
  | 'hasExplicitCombatStart'
  | 'dpsStartTime'
  | 'dpsWindow'
  | 'firstHitTime'
  | 'lastHitTime'
  | 'deathTime'
  | 'totalDamage'
  | 'dps'
  | 'strikeDamage'
  | 'conditionDamage'
  | 'environmentDamage'
  | 'environmentDps'
  | 'warnings'
> & { readonly output: 'score' };
