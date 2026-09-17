import type { Skill } from '#gw2/platform/engine/skills/types.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';

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

interface RechargeRateOptions {
  readonly alacrityRate?: number;
}

interface EffectiveCooldownOptions {
  readonly cooldownMultiplier?: number;
  readonly rechargeRate?: number;
}

export function gw2RechargeRate(config: Gw2Config, { alacrityRate = 1.25 }: RechargeRateOptions = {}): number {
  // The returned value is a speed, not a duration multiplier.
  return config.boons?.alacrity ? alacrityRate : 1;
}

/** Calculates effective skill recharge after cooldown and recharge-rate modifiers. */
export function gw2EffectiveCooldown(
  skill: Skill,
  config: Gw2Config,
  { cooldownMultiplier = 1, rechargeRate = gw2RechargeRate(config) }: EffectiveCooldownOptions = {}
): number {
  // Ammo skills report time per restored charge; non-ammo skills use their
  // cooldown/recharge field. Cast lockouts are handled by the scheduler.
  const baseRecharge = gw2BaseRecharge(skill);
  return (
    (Math.max(0, baseRecharge) * Math.max(0, Number(cooldownMultiplier || 0))) /
    Math.max(Number.EPSILON, Number(rechargeRate || 1))
  );
}
