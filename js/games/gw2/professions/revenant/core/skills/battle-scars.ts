/** Owns the shared Battle Scars charge payload. */
import { ACTOR } from '#gw2/platform/constants.js';
import { SKILL_PLACEHOLDER_ICON } from '#gw2/platform/skills/shared-actions.js';
import type { Skill } from '#gw2/platform/skills/types.js';

/** All scar-granting traits feed one charge pool and one patchable life-siphon payload. */
export const battleScarsSkill: Skill = {
  name: 'Battle Scars',
  icon: SKILL_PLACEHOLDER_ICON,
  id: 'revenant.battle-scars',
  type: 'Action',
  slot: 'Action',
  slotSelectable: false,
  rotationInputExcluded: true,
  cooldown: 0,
  maximumStacks: 25,
  effects: [
    {
      type: 'strike',
      coefficient: 0,
      hits: 1,
      damageKind: 'life-steal',
      flatStrikeBase: 117,
      flatStrikePowerCoeff: 0.006,
      name: 'Battle Scars - Life Siphon',
      actorType: ACTOR.EFFECT
    }
  ]
};
