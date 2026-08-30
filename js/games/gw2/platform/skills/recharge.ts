import type { Skill } from '#gw2/platform/engine/types.js';

type Gw2RechargeSkill = Pick<Skill, 'ammo' | 'ammoRecharge' | 'cooldown' | 'recharge'>;

function finiteRecharge(value: number | null | undefined): number | null {
  if (value == null) return null;
  const recharge = Number(value);
  return Number.isFinite(recharge) ? recharge : null;
}

/** Selects GW2's per-charge ammo recharge or the canonical cooldown with legacy fallback. */
export function gw2BaseRecharge(skill: Gw2RechargeSkill): number {
  const ammoRecharge = finiteRecharge(skill.ammoRecharge);
  if (Number(skill.ammo) > 0 && ammoRecharge != null && ammoRecharge > 0) return ammoRecharge;
  return finiteRecharge(skill.cooldown) ?? finiteRecharge(skill.recharge) ?? 0;
}
