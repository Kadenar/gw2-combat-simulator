import type { EffectState } from '#gw2/platform/combat/effect-state.js';
import type { SimulationEvent } from '#gw2/platform/events/events.js';
import type { AmmoState, AvailabilityResult, SimulationStep } from '#gw2/platform/execution/types.js';
import type { Gw2DamageBreakdownEntry } from '#gw2/platform/resolver/hit-resolution.js';
import type {
  Gw2EnvironmentConditionBreakdownEntry,
  Gw2ProcStep,
  Gw2ResolverEvent
} from '#gw2/platform/resolver/types.js';
import type { RotationApm } from '#gw2/platform/results/rotation-apm.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import type { CanonicalCatalog } from '#gw2/platform/skills/types.js';
import type { SimulationRandom } from '#kernel/core/simulation-random.js';

/** Declare detached combat and planning observations, independently of runtime construction. */

/** Public projections read an observed state and immutable inputs, never execution controllers or future history. */
export interface Gw2PlanningStateInput<T extends object = object> {
  readonly profession: T;
  readonly time: number;
  readonly activeWeaponSet: number;
  readonly config: Gw2Config;
  readonly catalog: CanonicalCatalog;
}

export interface Gw2SimulationPlanningState {
  /** Detached owner observations at the planning boundary, including continuation after death. */
  readonly effects: readonly EffectState[];
  /** Default-command profession gates at this boundary, not predicted scheduler acceptance. */
  readonly availability: Readonly<Record<string, AvailabilityResult>>;
  /** Observed planning boundary in seconds; includes authoring continuation after target death. */
  readonly atSeconds: number;
  /** Skill-ID-keyed cooldown deadlines and remaining durations are milliseconds. */
  readonly cooldowns: Readonly<Record<string, { readyAt: number; remaining: number }>>;
  /** ID-keyed ammo avoids collisions between distinct skills sharing a display name. */
  readonly ammoBySkillId: Readonly<Record<string, Readonly<AmmoState>>>;
  readonly activeWeaponSet: number;
  readonly profession: unknown;
}

export interface Gw2SimulationResult extends Gw2ResolverResult {
  readonly rotationApm: RotationApm;
  readonly steps: readonly SimulationStep[];
  readonly planningState: Gw2SimulationPlanningState;
}

/** Numeric output deliberately omits histories and end-state projections. */
export type Gw2SimulationScore = Pick<
  Gw2ResolverResult,
  | 'rotationEndTime'
  | 'observationEndTime'
  | 'combatEndTime'
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

export interface Gw2ResolverResult {
  /** Null means chart collection was not requested, rather than an empty effect history. */
  readonly effectReport: import('#gw2/platform/results/effect-report.js').EffectReport | null;
  readonly boonGeneration: {
    readonly alliedPlayerCount: number;
    readonly boons: Readonly<
      Record<string, import('#gw2/platform/results/boon-generation.js').BoonGenerationByAudience>
    >;
  } | null;
  /** Absolute timeline boundaries in seconds, independent of the DPS start. */
  readonly rotationEndTime: number;
  readonly observationEndTime: number;
  readonly combatEndTime: number;
  readonly combatStartTime: number | null;
  readonly hasExplicitCombatStart: boolean;
  readonly dpsStartTime: number;
  readonly dpsWindow: number;
  readonly firstHitTime: number | null;
  readonly lastHitTime: number | null;
  readonly deathTime: number | null;
  readonly totalDamage: number;
  readonly dps: number;
  readonly strikeDamage: number;
  readonly conditionDamage: number;
  readonly environmentDamage: number;
  readonly environmentDps: number;
  readonly breakdown: Gw2DamageBreakdownEntry[];
  readonly conditionBreakdown: Array<{
    name: string;
    damage: number;
    dps: number;
    averageStacks: number;
  }>;
  readonly environmentConditionBreakdown: Array<{
    name: string;
    damage: number;
    dps: number;
    averageStacks: number;
    stacks: number;
    damageTicks: Gw2EnvironmentConditionBreakdownEntry['damageTicks'];
  }>;
  readonly events: readonly SimulationEvent[];
  readonly resolvedEvents: Gw2ResolverEvent[];
  readonly procSteps: Gw2ProcStep[];
  readonly warnings: string[];
  readonly casts: Array<{ name: string; count: number }>;
  readonly randomness: {
    mode: SimulationRandom['mode'];
    seed: number;
  };
}
