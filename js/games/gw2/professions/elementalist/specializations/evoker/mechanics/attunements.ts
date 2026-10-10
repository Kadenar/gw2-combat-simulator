import type { SimulationEvent } from '#gw2/platform/events/events.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { attunementReentered } from '#gw2/professions/elementalist/core/mechanics/attunement-triggers.js';
import {
  targetAttunement,
  type ElementalistAttunementTraitTrigger
} from '#gw2/professions/elementalist/core/mechanics/attunements.js';
import { type ElementalistAttunement } from '#gw2/professions/elementalist/core/state.js';
import { EVOKER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/specializations/evoker/mechanics/constants.js';
import type { ElementalistRuntime, ElementalistSkill } from '#gw2/professions/elementalist/types.js';

/**
 * Evoker attunement behaviour layered over the Core Elementalist system.
 *
 * Three responsibilities: gate Core's attunement-entry trait procs behind
 * Evocation's shared internal cooldown, apply Evoker's own off-attunement
 * recharge policy after a swap, and - under Specialized Elements, where swapping
 * is disabled - fire the entry effects from empowered familiar casts without any
 * attunement actually changing.
 */
import {
  elementalistAttunementRechargeDuration,
  onAttunementComplete
} from '#gw2/professions/elementalist/core/mechanics/attunements.js';
import {
  ELEMENTALIST_ATTUNEMENTS,
  isElementalistAttunement,
  setElementalistAttunementReadyAt
} from '#gw2/professions/elementalist/core/state.js';
import { ELEMENTALIST_ATTUNEMENT_SKILL_IDS } from '#gw2/professions/elementalist/data/ids.js';
import {
  consumeEvokerAttunementTraitCooldown,
  evocationAllowsAttunementTrait
} from '#gw2/professions/elementalist/specializations/evoker/traits/attunement-policy.js';
import { type EvokerState } from '#gw2/professions/elementalist/specializations/evoker/state.js';

/**
 * Runs Core's attunement completion with Evoker's proc policy attached, and
 * reports whether the skill was an attunement swap at all so the caller can tell
 * Core the transition is already handled.
 */
export function completeEvokerAttunement(
  context: ElementalistRuntime,
  cast: RuntimeCast<ElementalistSkill>,
  skill: Skill
): boolean {
  const target = targetAttunement(skill);
  if (!target) return false;

  const shouldTriggerAttunementTrait = (trigger: ElementalistAttunementTraitTrigger): boolean =>
    evocationAllowsAttunementTrait(context, cast.effectiveEnd, trigger);
  onAttunementComplete(context, cast, skill, target, { shouldTriggerAttunementTrait });
  return true;
}

/**
 * Rewrites attunement readiness after a swap, giving the elements that were not
 * entered the short Evoker off-attunement recharge while keeping any shorter
 * cooldown that was already running, captured by the actual transition before it changed recharge.
 */
export function applyEvokerAttunementRechargePolicy(
  context: ElementalistRuntime,
  event: SimulationEvent,
  state: EvokerState
): void {
  if (
    event.type !== 'elementalist.attunement' ||
    !isElementalistAttunement(event.from) ||
    !isElementalistAttunement(event.to)
  ) {
    return;
  }

  const previous = event.from;
  const target = event.to;
  const skill = context.helpers.skillsById.get(ELEMENTALIST_ATTUNEMENT_SKILL_IDS[target])!;
  const readyAtBefore =
    event.attunementReadyAtBefore && typeof event.attunementReadyAtBefore === 'object'
      ? (event.attunementReadyAtBefore as Partial<Record<ElementalistAttunement, number>>)
      : {};

  // only the previously active attunement goes on the off-attunement recharge; others use the default below
  if (previous === state.element) {
    const resourcesProfile = requireBalanceProfileFromContext(context, PROFILE.resources);
    setElementalistAttunementReadyAt(
      context,
      previous,
      Math.max(
        readyAtBefore[previous] || 0,
        event.at +
          elementalistAttunementRechargeDuration(context, skill, balanceProfileNumber(resourcesProfile, 'recharge'))
      )
    );
  }

  for (const attunement of ELEMENTALIST_ATTUNEMENTS) {
    if (attunement === target || attunement === previous) continue;
    const resourcesProfile = requireBalanceProfileFromContext(context, PROFILE.resources);
    const defaultReadyAt =
      event.at +
      elementalistAttunementRechargeDuration(context, skill, balanceProfileNumber(resourcesProfile, 'recharge'));
    const existingReadyAt = readyAtBefore[attunement] || 0;
    const preservedRemaining = Math.max(0, existingReadyAt - event.at);
    // if the attunement already had less time left than the new default, keep the shorter timer
    const nextReadyAt =
      preservedRemaining > 0 && preservedRemaining < defaultReadyAt - event.at
        ? event.at + preservedRemaining
        : Math.max(existingReadyAt, defaultReadyAt);
    setElementalistAttunementReadyAt(context, attunement, nextReadyAt);
  }
}

// fires the attunement-enter effects for Specialized Elements without actually swapping attunement
export function reenterEvokerAttunement(
  context: ElementalistRuntime,
  cast: RuntimeCast<ElementalistSkill>,
  skill: Skill,
  element: ElementalistAttunement
): void {
  const at = cast.effectiveEnd;
  context.effects.emit({
    kind: 'packet',
    event: {
      type: 'elementalist.attunement-enter',
      at,
      source: skill.name,
      sourceId: skill.id,
      actorType: 'player',
      skillName: skill.name,
      to: element
    }
  });
  // Familiar entries share the profile claim only after compiled selection and isolation gates.
  const claimTrait = (_attunement: ElementalistAttunement, profileId: Skill['id']): boolean =>
    consumeEvokerAttunementTraitCooldown(context, at, profileId);

  context.fireTrigger(attunementReentered, {
    at,
    skill,
    target: element,
    claimTrait,
    emissionCast: { activationId: cast.id, skillId: cast.skill.id, offTarget: cast.command.offTarget }
  });
}
