/** Applies Core Mesmer availability, recharge, and shatter-ammunition policy. */
import { balanceProfileValueFromContext } from '#gw2/platform/combat/state/balance-profiles.js';
import { gw2EffectiveCooldown, gw2RechargeRate } from '#gw2/platform/combat/query/runtime-rules.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/content/professions/mesmer/data/ids.js';
import type { MesmerMaximumAmmoContext, MesmerRechargeContext } from '#gw2/content/professions/mesmer/types.js';
import { mesmerAvailability } from '#gw2/content/professions/mesmer/core/mechanics/availability.js';
import { mesmerRuntimeFor } from '#gw2/content/professions/mesmer/core/mechanics/runtime.js';
import { MESMER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/content/professions/mesmer/core/profiles.js';

/**
 * Calculates Mesmer recharge with special handling for ammo lockouts, weapon
 * swap, shared traits, Alacrity, and shatter resources.
 *
 * @param {object} context Recharge-modifier context.
 * @param {number} sharedDuration Shared-engine recharge duration in seconds.
 * @returns {number} Mesmer-adjusted recharge duration.
 */
export function modifyMesmerRecharge(context: MesmerRechargeContext, sharedDuration: number): number {
  const { skill, config } = context;
  if (context.ammoCastLockout) return sharedDuration;
  if (skill.id === ID.SWAP_WEAPONS) {
    return sharedDuration === 0 ? 0 : Number(skill.cooldown || 0);
  }

  const traits = mesmerRuntimeFor(context).traits;
  let multiplier = 1;
  if (
    (mesmerRuntimeFor(context).shatters[skill.id] || mesmerRuntimeFor(context).instruments[skill.id]) &&
    traits.has(TRAIT.MASTER_OF_MISDIRECTION)
  )
    multiplier *= balanceProfileValueFromContext(context, PROFILE.masterOfMisdirection, 'rechargeMultiplier', 0.85);
  if (skill.weapon === 'Sword' && traits.has(TRAIT.FENCERS_FINESSE)) {
    multiplier *= balanceProfileValueFromContext(context, PROFILE.fencersFinesse, 'rechargeMultiplier', 0.8);
  }

  const rechargeRate = gw2RechargeRate(config, { alacrityRate: 1.25 });
  const shatter = mesmerRuntimeFor(context).shatters[skill.id];
  if (shatter?.rechargeReductionPerSource) {
    const clones = mesmerRuntimeFor(context).actions.currentResource();
    const reduction = Number(shatter.rechargeReductionPerSource) * (clones + 1);
    const baseCooldown = Number(skill.cooldown ?? skill.recharge ?? 0);
    return Math.max(0, baseCooldown * multiplier - reduction) / rechargeRate;
  }

  return gw2EffectiveCooldown(skill, config, {
    cooldownMultiplier: multiplier,
    rechargeRate
  });
}

/**
 * Adds Shatter Storm's second charge to slot-one shatters or instruments.
 *
 * @param {object} context Maximum-ammo modifier context.
 * @param {number} maximum Shared-engine maximum charge count.
 * @returns {number} Mesmer-adjusted maximum charge count.
 */
export function modifyMesmerMaximumAmmo(context: MesmerMaximumAmmoContext, maximum: number): number {
  const id = context.skill.id;
  const runtime = mesmerRuntimeFor(context);
  const isSlot1 = runtime.shatters[id]?.slot === 1 || runtime.instruments[id]?.slot === 1;
  return isSlot1 && mesmerRuntimeFor(context).traits.has(TRAIT.SHATTER_STORM)
    ? balanceProfileValueFromContext(context, PROFILE.shatterStorm, 'maximumStacks', 2)
    : maximum;
}

/**
 * Mesmer availability, recharge, ammo, and profession-owned scheduling rules.
 */
export const mesmerCastRules = Object.freeze({
  availability: {
    id: 'mesmer.availability',
    order: 10,
    handler: mesmerAvailability
  },
  modifyRechargeDuration: modifyMesmerRecharge,
  modifyMaximumAmmo: modifyMesmerMaximumAmmo
});
