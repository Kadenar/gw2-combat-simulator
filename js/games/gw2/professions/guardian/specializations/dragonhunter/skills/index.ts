/**
 * Owns Dragonhunter virtue and trap skill fragments.
 * Runtime virtue and trap behavior remains under `mechanics/` and `execution/virtues.ts`.
 */
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { gw2ActivePrimaryWeapon } from '#gw2/platform/equipment/weapons/loadout.js';
import { DRAGONHUNTER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/guardian/specializations/dragonhunter/profiles.js';
import { GUARDIAN_SKILL_IDS as ID, GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';
import { impactEffects } from '#gw2/platform/engine/effects/authoring.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';

export const DRAGONHUNTER_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.SPEAR_OF_JUSTICE]: {
    castTimeMs: 560,
    // The virtue commits at 520 ms, allowing the remaining animation to be cancelled.
    interruptCommitMs: 520,
    cooldown: 20,
    effects: [
      {
        type: 'strike',
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
        type: 'blind',
        duration: 6
      }
    ])
  },
  [ID.SHIELD_OF_COURAGE]: {
    castTimeMs: 0,
    effects: []
  },
  [ID.WINGS_OF_RESOLVE]: {
    // The added strike and condition keep the weapon wielded at acceptance and the base virtue's effects.
    effectVariants: [
      {
        when: (runtime) => hasTrait(runtime, TRAIT.SOARING_DEVASTATION),
        profileId: PROFILE.soaringDevastation,
        transform: (runtime, cast, effects) => [
          ...(cast.skill.effects ?? []),
          ...effects
            .filter((effect) => effect.type === 'strike' || effect.type === 'condition')
            .map((effect) => ({
              ...effect,
              name:
                effect.type === 'strike'
                  ? 'Wings of Resolve \u2014 Soaring Devastation'
                  : 'Soaring Devastation \u2014 Immobilized',
              weapon: gw2ActivePrimaryWeapon(runtime.config, runtime.activeWeaponSet),
              timingAnchor: 'castEnd' as const
            }))
        ]
      }
    ],
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
          controlKind: 'pull'
        },
        {
          type: 'condition',
          condition: 'Slow',
          stacks: 1,
          duration: 4
        }
      ]),
      {
        type: 'boon',
        boon: 'Might',
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
    castTimeMs: 0,
    cooldown: 40,
    effects: [
      {
        type: 'control',
        controlKind: 'pull'
      }
    ]
  }
});
