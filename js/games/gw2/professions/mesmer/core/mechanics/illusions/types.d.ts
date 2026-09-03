import type { SchedulerRecord, SimulationEvent, SkillId, StrikeTick } from '#gw2/platform/engine/types.js';

import type { MesmerResourceCause } from '#gw2/professions/mesmer/state/types.js';
import type { MesmerConditionApplication } from '#gw2/professions/mesmer/data/types.js';

export interface MesmerClone {
  id: number;
  createdAt: number;
  weapon: string;
  ownerId?: string;
  attackSequenceIndex?: number;
  nextAttackAt?: number;
}

export interface MesmerTraitDamage {
  readonly balanceProfileId?: SkillId;
  readonly coefficient?: number;
  readonly hits?: number;
  readonly ticks?: readonly StrikeTick[];
  readonly cooldown?: number;
  readonly weaponStrength?: number;
  readonly duration?: number;
  readonly damageIncrease?: number;
}

export interface MesmerPhantasmPolicy {
  readonly spawnModifiers: Readonly<
    Record<number, { readonly countMultiplier: number; readonly damageMultiplier: number }>
  >;
  readonly repeat?: {
    readonly label: string;
    readonly traitName: string;
    readonly damageMultiplier: number;
  };
  readonly bonusStrike?: {
    readonly name: string;
    readonly traitName: string;
    readonly damage: MesmerTraitDamage;
  };
  readonly conversionTiming: 'spawn' | 'blade-tick';
}

export type MesmerDestroyClone = (clone: MesmerClone, at: number) => void;

export type MesmerQueueResources = (
  at: number,
  count: number,
  weapon: string | null | undefined,
  reason: string,
  cause?: MesmerResourceCause
) => void;

export interface MesmerResourceGain {
  readonly at: number;
  readonly gained: number;
  readonly reason: string;
  readonly cause: MesmerResourceCause;
  readonly createdClones: readonly MesmerClone[];
}

export interface MesmerCloneAttackScheduler {
  handleTask(cloneId: number, at: number): void;
  initializeClone(clone: MesmerClone): MesmerClone;
  nextAttackAt(): number;
  scheduleAt(at: number): void;
}

export interface MesmerResourceController {
  addGainHandler(handler: (gain: MesmerResourceGain) => void): void;
  gainResources(
    at: number,
    count: number,
    weapon: string | null | undefined,
    reason?: string,
    cause?: MesmerResourceCause
  ): void;
  queueResources: MesmerQueueResources;
}

export type MesmerExpectedProcCandidate = {
  readonly type: 'hit';
  readonly at: number;
  readonly event: SimulationEvent;
} & SchedulerRecord;

export interface MesmerExpectedProcTracker {
  process(candidate: MesmerExpectedProcCandidate): void;
}

export interface MesmerAttackStatus extends MesmerConditionApplication {
  readonly stacks?: number;
}

export interface MesmerCloneAttackStep {
  readonly id?: SkillId;
  readonly name?: string;
  readonly coefficient?: number;
  readonly hits?: number;
  readonly atMs?: number;
  readonly castTimeMs?: number;
  readonly damageAtMs?: number;
  readonly ticks?: readonly StrikeTick[];
  readonly interval: number;
  readonly conditions?: readonly MesmerAttackStatus[];
}

export interface MesmerCloneAttackBase {
  readonly weaponStrength: number;
  readonly firstAttackDelay?: number;
}

export interface MesmerDirectCloneAttack extends MesmerCloneAttackBase, MesmerCloneAttackStep {
  readonly sequence?: undefined;
}

export interface MesmerSequencedCloneAttack extends MesmerCloneAttackBase {
  readonly sequence: readonly [MesmerCloneAttackStep, ...MesmerCloneAttackStep[]];
}

export type MesmerCloneAttack = MesmerDirectCloneAttack | MesmerSequencedCloneAttack;

export interface MesmerAttackTimingTick {
  readonly atMs: number;
}

export interface MesmerPhantasmAttackTiming {
  readonly castTimeMs: number;
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
  readonly estimated?: boolean;
}
