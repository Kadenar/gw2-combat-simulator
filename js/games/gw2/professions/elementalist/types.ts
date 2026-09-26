import type { Gw2Runtime } from '#gw2/platform/simulation/runtime-state.js';
/**
 * Shared Elementalist type boundary.
 *
 * Declares the build/config shapes persisted and passed into a run, the runtime state
 * union that pairs core state with exactly one specialization's state, and the
 * Elementalist-flavored context/event types every module's handlers are written against.
 */
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import type { Skill, SkillId } from '#gw2/platform/engine/skills/types.js';

import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { Gw2ResolverRuntime } from '#gw2/platform/resolver/runtime-state.js';
import type { ElementalistCanonicalBuild, ElementalistConfig } from '#gw2/professions/elementalist/build/types.js';
import type { ProfessionUiCallbackContext, ProfessionUiContract } from '#gw2/platform/profession-presentation/types.js';
import type { ElementalistAttunement, ElementalistCoreState } from '#gw2/professions/elementalist/core/state.js';
import type { TempestState } from '#gw2/professions/elementalist/specializations/tempest/state.js';
import type { WeaverState } from '#gw2/professions/elementalist/specializations/weaver/state.js';
import type { CatalystState } from '#gw2/professions/elementalist/specializations/catalyst/state.js';
import type { EvokerState } from '#gw2/professions/elementalist/specializations/evoker/state.js';

// Module state is declared beside each state factory; re-export it for existing family type importers.
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

/** Modifier context whose config is the Elementalist's, so rules can read its build selections. */
export interface ElementalistModifierContext extends Gw2ModifierContext {
  readonly config?: ElementalistConfig;
}

/** Bullet stock by element; absent elements are unstocked. */
export type ElementalistPistolBullets = Partial<Record<ElementalistAttunement, boolean>>;

/** Application UI callback context narrowed to Elementalist builds and end-state projections. */
export interface ElementalistUiContext extends Omit<
  ProfessionUiCallbackContext<Partial<ElementalistState>>,
  'build' | 'config'
> {
  /** Shared callbacks accept a broad profession identity and sparse previews, while persisted builds stay strict. */
  readonly build?:
    | (Partial<Omit<ElementalistCanonicalBuild, 'profession' | 'pistolBullets'>> & {
        profession?: string;
        pistolBullets?: ElementalistPistolBullets;
      })
    | null;
  readonly config?: ElementalistConfig;
  /** Live scheduler state when a palette is inspected mid-rotation. */
  readonly state?: { readonly profession?: Partial<ElementalistState> };
}

/** UI slice whose callbacks read Elementalist end-state projections. */
export type ElementalistUiSlice = Partial<ProfessionUiContract<Partial<ElementalistState>>>;

/** A catalog skill carrying the Elementalist-specific identity fields the modules read. */
export interface ElementalistSkill extends Skill {
  readonly elementalistTasks?: readonly import('#gw2/platform/engine/skills/types.js').SkillTask[];
  readonly attunement?: string;
  readonly aura?: string;
  readonly chainRoot?: SkillId;
  readonly overload?: boolean;
  readonly skillFamily?: string;
}

/** One actual gameplay context, shared by Core and the active elite. */
export type ElementalistRuntime = Gw2Runtime<ElementalistRuntimeState> & { config: ElementalistConfig };

/** Scheduled event enriched with the aura and combo-field metadata Elementalist emits. */
export type ElementalistSimulationEvent = SimulationEvent & {
  readonly application?: ElementalistSimulationEvent;
  readonly aura?: string;
  readonly coefficient?: number;
  readonly condition?: string;
  readonly fieldType?: string;
};

/** The resolver-phase counterpart of ElementalistSimulationEvent, seen when damage is computed. */
export type ElementalistResolverEvent = Gw2ResolverEvent & {
  readonly application?: Gw2ResolverEvent;
  readonly aura?: string;
  readonly fieldType?: string;
};

/** Resolver-phase runtime narrowed to Elementalist config and profession state. */
export type ElementalistResolverContext = Gw2ResolverRuntime & {
  config: ElementalistConfig;
  profession: ElementalistRuntimeState;
};
