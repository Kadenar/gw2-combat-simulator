/** Explicit PvE skill mechanics owned by the Bladesworn Warrior module. */

import { gw2EffectExpiresAt } from '#gw2/platform/combat/effect-timing.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { ACTOR, BOON, COMBO_FINISHER, CONDITION, CONTROL } from '#gw2/platform/constants.js';
import { requireSkillAction } from '#gw2/platform/effects/actions.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import { buildResolverCondition } from '#gw2/platform/effects/packet-builders.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { effectNumber, requireEffect, requireSkill } from '#gw2/platform/skills/balance-profiles.js';
import { materializeSkillDefinitions } from '#gw2/platform/skills/compose-definitions.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { warriorAmmunition } from '#gw2/professions/warrior/core/mechanics/ammunition.js';
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';
import { slashEffects } from '#gw2/professions/warrior/specializations/bladesworn/mechanics/dragon-trigger.js';
import { activeCartridgeWindow, bladeswornState } from '#gw2/professions/warrior/specializations/bladesworn/state.js';
import type { WarriorRuntime, WarriorRuntimeState, WarriorSkill } from '#gw2/professions/warrior/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

const CARTRIDGE_ACTIVATE = 'warrior.cartridges-activate';

const furyBeforeCast = new WeakSet<RuntimeCast<WarriorSkill>>();

const BLADESWORN_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition<WarriorSkill>>> = {
  [ID.UNSHEATHE_GUNSABER]: {
    name: 'Unsheathe Gunsaber',
    icon: 'https://render.guildwars2.com/file/2FD1530306F002EF08D729182822917BC477BEED/2491643.png',
    type: 'Profession',
    slot: 'Profession_1',
    // Gunsaber transitions use a five-second base recharge before recharge modifiers.
    cooldown: 5,
    inputCategory: 'bar-swap',
    // Count the explicit bar-changing input in effort summaries.
    castTimeMs: 0,
    effects: [],
    // Successful commitment owns this transition or reward.
    sideEffects: [{ on: 'castCommit', do: { type: 'warrior.gunsaber-enter' } }]
  },
  [ID.DRAGON_TRIGGER]: {
    name: 'Dragon Trigger',
    icon: 'https://render.guildwars2.com/file/A2B14ED1954FBE0B31E0C57DCB0107BBE0543764/2491645.png',
    type: 'Profession',
    slot: 'Profession_2',
    cooldown: 8,
    // The mode's selected skill owns baseline charging and its admission cost.
    maximumCharges: 10,
    resourceCost: 5,
    entryResourceCost: 15,
    duration: 30,
    inputCategory: 'bar-swap',
    // Count the explicit bar-changing input in effort summaries.
    castTimeMs: 0,
    canCastConcurrently: false,
    effects: [],
    // Successful commitment owns this transition or reward.
    sideEffects: [{ on: 'castCommit', do: { type: 'warrior.dragon-trigger-enter' } }]
  },
  [ID.SHEATHE_GUNSABER]: {
    name: 'Sheathe Gunsaber',
    icon: 'https://render.guildwars2.com/file/21C87D14E3A3C298C909A003614102F0FA48979A/2491644.png',
    type: 'Profession',
    slot: 'Profession_1',
    cooldown: 5,
    inputCategory: 'bar-swap',
    // Count the explicit bar-changing input in effort summaries.
    castTimeMs: 0,
    effects: [],
    // Successful commitment owns this transition or reward.
    sideEffects: [{ on: 'castCommit', do: { type: 'warrior.gunsaber-exit' } }]
  },
  [ID.TACTICAL_RELOAD]: {
    name: 'Tactical Reload',
    icon: 'https://render.guildwars2.com/file/B106D2281F245403F23CD2C2E766D39A05400916/2491632.png',
    type: 'Elite',
    slot: 'Elite',
    cooldown: 30,
    castTimeMs: 560,
    dualWieldCastTimeMs: 400,
    // Commitment grants the reload while the remaining animation retains its cast lockout.
    interruptCommitMs: 480,
    retainsCastLockoutAfterInterrupt: true,
    effects: [],
    // Successful commitment owns this transition or reward.
    sideEffects: [{ on: 'castCommit', do: { type: 'warrior.tactical-reload' } }]
  },
  [ID.DRAGONSPIKE_MINE]: {
    name: 'Dragonspike Mine',
    icon: 'https://render.guildwars2.com/file/7C079E38F9ABFFA4533E064965B8A1B3EE3FB743/2491654.png',
    type: 'Utility',
    slot: 'Utility',
    cooldown: 20,
    movementSkill: true,
    castTimeMs: 640,
    // Interrupted replay keeps the mine effects once their observed activation has committed.
    interruptCommitMs: 640,
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
        condition: CONDITION.CRIPPLED,
        stacks: 1,
        duration: 5,
        persistsAfterInterrupt: true
      },
      {
        type: 'condition',
        condition: CONDITION.BLEEDING,
        stacks: 3,
        duration: 6,
        persistsAfterInterrupt: true
      }
    ],
    // The completed activation refreshes its paired skill through the shared recharge owner.
    sideEffects: [{ on: 'castCommit', do: { type: 'rechargeReset', skillIds: [ID.DRAGON_TRIGGER] } }]
  },
  [ID.FLOW_STABILIZER]: {
    name: 'Flow Stabilizer',
    icon: 'https://render.guildwars2.com/file/A0CBE13DC629FAD69645FBB9CFDEFC5AC82061E3/2491651.png',
    type: 'Utility',
    slot: 'Utility',
    cooldown: 30,
    ammoCastLockout: 1,
    ammo: 2,

    castTimeMs: 0,
    // Flow Stabilizer opens its passive-flow window and grants its conditional flow on completion.
    effects: [
      {
        type: 'boon',
        boon: BOON.FURY,
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
    ],
    // Capture preexisting Fury before this skill applies its own boon.
    sideEffects: [
      { on: 'castStart', do: { type: 'warrior.flow-snapshot' } },
      { on: 'castCommit', do: { type: 'warrior.flow-stabilize' } }
    ]
  },
  [ID.COMBAT_STIMULANT]: {
    name: 'Combat Stimulant',
    icon: 'https://render.guildwars2.com/file/C341A614F4D4E59D4103AD30073A7F18DE54BF03/2491640.png',
    type: 'Heal',
    slot: 'Heal',
    cooldown: 20,
    ammoCastLockout: 1,
    ammo: 2,

    castTimeMs: 500,
    effects: [
      {
        type: 'boon',
        boon: BOON.QUICKNESS,
        duration: 5,
        stacks: 1
      },
      {
        type: 'boon',
        boon: BOON.FURY,
        duration: 10,
        stacks: 1
      },
      {
        type: 'boon',
        boon: BOON.VIGOR,
        duration: 10,
        stacks: 1
      }
    ]
  },
  [ID.OVERCHARGED_CARTRIDGES]: {
    name: 'Overcharged Cartridges',
    icon: 'https://render.guildwars2.com/file/EF1D6D09A1B403972F721F1A073154E2F01CD0A5/2491652.png',
    type: 'Utility',
    slot: 'Utility',
    ammo: 2,

    cooldown: 20,
    ammoCastLockout: 1,
    castTimeMs: 600,
    dualWieldCastTimeMs: 480,
    // Committed interrupted casts keep the cartridge window consumed by later explosions.
    interruptCommitMs: 400,
    // Active cartridges scale qualifying explosions across skills.
    modifiers: [
      {
        id: 'warrior.overcharged-cartridges',
        scope: 'profession',
        target: MODIFIER_TARGET.STRIKE_DAMAGE,
        operation: 'multiply',
        parameters: { baseFactor: 1 },
        factor: (context, _target, parameters) => parameters.baseFactor + cartridgeDamageBonus(context),
        when: (context) => context.event?.damageKind === 'explosion' && cartridgeDamageBonus(context) > 0
      }
    ],
    effects: [],
    // Activation precedes completion, so acceptance schedules its own guarded wake.
    sideEffects: [
      {
        on: 'castStart',
        when: (_runtime, cast) => !cast.cancelledBeforeCommit,
        do: {
          type: 'warrior.cartridges-schedule',
          id: 'cartridges',
          effects: [
            {
              name: 'overcharged-cartridges',
              type: 'buff',
              kind: 'overcharged-cartridges',
              stacks: 1,
              duration: 8,
              damageIncreasePerStack: 0.15
            },
            { name: 'Overcharged Burning', type: 'condition', condition: CONDITION.BURNING, stacks: 1, duration: 3 },
            {
              name: 'supercharged-cartridges',
              type: 'buff',
              kind: 'supercharged-cartridges',
              stacks: 1,
              duration: 8,
              damageIncreasePerStack: 0.2
            },
            { name: 'Supercharged Burning', type: 'condition', condition: CONDITION.BURNING, stacks: 1, duration: 5 }
          ]
        }
      }
    ]
  },
  // Only explicitly named explosion packets trigger explosion modifiers and traits; ordinary gunsaber hits do not.
  [ID.SWIFT_CUT]: {
    name: 'Swift Cut',
    icon: new URL('@images/wiki/swift-cut.png', import.meta.url).href,
    type: 'Bundle',
    slot: 'Weapon_1',
    cooldown: 0,
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    gunsaberSkill: true,
    skillWeapon: 'Gunsaber',
    castTimeMs: 640,
    effects: [
      {
        weaponStrengthProfileId: 'bundle.exotic',
        type: 'strike',
        name: 'Swift Cut - Blade',
        coefficient: 0.9,
        hits: 1
      },
      {
        weaponStrengthProfileId: 'bundle.exotic',
        type: 'strike',
        name: 'Swift Cut - Shot',
        coefficient: 0.75 * 0.33,
        hits: 1
      }
    ]
  },
  [ID.STEEL_DIVIDE]: {
    name: 'Steel Divide',
    icon: new URL('@images/wiki/steel-divide.png', import.meta.url).href,
    type: 'Bundle',
    slot: 'Weapon_1',
    cooldown: 0,
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    gunsaberSkill: true,
    skillWeapon: 'Gunsaber',
    castTimeMs: 600,
    effects: [
      {
        weaponStrengthProfileId: 'bundle.exotic',
        type: 'strike',
        name: 'Steel Divide - Blade',
        coefficient: 1.1,
        hits: 1
      },
      {
        weaponStrengthProfileId: 'bundle.exotic',
        type: 'strike',
        name: 'Steel Divide - Shot',
        coefficient: 0.75 * 0.33,
        hits: 1
      }
    ]
  },
  [ID.EXPLOSIVE_THRUST]: {
    name: 'Explosive Thrust',
    icon: new URL('@images/wiki/explosive-thrust.png', import.meta.url).href,
    type: 'Bundle',
    slot: 'Weapon_1',
    cooldown: 0,
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    gunsaberSkill: true,
    skillWeapon: 'Gunsaber',
    castTimeMs: 440,
    effects: [
      {
        weaponStrengthProfileId: 'bundle.exotic',
        type: 'strike',
        name: 'Explosive Thrust - Blade',
        coefficient: 1.35,
        hits: 1
      },
      {
        weaponStrengthProfileId: 'bundle.exotic',
        type: 'strike',
        name: 'Explosive Thrust - Explosion',
        coefficient: 1.2 * 0.33,
        hits: 1,
        damageKind: 'explosion'
      }
    ]
  },
  [ID.BLOOMING_FIRE]: {
    name: 'Blooming Fire',
    icon: new URL('@images/wiki/blooming-fire.png', import.meta.url).href,
    type: 'Bundle',
    slot: 'Weapon_1',
    ammo: 2,

    cooldown: 10,
    ammoCastLockout: 2,
    gunsaberSkill: true,
    skillWeapon: 'Gunsaber',
    castTimeMs: 600,
    // Interrupted replay keeps every Blooming Fire packet after its observed activation commits.
    interruptCommitMs: 600,
    effects: [
      {
        weaponStrengthProfileId: 'bundle.exotic',
        type: 'strike',
        name: 'Blooming Fire - Blade',
        coefficient: 0.8,
        hits: 1,
        persistsAfterInterrupt: true
      },
      {
        weaponStrengthProfileId: 'bundle.exotic',
        type: 'strike',
        name: 'Blooming Fire - Explosion',
        coefficient: 1.2,
        hits: 3,
        atMs: 0,
        damageKind: 'explosion',
        persistsAfterInterrupt: true
      }
    ]
  },
  [ID.ARTILLERY_SLASH]: {
    name: 'Artillery Slash',
    icon: new URL('@images/wiki/artillery-slash.png', import.meta.url).href,
    type: 'Bundle',
    slot: 'Weapon_1',
    ammo: 2,

    cooldown: 15,
    ammoCastLockout: 2,
    gunsaberSkill: true,
    skillWeapon: 'Gunsaber',
    castTimeMs: 680,
    effects: [
      { name: 'One round', type: 'strike', coefficient: 2, hits: 1 },
      { name: 'Two rounds', type: 'strike', coefficient: 3, hits: 1 },
      { name: 'Control', type: 'control', controlKind: CONTROL.DAZE }
    ],
    effectVariants: [
      {
        when: () => true,
        transform: (_runtime, cast) => artilleryEffects(cast, false)
      }
    ],
    // Capture every round before shared commitment spends the last reserved round.
    sideEffects: [{ on: 'castStart', do: { type: 'warrior.spend-magazine' } }]
  },
  [ID.CYCLONE_TRIGGER]: {
    name: 'Cyclone Trigger',
    icon: new URL('@images/wiki/cyclone-trigger.png', import.meta.url).href,
    type: 'Bundle',
    slot: 'Weapon_1',
    ammo: 2,

    cooldown: 20,
    ammoCastLockout: 1,
    gunsaberSkill: true,
    skillWeapon: 'Gunsaber',
    castTimeMs: 400,
    // Interrupted replay keeps every Cyclone Trigger packet after its observed activation commits.
    interruptCommitMs: 240,
    effects: [
      {
        weaponStrengthProfileId: 'bundle.exotic',
        type: 'strike',
        coefficient: 2.5,
        hits: 1,
        persistsAfterInterrupt: true
      },
      {
        type: 'boon',
        boon: BOON.AEGIS,
        duration: 3,
        stacks: 1,
        persistsAfterInterrupt: true
      }
    ]
  },
  [ID.BREAK_STEP]: {
    name: 'Break Step',
    icon: new URL('@images/wiki/break-step.png', import.meta.url).href,
    type: 'Bundle',
    slot: 'Weapon_1',
    movementSkill: true,
    ammo: 2,

    cooldown: 20,
    ammoCastLockout: 1,
    gunsaberSkill: true,
    skillWeapon: 'Gunsaber',
    castTimeMs: 320,
    // Interrupted replay keeps every Break Step packet after its observed activation commits.
    interruptCommitMs: 320,
    effects: [
      {
        weaponStrengthProfileId: 'bundle.exotic',
        type: 'strike',
        coefficient: 0.5,
        hits: 1,
        damageKind: 'explosion',
        persistsAfterInterrupt: true
      },
      {
        type: 'boon',
        boon: BOON.FURY,
        duration: 5,
        stacks: 1,
        persistsAfterInterrupt: true
      }
    ]
  },
  [ID.DRAGON_SLASH_FORCE]: {
    name: 'Dragon Slash-Force',
    icon: new URL('@images/wiki/dragon-slash-force.png', import.meta.url).href,
    type: 'Bundle',
    slot: 'Weapon_1',

    cooldown: 1,
    // Force hits during its animation so expiring buffs are evaluated before recovery ends.
    dragonSlashImpactOffsetMs: 520,
    burst: true,
    gunsaberSkill: true,
    skillWeapon: 'Gunsaber',
    dragonSlash: true,
    dragonSlashMinimumCoefficient: 1.16,
    dragonSlashMaximumCoefficient: 20.4,
    castTimeMs: 1040,
    effects: [],
    effectVariants: [{ when: () => true, transform: slashEffects }],
    // Normal and Sharp releases share captured facts and their own interpolation endpoints.
    sideEffects: [{ on: 'castStart', do: { type: 'warrior.slash-release' } }]
  },
  [ID.DRAGON_SLASH_BOOST]: {
    name: 'Dragon Slash-Boost',
    icon: new URL('@images/wiki/dragon-slash-boost.png', import.meta.url).href,
    type: 'Bundle',
    slot: 'Weapon_1',

    cooldown: 1,
    movementSkill: true,
    burst: true,
    gunsaberSkill: true,
    skillWeapon: 'Gunsaber',
    dragonSlash: true,
    dragonSlashMinimumCoefficient: 0.92,
    dragonSlashMaximumCoefficient: 16.3,
    castTimeMs: 1040,
    effects: [],
    effectVariants: [{ when: () => true, transform: slashEffects }],
    // Normal and Sharp releases share captured facts and their own interpolation endpoints.
    sideEffects: [{ on: 'castStart', do: { type: 'warrior.slash-release' } }]
  },
  [ID.DRAGON_SLASH_REACH]: {
    name: 'Dragon Slash-Reach',
    icon: new URL('@images/wiki/dragon-slash-reach.png', import.meta.url).href,
    type: 'Bundle',
    slot: 'Weapon_1',

    cooldown: 1,
    burst: true,
    gunsaberSkill: true,
    skillWeapon: 'Gunsaber',
    dragonSlash: true,
    dragonSlashMinimumCoefficient: 0.56,
    dragonSlashMaximumCoefficient: 10.21,
    castTimeMs: 1040,
    effects: [],
    effectVariants: [{ when: () => true, transform: slashEffects }],
    // Normal and Sharp releases share captured facts and their own interpolation endpoints.
    sideEffects: [{ on: 'castStart', do: { type: 'warrior.slash-release' } }]
  },
  [ID.FLICKER_STEP]: {
    name: 'Flicker Step',
    icon: new URL('@images/wiki/flicker-step.png', import.meta.url).href,
    type: 'Bundle',
    slot: 'Weapon_1',
    ammo: 3,

    cooldown: 20,
    ammoCastLockout: 0.5,
    gunsaberSkill: true,
    dragonTriggerSkill: true,
    shadowstepSkill: true,
    peithaImpactDelayMs: 240,
    skillWeapon: 'Gunsaber',
    castTimeMs: 0,
    effects: []
  },
  [ID.TRIGGERGUARD]: {
    name: 'Triggerguard',
    icon: new URL('@images/wiki/triggerguard.png', import.meta.url).href,
    type: 'Bundle',
    slot: 'Weapon_1',
    ammo: 2,

    cooldown: 30,
    ammoCastLockout: 1,
    gunsaberSkill: true,
    dragonTriggerSkill: true,
    skillWeapon: 'Gunsaber',
    castTimeMs: 0,
    effects: [
      {
        type: 'boon',
        boon: BOON.AEGIS,
        duration: 2,
        stacks: 1
      }
    ]
  }
};

/** Creates the hidden skill identity selected when Sharp as the Wind replaces a normal Gunsaber action. */
function sharpAsTheWindVariant(
  id: number,
  parentId: number,
  name: string,
  overrides: Partial<WarriorSkill>
): WarriorSkill {
  const parent = BLADESWORN_SKILL_MECHANICS[parentId];

  return Object.freeze({
    ...parent,
    ...overrides,
    id,
    name,
    slotSelectable: false,
    sharpAsTheWindParentId: parentId
  });
}

/** One complete module collection includes authored skills, generated attacks, and simulator actions. */
export const BLADESWORN_SKILLS: readonly WarriorSkill[] = Object.freeze([
  ...materializeSkillDefinitions(BLADESWORN_SKILL_MECHANICS),
  sharpAsTheWindVariant(ID.SHARP_SWIFT_CUT, ID.SWIFT_CUT, 'Swift Cut', {
    effects: [
      {
        type: 'strike',
        weaponStrengthProfileId: 'bundle.exotic',
        name: 'Swift Cut - Blade',
        coefficient: 0.3,
        hits: 1
      },
      { type: 'strike', weaponStrengthProfileId: 'bundle.exotic', name: 'Swift Cut - Shot', coefficient: 0.1, hits: 1 },
      { type: 'condition', condition: CONDITION.BLEEDING, stacks: 2, duration: 3 }
    ]
  }),
  sharpAsTheWindVariant(ID.SHARP_STEEL_DIVIDE, ID.STEEL_DIVIDE, 'Steel Divide', {
    effects: [
      {
        type: 'strike',
        weaponStrengthProfileId: 'bundle.exotic',
        name: 'Steel Divide - Blade',
        coefficient: 0.4,
        hits: 1
      },
      {
        type: 'strike',
        weaponStrengthProfileId: 'bundle.exotic',
        name: 'Steel Divide - Shot',
        coefficient: 0.1,
        hits: 1
      },
      { type: 'condition', condition: CONDITION.BLEEDING, stacks: 1, duration: 3 }
    ]
  }),
  sharpAsTheWindVariant(ID.SHARP_EXPLOSIVE_THRUST, ID.EXPLOSIVE_THRUST, 'Explosive Thrust', {
    effects: [
      {
        type: 'strike',
        weaponStrengthProfileId: 'bundle.exotic',
        name: 'Explosive Thrust - Blade',
        coefficient: 0.6,
        hits: 1
      },
      {
        type: 'strike',
        weaponStrengthProfileId: 'bundle.exotic',
        name: 'Explosive Thrust - Explosion',
        coefficient: 0.1,
        hits: 1,
        damageKind: 'explosion'
      },
      { type: 'condition', condition: CONDITION.BLEEDING, stacks: 1, duration: 4 }
    ]
  }),
  sharpAsTheWindVariant(ID.SHARP_BLOOMING_FIRE, ID.BLOOMING_FIRE, 'Blooming Fire', {
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ persistsAfterInterrupt: true }, [
      {
        type: 'strike',
        weaponStrengthProfileId: 'bundle.exotic',
        name: 'Blooming Fire - Blade',
        coefficient: 0.5,
        hits: 1
      },
      {
        type: 'strike',
        weaponStrengthProfileId: 'bundle.exotic',
        name: 'Blooming Fire - Explosion',
        coefficient: 0.3,
        hits: 3,
        atMs: 0,
        damageKind: 'explosion'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 0, condition: CONDITION.BURNING, stacks: 3, duration: 3 }]
      }
    ])
  }),
  sharpAsTheWindVariant(ID.SHARP_ARTILLERY_SLASH, ID.ARTILLERY_SLASH, 'Artillery Slash', {
    // Ammunition selects only this skill's authored payload alternatives.
    effects: [
      { name: 'Strike', type: 'strike', coefficient: 2, hits: 1 },
      {
        name: 'One round',
        type: 'condition',
        condition: CONDITION.BLEEDING,
        stacks: 3,
        duration: 6,
        packetLabel: 'one round spent'
      },
      {
        name: 'Two rounds',
        type: 'condition',
        condition: CONDITION.BLEEDING,
        stacks: 4,
        duration: 7,
        packetLabel: 'two rounds spent'
      },
      { name: 'Control', type: 'control', controlKind: CONTROL.DAZE }
    ],
    effectVariants: [
      {
        when: () => true,
        transform: (_runtime, cast) => artilleryEffects(cast, true)
      }
    ]
  }),
  sharpAsTheWindVariant(ID.SHARP_CYCLONE_TRIGGER, ID.CYCLONE_TRIGGER, 'Cyclone Trigger', {
    effects: [
      {
        type: 'strike',
        weaponStrengthProfileId: 'bundle.exotic',
        coefficient: 1,
        hits: 1,
        persistsAfterInterrupt: true
      },
      { type: 'boon', boon: BOON.AEGIS, duration: 5, stacks: 1, persistsAfterInterrupt: true },
      {
        type: 'condition',
        condition: CONDITION.BURNING,
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
        weaponStrengthProfileId: 'bundle.exotic',
        coefficient: 0.1,
        hits: 1,
        damageKind: 'explosion',
        persistsAfterInterrupt: true,
        comboFinishers: [
          {
            ownerId: 'warrior',
            finisherType: COMBO_FINISHER.LEAP,
            fieldSelectionAnchor: 'castStart'
          }
        ]
      },
      { type: 'boon', boon: BOON.FURY, duration: 5, stacks: 1, persistsAfterInterrupt: true },
      {
        type: 'condition',
        condition: CONDITION.BURNING,
        stacks: 1,
        duration: 8,
        persistsAfterInterrupt: true
      }
    ]
  }),
  sharpAsTheWindVariant(ID.SHARP_DRAGON_SLASH_FORCE, ID.DRAGON_SLASH_FORCE, 'Dragon Slash-Force', {
    cooldown: 1,
    dragonSlashMinimumCoefficient: 3,
    dragonSlashMaximumCoefficient: 3,
    dragonSlashMinimumBurningDuration: 2,
    dragonSlashMaximumBurningDuration: 4
  }),
  sharpAsTheWindVariant(ID.SHARP_DRAGON_SLASH_BOOST, ID.DRAGON_SLASH_BOOST, 'Dragon Slash-Boost', {
    cooldown: 1,
    dragonSlashMinimumCoefficient: 2.4,
    dragonSlashMaximumCoefficient: 2.4,
    dragonSlashMinimumBurningDuration: 1.5,
    dragonSlashMaximumBurningDuration: 3.25
  }),
  sharpAsTheWindVariant(ID.SHARP_DRAGON_SLASH_REACH, ID.DRAGON_SLASH_REACH, 'Dragon Slash-Reach', {
    cooldown: 1,
    dragonSlashMinimumCoefficient: 1.5,
    dragonSlashMaximumCoefficient: 1.5,
    dragonSlashMinimumBurningDuration: 1,
    dragonSlashMaximumBurningDuration: 2
  })
]);

/** Artillery spends every captured round while the shared completion consumes its final reserved round. */
function artilleryEffects(cast: RuntimeCast<WarriorSkill>, sharp: boolean): readonly SkillEffect[] {
  const rounds = warriorAmmunition.get(cast)!.rounds;
  const profile = cast.skill;
  const strike = requireEffect(profile, 'strike', sharp ? 'Strike' : rounds >= 2 ? 'Two rounds' : 'One round');
  const effects: SkillEffect[] = [];

  if (strike)
    effects.push({
      type: 'strike',
      weaponStrengthProfileId: 'bundle.exotic',
      coefficient: effectNumber(profile, strike, 'coefficient'),
      weapon: 'Gunsaber',
      damageKind: 'explosion',
      projectile: sharp,
      ...(sharp
        ? {
            comboFinishers: [{ ownerId: 'warrior', finisherType: COMBO_FINISHER.PROJECTILE }]
          }
        : {})
    });

  const bleeding = sharp ? requireEffect(profile, 'condition', rounds >= 2 ? 'Two rounds' : 'One round') : undefined;

  if (bleeding)
    effects.push({
      type: 'condition',
      condition: String(bleeding.condition),
      stacks: effectNumber(profile, bleeding, 'stacks'),
      duration: effectNumber(profile, bleeding, 'duration')
    });

  if (requireEffect(profile, 'control', 'Control'))
    effects.push({ type: 'control', controlKind: sharp && rounds >= 2 ? CONTROL.STUN : CONTROL.DAZE });

  return effects;
}

/** Actual activation upgrades a live cartridge window once; a supercharged window cannot be refreshed by another cast. */
function activateCartridges(runtime: WarriorRuntime, cast: RuntimeCast<WarriorSkill>): void {
  const state = bladeswornState.from(runtime.profession);
  // Discard expired occurrences on the next grant so idle expiry needs no queued cleanup.
  state.overchargedCartridgeWindows = state.overchargedCartridgeWindows.filter(
    (window) => window.expiresAt > runtime.time
  );
  const active = activeCartridgeWindow(state.overchargedCartridgeWindows, runtime.time);

  if (active?.supercharged) return;

  const supercharged = Boolean(active);
  const profile = requireSkill(runtime.helpers, ID.OVERCHARGED_CARTRIDGES);
  const action = requireSkillAction(profile, 'cartridges');
  const kind = supercharged ? 'supercharged-cartridges' : 'overcharged-cartridges';
  const buff = requireEffect(profile, 'buff', kind, action);

  if (!buff) return;

  const duration = effectNumber(profile, buff, 'duration');

  if (duration <= 0) return;

  if (active) active.expiresAt = runtime.time;

  const burning = requireEffect(
    profile,
    'condition',
    supercharged ? 'Supercharged Burning' : 'Overcharged Burning',
    action
  );
  const expiresAt = gw2EffectExpiresAt(runtime.time, duration);
  state.overchargedCartridgeWindows.push({
    startedAt: runtime.time,
    expiresAt,
    supercharged,
    damageBonus: effectNumber(profile, buff, 'damageIncreasePerStack'),
    burningDuration: burning ? effectNumber(profile, burning, 'duration') : 0
  });
  runtime.effects.emit({
    kind: 'packet',
    event: {
      type: 'buff',
      at: runtime.time,
      source: 'Warrior',
      sourceId: cast.skill.id,
      actorType: ACTOR.PLAYER,
      skillId: cast.skill.id,
      skillName: cast.skill.name,
      activationId: cast.id,
      name: supercharged ? 'Supercharged Cartridges' : 'Overcharged Cartridges',
      kind,
      stacks: effectNumber(profile, buff, 'stacks'),
      duration
    }
  });
}

/** Only resolved positive player explosions emit the selected cartridge condition; derived conditions cannot recurse. */
export function cartridgeExplosion(runtime: WarriorRuntime, event: Gw2ResolverEvent): void {
  if (event.actorType !== ACTOR.PLAYER || event.damageKind !== 'explosion' || !(Number(event.coefficient) > 0)) return;

  const state = bladeswornState.from(runtime.profession);
  const window = activeCartridgeWindow(state.overchargedCartridgeWindows, runtime.time);

  if (!window || window.burningDuration <= 0) return;

  const profile = requireSkill(runtime.helpers, ID.OVERCHARGED_CARTRIDGES);
  const action = requireSkillAction(profile, 'cartridges');
  const burning = requireEffect(
    profile,
    'condition',
    window.supercharged ? 'Supercharged Burning' : 'Overcharged Burning',
    action
  );

  if (burning)
    runtime.effects.emit({
      kind: 'packet',
      cause: event,
      event: buildResolverCondition({
        at: runtime.time,
        source: 'Warrior',
        sourceId: ID.OVERCHARGED_CARTRIDGES,
        actorType: ACTOR.EFFECT,
        ownerActorType: ACTOR.PLAYER,
        skillId: event.skillId,
        skillName: event.skillName,
        name: 'Overcharged Cartridges - Burning',
        condition: CONDITION.BURNING,
        stacks: effectNumber(profile, burning, 'stacks'),
        duration: window.burningDuration
      })
    });
}

/** Successful commitment restores the longest-recharging round, clearing recharge when the pool becomes full. */
function tacticalReload(runtime: WarriorRuntime, cast: RuntimeCast<WarriorSkill>): void {
  for (const id of runtime.cooldownController.ammoSkillIds()) {
    const skill = runtime.helpers.skillsById.get(id);

    // Pistol is shared Core equipment, but its ammunition still belongs to Tactical Reload's weapon rule.
    if (skill && (skill.specialization === 'Bladesworn' || skill.weapon === 'Pistol'))
      runtime.cooldownController.restoreAmmo(skill, 1, runtime.time);
  }

  const state = bladeswornState.from(runtime.profession);
  state.tacticalReloadUntil = gw2EffectExpiresAt(runtime.time, 10);
  runtime.effects.emit({
    kind: 'packet',
    event: {
      type: 'buff',
      at: runtime.time,
      source: 'Warrior',
      sourceId: cast.skill.id,
      actorType: ACTOR.PLAYER,
      skillId: cast.skill.id,
      skillName: cast.skill.name,
      activationId: cast.id,
      name: 'Tactical Reload',
      kind: 'tactical-reload',
      stacks: 1,
      duration: 10
    }
  });
}

/** Intrinsic recipes execute at their declared phase; shared Flow and Trigger lifetimes remain separate. */
const bladeswornSkillActions: RuntimeHooks<WarriorRuntimeState, WarriorSkill>['sideEffectHandlers'] = {
  'warrior.tactical-reload'(runtime, context) {
    if (context.kind === 'cast') tacticalReload(runtime, context.cast);
  },
  'warrior.cartridges-schedule'(runtime, context) {
    if (context.kind !== 'cast') return;

    const cast = context.cast;
    runtime.scheduleForCast(
      CARTRIDGE_ACTIVATE,
      canonicalTime(cast.start + (cast.fullEnd - cast.start) * (420 / 900)),
      cast
    );
  },
  'warrior.flow-snapshot'(runtime, context) {
    if (context.kind !== 'cast') return;

    const cast = context.cast;

    // Sample configured or executed self Fury before the cast emits its own application.
    if (runtime.combat.activeBoonStacks(BOON.FURY, runtime.time, 1) > 0) furyBeforeCast.add(cast);
  },
  'warrior.flow-stabilize'(runtime, context) {
    if (context.kind !== 'cast') return;

    const cast = context.cast;

    if (furyBeforeCast.has(cast)) runtime.resourceController.grant('flow', 15);

    // The conditional instant grant is independent of the removable Positive Flow component.
    const effect = requireEffect(cast.skill, 'buff', 'Positive Flow');

    if (effect) {
      const expiresAt = gw2EffectExpiresAt(runtime.time, effectNumber(cast.skill, effect, 'duration'));

      if (expiresAt > runtime.time)
        bladeswornState.from(runtime.profession).flowStabilizerWindows.push({
          startedAt: runtime.time,
          expiresAt,
          stacks: effectNumber(cast.skill, effect, 'stacks')
        });
    }
  }
};

const bladeswornSkillTasks: RuntimeHooks<WarriorRuntimeState, WarriorSkill>['tasks'] = {
  [CARTRIDGE_ACTIVATE](runtime, data) {
    activateCartridges(runtime, (data as { cast: RuntimeCast<WarriorSkill> }).cast);
  }
};

/** Bladesworn skill actions and their scheduled tasks share one owner. */
export const bladeswornSkillLifecycle = {
  sideEffectHandlers: bladeswornSkillActions,
  tasks: bladeswornSkillTasks
} satisfies RuntimeHooks<WarriorRuntimeState, WarriorSkill>;

function cartridgeDamageBonus(context: Gw2ModifierContext): number {
  // A newer cartridge application replaces the older bonus, even after the newer one expires.
  let latest = { at: -Infinity, expiresAt: 0, kind: '' };
  for (const kind of ['overcharged-cartridges', 'supercharged-cartridges']) {
    for (const application of context.runtime?.buffs?.get(kind) ?? []) {
      if (application.resolvedAudience.includesSelf && application.at <= context.time && application.at >= latest.at)
        latest = { at: application.at, expiresAt: application.expiresAt, kind };
    }
  }

  if (latest.expiresAt <= context.time) return 0;

  const profile = requireSkill(context.catalog, ID.OVERCHARGED_CARTRIDGES);
  const action = requireSkillAction(profile, 'cartridges');
  const effect = requireEffect(profile, 'buff', latest.kind, action);
  return effect ? effectNumber(profile, effect, 'damageIncreasePerStack') : 0;
}
