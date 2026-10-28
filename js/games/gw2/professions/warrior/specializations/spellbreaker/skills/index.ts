/** Explicit PvE skill mechanics owned by the Spellbreaker Warrior module. */
import { BOON, COMBO_FIELD, COMBO_FINISHER, CONDITION, CONTROL, RECIPIENT, WEAPON } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';

export const SPELLBREAKER_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.EARTHSHAKER_ID_40601]: {
    skillWeapon: WEAPON.HAMMER,
    cooldown: 8,
    adrenalineCost: 10,
    burst: true,
    castTimeMs: 1000,
    // Share impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 840, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 2.75,
        comboFinishers: [
          {
            ownerId: 'warrior',
            finisherType: COMBO_FINISHER.BLAST
          }
        ]
      },
      {
        type: 'control',
        controlKind: CONTROL.STUN
      }
    ])
  },
  [ID.NATURAL_HEALING]: {
    castTimeMs: 667,
    effects: []
  },
  [ID.SKULL_CRACK_ID_41110]: {
    // Spellbreaker's level-one variant shares the mace burst's cast and impact timing.
    skillWeapon: WEAPON.MACE,
    cooldown: 8,
    adrenalineCost: 10,
    burst: true,
    castTimeMs: 560,
    // Share impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 440, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1
      },
      {
        type: 'control',
        controlKind: CONTROL.DAZE
      }
    ])
  },
  [ID.ARCING_SLICE_ID_42707]: {
    adrenalineCost: 10,
    burst: true,
    castTimeMs: 333,
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1,
        coefficientModifiers: [
          {
            kind: 'target-health-below',
            threshold: 0.5,
            multiplier: 1.5
          }
        ]
      },
      {
        type: 'boon',
        boon: BOON.FURY,
        duration: 8,
        stacks: 1
      }
    ]
  },
  [ID.COMBUSTIVE_SHOT_ID_42803]: {
    adrenalineCost: 10,
    burst: true,
    castTimeMs: 500,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 2,
        atMs: 0
      },
      {
        type: 'condition',
        condition: CONDITION.BURNING,
        stacks: 2,
        duration: 5
      }
    ]
  },
  [ID.BREAK_ENCHANTMENTS]: {
    castTimeMs: 167,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1
      }
    ]
  },
  [ID.EVISCERATE_ID_43566]: {
    adrenalineCost: 10,
    burst: true,
    castTimeMs: 0,
    effects: [
      {
        type: 'boon',
        boon: BOON.MIGHT,
        duration: 5,
        stacks: 5
      },
      {
        type: 'strike',
        coefficient: 2,
        hits: 1
      }
    ]
  },
  [ID.FULL_COUNTER]: {
    adrenalineCost: 10,
    burst: true,
    castTimeMs: 1000,
    // The counterattack only occurs after absorbing an incoming attack. The
    // benchmark target never attacks, so activation alone has no effects.
    effects: []
  },
  [ID.WINDS_OF_DISENCHANTMENT]: {
    castTimeMs: 1000,
    comboFields: [
      {
        ownerId: 'warrior',
        fieldType: COMBO_FIELD.LIGHTNING,
        duration: 5,
        startAnchor: 'castEnd'
      }
    ],
    // Targets never carry boons; only the damage pulses and Lightning field have simulated effects.
    effects: impactEffects({ timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      {
        type: 'strike',
        ticks: Array.from({ length: 5 }, (_, index) => ({ atMs: 800 + index * 1000, coefficient: 2.25 / 5 }))
      }
    ])
  },
  [ID.PATH_TO_VICTORY_ID_72089]: {
    adrenalineCost: 10,
    burst: true,
    castTimeMs: 333,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1
      },
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.REGENERATION,
        duration: 5,
        stacks: 1
      }
    ]
  },
  [ID.HARRIERS_TOSS_ID_73014]: {
    adrenalineCost: 10,
    burst: true,
    castTimeMs: 333,
    effects: [
      {
        type: 'condition',
        condition: CONDITION.VULNERABILITY,
        stacks: 5,
        duration: 6
      },
      {
        type: 'strike',
        coefficient: 2.5,
        hits: 1
      }
    ]
  }
});
