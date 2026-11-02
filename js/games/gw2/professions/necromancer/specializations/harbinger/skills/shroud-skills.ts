import { ACTOR, CONDITION, CONTROL } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { lifeForceGrant } from '#gw2/professions/necromancer/core/skills/life-force-grants.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { doomApproachesDarkBarrage } from '#gw2/professions/necromancer/specializations/harbinger/traits/behavior.js';
import type { NecromancerSkill } from '#gw2/professions/necromancer/types.js';

/** Supplies Harbinger Shroud definitions to specialization composition. */
export const HARBINGER_SHROUD_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition<NecromancerSkill>>> = {
  [ID.TAINTED_BOLTS]: {
    name: 'Tainted Bolts',
    icon: 'https://render.guildwars2.com/file/03AB6A0BA611767DA8A30A0D0E68CE580760EA34/2479402.png',
    cooldown: 0,
    skillWeapon: 'Hammer',
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    dhuumfireDuration: 1,
    type: 'Profession',
    slot: 'Weapon_1',
    shroud: 'harbinger',
    shroudSlot: 1,
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
    name: 'Exit Harbinger Shroud',
    icon: 'https://render.guildwars2.com/file/99465D6C7322FCB7B06AC7729F2A91BB243A09E4/2479401.png',
    type: 'Profession',
    slot: 'Profession_1',
    cooldown: 0,
    shroudExit: 'harbinger',
    // Custom: Enters/exits the selected shroud and updates life-force drain/state; see `core/mechanics/forms.ts` and `core/mechanics/resources.ts`.
    inputCategory: 'bar-swap',
    castTimeMs: 0,
    effects: [],
    // The skill owns this transaction; its shared helper retains state and lifetime rules.
    sideEffects: [{ on: 'castCommit', do: { type: 'necromancer.exit-shroud' } }]
  },
  [ID.DARK_BARRAGE]: {
    name: 'Dark Barrage',
    icon: 'https://render.guildwars2.com/file/3EBE1078EC053BA76F057D2F0758692F0C0D6CD3/2479393.png',
    cooldown: 6,
    skillWeapon: 'Hammer',
    // Trait-selected volley templates remain owned and independently patchable on Dark Barrage.
    doomApproachesPulseCount: 8,
    doomApproachesPulseInterval: 0.75 / 8,
    type: 'Profession',
    slot: 'Weapon_2',
    shroud: 'harbinger',
    shroudSlot: 2,
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
    name: 'Harbinger Shroud',
    icon: 'https://render.guildwars2.com/file/C9CA706909A104A509F594AADA150D680AA948BC/2479400.png',
    type: 'Profession',
    slot: 'Profession_1',
    cooldown: 10,
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
    name: 'Devouring Cut',
    icon: 'https://render.guildwars2.com/file/F4A01998B419F5A3B2EA7010107ED64AAE119369/2479392.png',
    cooldown: 8,
    skillWeapon: 'Hammer',
    // Empowerment spends this skill's Blight independently of its removable payload.
    blightCost: 5,
    // Recharge starts during the final 80 ms of the cast, including casts shortened by interruption.
    rechargeOffsetMs: -80,
    type: 'Profession',
    slot: 'Weapon_3',
    shroud: 'harbinger',
    shroudSlot: 3,
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
    name: 'Voracious Arc',
    icon: 'https://render.guildwars2.com/file/E338A042D7F5EDB705F5A5E033F330D3C25774C5/2479406.png',
    cooldown: 10,
    skillWeapon: 'Hammer',
    // Empowerment spends this skill's Blight independently of its removable payload.
    blightCost: 5,
    type: 'Profession',
    slot: 'Weapon_4',
    shroud: 'harbinger',
    shroudSlot: 4,
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
    name: 'Vital Draw',
    icon: 'https://render.guildwars2.com/file/71A90FD69C7E5F319B1E26F1A72CC7D65E93A84A/2479405.png',
    cooldown: 20,
    skillWeapon: 'Hammer',
    // Each accepted siphon funds the live pool only when its own strike arrives.

    type: 'Profession',
    slot: 'Weapon_5',
    shroud: 'harbinger',
    shroudSlot: 5,
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
            do: [lifeForceGrant({ id: 'life-force', unit: 'hit', grant: { percent: 3 } })]
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
};
