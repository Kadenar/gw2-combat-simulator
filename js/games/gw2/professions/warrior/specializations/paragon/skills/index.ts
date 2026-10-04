/** Explicit PvE skill mechanics owned by the Paragon Warrior module. */
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { PARAGON_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/warrior/specializations/paragon/profiles.js';

export const PARAGON_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.WE_WILL_NEVER_YIELD]: {
    // Echo identity belongs to the command; empty defensive echoes retain their lifetime.
    sideEffects: [{ on: 'castCommit', do: { type: 'warrior.command-arm' } }],

    effects: [],
    castTimeMs: 667,
    categories: ['Command']
  },
  [ID.WE_SHALL_RETURN]: {
    // Echo identity belongs to the command; empty defensive echoes retain their lifetime.
    sideEffects: [{ on: 'castCommit', do: { type: 'warrior.command-arm' } }],

    cooldown: 20,
    effects: [],
    castTimeMs: 667,
    categories: ['Command']
  },
  [ID.CHANT_OF_RECUPERATION]: {
    // Successful activation replaces the refrain; each pulse selects its recipe before spending.
    sideEffects: [{ on: 'castCommit', do: { type: 'warrior.chant-activate' } }],
    effects: [],
    castTimeMs: 167,
    adrenalineCost: 10,
    burst: true,
    categories: ['Burst', 'Chant']
  },
  [ID.FIND_THEIR_WEAKNESS]: {
    // Echo identity belongs to the command; empty defensive echoes retain their lifetime.

    // The initial reward precedes echo arming; later rewards remain with echo consumption.
    sideEffects: [
      { on: 'castCommit', do: { type: 'warrior.adrenaline', amount: 3 } },
      { on: 'castCommit', do: { type: 'warrior.command-arm' } }
    ],
    cooldown: 15,
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 10,
        duration: 10
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 10,
        stacks: 7
      }
    ],
    castTimeMs: 333,
    categories: ['Command']
  },
  [ID.ON_YOUR_KNEES]: {
    // Echo identity belongs to the command; empty defensive echoes retain their lifetime.
    sideEffects: [{ on: 'castCommit', do: { type: 'warrior.command-arm' } }],

    cooldown: 15,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 6
      },
      {
        type: 'condition',
        condition: 'Weakness',
        stacks: 1,
        duration: 6
      }
    ],
    castTimeMs: 167,
    categories: ['Command']
  },
  [ID.CHANT_OF_FREEDOM]: {
    // Successful activation replaces the refrain; each pulse selects its recipe before spending.
    sideEffects: [{ on: 'castCommit', do: { type: 'warrior.chant-activate' } }],
    effects: [],
    castTimeMs: 167,
    adrenalineCost: 10,
    burst: true,
    categories: ['Burst', 'Chant']
  },
  [ID.CHANT_OF_ACTION]: {
    // Successful activation replaces the refrain; each pulse selects its recipe before spending.
    sideEffects: [{ on: 'castCommit', do: { type: 'warrior.chant-activate' } }],
    effects: [],
    castTimeMs: 167,
    adrenalineCost: 10,
    burst: true,
    categories: ['Burst', 'Chant']
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
    openingBoons: ['vigor'],
    pulse: (tier) => ({ cost: tier === 3 ? 3 : 2, kinds: tier === 3 ? ['regeneration'] : [] })
  },
  [ID.CHANT_OF_FREEDOM]: {
    openingBoons: ['stability'],
    pulse: (tier) => ({
      cost: tier,
      kinds: ['swiftness', ...(tier >= 2 ? ['resolution'] : []), ...(tier === 3 ? ['protection'] : [])]
    })
  },
  [ID.CHANT_OF_ACTION]: {
    openingBoons: ['might', 'fury'],
    pulse: (tier) => ({ cost: 1, kinds: tier >= 2 ? ['might', 'fury'] : ['might'] })
  }
};

/** Echo payload identities live with their commands; missing payloads retain an empty echo lifetime. */
export const PARAGON_COMMAND_ECHO_PROFILES: Readonly<Partial<Record<number, string>>> = {
  [ID.WE_SHALL_RETURN]: PROFILE.weShallReturnEcho,
  [ID.FIND_THEIR_WEAKNESS]: PROFILE.findTheirWeaknessEcho,
  [ID.ON_YOUR_KNEES]: PROFILE.onYourKneesEcho
};
