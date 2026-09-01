import { amalgamState } from '#gw2/content/professions/engineer/specializations/amalgam/state.js';
import { isInternalCooldownReady } from '#kernel/core/clock.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/content/professions/engineer/data/ids.js';
import {
  applyEngineerDerivedCondition,
  procState,
  queueDamage,
  recordTrait,
  resolverSkill
} from '#gw2/content/professions/engineer/core/mechanics/state-helpers.js';
import type { EngineerResolverContext, EngineerResolverEvent } from '#gw2/content/professions/engineer/types.js';

/** Identifies player-owned Amalgam hits and the Rapacious effect hit that may chain Carbolic Composition. */
function isAmalgamSkillHit(context: EngineerResolverContext, event: EngineerResolverEvent): boolean {
  if (event.actorType === 'summon') return false;
  // Rapacious Strain fires as an "effect" actor after player hits. Allow it
  // through so Carbolic Composition also procs on Rapacious damage.
  if (event.actorType === 'effect') {
    return event.sourceId === 'engineer.rapacious-strain';
  }

  const skill = resolverSkill(context, event.skillId);
  return Boolean(
    skill?.specialization === 'Amalgam' ||
    skill?.categories?.includes('Amalgam') ||
    skill?.categories?.includes('Morph')
  );
}

/** Applies damage-triggered Carbolic Composition and Rapacious Strain reactions. */
function reactToAmalgamDamage(context: EngineerResolverContext, event: EngineerResolverEvent): void {
  if (!(Number(event.coefficient) > 0)) return;
  const state = procState(context);
  if (hasTrait(context, TRAIT.CARBOLIC_COMPOSITION) && isAmalgamSkillHit(context, event)) {
    applyEngineerDerivedCondition(context, event, {
      name: 'Carbolic Composition',
      condition: 'Poisoned',
      stacks: 1,
      duration: 3,
      sourceId: TRAIT.CARBOLIC_COMPOSITION,
      actorType: 'effect',
      ownerActorType: 'player'
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

/** Exposes Amalgam's resolver reactions keyed by the canonical event hook name. */
export const amalgamResolverEventReactions = Object.freeze({
  damage: reactToAmalgamDamage
});
