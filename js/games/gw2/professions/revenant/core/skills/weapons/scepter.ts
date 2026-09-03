/** Canonical Core revenant skill fragments grouped by their GW2 owner. */
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const REVENANT_WEAPONS_SCEPTER_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.BLOSSOMING_AURA]: {
    castTimeMs: 750,
    cooldown: 8,
    energyCost: 10,
    effects: [
      {
        type: 'strike',
        ticks: Array.from({ length: 4 }, (_, index) => ({
          atMs: 130.346666666667 + index * 130.346666666667,
          coefficient: 4.8 / 4
        })),
        name: 'Pulsing Damage',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Final Damage',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Weakness',
        stacks: 1,
        duration: 3,
        actorType: 'player'
      }
    ]
  },
  [ID.DEACTIVATE_OTHERWORLDLY_BOND]: {
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 0,
    effects: []
  },
  [ID.ACERBIC_CUT]: {
    castTimeMs: 500,
    cooldown: 0,
    energyCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.533,
        hits: 1,
        name: 'Acerbic Cut',
        actorType: 'player'
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 9,
        stacks: 2
      }
    ]
  },
  [ID.SERENE_SLASH]: {
    castTimeMs: 500,
    cooldown: 0,
    energyCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.533,
        hits: 1,
        name: 'Serene Slash',
        actorType: 'player'
      }
    ]
  },
  [ID.MOTIVATING_WHIRL]: {
    castTimeMs: 500,
    cooldown: 0,
    energyCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Motivating Whirl',
        actorType: 'player'
      }
    ]
  },
  [ID.OTHERWORLDLY_BOND]: {
    castTimeMs: 750,
    cooldown: 8,
    energyCost: 5,
    effects: [
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 1,
        duration: 10,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 2,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Slow',
        stacks: 1,
        duration: 1,
        actorType: 'player'
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 9,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'fury',
        duration: 3,
        stacks: 1
      }
    ]
  },
  [ID.DETONATE_BLOSSOMING_AURA]: {
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 0,
    effects: []
  }
});
