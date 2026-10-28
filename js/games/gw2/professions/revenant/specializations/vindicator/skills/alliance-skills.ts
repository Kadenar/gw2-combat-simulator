/** Owns Legendary Alliance stance skill fragments. */
import { ACTOR, BOON, CONDITION, CONTROL } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';

export const VINDICATOR_ALLIANCE_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.SELFISH_SPIRIT]: {
    cooldown: 10,
    // Override the imported ammo fact: Selfish Spirit is one channel with a normal cooldown.
    ammo: 0,
    energyCost: 10,
    legendId: 'LegendaryAlliance',
    castTimeMs: 1000,
    effects: [
      {
        type: 'strike',
        coefficient: 0.222,
        hits: 1,
        name: 'Selfish Spirit',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.VULNERABILITY,
        stacks: 1,
        duration: 5,
        actorType: ACTOR.PLAYER
      },
      {
        type: 'boon',
        boon: BOON.MIGHT,
        duration: 5,
        stacks: 1
      }
    ]
  },
  [ID.NOMADS_ADVANCE]: {
    cooldown: 3,
    energyCost: 10,
    legendId: 'LegendaryAlliance',
    castTimeMs: 960,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 800, coefficient: 4 }],
        name: "Nomad's Advance",
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'boon',
        boon: BOON.MIGHT,
        duration: 6,
        stacks: 1
      }
    ]
  },
  [ID.REAVERS_RAGE]: {
    cooldown: 10,
    energyCost: 15,
    legendId: 'LegendaryAlliance',
    castTimeMs: 360,
    effects: [
      {
        type: 'strike',
        coefficient: 2.22,
        hits: 1,
        name: "Reaver's Rage",
        actorType: ACTOR.PLAYER
      },
      {
        type: 'boon',
        boon: BOON.STABILITY,
        duration: 1,
        stacks: 1
      },
      {
        type: 'boon',
        boon: BOON.STABILITY,
        duration: 6,
        stacks: 1
      },
      {
        type: 'control',
        actorType: ACTOR.PLAYER,
        controlKind: CONTROL.DAZE
      }
    ]
  },
  [ID.SPEAR_OF_ARCHEMORUS]: {
    cooldown: 12,
    energyCost: 20,
    legendId: 'LegendaryAlliance',
    castTimeMs: 480,
    interruptCommitMs: 400,
    // Share one impact timing while preserving independent payloads and declaration order.
    effects: impactEffects(
      { atMs: 2960, timingAnchor: 'castEnd', timingScale: 'fixed', persistsAfterInterrupt: true },
      [
        {
          type: 'strike',
          coefficient: 5,
          hits: 1,
          name: 'Spear of Archemorus',
          actorType: ACTOR.PLAYER
        },
        {
          type: 'condition',
          condition: CONDITION.TORMENT,
          stacks: 5,
          duration: 8,
          actorType: ACTOR.PLAYER
        }
      ]
    )
  },
  [ID.SCAVENGER_BURST]: {
    cooldown: 3,
    energyCost: 15,
    legendId: 'LegendaryAlliance',
    castTimeMs: 520,
    effects: [
      {
        type: 'strike',
        coefficient: 2.25,
        hits: 1,
        name: 'Scavenger Burst',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.BURNING,
        stacks: 2,
        duration: 5,
        actorType: ACTOR.PLAYER
      },
      {
        type: 'boon',
        boon: BOON.QUICKNESS,
        duration: 5,
        stacks: 1
      },
      {
        type: 'boon',
        boon: BOON.FURY,
        duration: 5,
        stacks: 1
      }
    ]
  }
});
