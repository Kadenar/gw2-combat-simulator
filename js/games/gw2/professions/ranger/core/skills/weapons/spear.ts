import { MODIFIER_TARGET, type Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import { eventSkill, targetConditionActive } from '#gw2/platform/combat/query/runtime-query.js';
import type { RangerSkill, RangerRuntime } from '#gw2/professions/ranger/types.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { armSkillFlip, consumeSkillFlip } from '#gw2/platform/execution/skill-flips.js';
import { RANGER_SPEAR_STEALTH_FLIP_BY_PARENT } from '#gw2/professions/ranger/core/mechanics/weapon-state.js';
/** Core ranger spear mechanics; observed attacks separate contact offsets from their recovery windows. */
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { Skill } from '#gw2/platform/skills/types.js';

// Share adjacent impact timing while preserving local payloads, attribution, and independent timelines.
// Projectile flags belong to strikes so Mistral and Shrike count impacts independently of combo success.
export const RANGER_CORE_SPEAR_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.DRAKES_SWIPE]: {
    flipSkillId: null,
    // Separate contact from recovery; per-packet cancellation retains only contacts already reached.
    interruptMode: 'per-packet',
    effects: [
      {
        type: 'strike',
        coefficient: 1.1,
        hits: 1,
        atMs: 400,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ],
    castTimeMs: 520
  },
  [ID.FALCONS_STOOP]: {
    interruptMode: 'per-packet',
    effects: impactEffects({ atMs: 520, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        projectile: true,
        coefficient: 1.95,
        hits: 1,
        comboFinishers: [{ ownerId: 'ranger', finisherType: 'Projectile', ambiguousFieldSelection: 'oldest' }]
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 4
      }
    ]),
    castTimeMs: 600
  },
  [ID.PANTHERS_PROWL]: {
    // Prowess remains independent of stealth and Revealed, with one shared choice window.
    sideEffects: [{ on: 'castCommit', do: { type: 'ranger.hunters-prowess' } }],
    ammo: 2,
    ammoRecharge: 10,
    // The API omits this skill's ammo count; keep its between-cast lockout with the authored charges.
    ammoCastLockout: 0.5,
    effects: [
      {
        type: 'buff',
        kind: 'stealth',
        duration: 3,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'swiftness',
        duration: 6,
        stacks: 1
      }
    ],
    castTimeMs: 400
  },
  [ID.WARCLAWS_ENGAGE]: {
    evades: true,
    interruptMode: 'per-packet',
    effects: [
      {
        type: 'strike',
        coefficient: 2.75,
        // Read remaining target health at impact, including strict exclusion of the threshold itself.
        coefficientModifiers: [{ kind: 'target-health-below', threshold: 0.5, multiplier: 1.2 }],
        hits: 1,
        atMs: 840,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        comboFinishers: [{ ownerId: 'ranger', finisherType: 'Leap', ambiguousFieldSelection: 'oldest' }]
      }
    ],
    castTimeMs: 960
  },
  [ID.CHEETAHS_STRIKE]: {
    flipSkillId: null,
    interruptMode: 'per-packet',
    effects: impactEffects({ atMs: 560, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        coefficient: 1.8,
        hits: 1
      },
      {
        type: 'boon',
        boon: 'swiftness',
        duration: 3,
        stacks: 1
      }
    ]),
    castTimeMs: 760
  },
  [ID.MONGOOSES_FRENZY]: {
    interruptMode: 'per-packet',
    effects: [
      {
        type: 'strike',
        coefficient: 2.5,
        hits: 2,
        atMs: 0
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 8,
        duration: 8
      }
    ],
    castTimeMs: 667
  },
  [ID.WYVERNS_LASH]: {
    interruptMode: 'per-packet',
    effects: impactEffects({ atMs: 400, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        coefficient: 1.4,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 2
      }
    ]),
    castTimeMs: 440
  }
});

/** Owns supplemental Ranger spear stealth-attack identities omitted by the API catalog. */
export const RANGER_CORE_SPEAR_EXTRA_SKILLS: readonly Skill[] = Object.freeze([
  {
    id: ID.WOLFS_ONSLAUGHT,
    name: "Wolf's Onslaught",
    description: 'Stealth Attack. Slash enemies in front of you, then follow up with a powerful blow.',
    icon: 'https://render.guildwars2.com/file/E1550C4BB87B62B14AC39E3F2DB2AC4E07F55F91/3379175.png',
    type: 'Weapon',
    weapon: 'Spear',
    slot: 'Weapon_2',
    // Both EVTC animation segments are one attack; cancellation drops pending hits, not earlier contacts.
    castTimeMs: 1000,
    interruptMode: 'per-packet',

    cooldown: 5,
    flipParentId: ID.MONGOOSES_FRENZY,
    stealthAttack: true,
    // An accepted attempt consumes every choice, including an interrupted attack.
    sideEffects: [{ on: 'castStart', do: { type: 'ranger.spear-opportunity' } }],
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
        ticks: [400, 720, 960].map((atMs) => ({ atMs, condition: 'Vulnerability', stacks: 1, duration: 8 }))
      }
    ])
  },
  {
    id: ID.OWLS_FLIGHT,
    name: "Owl's Flight",
    description: 'Stealth Attack. Reveal yourself and throw an unblockable, piercing spear.',
    icon: 'https://render.guildwars2.com/file/FBA45321DB6E98FB510AF8215EF0A19EB4FB4FC6/3379177.png',
    type: 'Weapon',
    weapon: 'Spear',
    slot: 'Weapon_3',
    castTimeMs: 500,
    interruptMode: 'per-packet',

    cooldown: 7,
    flipParentId: ID.FALCONS_STOOP,
    stealthAttack: true,
    // An accepted attempt consumes every choice, including an interrupted attack.
    sideEffects: [{ on: 'castStart', do: { type: 'ranger.spear-opportunity' } }],
    effects: [
      {
        type: 'strike',
        projectile: true,
        coefficient: 3.25,
        hits: 1,
        comboFinishers: [
          {
            ownerId: 'ranger',
            finisherType: 'Projectile',
            ambiguousFieldSelection: 'oldest'
          }
        ]
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 4
      }
    ]
  },
  {
    id: ID.PREDATORS_AMBUSH,
    name: "Predator's Ambush",
    description:
      'Stealth Attack. Leap to a target location, dazing enemies. Deal increased damage to foes below the health threshold.',
    icon: 'https://render.guildwars2.com/file/2D36D9D30E372A750D700F3334A8CE697B4C3010/3379179.png',
    type: 'Weapon',
    weapon: 'Spear',
    slot: 'Weapon_4',
    castTimeMs: 960,
    interruptMode: 'per-packet',

    cooldown: 12,
    flipParentId: ID.WARCLAWS_ENGAGE,
    stealthAttack: true,
    // An accepted attempt consumes every choice, including an interrupted attack.
    sideEffects: [{ on: 'castStart', do: { type: 'ranger.spear-opportunity' } }],
    evades: true,
    effects: impactEffects({ atMs: 840, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        coefficient: 3.67,
        // Read remaining target health at impact, including strict exclusion of the threshold itself.
        coefficientModifiers: [{ kind: 'target-health-below', threshold: 0.5, multiplier: 1.2 }],
        hits: 1,
        comboFinishers: [
          {
            ownerId: 'ranger',
            finisherType: 'Leap',
            ambiguousFieldSelection: 'oldest'
          }
        ]
      },
      {
        type: 'control',
        controlKind: 'daze'
      }
    ])
  },
  {
    id: ID.SPIDERS_WEB,
    name: "Spider's Web",
    description: 'Stealth Attack. Throw a net that damages, immobilizes, and cripples enemies.',
    icon: 'https://render.guildwars2.com/file/1C6D1E0860B3B6C24136F1489F5AACD87D329EC7/3379181.png',
    type: 'Weapon',
    weapon: 'Spear',
    slot: 'Weapon_5',
    castTimeMs: 333,
    interruptMode: 'per-packet',

    cooldown: 20,
    flipParentId: ID.PANTHERS_PROWL,
    stealthAttack: true,
    // An accepted attempt consumes every choice, including an interrupted attack.
    sideEffects: [{ on: 'castStart', do: { type: 'ranger.spear-opportunity' } }],
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Immobilized',
        stacks: 1,
        duration: 2
      },
      {
        // The four-second net reapplies a one-second cripple instead of one long application.
        type: 'condition',
        ticks: [0, 1000, 2000, 3000].map((atMs) => ({ atMs, condition: 'Crippled', stacks: 1, duration: 1 })),
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        // Spider's Web aids the active pet, not the ranger's own movement boons.
        type: 'buff',
        kind: 'superspeed',
        stacks: 1,
        duration: 3,
        audience: { recipients: 'summons', affectsSelf: false }
      }
    ]
  }
]);

/** Copy the live source recharge on commitment and cancellation, excluding Panther's independent ammo. */
export function synchronizeSpearRecharge(runtime: RangerRuntime, cast: RuntimeCast<RangerSkill>): void {
  for (const [parentId, flip] of Object.entries(RANGER_SPEAR_STEALTH_FLIP_BY_PARENT)) {
    const parent = Number(parentId);
    if (parent === ID.PANTHERS_PROWL || (cast.skill.id !== parent && cast.skill.id !== flip)) continue;
    runtime.cooldownController.copy(cast.skill.id, parent);
    runtime.cooldownController.copy(cast.skill.id, flip);
  }
}

/** Reuse the shared flip ledger so stale expiry cannot clear a later Prowess grant. */
export function armHuntersProwess(runtime: RangerRuntime): void {
  for (const flip of Object.values(RANGER_SPEAR_STEALTH_FLIP_BY_PARENT))
    armSkillFlip(runtime.profession.core.availableFlips, flip, runtime.time, runtime.time + 3);
}

/** Spending either Prowess or external stealth reveals the ranger and closes all spear alternatives. */
export function consumeSpearOpportunity(runtime: RangerRuntime): void {
  const state = runtime.profession.core;
  for (const flip of Object.values(RANGER_SPEAR_STEALTH_FLIP_BY_PARENT)) consumeSkillFlip(state.availableFlips, flip);
  state.stealthUntil = runtime.time;
  state.revealedUntil = runtime.time + 3;
}

/** Intrinsic live-impact policy stays beside its skill; the shared registry supplies resolution. */
export const rangerFalconsStoopModifier: Gw2ModifierRule = {
  // Spear bonuses are evaluated at impact so live conditions and the health threshold affect the correct hit.
  id: 'ranger.falcons-stoop-disabled',
  target: MODIFIER_TARGET.STRIKE_DAMAGE,
  operation: 'multiply',
  factor: 1.2,
  when: (context) =>
    eventSkill(context)?.id === ID.FALCONS_STOOP &&
    (context.config?.target?.defiant || targetConditionActive(context, 'Immobilized'))
};
