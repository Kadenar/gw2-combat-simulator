import { professionCoreState } from '../../../../platform/engine/profession/state.js';
import { emitStateSnapshot } from '../../../../platform/engine/events/state-snapshots.js';
import { grantEndurance } from '../../../../platform/combat/resources/endurance.js';
import { snapshotThiefState } from './state.js';
import type { ThiefSchedulerContext, ThiefSkill } from '../types.js';

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
  // Record the updated resource immediately so downstream observers see the same scheduler state.
  emitStateSnapshot(context, {
    type: 'thief.state',
    at,
    source: 'thief',
    sourceId: `thief.state.${reason}`,
    actorType: 'player',
    reason,
    state: snapshotThiefState(context.state.profession)
  });
}

export function gainThiefEndurance(context: ThiefSchedulerContext, amount: number, at: number, reason: string): void {
  const state = professionCoreState(context);
  // Preserve the regeneration anchor because completion-time grants run before
  // the scheduler advances passive endurance through the completed cast.
  Object.assign(state, grantEndurance(state, Number(amount || 0), state.enduranceUpdatedAt, state.maximumEndurance));
  // Record the updated resource immediately so downstream observers see the same scheduler state.
  emitStateSnapshot(context, {
    type: 'thief.state',
    at,
    source: 'thief',
    sourceId: `thief.state.${reason}`,
    actorType: 'player',
    reason,
    state: snapshotThiefState(context.state.profession)
  });
}
