import { REVENANT_SKILL_IDS as ID, REVENANT_TRAIT_IDS as TRAIT } from '../../data/ids.js';
import { hasTrait } from '../../../../../platform/combat/state/traits.js';
import { vindicatorState } from './state.js';
import { VINDICATOR_BALANCE_PROFILE_IDS } from './skills.js';
import type { RevenantPrecastContext, RevenantRechargeContext } from '../../types.js';

export function modifyVindicatorCastDuration(context: RevenantPrecastContext, duration: number): number {
  // Dodge is not a normal skill cast; override whatever the catalog says with the fixed animation duration.
  if (context.skill?.id !== ID.DODGE) return duration;
  const dodge = context.catalog.skillsById.get(
    vindicatorState.from(context).selectedDodge === 'Imperial Impact' ? ID.IMPERIAL_IMPACT : ID.DEATH_DROP
  );
  return Math.max(0, Number(dodge?.castTimeMs || 0)) / 1000;
}

export function modifyVindicatorRechargeDuration(context: RevenantRechargeContext, duration: number): number {
  const reaversCurse = context.catalog.balanceProfilesById.get(VINDICATOR_BALANCE_PROFILE_IDS.reaversCurse);
  // Energy Meld has two skill IDs in the catalog (62757 and 72058) representing the same button in different weapon configurations; both must be matched or one variant silently skips the reduction.
  return ([ID.ENERGY_MELD, ID.ENERGY_MELD_ID_72058] as readonly number[]).includes(Number(context.skill?.id)) &&
    hasTrait(context.config, TRAIT.REAVERS_CURSE)
    ? duration * Math.max(0, Number(reaversCurse?.rechargeMultiplier ?? 1))
    : duration;
}
