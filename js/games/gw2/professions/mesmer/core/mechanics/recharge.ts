import { gw2BaseRecharge } from '#gw2/platform/engine/skills/recharge.js';
/** Applies Core Mesmer availability, recharge, and shatter-ammunition policy. */
import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import type { MesmerRuntime } from '#gw2/professions/mesmer/types.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import { mesmerMechanicsFor } from '#gw2/professions/mesmer/core/mechanics/runtime.js';
import { MESMER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/mesmer/core/profiles.js';

/**
 * Calculates Mesmer recharge with special handling for ammo lockouts, weapon
 * swap, shared traits, Alacrity, and shatter resources.
 *
 * Mesmer-adjusted recharge duration.
 */
export function mesmerRechargeWork(context: MesmerRuntime, skill: MesmerSkill, sharedDuration: number): number {
  if (skill.id === ID.SWAP_WEAPONS) {
    return sharedDuration === 0 ? 0 : Number(skill.cooldown || 0);
  }

  const traits = mesmerMechanicsFor(context).traits;
  let multiplier = 1;
  if (
    (mesmerMechanicsFor(context).shatters[skill.id] || mesmerMechanicsFor(context).instruments[skill.id]) &&
    traits.has(TRAIT.MASTER_OF_MISDIRECTION)
  )
    multiplier *= balanceProfileNumber(
      requireBalanceProfileFromContext(context, PROFILE.masterOfMisdirection),
      'rechargeMultiplier'
    );
  if (skill.weapon === 'Sword' && traits.has(TRAIT.FENCERS_FINESSE)) {
    const fencersFinesseProfile = requireBalanceProfileFromContext(context, PROFILE.fencersFinesse);
    multiplier *= balanceProfileNumber(fencersFinesseProfile, 'rechargeMultiplier');
  }

  const shatter = mesmerMechanicsFor(context).shatters[skill.id];
  if (shatter?.rechargeReductionPerSource) {
    const clones = mesmerMechanicsFor(context).actions.currentResource();
    const reduction = Number(shatter.rechargeReductionPerSource) * (clones + 1);
    const baseCooldown = gw2BaseRecharge(skill);
    return Math.max(0, baseCooldown * multiplier - reduction);
  }

  // Shared recharge already uses the owner's permanent Alacrity rate.
  return sharedDuration * multiplier;
}

/**
 * Adds Shatter Storm's second charge to slot-one shatters or instruments.
 *
 * Mesmer-adjusted maximum charge count.
 */
export function mesmerMaximumAmmo(context: MesmerRuntime, skill: MesmerSkill, maximum: number): number {
  // Inactive mantra flips have no charge pool; only their parent can rearm and refill them.
  if (skill.flipParentId && !context.profession.core.availableFlips[skill.id]) return 0;
  const id = skill.id;
  const runtime = mesmerMechanicsFor(context);
  const isSlot1 = runtime.shatters[id]?.slot === 1 || runtime.instruments[id]?.slot === 1;
  return isSlot1 && mesmerMechanicsFor(context).traits.has(TRAIT.SHATTER_STORM)
    ? balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.shatterStorm), 'maximumStacks')
    : maximum;
}
