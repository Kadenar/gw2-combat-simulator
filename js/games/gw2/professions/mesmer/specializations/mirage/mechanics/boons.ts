import type { ConditionEffect, StatusEffect } from '#gw2/platform/engine/skills/types.js';
import type { MesmerConditionApplication } from '#gw2/professions/mesmer/data/types.js';
import type { MesmerAddEvent } from '#gw2/professions/mesmer/types.js';

/** Preserve the selected status's validated values when shared ambush and trait emitters consume it. */
export const statusFromEffect = (effect: ConditionEffect | StatusEffect): MesmerConditionApplication => ({
  name: String(effect.condition ?? effect.boon),
  duration: effect.duration,
  stacks: effect.stacks
});

/** Clone boons reach the party while player packets keep their authored audience. */
export function emitMirageBoon(
  addEvent: MesmerAddEvent,
  at: number,
  boon: MesmerConditionApplication,
  sourceSkill: string,
  actorType: 'player' | 'summon' = 'player',
  recipients: 'self' | 'party' = 'self'
): void {
  const boonRecipients = actorType === 'summon' ? 'party' : recipients;
  addEvent({
    type: 'buff',
    at,
    source: actorType === 'summon' ? 'Clone' : 'Player',
    actorType,
    kind: (boon.name || '').toLowerCase(),
    stacks: Number(boon.stacks),
    duration: Number(boon.duration),
    skillName: sourceSkill,
    sourceSkill,
    audience: {
      recipients: boonRecipients,
      ...(boonRecipients === 'party' ? { maximumRecipients: 5 } : {})
    }
  });
}
