import { amalgamState } from '#gw2/professions/engineer/specializations/amalgam/state.js';
import { isInternalCooldownReady } from '#kernel/core/clock.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  balanceProfileEffectFromContext,
  balanceProfileValueFromContext
} from '#gw2/platform/combat/state/balance-profiles.js';
import { AMALGAM_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/engineer/specializations/amalgam/profiles.js';
import { ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import {
  applyEngineerDerivedCondition,
  procState,
  queueDamage,
  recordTrait,
  resolverSkill
} from '#gw2/professions/engineer/core/mechanics/state-helpers.js';
import type { EngineerResolverContext, EngineerResolverEvent } from '#gw2/professions/engineer/types.js';

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
    const poison = balanceProfileEffectFromContext(context, PROFILE.carbolicComposition, 'condition');
    applyEngineerDerivedCondition(context, event, {
      name: 'Carbolic Composition',
      condition: String(poison?.condition ?? 'Poisoned'),
      stacks: Number(poison?.stacks ?? 1),
      duration: Number(poison?.duration ?? 3),
      sourceId: TRAIT.CARBOLIC_COMPOSITION,
      actorType: 'effect',
      ownerActorType: 'player'
    });
  }

  // Rapacious requires both states and cannot trigger itself, even with a zero authored ICD.
  const cooldown = balanceProfileValueFromContext(context, PROFILE.rapaciousStrain, 'internalCooldown', 0.5);
  if (
    event.actorType !== 'summon' &&
    event.sourceId !== 'engineer.rapacious-strain' &&
    Number(amalgamState.from(context).evolvedUntil || 0) > event.at &&
    Number(amalgamState.from(context).rapaciousUntil || 0) > event.at &&
    (cooldown === 0 || isInternalCooldownReady(event.at, Number(state.rapacious || 0)))
  ) {
    state.rapacious = event.at + cooldown;
    const strike = balanceProfileEffectFromContext(context, PROFILE.rapaciousStrain, 'strike');
    // Keep Rapacious effect-owned for proc gating while inheriting the player's outgoing modifiers.
    queueDamage(context, event, {
      name: 'Rapacious Strain',
      coefficient: Number(strike?.coefficient ?? 0.3),
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
