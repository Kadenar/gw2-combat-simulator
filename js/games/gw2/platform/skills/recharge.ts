import type { Skill } from '#gw2/platform/engine/skills/types.js';

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

/** Converts base recharge progress to wall time using recharge speed, independent of static cooldown modifiers. */
export function gw2TrackedRechargeReduction(baseReduction: number, rechargeRate: number): number {
  const reduction = Math.max(0, Number(baseReduction) || 0);
  return reduction / Math.max(Number.EPSILON, Number(rechargeRate) || 1);
}
