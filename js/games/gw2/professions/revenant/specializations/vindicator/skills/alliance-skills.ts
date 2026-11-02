/** Owns Legendary Alliance stance skill definitions. */
import { ACTOR, BOON, CONDITION, CONTROL } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import type { RevenantSkill } from '#gw2/professions/revenant/types.js';

export const VINDICATOR_ALLIANCE_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition<RevenantSkill>>> = {
  [ID.SELFISH_SPIRIT]: {
    name: 'Selfish Spirit',
    icon: 'https://render.guildwars2.com/file/5D42213C0E779954D393D190FF62D6F2EADBA03D/2491620.png',
    type: 'Heal',
    slot: 'Heal',
    ammoCastLockout: 10,
    cooldown: 10,
    // Override the imported ammo fact: Selfish Spirit is one channel with a normal cooldown.
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
    name: "Nomad's Advance",
    icon: 'https://render.guildwars2.com/file/DA3EE9BC42DF5E1ED2B908462173AF47E0C203B7/2491616.png',
    type: 'Utility',
    slot: 'Utility',
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
    name: "Reaver's Rage",
    icon: 'https://render.guildwars2.com/file/0904BEED310DD2D00FC8EF5F980F4F3248075325/2491618.png',
    type: 'Utility',
    slot: 'Utility',
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
    name: 'Spear of Archemorus',
    icon: 'https://render.guildwars2.com/file/75E2F0423C74594E045AF6A10A55065E3CE61037/2491622.png',
    type: 'Elite',
    slot: 'Elite',
    cooldown: 12,
    energyCost: 20,
    legendId: 'LegendaryAlliance',
    castTimeMs: 600,
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
    name: 'Scavenger Burst',
    icon: 'https://render.guildwars2.com/file/635D6297B7471B050BC8774CB708C590DF06DEBC/2491619.png',
    type: 'Utility',
    slot: 'Utility',
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
};
