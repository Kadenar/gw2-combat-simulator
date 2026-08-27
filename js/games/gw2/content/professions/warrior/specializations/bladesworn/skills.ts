/** Explicit PvE skill mechanics owned by the Bladesworn Warrior module. */
import { WARRIOR_SKILL_IDS as ID } from '../../data/ids.js';
import type { SkillFragment } from '../../../../../platform/engine/types.js';

export const BLADESWORN_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.UNSHEATHE_GUNSABER]: {
    implemented: true,
    castTimeMs: 0,
    effects: [],
    handlerId: 'warrior.gunsaber-enter'
  },
  [ID.DRAGON_TRIGGER]: {
    implemented: true,
    effects: [],
    castTimeMs: 0,
    canCastConcurrently: false,
    handlerId: 'warrior.dragon-trigger'
  },
  [ID.ELECTRIC_FENCE]: {
    implemented: true,
    effects: [
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 5
      }
    ],
    quicknessCastTimeMs: 333
  },
  [ID.SHEATHE_GUNSABER]: {
    implemented: true,
    cooldown: 0,
    castTimeMs: 0,
    effects: [],
    handlerId: 'warrior.gunsaber-exit'
  },
  [ID.TACTICAL_RELOAD]: {
    implemented: true,
    effects: [],
    quicknessCastTimeMs: 552,
    // Tactical Reload restores Bladesworn ammo and opens its reload window on completion.
    mechanicTriggers: [
      {
        type: 'warrior.bladesworn.tactical-reload',
        timingAnchor: 'castEnd'
      }
    ]
  },
  [ID.DRAGONSPIKE_MINE]: {
    implemented: true,
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
        metadata: {
          damageKind: 'explosion'
        }
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 5
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 3,
        duration: 6
      }
    ],
    quicknessCastTimeMs: 641
  },
  [ID.FLOW_STABILIZER]: {
    implemented: true,
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
    implemented: true,
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
    quicknessCastTimeMs: 500
  },
  [ID.OVERCHARGED_CARTRIDGES]: {
    implemented: true,
    ammo: 2,
    ammoRecharge: 20,
    cooldown: 20,
    ammoCastLockout: 1,
    effects: [],
    quicknessCastTimeMs: 600,
    handlerId: 'warrior.overcharged-cartridges'
  },
  [ID.SWIFT_CUT]: {
    implemented: true,
    effects: [
      {
        type: 'strike',
        name: 'Swift Cut — Blade',
        coefficient: 0.9,
        hits: 1,
        metadata: {
          damageKind: 'explosion'
        }
      },
      {
        type: 'strike',
        name: 'Swift Cut — Shot',
        coefficient: 0.75 * 0.34,
        hits: 1,
        metadata: {
          damageKind: 'explosion'
        }
      }
    ],
    quicknessCastTimeMs: 639,
    gunsaberSkill: true,
    skillWeapon: 'Gunsaber'
  },
  [ID.STEEL_DIVIDE]: {
    implemented: true,
    effects: [
      {
        type: 'strike',
        name: 'Steel Divide — Blade',
        coefficient: 1.1,
        hits: 1,
        metadata: {
          damageKind: 'explosion'
        }
      },
      {
        type: 'strike',
        name: 'Steel Divide — Shot',
        coefficient: 0.75 * 0.34,
        hits: 1,
        metadata: {
          damageKind: 'explosion'
        }
      }
    ],
    quicknessCastTimeMs: 602,
    gunsaberSkill: true,
    skillWeapon: 'Gunsaber'
  },
  [ID.EXPLOSIVE_THRUST]: {
    implemented: true,
    effects: [
      {
        type: 'strike',
        name: 'Explosive Thrust — Blade',
        coefficient: 1.35,
        hits: 1,
        metadata: {
          damageKind: 'explosion'
        }
      },
      {
        type: 'strike',
        name: 'Explosive Thrust — Explosion',
        coefficient: 1.2 * 0.34,
        hits: 1,
        metadata: {
          damageKind: 'explosion'
        }
      }
    ],
    quicknessCastTimeMs: 439,
    gunsaberSkill: true,
    skillWeapon: 'Gunsaber'
  },
  [ID.BLOOMING_FIRE]: {
    implemented: true,
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
        metadata: {
          damageKind: 'explosion'
        }
      },
      {
        type: 'strike',
        name: 'Blooming Fire — Explosion',
        coefficient: 1.2,
        hits: 3,
        metadata: {
          damageKind: 'explosion'
        }
      }
    ],
    quicknessCastTimeMs: 602,
    gunsaberSkill: true,
    skillWeapon: 'Gunsaber'
  },
  [ID.ARTILLERY_SLASH]: {
    implemented: true,
    ammo: 2,
    ammoRecharge: 15,
    cooldown: 15,
    ammoCastLockout: 2,
    effects: [],
    quicknessCastTimeMs: 681,
    gunsaberSkill: true,
    skillWeapon: 'Gunsaber',
    handlerId: 'warrior.artillery-slash'
  },
  [ID.CYCLONE_TRIGGER]: {
    implemented: true,
    ammo: 2,
    ammoRecharge: 20,
    cooldown: 20,
    ammoCastLockout: 1,
    effects: [
      {
        type: 'strike',
        coefficient: 2.5,
        hits: 1,
        metadata: {
          damageKind: 'explosion'
        }
      },
      {
        type: 'boon',
        boon: 'aegis',
        duration: 3,
        stacks: 1
      }
    ],
    quicknessCastTimeMs: 400,
    gunsaberSkill: true,
    skillWeapon: 'Gunsaber'
  },
  [ID.BREAK_STEP]: {
    implemented: true,
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
        metadata: {
          damageKind: 'explosion'
        }
      },
      {
        type: 'boon',
        boon: 'fury',
        duration: 5,
        stacks: 1
      }
    ],
    quicknessCastTimeMs: 333,
    gunsaberSkill: true,
    skillWeapon: 'Gunsaber'
  },
  [ID.DRAGON_SLASH_FORCE]: {
    implemented: true,
    effects: [],
    quicknessCastTimeMs: 1039,
    burst: true,
    gunsaberSkill: true,
    skillWeapon: 'Gunsaber',
    dragonSlash: true,
    dragonSlashMinimumCoefficient: 1.16,
    dragonSlashMaximumCoefficient: 20.4,
    handlerId: 'warrior.dragon-slash'
  },
  [ID.DRAGON_SLASH_BOOST]: {
    implemented: true,
    movementSkill: true,
    effects: [],
    quicknessCastTimeMs: 333,
    burst: true,
    gunsaberSkill: true,
    skillWeapon: 'Gunsaber',
    dragonSlash: true,
    dragonSlashMinimumCoefficient: 0.92,
    dragonSlashMaximumCoefficient: 16.3,
    handlerId: 'warrior.dragon-slash'
  },
  [ID.DRAGON_SLASH_REACH]: {
    implemented: true,
    effects: [],
    quicknessCastTimeMs: 333,
    burst: true,
    gunsaberSkill: true,
    skillWeapon: 'Gunsaber',
    dragonSlash: true,
    dragonSlashMinimumCoefficient: 0.56,
    dragonSlashMaximumCoefficient: 10.21,
    handlerId: 'warrior.dragon-slash'
  },
  [ID.FLICKER_STEP]: {
    implemented: true,
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
    implemented: true,
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
