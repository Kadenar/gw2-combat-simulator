import type { RuntimeProfession } from '#gw2/platform/profession-definition/runtime-contract.js';
import type {
  ElementalistRuntime,
  ElementalistRuntimeState,
  ElementalistSkill,
  ElementalistResolverContext
} from '#gw2/professions/elementalist/types.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { BalanceProfile } from '#gw2/platform/skills/types.js';
import { consumeCharge, grantCharges } from '#gw2/platform/combat/resources/charges.js';
import { resolverSourceSkill } from '#gw2/platform/effects/packet-builders.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import { defineSkillVariantProfile as variant } from '#gw2/platform/profession-definition/profile-authoring.js';
import { projectCastRelativeEffectTimingMs } from '#gw2/platform/execution/cast-timing.js';
import { elementalistBuffRequest, elementalistStrikeRequest } from '#gw2/professions/elementalist/core/events.js';
import {
  elementalistProfiledBuffRequest,
  elementalistProfiledConditionRequest,
  skillWeapon
} from '#gw2/professions/elementalist/core/mechanics/effects.js';
import { ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/core/profile-ids.js';
import { applyElementalistAura } from '#gw2/professions/elementalist/core/mechanics/auras.js';
import {
  hasPistolBullet,
  pistolBulletSideEffectHandlers
} from '#gw2/professions/elementalist/core/mechanics/pistol-bullets.js';
/**
 * Pistol weapon-skill mechanics owned by the Core Elementalist module.
 *
 * Covers slots 1-3 in all four attunements plus the attunement-independent
 * Elemental Explosion. Most slot-2 and slot-3 skills either stock or spend an
 * elemental bullet. Shared bullet bookkeeping lives in `core/mechanics/pistol-bullets.ts`;
 * this module owns the enhanced payloads, profiles, and cross-cast pistol rewards.
 */

import { impactEffects } from '#gw2/platform/effects/authoring.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import type { Skill } from '#gw2/platform/skills/types.js';

// Frigid Flurry fires five shots at these offsets, each an independent Bleeding stack and Projectile finisher.
const FRIGID_FLURRY_SHOT_OFFSETS_MS = [280, 440, 640, 800, 960];

/**
 * Skill-id keyed fragments the Core module contributes to the pistol catalog.
 * Each entry declares the packet timeline the scheduler materializes for that skill.
 */
// Shared impact timing keeps companion payloads independent and in their authored order.
export const ELEMENTALIST_CORE_PISTOL_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.SCORCHING_SHOT]: {
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    name: 'Scorching Shot',
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: 'Pistol',
    attunement: 'Fire',
    categories: ['Weapon skill'],
    castTimeMs: 520,
    // The projectile launches before impact, so cancelling its aftercast preserves the hit and Burning.
    interruptCommitMs: 320,
    cooldown: 0,
    skillFamily: 'Weapon skill',
    effects: impactEffects(
      { atMs: 360, timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true },
      [
        { type: 'strike', coefficient: 0.3 },
        { type: 'condition', condition: 'Burning', stacks: 1, duration: 1.5, metadata: {} }
      ]
    )
  },
  // Select extra Might from the live bullet before the final action loads or spends that bullet.
  [ID.RAGING_RICOCHET]: {
    // Resolve the live bullet bonus before the shared load/spend mutation; cancellation does neither.
    sideEffects: [
      { on: 'castCommit', when: hasPistolBullet, do: { type: 'elementalist.pistol.raging-ricochet' } },
      { on: 'castCommit', do: { type: 'elementalist.pistol.load-or-spend' } }
    ],
    name: 'Raging Ricochet',
    type: 'Weapon',
    slot: 'Weapon_2',
    weapon: 'Pistol',
    attunement: 'Fire',
    categories: ['Weapon skill'],
    castTimeMs: 520,
    interruptCommitMs: 320,
    cooldown: 6,
    skillFamily: 'Weapon skill',
    effects: impactEffects(
      { atMs: 360, timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true },
      [
        { type: 'strike', coefficient: 0.8 },
        { type: 'condition', condition: 'Burning', stacks: 1, duration: 8, metadata: {} },
        { type: 'boon', boon: 'Might', stacks: 1, duration: 6, metadata: {} }
      ]
    )
  },
  // Blast finisher up front, then a four-shot salvo landing together a second later. Spending a Fire
  // bullet additionally grants a Fire Aura through the pistol cast handler.
  [ID.SEARING_SALVO]: {
    // Resolve the live bullet bonus before the shared load/spend mutation; cancellation does neither.
    sideEffects: [
      { on: 'castCommit', when: hasPistolBullet, do: { type: 'elementalist.pistol.searing-salvo' } },
      { on: 'castCommit', do: { type: 'elementalist.pistol.load-or-spend' } }
    ],
    name: 'Searing Salvo',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Pistol',
    attunement: 'Fire',
    categories: ['Weapon skill'],
    castTimeMs: 680,
    // The first projectile launches before the aftercast; its impact and follow-up salvo survive cancellation.
    interruptCommitMs: 320,
    cooldown: 12,
    skillFamily: 'Weapon skill',
    effects: [
      ...impactEffects({ atMs: 440, timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true }, [
        {
          type: 'strike',
          coefficient: 1,
          comboFinishers: [
            {
              attemptGroup: 'effect:1:tick:1',
              ownerId: 'elementalist',
              finisherType: 'Blast',
              ambiguousFieldSelection: 'oldest'
            }
          ],
          metadata: {}
        },
        { type: 'condition', condition: 'Burning', stacks: 1, duration: 7, metadata: {} }
      ]),
      ...impactEffects({ atMs: 1440, timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true }, [
        { type: 'strike', coefficient: 0.25 },
        { type: 'condition', condition: 'Burning', stacks: 1, duration: 2, metadata: {} }
      ]),
      ...impactEffects({ atMs: 1440, timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true }, [
        { type: 'strike', coefficient: 0.25 },
        { type: 'condition', condition: 'Burning', stacks: 1, duration: 2, metadata: {} }
      ]),
      ...impactEffects({ atMs: 1440, timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true }, [
        { type: 'strike', coefficient: 0.25 },
        { type: 'condition', condition: 'Burning', stacks: 1, duration: 2, metadata: {} }
      ]),
      ...impactEffects({ atMs: 1440, timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true }, [
        { type: 'strike', coefficient: 0.25 },
        { type: 'condition', condition: 'Burning', stacks: 1, duration: 2, metadata: {} }
      ])
    ]
  },
  [ID.SOOTHING_SPLASH]: {
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    name: 'Soothing Splash',
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: 'Pistol',
    attunement: 'Water',
    categories: ['Weapon skill'],
    castTimeMs: 520,
    cooldown: 0,
    skillFamily: 'Weapon skill',
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
    // Resolve the live bullet bonus before the shared load/spend mutation; cancellation does neither.
    sideEffects: [{ on: 'castCommit', do: { type: 'elementalist.pistol.load-or-spend' } }],
    name: 'Frigid Flurry',
    interruptMode: 'per-packet',
    type: 'Weapon',
    slot: 'Weapon_2',
    weapon: 'Pistol',
    attunement: 'Water',
    categories: ['Weapon skill'],
    castTimeMs: 1000,
    cooldown: 5,
    skillFamily: 'Weapon skill',
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
              finisherType: 'Projectile',
              chance: 0.2,
              ambiguousFieldSelection: 'oldest'
            }
          ]
        })),
        metadata: {}
      },
      {
        type: 'condition',
        ticks: FRIGID_FLURRY_SHOT_OFFSETS_MS.map((atMs) => ({ atMs, condition: 'Bleeding', stacks: 1, duration: 7 })),
        metadata: {}
      }
    ])
  },
  // The released shot starts a four-second ice field. Its enhanced detonation
  // follows that field's expiry, independently of the remaining aftercast.
  [ID.FROZEN_FUSILLADE]: {
    // Resolve the live bullet bonus before the shared load/spend mutation; cancellation does neither.
    sideEffects: [
      { on: 'castCommit', when: hasPistolBullet, do: { type: 'elementalist.pistol.frozen-fusillade' } },
      { on: 'castCommit', do: { type: 'elementalist.pistol.load-or-spend' } }
    ],
    name: 'Frozen Fusillade',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Pistol',
    attunement: 'Water',
    categories: ['Weapon skill'],
    castTimeMs: 520,
    interruptCommitMs: 320,
    cooldown: 15,
    skillFamily: 'Weapon skill',
    // Start the four-second ice field at release, independently of the projectile hit.
    comboFields: [
      {
        ownerId: 'elementalist',
        fieldType: 'Ice',
        duration: 4,
        startAnchor: 'castStart',
        startMs: 320
      }
    ],
    effects: impactEffects(
      { atMs: 360, timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true },
      [
        { type: 'strike', coefficient: 0.75 },
        { type: 'condition', condition: 'Chilled', stacks: 1, duration: 1.5, metadata: {} }
      ]
    )
  },
  [ID.ELECTRIC_EXPOSURE]: {
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    name: 'Electric Exposure',
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: 'Pistol',
    attunement: 'Air',
    categories: ['Weapon skill'],
    castTimeMs: 520,
    // The launched projectile still applies its strike and Vulnerability after an aftercast cancellation.
    interruptCommitMs: 320,
    cooldown: 0,
    skillFamily: 'Weapon skill',
    effects: impactEffects(
      { atMs: 360, timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true },
      [
        { type: 'strike', coefficient: 0.33 },
        { type: 'condition', condition: 'Vulnerability', stacks: 1, duration: 6, metadata: {} }
      ]
    )
  },
  // Strike plus crowd control; spending an Air bullet opens the Dazing Discharge window tracked in
  // profession state rather than adding packets here.
  [ID.DAZING_DISCHARGE]: {
    // Resolve the live bullet bonus before the shared load/spend mutation; cancellation does neither.
    sideEffects: [
      { on: 'castCommit', when: hasPistolBullet, do: { type: 'elementalist.pistol.dazing-discharge' } },
      { on: 'castCommit', do: { type: 'elementalist.pistol.load-or-spend' } }
    ],
    name: 'Dazing Discharge',
    type: 'Weapon',
    slot: 'Weapon_2',
    weapon: 'Pistol',
    attunement: 'Air',
    categories: ['Weapon skill'],
    castTimeMs: 440,
    // Commit the cast and bullet interaction before the remaining animation ends.
    interruptCommitMs: 400,
    cooldown: 8,
    skillFamily: 'Weapon skill',
    // Preserve the committed strike, Vulnerability, and crowd control after interruption.
    effects: impactEffects(
      { atMs: 280, timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true },
      [
        { type: 'strike', coefficient: 0.75, canCrit: true },
        { type: 'condition', condition: 'Vulnerability', stacks: 8, duration: 10, metadata: {} },
        { type: 'control', applications: 1, controlKind: 'crowd-control' }
      ]
    )
  },
  // First link of the three-step Aerial Agility flipover chain. The zero-coefficient packet exists only
  // to fire the leap finisher. The chain reads the Air bullet without spending it, and the two later
  // links can never stock one.
  [ID.AERIAL_AGILITY]: {
    // The root only loads Air; its follow-up links neither grant nor consume bullets.
    sideEffects: [{ on: 'castCommit', do: { type: 'elementalist.pistol.load' } }],
    autoattack: false, // This manually activated flip chain reuses the scheduler's autoattack sequencing index.
    name: 'Aerial Agility',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Pistol',
    attunement: 'Air',
    categories: ['Weapon skill'],
    castTimeMs: 520,
    cooldown: 12,
    nextChainId: ID.AERIAL_AGILITY_CHAIN,
    skillFamily: 'Weapon skill',
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
                finisherType: 'Leap',
                ambiguousFieldSelection: 'oldest'
              }
            ],
            metadata: {}
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.AERIAL_AGILITY_CHAIN]: {
    autoattack: false,
    name: 'Aerial Agility (chain)',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Pistol',
    attunement: 'Air',
    categories: ['Weapon skill'],
    castTimeMs: 480,
    cooldown: 0,
    nextChainId: ID.AERIAL_AGILITY_DASH,
    skillFamily: 'Weapon skill',
    effects: impactEffects({ atMs: 360, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 0.8 },
      { type: 'condition', condition: 'Weakness', stacks: 1, duration: 3, metadata: {} }
    ])
  },
  [ID.AERIAL_AGILITY_DASH]: {
    autoattack: false,
    name: 'Aerial Agility (dash)',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Pistol',
    attunement: 'Air',
    categories: ['Weapon skill'],
    castTimeMs: 520,
    cooldown: 0,
    nextChainId: ID.AERIAL_AGILITY,
    skillFamily: 'Weapon skill',
    effects: impactEffects({ atMs: 360, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        coefficient: 0,
        comboFinishers: [
          {
            attemptGroup: 'effect:1:tick:1',
            ownerId: 'elementalist',
            finisherType: 'Leap',
            ambiguousFieldSelection: 'oldest'
          }
        ],
        metadata: {}
      },
      { type: 'boon', boon: 'Aegis', stacks: 1, duration: 3, metadata: {} }
    ])
  },
  [ID.PIERCING_PEBBLE]: {
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    name: 'Piercing Pebble',
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: 'Pistol',
    attunement: 'Earth',
    categories: ['Weapon skill'],
    castTimeMs: 520,
    // Release commits the projectile one action tick before its hit and Bleeding land.
    interruptCommitMs: 320,
    cooldown: 0,
    skillFamily: 'Weapon skill',
    effects: impactEffects(
      { atMs: 360, timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true },
      [
        { type: 'strike', coefficient: 0.35 },
        { type: 'condition', condition: 'Bleeding', stacks: 1, duration: 5, metadata: {} }
      ]
    )
  },
  [ID.SHATTERING_STONE]: {
    // Resolve the live bullet bonus before the shared load/spend mutation; cancellation does neither.
    sideEffects: [
      { on: 'castCommit', when: hasPistolBullet, do: { type: 'elementalist.pistol.shattering-stone' } },
      { on: 'castCommit', do: { type: 'elementalist.pistol.load-or-spend' } }
    ],
    name: 'Shattering Stone',
    type: 'Weapon',
    slot: 'Weapon_2',
    weapon: 'Pistol',
    attunement: 'Earth',
    categories: ['Weapon skill'],
    castTimeMs: 520,
    interruptCommitMs: 400,
    cooldown: 6,
    skillFamily: 'Weapon skill',
    effects: impactEffects({ atMs: 360, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 0.8 },
      { type: 'condition', condition: 'Bleeding', stacks: 3, duration: 10, metadata: {} }
    ])
  },
  [ID.BOULDER_BLAST]: {
    // Resolve the live bullet bonus before the shared load/spend mutation; cancellation does neither.
    sideEffects: [
      { on: 'castCommit', when: hasPistolBullet, do: { type: 'elementalist.pistol.boulder-blast' } },
      { on: 'castCommit', do: { type: 'elementalist.pistol.load-or-spend' } }
    ],
    name: 'Boulder Blast',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Pistol',
    attunement: 'Earth',
    categories: ['Weapon skill'],
    castTimeMs: 440,
    // Releasing the boulder commits its damage and conditions before the remaining cast animation ends.
    interruptCommitMs: 360,
    cooldown: 12,
    skillFamily: 'Weapon skill',
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
              finisherType: 'Projectile',
              ambiguousFieldSelection: 'oldest'
            }
          ],
          metadata: {}
        },
        { type: 'condition', condition: 'Bleeding', stacks: 5, duration: 8, metadata: {} },
        { type: 'condition', condition: 'Immobilized', stacks: 1, duration: 1.5, metadata: {} }
      ]
    )
  },
  [ID.ELEMENTAL_EXPLOSION]: {
    name: 'Elemental Explosion',
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: 'Pistol',
    categories: ['Weapon skill'],
    castTimeMs: 520,
    // The explosion commits before its projectile packets, which persist after a 480 ms interruption.
    interruptCommitMs: 480,
    cooldown: 0,
    skillFamily: 'Weapon skill',
    // Elemental Explosion consumes every stored bullet and grants the current attunement's aura.
    tasks: [
      {
        type: 'elementalist.core.consume-elemental-explosion',
        timingAnchor: 'castCommit'
      }
    ],
    effects: [
      ...impactEffects({ atMs: 520, timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true }, [
        { type: 'strike', coefficient: 0.2 },
        {
          type: 'condition',
          condition: 'Burning',
          stacks: 2,
          duration: 6,
          metadata: {}
        }
      ]),
      ...impactEffects({ atMs: 600, timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true }, [
        { type: 'strike', coefficient: 0.2 },
        { type: 'condition', condition: 'Bleeding', stacks: 4, duration: 6, metadata: {} }
      ]),
      ...impactEffects({ atMs: 680, timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true }, [
        { type: 'strike', coefficient: 0.2 },
        { type: 'condition', condition: 'Vulnerability', stacks: 4, duration: 10, metadata: {} }
      ]),
      ...impactEffects({ atMs: 760, timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true }, [
        { type: 'strike', coefficient: 0.2 },
        { type: 'condition', condition: 'Crippled', stacks: 1, duration: 4, metadata: {} }
      ])
    ]
  }
});

/** Enhancement actions read the completion-time bullet; the declaration changes its stock last. */
export const pistolSideEffectHandlers: RuntimeProfession<
  ElementalistRuntimeState,
  ElementalistSkill
>['sideEffectHandlers'] = {
  ...pistolBulletSideEffectHandlers,
  'elementalist.pistol.raging-ricochet'(context, trigger) {
    if (trigger.kind !== 'cast') throw new TypeError('Pistol enhancements require a cast trigger.');
    const { cast, skill } = trigger;
    const at = cast.effectiveEnd;
    {
      context.effects.emit(
        elementalistProfiledBuffRequest(
          context,
          at,
          PROFILE.ragingRicochet,
          'Fire',
          skill.name,
          skill.id,
          undefined,
          undefined,
          { activationId: cast.id, skillId: cast.skill.id, offTarget: cast.command.offTarget }
        )
      );
    }
  },
  'elementalist.pistol.searing-salvo'(context, trigger) {
    if (trigger.kind !== 'cast') throw new TypeError('Pistol enhancements require a cast trigger.');
    const { cast, skill } = trigger;
    const at = cast.effectiveEnd;
    {
      const searingSalvoProfile = requireBalanceProfileFromContext(context, PROFILE.searingSalvo);
      const aura = requireEffect(searingSalvoProfile, 'buff', 'Fire');
      if (aura) {
        applyElementalistAura(context, {
          at,
          aura: String(aura.kind),
          duration: aura.duration,
          skillName: skill.name,
          sourceId: skill.id
        });
      }
    }
  },
  'elementalist.pistol.frozen-fusillade'(context, trigger) {
    if (trigger.kind !== 'cast') throw new TypeError('Pistol enhancements require a cast trigger.');
    const { cast, skill } = trigger;
    {
      const frozenFusilladeProfile = requireBalanceProfileFromContext(context, PROFILE.frozenFusillade);
      // The field's four-second lifetime starts at projectile release, so
      // aftercast length and cancellation cannot move its enhanced detonation.
      const delay = balanceProfileNumber(frozenFusilladeProfile, 'initialDelay');
      const detonationAt =
        cast.start +
        projectCastRelativeEffectTimingMs(skill, (cast.fullEnd - cast.start) * 1000, Number(skill.interruptCommitMs)) /
          1000 +
        delay;
      const frozenFusilladeWaterBulletStrike = requireEffect(frozenFusilladeProfile, 'strike', 'Water Bullet');
      if (frozenFusilladeWaterBulletStrike) {
        context.effects.emit(
          elementalistStrikeRequest(
            context,
            {
              at: detonationAt,
              source: skill.name,
              sourceId: skill.id,
              actorType: 'player',
              skillName: skill.name,
              skillId: skill.id,
              coefficient: effectNumber(frozenFusilladeProfile, frozenFusilladeWaterBulletStrike, 'coefficient'),
              skillWeapon: 'Pistol'
            },
            { activationId: cast.id, skillId: cast.skill.id, offTarget: cast.command.offTarget }
          )
        );
      }

      context.effects.emit(
        elementalistProfiledConditionRequest(
          context,
          detonationAt,
          PROFILE.frozenFusillade,
          'Water Bullet',
          skill.name,
          skill.id,
          undefined,
          { activationId: cast.id, skillId: cast.skill.id, offTarget: cast.command.offTarget }
        )
      );
    }
  },
  'elementalist.pistol.dazing-discharge'(context, trigger) {
    if (trigger.kind !== 'cast') throw new TypeError('Pistol enhancements require a cast trigger.');
    const { cast } = trigger;
    const at = cast.effectiveEnd;
    {
      const dazingDischargeProfile = requireBalanceProfileFromContext(context, PROFILE.dazingDischarge);
      // Arms a window that shortens the next pistol skill's recharge; the
      // reduction is consumed by this weapon's recharge reservation.
      professionCoreState(context).dazingDischargeUntil =
        at + balanceProfileNumber(dazingDischargeProfile, 'durationMultiplier');
    }
  },
  'elementalist.pistol.shattering-stone'(context, trigger) {
    if (trigger.kind !== 'cast') throw new TypeError('Pistol enhancements require a cast trigger.');
    const { cast, skill } = trigger;
    const at = cast.effectiveEnd;
    {
      const shatteringStoneProfile = requireBalanceProfileFromContext(context, PROFILE.shatteringStone);
      // Arm the buff on the event timeline so the resolver consumes its charges
      // in impact order, including attacks scheduled before this cast.
      context.effects.emit(
        elementalistBuffRequest(
          {
            skill: skill,
            at,
            source: skill.name,
            kind: 'shattering stone',
            stacks: balanceProfileNumber(shatteringStoneProfile, 'maximumStacks'),
            duration: balanceProfileNumber(shatteringStoneProfile, 'durationMultiplier')
          },
          { activationId: cast.id, skillId: cast.skill.id, offTarget: cast.command.offTarget }
        )
      );
    }
  },
  'elementalist.pistol.boulder-blast'(context, trigger) {
    if (trigger.kind !== 'cast') throw new TypeError('Pistol enhancements require a cast trigger.');
    const { cast, skill } = trigger;
    const at = cast.effectiveEnd;
    {
      // The projectile finisher is a separate non-weapon activation from the
      // pistol strike, so downstream combo damage must not reuse its roll.
      context.effects.emit(
        elementalistStrikeRequest(
          context,
          {
            at,
            source: skill.name,
            sourceId: skill.id,
            actorType: 'effect',
            skillName: skill.name,
            skillId: skill.id,
            coefficient: 0,
            canCrit: false,
            activationId: `${cast.id}:boulder-finisher`,
            comboFinishers: [
              {
                ownerId: 'elementalist',
                finisherType: 'Projectile',
                ambiguousFieldSelection: 'oldest'
              }
            ]
          },
          { activationId: cast.id, skillId: cast.skill.id, offTarget: cast.command.offTarget }
        )
      );
    }
  }
};

/** Bullet enhancements retain independent patchable profiles beside their owning skills. */
export const pistolBalanceProfiles: readonly BalanceProfile[] = Object.freeze([
  variant(PROFILE.ragingRicochet, ID.RAGING_RICOCHET, 'Raging Ricochet - Fire Bullet', {
    effects: [{ type: 'boon', name: 'Fire', boon: 'Might', stacks: 1, duration: 10 }]
  }),
  variant(PROFILE.searingSalvo, ID.SEARING_SALVO, 'Searing Salvo - Fire Bullet', {
    effects: [{ type: 'buff', name: 'Fire', kind: 'Fire Aura', stacks: 1, duration: 4 }]
  }),
  variant(PROFILE.frozenFusillade, ID.FROZEN_FUSILLADE, 'Frozen Fusillade - Water Bullet', {
    initialDelay: 4,
    effects: [
      { type: 'strike', name: 'Water Bullet', coefficient: 0.75, hits: 1 },
      { type: 'condition', name: 'Water Bullet', condition: 'Bleeding', stacks: 5, duration: 8 }
    ]
  }),
  variant(PROFILE.dazingDischarge, ID.DAZING_DISCHARGE, 'Dazing Discharge - Air Bullet', {
    durationMultiplier: 5,
    rechargeMultiplier: 0.67
  }),
  variant(PROFILE.shatteringStone, ID.SHATTERING_STONE, 'Shattering Stone - Earth Bullet', {
    maximumStacks: 3,
    durationMultiplier: 10,
    effects: [{ type: 'condition', name: 'Triggered Bleeding', condition: 'Bleeding', stacks: 1, duration: 5 }]
  })
]);

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
    (event.actorType === 'player' || event.actorType === 'effect') &&
    Number(event.coefficient) > 0 &&
    consumeCharge(core.shatteringStone, event.at)
  ) {
    const shatteringStoneProfile = requireBalanceProfileFromContext(context, PROFILE.shatteringStone);
    const bleeding = requireEffect(shatteringStoneProfile, 'condition', 'Triggered Bleeding');
    if (bleeding) {
      context.effects.emit({
        kind: 'packet',
        settlement: 'reaction',
        event: {
          type: 'condition',
          at: event.at,
          source: 'Shattering Stone',
          sourceId: ID.SHATTERING_STONE,
          actorType: 'player',
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

/** An accepted non-auto pistol cast consumes Dazing Discharge once and keeps its reserved recharge. */
export function reservePistolRecharge(context: ElementalistRuntime, skill: Skill, duration: number): number {
  if (skill.type !== 'Weapon' || String(skill.slot || '') === 'Weapon_1') return duration;
  const state = professionCoreState(context);
  if (state.dazingDischargeUntil > context.time && skillWeapon(skill) === 'Pistol') {
    state.dazingDischargeUntil = 0;
    const dazingDischargeProfile = requireBalanceProfileFromContext(context, PROFILE.dazingDischarge);
    return duration * balanceProfileNumber(dazingDischargeProfile, 'rechargeMultiplier');
  }

  return duration;
}
