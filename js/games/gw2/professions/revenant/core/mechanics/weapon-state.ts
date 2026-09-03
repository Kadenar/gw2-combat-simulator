import { emitSkillBuff } from '#gw2/platform/scheduler/skill-events.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { emitRevenantStateSnapshot } from '#gw2/professions/revenant/state.js';
/**
 * Revenant temporary weapon and flip state. The shared GW2 controller owns
 * canonical autoattack chains; this module owns Abyssal Strike, Imperial
 * Guard, True Strike, and the typed tasks that expire those follow-ups.
 */
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import type {
  RevenantCastContext,
  RevenantScheduledTask,
  RevenantSchedulerContext,
  RevenantSimulationEvent,
  RevenantSkill
} from '#gw2/professions/revenant/types.js';

/** Updates the Revenant-specific Abyssal Strike sequence after shared chain handling. */
export function updateRevenantWeaponState(context: RevenantCastContext, skill: RevenantSkill): void {
  const state = professionCoreState(context);
  if (context.action?.cancelled === true) return;
  if (skill.id === ID.ABYSSAL_STRIKE) {
    state.abyssalStrikeSecondCast = !state.abyssalStrikeSecondCast;
  } else if (skill.type === 'Weapon' || Number(skill.castTimeMs || 0) > 0) {
    state.abyssalStrikeSecondCast = false;
  }
}

/** Resets Coalescence of Ruin when Drop the Hammer's delayed strike lands. */
export function observeRevenantWeaponEvent(context: RevenantSchedulerContext, event: RevenantSimulationEvent): void {
  if (event.type !== 'damage' || event.skillId !== ID.DROP_THE_HAMMER || Number(event.coefficient || 0) <= 0) {
    return;
  }

  context.tasks.schedule({
    id: `revenant.drop-the-hammer-reset:${event.eventOrder}`,
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
const WEAPON_FLIP_DURATION_BY_PARENT: Readonly<Record<number, number>> = Object.freeze({
  [ID.BLOSSOMING_AURA]: 4,
  [ID.OTHERWORLDLY_BOND]: 7
});

/** Arms True Strike and emits Imperial Guard's blocking window at cast start. */
export function beginRevenantWeaponCast(context: RevenantCastContext, skill: RevenantSkill): void {
  if (skill.id !== ID.IMPERIAL_GUARD) return;
  professionCoreState(context).availableFlips[ID.TRUE_STRIKE] = true;
  emitSkillBuff(context, {
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
  emitRevenantStateSnapshot(context, context.start, 'imperial-guard');
}

/** Commits or consumes the Imperial Guard/True Strike temporary flip. */
export function completeRevenantWeaponCast(context: RevenantCastContext, skill: RevenantSkill): void {
  const state = professionCoreState(context);
  // Scepter follow-ups share the normal availableFlips state so the scheduler
  // and palette agree on which identity currently occupies each weapon slot.
  if (
    skill.type === 'Weapon' &&
    skill.id !== ID.IMPERIAL_GUARD &&
    skill.flipSkillId != null &&
    skill.flipSkillId !== skill.nextChainId
  ) {
    const flip = context.catalog.skillsById.get(Number(skill.flipSkillId));
    if (flip?.flipParentId === skill.id) {
      state.availableFlips[flip.id] =
        context.effectiveEnd + (WEAPON_FLIP_DURATION_BY_PARENT[Number(skill.id)] || Number(skill.flipDuration || 5));
    }
  }

  if (skill.type === 'Weapon' && skill.id !== ID.TRUE_STRIKE && skill.flipParentId != null) {
    delete state.availableFlips[skill.id];
  }

  if (skill.id === ID.IMPERIAL_GUARD) {
    context.tasks.cancelOwner(IMPERIAL_GUARD_OWNER);
    context.tasks.schedule({
      type: 'revenant.imperial-guard-expire',
      at: context.effectiveEnd + 4,
      ownerId: IMPERIAL_GUARD_OWNER,
      payload: {}
    });
    emitRevenantStateSnapshot(context, context.effectiveEnd, 'imperial-guard');
  } else if (skill.id === ID.TRUE_STRIKE) {
    delete state.availableFlips[ID.TRUE_STRIKE];
    context.tasks.cancelOwner(IMPERIAL_GUARD_OWNER);
    emitRevenantStateSnapshot(context, context.effectiveEnd, 'true-strike');
  }
}

/** Removes True Strike when the scheduled Imperial Guard window expires. */
export function expireImperialGuard(context: RevenantSchedulerContext, task: RevenantScheduledTask): void {
  delete professionCoreState(context).availableFlips[ID.TRUE_STRIKE];
  emitRevenantStateSnapshot(context, task.at, 'imperial-guard-expired');
}
