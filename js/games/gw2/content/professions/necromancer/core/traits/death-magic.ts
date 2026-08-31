/** Owns imperative Core Necromancer Death Magic trait behavior for ordered dispatcher calls. */
import { isInternalCooldownReady } from '#kernel/core/clock.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { emitSkillBuff } from '#gw2/platform/scheduler/skill-events.js';
import { NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/content/professions/necromancer/data/ids.js';
import { addCarapace } from '#gw2/content/professions/necromancer/core/mechanics/state-helpers.js';
import type {
  NecromancerCastContext,
  NecromancerResolverContext,
  NecromancerResolverEvent,
  NecromancerSkill
} from '#gw2/content/professions/necromancer/types.js';

export function applyCorruptorsFervor(context: NecromancerResolverContext, event: NecromancerResolverEvent): void {
  if (event.actorType === 'summon' || !hasTrait(context, TRAIT.CORRUPTERS_FERVOR)) return;
  addCarapace(professionCoreState(context), 1, event.at);
}

export function applyDarkDefense(context: NecromancerCastContext, skill: NecromancerSkill): void {
  const state = professionCoreState(context);
  if (
    skill.type !== 'Heal' ||
    !hasTrait(context, TRAIT.DARK_DEFENSE) ||
    !isInternalCooldownReady(context.effectiveEnd, Number(state.traitProcReadyAt.darkDefense || 0))
  )
    return;
  state.traitProcReadyAt.darkDefense = context.effectiveEnd + 5;
  addCarapace(state, 10, context.effectiveEnd);
  emitSkillBuff(context, skill, {
    at: context.effectiveEnd,
    kind: 'protection',
    duration: 3,
    stacks: 1
  });
}
