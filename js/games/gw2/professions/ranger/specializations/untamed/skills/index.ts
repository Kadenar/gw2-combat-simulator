/**
 * Owns Untamed Unleash, ambush, and specialization skill catalog fragments only.
 * Persistent Unleash state and transitions live under `mechanics/`.
 */
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import { impactEffects } from '#gw2/platform/engine/effects/authoring.js';
import { untamedState } from '#gw2/professions/ranger/specializations/untamed/state.js';
import { UNTAMED_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/ranger/specializations/untamed/profiles.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';

// Both Unleash actions replace the same F5 tile as control passes between pet and ranger.
const UNLEASH_PALETTE_TILE = 'ranger-untamed-unleash';

// Share adjacent impact timing while preserving local payloads, attribution, and independent timelines.
export const UNTAMED_BASE_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.ENVELOPING_HAZE]: {
    castTimeMs: 0,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        ticks: [0, 1000, 2000, 3000, 4000, 5000].map((atMs) => ({
          atMs,
          coefficient: 1.75 / 6
        })),
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
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ]),
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
    effects: [],
    castTimeMs: 500
  },
  [ID.UNLEASH_RANGER]: {
    // Transfers require commitment; ambush attempts spend their opportunity even on cancellation.
    sideEffects: [{ on: 'castCommit', do: { type: 'ranger.unleash-ranger' } }],
    castTimeMs: 0,
    cooldown: 1,
    // Both Unleash sides receive the same fixed, Alacrity-independent recharge.

    paletteTileId: UNLEASH_PALETTE_TILE,
    paletteTileOrder: 1,
    effects: []
  },
  [ID.EXPLODING_SPORES]: {
    // Capture Unleash at acceptance, adding the selected live boon to the skill's hostile packets.
    effectVariants: (
      [
        [true, PROFILE.explodingSporesRanger, 'might'],
        [false, PROFILE.explodingSporesPet, 'protection']
      ] as const
    ).map<NonNullable<Skill['effectVariants']>[number]>(([unleashed, profileId, boon]) => ({
      when: (runtime) => untamedState.from(runtime).rangerUnleashed === unleashed,
      profileId,
      transform: (_runtime, cast, effects) => [
        ...(cast.skill.effects ?? []),
        ...effects
          .filter((effect) => effect.type === 'boon' && effect.name === boon)
          .map((effect) => ({ ...effect, timingAnchor: 'castEnd' as const, atMs: 0 }))
      ]
    })),
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 0.583 * 6,
        hits: 6,
        atMs: 1640
      },
      {
        type: 'condition',
        ticks: Array.from({ length: 6 }, () => ({
          atMs: 1640,
          condition: 'Poisoned',
          stacks: 1,
          duration: 5
        }))
      },
      {
        type: 'control',
        atMs: 1640,
        controlKind: 'knockdown'
      }
    ]),
    castTimeMs: 480
  },
  [ID.FORESTS_FORTIFICATION]: {
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
    castTimeMs: 667
  },
  [ID.VENOMOUS_OUTBURST]: {
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
      },
      {
        // Capture defiant-target eligibility at acceptance while retaining pet ownership.
        type: 'condition',
        when: (runtime) => Boolean(runtime.config.target?.defiant),
        condition: 'Vulnerability',
        stacks: 8,
        duration: 10,
        source: 'ranger-pet',
        actorType: 'summon',
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        atMs: 0
      }
    ]
  },
  [ID.RENDING_VINES]: {
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
    effects: [],
    castTimeMs: 500
  },
  [ID.UNLEASH_PET]: {
    // Transfers require commitment; ambush attempts spend their opportunity even on cancellation.
    sideEffects: [{ on: 'castCommit', do: { type: 'ranger.unleash-pet' } }],
    castTimeMs: 0,
    cooldown: 1,
    // Both Unleash sides receive the same fixed, Alacrity-independent recharge.

    paletteTileId: UNLEASH_PALETTE_TILE,
    paletteTileOrder: 2,
    effects: []
  },
  [ID.RELENTLESS_WHIRL]: {
    // Transfers require commitment; ambush attempts spend their opportunity even on cancellation.
    sideEffects: [{ on: 'castStart', do: { type: 'ranger.ambush-consume' } }],
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
      ...impactEffects({ atMs: 1720, timingAnchor: 'castStart', timingScale: 'fixed' }, [
        {
          type: 'strike',
          sourceId: ID.EXPLODING_SPORE,
          name: 'Exploding Spore',
          coefficient: 0.583,
          skillName: 'Exploding Spore',
          parentSkillName: 'Relentless Whirl'
        },
        {
          type: 'condition',
          sourceId: ID.EXPLODING_SPORE,
          name: 'Exploding Spore - Poisoned',
          condition: 'Poisoned',
          stacks: 2,
          duration: 5,
          skillName: 'Exploding Spore',
          parentSkillName: 'Relentless Whirl'
        }
      ]),
      {
        type: 'strike',
        sourceId: TRAIT.NATURAL_FORTITUDE,
        name: 'Natural Fortitude',
        ticks: [{ atMs: 360, coefficient: 0.005 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        canCrit: false,
        damageKind: 'life-steal'
      }
    ],
    castTimeMs: 1560
  },
  [ID.DEFT_STRIKE]: {
    // Transfers require commitment; ambush attempts spend their opportunity even on cancellation.
    sideEffects: [{ on: 'castStart', do: { type: 'ranger.ambush-consume' } }],
    effects: [
      ...impactEffects({ atMs: 800, timingAnchor: 'castStart', timingScale: 'fixed' }, [
        {
          type: 'strike',
          coefficient: 3
        },
        {
          type: 'control',
          controlKind: 'daze'
        }
      ]),
      ...impactEffects({ atMs: 2160, timingAnchor: 'castStart', timingScale: 'fixed' }, [
        {
          type: 'strike',
          sourceId: ID.EXPLODING_SPORE,
          name: 'Exploding Spore',
          coefficient: 0.583,
          skillName: 'Exploding Spore',
          parentSkillName: 'Deft Strike'
        },
        {
          type: 'condition',
          sourceId: ID.EXPLODING_SPORE,
          name: 'Exploding Spore - Poisoned',
          condition: 'Poisoned',
          stacks: 2,
          duration: 5,
          skillName: 'Exploding Spore',
          parentSkillName: 'Deft Strike'
        }
      ]),
      {
        type: 'strike',
        sourceId: TRAIT.NATURAL_FORTITUDE,
        name: 'Natural Fortitude',
        ticks: [{ atMs: 800, coefficient: 0.005 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        canCrit: false,
        damageKind: 'life-steal'
      }
    ],
    castTimeMs: 960
  }
});
