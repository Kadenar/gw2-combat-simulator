import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { grantCapped } from '#gw2/platform/combat/resources/pool.js';

import { emitThiefStateSnapshot } from '#gw2/professions/thief/family-state.js';
import type { ThiefSchedulerContext, ThiefSkill } from '#gw2/professions/thief/types.js';
import { scheduledReaction } from '#gw2/platform/execution/scheduler-reactions.js';
import { grantProfessionEndurance } from '#gw2/platform/combat/resources/endurance-policy.js';

export function emitThiefShroudSwap(context: ThiefSchedulerContext, skill: ThiefSkill, at: number): void {
  context.emit({
    type: 'weapon_set',
    at,
    source: 'thief',
    sourceId: skill.id,
    actorType: 'player',
    skillId: skill.id,
    skillName: skill.name,
    weaponSet: context.state.activeWeaponSet,
    shroudSwap: true
  });
}

export function gainThiefInitiative(context: ThiefSchedulerContext, amount: number, at: number, reason: string): void {
  const state = professionCoreState(context);
  state.initiative = grantCapped(state.initiative, amount, state.maximumInitiative);
  // Publish the grant through the shared Thief envelope so observers see the updated state immediately.
  emitThiefStateSnapshot(context, at, reason);
}

export function gainThiefEndurance(context: ThiefSchedulerContext, amount: number, at: number, reason: string): void {
  // Cast authoring may request a future grant; execute it only when its owning task reaches the clock.
  if (at > context.state.time) {
    thiefEnduranceGrant.onEventScheduled.handler(context, { amount, at, reason });
    return;
  }

  // Settle passive recovery before applying the grant and publishing its state.
  grantProfessionEndurance(context, Number(amount || 0), at);
  // Publish the grant through the shared Thief envelope so observers see the updated state immediately.
  emitThiefStateSnapshot(context, at, reason);
}

/** Deferred grants retain activation ownership and publish snapshots only after the resource changes. */
export const thiefEnduranceGrant = scheduledReaction<
  ThiefSchedulerContext,
  { amount: number; at: number; reason: string },
  { amount: number; reason: string }
>({
  id: 'thief.endurance-grant',
  select: (context, grant) => ({
    at: grant.at,
    ownerId: 'reservationId' in context ? String(context.reservationId) : null,
    payload: { amount: grant.amount, reason: grant.reason }
  }),
  execute: (context, at, grant) => gainThiefEndurance(context, grant.amount, at, grant.reason)
});
