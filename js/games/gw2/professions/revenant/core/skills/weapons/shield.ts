/** Canonical Core revenant skill definitions grouped by their GW2 owner. */
import { BOON, RECIPIENT } from '#gw2/platform/constants.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import type { RevenantSkill } from '#gw2/professions/revenant/types.js';

export const REVENANT_WEAPONS_SHIELD_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition<RevenantSkill>>> = {
  [ID.ENVOY_OF_EXUBERANCE]: {
    name: 'Envoy of Exuberance',
    icon: 'https://render.guildwars2.com/file/AD3900CE2DF8609598F81364D805220DDE47BA10/1058608.png',
    type: 'Weapon',
    weapon: 'Shield',
    slot: 'Weapon_4',
    cooldown: 15,
    energyCost: 8,
    castTimeMs: 520,
    effects: [
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.PROTECTION,
        duration: 3,
        stacks: 1
      },
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.AEGIS,
        duration: 4,
        stacks: 1
      }
    ]
  },
  [ID.CRYSTAL_HIBERNATION]: {
    name: 'Crystal Hibernation',
    icon: 'https://render.guildwars2.com/file/59C2A1CA66701D30FD15CBD9790E4131013B2B72/1058609.png',
    type: 'Weapon',
    weapon: 'Shield',
    slot: 'Weapon_5',
    cooldown: 25,
    energyCost: 20,
    castTimeMs: 2000,
    effects: []
  }
};
