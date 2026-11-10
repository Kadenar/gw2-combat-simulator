/** Canonical Core ranger skill definitions grouped by their GW2 owner. */
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { targetConditionCount } from '#gw2/platform/combat/query/runtime-query.js';
import { BOON, CONDITION, CONTROL } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { RANGER_HAMMER_VARIANT_PAIRS } from '#gw2/professions/ranger/data/hammer-variants.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { RangerRuntime, RangerRuntimeState, RangerSkill } from '#gw2/professions/ranger/types.js';

/** Each slot shares its live recharge across variants, including cancelled casts. */
function synchronizeHammerRecharge(runtime: RangerRuntime, cast: RuntimeCast<RangerSkill>): void {
  const pair = RANGER_HAMMER_VARIANT_PAIRS.find((ids) => ids.includes(Number(cast.skill.id)));
  for (const id of pair || []) runtime.cooldownController.copy(cast.skill.id, id);
}

/** Commit and cancellation both synchronize the recharge already started by the runtime. */
export const hammerLifecycle = {
  onCastCommit: synchronizeHammerRecharge,
  onCastCancel: synchronizeHammerRecharge
} satisfies RuntimeHooks<RangerRuntimeState, RangerSkill>;

// Share adjacent impact timing while preserving local payloads, attribution, and independent timelines.
export const RANGER_CORE_HAMMER_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = {
  [ID.HAMMER_STRIKE]: {
    name: 'Hammer Strike',
    icon: 'https://render.guildwars2.com/file/0BE1C91A2CDD0ECF2073B3FC3CCCE8AD7E16F85D/2503713.png',
    type: 'Weapon',
    weapon: 'Hammer',
    slot: 'Weapon_1',
    cooldown: 0,
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 480,
    interruptCommitMs: 360,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 360, coefficient: 0.8 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.HAMMER_SLAM]: {
    name: 'Hammer Slam',
    icon: 'https://render.guildwars2.com/file/CD6B25EDED5CEE9476681D59F438EC1D0522D561/2503714.png',
    type: 'Weapon',
    weapon: 'Hammer',
    slot: 'Weapon_1',
    cooldown: 0,
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 640,
    interruptCommitMs: 320,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 320, coefficient: 1 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.HEAVY_SMASH]: {
    name: 'Heavy Smash',
    icon: 'https://render.guildwars2.com/file/1A02B377F59E6D0B0EB90AA6FBD13D01EFCA7A3B/2503715.png',
    type: 'Weapon',
    weapon: 'Hammer',
    slot: 'Weapon_1',
    cooldown: 0,
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 440,
    interruptCommitMs: 320,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 320, coefficient: 1.4 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.WILD_SWING]: {
    name: 'Wild Swing',
    icon: 'https://render.guildwars2.com/file/F5ED6F31ABE93ED6E2DD7D13A3111CB192B0F69C/2503716.png',
    type: 'Weapon',
    weapon: 'Hammer',
    slot: 'Weapon_2',
    cooldown: 7,
    castTimeMs: 480,
    effects: impactEffects({ atMs: 400, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1.5
      },
      {
        type: 'condition',
        condition: CONDITION.CRIPPLED,
        stacks: 1,
        duration: 5
      }
    ])
  },
  [ID.UNLEASHED_WILD_SWING]: {
    name: 'Unleashed Wild Swing',
    icon: 'https://render.guildwars2.com/file/7369B820749874C1F15A4B02AD2F18B94A6AB84C/2503717.png',
    type: 'Weapon',
    weapon: 'Hammer',
    slot: 'Weapon_2',
    cooldown: 7,
    castTimeMs: 480,
    interruptCommitMs: 400,
    // Each unleashed attack owns its defiant-target bonus and samples the target at impact.
    modifiers: [
      {
        id: 'ranger.unleashed-wild-swing-defiant',
        label: 'Unleashed Wild Swing',
        target: MODIFIER_TARGET.STRIKE_DAMAGE,
        operation: 'multiply',
        factor: 1.2,
        order: 15,
        when: (context) => Boolean(context.config?.target?.defiant)
      }
    ],
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 400, coefficient: 2 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.OVERBEARING_SMASH]: {
    name: 'Overbearing Smash',
    icon: 'https://render.guildwars2.com/file/452819BCB027F1273491DF1706CFF15BEEE49466/2503718.png',
    type: 'Weapon',
    weapon: 'Hammer',
    slot: 'Weapon_3',
    cooldown: 12,
    castTimeMs: 960,
    interruptCommitMs: 240,
    effects: [
      ...impactEffects({ atMs: 240, timingAnchor: 'castStart', timingScale: 'fixed' }, [
        {
          type: 'strike',
          coefficient: 0.4
        },
        {
          type: 'control',
          controlKind: CONTROL.DAZE
        }
      ]),
      ...impactEffects({ atMs: 800, timingAnchor: 'castStart', timingScale: 'fixed' }, [
        {
          type: 'strike',
          sourceId: ID.OVERBEARING_SMASH_SECOND_STRIKE,
          coefficient: 1
        },
        {
          type: 'control',
          sourceId: ID.OVERBEARING_SMASH_SECOND_STRIKE,
          controlKind: CONTROL.DAZE
        }
      ])
    ]
  },
  [ID.UNLEASHED_OVERBEARING_SMASH]: {
    name: 'Unleashed Overbearing Smash',
    icon: 'https://render.guildwars2.com/file/7BA2A9B41EEEB1E1BF61FD7BF108BE0C05932080/2503719.png',
    type: 'Weapon',
    weapon: 'Hammer',
    slot: 'Weapon_3',
    cooldown: 12,
    castTimeMs: 960,
    // Keep the opening impact when cancelled between hits; the follow-up requires reaching its own packet.
    interruptMode: 'per-packet',
    effects: [
      ...impactEffects({ atMs: 240, timingAnchor: 'castStart', timingScale: 'fixed' }, [
        {
          type: 'strike',
          coefficient: 0.75
        },
        {
          type: 'condition',
          condition: CONDITION.BLINDNESS,
          stacks: 1,
          duration: 2
        }
      ]),
      {
        type: 'strike',
        sourceId: ID.OVERBEARING_SMASH_SECOND_STRIKE,
        ticks: [{ atMs: 960, coefficient: 1.5 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Unleashed Overbearing Smash - Follow-Up Damage'
      }
    ]
  },
  [ID.SAVAGE_SHOCK_WAVE]: {
    name: 'Savage Shock Wave',
    icon: 'https://render.guildwars2.com/file/6BC544E523349525271332C60867ECE5126848ED/2503720.png',
    type: 'Weapon',
    weapon: 'Hammer',
    slot: 'Weapon_4',
    cooldown: 15,
    castTimeMs: 560,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 520, coefficient: 0.5 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'boon',
        boon: BOON.PROTECTION,
        duration: 3,
        stacks: 1
      },
      ...impactEffects({ atMs: 520, timingAnchor: 'castStart', timingScale: 'fixed' }, [
        {
          type: 'condition',
          condition: CONDITION.WEAKNESS,
          stacks: 1,
          duration: 4
        },
        {
          type: 'condition',
          condition: CONDITION.VULNERABILITY,
          stacks: 8,
          duration: 6
        },
        {
          type: 'condition',
          condition: CONDITION.IMMOBILIZED,
          stacks: 1,
          duration: 2
        }
      ])
    ]
  },
  [ID.UNLEASHED_SAVAGE_SHOCK_WAVE]: {
    name: 'Unleashed Savage Shock Wave',
    icon: 'https://render.guildwars2.com/file/2939557FFA0BDF9C4D0B7FD1A19AA57DE9C49FDD/2503721.png',
    type: 'Weapon',
    weapon: 'Hammer',
    slot: 'Weapon_4',
    cooldown: 15,
    castTimeMs: 560,
    interruptCommitMs: 520,
    // Defiance grants the capped condition bonus instead of a separate multiplier.
    modifiers: [
      {
        id: 'ranger.condition-count-skill-bonus',
        label: 'Unleashed Savage Shock Wave',
        target: MODIFIER_TARGET.STRIKE_DAMAGE,
        operation: 'multiply',
        parameters: { baseFactor: 1, damagePerCondition: 0.04, maximumConditions: 5 },
        order: 18,
        // Count canonical active conditions once each, independently of their stack counts.
        factor: (context, _target, parameters) =>
          parameters.baseFactor +
          (context.config?.target?.defiant
            ? parameters.maximumConditions
            : Math.min(targetConditionCount(context), parameters.maximumConditions)) *
            parameters.damagePerCondition
      }
    ],
    effects: [
      {
        type: 'strike',
        ticks: [520, 800, 1080].map((atMs) => ({
          atMs,
          coefficient: 0.96
        })),
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      }
    ]
  },
  [ID.THUMP]: {
    name: 'Thump',
    icon: 'https://render.guildwars2.com/file/B50D7DA590A8593098B1326FE951D9156CA0C25C/2503722.png',
    type: 'Weapon',
    weapon: 'Hammer',
    slot: 'Weapon_5',
    cooldown: 20,
    castTimeMs: 960,
    effects: impactEffects({ atMs: 800, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1.25
      },
      {
        type: 'control',
        controlKind: CONTROL.KNOCKDOWN
      }
    ])
  },
  [ID.UNLEASHED_THUMP]: {
    name: 'Unleashed Thump',
    icon: 'https://render.guildwars2.com/file/0CA1B13856E838595833F90B4C22A62FBEFBB39F/2503723.png',
    type: 'Weapon',
    weapon: 'Hammer',
    slot: 'Weapon_5',
    cooldown: 20,
    castTimeMs: 960,
    interruptCommitMs: 800,
    effects: impactEffects({ atMs: 800, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 2.3
      },
      {
        type: 'boon',
        boon: BOON.MIGHT,
        duration: 6.5,
        stacks: 6
      },
      {
        type: 'boon',
        boon: BOON.FURY,
        duration: 6.5,
        stacks: 1
      }
    ])
  }
};
