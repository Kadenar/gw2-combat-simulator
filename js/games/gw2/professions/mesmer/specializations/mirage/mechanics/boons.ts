import { ACTOR, RECIPIENT } from '#gw2/platform/constants.js';
import type { ProfileEmission } from '#gw2/platform/effects/emission.js';
import type { BoonEffect } from '#gw2/platform/effects/types.js';
import { mesmerCloneOwnerId } from '#gw2/professions/mesmer/core/mechanics/illusions/identity.js';

/** One clone ambush profile owns its boon yield and shares spare recipient slots with living clones. */
export function mirageCloneBoonRequest(
  at: number,
  boons: readonly BoonEffect[],
  skill: { id: number; name: string },
  cloneId: number
): ProfileEmission {
  const sourceSkill = `${skill.name} - Clone`;
  return {
    kind: 'profile',
    profile: skill,
    at,
    attribution: {
      source: 'Clone',
      actorType: ACTOR.SUMMON,
      summonKind: 'clone',
      metadata: { cloneId },
      skillId: skill.id,
      sourceId: skill.id,
      skillName: sourceSkill
    },
    effects: boons.map((boon) => ({
      type: 'boon',
      boon: boon.boon,
      stacks: Number(boon.stacks),
      duration: boon.duration,
      summonOwner: mesmerCloneOwnerId(cloneId),
      audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 }
    })),
    transform: (event) => ({ ...event, sourceSkill })
  };
}
