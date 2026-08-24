import { professionCoreState } from '../../../../platform/engine/profession/state.js';
import { spendCoreWarriorAdrenaline, syncWarriorAdrenaline } from '../../core/resources.js';
import type { WarriorCastContext, WarriorSkill } from '../../types.js';

/** Applies Paragon's one-bar burst and chant activation costs. */
export function spendParagonAdrenaline(context: WarriorCastContext, skill: WarriorSkill): number {
  if (!skill.burst && skill.handlerId !== 'warrior.chant') {
    return spendCoreWarriorAdrenaline(context, skill);
  }

  const state = professionCoreState(context);
  const available = Number(state.adrenaline || 0);
  const spent = Math.min(available, Number(skill.adrenalineCost || 0));
  state.adrenaline = available - spent;
  syncWarriorAdrenaline(context);
  return spent;
}
