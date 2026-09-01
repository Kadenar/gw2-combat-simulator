/**
 * Shared Elementalist type boundary.
 *
 * Declares the build/config shapes persisted and passed into a run, the runtime state
 * union that pairs core state with exactly one specialization's state, and the
 * Elementalist-flavored context/event types every module's handlers are written against.
 */
import type {
  CanonicalCatalog,
  CastContext,
  CastLifecycleContext,
  SchedulerContext,
  SchedulerRecord,
  SchedulerState,
  SimulationEvent,
  Skill,
  SkillId
} from '#gw2/platform/engine/types.js';
import type { Gw2ResolverEvent, Gw2ResolverRuntime } from '#gw2/platform/resolver/types.js';
import type { ElementalistConfig } from '#gw2/content/professions/elementalist/build/types.js';
import type { ElementalistCoreState } from '#gw2/content/professions/elementalist/core/state.js';
import type { TempestState } from '#gw2/content/professions/elementalist/specializations/tempest/state.js';
import type { WeaverState } from '#gw2/content/professions/elementalist/specializations/weaver/state.js';
import type { CatalystState } from '#gw2/content/professions/elementalist/specializations/catalyst/state.js';
import type { EvokerState } from '#gw2/content/professions/elementalist/specializations/evoker/state.js';

/**
 * Live profession state during a run: always the core attunement/weapon state, plus the
 * state of whichever single elite specialization is equipped (none, for a Core build).
 */
export interface ElementalistRuntimeState {
  core: ElementalistCoreState;
  specialization:
    | { kind: 'Core'; state: Record<string, never> }
    | { kind: 'Tempest'; state: TempestState }
    | { kind: 'Weaver'; state: WeaverState }
    | { kind: 'Catalyst'; state: CatalystState }
    | { kind: 'Evoker'; state: EvokerState };
}

/** Flattened view of core and specialization state, used for snapshots and end-state projection. */
export interface ElementalistState extends ElementalistCoreState, WeaverState, CatalystState, EvokerState {}

/** A catalog skill carrying the Elementalist-specific identity fields the modules read. */
export interface ElementalistSkill extends Skill {
  readonly attunement?: string;
  readonly aura?: string;
  readonly chainRoot?: SkillId;
  readonly overload?: boolean;
  readonly skillFamily?: string;
  readonly skillWeapon?: string;
}

/** Scheduler-phase context narrowed to the Elementalist catalog, config, and runtime state. */
export type ElementalistSchedulerContext = SchedulerContext<ElementalistRuntimeState> &
  SchedulerRecord & {
    readonly catalog: CanonicalCatalog<ElementalistSkill>;
    readonly config: ElementalistConfig;
  };

/** Context for availability checks made before a cast is allowed to start. */
export type ElementalistPrecastContext = CastContext<ElementalistRuntimeState> & {
  readonly catalog: CanonicalCatalog<ElementalistSkill>;
  readonly config: ElementalistConfig;
  readonly skill: ElementalistSkill;
};

/** Context for the cast lifecycle hooks that mutate state as a skill starts and finishes. */
export type ElementalistCastContext = CastLifecycleContext<ElementalistRuntimeState> & {
  readonly catalog: CanonicalCatalog<ElementalistSkill>;
  readonly config: ElementalistConfig;
  readonly skill: ElementalistSkill;
};

/** Scheduled event enriched with the attunement, aura, and combo-field metadata Elementalist emits. */
export type ElementalistSimulationEvent = SimulationEvent & {
  readonly application?: ElementalistSimulationEvent;
  readonly aura?: string;
  readonly coefficient?: number;
  readonly condition?: string;
  readonly elementalistAttunement?: string;
  readonly fieldType?: string;
  readonly sourceSkill?: string;
};

/** The resolver-phase counterpart of ElementalistSimulationEvent, seen when damage is computed. */
export type ElementalistResolverEvent = Gw2ResolverEvent & {
  readonly application?: Gw2ResolverEvent;
  readonly aura?: string;
  readonly coefficient?: number;
  readonly condition?: string;
  readonly elementalistAttunement?: string;
  readonly fieldType?: string;
  readonly sourceSkill?: string;
};

/** Resolver-phase runtime narrowed to Elementalist config and profession state. */
export type ElementalistResolverContext = Gw2ResolverRuntime & {
  config: ElementalistConfig;
  profession: ElementalistRuntimeState;
  readonly state?: { readonly profession: ElementalistRuntimeState };
};

/** Input to the family end-state projection: the scheduler state at the end of a run. */
export interface ElementalistEndStateProjectionOptions {
  readonly schedulerState: SchedulerState<ElementalistRuntimeState>;
}
