/** Core ranger spear mechanics; observed attacks separate contact offsets from their recovery windows. */
import { MODIFIER_TARGET, type Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import { skillForEvent, targetConditionActive } from '#gw2/platform/combat/query/runtime-query.js';
import { endStealth } from '#gw2/platform/combat/stealth.js';
import { BOON, COMBO_FINISHER, CONDITION, CONTROL, RECIPIENT, STATUS, WEAPON } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { armSkillFlip, consumeSkillFlip } from '#gw2/platform/execution/skill-flips.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { RANGER_SPEAR_STEALTH_FLIP_BY_PARENT } from '#gw2/professions/ranger/core/mechanics/weapon-state.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { RangerRuntime, RangerRuntimeState, RangerSkill } from '#gw2/professions/ranger/types.js';

// Share adjacent impact timing while preserving local payloads, attribution, and independent timelines.
// Projectile flags belong to strikes so Mistral and Shrike count impacts independently of combo success.
export const RANGER_CORE_SPEAR_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = {
  [ID.DRAKES_SWIPE]: {
    name: "Drake's Swipe",
    icon: 'https://render.guildwars2.com/file/414A30909FE90ABA80BD36D4426DE80B5A081710/3379171.png',
    type: 'Weapon',
    weapon: 'Spear',
    slot: 'Weapon_1',
    cooldown: 0,
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 520,
    interruptCommitMs: 400,
    effects: [
      {
        type: 'strike',
        coefficient: 1.1,
        hits: 1,
        atMs: 400,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.WYVERNS_LASH]: {
    name: "Wyvern's Lash",
    icon: 'https://render.guildwars2.com/file/D2C90A1160383EE7487A4F652C02C7525698CDD3/3379172.png',
    type: 'Weapon',
    weapon: 'Spear',
    slot: 'Weapon_1',
    cooldown: 0,
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 440,
    interruptCommitMs: 400,
    effects: impactEffects({ atMs: 400, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        coefficient: 1.4,
        hits: 1
      },
      {
        type: 'condition',
        condition: CONDITION.CRIPPLED,
        stacks: 1,
        duration: 2
      }
    ])
  },
  [ID.CHEETAHS_STRIKE]: {
    name: "Cheetah's Strike",
    icon: 'https://render.guildwars2.com/file/E2CF3E65CFD875E103D8F260A2806642A644AEFE/3379173.png',
    type: 'Weapon',
    weapon: 'Spear',
    slot: 'Weapon_1',
    cooldown: 0,
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 760,
    interruptCommitMs: 560,
    effects: impactEffects({ atMs: 560, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        coefficient: 1.8,
        hits: 1
      },
      {
        type: 'boon',
        boon: BOON.SWIFTNESS,
        duration: 3,
        stacks: 1
      }
    ])
  },
  [ID.MONGOOSES_FRENZY]: {
    name: "Mongoose's Frenzy",
    icon: 'https://render.guildwars2.com/file/D69F9EC04864417F0956045A1A3B1FBF455EC4C8/3379174.png',
    type: 'Weapon',
    weapon: 'Spear',
    slot: 'Weapon_2',
    cooldown: 5,
    castTimeMs: 800,
    interruptMode: 'per-packet',
    effects: [
      {
        type: 'strike',
        // Separate the two observed contacts so cancellation only drops pending damage.
        ticks: [
          { atMs: 400, coefficient: 1.25 },
          { atMs: 720, coefficient: 1.25 }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        condition: CONDITION.VULNERABILITY,
        stacks: 8,
        duration: 8
      }
    ]
  },
  [ID.FALCONS_STOOP]: {
    name: "Falcon's Stoop",
    icon: 'https://render.guildwars2.com/file/3AD908302F5A733FB07AF295DBDB30B637ADD0F4/3379176.png',
    type: 'Weapon',
    weapon: 'Spear',
    slot: 'Weapon_3',
    cooldown: 7,
    // The projectile contacts at 520 ms, followed by 200 ms of recovery.
    castTimeMs: 720,
    interruptMode: 'per-packet',
    effects: impactEffects({ atMs: 520, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        projectile: true,
        coefficient: 1.95,
        hits: 1,
        comboFinishers: [{ ownerId: 'ranger', finisherType: COMBO_FINISHER.PROJECTILE }]
      },
      {
        type: 'condition',
        condition: CONDITION.CRIPPLED,
        stacks: 1,
        duration: 4
      }
    ])
  },
  [ID.WARCLAWS_ENGAGE]: {
    name: "Warclaw's Engage",
    icon: 'https://render.guildwars2.com/file/DA9AE866CC0D07E0453B64EFFB2019E17306D7D0/3379178.png',
    type: 'Weapon',
    weapon: 'Spear',
    slot: 'Weapon_4',
    cooldown: 12,
    evades: true,
    // The leap contacts before its recovery finishes, matching the observed animation.
    castTimeMs: 920,
    interruptMode: 'per-packet',
    effects: [
      {
        type: 'strike',
        coefficient: 2.75,
        // Read remaining target health at impact, including strict exclusion of the threshold itself.
        coefficientModifiers: [{ kind: 'target-health-below', threshold: 0.5, multiplier: 1.2 }],
        hits: 1,
        atMs: 800,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        comboFinishers: [{ ownerId: 'ranger', finisherType: COMBO_FINISHER.LEAP }]
      }
    ]
  },
  [ID.PANTHERS_PROWL]: {
    name: "Panther's Prowl",
    icon: 'https://render.guildwars2.com/file/07F83EAFE63F1BBD31ABE1C954BED3D1C5CB090C/3379180.png',
    type: 'Weapon',
    weapon: 'Spear',
    slot: 'Weapon_5',

    cooldown: 10,
    ammo: 2,

    // Keep this skill's between-cast lockout with its authored ammo charges.
    ammoCastLockout: 0.5,
    castTimeMs: 400,
    effects: [
      {
        type: 'buff',
        kind: STATUS.STEALTH,
        duration: 3,
        stacks: 1
      },
      {
        type: 'boon',
        boon: BOON.SWIFTNESS,
        duration: 6,
        stacks: 1
      }
    ],
    // Prowess remains independent of stealth and Revealed, with one shared choice window.
    sideEffects: [{ on: 'castCommit', do: { type: 'ranger.hunters-prowess' } }]
  }
};

/** Owns Ranger spear stealth attacks alongside the other weapon skills. */
export const RANGER_CORE_SPEAR_EXTRA_SKILLS: readonly RangerSkill[] = [
  {
    name: "Wolf's Onslaught",
    icon: 'https://render.guildwars2.com/file/E1550C4BB87B62B14AC39E3F2DB2AC4E07F55F91/3379175.png',
    id: ID.WOLFS_ONSLAUGHT,
    type: 'Weapon',
    weapon: WEAPON.SPEAR,
    slot: 'Weapon_2',
    cooldown: 5,
    stealthAttack: true,
    // Both EVTC animation segments are one attack; cancellation drops pending hits, not earlier contacts.
    castTimeMs: 1000,
    interruptMode: 'per-packet',
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        // Snap each strike to the nearest 40 ms action tick while preserving its coefficient.
        ticks: [
          { atMs: 400, coefficient: 1.25 },
          { atMs: 720, coefficient: 1.25 },
          { atMs: 960, coefficient: 2.5 }
        ]
      },
      {
        type: 'condition',
        ticks: [400, 720, 960].map((atMs) => ({ atMs, condition: CONDITION.VULNERABILITY, stacks: 1, duration: 8 }))
      }
    ]),
    // An accepted attempt consumes every choice, including an interrupted attack.
    sideEffects: [{ on: 'castStart', do: { type: 'ranger.spear-opportunity' } }]
  },
  {
    name: "Owl's Flight",
    icon: 'https://render.guildwars2.com/file/FBA45321DB6E98FB510AF8215EF0A19EB4FB4FC6/3379177.png',
    id: ID.OWLS_FLIGHT,
    type: 'Weapon',
    weapon: WEAPON.SPEAR,
    slot: 'Weapon_3',
    cooldown: 7,
    stealthAttack: true,
    // Match Falcon's contact and recovery windows while keeping the stealth payload.
    castTimeMs: 720,
    interruptMode: 'per-packet',
    effects: impactEffects({ atMs: 520, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        projectile: true,
        coefficient: 3.25,
        hits: 1,
        comboFinishers: [
          {
            ownerId: 'ranger',
            finisherType: COMBO_FINISHER.PROJECTILE
          }
        ]
      },
      {
        type: 'condition',
        condition: CONDITION.CRIPPLED,
        stacks: 1,
        duration: 4
      }
    ]),
    // An accepted attempt consumes every choice, including an interrupted attack.
    sideEffects: [{ on: 'castStart', do: { type: 'ranger.spear-opportunity' } }]
  },
  {
    name: "Predator's Ambush",
    icon: 'https://render.guildwars2.com/file/2D36D9D30E372A750D700F3334A8CE697B4C3010/3379179.png',
    id: ID.PREDATORS_AMBUSH,
    type: 'Weapon',
    weapon: WEAPON.SPEAR,
    slot: 'Weapon_4',
    cooldown: 12,
    stealthAttack: true,
    evades: true,
    // The empowered leap shares Warclaw's contact and recovery windows.
    castTimeMs: 920,
    interruptMode: 'per-packet',
    effects: impactEffects({ atMs: 800, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        coefficient: 3.67,
        // Read remaining target health at impact, including strict exclusion of the threshold itself.
        coefficientModifiers: [{ kind: 'target-health-below', threshold: 0.5, multiplier: 1.2 }],
        hits: 1,
        comboFinishers: [
          {
            ownerId: 'ranger',
            finisherType: COMBO_FINISHER.LEAP
          }
        ]
      },
      {
        type: 'control',
        controlKind: CONTROL.DAZE
      }
    ]),
    // An accepted attempt consumes every choice, including an interrupted attack.
    sideEffects: [{ on: 'castStart', do: { type: 'ranger.spear-opportunity' } }]
  },
  {
    name: "Spider's Web",
    icon: 'https://render.guildwars2.com/file/1C6D1E0860B3B6C24136F1489F5AACD87D329EC7/3379181.png',
    id: ID.SPIDERS_WEB,
    type: 'Weapon',
    weapon: WEAPON.SPEAR,
    slot: 'Weapon_5',
    cooldown: 20,
    stealthAttack: true,
    // Resolve the web and pet support effects when the observed cast completes.
    castTimeMs: 680,
    interruptMode: 'per-packet',
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1
      },
      {
        type: 'condition',
        condition: CONDITION.IMMOBILIZED,
        stacks: 1,
        duration: 2
      },
      {
        // The four-second net reapplies a one-second cripple instead of one long application.
        type: 'condition',
        ticks: [0, 1000, 2000, 3000].map((atMs) => ({ atMs, condition: CONDITION.CRIPPLED, stacks: 1, duration: 1 })),
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        // Spider's Web aids the active pet, not the ranger's own movement boons.
        type: 'buff',
        kind: STATUS.SUPERSPEED,
        stacks: 1,
        duration: 3,
        audience: { recipients: RECIPIENT.SUMMONS, affectsSelf: false }
      }
    ],
    // An accepted attempt consumes every choice, including an interrupted attack.
    sideEffects: [{ on: 'castStart', do: { type: 'ranger.spear-opportunity' } }]
  }
];

/** Copy the live source recharge on commitment and cancellation, excluding Panther's independent ammo. */
function synchronizeSpearRecharge(runtime: RangerRuntime, cast: RuntimeCast<RangerSkill>): void {
  for (const [parentId, flip] of Object.entries(RANGER_SPEAR_STEALTH_FLIP_BY_PARENT)) {
    const parent = Number(parentId);

    if (parent === ID.PANTHERS_PROWL || (cast.skill.id !== parent && cast.skill.id !== flip)) continue;

    runtime.cooldownController.copy(cast.skill.id, parent);
    runtime.cooldownController.copy(cast.skill.id, flip);
  }
}

/** Reuse the shared flip ledger so stale expiry cannot clear a later Prowess grant. */
function armHuntersProwess(runtime: RangerRuntime): void {
  for (const flip of Object.values(RANGER_SPEAR_STEALTH_FLIP_BY_PARENT))
    armSkillFlip(runtime.profession.core.availableFlips, flip, runtime.time, runtime.time + 3);
}

/** Spending either Prowess or external stealth uses the shared reveal transition and closes all spear alternatives. */
function consumeSpearOpportunity(runtime: RangerRuntime): void {
  const state = runtime.profession.core;
  for (const flip of Object.values(RANGER_SPEAR_STEALTH_FLIP_BY_PARENT)) consumeSkillFlip(state.availableFlips, flip);
  endStealth(state, runtime.time);
}

/** Hunter's Prowess and stealth attacks share one flip ledger; paired attacks share recharge on commit and cancel. */
export const spearLifecycle = {
  sideEffectHandlers: {
    'ranger.hunters-prowess': armHuntersProwess,
    'ranger.spear-opportunity': consumeSpearOpportunity
  },
  onCastCommit: synchronizeSpearRecharge,
  onCastCancel: synchronizeSpearRecharge
} satisfies RuntimeHooks<RangerRuntimeState, RangerSkill>;

/** Intrinsic live-impact policy stays beside its skill; the shared registry supplies resolution. */
export const rangerFalconsStoopModifier: Gw2ModifierRule = {
  // Spear bonuses are evaluated at impact so live conditions and the health threshold affect the correct hit.
  id: 'ranger.falcons-stoop-disabled',
  target: MODIFIER_TARGET.STRIKE_DAMAGE,
  operation: 'multiply',
  factor: 1.2,
  when: (context) =>
    skillForEvent(context.profession?.catalog, context.event, context.skillId)?.id === ID.FALCONS_STOOP &&
    (context.config?.target?.defiant || targetConditionActive(context, CONDITION.IMMOBILIZED))
};
