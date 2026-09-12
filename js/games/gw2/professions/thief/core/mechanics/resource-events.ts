import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { grantEndurance } from '#gw2/platform/combat/resources/endurance.js';
import { emitThiefStateSnapshot } from '#gw2/professions/thief/state.js';
import type { ThiefSchedulerContext, ThiefSkill } from '#gw2/professions/thief/types.js';

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
  state.initiative = Math.min(state.maximumInitiative, state.initiative + Math.max(0, Number(amount || 0)));
  // Publish the grant through the shared Thief envelope so observers see the updated state immediately.
  emitThiefStateSnapshot(context, at, reason);
}

export function gainThiefEndurance(context: ThiefSchedulerContext, amount: number, at: number, reason: string): void {
  const state = professionCoreState(context);
  // Preserve the regeneration anchor because completion-time grants run before
  // the scheduler advances passive endurance through the completed cast.
  Object.assign(state, grantEndurance(state, Number(amount || 0), state.enduranceUpdatedAt, state.maximumEndurance));
  // Publish the grant through the shared Thief envelope so observers see the updated state immediately.
  emitThiefStateSnapshot(context, at, reason);
}
