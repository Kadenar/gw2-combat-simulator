import type { Skill } from '#gw2/platform/engine/skills/types.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import { boonIntervalsFromWindows, type BoonWindow } from '#gw2/platform/combat/boons.js';

/** Remaining base-recharge seconds anchored to a timestamp, independent of the current recharge rate. */
export interface RechargeProgress {
  startedAt: number;
  work: number;
}

export interface RechargeInterval {
  readonly start: number;
  readonly end: number;
  readonly rate: number;
}

type Gw2RechargeSkill = Pick<Skill, 'ammo' | 'ammoRecharge' | 'cooldown'>;

function finiteRecharge(value: number | null | undefined): number | null {
  if (value == null) return null;
  const recharge = Number(value);
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
export function gw2RechargeRate(config: Gw2Config, skill: Skill, summonAlacrity = false): number {
  if (skill.name === 'Swap Weapons' || skill.rechargeIgnoresAlacrity) return 1;
  if (skill.rechargeBuffAudience === 'summon') return summonAlacrity ? GW2_ALACRITY_RECHARGE_RATE : 1;
  return config.specialization === 'Chronomancer' ? 1.5 : GW2_ALACRITY_RECHARGE_RATE;
}

/** Only summon cooldowns integrate received Alacrity grants and expiry. */
export function* gw2RechargeIntervals(
  config: Gw2Config,
  summonAlacrityWindows: () => readonly BoonWindow[],
  skill: Skill,
  start: number,
  end: number
): Iterable<RechargeInterval> {
  if (end <= start) return;
  if (skill.rechargeBuffAudience !== 'summon' || skill.rechargeIgnoresAlacrity || skill.name === 'Swap Weapons') {
    yield { start, end, rate: gw2RechargeRate(config, skill) };
    return;
  }

  for (const interval of boonIntervalsFromWindows(summonAlacrityWindows(), start, end)) {
    yield { start: interval.start, end: interval.end, rate: gw2RechargeRate(config, skill, interval.active) };
  }
}

/** Preserve earned recharge work when a received boon starts or expires. */
export function projectRecharge(progress: RechargeProgress, intervals: Iterable<RechargeInterval>): number {
  let work = Math.max(0, progress.work);
  if (!work) return progress.startedAt;
  for (const interval of intervals) {
    const elapsed = work / interval.rate;
    if (elapsed <= interval.end - interval.start) return interval.start + elapsed;
    work -= (interval.end - interval.start) * interval.rate;
  }

  throw new Error('Recharge intervals must cover the remaining cooldown.');
}
