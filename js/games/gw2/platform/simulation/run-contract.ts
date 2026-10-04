import type { SimulationEventBase } from '#gw2/platform/events/events.js';
import type { RuntimeDriver } from '#gw2/platform/execution/driver-contract.js';
import type { RuntimeProfession } from '#gw2/platform/profession-definition/runtime-contract.js';
import type { Gw2ResolverEvent, Gw2ResolverReactionContributions } from '#gw2/platform/resolver/types.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import type { Gw2SimulationOptions } from '#gw2/platform/simulation/options.js';
import type { Gw2Runtime } from '#gw2/platform/simulation/runtime-state.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import type { ObservationPolicy } from '#kernel/execution/observation.js';

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
