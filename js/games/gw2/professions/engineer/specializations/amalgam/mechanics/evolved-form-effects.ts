import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { queueDamage, recordTrait } from '#gw2/professions/engineer/core/mechanics/resolution-helpers.js';
import { AMALGAM_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/engineer/specializations/amalgam/profiles.js';
import { amalgamState } from '#gw2/professions/engineer/specializations/amalgam/state.js';
import { applyCarbolicComposition } from '#gw2/professions/engineer/specializations/amalgam/traits/behavior.js';
import type { EngineerResolverContext, EngineerResolverEvent } from '#gw2/professions/engineer/types.js';
import { isInternalCooldownReady } from '#kernel/core/clock.js';

/** Applies damage-triggered Carbolic Composition and Rapacious Strain reactions. */
function reactToAmalgamDamage(context: EngineerResolverContext, event: EngineerResolverEvent): void {
  if (!(Number(event.coefficient) > 0)) return;
  const state = context.procs.readyAt;
  applyCarbolicComposition(context, event);

  const rapaciousStrainProfile = requireBalanceProfileFromContext(context, PROFILE.rapaciousStrain);
  // Rapacious requires both states and cannot trigger itself, even with a zero authored ICD.
  const cooldown = balanceProfileNumber(rapaciousStrainProfile, 'internalCooldown');
  if (
    event.actorType !== 'summon' &&
    event.sourceId !== 'engineer.rapacious-strain' &&
    (amalgamState.from(context).evolvedUntil || 0) > event.at &&
    (amalgamState.from(context).rapaciousUntil || 0) > event.at &&
    (cooldown === 0 || isInternalCooldownReady(event.at, state.rapacious || 0))
  ) {
    state.rapacious = event.at + cooldown;
    const strike = requireEffect(rapaciousStrainProfile, 'strike', 'Rapacious Strain');
    // Keep Rapacious effect-owned for proc gating while inheriting the player's outgoing modifiers.
    if (strike) {
      queueDamage(context, event, {
        name: 'Rapacious Strain',
        coefficient: Number(strike.coefficient),
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
}

/** Exposes Amalgam's resolver reactions keyed by the canonical event hook name. */
export const amalgamResolverEventReactions = Object.freeze({
  damage: reactToAmalgamDamage
});
