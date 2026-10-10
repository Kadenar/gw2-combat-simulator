import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { resourceAtLeast } from '#gw2/platform/combat/resources/pool.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import {
  revenantRuntimeCoreState,
  revenantRuntimeSpecializationState
} from '#gw2/professions/revenant/core/state-queries.js';
import { REVENANT_MAXIMUM_ENDURANCE } from '#gw2/professions/revenant/core/state.js';
import { REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';
import { activeKallasFervorStacks } from '#gw2/professions/revenant/specializations/renegade/mechanics/kalla-and-band-together.js';
import {
  RENEGADE_PROFILE_IDS as PROFILE,
  RENEGADE_PROFILE_IDS
} from '#gw2/professions/revenant/specializations/renegade/profiles.js';
import type { RevenantSkill } from '#gw2/professions/revenant/types.js';

/** Adds protection only for the selected enhancement, retaining the order's pulse cadence. */
export const boldReversalOrderEffects: NonNullable<NonNullable<Skill['effectVariants']>[number]['transform']> = (
  runtime,
  _cast,
  effects
) =>
  hasTrait(runtime, TRAIT.BOLD_REVERSAL)
    ? [...effects, ...(requireBalanceProfileFromContext(runtime, PROFILE.boldReversalRighteousRebel).effects ?? [])]
    : effects;

export function modifyRenegadeCriticalChance(context: Gw2ModifierContext, chance: number): number {
  if (!hasTrait(context, TRAIT.BRUTAL_MOMENTUM)) return chance;
  const state = revenantRuntimeCoreState(context);
  const maximum = REVENANT_MAXIMUM_ENDURANCE;
  const full = resourceAtLeast(state.endurance?.value ?? 0, maximum);
  const brutalMomentumProfile = requireBalanceProfileFromContext(context, RENEGADE_PROFILE_IDS.brutalMomentum);
  // At full endurance: +33% crit; below full: +10% crit
  return chance + balanceProfileNumber(brutalMomentumProfile, full ? 'fullEnduranceCriticalChance' : 'criticalChance');
}

export function kallasFervorStacks(context: Gw2ModifierContext): number {
  return activeKallasFervorStacks(revenantRuntimeSpecializationState(context, 'Renegade'), context.time);
}

/** Chooses the Heroic Command payload after live Fervor has been counted. */
export function heroicCommandProfile(runtime: RevenantRuntime, cast: RuntimeCast<RevenantSkill>) {
  const source = hasTrait(runtime, TRAIT.LASTING_LEGACY)
    ? requireBalanceProfileFromContext(runtime, PROFILE.heroicCommandLastingLegacy)
    : cast.skill;
  return source;
}

/** Supplies Orders from Above's trait-selected pulse variant at skill materialization. */
export const righteousRebelOrderVariants: NonNullable<Skill['effectVariants']> = [
  {
    when: (runtime) => hasTrait(runtime, TRAIT.RIGHTEOUS_REBEL),
    profileId: PROFILE.ordersFromAboveRighteousRebel,
    transform: boldReversalOrderEffects
  }
];
