import {
  spendCoreWarriorAdrenaline,
  spendWarriorAdrenalineAmount
} from '#gw2/professions/warrior/core/mechanics/adrenaline-and-endurance.js';
import type { WarriorCastContext, WarriorSkill } from '#gw2/professions/warrior/types.js';

/** Applies Paragon's one-bar burst and chant activation costs. */
export function spendParagonAdrenaline(context: WarriorCastContext, skill: WarriorSkill): number {
  if (!skill.burst && skill.handlerId !== 'warrior.chant') {
    return spendCoreWarriorAdrenaline(context, skill);
  }

  return spendWarriorAdrenalineAmount(context, Number(skill.adrenalineCost || 0));
}
