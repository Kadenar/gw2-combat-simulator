import {
  balanceProfileFromContext,
  balanceProfileEffectFromContext
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
    Number(balanceProfileFromContext(context, TRAIT.CORRUPTERS_FERVOR)?.resourceGain),
    event.at,
    Number(balanceProfileFromContext(context, TRAIT.CORRUPTERS_FERVOR)?.duration)
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
      Number(balanceProfileFromContext(context, TRAIT.DARK_DEFENSE)?.internalCooldown)
    )
  )
    return;
  addCarapace(
    state,
    Number(balanceProfileFromContext(context, TRAIT.DARK_DEFENSE)?.resourceGain),
    context.effectiveEnd,
    Number(balanceProfileFromContext(context, TRAIT.DARK_DEFENSE)?.duration)
  );
  const protection = balanceProfileEffectFromContext(context, TRAIT.DARK_DEFENSE, 'boon', 0)!;
  emitSkillBuff(context, skill, {
    at: context.effectiveEnd,
    kind: 'protection',
    duration: Number(protection.duration),
    stacks: Number(protection.stacks)
  });
}
