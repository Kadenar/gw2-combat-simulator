/** Evoker trait and enchantment reactions consume actual transitions and accepted impacts. */
import { ACTOR, BOON } from '#gw2/platform/constants.js';
import { requireSkillAction } from '#gw2/platform/effects/actions.js';
import type { SimulationEvent } from '#gw2/platform/events/events.js';
import { requireEffect, requireSkillFromContext, skillNumber } from '#gw2/platform/skills/balance-profiles.js';
import { elementalistBuffEffectRequest } from '#gw2/professions/elementalist/core/mechanics/effects.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import { applyEvokerAttunementRechargePolicy } from '#gw2/professions/elementalist/specializations/evoker/mechanics/attunements.js';
import { consumeElectricEnchantment } from '#gw2/professions/elementalist/specializations/evoker/mechanics/electric-enchantment.js';
import {
  evokerEntryObserved,
  evokerEventAccepted
} from '#gw2/professions/elementalist/specializations/evoker/mechanics/trigger-points.js';
import { evokerState } from '#gw2/professions/elementalist/specializations/evoker/state.js';
import type { ElementalistRuntime } from '#gw2/professions/elementalist/types.js';

/** Accepted player disables trigger the equipped Earth familiar's personal boon at most once per interval. */
export function applyCalcifyProtection(context: ElementalistRuntime, event: SimulationEvent): void {
  if (event.type !== 'control' || event.actorType !== ACTOR.PLAYER || evokerState.from(context).element !== 'Earth')
    return;

  const skill = requireSkillFromContext(context, ID.CALCIFY);
  const action = requireSkillAction(skill, 'protection');

  if (!requireEffect(skill, 'boon', BOON.PROTECTION, action)) return;

  if (
    !context.procs.claimCooldown('elementalist.evoker.calcifyPassive', event.at, skillNumber(skill, 'internalCooldown'))
  )
    return;

  context.effects.emit(
    elementalistBuffEffectRequest(context, event.at, { skill, action }, BOON.PROTECTION, 'Calcify', ID.CALCIFY)
  );
}

/** Applies familiar, enchantment, and attunement-entry rewards at their actual event boundary. */
export function onAcceptedEvent(context: ElementalistRuntime, event: SimulationEvent): void {
  const state = evokerState.from(context);
  applyEvokerAttunementRechargePolicy(context, event, state);
  context.fireTrigger(evokerEventAccepted, { event });

  // Spend an enchantment only after the shared runtime accepts this player hit.
  if (event.type === 'damage' && event.actorType === ACTOR.PLAYER && Number(event.coefficient) > 0) {
    consumeElectricEnchantment(context, event);
  }

  context.fireTrigger(evokerEntryObserved, { event });
}
