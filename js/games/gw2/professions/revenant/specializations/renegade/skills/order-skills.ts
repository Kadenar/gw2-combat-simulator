/** Owns Renegade Citadel order skill fragments. */
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const RENEGADE_ORDER_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.CITADEL_BOMBARDMENT]: {
    castTimeMs: 600,
    unaffectedByQuickness: true,
    cooldown: 15,
    energyCost: 35,
    effects: [
      {
        type: 'strike',
        name: 'Citadel Bombardment',
        actorType: 'player',
        ticks: [
          { atMs: 245, coefficient: 0.6 },
          { atMs: 359, coefficient: 0.6 },
          { atMs: 473, coefficient: 0.6 },
          { atMs: 559, coefficient: 0.6 },
          { atMs: 645, coefficient: 0.6 },
          { atMs: 760, coefficient: 0.6 },
          { atMs: 847, coefficient: 0.6 },
          { atMs: 959, coefficient: 0.6 },
          { atMs: 1075, coefficient: 0.6 },
          { atMs: 1196, coefficient: 0.6 }
        ],
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        actorType: 'player',
        ticks: [
          { atMs: 245, condition: 'Burning', stacks: 1, duration: 1 },
          { atMs: 359, condition: 'Burning', stacks: 1, duration: 1 },
          { atMs: 473, condition: 'Burning', stacks: 1, duration: 1 },
          { atMs: 559, condition: 'Burning', stacks: 1, duration: 1 },
          { atMs: 645, condition: 'Burning', stacks: 1, duration: 1 },
          { atMs: 760, condition: 'Burning', stacks: 1, duration: 1 },
          { atMs: 847, condition: 'Burning', stacks: 1, duration: 1 },
          { atMs: 959, condition: 'Burning', stacks: 1, duration: 1 },
          { atMs: 1075, condition: 'Burning', stacks: 1, duration: 1 },
          { atMs: 1196, condition: 'Burning', stacks: 1, duration: 1 }
        ],
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.HEROIC_COMMAND]: {
    // Custom: Builds Heroic Command boons from live Kalla state and traits; see `renegade/mechanics/kalla-and-band-together.ts`.
    handlerId: 'revenant.heroic-command',
    castTimeMs: 500,
    cooldown: 10,
    energyCost: 10,
    effects: [
      {
        type: 'boon',
        boon: 'might',
        duration: 8,
        stacks: 2,
        actorType: 'player'
      }
    ]
  },
  [ID.ORDERS_FROM_ABOVE]: {
    // Custom: Builds Orders from Above boons from live Kalla state and traits; see `renegade/mechanics/kalla-and-band-together.ts`.
    handlerId: 'revenant.orders-from-above',
    castTimeMs: 0,
    cooldown: 20,
    energyCost: 20,
    effects: [
      {
        type: 'boon',
        boon: 'alacrity',
        duration: 2,
        stacks: 1,
        applications: 4,
        intervalMs: 1000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        actorType: 'player'
      }
    ]
  }
});
