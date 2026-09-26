import type { Skill } from '#gw2/platform/engine/skills/types.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';

/** Remaining base-recharge seconds anchored to a timestamp, independent of the current recharge rate. */
export interface RechargeProgress {
  startedAt: number;
  work: number;
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

/** Console Alacrity is permanent; Chronomancer's increased rate applies only to player skills. */
export function gw2RechargeRate(config: Gw2Config, skill: Skill): number {
  if (skill.name === 'Swap Weapons' || skill.rechargeIgnoresAlacrity) return 1;
  return config.specialization === 'Chronomancer' && skill.rechargeBuffAudience !== 'summon'
    ? 1.5
    : GW2_ALACRITY_RECHARGE_RATE;
}

/** Committed base work completes at a constant rate, independent of boon events. */
export function projectRecharge(progress: RechargeProgress, rate: number): number {
  return progress.startedAt + Math.max(0, progress.work) / rate;
}
