import { gw2BaseRecharge } from '#gw2/platform/combat/recharge.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { MaximumAmmoContext } from '#gw2/platform/profession-definition/runtime-context.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import { fencersFinesseRecharge } from '#gw2/professions/mesmer/core/traits/dueling/index.js';
import {
  masterOfMisdirectionRecharge,
  shatterStormMaximumAmmo
} from '#gw2/professions/mesmer/core/traits/illusions/index.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import type { MesmerRuntime, MesmerRuntimeState } from '#gw2/professions/mesmer/types.js';

/**
 * Calculates Mesmer recharge with special handling for ammo lockouts, weapon
 * swap, shared traits, Alacrity, and shatter resources.
 *
 * Mesmer-adjusted recharge duration.
 */
export function mesmerRechargeWork(
  context: MechanicQueriesOf<MesmerRuntime>,
  skill: MesmerSkill,
  sharedDuration: number
): number {
  if (skill.id === SHARED_SKILL_IDS.SWAP_WEAPONS) {
    return sharedDuration === 0 ? 0 : skill.cooldown || 0;
  }

  const multiplier = fencersFinesseRecharge(context, skill, masterOfMisdirectionRecharge(context, skill, 1));

  const shatter = skill.shatter;
  if (shatter?.rechargeReductionPerSource) {
    // Recharge reads canonical shatter metadata and its owning clone pool, without acquiring illusion controllers.
    const clones = context.profession.core.clones.length;
    const reduction =
      balanceProfileNumber(requireBalanceProfileFromContext(context, shatter.balanceProfileId), 'rechargeReduction') *
      (clones + 1);
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
export function mesmerMaximumAmmo(
  context: MaximumAmmoContext<MesmerRuntimeState>,
  skill: MesmerSkill,
  maximum: number
): number {
  // Inactive mantra flips have no charge pool; only their parent can rearm and refill them.
  if (skill.flipParentId && !context.readProfessionState().core.availableFlips[skill.id]) return 0;
  return shatterStormMaximumAmmo(context, skill, maximum);
}
