/** Canonical Core warrior skill definitions grouped by their GW2 owner. */
import { BOON, COMBO_FINISHER, RECIPIENT } from '#gw2/platform/constants.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';

export const WARRIOR_WEAPONS_WARHORN_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = Object.freeze({
  [ID.CHARGE]: {
    name: 'Charge',
    description: 'Grant boons and remove movement-impairing conditions from allies.',
    icon: 'https://render.guildwars2.com/file/FF0803E0B7BF09691008FE205E2290E74D97CF04/2207786.png',
    type: 'Weapon',
    weapon: 'Warhorn',
    slot: 'Weapon_4',
    cooldown: 20,
    castTimeMs: 333,
    comboFinishers: [
      {
        ownerId: 'warrior',
        finisherType: COMBO_FINISHER.BLAST
      }
    ],
    effects: [
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.SWIFTNESS,
        duration: 20,
        stacks: 1
      },
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.QUICKNESS,
        duration: 2,
        stacks: 1
      }
    ]
  },
  [ID.CALL_OF_VALOR]: {
    name: 'Call of Valor',
    description: 'Removes conditions from allies and grants them vigor. Affected targets also gain barrier.',
    icon: 'https://render.guildwars2.com/file/3B55F2FCAC809095354674C0FA4F0808A3F5E09E/103233.png',
    type: 'Weapon',
    weapon: 'Warhorn',
    slot: 'Weapon_5',
    cooldown: 20,
    castTimeMs: 333,
    comboFinishers: [
      {
        ownerId: 'warrior',
        finisherType: COMBO_FINISHER.BLAST
      }
    ],
    effects: [
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.VIGOR,
        duration: 10,
        stacks: 1
      }
    ]
  }
});
