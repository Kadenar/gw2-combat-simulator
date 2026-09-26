import type { CriticalSigilDiagnostic } from '#gw2/platform/equipment/sigils/diagnostics.js';
/** Owns the simulation/types.ts contracts so type dependencies follow their runtime feature boundaries. */
import type {
  NormalizedProfessionContract,
  ProfessionApplicationContract,
  ProfessionSource
} from '#gw2/platform/engine/profession/types.js';
import type { SimulationStep } from '#gw2/platform/execution/types.js';
import type { RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';
import type { CanonicalCatalog } from '#gw2/platform/engine/skills/types.js';
import type { ObservationPolicy } from '#kernel/execution/observation.js';
import type { Gw2ResolverResult } from '#gw2/platform/resolver/types.js';
import type { Gw2Build } from '#gw2/platform/builds/types.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import type { RotationApm } from '#gw2/platform/results/rotation-apm.js';

/** Public projections read an observed state and immutable inputs, never execution controllers or future history. */
export interface Gw2PlanningStateInput<T extends object = object> {
  readonly profession: T;
  readonly time: number;
  readonly activeWeaponSet: number;
  readonly config: Gw2Config;
  readonly catalog: CanonicalCatalog;
}

export interface Gw2ProfessionContract<
  TProfessionState extends object = object
> extends NormalizedProfessionContract<TProfessionState> {
  readonly projectPlanningState: (input: Gw2PlanningStateInput<TProfessionState>) => unknown;
}

/** Joins the application surface to a runtime source whose GW2 resolver callbacks remain type checked. */
export type Gw2ProfessionSource<TProfessionState extends object = any> = ProfessionApplicationContract<Gw2Build> &
  ProfessionSource<TProfessionState, Gw2ProfessionContract<TProfessionState>, Gw2Build> & {
    runtimeFor(config: Gw2Config): RuntimeProfession<TProfessionState>;
  };

export interface Gw2SimulationPlanningState {
  /** Observed planning boundary in seconds; includes authoring continuation after target death. */
  readonly atSeconds: number;
  /** Public cooldown deadlines and remaining durations are milliseconds. */
  readonly cooldowns: Readonly<Record<string, { readyAt: number; remaining: number }>>;
  /** Name-keyed observed ammo; absent entries do not imply full charges. Prefer ammoBySkillId for identity. */
  readonly ammo: Readonly<Record<string, unknown>>;
  /** ID-keyed ammo avoids collisions between distinct skills sharing a display name. */
  readonly ammoBySkillId: Readonly<Record<string, unknown>>;
  readonly activeWeaponSet: number;
  readonly profession: unknown;
}

export interface Gw2SimulationResult extends Gw2ResolverResult {
  /** Actual sigil decisions are retained only in detailed diagnostic runs. */
  readonly criticalSigilDiagnostics?: readonly CriticalSigilDiagnostic[];
  readonly rotationApm: RotationApm;
  readonly steps: readonly SimulationStep[];
  readonly planningState: Gw2SimulationPlanningState;
}

export interface Gw2SimulationOptions {
  /** Capture formula facts during detailed execution; never persisted as build configuration. */
  readonly damageDiagnostics?: boolean;
  /** Optional profiler receives phase durations; normal simulations avoid clock reads. */
  readonly onPhase?: (phase: 'preparation' | 'execution' | 'reporting', durationMs: number) => void;
  readonly profession: Gw2ProfessionSource;
  readonly rotation: readonly unknown[];
  readonly config?: Gw2Config;
  readonly observationPolicy?: ObservationPolicy;
  /** Preserve the full rotation's explicit boundary when simulating a prefix without its marker. */
  readonly combatStartTime?: number;
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
