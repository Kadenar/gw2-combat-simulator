import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
/**
 * Owns Core Elementalist attunement selection, recharge, and cast-completion transitions.
 * Specializations may intercept the shared hooks but keep their extra state locally.
 */
import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import type { ElementalistRuntime } from '#gw2/professions/elementalist/types.js';
import {
  ELEMENTALIST_ATTUNEMENTS,
  setElementalistAttunementReadyAt,
  type ElementalistAttunement
} from '#gw2/professions/elementalist/core/state.js';
import {
  ELEMENTALIST_ATTUNEMENT_SKILL_IDS,
  ELEMENTALIST_TRAIT_IDS as TRAIT
} from '#gw2/professions/elementalist/data/ids.js';
import { combatStarted } from '#gw2/professions/elementalist/core/mechanics/effects.js';
import { applyElementalistAttunementTraits } from '#gw2/professions/elementalist/core/traits/index.js';
import {
  inFlightAutoattackCarryover,
  progressedAutoattackCarryover
} from '#gw2/professions/elementalist/core/mechanics/weapon-state.js';
import { ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/core/profiles.js';

/** Identifies one shared attunement-entry trait effect so a specialization can veto it. */
export interface ElementalistAttunementTraitTrigger {
  readonly attunement: ElementalistAttunement;
  readonly profileId: Skill['id'];
}

/**
 * Specialization-supplied overrides for a single attunement swap: the secondary
 * attunement to report, a replacement recharge policy, and a trait-effect veto.
 */
export interface ElementalistAttunementTransition {
  readonly secondaryAttunement?: ElementalistAttunement | null;
  readonly rechargeDuration?: number;
  readonly shouldTriggerAttunementTrait?: (trigger: ElementalistAttunementTraitTrigger) => boolean;
}

/** Maps an attunement-swap skill to the attunement it enters, or null for any other skill. */
export function targetAttunement(skill: Skill): ElementalistAttunement | null {
  return (
    ELEMENTALIST_ATTUNEMENTS.find((attunement) => ELEMENTALIST_ATTUNEMENT_SKILL_IDS[attunement] === skill.id) ?? null
  );
}

/** Keeps precombat swaps free; Elemental Enchantment scales recharge before Flow State subtracts its flat reduction. */
export function elementalistAttunementRechargeDuration(
  context: ElementalistRuntime,
  skill: Skill,
  seconds: number
): number {
  if (!context.combatActive) return 0;
  let adjusted = seconds;
  // Trait reductions also apply when Weaver supplies Weave Self's shorter base recharge.
  if (hasTrait(context, 'Elemental Enchantment')) {
    const elementalEnchantmentProfile = requireBalanceProfileFromContext(context, PROFILE.elementalEnchantment);
    adjusted *= balanceProfileNumber(elementalEnchantmentProfile, 'rechargeMultiplier');
  }

  if (hasTrait(context, TRAIT.FLOW_STATE)) {
    const flowStateProfile = requireBalanceProfileFromContext(context, TRAIT.FLOW_STATE);
    adjusted = Math.max(0, adjusted - balanceProfileNumber(flowStateProfile, 'rechargeReduction'));
  }

  return adjusted / context.cooldownController.rate(skill);
}

/**
 * Commits a completed attunement swap: carries autoattack chain progress across
 * the swap, arms the attunement recharges, publishes the attunement and sigil
 * swap events, and fires the shared on-entry trait effects once combat started.
 */
export function onAttunementComplete(
  context: ElementalistRuntime,
  cast: RuntimeCast,
  skill: Skill,
  target: ElementalistAttunement,
  transition: ElementalistAttunementTransition = {}
): void {
  const state = professionCoreState(context);
  const at = cast.effectiveEnd;
  const previous = state.primaryAttunement;
  const attunementReadyAtBefore = Object.fromEntries(
    ELEMENTALIST_ATTUNEMENTS.map((element) => [
      element,
      context.cooldowns.get(ELEMENTALIST_ATTUNEMENT_SKILL_IDS[element]) ?? 0
    ])
  );
  // Preserve chain progress for the attunement being left; a cast still in flight
  // is only held as pending until it commits.
  state.autoattackCarryover = progressedAutoattackCarryover(context, cast, state, previous);
  state.pendingAutoattackCarryover = state.autoattackCarryover
    ? null
    : inFlightAutoattackCarryover(context, cast, previous);
  // Specializations may supply their own transition and recharge policy while Core keeps shared entry effects here.
  const dualAttunement = transition.rechargeDuration != null;
  if (dualAttunement) {
    state.primaryAttunement = target;
    const recharge = Number(transition.rechargeDuration);
    for (const attunement of ELEMENTALIST_ATTUNEMENTS) {
      setElementalistAttunementReadyAt(context, attunement, at + recharge);
    }
  } else {
    state.primaryAttunement = target;
    const resourcesProfile = requireBalanceProfileFromContext(context, PROFILE.resources);
    // Single swap: the attunement just left takes the full recharge, while the two
    // untouched attunements only serve the short off-attunement delay.
    setElementalistAttunementReadyAt(
      context,
      previous,
      Math.max(
        attunementReadyAtBefore[previous],
        at + elementalistAttunementRechargeDuration(context, skill, balanceProfileNumber(resourcesProfile, 'recharge'))
      )
    );
    for (const attunement of ELEMENTALIST_ATTUNEMENTS) {
      if (attunement === target || attunement === previous) continue;
      const existingReadyAt = attunementReadyAtBefore[attunement];
      const defaultReadyAt =
        at +
        elementalistAttunementRechargeDuration(context, skill, balanceProfileNumber(resourcesProfile, 'initialDelay'));
      // Pending hits may reset Air later; they cannot shorten an actual cooldown before resolving.
      const nextReadyAt = Math.max(existingReadyAt, defaultReadyAt);
      setElementalistAttunementReadyAt(context, attunement, nextReadyAt);
    }
  }

  // Publish the swap for the resolver and presentation, then trigger weapon sigils.
  state.attunementEnteredAt = at;
  context.emit({
    type: 'elementalist.attunement',
    at,
    priority: -20,
    source: skill.name,
    sourceId: skill.id,
    actorType: 'player',
    skillId: skill.id,
    skillName: skill.name,
    from: previous,
    to: target,
    secondaryAttunement: transition.secondaryAttunement ?? null,
    attunementReadyAtBefore
  });
  context.emit({
    type: 'sigil_swap',
    at,
    source: skill.name,
    sourceId: skill.id,
    actorType: 'player',
    skillId: skill.id,
    skillName: skill.name
  });
  // Pre-combat swaps still move state and timers but grant no trait effects.
  if (!combatStarted(context, at)) return;

  // Specializations can gate shared attunement-trait effects without Core inspecting specialization state or policy.
  const shouldTriggerAttunementTrait = (attunement: ElementalistAttunement, profileId: Skill['id']): boolean =>
    transition.shouldTriggerAttunementTrait?.({ attunement, profileId }) !== false;

  applyElementalistAttunementTraits(context, {
    at,
    skill,
    previous,
    target,
    dualAttunement,
    shouldTrigger: shouldTriggerAttunementTrait
  });
}

const transitions = new WeakMap<ElementalistRuntime, (runtime: ElementalistRuntime, cast: RuntimeCast) => void>();
/** Weaver and Evoker install their attunement transition before any commands execute. */
export function registerElementalistAttunementTransition(
  runtime: ElementalistRuntime,
  transition: (runtime: ElementalistRuntime, cast: RuntimeCast) => void
): void {
  transitions.set(runtime, transition);
}

/** Core commits exactly one transition, including an elite's dual-attunement policy. */
export function completeElementalistAttunement(runtime: ElementalistRuntime, cast: RuntimeCast): void {
  const transition = transitions.get(runtime);
  if (transition) transition(runtime, cast);
  else {
    const target = targetAttunement(cast.skill);
    if (target) onAttunementComplete(runtime, cast, cast.skill, target);
  }
}
