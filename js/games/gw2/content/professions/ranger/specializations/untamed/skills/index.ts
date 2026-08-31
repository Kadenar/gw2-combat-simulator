/** Explicit PvE skill mechanics owned by the Untamed Ranger module. */
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/content/professions/ranger/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

// Both Unleash actions replace the same F5 tile as control passes between pet and ranger.
const UNLEASH_PALETTE_TILE = 'ranger-untamed-unleash';

export const UNTAMED_BASE_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.ENVELOPING_HAZE]: {
    interruptCommitMs: 0,
    implemented: true,
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        ticks: [0, 1000, 2000, 3000, 4000, 5000].map((atMs) => ({
          atMs,
          coefficient: 1.75 / 6
        })),
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true,
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        type: 'condition',
        ticks: [0, 1000, 2000, 3000, 4000, 5000].map((atMs) => ({
          atMs,
          condition: 'Chilled',
          stacks: 1,
          duration: 1
        })),
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    comboFields: [
      {
        ownerId: 'ranger',
        fieldType: 'Poison',
        duration: 5,
        startAnchor: 'castEnd'
      }
    ]
  },
  [ID.NATURES_BINDING]: {
    implemented: true,
    effects: [],
    quicknessCastTimeMs: 500
  },
  [ID.UNLEASH_RANGER]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 1,
    // Both Unleash sides receive the same fixed, Alacrity-independent recharge.
    mechanicTriggers: [
      {
        type: 'ranger.untamed.sync-unleash-cooldown',
        timingAnchor: 'castEnd'
      }
    ],
    paletteTileId: UNLEASH_PALETTE_TILE,
    paletteTileOrder: 1,
    effects: [],
    handlerId: 'ranger.unleash-ranger'
  },
  [ID.EXPLODING_SPORES]: {
    implemented: true,
    effects: [
      {
        type: 'strike',
        coefficient: 0.583 * 6,
        hits: 6,
        atMs: 1640,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: Array.from({ length: 6 }, () => ({
          atMs: 1640,
          condition: 'Poisoned',
          stacks: 1,
          duration: 5
        })),
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'control',
        atMs: 1640,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        metadata: { controlKind: 'knockdown', duration: 2 }
      }
    ],
    quicknessCastTimeMs: 480,
    handlerId: 'ranger.exploding-spores'
  },
  [ID.FORESTS_FORTIFICATION]: {
    implemented: true,
    effects: [
      {
        type: 'boon',
        boon: 'stability',
        duration: 6,
        stacks: 10
      },
      {
        type: 'boon',
        boon: 'resistance',
        duration: 6,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'resolution',
        duration: 6,
        stacks: 1
      }
    ],
    quicknessCastTimeMs: 667
  },
  [ID.UNNATURAL_TRAVERSAL]: {
    implemented: true,
    effects: [
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 10,
        duration: 6
      }
    ],
    quicknessCastTimeMs: 167
  },
  [ID.VENOMOUS_OUTBURST]: {
    implemented: true,
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 3,
        duration: 8,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    handlerId: 'ranger.venomous-outburst'
  },
  [ID.MUTATE_CONDITIONS]: {
    implemented: true,
    effects: [
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 1,
        duration: 6
      }
    ],
    quicknessCastTimeMs: 333
  },
  [ID.RENDING_VINES]: {
    implemented: true,
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.3,
        hits: 1,
        source: 'ranger-pet',
        actorType: 'summon',
        comboFinishers: [
          {
            ownerId: 'ranger',
            finisherType: 'Blast',
            ambiguousFieldSelection: 'oldest'
          }
        ]
      },
      {
        type: 'condition',
        condition: 'Slow',
        stacks: 1,
        duration: 4,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ]
  },
  [ID.PERILOUS_GIFT]: {
    implemented: true,
    effects: [],
    quicknessCastTimeMs: 500
  },
  [ID.UNLEASH_PET]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 1,
    // Both Unleash sides receive the same fixed, Alacrity-independent recharge.
    mechanicTriggers: [
      {
        type: 'ranger.untamed.sync-unleash-cooldown',
        timingAnchor: 'castEnd'
      }
    ],
    paletteTileId: UNLEASH_PALETTE_TILE,
    paletteTileOrder: 2,
    effects: [],
    handlerId: 'ranger.unleash-pet'
  },
  [ID.RELENTLESS_WHIRL]: {
    implemented: true,
    interruptMode: 'per-packet',
    effects: [
      {
        type: 'strike',
        ticks: [360, 640, 920, 1200, 1480].map((atMs) => ({
          atMs,
          coefficient: 1
        })),
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'boon',
        boon: 'stability',
        duration: 3,
        stacks: 2,
        atMs: 360,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        sourceId: ID.EXPLODING_SPORE,
        name: 'Exploding Spore',
        ticks: [{ atMs: 1720, coefficient: 0.583 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        metadata: {
          skillName: 'Exploding Spore',
          parentSkillName: 'Relentless Whirl'
        }
      },
      {
        type: 'condition',
        sourceId: ID.EXPLODING_SPORE,
        name: 'Exploding Spore - Poisoned',
        ticks: [{ atMs: 1720, condition: 'Poisoned', stacks: 2, duration: 5 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        metadata: {
          skillName: 'Exploding Spore',
          parentSkillName: 'Relentless Whirl'
        }
      },
      {
        type: 'strike',
        sourceId: TRAIT.NATURAL_FORTITUDE,
        name: 'Natural Fortitude',
        ticks: [{ atMs: 360, coefficient: 0.005 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        canCrit: false,
        metadata: { damageKind: 'life-steal' }
      }
    ],
    quicknessCastTimeMs: 1560,
    handlerId: 'ranger.unleashed-ambush'
  },
  [ID.DEFT_STRIKE]: {
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 800, coefficient: 3 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'control',
        atMs: 800,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        metadata: { controlKind: 'daze', duration: 1 }
      },
      {
        type: 'strike',
        sourceId: ID.EXPLODING_SPORE,
        name: 'Exploding Spore',
        ticks: [{ atMs: 2160, coefficient: 0.583 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        metadata: {
          skillName: 'Exploding Spore',
          parentSkillName: 'Deft Strike'
        }
      },
      {
        type: 'condition',
        sourceId: ID.EXPLODING_SPORE,
        name: 'Exploding Spore - Poisoned',
        ticks: [{ atMs: 2160, condition: 'Poisoned', stacks: 2, duration: 5 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        metadata: {
          skillName: 'Exploding Spore',
          parentSkillName: 'Deft Strike'
        }
      },
      {
        type: 'strike',
        sourceId: TRAIT.NATURAL_FORTITUDE,
        name: 'Natural Fortitude',
        ticks: [{ atMs: 800, coefficient: 0.005 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        canCrit: false,
        metadata: { damageKind: 'life-steal' }
      }
    ],
    quicknessCastTimeMs: 960,
    handlerId: 'ranger.unleashed-ambush'
  }
});
