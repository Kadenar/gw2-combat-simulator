/**
 * Pistol weapon-skill mechanics owned by the Core Elementalist module.
 *
 * Covers slots 1-3 in all four attunements plus the attunement-independent
 * Elemental Explosion. Most slot-2 and slot-3 skills either stock or spend an
 * elemental bullet. Shared bullet bookkeeping lives in `core/mechanics/pistol-bullets.ts`;
 * this module owns the enhanced payloads and cross-cast pistol rewards.
 */
import { consumeCharge, grantCharges } from '#gw2/platform/combat/resources/charges.js';
import { ACTOR, AURA, BOON, COMBO_FIELD, COMBO_FINISHER, CONDITION, CONTROL, WEAPON } from '#gw2/platform/constants.js';
import { requireSkillAction } from '#gw2/platform/effects/actions.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import { resolverSourceSkill } from '#gw2/platform/effects/packet-builders.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import { resetAutoattackChains } from '#gw2/platform/execution/autoattack-chains.js';
import { denySkillCast, type AvailabilityResult } from '#gw2/platform/execution/availability.js';
import type { SkillTaskData } from '#gw2/platform/execution/cast-contracts.js';
import { projectCastRelativeEffectTimingMs } from '#gw2/platform/execution/cast-timing.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { RuntimeProfession } from '#gw2/platform/profession-definition/runtime-contract.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import {
  effectNumber,
  requireEffect,
  requireSkillFromContext,
  skillNumber,
  skillNumberFromContext
} from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { elementalistBuffRequest, elementalistStrikeRequest } from '#gw2/professions/elementalist/core/events.js';
import { applyElementalistAura } from '#gw2/professions/elementalist/core/mechanics/auras.js';
import {
  elementalistBuffEffectRequest,
  elementalistConditionEffectRequest,
  skillWeapon
} from '#gw2/professions/elementalist/core/mechanics/effects.js';
import {
  allPistolBulletsLoaded,
  hasPistolBullet,
  pistolBulletSideEffectHandlers,
  spendAllPistolBullets
} from '#gw2/professions/elementalist/core/mechanics/pistol-bullets.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import type {
  ElementalistResolverContext,
  ElementalistRuntime,
  ElementalistRuntimeState,
  ElementalistSkill
} from '#gw2/professions/elementalist/types.js';

// Frigid Flurry fires five shots at these offsets, each an independent Bleeding stack and Projectile finisher.
const FRIGID_FLURRY_SHOT_OFFSETS_MS = [280, 440, 640, 800, 960];

/** How long an advanced Aerial Agility stage stays offered before its chain resets. */
const AERIAL_AGILITY_FLIP_WINDOW_SECONDS = 5;

/**
 * Skill-id keyed fragments the Core module contributes to the pistol catalog.
 * Each entry declares the packet timeline the scheduler materializes for that skill.
 */
// Shared impact timing keeps companion payloads independent and in their authored order.
export const ELEMENTALIST_CORE_PISTOL_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.SCORCHING_SHOT]: {
    name: 'Scorching Shot',
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: WEAPON.PISTOL,
    attunement: 'Fire',
    categories: ['Weapon skill'],
    cooldown: 0,
    skillFamily: 'Weapon skill',
    castTimeMs: 520,
    // The projectile launches before impact, so cancelling its aftercast preserves the hit and Burning.
    interruptCommitMs: 320,
    effects: impactEffects(
      { atMs: 360, timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true },
      [
        { type: 'strike', coefficient: 0.3 },
        { type: 'condition', condition: CONDITION.BURNING, stacks: 1, duration: 1.5 }
      ]
    )
  },
  // Select extra Might from the live bullet before the final action loads or spends that bullet.
  [ID.RAGING_RICOCHET]: {
    name: 'Raging Ricochet',
    type: 'Weapon',
    slot: 'Weapon_2',
    weapon: WEAPON.PISTOL,
    attunement: 'Fire',
    categories: ['Weapon skill'],
    cooldown: 6,
    skillFamily: 'Weapon skill',
    castTimeMs: 520,
    interruptCommitMs: 320,
    effects: impactEffects(
      { atMs: 360, timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true },
      [
        { type: 'strike', coefficient: 0.8 },
        { type: 'condition', condition: CONDITION.BURNING, stacks: 1, duration: 8 },
        { type: 'boon', boon: BOON.MIGHT, stacks: 1, duration: 6 }
      ]
    ),
    // Resolve the live bullet bonus before the shared load/spend mutation; cancellation does neither.
    sideEffects: [
      {
        on: 'castCommit',
        when: hasPistolBullet,
        do: {
          type: 'elementalist.pistol.raging-ricochet',
          id: 'fire-bullet',
          effects: [{ type: 'boon', name: 'Fire', boon: BOON.MIGHT, stacks: 1, duration: 10 }]
        }
      },
      { on: 'castCommit', do: { type: 'elementalist.pistol.load-or-spend' } }
    ]
  },
  // Blast finisher up front, then a four-shot salvo landing together a second later. Spending a Fire
  // bullet additionally grants a Fire Aura through the pistol cast handler.
  [ID.SEARING_SALVO]: {
    name: 'Searing Salvo',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.PISTOL,
    attunement: 'Fire',
    categories: ['Weapon skill'],
    cooldown: 12,
    skillFamily: 'Weapon skill',
    castTimeMs: 680,
    // The first projectile launches before the aftercast; its impact and follow-up salvo survive cancellation.
    interruptCommitMs: 320,
    effects: [
      ...impactEffects({ atMs: 440, timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true }, [
        {
          type: 'strike',
          coefficient: 1,
          comboFinishers: [
            {
              attemptGroup: 'effect:1:tick:1',
              ownerId: 'elementalist',
              finisherType: COMBO_FINISHER.BLAST
            }
          ]
        },
        { type: 'condition', condition: CONDITION.BURNING, stacks: 1, duration: 7 }
      ]),
      ...impactEffects({ atMs: 1440, timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true }, [
        { type: 'strike', coefficient: 0.25 },
        { type: 'condition', condition: CONDITION.BURNING, stacks: 1, duration: 2 }
      ]),
      ...impactEffects({ atMs: 1440, timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true }, [
        { type: 'strike', coefficient: 0.25 },
        { type: 'condition', condition: CONDITION.BURNING, stacks: 1, duration: 2 }
      ]),
      ...impactEffects({ atMs: 1440, timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true }, [
        { type: 'strike', coefficient: 0.25 },
        { type: 'condition', condition: CONDITION.BURNING, stacks: 1, duration: 2 }
      ]),
      ...impactEffects({ atMs: 1440, timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true }, [
        { type: 'strike', coefficient: 0.25 },
        { type: 'condition', condition: CONDITION.BURNING, stacks: 1, duration: 2 }
      ])
    ],
    // Resolve the live bullet bonus before the shared load/spend mutation; cancellation does neither.
    sideEffects: [
      {
        on: 'castCommit',
        when: hasPistolBullet,
        do: {
          type: 'elementalist.pistol.searing-salvo',
          id: 'fire-bullet',
          effects: [{ type: 'aura', name: 'Fire', aura: AURA.FIRE, duration: 4 }]
        }
      },
      { on: 'castCommit', do: { type: 'elementalist.pistol.load-or-spend' } }
    ]
  },
  [ID.SOOTHING_SPLASH]: {
    name: 'Soothing Splash',
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: WEAPON.PISTOL,
    attunement: 'Water',
    categories: ['Weapon skill'],
    cooldown: 0,
    skillFamily: 'Weapon skill',
    castTimeMs: 520,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 360,
            coefficient: 0.4
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  // Five-shot channel with a Bleeding stack per shot; `per-packet` interruption keeps only the shots
  // that already landed.
  [ID.FRIGID_FLURRY]: {
    name: 'Frigid Flurry',
    type: 'Weapon',
    slot: 'Weapon_2',
    weapon: WEAPON.PISTOL,
    attunement: 'Water',
    categories: ['Weapon skill'],
    cooldown: 5,
    skillFamily: 'Weapon skill',
    castTimeMs: 1000,
    interruptMode: 'per-packet',
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        // Each projectile owns an independent combo attempt; interrupted packets never attempt one.
        ticks: FRIGID_FLURRY_SHOT_OFFSETS_MS.map((atMs, index) => ({
          atMs,
          coefficient: 0.2,
          comboFinishers: [
            {
              ownerId: 'elementalist',
              attemptGroup: `frigid-flurry:${index + 1}`,
              finisherType: COMBO_FINISHER.PROJECTILE,
              chance: 0.2
            }
          ]
        }))
      },
      {
        type: 'condition',
        ticks: FRIGID_FLURRY_SHOT_OFFSETS_MS.map((atMs) => ({
          atMs,
          condition: CONDITION.BLEEDING,
          stacks: 1,
          duration: 7
        }))
      }
    ]),
    // Resolve the live bullet bonus before the shared load/spend mutation; cancellation does neither.
    sideEffects: [{ on: 'castCommit', do: { type: 'elementalist.pistol.load-or-spend' } }]
  },
  // The released shot starts a four-second ice field. Its enhanced detonation
  // follows that field's expiry, independently of the remaining aftercast.
  [ID.FROZEN_FUSILLADE]: {
    name: 'Frozen Fusillade',
    // The enhanced detonation waits this long after release, independently of ordinary packets.
    detonationDelay: 4,
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.PISTOL,
    attunement: 'Water',
    categories: ['Weapon skill'],
    cooldown: 15,
    skillFamily: 'Weapon skill',
    castTimeMs: 520,
    interruptCommitMs: 320,
    // Start the four-second ice field at release, independently of the projectile hit.
    comboFields: [
      {
        ownerId: 'elementalist',
        fieldType: COMBO_FIELD.ICE,
        duration: 4,
        startAnchor: 'castStart',
        startMs: 320
      }
    ],
    effects: impactEffects(
      { atMs: 360, timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true },
      [
        { type: 'strike', coefficient: 0.75 },
        { type: 'condition', condition: CONDITION.CHILLED, stacks: 1, duration: 1.5 }
      ]
    ),
    // Resolve the live bullet bonus before the shared load/spend mutation; cancellation does neither.
    sideEffects: [
      {
        on: 'castCommit',
        when: hasPistolBullet,
        do: {
          type: 'elementalist.pistol.frozen-fusillade',
          id: 'water-bullet',
          effects: [
            { type: 'strike', name: 'Water Bullet', coefficient: 0.75, hits: 1 },
            { type: 'condition', name: 'Water Bullet', condition: CONDITION.BLEEDING, stacks: 5, duration: 8 }
          ]
        }
      },
      { on: 'castCommit', do: { type: 'elementalist.pistol.load-or-spend' } }
    ]
  },
  [ID.ELECTRIC_EXPOSURE]: {
    name: 'Electric Exposure',
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: WEAPON.PISTOL,
    attunement: 'Air',
    categories: ['Weapon skill'],
    cooldown: 0,
    skillFamily: 'Weapon skill',
    castTimeMs: 520,
    // The launched projectile still applies its strike and Vulnerability after an aftercast cancellation.
    interruptCommitMs: 320,
    effects: impactEffects(
      { atMs: 360, timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true },
      [
        { type: 'strike', coefficient: 0.33 },
        { type: 'condition', condition: CONDITION.VULNERABILITY, stacks: 1, duration: 6 }
      ]
    )
  },
  // Strike plus crowd control; spending an Air bullet opens the Dazing Discharge window tracked in
  // profession state rather than adding packets here.
  [ID.DAZING_DISCHARGE]: {
    name: 'Dazing Discharge',
    // A consumed Air bullet arms one next-pistol recharge reduction for this window.
    duration: 5,
    nextSkillRechargeMultiplier: 0.67,
    type: 'Weapon',
    slot: 'Weapon_2',
    weapon: WEAPON.PISTOL,
    attunement: 'Air',
    categories: ['Weapon skill'],
    cooldown: 8,
    skillFamily: 'Weapon skill',
    castTimeMs: 440,
    // Commit the cast and bullet interaction before the remaining animation ends.
    interruptCommitMs: 400,
    // Preserve the committed strike, Vulnerability, and crowd control after interruption.
    effects: impactEffects(
      { atMs: 280, timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true },
      [
        { type: 'strike', coefficient: 0.75, canCrit: true },
        { type: 'condition', condition: CONDITION.VULNERABILITY, stacks: 8, duration: 10 },
        { type: 'control', applications: 1, controlKind: CONTROL.DAZE }
      ]
    ),
    // Resolve the live bullet bonus before the shared load/spend mutation; cancellation does neither.
    sideEffects: [
      { on: 'castCommit', when: hasPistolBullet, do: { type: 'elementalist.pistol.dazing-discharge' } },
      { on: 'castCommit', do: { type: 'elementalist.pistol.load-or-spend' } }
    ]
  },
  // First link of the three-step Aerial Agility flipover chain. The zero-coefficient packet exists only
  // to fire the leap finisher. The chain reads the Air bullet without spending it, and the two later
  // links can never stock one.
  [ID.AERIAL_AGILITY]: {
    name: 'Aerial Agility',
    autoattack: false, // This manually activated flip chain reuses the scheduler's autoattack sequencing index.
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.PISTOL,
    attunement: 'Air',
    categories: ['Weapon skill'],
    cooldown: 12,
    nextChainId: ID.AERIAL_AGILITY_CHAIN,
    skillFamily: 'Weapon skill',
    castTimeMs: 520,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 360,
            coefficient: 0,
            comboFinishers: [
              {
                ownerId: 'elementalist',
                finisherType: COMBO_FINISHER.LEAP
              }
            ]
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ],
    // The root only loads Air; its follow-up links neither grant nor consume bullets.
    sideEffects: [{ on: 'castCommit', do: { type: 'elementalist.pistol.load' } }]
  },
  [ID.AERIAL_AGILITY_CHAIN]: {
    name: 'Aerial Agility (chain)',
    autoattack: false,
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.PISTOL,
    attunement: 'Air',
    categories: ['Weapon skill'],
    cooldown: 0,
    nextChainId: ID.AERIAL_AGILITY_DASH,
    skillFamily: 'Weapon skill',
    castTimeMs: 480,
    effects: impactEffects({ atMs: 360, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 0.8 },
      { type: 'condition', condition: CONDITION.WEAKNESS, stacks: 1, duration: 3 }
    ])
  },
  [ID.AERIAL_AGILITY_DASH]: {
    name: 'Aerial Agility (dash)',
    autoattack: false,
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.PISTOL,
    attunement: 'Air',
    categories: ['Weapon skill'],
    cooldown: 0,
    nextChainId: ID.AERIAL_AGILITY,
    skillFamily: 'Weapon skill',
    castTimeMs: 520,
    effects: impactEffects({ atMs: 360, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        coefficient: 0,
        comboFinishers: [
          {
            attemptGroup: 'effect:1:tick:1',
            ownerId: 'elementalist',
            finisherType: COMBO_FINISHER.LEAP
          }
        ]
      },
      { type: 'boon', boon: BOON.AEGIS, stacks: 1, duration: 3 }
    ])
  },
  [ID.PIERCING_PEBBLE]: {
    name: 'Piercing Pebble',
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: WEAPON.PISTOL,
    attunement: 'Earth',
    categories: ['Weapon skill'],
    cooldown: 0,
    skillFamily: 'Weapon skill',
    castTimeMs: 520,
    // Release commits the projectile one action tick before its hit and Bleeding land.
    interruptCommitMs: 320,
    effects: impactEffects(
      { atMs: 360, timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true },
      [
        { type: 'strike', coefficient: 0.35 },
        { type: 'condition', condition: CONDITION.BLEEDING, stacks: 1, duration: 5 }
      ]
    )
  },
  [ID.SHATTERING_STONE]: {
    name: 'Shattering Stone',
    // The self buff arms these charges; impacts consume them until the window expires.
    maximumStacks: 3,
    duration: 10,
    type: 'Weapon',
    slot: 'Weapon_2',
    weapon: WEAPON.PISTOL,
    attunement: 'Earth',
    categories: ['Weapon skill'],
    cooldown: 6,
    skillFamily: 'Weapon skill',
    castTimeMs: 520,
    interruptCommitMs: 400,
    effects: impactEffects({ atMs: 360, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 0.8 },
      { type: 'condition', condition: CONDITION.BLEEDING, stacks: 3, duration: 10 }
    ]),
    // Resolve the live bullet bonus before the shared load/spend mutation; cancellation does neither.
    sideEffects: [
      {
        on: 'castCommit',
        when: hasPistolBullet,
        do: {
          type: 'elementalist.pistol.shattering-stone',
          id: 'earth-bullet',
          effects: [
            { type: 'condition', name: 'Triggered Bleeding', condition: CONDITION.BLEEDING, stacks: 1, duration: 5 }
          ]
        }
      },
      { on: 'castCommit', do: { type: 'elementalist.pistol.load-or-spend' } }
    ]
  },
  [ID.BOULDER_BLAST]: {
    name: 'Boulder Blast',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.PISTOL,
    attunement: 'Earth',
    categories: ['Weapon skill'],
    cooldown: 12,
    skillFamily: 'Weapon skill',
    castTimeMs: 440,
    // Releasing the boulder commits its damage and conditions before the remaining cast animation ends.
    interruptCommitMs: 360,
    effects: impactEffects(
      { atMs: 400, timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true },
      [
        {
          type: 'strike',
          coefficient: 0.44,
          comboFinishers: [
            {
              attemptGroup: 'effect:1:tick:1',
              ownerId: 'elementalist',
              finisherType: COMBO_FINISHER.PROJECTILE
            }
          ]
        },
        { type: 'condition', condition: CONDITION.BLEEDING, stacks: 5, duration: 8 },
        { type: 'condition', condition: CONDITION.IMMOBILIZED, stacks: 1, duration: 1.5 }
      ]
    ),
    // Resolve the live bullet bonus before the shared load/spend mutation; cancellation does neither.
    sideEffects: [
      { on: 'castCommit', when: hasPistolBullet, do: { type: 'elementalist.pistol.boulder-blast' } },
      { on: 'castCommit', do: { type: 'elementalist.pistol.load-or-spend' } }
    ]
  },
  [ID.ELEMENTAL_EXPLOSION]: {
    name: 'Elemental Explosion',
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: WEAPON.PISTOL,
    categories: ['Weapon skill'],
    cooldown: 0,
    skillFamily: 'Weapon skill',
    castTimeMs: 520,
    // The explosion commits before its projectile packets, which persist after a 480 ms interruption.
    interruptCommitMs: 480,
    effects: [
      ...impactEffects({ atMs: 520, timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true }, [
        { type: 'strike', coefficient: 0.2 },
        {
          type: 'condition',
          condition: CONDITION.BURNING,
          stacks: 2,
          duration: 6
        }
      ]),
      ...impactEffects({ atMs: 600, timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true }, [
        { type: 'strike', coefficient: 0.2 },
        { type: 'condition', condition: CONDITION.BLEEDING, stacks: 4, duration: 6 }
      ]),
      ...impactEffects({ atMs: 680, timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true }, [
        { type: 'strike', coefficient: 0.2 },
        { type: 'condition', condition: CONDITION.VULNERABILITY, stacks: 4, duration: 10 }
      ]),
      ...impactEffects({ atMs: 760, timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true }, [
        { type: 'strike', coefficient: 0.2 },
        { type: 'condition', condition: CONDITION.CRIPPLED, stacks: 1, duration: 4 }
      ])
    ],
    // Elemental Explosion consumes every stored bullet and grants the current attunement's aura.
    sideEffects: [
      {
        on: 'castCommit',
        do: {
          type: 'elementalist.core.consume-elemental-explosion',
          id: 'attunement-aura',
          effects: [
            { type: 'aura', name: 'Fire', aura: AURA.FIRE, duration: 4 },
            { type: 'aura', name: 'Water', aura: AURA.FROST, duration: 4 },
            { type: 'aura', name: 'Air', aura: AURA.SHOCKING, duration: 3 },
            { type: 'aura', name: 'Earth', aura: AURA.MAGNETIC, duration: 3 }
          ]
        }
      }
    ]
  }
});

/** Enhancement actions read the completion-time bullet; the declaration changes its stock last. */
export const pistolSideEffectHandlers: RuntimeProfession<
  ElementalistRuntimeState,
  ElementalistSkill
>['sideEffectHandlers'] = {
  ...pistolBulletSideEffectHandlers,
  'elementalist.core.consume-elemental-explosion'(context, trigger) {
    if (trigger.kind !== 'cast') throw new TypeError('Elemental Explosion requires a cast trigger.');

    // Retain ordinary task priority: later deliveries and aura reactions must keep their existing ordering.
    context.scheduleForCast('elementalist.core.consume-elemental-explosion', context.time, trigger.cast, {});
  },
  'elementalist.pistol.raging-ricochet'(context, trigger, action) {
    if (trigger.kind !== 'cast') throw new TypeError('Pistol enhancements require a cast trigger.');

    const { cast, skill } = trigger;
    const at = cast.effectiveEnd;

    context.effects.emit(
      elementalistBuffEffectRequest(context, at, { skill, action }, 'Fire', skill.name, skill.id, {
        activationId: cast.id,
        skillId: cast.skill.id,
        offTarget: cast.command.offTarget
      })
    );
  },
  'elementalist.pistol.searing-salvo'(context, trigger, action) {
    if (trigger.kind !== 'cast') throw new TypeError('Pistol enhancements require a cast trigger.');

    const { cast, skill } = trigger;
    const at = cast.effectiveEnd;
    const aura = requireEffect(skill, 'aura', 'Fire', action);

    if (aura) {
      applyElementalistAura(context, {
        at,
        aura: aura.aura,
        duration: aura.duration,
        skillName: skill.name,
        sourceId: skill.id
      });
    }
  },
  'elementalist.pistol.frozen-fusillade'(context, trigger, action) {
    if (trigger.kind !== 'cast') throw new TypeError('Pistol enhancements require a cast trigger.');

    const { cast, skill } = trigger;
    // Anchor the selected detonation delay to release so aftercast length and
    // cancellation cannot move the enhanced reward.
    const delay = skillNumber(skill, 'detonationDelay');
    const detonationAt =
      cast.start +
      projectCastRelativeEffectTimingMs(skill, (cast.fullEnd - cast.start) * 1000, Number(skill.interruptCommitMs)) /
        1000 +
      delay;
    const frozenFusilladeWaterBulletStrike = requireEffect(skill, 'strike', 'Water Bullet', action);

    if (frozenFusilladeWaterBulletStrike) {
      context.effects.emit(
        elementalistStrikeRequest(
          context,
          {
            at: detonationAt,
            source: skill.name,
            sourceId: skill.id,
            actorType: ACTOR.PLAYER,
            skillName: skill.name,
            skillId: skill.id,
            coefficient: effectNumber(skill, frozenFusilladeWaterBulletStrike, 'coefficient'),
            skillWeapon: WEAPON.PISTOL
          },
          { activationId: cast.id, skillId: cast.skill.id, offTarget: cast.command.offTarget }
        )
      );
    }

    context.effects.emit(
      elementalistConditionEffectRequest(
        context,
        detonationAt,
        { skill, action },
        'Water Bullet',
        skill.name,
        skill.id,
        {
          activationId: cast.id,
          skillId: cast.skill.id,
          offTarget: cast.command.offTarget
        }
      )
    );
  },
  'elementalist.pistol.dazing-discharge'(context, trigger) {
    if (trigger.kind !== 'cast') throw new TypeError('Pistol enhancements require a cast trigger.');

    const { cast } = trigger;
    const at = cast.effectiveEnd;

    // Arms a window that shortens the next pistol skill's recharge; the
    // reduction is consumed by this weapon's recharge reservation.
    professionCoreState(context).dazingDischargeUntil = at + skillNumber(cast.skill, 'duration');
  },
  'elementalist.pistol.shattering-stone'(context, trigger) {
    if (trigger.kind !== 'cast') throw new TypeError('Pistol enhancements require a cast trigger.');

    const { cast, skill } = trigger;
    const at = cast.effectiveEnd;
    // Arm the buff on the event timeline so the resolver consumes its charges
    // in impact order, including attacks scheduled before this cast.
    context.effects.emit(
      elementalistBuffRequest(
        {
          skill: skill,
          at,
          source: skill.name,
          kind: 'shattering stone',
          stacks: skillNumber(skill, 'maximumStacks'),
          duration: skillNumber(skill, 'duration')
        },
        { activationId: cast.id, skillId: cast.skill.id, offTarget: cast.command.offTarget }
      )
    );
  },
  'elementalist.pistol.boulder-blast'(context, trigger) {
    if (trigger.kind !== 'cast') throw new TypeError('Pistol enhancements require a cast trigger.');

    const { cast, skill } = trigger;
    const at = cast.effectiveEnd;

    // The projectile finisher is a separate non-weapon activation from the
    // pistol strike, so downstream combo damage must not reuse its roll.
    context.effects.emit(
      elementalistStrikeRequest(
        context,
        {
          at,
          source: skill.name,
          sourceId: skill.id,
          actorType: ACTOR.EFFECT,
          skillName: skill.name,
          skillId: skill.id,
          coefficient: 0,
          canCrit: false,
          activationId: `${cast.id}:boulder-finisher`,
          comboFinishers: [
            {
              ownerId: 'elementalist',
              finisherType: COMBO_FINISHER.PROJECTILE
            }
          ]
        },
        { activationId: cast.id, skillId: cast.skill.id, offTarget: cast.command.offTarget }
      )
    );
  }
};

/** Arms Shattering Stone only when its self buff reaches the resolver timeline. */
export function applyShatteringStoneBuff(context: ElementalistResolverContext, event: Gw2ResolverEvent): void {
  if (event.kind !== 'shattering stone' || !event.resolvedAudience?.includesSelf) return;

  const core = professionCoreState(context);
  core.shatteringStone = grantCharges(event.stacks || 0, event.at + (event.duration || 0));
}

/** Spend Shattering Stone charges in resolved impact order, including previously scheduled attacks. */
export function triggerShatteringStone(context: ElementalistResolverContext, event: Gw2ResolverEvent): void {
  const core = professionCoreState(context);

  if (
    (event.actorType === ACTOR.PLAYER || event.actorType === ACTOR.EFFECT) &&
    Number(event.coefficient) > 0 &&
    consumeCharge(core.shatteringStone, event.at)
  ) {
    // Follow-up hits read the same patched action that armed the charges, without emitting its payload on cast.
    const skill = requireSkillFromContext(context, ID.SHATTERING_STONE);
    const bleeding = requireEffect(skill, 'condition', 'Triggered Bleeding', requireSkillAction(skill, 'earth-bullet'));

    if (bleeding) {
      context.effects.emit({
        kind: 'packet',
        settlement: 'reaction',
        event: {
          type: 'condition',
          at: event.at,
          source: 'Shattering Stone',
          sourceId: ID.SHATTERING_STONE,
          actorType: ACTOR.PLAYER,
          skillName: 'Shattering Stone',
          condition: String(bleeding.condition),
          stacks: Number(bleeding.stacks),
          duration: Number(bleeding.duration),
          triggeredBy: resolverSourceSkill(event)
        }
      });
    }
  }
}

/** Elemental Explosion is castable only while one bullet of every element is stored. */
export function elementalExplosionAvailability(
  context: MechanicQueriesOf<ElementalistRuntime>,
  skill: Skill
): AvailabilityResult | null {
  return Number(skill.id) === ID.ELEMENTAL_EXPLOSION && !allPistolBulletsLoaded(context)
    ? denySkillCast(skill, 'elementalist.pistol-bullets', 'requires all four elemental bullets.')
    : null;
}

/** Pistol owns its flip deadlines and recharge, plus Elemental Explosion's aura and bullet consumption. */
export const elementalistPistolLifecycle = {
  onAutoattackChainTransition(context, cast, result) {
    if (result.castChainRootId !== ID.AERIAL_AGILITY) return;

    const change = result.transitions.find((transition) => transition.chainRootId === ID.AERIAL_AGILITY);

    if (!change || (change.decision !== 'advance' && change.decision !== 'complete')) return;

    // Replace the previous stage's deadline so it cannot expire a newer stage, even after a reset.
    context.cancelOwner({ id: 'elementalist.aerial-agility', generation: 0 });

    if (Number(cast.skill.id) === ID.AERIAL_AGILITY_CHAIN) {
      const root = context.helpers.skillsById.get(ID.AERIAL_AGILITY);

      if (root) context.cooldownController.startRecharge(root, context.time);
    }

    if (change.decision === 'advance' && change.nextSkillId != null)
      context.schedule(
        'elementalist.aerial-agility-expire',
        context.time + AERIAL_AGILITY_FLIP_WINDOW_SECONDS,
        change.nextSkillId,
        { id: 'elementalist.aerial-agility', generation: 0 }
      );
  },
  tasks: {
    'elementalist.aerial-agility-expire'(context, data) {
      if (professionCoreState(context).autoattackChains[ID.AERIAL_AGILITY] !== Number(data)) return;

      // This slot-three flip never carries across attunements; expiry resets only its own chain.
      resetAutoattackChains(context, [ID.AERIAL_AGILITY]);
    },
    // Grant the current attunement's aura before consuming all four bullets.
    'elementalist.core.consume-elemental-explosion'(runtime, data) {
      const { cast } = data as SkillTaskData<ElementalistSkill>;
      const effect = requireEffect(
        cast.skill,
        'aura',
        runtime.profession.core.primaryAttunement,
        requireSkillAction(cast.skill, 'attunement-aura')
      );

      if (effect)
        applyElementalistAura(runtime, {
          at: runtime.time,
          aura: effect.aura,
          duration: effect.duration,
          skillName: cast.skill.name,
          sourceId: cast.skill.id
        });

      spendAllPistolBullets(runtime);
    }
  }
} satisfies RuntimeHooks<ElementalistRuntimeState, ElementalistSkill>;

/** An accepted non-auto pistol cast consumes Dazing Discharge once and keeps its reserved recharge. */
export function reservePistolRecharge(context: ElementalistRuntime, skill: Skill, duration: number): number {
  if (skill.type !== 'Weapon' || String(skill.slot || '') === 'Weapon_1') return duration;

  const state = professionCoreState(context);

  if (state.dazingDischargeUntil > context.time && skillWeapon(skill) === WEAPON.PISTOL) {
    state.dazingDischargeUntil = 0;
    return duration * skillNumberFromContext(context, ID.DAZING_DISCHARGE, 'nextSkillRechargeMultiplier');
  }

  return duration;
}
