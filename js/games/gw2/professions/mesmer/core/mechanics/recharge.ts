import { gw2BaseRecharge } from '#gw2/platform/engine/skills/recharge.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import {
  fencersFinesseRecharge,
  masterOfMisdirectionRecharge,
  shatterStormMaximumAmmo
} from '#gw2/professions/mesmer/core/traits/behavior.js';
/** Applies Core Mesmer availability, recharge, and shatter-ammunition policy. */
import { mesmerMechanicsFor } from '#gw2/professions/mesmer/core/mechanics/runtime.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import type { MesmerRuntime } from '#gw2/professions/mesmer/types.js';

/**
 * Calculates Mesmer recharge with special handling for ammo lockouts, weapon
 * swap, shared traits, Alacrity, and shatter resources.
 *
 * Mesmer-adjusted recharge duration.
 */
export function mesmerRechargeWork(context: MesmerRuntime, skill: MesmerSkill, sharedDuration: number): number {
  if (skill.id === SHARED_SKILL_IDS.SWAP_WEAPONS) {
    return sharedDuration === 0 ? 0 : skill.cooldown || 0;
  }

  const multiplier = fencersFinesseRecharge(context, skill, masterOfMisdirectionRecharge(context, skill, 1));

  const shatter = mesmerMechanicsFor(context).shatters[skill.id];
  if (shatter?.rechargeReductionPerSource) {
    const clones = mesmerMechanicsFor(context).actions.currentResource();
    const reduction = shatter.rechargeReductionPerSource * (clones + 1);
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
  return shatterStormMaximumAmmo(context, skill, maximum);
}
