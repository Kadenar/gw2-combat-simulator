/** Owns Vindicator dodge attack skill fragments. */
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import { VINDICATOR_LANDING_MS } from '#gw2/professions/revenant/data/vindicator-jump.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';

export const VINDICATOR_DODGE_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  // Saint's Shield replaces dodge damage with a party alacrity application at the landing effect point.
  [ID.SAINTS_SHIELD]: {
    castTimeMs: VINDICATOR_LANDING_MS,

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
