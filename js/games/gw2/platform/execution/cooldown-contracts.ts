import type { RechargeProgress } from '#gw2/platform/execution/recharge.js';
import type { Skill, SkillId } from '#gw2/platform/skills/types.js';

/** Cooldown and ammo contracts: execution/cooldowns.ts privately owns the state; consumers use these views. */

export interface AmmoState {
  charges: number;
  maximum: number;
  /** Missing charges retain base work; serial queues activate the next anchor only after the front completes. */
  recharges: RechargeProgress[];
  nextRechargeAt: number | null;
  lockoutProgress?: RechargeProgress;
  /** Independent cast lockout; charge recovery must not shorten this deadline. */
  lockoutReadyAt?: number;
}

/** Mechanics can inspect pool facts; mutation and serial recharge bookkeeping remain inside the recharge service. */
export interface AmmoObservation extends Omit<Readonly<AmmoState>, 'recharges' | 'lockoutProgress'> {
  readonly recharges: readonly Readonly<RechargeProgress>[];
}

/** Checkpoints store remaining work and relative deadlines so restoring them does not rewrite earned progress. */
export interface RechargeCheckpoint {
  readonly remainingCooldowns: ReadonlyMap<SkillId, number>;
  readonly remainingRechargeWork: ReadonlyMap<SkillId, number>;
  readonly ammo: ReadonlyMap<
    SkillId,
    {
      readonly charges: number;
      readonly maximum: number;
      readonly nextRechargeRemaining: number | null;
      readonly lockoutRemaining: number;
      readonly pendingRechargeWork: readonly number[];
      readonly pendingLockoutWork?: number;
    }
  >;
}

export interface CooldownController {
  /** Observe one skill at the live clock without refreshing unrelated recharge pools. */
  isOnCooldown(skillId: SkillId, at?: number): boolean;
  readyAt(skillId: SkillId): number | undefined;
  hasCooldown(skillId: SkillId): boolean;
  readAmmo(skillId: SkillId): AmmoObservation | undefined;
  hasAmmo(skillId: SkillId): boolean;
  rechargeFor(skillId: SkillId): Readonly<RechargeProgress> | undefined;
  cooldownSkillIds(): IterableIterator<SkillId>;
  ammoSkillIds(): IterableIterator<SkillId>;
  retireAmmo(skillId: SkillId): void;
  linkAmmo(sourceId: SkillId, targetId: SkillId): void;
  clearAmmoLockout(skillId: SkillId): void;
  /** Reserve additional rounds at acceptance without settling their future recharge anchor. */
  reserveAmmo(skill: Skill, count: number, recharge: RechargeProgress): number;
  /** Replace temporary charges while retaining the existing independent cast lockout. */
  replaceAmmoCharges(skill: Skill, maximum: number, charges: number, recharges: readonly RechargeProgress[]): void;
  checkpoint(
    at: number,
    preservedCooldownIds: ReadonlySet<SkillId>,
    independentCooldownId: SkillId
  ): RechargeCheckpoint;
  restoreCheckpoint(
    checkpoint: RechargeCheckpoint,
    at: number,
    preservedCooldownIds: ReadonlySet<SkillId>,
    deadlines: readonly { readonly skillId: SkillId; readonly readyAt: number }[]
  ): void;
  /** Reset all recharge and ammunition pools at an authored reset boundary. */
  resetAll(): void;
  /** Starts a cooldown with base-recharge work; fixed deadlines use setReadyAt instead. */
  startRecharge(skill: Skill, at: number, work?: number): number;
  setReadyAt(skillId: SkillId, readyAt: number): void;
  clear(skillId: SkillId): void;
  copy(sourceId: SkillId, targetId: SkillId): void;
  refresh(at: number): void;
  rate(skill: Skill, at?: number): number;
  project(skill: Skill, progress: RechargeProgress): number;
  remaining(skill: Skill, progress: RechargeProgress, at: number): number;
  ensureAmmo(skill: Skill): AmmoObservation | null;
  /** Advances base-recharge progress and returns the wall time recovered at the current rate. */
  reduceSkillRecharge(skill: Skill, reduction: number, at?: number): number;
  refreshAmmo(skill: Skill, at: number): AmmoObservation | null;
  restoreAmmo(skill: Skill, count: number, at: number): number;
  setAmmoLockout(skill: Skill, work: number, at?: number): void;
  spendAmmo(skill: Skill, at: number, committedRechargeWork?: number): void;
}
