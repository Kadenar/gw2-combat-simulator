import { boonIntervalsFromWindows, type BoonWindow } from '#gw2/platform/combat/boons.js';
import type { RateInterval } from '#gw2/platform/combat/resources/pool.js';
import type { Skill } from '#gw2/platform/skills/types.js';

/** Remaining base-recharge seconds anchored to a timestamp, independent of the current recharge rate. */
export interface RechargeProgress {
  startedAt: number;
  work: number;
}

type Gw2RechargeSkill = Pick<Skill, 'ammo' | 'ammoRecharge' | 'cooldown'>;

function finiteRecharge(value: number | null | undefined): number | null {
  if (value == null) return null;
  const recharge = value;
  return Number.isFinite(recharge) ? recharge : null;
}

/** Selects the authored count recharge or ordinary cooldown before modifiers and progress are applied. */
export function gw2BaseRecharge(skill: Gw2RechargeSkill): number {
  const ammoRecharge = finiteRecharge(skill.ammoRecharge);
  if (Number(skill.ammo) > 0 && ammoRecharge != null && ammoRecharge > 0) return ammoRecharge;
  return finiteRecharge(skill.cooldown) ?? 0;
}

export const GW2_ALACRITY_RECHARGE_RATE = 1.25;

/** Player Alacrity is permanent; summons must actually receive the boon. */
export function gw2RechargeRate(
  skill: Skill,
  playerAlacrityRechargeRate = GW2_ALACRITY_RECHARGE_RATE,
  summonAlacrity = false
): number {
  // Skills such as Weapon Swap declare their Alacrity immunity instead of being recognized by display name.
  if (skill.rechargeIgnoresAlacrity) return 1;
  if (skill.rechargeBuffAudience === 'summon') return summonAlacrity ? GW2_ALACRITY_RECHARGE_RATE : 1;
  // Professions declare their player rate; summon rates and immunity remain shared rules.
  if (!Number.isFinite(playerAlacrityRechargeRate) || playerAlacrityRechargeRate <= 0)
    throw new RangeError('Player Alacrity recharge rate must be finite and positive.');
  return playerAlacrityRechargeRate;
}

/** Only summon cooldowns integrate received Alacrity grants and expiry. */
export function* gw2RechargeIntervals(
  playerAlacrityRechargeRate: number,
  summonAlacrityWindows: () => readonly BoonWindow[],
  skill: Skill,
  start: number,
  end: number
): Iterable<RateInterval> {
  if (end <= start) return;
  if (skill.rechargeBuffAudience !== 'summon' || skill.rechargeIgnoresAlacrity) {
    yield { start, end, rate: gw2RechargeRate(skill, playerAlacrityRechargeRate) };
    return;
  }

  for (const interval of boonIntervalsFromWindows(summonAlacrityWindows(), start, end)) {
    yield {
      start: interval.start,
      end: interval.end,
      rate: gw2RechargeRate(skill, playerAlacrityRechargeRate, interval.active)
    };
  }
}

/** Preserve earned recharge work when a received boon starts or expires. */
export function projectRecharge(progress: RechargeProgress, intervals: Iterable<RateInterval>): number {
  let work = Math.max(0, progress.work);
  if (!work) return progress.startedAt;
  for (const interval of intervals) {
    const elapsed = work / interval.rate;
    if (elapsed <= interval.end - interval.start) return interval.start + elapsed;
    work -= (interval.end - interval.start) * interval.rate;
  }

  throw new Error('Recharge intervals must cover the remaining cooldown.');
}
