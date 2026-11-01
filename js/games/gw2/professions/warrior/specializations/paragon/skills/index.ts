/** Explicit PvE skill mechanics owned by the Paragon Warrior module. */
import { BOON, CONDITION } from '#gw2/platform/constants.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';

export const PARAGON_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = Object.freeze({
  [ID.WE_WILL_NEVER_YIELD]: {
    name: '"We Will Never Yield!"',
    description:
      "Command. Your allies' health cannot be reduced below zero for a short period of time. After this effect ends, grant barrier proportionate to their missing health. Certain boss skills may bypass the effect of this skill.\nEcho. Grant superspeed to nearby allies after a set interval or after you use a burst skill.",
    icon: 'https://render.guildwars2.com/file/C5740F0D6446CA01FCAA302D352D7F453E6A0709/3680223.png',
    type: 'Elite',
    slot: 'Elite',
    cooldown: 75,
    echoResourceGain: 0,
    // Each command owns the delay used for its initial and repeated echoes.
    pulseInterval: 3,
    skillFamily: 'Command',
    castTimeMs: 667,
    effects: [],
    // Echo identity belongs to the command; empty defensive echoes retain their lifetime.
    sideEffects: [{ on: 'castCommit', do: { type: 'warrior.command-arm', id: 'echo', effects: [] } }]
  },
  [ID.WE_SHALL_RETURN]: {
    name: '"We Shall Return!"',
    description:
      'Command.  Heal yourself and allies in an area around you. \nEcho.  Heals again and removes conditions on allies after a set interval or after you use a burst skill.',
    icon: 'https://render.guildwars2.com/file/40B2EEC2A1FA4A7D7DFB6BDE1EC3599C0D0EC100/3680224.png',
    type: 'Heal',
    slot: 'Heal',
    echoResourceGain: 10,
    cooldown: 20,
    // Each command owns the delay used for its initial and repeated echoes.
    pulseInterval: 3,
    skillFamily: 'Command',
    castTimeMs: 667,
    effects: [],
    // Echo identity belongs to the command; empty defensive echoes retain their lifetime.
    sideEffects: [{ on: 'castCommit', do: { type: 'warrior.command-arm', id: 'echo', effects: [] } }]
  },
  [ID.CHANT_OF_RECUPERATION]: {
    name: 'Chant of Recuperation',
    description:
      'Burst. Chant. Grants barrier to allies in an area around you. \n\nRefrain. After activation, continually pulses healing to allies while removing motivation stacks every interval. This effect lasts until you run out of motivation stacks or another chant is activated. Gain increased effects depending on motivation stacks:',
    icon: 'https://render.guildwars2.com/file/2D4B0C67FACAADD8612746BD6F5C6BE9A828C9A3/3680227.png',
    type: 'Profession',
    slot: 'Profession_3',
    cooldown: 15,
    resourceGain: 4,
    adrenalineCost: 10,
    burst: true,
    skillFamily: 'Chant',
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
    name: '"Find Their Weakness!"',
    description:
      'Command. Strike enemies around your target, inflicting vulnerability and spreading vulnerability from your original target to nearby enemies.\nEcho. Apply might to allies and gain adrenaline based on the number of enemies struck after a set interval or after you use a burst skill.',
    icon: 'https://render.guildwars2.com/file/B85CB2974032E620667B713B5A2980039C0A59BA/3680229.png',
    type: 'Utility',
    slot: 'Utility',
    echoResourceGain: 3,
    cooldown: 15,
    // Each command owns the delay used for its initial and repeated echoes.
    pulseInterval: 3,
    skillFamily: 'Command',
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
    name: '"On Your Knees!"',
    description:
      'Command. Damage and apply conditions to enemies around you.\nEcho. Damage and immobilize enemies after a set interval or after you use a burst skill.',
    icon: 'https://render.guildwars2.com/file/13DF51701AAAF9B150DEDABC5CB3901D3B430871/3680231.png',
    type: 'Utility',
    slot: 'Utility',
    echoResourceGain: 0,
    cooldown: 15,
    // Each command owns the delay used for its initial and repeated echoes.
    pulseInterval: 3,
    skillFamily: 'Command',
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
    name: 'Chant of Freedom',
    description:
      'Burst. Chant. Breaks stun from allies in an area around you. \n\nRefrain. When activated, continually applies swiftness to allies while removing motivation stacks every interval. This effect lasts until you run out of motivation stacks or another chant is activated. Gains increased effects depending on motivation stacks:',
    icon: 'https://render.guildwars2.com/file/52720B9628A24FE1034815E10F0AFACF5365F3C4/3680226.png',
    type: 'Profession',
    slot: 'Profession_4',
    cooldown: 25,
    resourceGain: 4,
    adrenalineCost: 10,
    burst: true,
    skillFamily: 'Chant',
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
    name: 'Chant of Action',
    description:
      'Burst. Chant. Applies boons to allies in an area around you.\n\nRefrain. After activation, continually applies boons to allies while removing motivation every interval. This effect lasts until you run out of motivation stacks or another chant is activated. Gain increased effects depending on motivation stacks:',
    icon: 'https://render.guildwars2.com/file/A4D0D740CF360E0840EF76282843109C759C63A8/3680225.png',
    type: 'Profession',
    slot: 'Profession_2',
    cooldown: 8,
    resourceGain: 4,
    adrenalineCost: 10,
    burst: true,
    skillFamily: 'Chant',
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
