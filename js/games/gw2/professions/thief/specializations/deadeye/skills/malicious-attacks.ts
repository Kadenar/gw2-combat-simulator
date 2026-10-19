import { ACTOR, COMBO_FINISHER, WEAPON, CONTROL, BOON, CONDITION } from '#gw2/platform/constants.js';
import { boonKey } from '#gw2/platform/combat/boons.js';
import { MODIFIER_TARGET, type Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import { skillForEvent } from '#gw2/platform/combat/query/runtime-query.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { castWasInterrupted } from '#gw2/platform/execution/cast-timing.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import { buildThiefCondition } from '#gw2/professions/thief/core/events.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import { DEADEYE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/thief/specializations/deadeye/profiles.js';
import { markedTarget } from '#gw2/professions/thief/specializations/deadeye/skills/deadeyes-mark.js';
import { deadeyeCastFacts } from '#gw2/professions/thief/specializations/deadeye/state.js';
import type { ThiefRuntimeState, ThiefSimulationEvent, ThiefSkill } from '#gw2/professions/thief/types.js';

/** Rewrites only poison durations, keeping each malicious attack's formula and other effects intact. */
function mapPoisonDurations(effects: readonly SkillEffect[], scaled: (duration: unknown) => number): SkillEffect[] {
  return effects.map((effect) =>
    effect.type !== 'condition'
      ? effect
      : effect.ticks?.length
        ? {
            ...effect,
            ticks: effect.ticks.map((tick) =>
              tick.condition === CONDITION.POISONED ? { ...tick, duration: scaled(tick.duration) } : tick
            )
          }
        : effect.condition === CONDITION.POISONED
          ? { ...effect, duration: scaled(effect.duration) }
          : effect
  );
}

/** Malicious stealth attacks keep their accepted-malice transforms beside their weapon effects. */
export const DEADEYE_MALICIOUS_ATTACKS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.MALICIOUS_DEATHS_JUDGMENT]: {
    castTimeMs: 680,
    interruptCommitMs: 560,
    cooldown: 1,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 560, coefficient: 2.67 }],
        name: "Malicious Death's Judgment — Packet 1",
        actorType: ACTOR.PLAYER,
        persistsAfterInterrupt: true,
        comboFinishers: [
          { ownerId: 'thief', finisherType: COMBO_FINISHER.PROJECTILE, ambiguousFieldSelection: 'oldest' }
        ],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ],
    requiredMainHand: WEAPON.RIFLE,
    stealthAttack: true,
    malicious: true
  },
  [ID.MALICIOUS_SURPRISE_SHOT]: {
    castTimeMs: 200,
    cooldown: 1,
    initiativeCost: 0,
    effects: impactEffects({ atMs: 0, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 0.6,
        hits: 1,
        name: 'Malicious Surprise Shot',
        actorType: ACTOR.PLAYER,
        comboFinishers: [
          { ownerId: 'thief', finisherType: COMBO_FINISHER.PROJECTILE, ambiguousFieldSelection: 'oldest' }
        ]
      },
      {
        type: 'condition',
        condition: CONDITION.BLEEDING,
        stacks: 3,
        duration: 5,
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.IMMOBILIZED,
        stacks: 1,
        duration: 2,
        actorType: ACTOR.PLAYER
      }
    ]),
    requiredMainHand: WEAPON.SHORTBOW,
    stealthAttack: true,
    malicious: true
  },
  [ID.MALICIOUS_SNEAK_ATTACK]: {
    // Only a completed channel emits the Torment using its accepted malice.
    sideEffects: [
      {
        on: 'castCommit',
        when: (_runtime, cast) => !castWasInterrupted(cast) && (deadeyeCastFacts.get(cast)?.markedMalice ?? 0) > 0,
        do: { type: 'thief.sneak-torment' }
      }
    ],

    castTimeMs: 680,
    cooldown: 1,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: [120, 280, 400, 560, 680].map((atMs) => ({ atMs, coefficient: 1.8 / 5 })),
        name: 'Malicious Sneak Attack',
        actorType: ACTOR.PLAYER,
        comboFinishers: [
          { ownerId: 'thief', finisherType: COMBO_FINISHER.PROJECTILE, ambiguousFieldSelection: 'oldest' }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      ...impactEffects({ timingAnchor: 'castStart', timingScale: 'cast' }, [
        {
          type: 'condition',
          ticks: [120, 280, 400, 560, 680].map((atMs) => ({
            atMs,
            condition: CONDITION.BLEEDING,
            stacks: 1,
            duration: 5
          })),
          actorType: ACTOR.PLAYER
        }
        // Malice-scaled Torment is emitted from its removable balance profile at completion.
      ])
    ],
    requiredMainHand: WEAPON.PISTOL,
    stealthAttack: true,
    malicious: true
  },
  [ID.MALICIOUS_BACKSTAB]: {
    castTimeMs: 440,
    // Once the stab commits, preserve its strike and the remaining cast lockout after interruption.
    interruptCommitMs: 320,
    retainsCastLockoutAfterInterrupt: true,
    cooldown: 1,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 1.5 }],
        name: 'Front damage',
        actorType: ACTOR.PLAYER,
        persistsAfterInterrupt: true,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ],
    requiredMainHand: WEAPON.DAGGER,
    stealthAttack: true,
    malicious: true
  },
  [ID.MALICIOUS_TACTICAL_STRIKE]: {
    castTimeMs: 440,
    cooldown: 1,
    initiativeCost: 0,
    // All companions resolve at cast completion; handlers retain stealth, control, and recipient rules.
    effects: impactEffects({ atMs: 0, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      { type: 'strike', coefficient: 2, hits: 1, name: 'Malicious Tactical Strike', actorType: ACTOR.PLAYER },
      { type: 'control', actorType: ACTOR.PLAYER, controlKind: CONTROL.DAZE },
      { type: 'control', actorType: ACTOR.PLAYER, controlKind: CONTROL.DAZE },
      { type: 'condition', condition: CONDITION.VULNERABILITY, stacks: 10, duration: 5, actorType: ACTOR.PLAYER }
    ]),
    requiredMainHand: WEAPON.SWORD,
    stealthAttack: true,
    malicious: true
  },
  [ID.MALICIOUS_SHADOWSQUALL]: {
    // This combat variant targets enemies; regeneration belongs only to the unsupported ally-target variant.
    // Transform the selected base packet so coefficient and duration patches remain authoritative.
    effectVariants: [
      {
        when: () => true,
        transform: (_runtime, cast, effects) => {
          const malice = deadeyeCastFacts.get(cast)?.markedMalice ?? 0;
          const scaled = (duration: unknown) => Number(duration || 0) * (1 + 0.2 * malice);
          return mapPoisonDurations(effects, scaled);
        }
      }
    ],

    castTimeMs: 1680,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: [200, 440, 640, 840, 1040, 1280, 1480, 1680].map((atMs) => ({ atMs, coefficient: 1.6 / 8 })),
        name: 'Malicious Shadowsquall',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [200, 440, 640, 840, 1040, 1280, 1480, 1680].map((atMs) => ({
          atMs,
          condition: CONDITION.POISONED,
          stacks: 1,
          duration: 3
        })),
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ],
    requiredMainHand: WEAPON.SCEPTER,
    stealthAttack: true,
    malicious: true
  },
  [ID.MALICIOUS_HOOK_STRIKE]: {
    // Zero accepted marked malice suppresses Quickness; later malice changes cannot change this payload.
    effectVariants: [
      {
        when: () => true,
        transform: (_runtime, cast, effects) => {
          const malice = deadeyeCastFacts.get(cast)?.markedMalice ?? 0;
          return effects.flatMap((effect): SkillEffect[] => {
            const quickness =
              (effect.type === 'boon' && String(effect.boon).toLowerCase() === boonKey(BOON.QUICKNESS)) ||
              (effect.type === 'buff' && effect.kind === boonKey(BOON.QUICKNESS));
            return !quickness ? [effect] : malice > 0 ? [{ ...effect, duration: (effect.duration || 0) * malice }] : [];
          });
        }
      }
    ],

    castTimeMs: 0,
    cooldown: 1,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 0.65 }],
        name: 'Malicious Hook Strike',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'boon',
        boon: BOON.QUICKNESS,
        duration: 0.75,
        stacks: 1
      },
      {
        type: 'control',
        actorType: ACTOR.PLAYER,
        controlKind: CONTROL.KNOCKDOWN
      }
    ],
    requiredMainHand: WEAPON.STAFF,
    stealthAttack: true,
    malicious: true
  },
  [ID.MALICIOUS_CUNNING_SALVO]: {
    // The axe exists after a committed throw even when its outgoing strike misses.
    sideEffects: [{ on: 'castCommit', do: { type: 'thief.ground-axe' } }],
    // A committed axe preserves its impact and the remaining cast lockout after interruption.
    interruptCommitMs: 400,
    retainsCastLockoutAfterInterrupt: true,
    // The stealth attack's one-second reuse lockout is independent of Alacrity.
    rechargeIgnoresAlacrity: true,
    // Transform the selected base packet so coefficient and duration patches remain authoritative.
    effectVariants: [
      {
        when: () => true,
        transform: (_runtime, cast, effects) => {
          const malice = deadeyeCastFacts.get(cast)?.markedMalice ?? 0;

          // Without consumed malice the outgoing axe has no poison application; recall uses the base packet.
          if (malice === 0)
            return effects.filter((effect) => effect.type !== 'condition' || effect.condition !== CONDITION.POISONED);

          const scaled = (duration: unknown) => Number(duration || 0) * malice;
          return mapPoisonDurations(effects, scaled);
        }
      }
    ],

    castTimeMs: 440,
    cooldown: 1,
    initiativeCost: 0,
    effects: impactEffects({ atMs: 0, timingAnchor: 'castEnd', timingScale: 'fixed', persistsAfterInterrupt: true }, [
      {
        type: 'strike',
        reactions: [
          // Refund on impact so misses and cancelled casts grant nothing.
          {
            on: 'damage.resolved',
            actor: ACTOR.PLAYER,
            packets: 'first',
            // Keep the impact refund independently editable without changing its hit requirement.
            do: {
              type: 'resourceGrant',
              id: 'initiative-refunded',
              label: 'Initiative refunded',
              resource: 'initiative',
              amount: 2
            }
          }
        ],
        coefficient: 1.5,
        hits: 1,
        name: 'Malicious Cunning Salvo',
        actorType: ACTOR.PLAYER,
        comboFinishers: [{ ownerId: 'thief', finisherType: COMBO_FINISHER.BLAST, ambiguousFieldSelection: 'oldest' }]
      },
      {
        type: 'condition',
        condition: CONDITION.BLEEDING,
        stacks: 1,
        duration: 8,
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.POISONED,
        stacks: 1,
        duration: 1,
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.CRIPPLED,
        stacks: 1,
        duration: 4,
        actorType: ACTOR.PLAYER
      }
    ]),
    requiredMainHand: WEAPON.AXE,
    stealthAttack: true,
    malicious: true
  },
  [ID.MALICIOUS_ASHEN_ASSAULT]: {
    // Landed strikes own the initiative refund; the final packet owns accepted-malice Torment.
    sideEffects: [{ on: 'castCommit', do: { type: 'thief.spear-chain' } }],
    effectVariants: [
      {
        when: () => true,
        transform: (runtime, cast, effects) => {
          const profile = requireBalanceProfileFromContext(runtime, PROFILE.maliciousAshenAssault);
          const malice = deadeyeCastFacts.get(cast)?.markedMalice ?? 0;
          const factor =
            1 +
            // An unmarked or missed attack cannot receive a bonus from malice it does not consume.
            malice * balanceProfileNumber(profile, 'coefficientMultiplier');
          const scaled = effects.map((effect) =>
            effect.type !== 'strike' || effect.name !== 'Malicious Ashen Assault — Final Strike'
              ? effect
              : effect.ticks?.length
                ? {
                    ...effect,
                    ticks: effect.ticks.map((tick) => ({ ...tick, coefficient: tick.coefficient * factor }))
                  }
                : { ...effect, coefficient: (effect.coefficient || 0) * factor }
          );
          // Author Torment beside the final strike so a partial channel cannot emit the finisher reward.
          const final = effects.find(
            (effect) => effect.type === 'strike' && effect.name === 'Malicious Ashen Assault — Final Strike'
          );

          if (malice <= 0 || final?.type !== 'strike') return scaled;

          const torment = requireEffect(profile, 'condition', CONDITION.TORMENT);

          if (!torment) return scaled;

          return [
            ...scaled,
            ...impactEffects(
              {
                atMs: final.ticks?.[0]?.atMs ?? final.atMs ?? 0,
                timingAnchor: final.timingAnchor,
                timingScale: final.timingScale
              },
              [
                {
                  type: 'condition',
                  condition: CONDITION.TORMENT,
                  name: 'Malicious Ashen Assault — Torment',
                  source: 'Trait',
                  actorType: ACTOR.PLAYER,
                  duration:
                    effectNumber(profile, torment, 'duration') +
                    malice * balanceProfileNumber(profile, 'durationPerTier'),
                  stacks: effectNumber(profile, torment, 'stacks')
                }
              ]
            )
          ];
        }
      }
    ],
    preservesStealth: true,
    spearStealthAttack: true,

    // Malicious Ashen Assault shares the measured spear channel and finishes its damage before aftercast.
    castTimeMs: 1200,
    interruptMode: 'per-packet',
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: [320, 480, 560, 640, 760].map((atMs) => ({
          atMs,
          coefficient: 1.5 / 5
        })),
        name: 'Malicious Ashen Assault',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      ...impactEffects({ atMs: 1080, timingAnchor: 'castStart', timingScale: 'fixed' }, [
        {
          type: 'strike',
          coefficient: 0.3,
          hits: 1,
          name: 'Malicious Ashen Assault — Final Strike',
          actorType: ACTOR.PLAYER
        },
        {
          type: 'condition',
          condition: CONDITION.VULNERABILITY,
          stacks: 5,
          duration: 8,
          actorType: ACTOR.PLAYER
        },
        {
          type: 'condition',
          condition: CONDITION.BLEEDING,
          stacks: 3,
          duration: 4,
          actorType: ACTOR.PLAYER
        },
        {
          type: 'condition',
          condition: CONDITION.POISONED,
          stacks: 3,
          duration: 4,
          actorType: ACTOR.PLAYER
        }
      ])
    ],
    requiredMainHand: WEAPON.SPEAR,
    stealthAttack: true,
    malicious: true
  }
});

const MALICIOUS_DAMAGE_SCALING_SKILL_IDS: ReadonlySet<number> = new Set([
  ID.MALICIOUS_BACKSTAB,
  ID.MALICIOUS_DEATHS_JUDGMENT
]);

/** Apply this skill family's intrinsic damage rules using live mark eligibility. */
export const maliciousAttackModifiers: readonly Gw2ModifierRule[] = [
  {
    order: 201,
    id: 'thief.malicious-backstab-position',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 2,
    // Malicious Backstab belongs to Deadeye; its rear-position rule stays out of the base Thief modifier set.
    when: (context) =>
      isGw2PlayerModifierOwnedEvent(context.event) &&
      skillForEvent(context.profession?.catalog, context.event, context.skillId)?.id === ID.MALICIOUS_BACKSTAB &&
      Boolean(context.config?.target?.defiant)
  },
  {
    order: 202,
    id: 'thief.malicious-stealth-attack',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    // Malice scales the attack itself; additive equipment bonuses must not dilute its ten percent per stack.
    // Snapshotting preserves the consumed value for the launched hit after the resource is spent.
    parameters: { damagePerMalice: 0.1 },
    factor: (context, _target, parameters) =>
      1 +
      Math.max(0, (context.event as ThiefSimulationEvent | undefined)?.deadeyeMaliceSnapshot || 0) *
        parameters.damagePerMalice,
    when: (context) =>
      isGw2PlayerModifierOwnedEvent(context.event) &&
      markedTarget(context) &&
      MALICIOUS_DAMAGE_SCALING_SKILL_IDS.has(
        Number(skillForEvent(context.profession?.catalog, context.event, context.skillId)?.id)
      )
  }
];

/** Called after Core observers and the shared first-landed latch, before malice consumption. */
export function refundMaliciousTacticalStrike(runtime: ThiefRuntime, event: Gw2ResolverEvent): void {
  if (event.skillId === ID.MALICIOUS_TACTICAL_STRIKE) {
    const enduranceGain = Number(event.deadeyeMaliceSnapshot || 0) * 10;

    if (enduranceGain > 0) runtime.endurance.grant(enduranceGain);
  }
}

/** Pistol Torment scales with the malice the channel was cast with. */
function maliceTorment(runtime: ThiefRuntime, cast: RuntimeCast<ThiefSkill>, malice: number) {
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.maliciousSneakAttack);
  const torment = requireEffect(profile, 'condition', CONDITION.TORMENT);

  if (!torment) return;

  const baseDuration = effectNumber(profile, torment, 'duration');
  const maliceDuration = malice * balanceProfileNumber(profile, 'durationPerTier');
  runtime.effects.emit({
    kind: 'packet',
    event: buildThiefCondition(cast.skill, {
      at: runtime.time,
      activationId: cast.id,
      condition: String(torment.condition),
      duration: baseDuration * maliceDuration,
      stacks: effectNumber(profile, torment, 'stacks')
    })
  });
}

/** Register actions beside the skills whose accepted casts select them. */
const maliciousAttackActions: NonNullable<RuntimeHooks<ThiefRuntimeState, ThiefSkill>['sideEffectHandlers']> = {
  'thief.sneak-torment'(runtime, context) {
    if (context.kind === 'cast')
      maliceTorment(runtime, context.cast, deadeyeCastFacts.get(context.cast)?.markedMalice ?? 0);
  }
};

/** Registers malicious attack actions with the Deadeye hook assembly. */
export const maliciousAttackLifecycle = {
  sideEffectHandlers: maliciousAttackActions
} satisfies RuntimeHooks<ThiefRuntimeState, ThiefSkill>;
