import type { BalanceProfile } from '#gw2/platform/engine/skills/types.js';
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';

export const DRAGONHUNTER_BALANCE_PROFILE_IDS = Object.freeze({
  tether: 'guardian.dragonhunter.spear-of-justice-tether',
  passiveCourage: 'guardian.dragonhunter.passive-courage'
});

export const DRAGONHUNTER_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([
  {
    id: DRAGONHUNTER_BALANCE_PROFILE_IDS.tether,
    name: 'Spear of Justice - Tether',
    profileKind: 'skill-variant',
    parentId: ID.SPEAR_OF_JUSTICE,
    pulseInterval: 1,
    effects: [
      {
        type: 'condition',
        name: 'Burning',
        condition: 'Burning',
        stacks: 1,
        duration: 2,
        actorType: 'player'
      },
      {
        type: 'condition',
        name: 'Crippled (passive)',
        condition: 'Crippled',
        stacks: 1,
        duration: 1.5,
        actorType: 'player',
        packetLabel: 'passive'
      }
    ]
  },
  {
    id: DRAGONHUNTER_BALANCE_PROFILE_IDS.passiveCourage,
    name: 'Shield of Courage - Passive',
    profileKind: 'mechanic',
    pulseInterval: 40,
    effects: [{ type: 'boon', name: 'aegis', boon: 'aegis', stacks: 1, duration: 20 }]
  }
]);
