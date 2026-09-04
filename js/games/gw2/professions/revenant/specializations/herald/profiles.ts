/** Owns patchable Herald trait and legend-invocation balance profiles. */
import type { BalanceProfile } from '#gw2/platform/engine/skills/types.js';

export const HERALD_SPIRIT_BOON_PROFILE_ID = 'revenant.spirit-boon.dragon';
export const HERALD_ELEVATED_COMPASSION_PROFILE_ID = 'revenant.elevated-compassion';
export const HERALD_SHARED_EMPOWERMENT_PROFILE_ID = 'revenant.shared-empowerment';

export const HERALD_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([
  {
    id: HERALD_SHARED_EMPOWERMENT_PROFILE_ID,
    name: 'Shared Empowerment',
    profileKind: 'trait',
    description: 'Applying a boon to an ally grants nearby allies one stack of might.',
    cooldown: 1,
    effects: [
      {
        type: 'boon',
        boon: 'might',
        duration: 8,
        stacks: 1,
        actorType: 'effect',
        audience: { recipients: 'party' as const, maximumRecipients: 5 }
      }
    ]
  },
  {
    id: HERALD_ELEVATED_COMPASSION_PROFILE_ID,
    name: 'Elevated Compassion',
    profileKind: 'trait',
    description: 'Grants quickness while aggregate upkeep is at least six.',
    cooldown: 1,
    threshold: 6,
    effects: [
      {
        type: 'boon',
        boon: 'quickness',
        duration: 1.25,
        stacks: 1,
        actorType: 'player',
        audience: { recipients: 'party' as const }
      }
    ]
  },
  {
    id: HERALD_SPIRIT_BOON_PROFILE_ID,
    name: 'Spirit Boon (Dragon)',
    profileKind: 'trait',
    description: 'Invoking Legendary Dragon grants protection to nearby allies.',
    icon: 'https://render.guildwars2.com/file/62279406A52F47A00CE7BFFB43D405907A67A60F/1012681.png',
    effects: [
      {
        type: 'boon',
        boon: 'protection',
        duration: 3,
        stacks: 1,
        actorType: 'player'
      }
    ]
  }
]);
