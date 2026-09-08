/** Owns Renegade Citadel order skill fragments. */
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

// Each impact applies strike damage and Burning at the same offset after cast completion.
const BOMBARDMENT_IMPACT_MS = [640, 800, 920, 1000, 1040, 1160, 1240, 1400, 1480, 1720];

export const RENEGADE_ORDER_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.CITADEL_BOMBARDMENT]: {
    // Quantize the pooled Hibernus/Seatek impact estimates to 40 ms after cast completion; exclude incomplete volleys.
    castTimeMs: 600,
    unaffectedByQuickness: true,
    cooldown: 15,
    energyCost: 35,
    effects: [
      {
        type: 'strike',
        name: 'Citadel Bombardment',
        actorType: 'player',
        ticks: BOMBARDMENT_IMPACT_MS.map((atMs) => ({ atMs, coefficient: 0.6 })),
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        actorType: 'player',
        ticks: BOMBARDMENT_IMPACT_MS.map((atMs) => ({
          atMs,
          condition: 'Burning',
          stacks: 1,
          duration: 1
        })),
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.HEROIC_COMMAND]: {
    // Custom: Builds Heroic Command boons from live Kalla state and traits; see `renegade/mechanics/kalla-and-band-together.ts`.
    handlerId: 'revenant.heroic-command',
    quicknessCastTimeMs: 480,
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
