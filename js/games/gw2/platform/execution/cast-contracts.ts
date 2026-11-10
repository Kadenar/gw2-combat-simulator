import type { CastCommand, ChargeReleaseIntent } from '#gw2/platform/builds/rotation.js';
import type { Skill, SkillId, SkillTask } from '#gw2/platform/skills/types.js';
import { createDeferredQueries } from '#kernel/core/deferred-queries.js';

/** A cast owns one reservation from acceptance through completion, including its selected recharge work. */
export interface RuntimeCast<TSkill extends Skill = Skill> {
  readonly id: string;
  readonly skill: TSkill;
  readonly command: CastCommand;
  readonly start: number;
  readonly fullEnd: number;
  /** Timestamp when the cast stops executing, including an early interruption. */
  readonly effectiveEnd: number;
  /**
   * Timestamp when this cast stops blocking the next cast in its lane. Usually equals effectiveEnd; a retained
   * lockout after interruption keeps it at fullEnd instead. Scheduling, output, and mechanics share this timestamp.
   */
  readonly laneEnd: number;
  readonly rechargeStart: number;
  readonly rechargeWork: number;
  /** Recharge follows the accepted companion incarnation through delayed completion and replacement. */
  readonly rechargeCompanionId?: string;
  readonly ammoLockoutWork: number;
  /** True routes recharge through ammunition spending instead of ordinary skill recharge. */
  readonly usesAmmo: boolean;
  /**
   * The activation ended before its authored commit point, so its committed effects never happen. Decided once at
   * acceptance from the reserved cast window, so every hook reads the same answer.
   */
  readonly cancelledBeforeCommit: boolean;
}

/** The payload a profession task receives when a committed activation schedules its authored skill task. */
export interface SkillTaskData<TSkill extends Skill = Skill> {
  readonly cast: RuntimeCast<TSkill>;
  readonly taskDefinition: SkillTask;
}

/** Profession transitions query accepted casts and request lockouts without obtaining reservation stores. */
export interface CastControl {
  /** Resource recovery and form entry inspect lane facts without acquiring command traversal. */
  currentLaneEnd(): number;
  lockInputUntil(at: number): void;
  pendingChargeRelease(): ChargeReleaseIntent | undefined;
  hasInFlight(skillId: SkillId): boolean;
  inFlightSkillIds(): IterableIterator<SkillId>;
  setLockout(group: string, at: number): void;
  clearLockout(group: string): void;
}

/** Readiness observes accepted casts without granting lockout mutation. */
export type CastQueries = Pick<
  CastControl,
  'hasInFlight' | 'inFlightSkillIds' | 'currentLaneEnd' | 'pendingChargeRelease'
>;

/** Deferred access follows replacement and never reads an unbound cast owner during construction. */
export function createCastQueries(readControl: () => CastControl): CastQueries {
  return createDeferredQueries(readControl, [
    'hasInFlight',
    'inFlightSkillIds',
    'currentLaneEnd',
    'pendingChargeRelease'
  ]);
}
