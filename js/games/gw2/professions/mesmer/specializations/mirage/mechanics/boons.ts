import { buildMesmerPacket } from '#gw2/professions/mesmer/core/mechanics/packets.js';
import type { StatusEffect } from '#gw2/platform/effects/types.js';

/** Clone boons reach the party while player packets keep their authored audience. */
export function buildMirageBoon(
  at: number,
  boon: StatusEffect,
  sourceSkill: string,
  actorType: 'player' | 'summon' = 'player',
  recipients: 'self' | 'party' = 'self'
) {
  const boonRecipients = actorType === 'summon' ? 'party' : recipients;
  return buildMesmerPacket({
    type: 'buff',
    at,
    source: actorType === 'summon' ? 'Clone' : 'Player',
    actorType,
    kind: (boon.boon || '').toLowerCase(),
    stacks: Number(boon.stacks),
    duration: boon.duration,
    skillName: sourceSkill,
    sourceSkill,
    audience: {
      recipients: boonRecipients,
      ...(boonRecipients === 'party' ? { maximumRecipients: 5 } : {})
    }
  });
}
