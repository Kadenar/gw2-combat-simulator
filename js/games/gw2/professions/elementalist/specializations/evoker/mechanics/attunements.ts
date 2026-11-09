/**
 * Applies Evoker attunement rules to the Core Elementalist system. Evocation's shared internal cooldown gates
 * Core attunement-entry trait procs. Swaps apply Evoker's off-attunement recharge policy.
 * With Specialized Elements, swapping is disabled. Empowered familiar casts instead trigger entry effects
 * without changing the attunement.
 */
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { balanceNumber } from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { setElementalistAttunementReadyAt } from '#gw2/professions/elementalist/core/mechanics/attunement-cooldowns.js';
import {
  queueElementalistTransition,
  type ElementalistAttunementSwap
} from '#gw2/professions/elementalist/core/mechanics/attunement-transition.js';
import {
  elementalistAttunementRechargeDuration,
  onAttunementComplete,
  targetAttunement,
  type ElementalistAttunementTraitTrigger
} from '#gw2/professions/elementalist/core/mechanics/attunements.js';
import { attunementReentered } from '#gw2/professions/elementalist/core/mechanics/trigger-points.js';
import { ELEMENTALIST_ATTUNEMENTS, type ElementalistAttunement } from '#gw2/professions/elementalist/core/state.js';
import {
  ELEMENTALIST_ATTUNEMENT_SKILL_IDS,
  ELEMENTALIST_TRAIT_IDS as EVOKER_TRAIT
} from '#gw2/professions/elementalist/data/ids.js';
import { evokerState } from '#gw2/professions/elementalist/specializations/evoker/state.js';
import {
  consumeEvokerAttunementTraitCooldown,
  evocationAllowsAttunementTrait
} from '#gw2/professions/elementalist/specializations/evoker/traits/attunement-policy.js';
import type { ElementalistRuntime, ElementalistSkill } from '#gw2/professions/elementalist/types.js';

/** Commit Core state with Evoker's selected entry-trait policy; recharge settles in the deferred phase. */
export function completeEvokerAttunement(
  context: ElementalistRuntime,
  cast: RuntimeCast<ElementalistSkill>,
  skill: Skill
): void {
  const target = targetAttunement(skill);

  if (!target) return;

  const shouldTriggerAttunementTrait = (trigger: ElementalistAttunementTraitTrigger): boolean =>
    evocationAllowsAttunementTrait(context, cast.effectiveEnd, trigger);
  onAttunementComplete(context, cast, skill, target, { shouldTriggerAttunementTrait });
}

/**
 * Rewrites attunement readiness after a swap, giving the elements that were not
 * entered the short Evoker off-attunement recharge while keeping any shorter
 * cooldown that was already running, captured by the actual transition before it changed recharge.
 */
export function applyEvokerAttunementRechargePolicy(
  context: ElementalistRuntime,
  transition: ElementalistAttunementSwap
): void {
  const state = evokerState.from(context.profession);
  const previous = transition.from;
  const target = transition.to;
  const skill = context.helpers.skillsById.get(ELEMENTALIST_ATTUNEMENT_SKILL_IDS[target])!;
  const readyAtBefore = transition.readyAtBefore;

  // only the previously active attunement goes on the off-attunement recharge; others use the default below
  if (previous === state.element) {
    setElementalistAttunementReadyAt(
      context,
      previous,
      Math.max(
        readyAtBefore[previous],
        transition.at +
          elementalistAttunementRechargeDuration(
            context,
            skill,
            balanceNumber(context.helpers, EVOKER_TRAIT.EVOCATION, 'recharge')
          )
      )
    );
  }

  for (const attunement of ELEMENTALIST_ATTUNEMENTS) {
    if (attunement === target || attunement === previous) continue;

    const defaultReadyAt =
      transition.at +
      elementalistAttunementRechargeDuration(
        context,
        skill,
        balanceNumber(context.helpers, EVOKER_TRAIT.EVOCATION, 'recharge')
      );
    const existingReadyAt = readyAtBefore[attunement];
    const preservedRemaining = Math.max(0, existingReadyAt - transition.at);
    // if the attunement already had less time left than the new default, keep the shorter timer
    const nextReadyAt =
      preservedRemaining > 0 && preservedRemaining < defaultReadyAt - transition.at
        ? transition.at + preservedRemaining
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
  queueElementalistTransition(context, {
    kind: 'reentry',
    at,
    source: skill.name,
    sourceId: skill.id,
    to: element
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
