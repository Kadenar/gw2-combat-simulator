import {
  requireBalanceProfileFromContext,
  requireEffect,
  effectNumber,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
/** Owns imperative Core Necromancer Death Magic trait behavior for ordered dispatcher calls. */
import { tryConsumeProcCooldown } from '#gw2/platform/combat/procs.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { emitSkillBuff } from '#gw2/platform/execution/gw2-policy/skill-events.js';
import { NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { addCarapace } from '#gw2/professions/necromancer/core/mechanics/state-helpers.js';
import type {
  NecromancerCastContext,
  NecromancerResolverContext,
  NecromancerResolverEvent,
  NecromancerSkill
} from '#gw2/professions/necromancer/types.js';

export function applyCorruptorsFervor(context: NecromancerResolverContext, event: NecromancerResolverEvent): void {
  if (event.actorType === 'summon' || !hasTrait(context, TRAIT.CORRUPTERS_FERVOR)) return;
  addCarapace(
    professionCoreState(context),
    balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.CORRUPTERS_FERVOR), 'resourceGain'),
    event.at,
    balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.CORRUPTERS_FERVOR), 'duration')
  );
}

export function applyDarkDefense(context: NecromancerCastContext, skill: NecromancerSkill): void {
  const state = professionCoreState(context);
  if (skill.type !== 'Heal' || !hasTrait(context, TRAIT.DARK_DEFENSE)) return;
  // Claim only after local eligibility, before conditions, resources or queued strikes.
  if (
    !tryConsumeProcCooldown(
      state.traitProcReadyAt,
      'darkDefense',
      context.effectiveEnd,
      balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.DARK_DEFENSE), 'internalCooldown')
    )
  )
    return;
  addCarapace(
    state,
    balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.DARK_DEFENSE), 'resourceGain'),
    context.effectiveEnd,
    balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.DARK_DEFENSE), 'duration')
  );
  const profile = requireBalanceProfileFromContext(context, TRAIT.DARK_DEFENSE);
  const protection = requireEffect(profile, 'boon', 'protection');
  // Carapace is independent of the boon, so a removed boon keeps the carapace grant.
  if (!protection) return;
  emitSkillBuff(context, skill, {
    at: context.effectiveEnd,
    kind: String(protection.boon),
    duration: effectNumber(profile, protection, 'duration'),
    stacks: effectNumber(profile, protection, 'stacks')
  });
}
