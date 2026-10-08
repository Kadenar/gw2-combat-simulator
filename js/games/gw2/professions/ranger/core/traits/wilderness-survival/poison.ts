import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { buildResolverCondition } from '#gw2/platform/effects/packet-builders.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import {
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import { buildRangerCondition, isPetStrike } from '#gw2/professions/ranger/core/mechanics/resolution-helpers.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import type { RangerResolverContext, RangerRuntime, RangerSkill } from '#gw2/professions/ranger/types.js';

export function triggerPoisonMaster(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  const state = professionCoreState(context);
  if (!state.poisonMasterPetAttackReady || !isPetStrike(event) || !(Number(event.coefficient) > 0)) {
    return;
  }

  const profile = requireBalanceProfileFromContext(context, TRAIT.POISON_MASTER);
  const poison = requireEffect(profile, 'condition', 'Poisoned');
  // The armed pet attack exists only to deliver poison, so a removed packet leaves it armed.
  if (!poison) return;
  state.poisonMasterPetAttackReady = false;
  context.effects.emit({
    kind: 'packet',
    event: buildResolverCondition({
      at: event.at,
      source: 'Trait',
      sourceId: TRAIT.POISON_MASTER,
      actorType: 'effect',
      ownerActorType: 'player',
      skillId: TRAIT.POISON_MASTER,
      skillName: 'Poison Master',
      name: 'Poison Master - Poisoned',
      condition: String(poison.condition),
      duration: effectNumber(profile, poison, 'duration'),
      stacks: effectNumber(profile, poison, 'stacks'),
      triggeredBy: event.skillName
    })
  });
}

export function triggerArachnophobia(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  if (
    !isPetStrike(event) ||
    !hasTrait(context, TRAIT.ARACHNOPHOBIA) ||
    (event.skillId !== ID.SPIT && event.skillId !== ID.TWIN_DARTS)
  ) {
    return;
  }

  const profile = requireBalanceProfileFromContext(context, TRAIT.ARACHNOPHOBIA);
  const torment = requireEffect(profile, 'condition', 'Torment');
  if (!torment) return;
  // Twin Darts splits the trait's per-attack Torment across its two projectiles;
  // single-hit spider Spit keeps the full duration.
  const duration =
    effectNumber(profile, torment, 'duration') / (event.skillId === ID.TWIN_DARTS ? Number(event.totalHits || 2) : 1);
  context.effects.emit({
    kind: 'packet',
    event: buildRangerCondition(
      context,
      event,
      String(torment.condition),
      duration,
      effectNumber(profile, torment, 'stacks'),
      TRAIT.ARACHNOPHOBIA,
      'Arachnophobia'
    )
  });
}

/** Applies the trait at the accepted Beast-skill boundary. */
export function applyPoisonMasterBeastSkill(context: RangerRuntime, skill: RangerSkill): void {
  const notBeforeCombat =
    !context.hasExplicitCombatStart || (context.combatStartTime != null && context.time >= context.combatStartTime);
  if (hasTrait(context, TRAIT.POISON_MASTER) && notBeforeCombat) {
    context.effects.emit({
      kind: 'packet',
      event: {
        type: 'ranger.beast-skill-used',
        at: context.time,
        source: 'Trait',
        sourceId: TRAIT.POISON_MASTER,
        actorType: 'effect',
        skillId: skill.id,
        skillName: skill.name
      }
    });
  }
}

export function handleRangerBeastSkillUsed(context: RangerResolverContext, _event: Gw2ResolverEvent): void {
  if (hasTrait(context, TRAIT.POISON_MASTER)) {
    professionCoreState(context).poisonMasterPetAttackReady = true;
  }
}
