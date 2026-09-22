import type { ScheduledTask } from '#gw2/platform/execution/types.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import { expireSkillFlip, armSkillFlip, consumeSkillFlip } from '#gw2/platform/engine/skills/skill-flips.js';
import { scheduledReaction } from '#gw2/platform/profession-definition/mechanics.js';
import { emitSkillBuff } from '#gw2/platform/execution/gw2-policy/skill-events.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { emitRevenantStateSnapshot } from '#gw2/professions/revenant/family-state.js';
/**
 * Revenant temporary weapon and flip state. The shared GW2 controller owns
 * canonical autoattack chains; this module owns Imperial Guard, True Strike,
 * and the typed tasks that expire those follow-ups.
 */
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import type { RevenantCastContext, RevenantSchedulerContext, RevenantSkill } from '#gw2/professions/revenant/types.js';

/** Resets Coalescence of Ruin when Drop the Hammer's delayed strike lands. */
export const dropTheHammerReaction = scheduledReaction<
  RevenantSchedulerContext,
  SimulationEvent,
  Record<string, never>
>({
  id: 'revenant.drop-the-hammer-reset',
  order: 0,
  select(_context, event) {
    if (event.type !== 'damage' || event.skillId !== ID.DROP_THE_HAMMER || Number(event.coefficient || 0) <= 0) {
      return null;
    }

    return {
      id: `revenant.drop-the-hammer-reset:${event.eventOrder}`,
      at: event.at,
      payload: {}
    };
  },
  execute(context) {
    context.state.cooldowns.delete(ID.COALESCENCE_OF_RUIN);
  }
});

const IMPERIAL_GUARD_OWNER = 'revenant.imperial-guard';
const WEAPON_FLIP_DURATION_BY_PARENT: Readonly<Record<number, number>> = Object.freeze({
  [ID.OTHERWORLDLY_BOND]: 7
});

/** Arms True Strike and emits Imperial Guard's blocking window at cast start. */
export function beginRevenantWeaponCast(context: RevenantCastContext, skill: RevenantSkill): void {
  if (skill.id !== ID.IMPERIAL_GUARD) return;
  armSkillFlip(
    professionCoreState(context).availableFlips,
    ID.TRUE_STRIKE,
    context.start,
    context.effectiveEnd + 4,
    context.start,
    context.reservationId
  );
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
    skill.id !== ID.BLOSSOMING_AURA &&
    skill.flipSkillId != null &&
    skill.flipSkillId !== skill.nextChainId
  ) {
    const flip = context.catalog.skillsById.get(Number(skill.flipSkillId));
    if (flip?.flipParentId === skill.id) {
      armSkillFlip(
        state.availableFlips,
        flip.id,
        context.effectiveEnd,
        context.effectiveEnd + (WEAPON_FLIP_DURATION_BY_PARENT[Number(skill.id)] || Number(skill.flipDuration ?? 5))
      );
    }
  }

  if (skill.type === 'Weapon' && skill.id !== ID.TRUE_STRIKE && skill.flipParentId != null) {
    consumeSkillFlip(state.availableFlips, skill.id);
  }

  if (skill.id === ID.IMPERIAL_GUARD) {
    context.tasks.cancelOwner(IMPERIAL_GUARD_OWNER);
    context.tasks.schedule({
      type: 'revenant.imperial-guard-expire',
      at: context.effectiveEnd + 4,
      ownerId: IMPERIAL_GUARD_OWNER,
      // The child may already have been consumed during the channel; capture this cast, never a later window.
      payload: { identity: context.reservationId }
    });
    emitRevenantStateSnapshot(context, context.effectiveEnd, 'imperial-guard');
  } else if (skill.id === ID.TRUE_STRIKE) {
    consumeSkillFlip(state.availableFlips, ID.TRUE_STRIKE);
    context.tasks.cancelOwner(IMPERIAL_GUARD_OWNER);
    emitRevenantStateSnapshot(context, context.effectiveEnd, 'true-strike');
  }
}

/** Removes True Strike when the scheduled Imperial Guard window expires. */
export function expireImperialGuard(
  context: RevenantSchedulerContext,
  task: ScheduledTask<{ readonly identity: number | string }>
): void {
  if (task.payload == null) return;
  if (!expireSkillFlip(professionCoreState(context).availableFlips, ID.TRUE_STRIKE, task.at, task.payload.identity))
    return;
  emitRevenantStateSnapshot(context, task.at, 'imperial-guard-expired');
}

/** Legend changes and upkeep starvation clear legend follow-ups while preserving independent weapon effects. */
export function clearRevenantLegendFlips(context: RevenantSchedulerContext): void {
  const state = professionCoreState(context);
  state.availableFlips = Object.fromEntries(
    Object.entries(state.availableFlips).filter(([id]) => context.catalog.skillsById.get(Number(id))?.type === 'Weapon')
  );
}
