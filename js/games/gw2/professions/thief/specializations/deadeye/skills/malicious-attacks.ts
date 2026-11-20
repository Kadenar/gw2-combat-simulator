import { buffDeadlineActive } from '#gw2/platform/combat/buff-expiry.js';
import { MODIFIER_TARGET, type Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { ACTOR, BOON, COMBO_FINISHER, CONDITION, CONTROL, WEAPON } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { effectNumber, requireEffect, requireSkill, skillNumber } from '#gw2/platform/skills/balance-profiles.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import { buildThiefCondition } from '#gw2/professions/thief/core/events.js';
import { ashenAssaultEffects } from '#gw2/professions/thief/core/skills/weapons/spear.js';
import { thiefRuntimeSpecializationState } from '#gw2/professions/thief/core/state-queries.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import { deadeyeMarked, outgoingSalvoMalice } from '#gw2/professions/thief/specializations/deadeye/mechanics/malice.js';
import { markedTarget } from '#gw2/professions/thief/specializations/deadeye/skills/deadeyes-mark.js';
import type { ThiefRuntimeState, ThiefSimulationEvent, ThiefSkill } from '#gw2/professions/thief/types.js';

// Each pistol bullet has its own release. Projectile travel starts at that release.
const sneakAttackReleases = [160, 280, 400, 520, 600];

// Each Shadowsquall hit applies its own poison before the channel spends malice.
const shadowsquallImpacts = [400, 680, 880, 1160, 1320, 1600, 1800, 2080];

/** Both finisher bonuses use the malice held when they reach the marked target. */
function ashenFinisherMalice(context: Gw2ModifierContext): number {
  const state = thiefRuntimeSpecializationState(context.runtime?.profession, 'Deadeye');
  return state.markedTargetId && buffDeadlineActive(state.markExpiresAt ?? 0, context.time)
    ? (state.malice?.value ?? 0)
    : 0;
}

/** Malicious stealth attacks own their weapon effects and malice scaling. */
export const DEADEYE_MALICIOUS_ATTACKS: Readonly<Record<number, SkillDefinition<ThiefSkill>>> = {
  [ID.MALICIOUS_DEATHS_JUDGMENT]: {
    name: "Malicious Death's Judgment",
    icon: 'https://render.guildwars2.com/file/7228E29372F37958FEB8684E91F7060D71D3D6E2/1770628.png',
    type: 'Weapon',
    weapon: 'Rifle',
    slot: 'Weapon_1',
    cooldown: 1,
    requiredMainHand: WEAPON.RIFLE,
    stealthAttack: true,
    malicious: true,
    castTimeMs: 680,
    interruptCommitMs: 520,
    // Mercy during the windup or projectile flight reduces the malice available on impact.
    modifiers: [
      {
        order: 202,
        id: 'thief.malicious-deaths-judgment-malice',
        target: MODIFIER_TARGET.STRIKE_DAMAGE,
        operation: 'multiply',
        // Full malice scaling applies to marked and unmarked hits; spending still requires a marked hit.
        parameters: { damagePerMalice: 0.1 },
        factor: (context, _target, parameters) =>
          1 +
          Math.max(0, (context.event as ThiefSimulationEvent | undefined)?.deadeyeMaliceSnapshot || 0) *
            parameters.damagePerMalice,
        when: (context) => isGw2PlayerModifierOwnedEvent(context.event)
      }
    ],
    effects: [
      {
        type: 'strike' as const,
        ticks: [{ atMs: 520, coefficient: 2.67 }],
        name: "Malicious Death's Judgment - Packet 1",
        actorType: ACTOR.PLAYER,
        persistsAfterInterrupt: true,
        comboFinishers: [{ ownerId: 'thief', finisherType: COMBO_FINISHER.PROJECTILE }],
        timingAnchor: 'castStart' as const,
        timingScale: 'fixed' as const
      }
    ]
  },
  [ID.MALICIOUS_SURPRISE_SHOT]: {
    name: 'Malicious Surprise Shot',
    icon: 'https://render.guildwars2.com/file/0B78EA15E65D63D4D85E4C2E3840E679A6F9F378/2010291.png',
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: 'Shortbow',

    cooldown: 1,
    requiredMainHand: WEAPON.SHORTBOW,
    stealthAttack: true,
    malicious: true,
    // The arrow launches before the aftercast ends. Its impact delay depends on distance.
    castTimeMs: 640,
    interruptCommitMs: 200,
    effects: impactEffects(
      { atMs: 200, timingAnchor: 'castStart' as const, timingScale: 'fixed' as const, persistsAfterInterrupt: true },
      [
        {
          type: 'strike' as const,
          coefficient: 0.6,
          hits: 1,
          name: 'Malicious Surprise Shot',
          actorType: ACTOR.PLAYER,
          comboFinishers: [{ ownerId: 'thief', finisherType: COMBO_FINISHER.PROJECTILE }]
        },
        {
          type: 'condition' as const,
          condition: CONDITION.BLEEDING,
          stacks: 3,
          duration: 5,
          actorType: ACTOR.PLAYER
        },
        {
          type: 'condition' as const,
          condition: CONDITION.IMMOBILIZED,
          stacks: 1,
          duration: 2,
          actorType: ACTOR.PLAYER
        }
      ]
    )
  },
  [ID.MALICIOUS_SNEAK_ATTACK]: {
    name: 'Malicious Sneak Attack',
    icon: 'https://render.guildwars2.com/file/13ED5F3F5ACD4FC19452911309C4E46E46731671/2010290.png',
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: 'Pistol',

    durationPerMalice: 2,
    cooldown: 1,
    requiredMainHand: WEAPON.PISTOL,
    stealthAttack: true,
    malicious: true,
    castTimeMs: 760,
    interruptMode: 'per-packet',
    // Only the first bullet applies Torment. Its duration uses malice at impact.
    modifiers: [
      {
        id: 'thief.malicious-sneak-attack-torment',
        target: 'conditionBaseDuration',
        operation: 'multiply',
        factor: (context) => context.event?.metadata?.thiefMaliciousSneakDurationFactor ?? 1,
        when: (context) =>
          isGw2PlayerModifierOwnedEvent(context.event) &&
          context.condition === CONDITION.TORMENT &&
          context.event?.metadata?.thiefMaliciousSneakDurationFactor != null
      }
    ],
    effects: [
      {
        type: 'strike' as const,
        ticks: sneakAttackReleases.map((atMs) => ({ atMs, coefficient: 1.8 / 5 })),
        reactions: [
          {
            on: 'damage.resolved',
            actor: ACTOR.PLAYER,
            packets: 'first',
            do: [
              {
                type: 'thief.sneak-torment',
                id: 'malice',
                effects: [
                  {
                    type: 'condition',
                    name: CONDITION.TORMENT,
                    condition: CONDITION.TORMENT,
                    stacks: 1,
                    duration: 1
                  }
                ]
              }
            ]
          }
        ],
        name: 'Malicious Sneak Attack',
        actorType: ACTOR.PLAYER,
        comboFinishers: [{ ownerId: 'thief', finisherType: COMBO_FINISHER.PROJECTILE }],
        timingAnchor: 'castStart' as const,
        timingScale: 'cast' as const
      },
      ...impactEffects({ timingAnchor: 'castStart' as const, timingScale: 'cast' as const }, [
        {
          type: 'condition' as const,
          ticks: sneakAttackReleases.map((atMs) => ({
            atMs,
            condition: CONDITION.BLEEDING,
            stacks: 1,
            duration: 5
          })),
          actorType: ACTOR.PLAYER
        }
      ])
    ]
  },
  [ID.MALICIOUS_BACKSTAB]: {
    name: 'Malicious Backstab',
    icon: 'https://render.guildwars2.com/file/FF0A2DF63F383E7C9B3D090FFDF070BC472520F9/2010288.png',
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: 'Dagger',

    cooldown: 1,
    requiredMainHand: WEAPON.DAGGER,
    stealthAttack: true,
    malicious: true,
    castTimeMs: 440,
    // Preserve the committed strike; late aftercast cuts release the next action before the full animation ends.
    interruptCommitMs: 320,
    retainsCastLockoutAfterInterrupt: true,
    interruptLockoutReleaseMs: 400,
    // Backstab scales with the malice available on impact, before the hit spends it.
    modifiers: [
      {
        order: 202,
        id: 'thief.malicious-backstab-malice',
        target: MODIFIER_TARGET.STRIKE_DAMAGE,
        operation: 'multiply',
        // Malice scales the attack itself; additive equipment bonuses must not dilute its ten percent per stack.
        parameters: { damagePerMalice: 0.1 },
        factor: (context, _target, parameters) =>
          1 +
          Math.max(0, (context.event as ThiefSimulationEvent | undefined)?.deadeyeMaliceSnapshot || 0) *
            parameters.damagePerMalice,
        when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && markedTarget(context)
      },
      {
        order: 201,
        id: 'thief.malicious-backstab-position',
        target: MODIFIER_TARGET.STRIKE_DAMAGE,
        operation: 'multiply',
        factor: 2,
        // Malicious Backstab belongs to Deadeye; its rear-position rule stays out of the base Thief modifier set.
        when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && Boolean(context.config?.target?.defiant)
      }
    ],
    effects: [
      {
        type: 'strike' as const,
        ticks: [{ atMs: 200, coefficient: 1.5 }],
        name: 'Front damage',
        actorType: ACTOR.PLAYER,
        persistsAfterInterrupt: true,
        timingAnchor: 'castStart' as const,
        timingScale: 'fixed' as const
      }
    ]
  },
  [ID.MALICIOUS_TACTICAL_STRIKE]: {
    name: 'Malicious Tactical Strike',
    icon: 'https://render.guildwars2.com/file/DF27A8C60E93120707FC0FE871540AFEEC01DCF7/2010293.png',
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: 'Sword',

    cooldown: 1,
    requiredMainHand: WEAPON.SWORD,
    stealthAttack: true,
    malicious: true,
    castTimeMs: 440,
    interruptCommitMs: 200,
    effects: impactEffects(
      { atMs: 200, timingAnchor: 'castStart' as const, timingScale: 'fixed' as const, persistsAfterInterrupt: true },
      [
        {
          type: 'strike' as const,
          coefficient: 2,
          hits: 1,
          name: 'Malicious Tactical Strike',
          actorType: ACTOR.PLAYER
        },
        { type: 'control' as const, actorType: ACTOR.PLAYER, controlKind: CONTROL.DAZE },
        { type: 'control' as const, actorType: ACTOR.PLAYER, controlKind: CONTROL.DAZE },
        {
          type: 'condition' as const,
          condition: CONDITION.VULNERABILITY,
          stacks: 10,
          duration: 5,
          actorType: ACTOR.PLAYER
        }
      ]
    )
  },
  [ID.MALICIOUS_SHADOWSQUALL]: {
    name: 'Malicious Shadowsquall',
    icon: 'https://render.guildwars2.com/file/F94EC6D9CF082D32D0D7B80EB0DAD90642565090/3098877.png',
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: 'Scepter',

    cooldown: 0,
    requiredMainHand: WEAPON.SCEPTER,
    stealthAttack: true,
    malicious: true,
    castTimeMs: 2320,
    interruptMode: 'per-packet',
    // Each application keeps the duration it earned, even if Mercy clears malice during the channel.
    modifiers: [
      {
        id: 'thief.malicious-shadowsquall-poison',
        target: 'conditionBaseDuration',
        operation: 'multiply',
        parameters: { durationPerMalice: 0.2 },
        factor: (context, _target, parameters) =>
          1 +
          (thiefRuntimeSpecializationState(context.runtime?.profession, 'Deadeye').malice?.value ?? 0) *
            parameters.durationPerMalice,
        when: (context) =>
          isGw2PlayerModifierOwnedEvent(context.event) &&
          context.condition === CONDITION.POISONED &&
          !context.event?.procType &&
          markedTarget(context)
      }
    ],
    effects: [
      {
        type: 'strike' as const,
        ticks: shadowsquallImpacts.map((atMs) => ({ atMs, coefficient: 1.6 / 8 })),
        name: 'Malicious Shadowsquall',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castStart' as const,
        timingScale: 'cast' as const
      },
      {
        type: 'condition' as const,
        ticks: shadowsquallImpacts.map((atMs) => ({
          atMs,
          condition: CONDITION.POISONED,
          stacks: 1,
          duration: 6
        })),
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castStart' as const,
        timingScale: 'cast' as const
      }
    ]
  },
  [ID.MALICIOUS_HOOK_STRIKE]: {
    name: 'Malicious Hook Strike',
    icon: 'https://render.guildwars2.com/file/C1C5B9CDD6A6AB04056780B259050FC93A342770/3098878.png',
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: 'Staff',

    cooldown: 1,
    requiredMainHand: WEAPON.STAFF,
    stealthAttack: true,
    malicious: true,
    castTimeMs: 640,
    interruptCommitMs: 520,
    // The marked staff hit spends malice and grants Quickness before the aftercast ends.
    effects: impactEffects(
      { atMs: 520, timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true },
      [
        {
          type: 'strike',
          coefficient: 0.65,
          hits: 1,
          actorType: ACTOR.PLAYER,
          name: 'Malicious Hook Strike',
          reactions: [
            {
              on: 'damage.resolved',
              actor: ACTOR.PLAYER,
              packets: 'first',
              do: [
                {
                  type: 'thief.hook-quickness',
                  id: 'malice',
                  effects: [
                    {
                      type: 'boon',
                      name: BOON.QUICKNESS,
                      boon: BOON.QUICKNESS,
                      duration: 0.75,
                      stacks: 1
                    }
                  ]
                }
              ]
            }
          ]
        },
        { type: 'control', actorType: ACTOR.PLAYER, controlKind: CONTROL.KNOCKDOWN }
      ]
    )
  },
  [ID.MALICIOUS_CUNNING_SALVO]: {
    name: 'Malicious Cunning Salvo',
    icon: 'https://render.guildwars2.com/file/C811399D9A589160C42B720830BE0D05326A0352/3256392.png',
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: 'Axe',

    // The stealth attack's one-second reuse lockout is independent of Alacrity.
    rechargeIgnoresAlacrity: true,
    cooldown: 1,
    requiredMainHand: WEAPON.AXE,
    stealthAttack: true,
    malicious: true,
    castTimeMs: 440,
    // A committed axe preserves its impact and the remaining cast lockout after interruption.
    interruptCommitMs: 400,
    retainsCastLockoutAfterInterrupt: true,
    // Only the outgoing axe poisons, once per marked hit and in proportion to the malice it spends.
    modifiers: [
      {
        id: 'thief.malicious-cunning-salvo-poison',
        target: 'conditionBaseDuration',
        operation: 'multiply',
        factor: (context) =>
          context.event?.metadata?.recallSkillId == null
            ? outgoingSalvoMalice(
                thiefRuntimeSpecializationState(context.runtime?.profession, 'Deadeye'),
                context.event?.activationId
              )
            : 0,
        when: (context) =>
          isGw2PlayerModifierOwnedEvent(context.event) &&
          context.condition === CONDITION.POISONED &&
          !context.event?.procType
      }
    ],
    // The outgoing axe lands before the aftercast ends, so its hit owns the earlier Revealed and refund.
    effects: impactEffects(
      { atMs: 360, timingAnchor: 'castStart' as const, timingScale: 'fixed' as const, persistsAfterInterrupt: true },
      [
        {
          type: 'strike' as const,
          reactions: [
            // Refund on impact so misses and cancelled casts grant nothing.
            {
              on: 'damage.resolved',
              actor: ACTOR.PLAYER,
              packets: 'first',
              // Keep the impact refund independently editable without changing its hit requirement.
              do: [
                {
                  type: 'resourceGrant' as const,
                  id: 'initiative-refunded',
                  label: 'Initiative refunded',
                  resource: 'initiative',
                  amount: 2
                }
              ]
            }
          ],
          coefficient: 1.5,
          hits: 1,
          name: 'Malicious Cunning Salvo',
          actorType: ACTOR.PLAYER,
          comboFinishers: [{ ownerId: 'thief', finisherType: COMBO_FINISHER.BLAST }]
        },
        {
          type: 'condition' as const,
          condition: CONDITION.BLEEDING,
          stacks: 1,
          duration: 8,
          actorType: ACTOR.PLAYER
        },
        {
          type: 'condition' as const,
          condition: CONDITION.POISONED,
          stacks: 1,
          duration: 1,
          actorType: ACTOR.PLAYER
        },
        {
          type: 'condition' as const,
          condition: CONDITION.CRIPPLED,
          stacks: 1,
          duration: 4,
          actorType: ACTOR.PLAYER
        }
      ]
    ),
    // The axe exists after a committed throw even when its outgoing strike misses.
    sideEffects: [{ on: 'castCommit', do: { type: 'thief.ground-axe' as const } }]
  },
  [ID.MALICIOUS_ASHEN_ASSAULT]: {
    name: 'Malicious Ashen Assault',
    icon: 'https://render.guildwars2.com/file/D3EB04ABC0B56CEF0F29F10A61B4B64F073E213C/3379198.png',
    type: 'Weapon',
    weapon: 'Spear',
    slot: 'Weapon_1',
    // Intrinsic tuning follows this selected skill at its existing lifecycle boundary.
    initiativeRefund: 4,
    coefficientPerMalice: 0.02,
    spearStealthAttack: true,
    cooldown: 0,
    requiredMainHand: WEAPON.SPEAR,
    stealthAttack: true,
    malicious: true,
    // Malicious Ashen Assault shares the measured spear channel and finishes its damage before aftercast.
    castTimeMs: 1200,
    interruptMode: 'per-packet',
    modifiers: [
      {
        id: 'thief.malicious-ashen-assault-malice',
        label: 'Malicious Ashen Assault',
        target: MODIFIER_TARGET.STRIKE_DAMAGE,
        operation: 'multiply',
        factor: (context) =>
          1 +
          ashenFinisherMalice(context) *
            skillNumber(requireSkill(context.catalog, ID.MALICIOUS_ASHEN_ASSAULT), 'coefficientPerMalice'),
        when: (context) =>
          isGw2PlayerModifierOwnedEvent(context.event) &&
          context.event?.name === 'Malicious Ashen Assault - Final Strike'
      }
    ],
    effects: [
      ...ashenAssaultEffects('Malicious Ashen Assault'),
      {
        type: 'condition',
        name: 'Malicious Ashen Assault - Torment',
        packetLabel: 'malice',
        atMs: 1080,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: ACTOR.PLAYER,
        source: 'Trait',
        condition: CONDITION.TORMENT,
        stacks: 1,
        duration: 0.5,
        modifiers: [
          {
            id: 'thief.malicious-ashen-assault-torment',
            target: 'conditionBaseDuration',
            operation: 'multiply',
            factor: ashenFinisherMalice
          }
        ]
      }
    ],
    sideEffects: [{ on: 'castCommit', do: { type: 'thief.spear-chain' as const } }]
  }
};

/** Called after Core observers and the shared first-landed latch, before malice consumption. */
export function refundMaliciousTacticalStrike(runtime: ThiefRuntime, event: Gw2ResolverEvent): void {
  if (event.skillId === ID.MALICIOUS_TACTICAL_STRIKE) {
    const enduranceGain = Number(event.deadeyeMaliceSnapshot || 0) * 10;

    if (enduranceGain > 0) runtime.endurance.grant(enduranceGain);
  }
}

/** Marked hits use the balance recorded before spending or Malicious Intent. */
const maliciousAttackActions: NonNullable<RuntimeHooks<ThiefRuntimeState, ThiefSkill>['sideEffectHandlers']> = {
  'thief.sneak-torment'(runtime, context, action) {
    if (context.kind !== 'effect' || !deadeyeMarked(runtime)) return;

    const { event } = context.trigger;
    const malice = Number(event.deadeyeMaliceSnapshot ?? 0);

    if (event.offTarget || !malice) return;

    const skill = context.skill;
    const torment = requireEffect(skill, 'condition', CONDITION.TORMENT, action);

    if (!torment) return;

    runtime.effects.emit({
      kind: 'packet',
      event: buildThiefCondition(skill, {
        at: event.at,
        activationId: event.activationId,
        condition: String(torment.condition),
        duration: effectNumber(skill, torment, 'duration'),
        stacks: effectNumber(skill, torment, 'stacks'),
        metadata: {
          ...torment.metadata,
          thiefMaliciousSneakDurationFactor: malice * skillNumber(skill, 'durationPerMalice')
        }
      })
    });
  },
  'thief.hook-quickness'(runtime, context, action) {
    if (context.kind !== 'effect' || !deadeyeMarked(runtime)) return;

    const { event } = context.trigger;
    const malice = Number(event.deadeyeMaliceSnapshot ?? 0);

    if (event.offTarget || !malice) return;

    const skill = context.skill;
    const boon = requireEffect(skill, 'boon', BOON.QUICKNESS, action);

    if (!boon) return;

    runtime.effects.emit({
      kind: 'profile',
      profile: skill,
      at: event.at,
      durationContext: event,
      effects: [{ ...boon, duration: effectNumber(skill, boon, 'duration') * malice }],
      attribution: {
        actorType: ACTOR.PLAYER,
        source: 'thief',
        sourceId: skill.id,
        skillId: skill.id,
        skillName: skill.name,
        activationId: event.activationId
      }
    });
  }
};

/** Registers malicious attack actions with the Deadeye hook assembly. */
export const maliciousAttackLifecycle = {
  sideEffectHandlers: maliciousAttackActions
} satisfies RuntimeHooks<ThiefRuntimeState, ThiefSkill>;
