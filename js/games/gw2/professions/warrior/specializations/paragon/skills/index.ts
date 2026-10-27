import { BOON, CONDITION } from '#gw2/platform/constants.js';
/** Explicit PvE skill mechanics owned by the Paragon Warrior module. */
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';
import type { Skill } from '#gw2/platform/skills/types.js';

export const PARAGON_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.WE_WILL_NEVER_YIELD]: {
    echoResourceGain: 0,
    // Each command owns the delay used for its initial and repeated echoes.
    pulseInterval: 3,
    categories: ['Command'],
    castTimeMs: 667,

    effects: [],
    // Echo identity belongs to the command; empty defensive echoes retain their lifetime.
    sideEffects: [{ on: 'castCommit', do: { type: 'warrior.command-arm', id: 'echo', effects: [] } }]
  },
  [ID.WE_SHALL_RETURN]: {
    echoResourceGain: 10,
    cooldown: 20,
    // Each command owns the delay used for its initial and repeated echoes.
    pulseInterval: 3,
    categories: ['Command'],
    castTimeMs: 667,
    effects: [],
    // Echo identity belongs to the command; empty defensive echoes retain their lifetime.
    sideEffects: [{ on: 'castCommit', do: { type: 'warrior.command-arm', id: 'echo', effects: [] } }]
  },
  [ID.CHANT_OF_RECUPERATION]: {
    resourceGain: 4,
    adrenalineCost: 10,
    burst: true,
    categories: ['Burst', 'Chant'],
    castTimeMs: 320,
    dualWieldCastTimeMs: 240,
    effects: [],
    // Successful activation replaces the refrain; each pulse selects its recipe before spending.
    sideEffects: [
      {
        on: 'castCommit',
        do: {
          type: 'warrior.chant-activate',
          id: 'chant',
          effects: [
            { type: 'boon', name: `Entry ${BOON.VIGOR}`, boon: BOON.VIGOR, stacks: 1, duration: 5 },
            { type: 'boon', name: `Refrain ${BOON.REGENERATION}`, boon: BOON.REGENERATION, stacks: 1, duration: 3 }
          ]
        }
      }
    ]
  },
  [ID.FIND_THEIR_WEAKNESS]: {
    echoResourceGain: 3,
    cooldown: 15,
    // Each command owns the delay used for its initial and repeated echoes.
    pulseInterval: 3,
    categories: ['Command'],
    castTimeMs: 333,
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1
      },
      {
        type: 'condition',
        condition: CONDITION.VULNERABILITY,
        stacks: 10,
        duration: 10
      },
      {
        type: 'boon',
        boon: BOON.MIGHT,
        duration: 10,
        stacks: 7
      }
    ],
    // Echo identity belongs to the command; empty defensive echoes retain their lifetime.

    // The initial reward precedes echo arming; later rewards remain with echo consumption.
    sideEffects: [
      {
        on: 'castCommit',
        do: {
          type: 'resourceGrant',
          resource: 'adrenaline',
          id: 'adrenaline-gained',
          label: 'Adrenaline gained',
          amount: 3
        }
      },
      {
        on: 'castCommit',
        do: {
          type: 'warrior.command-arm',
          id: 'echo',
          effects: [{ type: 'boon', name: 'might', boon: BOON.MIGHT, stacks: 7, duration: 10 }]
        }
      }
    ]
  },
  [ID.ON_YOUR_KNEES]: {
    echoResourceGain: 0,
    cooldown: 15,
    // Each command owns the delay used for its initial and repeated echoes.
    pulseInterval: 3,
    categories: ['Command'],
    castTimeMs: 167,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1
      },
      {
        type: 'condition',
        condition: CONDITION.CRIPPLED,
        stacks: 1,
        duration: 6
      },
      {
        type: 'condition',
        condition: CONDITION.WEAKNESS,
        stacks: 1,
        duration: 6
      }
    ],
    // Echo identity belongs to the command; empty defensive echoes retain their lifetime.
    sideEffects: [
      {
        on: 'castCommit',
        do: {
          type: 'warrior.command-arm',
          id: 'echo',
          effects: [
            { type: 'strike', name: 'Echo Damage', coefficient: 1.5, hits: 1 },
            { type: 'condition', name: 'Echo Immobilized', condition: CONDITION.IMMOBILIZED, stacks: 1, duration: 2 }
          ]
        }
      }
    ]
  },
  [ID.CHANT_OF_FREEDOM]: {
    resourceGain: 4,
    adrenalineCost: 10,
    burst: true,
    categories: ['Burst', 'Chant'],
    castTimeMs: 320,
    dualWieldCastTimeMs: 240,
    effects: [],
    // Successful activation replaces the refrain; each pulse selects its recipe before spending.
    sideEffects: [
      {
        on: 'castCommit',
        do: {
          type: 'warrior.chant-activate',
          id: 'chant',
          effects: [
            { type: 'boon', name: `Entry ${BOON.STABILITY}`, boon: BOON.STABILITY, stacks: 1, duration: 3 },
            { type: 'boon', name: `Refrain ${BOON.SWIFTNESS}`, boon: BOON.SWIFTNESS, stacks: 1, duration: 3 },
            { type: 'boon', name: `Refrain ${BOON.RESOLUTION}`, boon: BOON.RESOLUTION, stacks: 1, duration: 3 },
            { type: 'boon', name: `Refrain ${BOON.PROTECTION}`, boon: BOON.PROTECTION, stacks: 1, duration: 3 }
          ]
        }
      }
    ]
  },
  [ID.CHANT_OF_ACTION]: {
    resourceGain: 4,
    adrenalineCost: 10,
    burst: true,
    categories: ['Burst', 'Chant'],
    castTimeMs: 320,
    dualWieldCastTimeMs: 240,
    effects: [],
    // Successful activation replaces the refrain; each pulse selects its recipe before spending.
    sideEffects: [
      {
        on: 'castCommit',
        do: {
          type: 'warrior.chant-activate',
          id: 'chant',
          effects: [
            { type: 'boon', name: `Entry ${BOON.MIGHT}`, boon: BOON.MIGHT, stacks: 5, duration: 8 },
            { type: 'boon', name: `Entry ${BOON.FURY}`, boon: BOON.FURY, stacks: 1, duration: 5 },
            { type: 'boon', name: `Refrain ${BOON.MIGHT}`, boon: BOON.MIGHT, stacks: 1, duration: 8 },
            { type: 'boon', name: `Refrain ${BOON.FURY}`, boon: BOON.FURY, stacks: 1, duration: 5 }
          ]
        }
      }
    ]
  }
});

/** Skill-owned refrain recipes are reused by both cast activation and Call to Action. */
export const paragonRefrains: Readonly<
  Record<
    number,
    {
      readonly openingBoons: readonly string[];
      readonly pulse: (tier: number) => { readonly cost: number; readonly kinds: readonly string[] };
    }
  >
> = {
  [ID.CHANT_OF_RECUPERATION]: {
    openingBoons: [BOON.VIGOR],
    pulse: (tier) => ({ cost: tier === 3 ? 3 : 2, kinds: tier === 3 ? [BOON.REGENERATION] : [] })
  },
  [ID.CHANT_OF_FREEDOM]: {
    openingBoons: [BOON.STABILITY],
    pulse: (tier) => ({
      cost: tier,
      kinds: [BOON.SWIFTNESS, ...(tier >= 2 ? [BOON.RESOLUTION] : []), ...(tier === 3 ? [BOON.PROTECTION] : [])]
    })
  },
  [ID.CHANT_OF_ACTION]: {
    openingBoons: [BOON.MIGHT, BOON.FURY],
    pulse: (tier) => ({ cost: 1, kinds: tier >= 2 ? [BOON.MIGHT, BOON.FURY] : [BOON.MIGHT] })
  }
};
