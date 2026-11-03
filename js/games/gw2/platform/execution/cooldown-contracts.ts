/** Cooldown and ammo contracts: execution/cooldowns.ts privately owns the state; consumers use these views. */
import type { RechargeProgress } from '#gw2/platform/combat/recharge.js';
import type { Skill, SkillId } from '#gw2/platform/skills/types.js';

/** Detached pool facts and a derived deadline; mutable queues and between-use timers stay inside execution. */
export interface AmmoObservation {
  readonly charges: number;
  readonly maximum: number;
  readonly recharges: readonly Readonly<RechargeProgress>[];
  readonly nextRechargeAt: number | null;
}

/** Relative anchors preserve reservations that have not started at the capture boundary. */
export interface RechargeWorkSnapshot {
  readonly work: number;
  readonly startDelay: number;
  readonly companionId?: string;
}

export type RechargeTimerSnapshot =
  | { readonly kind: 'fixed'; readonly remaining: number }
  | { readonly kind: 'work'; readonly progress: RechargeWorkSnapshot };

/** Capture each pool once and reconnect its faces on restore; projections are never checkpoint authority. */
export interface RechargeCheckpoint {
  readonly timers: ReadonlyMap<SkillId, RechargeTimerSnapshot>;
  readonly pools: readonly {
    readonly skillId: SkillId;
    readonly charges: number;
    readonly maximum: number;
    readonly recharges: readonly RechargeWorkSnapshot[];
    readonly lockout?: RechargeTimerSnapshot;
  }[];
  readonly ammoBindings: ReadonlyMap<SkillId, number>;
}

export interface CooldownController {
  /** Observe one skill at the live clock without refreshing unrelated recharge pools. */
  isOnCooldown(skillId: SkillId, at?: number): boolean;
  /** Ordinary timers publish their cache; magazines derive availability from their shared resource state. */
  readyAt(skillId: SkillId): number | undefined;
  /** Ordinary entries remain present after completion; use isOnCooldown for live readiness. */
  hasCooldown(skillId: SkillId): boolean;
  readAmmo(skillId: SkillId): AmmoObservation | undefined;
  hasAmmo(skillId: SkillId): boolean;
  rechargeFor(skillId: SkillId): Readonly<RechargeProgress> | undefined;
  cooldownSkillIds(): IterableIterator<SkillId>;
  ammoSkillIds(): IterableIterator<SkillId>;
  /** Remove one magazine binding and its ordinary timer; other faces retain their shared pool. */
  retireAmmo(skillId: SkillId): void;
  /** Share the source magazine and its recharge policy without copying charges or availability. */
  linkAmmo(sourceId: SkillId, targetId: SkillId): void;
  /** Replace ordinary or between-charge recharge without restoring ammunition or restarting count recharge. */
  replaceSkillRecharge(skill: Skill, work: number, at: number): void;
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
  /** Keep earned work while removing the departing companion and its Alacrity from running cooldowns. */
  retireCompanion(companionId: string, at: number): void;
  /** Starts a cooldown with base-recharge work; fixed deadlines use setReadyAt instead. */
  startRecharge(skill: Skill, at: number, work?: number, companionId?: string): number;
  setReadyAt(skillId: SkillId, readyAt: number): void;
  /** Clear only the ordinary timer; magazine retirement and charge restoration are explicit operations. */
  clear(skillId: SkillId): void;
  /** Copy an ordinary timer and its cached deadline; shared magazines use linkAmmo. */
  copy(sourceId: SkillId, targetId: SkillId): void;
  refresh(at: number): void;
  /** Summon work queries the captured companion; fixed summon deadlines use normal-rate reduction instead. */
  rate(skill: Skill, at?: number, companionId?: string): number;
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
