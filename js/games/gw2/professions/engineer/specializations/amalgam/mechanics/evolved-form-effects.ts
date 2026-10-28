import { isInternalCooldownReady } from '#gw2/platform/combat/procs/registry.js';
import { ACTOR } from '#gw2/platform/constants.js';
import { requireSkillAction } from '#gw2/platform/effects/actions.js';
import { defineTriggerPoint } from '#gw2/platform/profession-definition/trigger-points.js';
import {
  effectNumber,
  requireEffect,
  requireSkillFromContext,
  skillNumber
} from '#gw2/platform/skills/balance-profiles.js';
import { buildEngineerStrike } from '#gw2/professions/engineer/core/mechanics/resolution-helpers.js';
import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { amalgamState } from '#gw2/professions/engineer/specializations/amalgam/state.js';
import type { EngineerResolverEvent, EngineerRuntime } from '#gw2/professions/engineer/types.js';

/** A positive strike resolved while Amalgam is selected; the cause is the resolved hit. */
export interface AmalgamStrike {
  readonly cause: EngineerResolverEvent;
}

/** Trait-owned Poison lands on an eligible hit before Rapacious Strain checks its own proc. */
export const amalgamStruck = defineTriggerPoint<AmalgamStrike>('engineer.amalgam-struck', [TRAIT.CARBOLIC_COMPOSITION]);

/** Applies damage-triggered trait rewards, then the Rapacious Strain reaction. */
function reactToAmalgamDamage(context: EngineerRuntime, event: EngineerResolverEvent): void {
  if (!(Number(event.coefficient) > 0)) return;

  const state = context.procs;
  context.fireTrigger(amalgamStruck, { cause: event });

  const strain = amalgamState.from(context);

  if (
    event.actorType === ACTOR.SUMMON ||
    event.sourceId === 'engineer.rapacious-strain' ||
    strain.evolvedUntil <= event.at ||
    strain.rapaciousUntil <= event.at
  )
    return;

  // The shared strain owner keeps one cooldown regardless of the last granting slot.
  const skill = requireSkillFromContext(context, ID.DEFENSIVE_PROTOCOL_THORNS);
  // Rapacious requires both states and cannot trigger itself, even with a zero authored ICD.
  const cooldown = skillNumber(skill, 'rapaciousInternalCooldown');

  if (cooldown === 0 || isInternalCooldownReady(event.at, state.deadline('rapacious') || 0)) {
    const strike = requireEffect(skill, 'strike', 'Rapacious Strain', requireSkillAction(skill, 'strain'));

    // Keep Rapacious effect-owned for proc gating while inheriting the player's outgoing modifiers.
    if (strike) {
      state.setDeadline('rapacious', event.at + cooldown);
      context.effects.emit({
        kind: 'packet',
        event: buildEngineerStrike(event, {
          skillWeapon: 'Unequipped',
          name: 'Rapacious Strain',
          coefficient: effectNumber(skill, strike, 'coefficient'),
          sourceId: 'engineer.rapacious-strain',
          actorType: ACTOR.EFFECT,
          ownerActorType: ACTOR.PLAYER
        })
      });

      context.effects.emit({
        attribution: { source: 'engineer', sourceId: skill.id, actorType: ACTOR.EFFECT },
        kind: 'announcement',
        cause: event,
        announcement: {
          type: 'trait',
          name: 'Rapacious Strain',
          at: event.at,
          sourceSkill: event.skillName,
          icon: 'https://render.guildwars2.com/file/' + '5B565BA46C111902EE65AB4592590442A5A6E754/3680135.png'
        }
      });
    }
  }
}

/** Exposes Amalgam's resolver reactions keyed by the canonical event hook name. */
export const amalgamResolverEventReactions = Object.freeze({
  damage: reactToAmalgamDamage
});
