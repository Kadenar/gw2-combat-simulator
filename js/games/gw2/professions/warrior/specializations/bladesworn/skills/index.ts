/** Explicit PvE skill mechanics owned by the Bladesworn Warrior module. */
import { impactEffects } from '#gw2/platform/engine/effects/authoring.js';
import { WARRIOR_SKILL_IDS as ID, WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import { hasTrait, type Gw2TraitLookupContext } from '#gw2/platform/combat/state/traits.js';
import { WARRIOR_SUPPLEMENTAL_SKILLS } from '#gw2/professions/warrior/data/warrior-supplemental-skills.js';
import type { Skill, SkillId } from '#gw2/platform/engine/skills/types.js';

const SHARP_AS_THE_WIND_VARIANTS = new Map<number, number>([
  [ID.SWIFT_CUT, ID.SHARP_SWIFT_CUT],
  [ID.STEEL_DIVIDE, ID.SHARP_STEEL_DIVIDE],
  [ID.EXPLOSIVE_THRUST, ID.SHARP_EXPLOSIVE_THRUST],
  [ID.BLOOMING_FIRE, ID.SHARP_BLOOMING_FIRE],
  [ID.ARTILLERY_SLASH, ID.SHARP_ARTILLERY_SLASH],
  [ID.CYCLONE_TRIGGER, ID.SHARP_CYCLONE_TRIGGER],
  [ID.BREAK_STEP, ID.SHARP_BREAK_STEP],
  [ID.DRAGON_SLASH_FORCE, ID.SHARP_DRAGON_SLASH_FORCE],
  [ID.DRAGON_SLASH_BOOST, ID.SHARP_DRAGON_SLASH_BOOST],
  [ID.DRAGON_SLASH_REACH, ID.SHARP_DRAGON_SLASH_REACH]
]);
const SHARP_AS_THE_WIND_PARENTS = new Map(
  [...SHARP_AS_THE_WIND_VARIANTS].map(([parentId, variantId]) => [variantId, parentId])
);

/** Both action identities select the version owned by the equipped adept trait. */
export function resolveSharpAsTheWindSkillId(context: Gw2TraitLookupContext, skillId: SkillId): SkillId {
  const parentId = SHARP_AS_THE_WIND_PARENTS.get(Number(skillId)) ?? Number(skillId);
  const variantId = SHARP_AS_THE_WIND_VARIANTS.get(parentId);
  if (!variantId) return skillId;
  return hasTrait(context, TRAIT.SHARP_AS_THE_WIND) ? variantId : parentId;
}

export const BLADESWORN_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.UNSHEATHE_GUNSABER]: {
    // Gunsaber transitions use a five-second base recharge before recharge modifiers.
    cooldown: 5,
    castTimeMs: 0,
    effects: [],
    inputCategory: 'bar-swap' // Count the explicit bar-changing input in effort summaries.
  },
  [ID.DRAGON_TRIGGER]: {
    effects: [],
    castTimeMs: 0,
    canCastConcurrently: false,
    inputCategory: 'bar-swap' // Count the explicit bar-changing input in effort summaries.
  },
  [ID.SHEATHE_GUNSABER]: {
    cooldown: 5,
    castTimeMs: 0,
    effects: [],
    inputCategory: 'bar-swap' // Count the explicit bar-changing input in effort summaries.
  },
  [ID.TACTICAL_RELOAD]: {
    effects: [],
    castTimeMs: 560,
    dualWieldCastTimeMs: 400,
    // Tactical Reload commits at 480ms, keeps its remaining cast lockout, and resolves its reload after interruption.
    interruptCommitMs: 480,
    retainsCastLockoutAfterInterrupt: true
  },
  [ID.DRAGONSPIKE_MINE]: {
    movementSkill: true,
    // Dragonspike Mine refreshes Dragon Trigger when its cast completes.
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
    effects: [
      {
        type: 'boon',
        boon: 'fury',
        duration: 8,
        stacks: 1
      },
      {
        type: 'buff',
        name: 'Positive Flow',
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
    dualWieldCastTimeMs: 480,
    // Committed interrupted casts keep the cartridge window consumed by later explosions.
    interruptCommitMs: 480
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
        coefficient: 0.75 * 0.33,
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
        coefficient: 0.75 * 0.33,
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
        coefficient: 1.2 * 0.33,
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
    skillWeapon: 'Gunsaber'
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
    // Force hits during its animation so expiring buffs are evaluated before recovery ends.
    dragonSlashImpactOffsetMs: 520,
    burst: true,
    gunsaberSkill: true,
    skillWeapon: 'Gunsaber',
    dragonSlash: true,
    dragonSlashMinimumCoefficient: 1.16,
    dragonSlashMaximumCoefficient: 20.4
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
    dragonSlashMaximumCoefficient: 16.3
  },
  [ID.DRAGON_SLASH_REACH]: {
    effects: [],
    castTimeMs: 1040,
    burst: true,
    gunsaberSkill: true,
    skillWeapon: 'Gunsaber',
    dragonSlash: true,
    dragonSlashMinimumCoefficient: 0.56,
    dragonSlashMaximumCoefficient: 10.21
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
    peithaImpactDelayMs: 240,
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
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ persistsAfterInterrupt: true }, [
      {
        type: 'strike',
        name: 'Blooming Fire — Blade',
        coefficient: 0.5,
        hits: 1
      },
      {
        type: 'strike',
        name: 'Blooming Fire — Explosion',
        coefficient: 0.3,
        hits: 3,
        atMs: 0,
        damageKind: 'explosion'
      },
      {
        type: 'condition',
        ticks: Array.from({ length: 3 }, () => ({ atMs: 0, condition: 'Burning', stacks: 1, duration: 3 }))
      }
    ])
  }),
  sharpAsTheWindVariant(ID.SHARP_ARTILLERY_SLASH, ID.ARTILLERY_SLASH, 'Artillery Slash', {}),
  sharpAsTheWindVariant(ID.SHARP_CYCLONE_TRIGGER, ID.CYCLONE_TRIGGER, 'Cyclone Trigger', {
    effects: [
      { type: 'strike', coefficient: 1, hits: 1, persistsAfterInterrupt: true },
      { type: 'boon', boon: 'aegis', duration: 5, stacks: 1, persistsAfterInterrupt: true },
      // Apply each Burning stack separately so same-impact relic checks observe every application.
      ...Array.from({ length: 2 }, () => ({
        type: 'condition' as const,
        condition: 'Burning' as const,
        stacks: 1,
        duration: 5,
        persistsAfterInterrupt: true
      }))
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
