import type { EffectState } from '#gw2/platform/combat/effect-state.js';
/** Owns the simulation/types.ts contracts so type dependencies follow their runtime feature boundaries. */
import type { NormalizedProfessionContract, ProfessionFamilyContract } from '#gw2/platform/engine/profession/types.js';
import type { AmmoState, AvailabilityResult, SimulationStep } from '#gw2/platform/execution/types.js';
import type { ProfessionRuntimeOptions, RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';
import type { CanonicalCatalog, Skill } from '#gw2/platform/engine/skills/types.js';
import type { ObservationPolicy } from '#kernel/execution/observation.js';
import type { Gw2ResolverEvent, Gw2ResolverResult } from '#gw2/platform/resolver/types.js';
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
  TProfessionState extends object = object,
  TSkill extends Skill = Skill
> extends NormalizedProfessionContract<TProfessionState, TSkill> {
  readonly projectPlanningState: (input: Gw2PlanningStateInput<TProfessionState>) => unknown;
}

/** Joins the application surface to a runtime source whose GW2 resolver callbacks remain type checked. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- The application registry holds multiple profession state types; concrete sources retain their generic state.
export type Gw2ProfessionSource<TProfessionState extends object = any> = ProfessionFamilyContract<
  TProfessionState,
  Gw2ProfessionContract<TProfessionState>,
  Gw2Build
> & {
  runtimeFor(config: Gw2Config, options?: ProfessionRuntimeOptions): RuntimeProfession<TProfessionState>;
};

export interface Gw2SimulationPlanningState {
  /** Detached owner observations at the planning boundary, including continuation after death. */
  readonly effects: readonly EffectState[];
  /** Default-command profession gates at this boundary, not predicted scheduler acceptance. */
  readonly availability: Readonly<Record<string, AvailabilityResult>>;
  /** Observed planning boundary in seconds; includes authoring continuation after target death. */
  readonly atSeconds: number;
  /** Public cooldown deadlines and remaining durations are milliseconds. */
  readonly cooldowns: Readonly<Record<string, { readyAt: number; remaining: number }>>;
  /** Name-keyed observed ammo; absent entries do not imply full charges. Prefer ammoBySkillId for identity. */
  readonly ammo: Readonly<Record<string, unknown>>;
  /** ID-keyed ammo avoids collisions between distinct skills sharing a display name. */
  readonly ammoBySkillId: Readonly<Record<string, Readonly<AmmoState>>>;
  readonly activeWeaponSet: number;
  readonly profession: unknown;
}

export interface Gw2SimulationResult extends Gw2ResolverResult {
  /** Diagnostic deadlines and causal owners only; pending effects have not dealt damage. */
  readonly pendingEffects?: readonly { readonly at: number; readonly cause: Gw2ResolverEvent }[];
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
