import type { ProfessionUiCallbackContext, ProfessionUiContract } from '#gw2/platform/profession-presentation/types.js';
import type { CanonicalCatalog, Skill } from '#gw2/platform/engine/skills/types.js';
import type { CastLifecycleContext, SchedulerContext, SchedulerState } from '#gw2/platform/execution/types.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import type { Gw2Build, Gw2BuildSpecialization, Gw2CanonicalBuild } from '#gw2/platform/builds/types.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { Gw2ResolverRuntime } from '#gw2/platform/resolver/runtime-state.js';
import type { Gw2SchedulerPolicy } from '#gw2/platform/execution/gw2-policy/types.js';
import type { WarriorCoreState } from '#gw2/professions/warrior/core/state.js';
import type { BerserkerState } from '#gw2/professions/warrior/specializations/berserker/state.js';
import type { SpellbreakerState } from '#gw2/professions/warrior/specializations/spellbreaker/state.js';
import type { BladeswornState } from '#gw2/professions/warrior/specializations/bladesworn/state.js';
import type { ParagonState } from '#gw2/professions/warrior/specializations/paragon/state.js';

// Module state is declared beside each state factory; re-export it for existing family type importers.
export interface WarriorBuild extends Gw2Build {
  specializations?: Gw2BuildSpecialization[];
  selectedSkills?: Record<string, string>;
}

export interface WarriorCanonicalBuild extends Gw2CanonicalBuild {
  initialResource: number;
}

export interface WarriorState
  extends WarriorCoreState, BerserkerState, SpellbreakerState, BladeswornState, ParagonState {
  /** User-friendly refrain name derived from activeRefrainId for display. */
  activeRefrain: string;
}

export interface WarriorRuntimeState {
  core: WarriorCoreState;
  specialization:
    | { kind: 'Core'; state: Record<string, never> }
    | { kind: 'Berserker'; state: BerserkerState }
    | { kind: 'Spellbreaker'; state: SpellbreakerState }
    | { kind: 'Bladesworn'; state: BladeswornState }
    | { kind: 'Paragon'; state: ParagonState };
}

export interface WarriorSkill extends Skill {
  /**
   * Measured cast duration (ms) while Dual Wielding and Quickness are active.
   * Only skills with this value receive a Dual Wielding cast-time adjustment.
   */
  readonly dualWieldCastTimeMs?: number;
  readonly adrenalineCost?: number;
  readonly adrenalineGain?: number;
  readonly flowGain?: number;
  readonly burst?: boolean;
  readonly burstTier?: number;
  readonly primalBurst?: boolean;
  readonly gunsaberSkill?: boolean;
  readonly dragonTriggerSkill?: boolean;
  readonly shadowstepSkill?: boolean;
  readonly movementSkill?: boolean;
  readonly dragonSlash?: boolean;
  readonly dragonSlashMinimumCoefficient?: number;
  readonly dragonSlashMaximumCoefficient?: number;
  readonly dragonSlashMinimumBurningDuration?: number;
  readonly dragonSlashMaximumBurningDuration?: number;
}

export type WarriorSchedulerContext = SchedulerContext<WarriorRuntimeState> & {
  readonly catalog: CanonicalCatalog<WarriorSkill>;
  readonly config: Gw2Config;
  /** Lets trait initialization request GW2 critical facts when the policy provides them. */
  readonly schedulerPolicy: Partial<Pick<Gw2SchedulerPolicy, 'requireCriticalFacts'>>;
};

export type WarriorCastContext = CastLifecycleContext<WarriorRuntimeState> & {
  readonly catalog: CanonicalCatalog<WarriorSkill>;
  readonly config: Gw2Config;
  /** Exposes observed combat start so in-combat-only traits can gate runs without an explicit marker. */
  readonly schedulerPolicy: Partial<Pick<Gw2SchedulerPolicy, 'combatBeganAt'>>;
};

export type WarriorSimulationEvent = SimulationEvent & {
  readonly coefficient?: number;
  readonly condition?: string;
  readonly state?: Partial<WarriorState>;
};

export type WarriorResolverEvent = Gw2ResolverEvent & {
  readonly state?: Partial<WarriorState>;
};

export type WarriorResolverContext = Gw2ResolverRuntime & {
  profession: WarriorRuntimeState;
};

export interface WarriorPlanningStateProjectionOptions {
  readonly schedulerContext: WarriorSchedulerContext;
  readonly schedulerState: SchedulerState<WarriorRuntimeState>;
}

export interface WarriorUiContext extends Omit<
  ProfessionUiCallbackContext<WarriorRuntimeState | Partial<WarriorState>>,
  'build'
> {
  readonly config?: Gw2Config;
  readonly build?: WarriorBuild | null;
  readonly state?: {
    readonly profession?: WarriorRuntimeState | Partial<WarriorState>;
  };
}

/** UI slice whose callbacks read Warrior end-state projections. */
export type WarriorUiSlice = Partial<ProfessionUiContract<WarriorRuntimeState | Partial<WarriorState>>>;
