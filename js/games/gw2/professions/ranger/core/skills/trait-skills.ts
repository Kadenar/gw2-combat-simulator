import { RECIPIENT, COMBO_FINISHER, BOON, CONDITION } from '#gw2/platform/constants.js';
import { boonKey } from '#gw2/platform/combat/boons.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { Skill } from '#gw2/platform/skills/types.js';

/** Invoked skills own their patchable payloads and recharge; traits own trigger eligibility. */
export const RANGER_CORE_TRAIT_SKILLS: readonly Skill[] = Object.freeze([
  {
    id: ID.LESSER_CALL_OF_THE_WILD,
    name: 'Lesser Call of the Wild',
    type: 'Proc',
    slot: 'Action',
    simulatorExcluded: true,
    slotSelectable: false,
    castTimeMs: 0,
    cooldown: 15,
    icon: 'https://render.guildwars2.com/file/2BBB18C54A01FF1D5FF9473EB1059AE491AA98FF/103310.png',
    effects: [
      {
        name: boonKey(BOON.FURY),
        type: 'boon',
        boon: BOON.FURY,
        duration: 5,
        stacks: 1,
        audience: {
          recipients: RECIPIENT.PARTY,
          maximumRecipients: 5
        }
      },
      {
        name: boonKey(BOON.MIGHT),
        type: 'boon',
        boon: BOON.MIGHT,
        duration: 5,
        stacks: 6,
        audience: {
          recipients: RECIPIENT.PARTY,
          maximumRecipients: 5
        }
      },
      {
        name: boonKey(BOON.SWIFTNESS),
        type: 'boon',
        boon: BOON.SWIFTNESS,
        duration: 5,
        stacks: 1,
        audience: {
          recipients: RECIPIENT.PARTY,
          maximumRecipients: 5
        }
      },
      {
        name: CONDITION.WEAKNESS,
        type: 'condition',
        condition: CONDITION.WEAKNESS,
        duration: 5,
        stacks: 1
      },
      {
        type: 'custom',
        eventType: 'proc',
        event: { name: 'Lesser Call of the Wild — Blast Finisher', procType: 'trait' },
        name: 'Blast Finisher',
        comboFinishers: [
          {
            ownerId: 'ranger',
            finisherType: COMBO_FINISHER.BLAST,
            ambiguousFieldSelection: 'oldest'
          }
        ]
      }
    ]
  },
  {
    id: ID.LESSER_MUDDY_TERRAIN,
    name: 'Lesser Muddy Terrain',
    type: 'Proc',
    slot: 'Action',
    simulatorExcluded: true,
    slotSelectable: false,
    castTimeMs: 0,
    cooldown: 20,
    icon: 'https://render.guildwars2.com/file/B6BD062BE66079C0514191004BB1D1140112E2A1/103996.png',
    effects: [
      {
        name: CONDITION.IMMOBILIZED,
        type: 'condition',
        condition: CONDITION.IMMOBILIZED,
        duration: 1,
        stacks: 1
      },
      {
        name: CONDITION.CRIPPLED,
        type: 'condition',
        condition: CONDITION.CRIPPLED,
        duration: 2,
        stacks: 1,
        applications: 5,
        intervalMs: 2000,
        atMs: 0,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        name: CONDITION.SLOW,
        type: 'condition',
        condition: CONDITION.SLOW,
        duration: 1,
        stacks: 1,
        applications: 5,
        intervalMs: 2000,
        atMs: 0,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  {
    id: ID.LESSER_SIC_EM,
    name: 'Lesser "Sic \'Em!"',
    type: 'Proc',
    slot: 'Action',
    simulatorExcluded: true,
    slotSelectable: false,
    castTimeMs: 0,
    cooldown: 10,
    icon: 'https://render.guildwars2.com/file/0D6B235E679346723414607E61DE052576097545/104025.png',
    effects: [
      {
        name: 'lesser-sic-em-pet',
        type: 'buff',
        kind: 'lesser-sic-em-pet',
        damageIncreasePerStack: 0.4,
        duration: 8,
        stacks: 1
      },
      {
        name: 'lesser-sic-em',
        type: 'buff',
        kind: 'lesser-sic-em',
        damageIncreasePerStack: 0.15,
        duration: 5,
        stacks: 1
      }
    ]
  }
]);
