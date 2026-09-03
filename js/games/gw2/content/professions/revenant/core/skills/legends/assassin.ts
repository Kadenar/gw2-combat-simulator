/** Owns Legendary Assassin Stance skill fragments and their alternate identities. */
import { REVENANT_SKILL_IDS as ID } from '#gw2/content/professions/revenant/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const REVENANT_ASSASSIN_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.ENCHANTED_DAGGERS]: {
    // Custom: Arms Enchanted Daggers charges and their strike-triggered healing state; see `mechanics/enchanted-daggers.ts`.
    handlerId: 'revenant.enchanted-daggers',
    castTimeMs: 500,
    cooldown: 30,
    energyCost: 5,
    effects: [
      {
        type: 'buff',
        kind: 'enchanted-daggers',
        duration: 15,
        stacks: 6,
        actorType: 'player'
      },
      {
        type: 'strike',
        coefficient: 0,
        hits: 1,
        atMs: 500,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        flatStrikeBase: 1028,
        flatStrikePowerCoeff: 0.06,
        name: 'Enchanted Daggers — Siphon Damage',
        actorType: 'effect'
      }
    ],
    legendId: 'LegendaryAssassin'
  },
  [ID.IMPOSSIBLE_ODDS]: {
    // Custom: Starts/stops upkeep drain and schedules upkeep pulses; see `core/mechanics/upkeep.ts`.
    handlerId: 'revenant.upkeep',
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 5,
    upkeepCost: 6,
    manualReleaseCooldown: 1,
    starvationCooldown: 4,
    pulseInterval: 1,
    // Triggered strikes use a separate quarter-second ICD from the upkeep pulse.
    triggerIntervalMs: 250,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 250, coefficient: 0.65 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Impossible Odds',
        actorType: 'effect'
      }
    ],
    legendId: 'LegendaryAssassin'
  },
  [ID.PHASE_TRAVERSAL]: {
    castTimeMs: 500,
    cooldown: 5,
    energyCost: 30,
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1,
        name: 'Phase Traversal',
        actorType: 'player'
      },
      {
        type: 'boon',
        boon: 'quickness',
        duration: 3,
        stacks: 1
      }
    ],
    legendId: 'LegendaryAssassin'
  },
  [ID.JADE_WINDS]: {
    castTimeMs: 1000,
    cooldown: 10,
    energyCost: 35,
    effects: [
      {
        type: 'strike',
        coefficient: 3,
        hits: 1,
        name: 'Jade Winds',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 6,
        duration: 6,
        actorType: 'player'
      }
    ],
    legendId: 'LegendaryAssassin'
  },
  [ID.RIPOSTING_SHADOWS]: {
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 30,
    effects: [
      {
        type: 'boon',
        boon: 'fury',
        duration: 6,
        stacks: 1
      }
    ],
    legendId: 'LegendaryAssassin'
  },
  [ID.JADE_WINDS_ID_31294]: {
    castTimeMs: 1000,
    cooldown: 10,
    energyCost: 35,
    effects: [
      {
        type: 'strike',
        coefficient: 3,
        hits: 1,
        name: 'Jade Winds',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 6,
        duration: 6,
        actorType: 'player'
      }
    ],
    legendId: 'LegendaryAssassin'
  }
});
