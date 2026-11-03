import { ACTOR, BOON, CONDITION, CONTROL } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { triggeredVirtueEffects } from '#gw2/professions/guardian/core/skills/virtue-payloads.js';
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';
import { soaringDevastationEffects } from '#gw2/professions/guardian/specializations/dragonhunter/traits/behavior.js';
import type { GuardianSkill } from '#gw2/professions/guardian/types.js';

/**
 * Owns Dragonhunter virtue and trap skill definitions.
 * Runtime virtue and trap behavior remains under `mechanics/` and `execution/virtues.ts`.
 */

export const DRAGONHUNTER_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition<GuardianSkill>>> = {
  [ID.SPEAR_OF_JUSTICE]: {
    name: 'Spear of Justice',
    icon: 'https://render.guildwars2.com/file/05BF0016EC3AF1EE01F6C405C3BB01EE6CAAE095/1012863.png',
    type: 'Profession',
    slot: 'Profession_1',
    virtue: 'justice',
    // The landed tether owns these deferred condition templates and its cadence.
    duration: 6,
    tetherInterval: 1,
    cooldown: 20,
    castTimeMs: 560,
    // The virtue commits at 520 ms, allowing the remaining animation to be cancelled.
    interruptCommitMs: 520,
    effects: [
      {
        type: 'condition',
        name: 'Burning',
        condition: CONDITION.BURNING,
        stacks: 1,
        duration: 2,
        actorType: ACTOR.PLAYER,
        metadata: {
          trigger: 'virtue'
        }
      },
      {
        type: 'condition',
        name: 'Crippled (passive)',
        condition: CONDITION.CRIPPLED,
        stacks: 1,
        duration: 1.5,
        actorType: ACTOR.PLAYER,
        packetLabel: 'passive',
        metadata: {
          trigger: 'virtue'
        }
      },
      {
        type: 'strike',
        // The landed spear owns attachment; the tether controller retains commitment and replacement lifetime.
        reactions: [
          {
            on: 'damage.resolved',
            actor: ACTOR.PLAYER,
            packets: 'each',
            when: (_runtime, { event, details }) => Number(event.coefficient) > 0 && details.hitContext.damage > 0,
            do: [{ type: 'guardian.attach-tether' }]
          }
        ],
        coefficient: 0.8,
        hits: 1,
        // The spear hits before the remaining virtue animation releases the action lane.
        atMs: 520,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        weaponStrengthSource: 'equipped'
      }
    ],
    effectVariants: [triggeredVirtueEffects]
  },
  [ID.PURIFICATION]: {
    name: 'Purification',
    icon: 'https://render.guildwars2.com/file/07382144AF0B367539A7EF6AD61D7DCCA26759AC/1012868.png',
    type: 'Heal',
    slot: 'Heal',
    skillFamily: 'Trap',
    cooldown: 24,
    castTimeMs: 600,
    // Keep trap damage and blindness on the same delayed trigger.
    effects: impactEffects({ atMs: 1560, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        // Damage and blindness arrive after the trap's placement and trigger delay.
        coefficient: 0.1875
      },
      {
        type: 'condition',
        condition: CONDITION.BLINDNESS,
        stacks: 1,
        duration: 6
      }
    ])
  },
  [ID.SHIELD_OF_COURAGE]: {
    name: 'Shield of Courage',
    icon: 'https://render.guildwars2.com/file/09DE3F47930AFF2B2B3F4C20A401DCA9DC7344CC/1012865.png',
    type: 'Profession',
    slot: 'Profession_3',
    virtue: 'courage',
    cooldown: 45,
    // Passive Aegis is delivered only by the readiness-aware scheduler.
    passiveInterval: 40,
    castTimeMs: 0,
    effects: [
      {
        type: 'boon',
        name: 'aegis',
        boon: BOON.AEGIS,
        stacks: 1,
        duration: 20,
        metadata: {
          trigger: 'virtue'
        }
      }
    ],
    effectVariants: [triggeredVirtueEffects]
  },
  [ID.WINGS_OF_RESOLVE]: {
    name: 'Wings of Resolve',
    icon: 'https://render.guildwars2.com/file/A054A5300BF26FBAA601611BDA07B6001830FF92/1012864.png',
    type: 'Profession',
    slot: 'Profession_2',
    virtue: 'resolve',
    cooldown: 25,
    castTimeMs: 0,
    effects: [],
    // The added strike and condition keep the weapon wielded at acceptance and the base virtue's effects.
    effectVariants: [soaringDevastationEffects]
  },
  [ID.DRAGONS_MAW]: {
    name: "Dragon's Maw",
    icon: 'https://render.guildwars2.com/file/71FF4F27E1404DAD3EB1A63A4214A9797F740810/1024103.png',
    type: 'Elite',
    slot: 'Elite',
    skillFamily: 'Trap',
    cooldown: 40,
    castTimeMs: 440,
    // Group the closing jaws' effects while Might retains its earlier trigger.
    effects: [
      ...impactEffects({ atMs: 1400, timingAnchor: 'castStart', timingScale: 'fixed' }, [
        {
          type: 'strike',
          // The closing maw deals damage and applies control after its initial trigger.
          coefficient: 3.6
        },
        {
          type: 'control',
          controlKind: CONTROL.PULL
        },
        {
          type: 'condition',
          condition: CONDITION.SLOW,
          stacks: 1,
          duration: 4
        }
      ]),
      {
        type: 'boon',
        boon: BOON.MIGHT,
        stacks: 10,
        duration: 8,
        // Might is granted when the trap triggers, before the jaws deal damage.
        atMs: 880,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.PROCESSION_OF_BLADES]: {
    name: 'Procession of Blades',
    icon: 'https://render.guildwars2.com/file/D891D0C60ED609CB5C65ECFED69D3FFF077FD3E4/1012878.png',
    type: 'Utility',
    slot: 'Utility',
    skillFamily: 'Trap',
    cooldown: 16,
    castTimeMs: 440,
    effects: [
      {
        type: 'strike',
        // Include the cast windup: the first blade hits at 1720 ms, then pulses every 280 ms.
        ticks: [1720, 2000, 2280, 2560, 2840, 3120, 3400, 3680, 3960, 4240].map((atMs) => ({
          atMs,
          coefficient: 0.44
        })),
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.FRAGMENTS_OF_FAITH]: {
    name: 'Fragments of Faith',
    icon: 'https://render.guildwars2.com/file/32106907940C3F0AB9E771C014BF59D4DE285241/1012877.png',
    type: 'Utility',
    slot: 'Utility',
    skillFamily: 'Trap',
    cooldown: 25,
    castTimeMs: 200,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1
      }
    ]
  },
  [ID.HUNTERS_VERDICT]: {
    name: "Hunter's Verdict",
    icon: 'https://render.guildwars2.com/file/02C8A032F60414D0FAB7D0AFD965B5BA0947D6F8/103703.png',
    type: 'Profession',
    slot: 'Profession_1',
    cooldown: 40,
    castTimeMs: 0,
    effects: [
      {
        type: 'control',
        controlKind: CONTROL.PULL
      }
    ],
    // Only a committed verdict breaks the live tether.
    sideEffects: [{ on: 'castCommit', do: { type: 'guardian.break-tether' } }]
  }
};
