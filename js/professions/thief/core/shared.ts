import { professionCoreState } from '../../../platform/engine/profession/state.js';
import { emitStateSnapshot } from '../../../platform/engine/events/state-snapshots.js';
import { snapshotThiefState } from '../state.js';
import type { SkillId } from '../../../platform/engine/types.js';
import type { ThiefSchedulerContext, ThiefEmissionContext, ThiefSkill } from '../types.js';

export function emitThiefState(context: ThiefSchedulerContext, at: number, reason: string): void {
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
  emitThiefState(context, at, reason);
}

export function gainThiefEndurance(context: ThiefSchedulerContext, amount: number, at: number, reason: string): void {
  const state = professionCoreState(context);
  state.endurance = Math.min(state.maximumEndurance, state.endurance + Math.max(0, Number(amount || 0)));
  emitThiefState(context, at, reason);
}

export function emitThiefCondition(
  context: ThiefEmissionContext,
  {
    at,
    condition,
    duration,
    stacks = 1,
    sourceId,
    name
  }: {
    readonly at: number;
    readonly condition: string;
    readonly duration: number;
    readonly stacks?: number;
    readonly sourceId: SkillId;
    readonly name: string;
  }
): void {
  context.emit({
    type: 'condition',
    at,
    source: 'Trait',
    sourceId,
    actorType: 'player',
    skillId: context.skill?.id,
    skillName: context.skill?.name,
    name,
    condition,
    stacks,
    duration
  });
}
