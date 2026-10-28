import { ACTOR, RECIPIENT } from '#gw2/platform/constants.js';
import type { StatusEffect } from '#gw2/platform/effects/types.js';
import { buildMesmerPacket } from '#gw2/professions/mesmer/core/mechanics/packets.js';

/** Clone ambush boons retain their caster identity and share spare recipient slots with living clones. */
export function buildMirageCloneBoon(
  at: number,
  boon: StatusEffect,
  skill: { id: number; name: string },
  cloneId: number
) {
  const sourceSkill = `${skill.name} — Clone`;
  return buildMesmerPacket({
    type: 'buff',
    at,
    source: 'Clone',
    actorType: ACTOR.SUMMON,
    summonKind: 'clone',
    summonOwner: `mesmer.clone:${cloneId}`,
    metadata: { cloneId },
    skillId: skill.id,
    sourceId: skill.id,
    kind: (boon.boon || '').toLowerCase(),
    stacks: Number(boon.stacks),
    duration: boon.duration,
    skillName: sourceSkill,
    sourceSkill,
    audience: {
      recipients: RECIPIENT.PARTY,
      maximumRecipients: 5
    }
  });
}
