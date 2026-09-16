/**
 * Public request, result, and diagnostic contracts for the gw2combat-derived
 * TypeScript combat engine. A run takes one encounter (actors with inline
 * builds and rotations in the pinned upstream configuration format) and
 * returns either a completed result or an explicit failure. Nothing here
 * references the existing scheduler or resolver, so both runtimes coexist.
 */
import type { Encounter } from '#gw2/platform/combat-engine/configuration.js';

export interface EngineRequest {
  /** Upstream encounter JSON with inline `build`/`rotation` objects, or content already prepared by `prepareEncounter`. */
  readonly encounter: unknown;
  readonly output?: 'detailed' | 'score';
  /** Seeds every random draw site (critical strikes, random thresholds, weapon strength rolls). */
  readonly seed?: number;
  /** Identifies the content revision the caller compiled this request from. */
  readonly contentRevision?: string;
  /** Bounded-work protection for encounters whose termination conditions are never met. */
  readonly tickLimit?: number;
  /**
   * Simulated milliseconds per loop step. The reference-verified semantics use 1;
   * larger steps are an experimental approximation that quantizes timing to the step.
   */
  readonly stepMs?: number;
}

/** Engine revision metadata recorded on every run so a result can be reproduced. */
export interface EngineIdentity {
  readonly engine: 'gw2.combat-engine';
  readonly engineRevision: string;
  readonly referenceRevision: string;
  readonly contentRevision: string;
  readonly mode: 'detailed' | 'score';
  readonly seed: number;
  readonly stepMs: number;
}

export type DamageType =
  'strike' | 'binding_blade' | 'bleeding' | 'burning' | 'confusion' | 'poison' | 'torment_stationary';

/** One audit record, equivalent to an upstream `tick_event_t`. */
export type AuditEvent = { readonly timeMs: number; readonly actor: string } & (
  | { readonly type: 'actor_created' }
  | { readonly type: 'skill_cast_begin'; readonly skill: string; readonly castDuration: number }
  | { readonly type: 'skill_cast_end'; readonly skill: string }
  | { readonly type: 'equipped_bundle'; readonly bundle: string }
  | { readonly type: 'dropped_bundle'; readonly bundle: string }
  | {
      readonly type: 'effect_application';
      readonly sourceActor: string;
      readonly sourceSkill: string;
      readonly effect: string;
      readonly uniqueEffect: string;
      readonly numStacks: number;
      readonly durationMs: number;
    }
  | {
      readonly type: 'damage';
      readonly sourceActor: string;
      readonly sourceSkill: string;
      readonly damageType: DamageType;
      readonly damage: number;
    }
  | { readonly type: 'combat_stats_update'; readonly updatedHealth: number }
  | {
      readonly type: 'effect_expired';
      readonly sourceActor: string;
      readonly sourceSkill: string;
      readonly effect: string;
      readonly uniqueEffect: string;
    }
  | { readonly type: 'actor_downstate' }
);

/** End-of-run castability for one executable skill; the basis for editor availability projections. */
export interface SkillStatus {
  readonly isAvailableToCast: boolean;
  readonly unavailableToCastReason: string;
  readonly remainingCooldownWithoutAlacrity: number;
  readonly remainingCooldownWithAlacrity: number;
  readonly ammo: number;
}

export type TerminationReason = 'downstate' | 'TIME' | 'ROTATION' | 'ACTIVE_SKILLS' | 'DAMAGE';

export interface EngineResult {
  readonly ok: true;
  readonly identity: EngineIdentity;
  /** Last simulated tick (milliseconds since the encounter start). */
  readonly endTick: number;
  readonly terminatedBy: TerminationReason;
  /** Every damage event in the run, including damage sourced by the encounter itself. */
  readonly totalDamage: number;
  /** `totalDamage` over the whole encounter clock, the same window the reference comparison uses. */
  readonly dps: number;
  readonly damageBySourceActor: Readonly<Record<string, number>>;
  readonly afkTicksByActor: Readonly<Record<string, number>>;
  readonly counterValues: Readonly<Record<string, number>>;
  /** Detailed output only. Score mode omits histories without changing execution. */
  readonly events?: readonly AuditEvent[];
  readonly skillStatus?: Readonly<Record<string, Readonly<Record<string, SkillStatus>>>>;
}

export interface EngineFailure {
  readonly ok: false;
  readonly identity: EngineIdentity;
  readonly code: string;
  readonly message: string;
  /** JSON path of the responsible configuration entry, for validation failures. */
  readonly path?: string;
  /** Simulation tick at which a runtime failure occurred. */
  readonly tick?: number;
}

export type EngineOutcome = EngineResult | EngineFailure;

export type { Encounter };
