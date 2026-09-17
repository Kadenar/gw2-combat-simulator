/** Explicit PvE skill mechanics owned by the Bladesworn Warrior module. */
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';
import { WARRIOR_SUPPLEMENTAL_SKILLS } from '#gw2/professions/warrior/data/warrior-supplemental-skills.js';
import type { Skill, SkillFragment } from '#gw2/platform/engine/skills/types.js';

export const BLADESWORN_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.UNSHEATHE_GUNSABER]: {
    castTimeMs: 0,
    effects: [],
    // Custom: Equips Gunsaber and updates bundle/weapon state; see `bladesworn/mechanics/gunsaber-and-trigger.ts`.
    inputCategory: 'bar-swap', // Count the explicit bar-changing input in effort summaries.
    handlerId: 'warrior.gunsaber-enter'
  },
  [ID.DRAGON_TRIGGER]: {
    effects: [],
    castTimeMs: 0,
    canCastConcurrently: false,
    // Custom: Enters Dragon Trigger and starts charge/flow state; see `bladesworn/mechanics/gunsaber-and-trigger.ts`.
    inputCategory: 'bar-swap', // Count the explicit bar-changing input in effort summaries.
    handlerId: 'warrior.dragon-trigger'
  },
  [ID.SHEATHE_GUNSABER]: {
    cooldown: 0,
    castTimeMs: 0,
    effects: [],
    // Custom: Stows Gunsaber and restores weapon state; see `bladesworn/mechanics/gunsaber-and-trigger.ts`.
    inputCategory: 'bar-swap', // Count the explicit bar-changing input in effort summaries.
    handlerId: 'warrior.gunsaber-exit'
  },
  [ID.TACTICAL_RELOAD]: {
    effects: [],
    castTimeMs: 560,
    // Tactical Reload commits at 480ms, keeps its remaining cast lockout, and resolves its reload after interruption.
    interruptCommitMs: 480,
    retainsCastLockoutAfterInterrupt: true,
    mechanicTriggers: [
      {
        type: 'warrior.bladesworn.tactical-reload',
        timingAnchor: 'castEnd'
      }
    ]
  },
  [ID.DRAGONSPIKE_MINE]: {
    movementSkill: true,
    // Dragonspike Mine refreshes Dragon Trigger when its cast completes.
    mechanicTriggers: [
      {
        type: 'warrior.bladesworn.reset-dragon-trigger',
        timingAnchor: 'castEnd'
      }
    ],
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1,
        damageKind: 'explosion',
        persistsAfterInterrupt: true
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 5,
        persistsAfterInterrupt: true
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 3,
        duration: 6,
        persistsAfterInterrupt: true
      }
    ],
    castTimeMs: 640,
    // Interrupted replay keeps the mine effects once their observed activation has committed.
    interruptCommitMs: 640
  },
  [ID.FLOW_STABILIZER]: {
    castTimeMs: 0,
    // Flow Stabilizer opens its passive-flow window and grants its conditional flow on completion.
    mechanicTriggers: [
      {
        type: 'warrior.bladesworn.flow-stabilizer',
        timingAnchor: 'castEnd'
      }
    ],
    effects: [
      {
        type: 'boon',
        boon: 'fury',
        duration: 8,
        stacks: 1
      },
      {
        type: 'buff',
        kind: 'positive-flow',
        duration: 8,
        stacks: 2
      }
    ]
  },
  [ID.COMBAT_STIMULANT]: {
    effects: [
      {
        type: 'boon',
        boon: 'quickness',
        duration: 5,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'fury',
        duration: 10,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'vigor',
        duration: 10,
        stacks: 1
      }
    ],
    castTimeMs: 500
  },
  [ID.OVERCHARGED_CARTRIDGES]: {
    ammo: 2,
    ammoRecharge: 20,
    cooldown: 20,
    ammoCastLockout: 1,
    effects: [],
    castTimeMs: 600,
    // Committed interrupted casts keep the cartridge window consumed by later explosions.
    interruptCommitMs: 480,
    handlerId: 'warrior.overcharged-cartridges'
  },
  // Only explicitly named explosion packets trigger explosion modifiers and traits; ordinary gunsaber hits do not.
  [ID.SWIFT_CUT]: {
    effects: [
      {
        type: 'strike',
        name: 'Swift Cut — Blade',
        coefficient: 0.9,
        hits: 1
      },
      {
        type: 'strike',
        name: 'Swift Cut — Shot',
        coefficient: 0.75 * 0.34,
        hits: 1
      }
    ],
    castTimeMs: 640,
    gunsaberSkill: true,
    skillWeapon: 'Gunsaber'
  },
  [ID.STEEL_DIVIDE]: {
    effects: [
      {
        type: 'strike',
        name: 'Steel Divide — Blade',
        coefficient: 1.1,
        hits: 1
      },
      {
        type: 'strike',
        name: 'Steel Divide — Shot',
        coefficient: 0.75 * 0.34,
        hits: 1
      }
    ],
    castTimeMs: 600,
    gunsaberSkill: true,
    skillWeapon: 'Gunsaber'
  },
  [ID.EXPLOSIVE_THRUST]: {
    effects: [
      {
        type: 'strike',
        name: 'Explosive Thrust — Blade',
        coefficient: 1.35,
        hits: 1
      },
      {
        type: 'strike',
        name: 'Explosive Thrust — Explosion',
        coefficient: 1.2 * 0.34,
        hits: 1,
        damageKind: 'explosion'
      }
    ],
    castTimeMs: 440,
    gunsaberSkill: true,
    skillWeapon: 'Gunsaber'
  },
  [ID.BLOOMING_FIRE]: {
    ammo: 2,
    ammoRecharge: 10,
    cooldown: 10,
    ammoCastLockout: 2,
    effects: [
      {
        type: 'strike',
        name: 'Blooming Fire — Blade',
        coefficient: 0.8,
        hits: 1,
        persistsAfterInterrupt: true
      },
      {
        type: 'strike',
        name: 'Blooming Fire — Explosion',
        coefficient: 1.2,
        hits: 3,
        atMs: 0,
        damageKind: 'explosion',
        persistsAfterInterrupt: true
      }
    ],
    castTimeMs: 600,
    // Interrupted replay keeps every Blooming Fire packet after its observed activation commits.
    interruptCommitMs: 600,
    gunsaberSkill: true,
    skillWeapon: 'Gunsaber'
  },
  [ID.ARTILLERY_SLASH]: {
    ammo: 2,
    ammoRecharge: 15,
    cooldown: 15,
    ammoCastLockout: 2,
    effects: [],
    castTimeMs: 680,
    gunsaberSkill: true,
    skillWeapon: 'Gunsaber',
    // Custom: Materializes Artillery Slash's charge-scaled projectile sequence; see `bladesworn/mechanics/gunsaber-and-trigger.ts`.
    handlerId: 'warrior.artillery-slash'
  },
  [ID.CYCLONE_TRIGGER]: {
    ammo: 2,
    ammoRecharge: 20,
    cooldown: 20,
    ammoCastLockout: 1,
    effects: [
      {
        type: 'strike',
        coefficient: 2.5,
        hits: 1,
        persistsAfterInterrupt: true
      },
      {
        type: 'boon',
        boon: 'aegis',
        duration: 3,
        stacks: 1,
        persistsAfterInterrupt: true
      }
    ],
    castTimeMs: 400,
    // Interrupted replay keeps every Cyclone Trigger packet after its observed activation commits.
    interruptCommitMs: 240,
    gunsaberSkill: true,
    skillWeapon: 'Gunsaber'
  },
  [ID.BREAK_STEP]: {
    movementSkill: true,
    ammo: 2,
    ammoRecharge: 20,
    cooldown: 20,
    ammoCastLockout: 1,
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1,
        damageKind: 'explosion',
        persistsAfterInterrupt: true
      },
      {
        type: 'boon',
        boon: 'fury',
        duration: 5,
        stacks: 1,
        persistsAfterInterrupt: true
      }
    ],
    castTimeMs: 320,
    // Interrupted replay keeps every Break Step packet after its observed activation commits.
    interruptCommitMs: 320,
    gunsaberSkill: true,
    skillWeapon: 'Gunsaber'
  },
  [ID.DRAGON_SLASH_FORCE]: {
    effects: [],
    castTimeMs: 1040,
    burst: true,
    gunsaberSkill: true,
    skillWeapon: 'Gunsaber',
    dragonSlash: true,
    dragonSlashMinimumCoefficient: 1.16,
    dragonSlashMaximumCoefficient: 20.4,
    // Custom: Consumes Dragon Trigger charge and materializes the selected slash; see `bladesworn/mechanics/gunsaber-and-trigger.ts`.
    handlerId: 'warrior.dragon-slash'
  },
  [ID.DRAGON_SLASH_BOOST]: {
    movementSkill: true,
    effects: [],
    castTimeMs: 1040,
    burst: true,
    gunsaberSkill: true,
    skillWeapon: 'Gunsaber',
    dragonSlash: true,
    dragonSlashMinimumCoefficient: 0.92,
    dragonSlashMaximumCoefficient: 16.3,
    // Custom: Consumes Dragon Trigger charge and materializes the selected slash; see `bladesworn/mechanics/gunsaber-and-trigger.ts`.
    handlerId: 'warrior.dragon-slash'
  },
  [ID.DRAGON_SLASH_REACH]: {
    effects: [],
    castTimeMs: 1040,
    burst: true,
    gunsaberSkill: true,
    skillWeapon: 'Gunsaber',
    dragonSlash: true,
    dragonSlashMinimumCoefficient: 0.56,
    dragonSlashMaximumCoefficient: 10.21,
    // Custom: Consumes Dragon Trigger charge and materializes the selected slash; see `bladesworn/mechanics/gunsaber-and-trigger.ts`.
    handlerId: 'warrior.dragon-slash'
  },
  [ID.FLICKER_STEP]: {
    ammo: 3,
    ammoRecharge: 20,
    cooldown: 20,
    ammoCastLockout: 0.5,
    castTimeMs: 0,
    effects: [],
    gunsaberSkill: true,
    dragonTriggerSkill: true,
    shadowstepSkill: true,
    skillWeapon: 'Gunsaber'
  },
  [ID.TRIGGERGUARD]: {
    ammo: 2,
    ammoRecharge: 30,
    cooldown: 30,
    ammoCastLockout: 1,
    castTimeMs: 0,
    effects: [
      {
        type: 'boon',
        boon: 'aegis',
        duration: 2,
        stacks: 1
      }
    ],
    gunsaberSkill: true,
    dragonTriggerSkill: true,
    skillWeapon: 'Gunsaber'
  }
});

/** Creates the hidden skill identity selected when Sharp as the Wind replaces a normal Gunsaber action. */
function sharpAsTheWindVariant(id: number, parentId: number, name: string, overrides: Partial<Skill>): Skill {
  const parent = WARRIOR_SUPPLEMENTAL_SKILLS.find((skill) => skill.id === parentId);

  return Object.freeze({
    id,
    name,
    description: 'Sharp as the Wind condition variant.',
    icon: parent?.icon || '',
    type: parent?.type || 'Bundle',
    slot: 'Action',
    specialization: 'Bladesworn',
    castTimeMs: 0,
    cooldown: 0,
    effects: [],
    ...BLADESWORN_SKILL_MECHANICS[parentId],
    ...overrides,
    paletteAction: false,
    slotSelectable: false,
    simulatorExcluded: false
  });
}

export const BLADESWORN_SHARP_AS_THE_WIND_SKILLS: readonly Skill[] = Object.freeze([
  sharpAsTheWindVariant(ID.SHARP_SWIFT_CUT, ID.SWIFT_CUT, 'Swift Cut', {
    effects: [
      { type: 'strike', name: 'Swift Cut — Blade', coefficient: 0.3, hits: 1 },
      { type: 'strike', name: 'Swift Cut — Shot', coefficient: 0.1, hits: 1 },
      { type: 'condition', condition: 'Bleeding', stacks: 2, duration: 3 }
    ]
  }),
  sharpAsTheWindVariant(ID.SHARP_STEEL_DIVIDE, ID.STEEL_DIVIDE, 'Steel Divide', {
    effects: [
      { type: 'strike', name: 'Steel Divide — Blade', coefficient: 0.4, hits: 1 },
      { type: 'strike', name: 'Steel Divide — Shot', coefficient: 0.1, hits: 1 },
      { type: 'condition', condition: 'Bleeding', stacks: 1, duration: 3 }
    ]
  }),
  sharpAsTheWindVariant(ID.SHARP_EXPLOSIVE_THRUST, ID.EXPLOSIVE_THRUST, 'Explosive Thrust', {
    effects: [
      { type: 'strike', name: 'Explosive Thrust — Blade', coefficient: 0.6, hits: 1 },
      {
        type: 'strike',
        name: 'Explosive Thrust — Explosion',
        coefficient: 0.1,
        hits: 1,
        damageKind: 'explosion'
      },
      { type: 'condition', condition: 'Bleeding', stacks: 1, duration: 4 }
    ]
  }),
  sharpAsTheWindVariant(ID.SHARP_BLOOMING_FIRE, ID.BLOOMING_FIRE, 'Blooming Fire', {
    effects: [
      {
        type: 'strike',
        name: 'Blooming Fire — Blade',
        coefficient: 0.5,
        hits: 1,
        persistsAfterInterrupt: true
      },
      {
        type: 'strike',
        name: 'Blooming Fire — Explosion',
        coefficient: 0.3,
        hits: 3,
        atMs: 0,
        damageKind: 'explosion',
        persistsAfterInterrupt: true
      },
      {
        type: 'condition',
        ticks: Array.from({ length: 3 }, () => ({ atMs: 0, condition: 'Burning', stacks: 1, duration: 3 })),
        persistsAfterInterrupt: true
      }
    ]
  }),
  sharpAsTheWindVariant(ID.SHARP_ARTILLERY_SLASH, ID.ARTILLERY_SLASH, 'Artillery Slash', {}),
  sharpAsTheWindVariant(ID.SHARP_CYCLONE_TRIGGER, ID.CYCLONE_TRIGGER, 'Cyclone Trigger', {
    effects: [
      { type: 'strike', coefficient: 1, hits: 1, persistsAfterInterrupt: true },
      { type: 'boon', boon: 'aegis', duration: 5, stacks: 1, persistsAfterInterrupt: true },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 2,
        duration: 5,
        persistsAfterInterrupt: true
      }
    ]
  }),
  sharpAsTheWindVariant(ID.SHARP_BREAK_STEP, ID.BREAK_STEP, 'Break Step', {
    effects: [
      {
        type: 'strike',
        coefficient: 0.1,
        hits: 1,
        damageKind: 'explosion',
        persistsAfterInterrupt: true,
        comboFinishers: [
          {
            ownerId: 'warrior',
            finisherType: 'Leap',
            fieldSelectionAnchor: 'castStart',
            ambiguousFieldSelection: 'oldest'
          }
        ]
      },
      { type: 'boon', boon: 'fury', duration: 5, stacks: 1, persistsAfterInterrupt: true },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 1,
        duration: 8,
        persistsAfterInterrupt: true
      }
    ]
  }),
  sharpAsTheWindVariant(ID.SHARP_DRAGON_SLASH_FORCE, ID.DRAGON_SLASH_FORCE, 'Dragon Slash—Force', {
    cooldown: 1,
    dragonSlashMinimumCoefficient: 3,
    dragonSlashMaximumCoefficient: 3,
    dragonSlashMinimumBurningDuration: 2,
    dragonSlashMaximumBurningDuration: 4
  }),
  sharpAsTheWindVariant(ID.SHARP_DRAGON_SLASH_BOOST, ID.DRAGON_SLASH_BOOST, 'Dragon Slash—Boost', {
    cooldown: 1,
    dragonSlashMinimumCoefficient: 2.4,
    dragonSlashMaximumCoefficient: 2.4,
    dragonSlashMinimumBurningDuration: 1.5,
    dragonSlashMaximumBurningDuration: 3.25
  }),
  sharpAsTheWindVariant(ID.SHARP_DRAGON_SLASH_REACH, ID.DRAGON_SLASH_REACH, 'Dragon Slash—Reach', {
    cooldown: 1,
    dragonSlashMinimumCoefficient: 1.5,
    dragonSlashMaximumCoefficient: 1.5,
    dragonSlashMinimumBurningDuration: 1,
    dragonSlashMaximumBurningDuration: 2
  })
]);
