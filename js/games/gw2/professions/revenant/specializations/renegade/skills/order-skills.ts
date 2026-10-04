import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import { righteousRebelOrderVariants } from '#gw2/professions/revenant/specializations/renegade/traits/behavior.js';

// Each impact applies strike damage and Burning at the same offset after cast completion.
const BOMBARDMENT_IMPACT_MS = [640, 800, 920, 1000, 1040, 1160, 1240, 1400, 1480, 1720];

export const RENEGADE_ORDER_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.CITADEL_BOMBARDMENT]: {
    // Quantize the pooled Hibernus/Seatek impact estimates to 40 ms after cast completion; exclude incomplete volleys.
    castTimeMs: 600,

    cooldown: 15,
    energyCost: 35,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      {
        type: 'strike',
        name: 'Citadel Bombardment',
        actorType: 'player',
        ticks: BOMBARDMENT_IMPACT_MS.map((atMs) => ({ atMs, coefficient: 0.6 }))
      },
      {
        type: 'condition',
        actorType: 'player',
        ticks: BOMBARDMENT_IMPACT_MS.map((atMs) => ({
          atMs,
          condition: 'Burning',
          stacks: 1,
          duration: 1
        }))
      }
    ])
  },
  [ID.HEROIC_COMMAND]: {
    // Skill-owned triggers delegate shared state transitions to the registered mechanic.
    sideEffects: [{ on: 'castCommit', do: { type: 'revenant.heroic-command' } }],
    // Custom: Builds Heroic Command boons from live Kalla state and traits; see `renegade/hooks.ts`.
    castTimeMs: 480,
    cooldown: 10,
    energyCost: 10,
    effects: [
      {
        name: 'might',
        type: 'boon',
        boon: 'might',
        duration: 8,
        stacks: 2,
        actorType: 'player'
      }
    ]
  },
  [ID.ORDERS_FROM_ABOVE]: {
    // These trait-selected pulses need no live Fervor state; normal scheduling preserves their fixed cadence.
    effectVariants: righteousRebelOrderVariants,
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
