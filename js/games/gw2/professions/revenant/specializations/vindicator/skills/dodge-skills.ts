/** Owns Vindicator dodge attack skill fragments. */
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import type { Skill, SkillFragment } from '#gw2/platform/engine/skills/types.js';

export const VINDICATOR_AIRBORNE_MS = 600;
export const VINDICATOR_LANDING_MS = 200;

/** Replays a recorded jump from its endurance-spending input through the landing, including overlapping autos. */
export const VINDICATOR_JUMP_SKILL: Skill = Object.freeze({
  id: 23275,
  name: 'Dodge Jump',
  displayName: 'Dodge + Landing',
  icon: 'https://wiki.guildwars2.com/images/b/b2/Dodge.png',
  description:
    '600 ms airborne dodge + 200 ms landing. Endurance is spent at takeoff; the selected dodge effect resolves on landing.',
  type: 'Action',
  slot: 'Action',
  specialization: 'Vindicator',
  handlerId: 'revenant.vindicator-jump',
  castTimeMs: VINDICATOR_AIRBORNE_MS + VINDICATOR_LANDING_MS,
  paletteAction: true,
  hotkeyAction: 'dodge',
  unaffectedByQuickness: true,
  resourceCost: 50,
  cooldown: 0,
  effects: []
});

export const VINDICATOR_DODGE_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  // Saint's Shield replaces dodge damage with a party alacrity application at the landing effect point.
  [ID.SAINTS_SHIELD]: {
    castTimeMs: VINDICATOR_LANDING_MS,
    unaffectedByQuickness: true,
    cooldown: 0,
    energyCost: 0,
    effects: [
      {
        type: 'boon',
        boon: 'alacrity',
        duration: 4,
        stacks: 1,
        atMs: 160,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        audience: { recipients: 'party', maximumRecipients: 5 }
      }
    ]
  },
  [ID.DEATH_DROP]: {
    castTimeMs: VINDICATOR_LANDING_MS,
    unaffectedByQuickness: true,
    cooldown: 0,
    energyCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 160, coefficient: 3.3 }],
        name: 'Death Drop',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 5,
        duration: 10,
        actorType: 'player'
      }
    ]
  },
  [ID.IMPERIAL_IMPACT]: {
    castTimeMs: VINDICATOR_LANDING_MS,
    unaffectedByQuickness: true,
    cooldown: 0,
    energyCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 160, coefficient: 2 }],
        name: 'Imperial Impact',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 10,
        stacks: 5
      },
      {
        type: 'boon',
        boon: 'protection',
        duration: 5,
        stacks: 1
      }
    ]
  }
});
