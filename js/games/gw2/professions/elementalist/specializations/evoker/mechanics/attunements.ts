import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
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
  requireBalanceProfileFromContext,
  balanceProfileNumber,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { emitElementalistBuff } from '#gw2/professions/elementalist/core/events.js';
import { tryConsumeProcCooldown } from '#gw2/platform/combat/procs.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import type { ElementalistRuntime } from '#gw2/professions/elementalist/types.js';
import {
  ELEMENTALIST_ATTUNEMENTS,
  isElementalistAttunement,
  setElementalistAttunementReadyAt,
  type ElementalistAttunement
} from '#gw2/professions/elementalist/core/state.js';
import {
  elementalistAttunementRechargeDuration,
  onAttunementComplete,
  targetAttunement,
  type ElementalistAttunementTraitTrigger
} from '#gw2/professions/elementalist/core/mechanics/attunements.js';
import {
  grantElementalistRockSolid,
  triggerEarthenBlast,
  triggerElectricDischarge,
  triggerSunspot
} from '#gw2/professions/elementalist/core/traits/index.js';
import { applyInscriptionAirEntry, applyOneWithAir } from '#gw2/professions/elementalist/core/traits/air.js';
import { ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as CORE_PROFILE } from '#gw2/professions/elementalist/core/profiles.js';
import { evokerState, type EvokerState } from '#gw2/professions/elementalist/specializations/evoker/state.js';
import { EVOKER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/specializations/evoker/profiles.js';
import { ELEMENTALIST_ATTUNEMENT_SKILL_IDS } from '#gw2/professions/elementalist/data/ids.js';

// Evocation's five-second trait ICD applies to some Fire and Earth entry effects
const EVOKER_ATTUNEMENT_TRAIT_ICD_PROFILES = new Set<Skill['id']>([
  CORE_PROFILE.sunspot,
  CORE_PROFILE.pyromancersPuissance,
  CORE_PROFILE.earthenBlast,
  CORE_PROFILE.rockSolid
]);

// reports whether the trait may proc now, arming its next Evocation ICD window when it may
function consumeEvokerAttunementTraitCooldown(
  context: ElementalistRuntime,
  state: EvokerState,
  at: number,
  profileId: Skill['id']
): boolean {
  const evocationProfile = requireBalanceProfileFromContext(context, PROFILE.evocation);
  // Both real and familiar-triggered entries share a per-profile claim before downstream effects.
  return tryConsumeProcCooldown(
    state.attunementTraitProcReadyAt,
    String(profileId),
    at,
    balanceProfileNumber(evocationProfile, 'internalCooldown')
  );
}

/**
 * Runs Core's attunement completion with Evoker's proc policy attached, and
 * reports whether the skill was an attunement swap at all so the caller can tell
 * Core the transition is already handled.
 */
export function completeEvokerAttunement(context: ElementalistRuntime, cast: RuntimeCast, skill: Skill): boolean {
  const target = targetAttunement(skill);
  if (!target) return false;

  const state = evokerState.from(context);
  const at = cast.effectiveEnd;
  // Apply each configured ICD only when its element is the Evoker's selected specialization.
  const shouldTriggerAttunementTrait = ({ attunement, profileId }: ElementalistAttunementTraitTrigger): boolean =>
    !EVOKER_ATTUNEMENT_TRAIT_ICD_PROFILES.has(profileId) ||
    state.element !== attunement ||
    consumeEvokerAttunementTraitCooldown(context, state, at, profileId);

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
        Number(readyAtBefore[previous] || 0),
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
    const existingReadyAt = Number(readyAtBefore[attunement] || 0);
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
export function triggerSpecializedElementEntry(
  context: ElementalistRuntime,
  cast: RuntimeCast,
  skill: Skill,
  element: ElementalistAttunement
): void {
  const at = cast.effectiveEnd;
  const state = evokerState.from(context);
  const procReady = (profileId: Skill['id']): boolean =>
    consumeEvokerAttunementTraitCooldown(context, state, at, profileId);

  context.emit({
    type: 'elementalist.attunement-enter',
    at,
    source: skill.name,
    sourceId: skill.id,
    actorType: 'player',
    skillName: skill.name,
    to: element
  });
  if (element === 'Fire') {
    if (hasTrait(context, 'Sunspot') && procReady(CORE_PROFILE.sunspot)) {
      triggerSunspot(context, at, skill.id);
    }
  } else if (element === 'Air') {
    triggerElectricDischarge(context, at, skill.id);
    // Synthetic entry shares the Air grants; Fresh Air below has its own entry semantics.
    applyOneWithAir(context, at, skill);
    applyInscriptionAirEntry(context, at, skill);

    if (hasTrait(context, 'Fresh Air')) {
      const freshAirProfile = requireBalanceProfileFromContext(context, CORE_PROFILE.freshAir);
      const freshAir = requireEffect(freshAirProfile, 'buff', 'fresh-air');
      if (freshAir) {
        emitElementalistBuff(context, {
          skill: skill,
          at,
          source: skill.name,
          sourceId: skill.id,
          actorType: 'player',
          kind: String(freshAir.kind).toLowerCase(),
          stacks: Number(freshAir.stacks),
          duration: Number(freshAir.duration),
          skillName: skill.name
        });
      }
    }
  } else if (element === 'Earth') {
    if (hasTrait(context, 'Earthen Blast') && procReady(CORE_PROFILE.earthenBlast)) {
      triggerEarthenBlast(context, at, skill.id);
    }

    if (hasTrait(context, 'Rock Solid') && procReady(CORE_PROFILE.rockSolid)) {
      grantElementalistRockSolid(context, at, skill.id);
    }
  }
}
