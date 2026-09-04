import {
  spendCoreWarriorAdrenaline,
  spendWarriorAdrenalineAmount
} from '#gw2/professions/warrior/core/mechanics/adrenaline-and-endurance.js';
import type { WarriorCastContext, WarriorSkill } from '#gw2/professions/warrior/types.js';

/** Applies Spellbreaker's one-bar burst and Full Counter costs. */
export function spendSpellbreakerAdrenaline(context: WarriorCastContext, skill: WarriorSkill): number {
  if (!skill.burst && skill.handlerId !== 'warrior.full-counter') {
    return spendCoreWarriorAdrenaline(context, skill);
  }

  return spendWarriorAdrenalineAmount(context, Number(skill.adrenalineCost || 0));
}
