import type { CastCommand, ChargeReleaseIntent } from '#gw2/platform/execution/rotation.js';
import type { Skill, SkillId, SkillTask } from '#gw2/platform/skills/types.js';

/** A cast owns one reservation from acceptance through completion, including its selected recharge work. */
export interface RuntimeCast<TSkill extends Skill = Skill> {
  readonly id: string;
  readonly skill: TSkill;
  readonly command: CastCommand;
  readonly start: number;
  readonly fullEnd: number;
  readonly effectiveEnd: number;
  readonly rechargeStart: number;
  readonly rechargeWork: number;
  readonly ammoLockoutWork: number;
  readonly ammo: boolean;
  /**
   * The activation ended before its authored commit point, so its committed effects never happen. Decided once at
   * acceptance from the reserved cast window, so every hook reads the same answer.
   */
  readonly cancelled: boolean;
}

/** The payload a profession task receives when a committed activation schedules its authored skill task. */
export interface SkillTaskData<TSkill extends Skill = Skill> {
  readonly cast: RuntimeCast<TSkill>;
  readonly trigger: SkillTask;
}

/** Profession transitions query accepted casts and request lockouts without obtaining reservation stores. */
export interface CastControl {
  /** Resource recovery and form entry inspect lane facts without acquiring command traversal. */
  currentLaneEnd(): number;
  pendingCombatStart(): boolean;
  lockInputUntil(at: number): void;
  pendingChargeRelease(): ChargeReleaseIntent | undefined;
  hasInFlight(skillId: SkillId): boolean;
  inFlightSkillIds(): IterableIterator<SkillId>;
  setLockout(group: string, at: number): void;
  clearLockout(group: string): void;
}
