import type { RechargeProgress } from '#gw2/platform/engine/skills/recharge.js';
/** Defines scheduling state, cast commands, and observation contracts used to execute rotations. */
import type { Skill, SkillId } from '#gw2/platform/engine/skills/types.js';

export interface AmmoState {
  charges: number;
  maximum: number;
  rechargeWork: number;
  nextRechargeAt: number | null;
  rechargeProgress?: RechargeProgress;
  lockoutProgress?: RechargeProgress;
  /** Independent cast lockout; charge recovery must not shorten this deadline. */
  lockoutReadyAt?: number;
}

export type AvailabilityResult =
  | Readonly<{ ready: true }>
  | Readonly<{
      ready: false;
      retryAt: null;
      reason: string;
      code: string;
    }>
  | Readonly<{
      ready: false;
      retryAt: number;
      reason: string;
      code: string;
    }>;

export interface ProfessionConfig {
  /** Active elite specialization, or "Core"; module composition resolves the runtime from it. */
  readonly specialization?: string;
  readonly boons?: Readonly<Record<string, boolean | number>>;
}

export interface CooldownController {
  /** Starts a cooldown with base-recharge work; fixed deadlines use setReadyAt instead. */
  startRecharge(skill: Skill, at: number, work?: number): number;
  setReadyAt(skillId: SkillId, readyAt: number): void;
  clear(skillId: SkillId): void;
  copy(sourceId: SkillId, targetId: SkillId): void;
  refresh(at: number): void;
  rate(skill: Skill): number;
  project(skill: Skill, progress: RechargeProgress): number;
  remaining(skill: Skill, progress: RechargeProgress, at: number): number;
  ensureAmmo(skill: Skill, at?: number): AmmoState | null;
  /** Advances base-recharge progress and returns the wall time recovered at the current rate. */
  reduceSkillRecharge(skill: Skill, reduction: number, at?: number): number;
  refreshAmmo(skill: Skill, at: number): AmmoState | null;
  restoreAmmo(skill: Skill, count: number, at: number, whenFull: 'retain' | 'reset'): number;
  setAmmoLockout(skill: Skill, work: number, at?: number): void;
  spendAmmo(skill: Skill, at: number, committedRechargeWork?: number): void;
}

export interface SimulationStep {
  readonly ri: number;
  readonly skill: string;
  /** Stable cast identity used by result analysis without relying on display names or bar positions. */
  readonly skillId?: SkillId;
  /** Scheduled start in milliseconds, used to position this step on the timeline. */
  readonly start: number;
  readonly end: number;
  readonly activationId?: string;
  readonly fullCastMs?: number;
  readonly interrupted?: boolean;
  /** Millisecond timestamp through which this cast still reserves its execution lane after ending. */
  readonly castLockoutEnd?: number;
  /** Identifies an interrupted commit-mode cast that ended before every declared interrupt cutoff. */
  readonly cancelledBeforeCommit?: boolean;
  /** Identifies interrupted commit-mode casts whose damage had no commit cutoff and can therefore be reported as wasted time. */
  readonly missingInterruptCommit?: boolean;
  readonly invalid?: boolean;
  readonly invalidReason?: string;
}

export interface CastCommand {
  readonly type: 'cast';
  readonly skillId: SkillId;
  /** Casts normally but prevents this activation's hostile packets from reaching the target. */
  readonly offTarget?: boolean;
  /** Casts normally but lands this activation's hostile packets later, as when a precast travels from range. */
  readonly impactDelayMs?: number;
  readonly concurrentOffsetMs?: number;
  readonly interruptAfterMs?: number;
  /** Exact remaining duration carried by a hidden combat-log initial-state action. */
  readonly initialStateDurationMs?: number;
  readonly releaseAtCharges?: number;
  readonly doubleEdgeOutcome?: 'success' | 'backfire';
}

export interface WaitCommand {
  readonly type: 'wait';
  readonly durationMs: number;
}

export interface CombatStartCommand {
  readonly type: 'combat-start';
  readonly concurrentOffsetMs?: number;
}

export interface CooldownResetCommand {
  readonly type: 'cooldown-reset';
}

export type RotationCommand = CastCommand | WaitCommand | CombatStartCommand | CooldownResetCommand;
