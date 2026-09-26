import { compileRechargeRules } from '#gw2/platform/profession-definition/trigger-rules.js';
import type { MesmerRuntimeState } from '#gw2/professions/mesmer/types.js';
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

/** Both cast reservations and mantra parent adjustments use the same trait rules before flat shatter reductions. */
const traitRecharge = compileRechargeRules<MesmerRuntimeState>([
  {
    trait: TRAIT.MASTER_OF_MISDIRECTION,
    when: (runtime, skill) =>
      Boolean(
        mesmerMechanicsFor(runtime).shatters[Number(skill.id)] ||
        mesmerMechanicsFor(runtime).instruments[Number(skill.id)]
      ),
    multiplier: { profile: PROFILE.masterOfMisdirection, field: 'rechargeMultiplier' }
  },
  {
    trait: TRAIT.FENCERS_FINESSE,
    when: (_runtime, skill) => skill.weapon === 'Sword',
    multiplier: { profile: PROFILE.fencersFinesse, field: 'rechargeMultiplier' }
  }
]);

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

  const multiplier = traitRecharge(context, skill, 1);

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
