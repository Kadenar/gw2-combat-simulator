import {
  spendCoreWarriorAdrenaline,
  spendWarriorAdrenalineAmount
} from '#gw2/professions/warrior/core/mechanics/adrenaline-and-endurance.js';
import type { WarriorCastContext, WarriorSkill } from '#gw2/professions/warrior/types.js';

/** Applies Berserker's fixed primal-burst and Berserk activation costs. */
export function spendBerserkerAdrenaline(context: WarriorCastContext, skill: WarriorSkill): number {
  if (!skill.primalBurst && skill.handlerId !== 'warrior.berserk') {
    return spendCoreWarriorAdrenaline(context, skill);
  }

  const requested = skill.handlerId === 'warrior.berserk' ? 30 : Number(skill.adrenalineCost || 0);
  return spendWarriorAdrenalineAmount(context, requested);
}
