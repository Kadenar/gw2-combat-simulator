import type { Skill } from '#gw2/platform/engine/skills/types.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import { boonIntervalsFromWindows, type BoonWindow, type Gw2BuffAudience } from '#gw2/platform/combat/boons.js';

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

/** Chronomancer's increased rate belongs to the player; summons retain the ordinary rate. */
function gw2AlacrityRechargeRate(config: Gw2Config, skill: Skill): number {
  return Number(
    config.alacrityRechargeRate ||
      (config.specialization === 'Chronomancer' && skill.rechargeBuffAudience !== 'summon'
        ? 1.5
        : GW2_ALACRITY_RECHARGE_RATE)
  );
}

/** Scheduler and resolver integrate the same audience-specific Alacrity history, including extensions. */
export function* gw2RechargeIntervals(
  config: Gw2Config,
  alacrityWindows: (audience: Gw2BuffAudience) => readonly BoonWindow[],
  skill: Skill,
  start: number,
  end: number
): Iterable<RechargeInterval> {
  if (end <= start) return;
  if (skill.name === 'Swap Weapons') {
    yield { start, end, rate: 1 };
    return;
  }

  const audience = skill.rechargeBuffAudience || 'self';
  // Constant-rate assumptions need no history; other skills reuse their timeline's audience-specific windows.
  if (audience === 'self' && config.boons?.alacrity) {
    yield { start, end, rate: gw2AlacrityRechargeRate(config, skill) };
    return;
  }

  for (const interval of boonIntervalsFromWindows(
    alacrityWindows(audience === 'self' ? 'all' : 'summon'),
    start,
    end
  )) {
    yield {
      start: interval.start,
      end: interval.end,
      rate: interval.active ? gw2AlacrityRechargeRate(config, skill) : 1
    };
  }
}

/** Projects completion from base work without changing progress already earned at earlier recharge rates. */
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
