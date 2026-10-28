import type { EffectDelivery } from '#gw2/platform/effects/emission.js';
import type { ConditionEffect, StrikeEffect, StrikeTick } from '#gw2/platform/effects/types.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import type { MesmerResourceCause } from '#gw2/professions/mesmer/core/mechanics/resource-types.js';
import type { MesmerConditionEffect, MesmerSkill, MesmerStrikeEffect } from '#gw2/professions/mesmer/data/types.js';

export interface MesmerClone {
  id: number;
  createdAt: number;
  weapon: string;
  ownerId?: string;
  attackSequenceIndex?: number;
}

export interface MesmerPhantasmPolicy {
  readonly spawnModifiers: Readonly<
    Record<number, { readonly countMultiplier: number; readonly damageMultiplier: number }>
  >;
  readonly repeat?: {
    readonly label: string;
    /** Canonical granting trait identity is independent of the display name. */
    readonly traitId: number;
    readonly traitName: string;
    readonly damageMultiplier: number;
  };
  readonly bonusStrike?: {
    readonly name: string;
    /** Canonical granting trait identity is independent of the display name. */
    readonly traitId: number;
    readonly traitName: string;
    readonly damage: Partial<StrikeEffect>;
  };
  readonly conversionTiming: 'spawn' | 'blade-tick';
}

export type MesmerDestroyClone = (clone: MesmerClone) => void;

export type MesmerQueueResources = (
  at: number,
  count: number,
  weapon: string | null | undefined,
  reason: string,
  cause?: MesmerResourceCause,
  delivery?: EffectDelivery
) => void;

export interface MesmerResourceGain {
  readonly at: number;
  readonly cause: MesmerResourceCause;
  readonly createdClones: readonly MesmerClone[];
}

export interface MesmerCloneAttackScheduler {
  handleTask(cloneId: number, at: number): number | null;
  initializeClone(clone: MesmerClone): MesmerClone;
}

export interface MesmerIllusionRewards {
  gainResources(
    at: number,
    count: number,
    weapon: string | null | undefined,
    reason?: string,
    cause?: MesmerResourceCause
  ): void;
  queueResources: MesmerQueueResources;
}

export interface MesmerCloneAttackStep {
  /** Stable source skill for clone packets; names remain presentation only. */
  readonly id: SkillId;
  readonly name?: string;
  readonly coefficient?: number;
  readonly hits?: number;
  readonly atMs?: number;
  readonly damageAtMs?: number;
  readonly ticks?: readonly StrikeTick[];
  readonly interval: number;
  readonly conditions?: readonly ConditionEffect[];
}

interface MesmerCloneAttackBase {
  readonly weaponStrength: number;
  readonly firstAttackDelay?: number;
}

interface MesmerDirectCloneAttack extends MesmerCloneAttackBase, MesmerCloneAttackStep {
  readonly sequence?: undefined;
}

interface MesmerSequencedCloneAttack extends MesmerCloneAttackBase {
  readonly sequence: readonly [MesmerCloneAttackStep, ...MesmerCloneAttackStep[]];
}

export type MesmerCloneAttack = MesmerDirectCloneAttack | MesmerSequencedCloneAttack;

interface MesmerAttackTimingTick {
  readonly atMs: number;
}

// Phantasm offsets begin at the actual summon cast end supplied by the scheduler.
export interface MesmerPhantasmAttackTiming {
  readonly damageAtMs: number;
  readonly damageAtMsByEntity?: readonly number[];
  readonly spawnAtMs: number;
  readonly spawnAtMsByEntity?: readonly number[];
  readonly repeatDamageAtMs: number;
  readonly repeatDamageAtMsByEntity?: readonly number[];
  readonly repeatSpawnAtMs: number;
  readonly repeatSpawnAtMsByEntity?: readonly number[];
  readonly conversionTicks?: readonly MesmerAttackTimingTick[];
  readonly damageTicks?: Readonly<Record<string, readonly MesmerAttackTimingTick[]>>;
  readonly damageTicksByEntity?: readonly Readonly<Record<string, readonly MesmerAttackTimingTick[]>>[];
  readonly repeatDamageTicks?: Readonly<Record<string, readonly MesmerAttackTimingTick[]>>;
  readonly repeatDamageTicksByEntity?: readonly Readonly<Record<string, readonly MesmerAttackTimingTick[]>>[];
  readonly phantasmalBladeDelayAfterSpawnMs?: number;
}

/** Accepted summon snapshots are shared by lifecycle coordination, attacks, and resource conversion. */
export interface MesmerPhantasmExecution {
  readonly policy: MesmerPhantasmPolicy;
  readonly delivery: EffectDelivery;
  readonly skill: MesmerSkill;
  // Index among co-spawned entities (e.g. Bountiful Blades spawns 2 Berserkers: 0 and 1).
  readonly entityIndex: number;
  // Scales coefficient down when multiple phantasms share a skill's total damage budget (Bountiful Blades: 0.66).
  readonly damageMultiplier: number;
  readonly summonAt: number;
  readonly damageAt: number;
  // When a specialization repeat policy re-summons the phantasm; equals damageAt otherwise.
  readonly spawnAt: number;
  // Timestamp for the optional repeat attack.
  readonly repeatDamageAt: number;
  // Final resource conversion time, including repeat and specialization blade-tick policies.
  readonly conversionAt: number;
  // When a specialization bonus strike fires; uses a post-spawn delay when supplied.
  readonly initialBladeAt: number;
  readonly timing: MesmerPhantasmAttackTiming;
  // Converts a raw post-cast millisecond offset from timing metadata into a simulation
  // timestamp, accounting for cast duration and Phantasmal Haste speed scaling.
  readonly endpoint: (atMs: number | undefined) => number;
}

export interface MesmerPhantasmEffectController {
  prepare(
    skill: MesmerSkill,
    castStart: number,
    summonAt: number,
    clarityConsumed: boolean,
    delivery?: EffectDelivery
  ): readonly MesmerPhantasmExecution[];
  scheduleLifecycle(executions: readonly MesmerPhantasmExecution[]): void;
  scheduleStrike(execution: MesmerPhantasmExecution, group: MesmerStrikeEffect, castStart: number): void;
  scheduleStatuses(execution: MesmerPhantasmExecution, conditions: readonly MesmerConditionEffect[]): void;
  queueConversion(execution: MesmerPhantasmExecution, amount?: number): void;
}
