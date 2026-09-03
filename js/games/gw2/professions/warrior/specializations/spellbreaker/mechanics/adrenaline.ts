import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import {
  spendCoreWarriorAdrenaline,
  syncWarriorAdrenaline
} from '#gw2/professions/warrior/core/mechanics/adrenaline-and-endurance.js';
import type { WarriorCastContext, WarriorSkill } from '#gw2/professions/warrior/types.js';

/** Applies Spellbreaker's one-bar burst and Full Counter costs. */
export function spendSpellbreakerAdrenaline(context: WarriorCastContext, skill: WarriorSkill): number {
  if (!skill.burst && skill.handlerId !== 'warrior.full-counter') {
    return spendCoreWarriorAdrenaline(context, skill);
  }

  const state = professionCoreState(context);
  const available = Number(state.adrenaline || 0);
  const spent = Math.min(available, Number(skill.adrenalineCost || 0));
  state.adrenaline = available - spent;
  syncWarriorAdrenaline(context);
  return spent;
}
