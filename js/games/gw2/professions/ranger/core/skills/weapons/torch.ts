/** Canonical Core ranger skill definitions grouped by their GW2 owner. */
import { COMBO_FIELD, CONDITION } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';

export const RANGER_CORE_TORCH_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = Object.freeze({
  [ID.THROW_TORCH]: {
    name: 'Throw Torch',
    description: 'Throw your torch and burn your foes in an area.',
    icon: 'https://render.guildwars2.com/file/10A02F01D7021C39049292DAEEC14E690CE5460B/102988.png',
    type: 'Weapon',
    weapon: 'Torch',
    slot: 'Weapon_4',
    cooldown: 15,
    ammo: 2,

    ammoCastLockout: 1,
    castTimeMs: 440,
    interruptCommitMs: 400,
    effects: impactEffects({ atMs: 400, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 0.666,
        hits: 1
      },
      {
        type: 'condition',
        condition: CONDITION.BURNING,
        stacks: 1,
        duration: 10
      },
      {
        type: 'condition',
        condition: CONDITION.BLINDNESS,
        stacks: 1,
        duration: 3
      }
    ])
  },
  [ID.BONFIRE]: {
    name: 'Bonfire',
    description: 'Set a fire around you, damaging and burning foes.',
    icon: 'https://render.guildwars2.com/file/9C7194F175325315B12FC274F1CA48D094C25AD3/103532.png',
    type: 'Weapon',
    weapon: 'Torch',
    slot: 'Weapon_5',
    cooldown: 25,
    // Match the measured Quickness animation from the benchmark EVTC.
    castTimeMs: 560,
    // Once placed, Bonfire keeps its pulses and combo field when the remaining animation is interrupted.
    interruptCommitMs: 520,
    comboFields: [
      {
        ownerId: 'ranger',
        fieldType: COMBO_FIELD.FIRE,
        duration: 8,
        startAnchor: 'castEnd'
      }
    ],
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        ticks: Array.from({ length: 9 }, (_, index) => ({
          atMs: index * 1000,
          coefficient: 0.1
        }))
      },
      {
        type: 'condition',
        ticks: [
          { atMs: 0, condition: CONDITION.BURNING, stacks: 3, duration: 5 },
          ...Array.from({ length: 8 }, (_, index) => ({
            atMs: (index + 1) * 1000,
            condition: CONDITION.BURNING,
            stacks: 1,
            duration: 1
          }))
        ]
      }
    ])
  }
});
