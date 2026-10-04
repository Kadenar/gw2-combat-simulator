import type { SimulationEventBase } from '#gw2/platform/engine/events/events.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import type { CastCommand, AvailabilityResult } from '#gw2/platform/execution/types.js';
import type { RotationCursor } from '#gw2/platform/execution/rotation-cursor.js';
import type { Gw2ResolverEvent, Gw2ResolverReactionContributions } from '#gw2/platform/resolver/types.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import type { Gw2Runtime, RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';
import type { Gw2SimulationOptions } from '#gw2/platform/simulation/types.js';
import type { ObservationPolicy } from '#kernel/execution/observation.js';

/** Drivers select work; the shared runtime retains the clock, reservations, and event ordering. */
export interface RuntimeDriverContext<T extends object> {
  readonly runtime: Gw2Runtime<T>;
  readonly evaluateReadiness: (skill: Skill, command: CastCommand) => AvailabilityResult;
  readonly resetCooldowns: () => void;
  readonly advanceFrontier: (reason: string) => void;
  readonly acceptCast: (skill: Skill, command: CastCommand) => void;
  readonly reject: (reason: string) => void;
}

export interface RuntimeDriver<T extends object> {
  readonly cursor: RotationCursor;
  readonly rotation: readonly unknown[];
  /** Return handled after consuming work, otherwise the next command boundary or Infinity. */
  advance(context: RuntimeDriverContext<T>): number | 'handled';
}

/** Setup selects participating producers once, without exposing an execution mode to live mechanics. */
export interface RuntimeExecution<T extends object> {
  readonly driver: RuntimeDriver<T>;
  readonly acceptsEffect: (event: SimulationEventBase) => boolean;
  readonly professionReactions: RuntimeProfession<T>['reactions'];
  readonly contributions: (runtime: () => Gw2Runtime<T>) => Gw2ResolverReactionContributions;
  readonly initialize?: (runtime: Gw2Runtime<T>) => void;
  readonly spendCost?: (runtime: Gw2Runtime<T>, skill: Skill) => void;
  readonly combatStart?: (runtime: Gw2Runtime<T>) => void;
  readonly castCompleted?: (runtime: Gw2Runtime<T>, event: Gw2ResolverEvent) => void;
  readonly action?: (runtime: Gw2Runtime<T>, event: Gw2ResolverEvent) => void;
  readonly condition?: (runtime: Gw2Runtime<T>, event: Gw2ResolverEvent) => void;
  readonly weaponSwap?: (runtime: Gw2Runtime<T>, event: Gw2ResolverEvent) => void;
  readonly report?: (runtime: Gw2Runtime<T>, combatEndTime: number) => void;
}

export interface RuntimeOptions<T extends object> {
  readonly profession: RuntimeProfession<T>;
  readonly config?: Gw2Config;
  readonly observation?: ObservationPolicy;
  readonly combatStartTime?: number;
  readonly output?: 'detailed' | 'score';
  readonly collectChartData?: boolean;
  readonly damageDiagnostics?: boolean;
  readonly onPhase?: Gw2SimulationOptions['onPhase'];
}

/** One finite occurrence collects resolver facts without combat reports or planning projections. */
export interface DamageRuntimeOptions<T extends object> extends Omit<RuntimeOptions<T>, 'output' | 'observation'> {
  readonly output: 'damage';
  readonly ownsEffect: (event: SimulationEventBase) => boolean;
}

export interface DamageRuntimeResult {
  readonly events: readonly Gw2ResolverEvent[];
  readonly castSeconds: number;
  readonly complete: boolean;
}
