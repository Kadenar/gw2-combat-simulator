import { professionCoreState } from '../../../platform/engine/profession.js';
/**
 * Revenant weapon-chain and temporary flip state.
 *
 * Advances canonical autoattack chains after casts and resets them on
 * interrupting actions. It also owns Imperial Guard's blocking window, the
 * temporary True Strike flip, and the typed task that expires that follow-up.
 */
import { REVENANT_SKILL_IDS as ID } from '../data/ids.js';
import { emitRevenantState } from './shared.js';
import type {
  RevenantCastContext,
  RevenantScheduledTask,
  RevenantSchedulerContext,
  RevenantSimulationEvent,
  RevenantSkill
} from '../types.js';

/** Advances or resets the active weapon autoattack chain after a cast. */
export function updateRevenantWeaponState(context: RevenantCastContext, skill: RevenantSkill): void {
  const state = professionCoreState(context);
  if (context.action?.cancelled === true) return;
  if (skill.id === ID.ABYSSAL_STRIKE) {
    state.abyssalStrikeSecondCast = !state.abyssalStrikeSecondCast;
  } else if (skill.type === 'Weapon' || Number(skill.castTimeMs || 0) > 0) {
    state.abyssalStrikeSecondCast = false;
  }
  const chain = context.catalog.autoattackChainPositions.get(Number(skill.id));
  if (chain) {
    if (chain.next == null) delete state.autoattackChains[chain.root];
    else state.autoattackChains[chain.root] = chain.next;
  } else if (
    skill.id === ID.DODGE ||
    skill.id === ID.CITADEL_BOMBARDMENT ||
    skill.handlerId === 'revenant.beguiling-haze'
  ) {
    state.autoattackChains = {};
  } else if (skill.id !== ID.TEMPORAL_RIFT && skill.type === 'Weapon') {
    state.autoattackChains = {};
  }
}

/** Resets Coalescence of Ruin when Drop the Hammer's delayed strike lands. */
export function observeRevenantWeaponEvent(context: RevenantSchedulerContext, event: RevenantSimulationEvent): void {
  if (event.type !== 'damage' || event.skillId !== ID.DROP_THE_HAMMER || Number(event.coefficient || 0) <= 0) {
    return;
  }
  context.tasks.schedule({
    id: `revenant.drop-the-hammer-reset:${event.__order}`,
    type: 'revenant.drop-the-hammer-reset',
    at: event.at,
    payload: {}
  });
}

/** Applies Drop the Hammer's on-hit Coalescence recharge. */
export function resetCoalescenceOfRuin(context: RevenantSchedulerContext, _task: RevenantScheduledTask): void {
  context.state.cooldowns.delete(ID.COALESCENCE_OF_RUIN);
}

const IMPERIAL_GUARD_OWNER = 'revenant.imperial-guard';

/** Arms True Strike and emits Imperial Guard's blocking window at cast start. */
export function beginRevenantWeaponCast(context: RevenantCastContext, skill: RevenantSkill): void {
  if (skill.id !== ID.IMPERIAL_GUARD) return;
  professionCoreState(context).availableFlips[ID.TRUE_STRIKE] = true;
  context.emit({
    type: 'buff',
    at: context.start,
    source: 'revenant',
    sourceId: skill.id,
    actorType: 'player',
    skillId: skill.id,
    skillName: skill.name,
    name: 'Imperial Guard — Blocking',
    kind: 'blocking',
    duration: Math.max(0, context.effectiveEnd - context.start),
    stacks: 1
  });
  emitRevenantState(context, context.start, 'imperial-guard');
}

/** Commits or consumes the Imperial Guard/True Strike temporary flip. */
export function completeRevenantWeaponCast(context: RevenantCastContext, skill: RevenantSkill): void {
  const state = professionCoreState(context);
  if (skill.id === ID.IMPERIAL_GUARD) {
    context.tasks.cancelOwner(IMPERIAL_GUARD_OWNER);
    context.tasks.schedule({
      type: 'revenant.imperial-guard-expire',
      at: context.effectiveEnd + 4,
      ownerId: IMPERIAL_GUARD_OWNER,
      payload: {}
    });
    emitRevenantState(context, context.effectiveEnd, 'imperial-guard');
  } else if (skill.id === ID.TRUE_STRIKE) {
    delete state.availableFlips[ID.TRUE_STRIKE];
    context.tasks.cancelOwner(IMPERIAL_GUARD_OWNER);
    emitRevenantState(context, context.effectiveEnd, 'true-strike');
  }
}

/** Removes True Strike when the scheduled Imperial Guard window expires. */
export function expireImperialGuard(context: RevenantSchedulerContext, task: RevenantScheduledTask): void {
  delete professionCoreState(context).availableFlips[ID.TRUE_STRIKE];
  emitRevenantState(context, task.at, 'imperial-guard-expired');
}
