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
  balanceProfileEffectFromContext,
  balanceProfileValueFromContext
} from '#gw2/platform/combat/state/balance-profiles.js';
import { emitSkillBuff } from '#gw2/platform/scheduler/skill-events.js';
import { isInternalCooldownReady } from '#kernel/core/clock.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import type { SimulationEvent, Skill } from '#gw2/platform/engine/types.js';
import type { ElementalistCastContext, ElementalistSchedulerContext } from '#gw2/professions/elementalist/types.js';
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
import { ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as CORE_PROFILE } from '#gw2/professions/elementalist/core/profiles.js';
import { OFF_ATTUNEMENT_RECHARGE_SECONDS } from '#gw2/professions/elementalist/specializations/evoker/mechanics/constants.js';
import { evokerState, type EvokerState } from '#gw2/professions/elementalist/specializations/evoker/state.js';
import { EVOKER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/specializations/evoker/profiles.js';

// Evocation's five-second trait ICD applies to some Fire and Earth entry effects
const EVOKER_ATTUNEMENT_TRAIT_ICD_PROFILES = new Set<Skill['id']>([
  CORE_PROFILE.sunspot,
  CORE_PROFILE.pyromancersPuissance,
  CORE_PROFILE.earthenBlast,
  CORE_PROFILE.rockSolid
]);

// reports whether the trait may proc now, arming its next Evocation ICD window when it may
function consumeEvokerAttunementTraitCooldown(
  context: ElementalistSchedulerContext,
  state: EvokerState,
  at: number,
  profileId: Skill['id']
): boolean {
  const key = String(profileId);
  if (!isInternalCooldownReady(at, Number(state.attunementTraitProcReadyAt[key] || 0))) return false;

  // Evoker owns the shared per-trait timer used by both real and familiar-triggered attunement entries.
  state.attunementTraitProcReadyAt[key] =
    at + balanceProfileValueFromContext(context, PROFILE.evocation, 'internalCooldown', 5);
  return true;
}

/**
 * Runs Core's attunement completion with Evoker's proc policy attached, and
 * reports whether the skill was an attunement swap at all so the caller can tell
 * Core the transition is already handled.
 */
export function completeEvokerAttunement(context: ElementalistCastContext, skill: Skill): boolean {
  const target = targetAttunement(skill);
  if (!target) return false;

  const state = evokerState.from(context);
  const at = context.effectiveEnd;
  // Apply each configured ICD only when its element is the Evoker's selected specialization.
  const shouldTriggerAttunementTrait = ({ attunement, profileId }: ElementalistAttunementTraitTrigger): boolean =>
    !EVOKER_ATTUNEMENT_TRAIT_ICD_PROFILES.has(profileId) ||
    state.element !== attunement ||
    consumeEvokerAttunementTraitCooldown(context as never, state, at, profileId);

  onAttunementComplete(context, skill, target, { shouldTriggerAttunementTrait });
  return true;
}

/**
 * Rewrites attunement readiness after a swap, giving the elements that were not
 * entered the short Evoker off-attunement recharge while keeping any shorter
 * cooldown that was already running (snapshotted by `availability.ts` before the
 * swap fired).
 */
export function applyEvokerAttunementRechargePolicy(
  context: ElementalistSchedulerContext,
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
  const commandIndex = Number(event.commandIndex);
  // snapshot captured by availability.ts before the swap; lets us honor shorter cooldowns already in progress
  const preserved = state.pendingOffAttunementRemainingByCommand[commandIndex] || {};
  delete state.pendingOffAttunementRemainingByCommand[commandIndex];
  const readyAtBefore =
    event.attunementReadyAtBefore && typeof event.attunementReadyAtBefore === 'object'
      ? (event.attunementReadyAtBefore as Partial<Record<ElementalistAttunement, number>>)
      : {};

  // only the previously active attunement goes on the off-attunement recharge; others use the default below
  if (previous === state.element) {
    setElementalistAttunementReadyAt(
      context,
      previous,
      Math.max(
        Number(readyAtBefore[previous] || 0),
        event.at +
          elementalistAttunementRechargeDuration(
            context as never,
            balanceProfileValueFromContext(context, PROFILE.resources, 'recharge', OFF_ATTUNEMENT_RECHARGE_SECONDS)
          )
      )
    );
  }

  for (const attunement of ELEMENTALIST_ATTUNEMENTS) {
    if (attunement === target || attunement === previous) continue;
    const defaultReadyAt =
      event.at +
      elementalistAttunementRechargeDuration(
        context as never,
        balanceProfileValueFromContext(context, PROFILE.resources, 'recharge', OFF_ATTUNEMENT_RECHARGE_SECONDS)
      );
    const existingReadyAt = Number(readyAtBefore[attunement] || 0);
    const preservedRemaining = Number(preserved[attunement] || 0);
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
  context: ElementalistCastContext,
  skill: Skill,
  element: ElementalistAttunement
): void {
  const at = context.effectiveEnd;
  const state = evokerState.from(context);
  const procReady = (profileId: Skill['id']): boolean =>
    consumeEvokerAttunementTraitCooldown(context as never, state, at, profileId);

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
      triggerSunspot(context as never, at, skill.id);
    }
  } else if (element === 'Air') {
    triggerElectricDischarge(context as never, at, skill.id);
    if (hasTrait(context, 'One with Air')) {
      const superspeed = balanceProfileEffectFromContext(context, CORE_PROFILE.oneWithAir, 'buff', 0, 'Superspeed');
      emitSkillBuff(context, skill, {
        at,
        source: skill.name,
        sourceId: skill.id,
        actorType: 'player',
        kind: String(superspeed?.kind || 'Superspeed').toLowerCase(),
        stacks: Number(superspeed?.stacks ?? 1),
        duration: Number(superspeed?.duration ?? 3),
        skillName: skill.name
      });
    }

    if (hasTrait(context, 'Inscription')) {
      const resistance = balanceProfileEffectFromContext(context, CORE_PROFILE.inscription, 'boon', 0, 'Air Entry');
      emitSkillBuff(context, skill, {
        at,
        source: skill.name,
        sourceId: skill.id,
        actorType: 'player',
        kind: String(resistance?.boon || 'Resistance').toLowerCase(),
        stacks: Number(resistance?.stacks ?? 1),
        duration: Number(resistance?.duration ?? 3),
        skillName: skill.name
      });
    }

    if (hasTrait(context, 'Fresh Air')) {
      const freshAir = balanceProfileEffectFromContext(context, CORE_PROFILE.freshAir, 'buff');
      emitSkillBuff(context, skill, {
        at,
        source: skill.name,
        sourceId: skill.id,
        actorType: 'player',
        kind: String(freshAir?.kind || 'Fresh Air').toLowerCase(),
        stacks: Number(freshAir?.stacks ?? 1),
        duration: Number(freshAir?.duration ?? 5),
        skillName: skill.name
      });
    }
  } else if (element === 'Earth') {
    if (hasTrait(context, 'Earthen Blast') && procReady(CORE_PROFILE.earthenBlast)) {
      triggerEarthenBlast(context as never, at, skill.id);
    }

    if (hasTrait(context, 'Rock Solid') && procReady(CORE_PROFILE.rockSolid)) {
      grantElementalistRockSolid(context as never, at, skill.id);
    }
  }
}
