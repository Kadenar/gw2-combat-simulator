import type { EffectDelivery } from '#gw2/platform/effects/emission.js';
import type { SimulationEvent } from '#gw2/platform/events/events.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import type { StrikeTick, StrikeEffect } from '#gw2/platform/effects/types.js';

import type { MesmerResourceCause } from '#gw2/professions/mesmer/core/mechanics/resource-types.js';
import type { ConditionEffect } from '#gw2/platform/effects/types.js';

export interface MesmerClone {
  id: number;
  createdAt: number;
  weapon: string;
  ownerId?: string;
  attackSequenceIndex?: number;
  nextAttackAt?: number;
}

export interface MesmerTraitDamage extends Partial<StrikeEffect> {
  readonly balanceProfileId?: SkillId;
  readonly name?: string;
  readonly coefficient?: number;
  readonly hits?: number;
  readonly ticks?: readonly StrikeTick[];
  readonly cooldown?: number;
  readonly weaponStrength?: number;
  readonly duration?: number;
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
    readonly damage: MesmerTraitDamage;
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

export interface MesmerCriticalTraitDispatcher {
  process(event: SimulationEvent, chance: number): void;
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
