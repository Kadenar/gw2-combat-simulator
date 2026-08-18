import { hasTrait as hasGw2Trait } from '../../../../platform/gw2/trait-state.js';
import type { SchedulerRecord, SimulationEvent, Skill } from '../../../../platform/engine/types.js';
import type { ElementalistCastContext, ElementalistSchedulerContext } from '../../types.js';
import {
  ELEMENTALIST_ATTUNEMENTS,
  elementalistCoreState,
  isElementalistAttunement,
  setElementalistAttunementReadyAt,
  type ElementalistAttunement
} from '../../core/state.js';
import { elementalistAttunementRechargeDuration } from '../../core/attunements.js';
import { emitElementalistBuff } from '../../core/mechanics.js';
import {
  grantElementalistRockSolid,
  triggerElementalistEarthenBlast,
  triggerElementalistElectricDischarge,
  triggerElementalistSunspot
} from '../../core/traits.js';
import {
  ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as CORE_PROFILE,
  elementalistBalanceEffect,
  elementalistBalanceValue
} from '../../core/profiles.js';
import { OFF_ATTUNEMENT_RECHARGE_SECONDS } from './constants.js';
import { type EvokerState } from './state.js';
import { EVOKER_BALANCE_PROFILE_IDS as PROFILE } from './profiles.js';
import { TEMPEST_BALANCE_PROFILE_IDS as TEMPEST_PROFILE } from '../tempest/profiles.js';

function hasTrait(context: unknown, trait: string): boolean {
  return hasGw2Trait(context as never, trait);
}

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
            elementalistBalanceValue(context, PROFILE.resources, 'recharge', OFF_ATTUNEMENT_RECHARGE_SECONDS)
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
        elementalistBalanceValue(context, PROFILE.resources, 'recharge', OFF_ATTUNEMENT_RECHARGE_SECONDS)
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
  const core = elementalistCoreState(context as unknown as SchedulerRecord);
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
    triggerElementalistSunspot(context as never, at, skill.id);
  } else if (element === 'Air') {
    triggerElementalistElectricDischarge(context as never, at, skill.id);
    if (hasTrait(context, 'One with Air')) {
      const superspeed = elementalistBalanceEffect(context, CORE_PROFILE.oneWithAir, 'boon', 'Superspeed');
      emitElementalistBuff(
        context as never,
        at,
        String(superspeed?.boon || 'Superspeed'),
        Number(superspeed?.stacks ?? 1),
        Number(superspeed?.duration ?? 3),
        skill.name,
        skill.id
      );
    }
    if (hasTrait(context, 'Inscription')) {
      const resistance = elementalistBalanceEffect(context, CORE_PROFILE.inscription, 'boon', 'Air Entry');
      emitElementalistBuff(
        context as never,
        at,
        String(resistance?.boon || 'Resistance'),
        Number(resistance?.stacks ?? 1),
        Number(resistance?.duration ?? 3),
        skill.name,
        skill.id
      );
    }
    if (hasTrait(context, 'Fresh Air')) {
      const freshAir = elementalistBalanceEffect(context, CORE_PROFILE.freshAir, 'buff');
      emitElementalistBuff(
        context as never,
        at,
        String(freshAir?.kind || 'Fresh Air'),
        Number(freshAir?.stacks ?? 1),
        Number(freshAir?.duration ?? 5),
        skill.name,
        skill.id
      );
    }
  } else if (element === 'Water' && hasTrait(context, 'Latent Stamina')) {
    if (Number(core.procReadyAt.latentStamina || 0) <= at + context.epsilon) {
      core.procReadyAt.latentStamina =
        at + elementalistBalanceValue(context, TEMPEST_PROFILE.latentStamina, 'internalCooldown', 10);
      const vigor = elementalistBalanceEffect(context, TEMPEST_PROFILE.latentStamina, 'boon', 'Vigor');
      emitElementalistBuff(
        context as never,
        at,
        String(vigor?.boon || 'Vigor'),
        Number(vigor?.stacks ?? 1),
        Number(vigor?.duration ?? 3),
        'Latent Stamina',
        skill.id
      );
    }
  } else if (element === 'Earth') {
    triggerElementalistEarthenBlast(context as never, at, skill.id);
    grantElementalistRockSolid(context as never, at, skill.id);
  }
}
