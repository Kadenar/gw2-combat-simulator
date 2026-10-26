import { triggeredVirtueEffects } from '#gw2/professions/guardian/core/skills/virtue-payloads.js';
import { ACTOR, CONTROL, BOON, CONDITION } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';
import { soaringDevastationEffects } from '#gw2/professions/guardian/specializations/dragonhunter/traits/behavior.js';

/**
 * Owns Dragonhunter virtue and trap skill fragments.
 * Runtime virtue and trap behavior remains under `mechanics/` and `execution/virtues.ts`.
 */

export const DRAGONHUNTER_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.SPEAR_OF_JUSTICE]: {
    // The landed tether owns these deferred condition templates and its cadence.
    duration: 6,
    tetherInterval: 1,
    effectVariants: [triggeredVirtueEffects],
    castTimeMs: 560,
    // The virtue commits at 520 ms, allowing the remaining animation to be cancelled.
    interruptCommitMs: 520,
    cooldown: 20,
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
            when: (_runtime, { event, details }) =>
              Number(event.coefficient) > 0 && Number(details.hitContext?.damage) > 0,
            do: { type: 'guardian.attach-tether' }
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
    ]
  },
  [ID.PURIFICATION]: {
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
    // Passive Aegis is delivered only by the readiness-aware scheduler.
    passiveInterval: 40,
    effectVariants: [triggeredVirtueEffects],
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
    ]
  },
  [ID.WINGS_OF_RESOLVE]: {
    // The added strike and condition keep the weapon wielded at acceptance and the base virtue's effects.
    effectVariants: [soaringDevastationEffects],
    castTimeMs: 0,
    cooldown: 25,
    effects: []
  },
  [ID.DRAGONS_MAW]: {
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
    // Only a committed verdict breaks the live tether.
    sideEffects: [{ on: 'castCommit', do: { type: 'guardian.break-tether' } }],
    castTimeMs: 0,
    cooldown: 40,
    effects: [
      {
        type: 'control',
        controlKind: CONTROL.PULL
      }
    ]
  }
});
