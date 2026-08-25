import { amalgamState } from './state.js';
import { isInternalCooldownReady } from '../../../../platform/engine/core/clock.js';
import { hasTrait } from '../../../../platform/gw2/combat/state/traits.js';
import { ENGINEER_TRAIT_IDS as TRAIT } from '../../data/ids.js';
import { applyCondition, procState, queueDamage, recordTrait, resolverSkill } from '../../core/shared.js';
import type { EngineerResolverContext, EngineerResolverEvent, EngineerResolverReactionDetails } from '../../types.js';

function isAmalgamSkillHit(context: EngineerResolverContext, event: EngineerResolverEvent): boolean {
  if (event.actorType === 'summon') return false;
  // Rapacious Strain fires as an "effect" actor after player hits. Allow it
  // through so Carbolic Composition also procs on Rapacious damage.
  if (event.actorType === 'effect') {
    return event.name === 'Rapacious Strain';
  }

  const skill = resolverSkill(context, event.skillId);
  return Boolean(
    skill?.specialization === 'Amalgam' ||
    skill?.categories?.includes('Amalgam') ||
    skill?.categories?.includes('Morph')
  );
}

function reactToAmalgamDamage(
  context: EngineerResolverContext,
  event: EngineerResolverEvent,
  details: EngineerResolverReactionDetails = {}
): void {
  if (!(Number(event.coefficient) > 0)) return;
  const state = procState(context);
  if (hasTrait(context, TRAIT.CARBOLIC_COMPOSITION) && isAmalgamSkillHit(context, event)) {
    applyCondition(details, context, event, {
      name: 'Carbolic Composition',
      condition: 'Poisoned',
      stacks: 1,
      duration: 3,
      sourceId: TRAIT.CARBOLIC_COMPOSITION,
      actorType: 'effect'
    });
  }

  // Rapacious Strain requires both Evolved AND Rapacious (Thorns silver-lining)
  // to be active simultaneously, with a 0.5s ICD between procs.
  if (
    event.actorType !== 'summon' &&
    Number(amalgamState.from(context).evolvedUntil || 0) > event.at &&
    Number(amalgamState.from(context).rapaciousUntil || 0) > event.at &&
    isInternalCooldownReady(event.at, Number(state.rapacious || 0))
  ) {
    state.rapacious = event.at + 0.5;
    // Keep Rapacious effect-owned for proc gating while inheriting the player's outgoing modifiers.
    queueDamage(context, event, {
      name: 'Rapacious Strain',
      coefficient: 0.3,
      sourceId: 'engineer.rapacious-strain',
      actorType: 'effect',
      ownerActorType: 'player'
    });
    recordTrait(
      context,
      'Rapacious Strain',
      event,
      'https://render.guildwars2.com/file/' + '5B565BA46C111902EE65AB4592590442A5A6E754/3680135.png'
    );
  }
}

export const amalgamResolverEventReactions = Object.freeze({
  damage: reactToAmalgamDamage
});
