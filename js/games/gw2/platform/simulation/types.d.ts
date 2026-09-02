/** Owns the simulation/types.d.ts contracts so type dependencies follow their runtime feature boundaries. */
import type {
  NormalizedProfessionContract,
  ObservationPolicy,
  ProfessionApplicationContract,
  ProfessionSource,
  SchedulerContext,
  SchedulerRecord,
  SchedulerState,
  SchedulerStep
} from '#gw2/platform/engine/types.js';
import type {
  Gw2ResolverEventHandlers,
  Gw2ResolverReactions,
  Gw2ResolverResult
} from '#gw2/platform/resolver/types.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';

export interface Gw2ProfessionContract<
  TProfessionState extends object = SchedulerRecord
> extends NormalizedProfessionContract<TProfessionState, Gw2ResolverEventHandlers, Gw2ResolverReactions> {
  readonly simulation:
    | (SchedulerRecord & {
        readonly refineSchedulerConfig?: (
          config: Gw2Config,
          result: Gw2SimulationResult
        ) => Gw2Config | null | undefined;
        readonly projectEndState?: (options: {
          readonly config: Gw2Config;
          readonly schedulerContext: SchedulerContext;
          readonly schedulerState: SchedulerState;
          readonly resolverState: object;
          readonly cooldowns: Gw2SimulationEndState['cooldowns'];
          readonly ammo: Gw2SimulationEndState['ammo'];
          readonly profession: unknown;
        }) =>
          | {
              readonly cooldowns?: Gw2SimulationEndState['cooldowns'];
              readonly ammo?: Gw2SimulationEndState['ammo'];
              readonly profession?: unknown;
            }
          | null
          | undefined;
      })
    | null;
  readonly projectEndState: (options: {
    readonly config: Gw2Config;
    readonly schedulerContext: SchedulerContext;
    readonly schedulerState: SchedulerState;
    readonly resolverState: object;
  }) => unknown;
}

/** Joins the application surface to a runtime source whose GW2 resolver callbacks remain type checked. */
export type Gw2ProfessionSource<TProfessionState extends object = any> = ProfessionApplicationContract &
  ProfessionSource<TProfessionState, Gw2ProfessionContract<TProfessionState>>;

export interface Gw2SimulationEndState {
  readonly time: number;
  readonly cooldowns: Readonly<Record<string, { readyAt: number; remaining: number }>>;
  readonly ammo: Readonly<Record<string, unknown>>;
  /** ID-keyed ammo avoids collisions between distinct skills sharing a display name. */
  readonly ammoBySkillId: Readonly<Record<string, unknown>>;
  readonly activeWeaponSet: number;
  readonly profession: unknown;
}

export interface Gw2SimulationResult extends Gw2ResolverResult {
  readonly steps: readonly SchedulerStep[];
  readonly endState: Gw2SimulationEndState;
  readonly schedulerState: SchedulerState;
  readonly snapshot: unknown;
  readonly warnings: string[];
}

export interface Gw2DeclarativeSimulationOptions {
  readonly profession: Gw2ProfessionSource;
  readonly rotation: readonly unknown[];
  readonly config?: Gw2Config;
  readonly observationPolicy?: ObservationPolicy;
}
