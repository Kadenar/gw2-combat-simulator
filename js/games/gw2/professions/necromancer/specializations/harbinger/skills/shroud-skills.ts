import { ACTOR, CONDITION, CONTROL } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { lifeForceGrant } from '#gw2/professions/necromancer/core/skills/life-force-grants.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { doomApproachesDarkBarrage } from '#gw2/professions/necromancer/specializations/harbinger/traits/behavior.js';

/** Supplies Harbinger Shroud fragments to specialization composition. */
export const HARBINGER_SHROUD_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.TAINTED_BOLTS]: {
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    dhuumfireDuration: 1,
    type: 'Profession',
    slot: 'Weapon_1',
    shroud: 'harbinger',
    shroudSlot: 1,
    specialization: 'Harbinger',
    castTimeMs: 600,
    // Committed bolts retain their strike and Torment packets even if the remaining cast is interrupted.
    interruptCommitMs: 520,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true }, [
      {
        weaponStrengthProfileId: 'transform.harbinger-shroud',
        type: 'strike',
        ticks: [320, 600].map((atMs) => ({ atMs, coefficient: 0.6 }))
      },
      {
        type: 'condition',
        ticks: [320, 600].map((atMs) => ({ atMs, condition: CONDITION.TORMENT, stacks: 1, duration: 3 }))
      }
    ])
  },
  [ID.EXIT_HARBINGER_SHROUD]: {
    cooldown: 0,
    specialization: 'Harbinger',
    shroudExit: 'harbinger',
    // Custom: Enters/exits the selected shroud and updates life-force drain/state; see `core/mechanics/forms.ts` and `core/mechanics/resources.ts`.
    inputCategory: 'bar-swap',
    castTimeMs: 0,
    effects: [],
    // The skill owns this transaction; its shared helper retains state and lifetime rules.
    sideEffects: [{ on: 'castCommit', do: { type: 'necromancer.exit-shroud' } }]
  },
  [ID.DARK_BARRAGE]: {
    // Trait-selected volley templates remain owned and independently patchable on Dark Barrage.
    doomApproachesPulseCount: 8,
    doomApproachesPulseInterval: 0.75 / 8,
    type: 'Profession',
    slot: 'Weapon_2',
    shroud: 'harbinger',
    shroudSlot: 2,
    specialization: 'Harbinger',
    castTimeMs: 920,
    // Dark Barrage is a channel: interruption keeps each landed volley while 800 ms remains the full-damage cutoff.
    interruptMode: 'per-packet',
    interruptCommitMs: 800,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: [
      ...impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
        {
          weaponStrengthProfileId: 'transform.harbinger-shroud',
          type: 'strike',
          ticks: [600, 680, 680, 800, 800, 800].map((atMs) => ({ atMs, coefficient: 0.6 }))
        },
        {
          type: 'condition',
          ticks: [600, 680, 680, 800, 800, 800].map((atMs) => ({
            atMs,
            condition: CONDITION.TORMENT,
            stacks: 1,
            duration: 3
          }))
        }
      ]),
      { name: 'Doom Approaches Strike', packetLabel: 'doom-approaches', type: 'strike', coefficient: 0.6 },
      {
        name: 'Doom Approaches Torment',
        packetLabel: 'doom-approaches',
        type: 'condition',
        condition: CONDITION.TORMENT,
        stacks: 1,
        duration: 3
      }
    ],
    // Doom Approaches selects its skill-owned packet alternative once; the shared scheduler owns every selected pulse.
    effectVariants: doomApproachesDarkBarrage
  },
  [ID.HARBINGER_SHROUD]: {
    cooldown: 10,
    specialization: 'Harbinger',
    shroudEntry: 'harbinger',
    shroudTuning: { kind: 'trait', id: TRAIT.DARK_DISCIPLE },
    minimumShroudLifeForcePercent: 0,
    // Custom: Enters/exits the selected shroud and updates life-force drain/state; see `core/mechanics/forms.ts` and `core/mechanics/resources.ts`.
    inputCategory: 'bar-swap',
    castTimeMs: 0,
    effects: [],
    // The skill owns this transaction; its shared helper retains state and lifetime rules.
    sideEffects: [{ on: 'castCommit', do: { type: 'necromancer.enter-shroud' } }]
  },
  [ID.DEVOURING_CUT]: {
    // Empowerment spends this skill's Blight independently of its removable payload.
    blightCost: 5,
    // Recharge starts during the final 80 ms of the cast, including casts shortened by interruption.
    rechargeOffsetMs: -80,
    type: 'Profession',
    slot: 'Weapon_3',
    shroud: 'harbinger',
    shroudSlot: 3,
    specialization: 'Harbinger',
    castTimeMs: 480,
    interruptCommitMs: 280,
    effects: [
      {
        weaponStrengthProfileId: 'transform.harbinger-shroud',
        name: 'Strike',
        type: 'strike',
        coefficient: 1,
        hits: 1
      }
    ],
    effectVariants: [{ when: () => true, transform: () => [] }],
    // Sample empowerment at the authored launch boundary, not at cast acceptance.
    sideEffects: [
      {
        on: 'castStart',
        do: {
          type: 'harbinger.movement-launch',
          id: 'empowered',
          effects: [
            { name: 'Strike', type: 'strike', coefficient: 2, hits: 1, actorType: ACTOR.PLAYER },
            {
              name: CONDITION.TORMENT,
              type: 'condition',
              condition: CONDITION.TORMENT,
              stacks: 5,
              duration: 5,
              actorType: ACTOR.PLAYER
            }
          ],
          amount: 0.75
        }
      }
    ]
  },
  [ID.VORACIOUS_ARC]: {
    // Empowerment spends this skill's Blight independently of its removable payload.
    blightCost: 5,
    type: 'Profession',
    slot: 'Weapon_4',
    shroud: 'harbinger',
    shroudSlot: 4,
    specialization: 'Harbinger',
    castTimeMs: 840,
    effects: [
      {
        weaponStrengthProfileId: 'transform.harbinger-shroud',
        name: 'Strike',
        type: 'strike',
        coefficient: 1.4,
        hits: 1
      },
      { type: 'control', controlKind: CONTROL.DAZE }
    ],
    effectVariants: [{ when: () => true, transform: () => [] }],
    // Sample empowerment at the authored launch boundary, not at cast acceptance.
    sideEffects: [
      {
        on: 'castStart',
        do: {
          type: 'harbinger.movement-launch',
          id: 'empowered',
          effects: [
            { name: 'Strike', type: 'strike', coefficient: 2.8, hits: 1, actorType: ACTOR.PLAYER },
            {
              name: CONDITION.TORMENT,
              type: 'condition',
              condition: CONDITION.TORMENT,
              stacks: 5,
              duration: 7,
              actorType: ACTOR.PLAYER
            }
          ],
          amount: 20 / 21
        }
      }
    ]
  },
  [ID.VITAL_DRAW]: {
    // Each accepted siphon funds the live pool only when its own strike arrives.

    type: 'Profession',
    slot: 'Weapon_5',
    shroud: 'harbinger',
    shroudSlot: 5,
    specialization: 'Harbinger',
    castTimeMs: 800,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        weaponStrengthProfileId: 'transform.harbinger-shroud',
        type: 'strike',
        // Accepted strikes apply their declared percentage through the shared resource owner.
        reactions: [
          {
            on: 'damage.resolved',
            actor: ACTOR.PLAYER,
            packets: 'each',
            when: (_runtime, { event }) => Number(event.coefficient) > 0,
            do: lifeForceGrant({ id: 'life-force', unit: 'hit', grant: { percent: 3 } })
          }
        ],
        ticks: [760, 1760, 2760].map((atMs) => ({ atMs, coefficient: 0.4 }))
      },
      {
        type: 'control',
        applications: 3,
        atMs: 760,
        intervalMs: 1000,
        controlKind: CONTROL.FLOAT
      }
    ])
  }
});
