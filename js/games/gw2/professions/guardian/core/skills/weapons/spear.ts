import { requireSkillAction } from '#gw2/platform/effects/actions.js';
import { ACTOR, RECIPIENT, COMBO_FIELD, CONTROL, WEAPON, BOON } from '#gw2/platform/constants.js';
import { strikeEffectCoefficient, strikeEffectTicks } from '#gw2/platform/effects/authoring.js';
import { effectFirstAt } from '#gw2/platform/effects/materializer.js';
import { scaleCastBoundTiming } from '#gw2/platform/execution/cast-timing.js';
import {
  skillNumber,
  effectNumber,
  requireSkillFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { gw2EffectExpiresAt } from '#gw2/platform/combat/effect-timing.js';
import {
  activeChargeCount,
  consumeCharge,
  grantCharges,
  type ChargeGrant
} from '#gw2/platform/combat/resources/charges.js';
import type { GuardianRuntimeState, GuardianSkill, GuardianRuntime } from '#gw2/professions/guardian/types.js';

import type { RuntimeProfession } from '#gw2/platform/profession-definition/runtime-contract.js';
import { GUARDIAN_SPEAR_EXPIRY } from '#gw2/professions/guardian/core/mechanics/spear.js';
/** Canonical Core guardian skill fragments grouped by their GW2 owner. */
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';

const consumedCharges = new WeakMap<RuntimeCast<GuardianSkill>, ChargeGrant>();

/** Symbol of Luminance or a remaining single charge illuminates a spear skill accepted at this instant. */
function spearIlluminated(runtime: { readonly profession: GuardianRuntime['profession'] }, at: number): boolean {
  const state = runtime.profession.core;
  return state.spearLuminanceUntil > at || activeChargeCount(state.spearIlluminated, at) > 0;
}

/** Illuminated spear skills select their patchable skill components once, at acceptance. */
function illuminatedSpearVariant(): NonNullable<Skill['effectVariants']>[number] {
  return {
    when: (runtime, cast) => spearIlluminated(runtime, cast.start),
    transform: (runtime, cast, effects) => illuminatedSpearEffects(runtime, cast, effects)
  };
}

/** Select illumination at acceptance so delayed packets cannot borrow a later charge or edit executed history. */
function illuminatedSpearEffects(
  runtime: GuardianRuntime,
  cast: RuntimeCast<GuardianSkill>,
  effects: readonly SkillEffect[]
): readonly SkillEffect[] {
  const state = runtime.profession.core;
  const luminance = state.spearLuminanceUntil > cast.start;
  const skill = requireSkillFromContext(runtime, cast.skill.id);
  const multiplier = skillNumber(skill, 'illuminatedDamageMultiplier');

  if (!(multiplier > 1)) return effects;

  if (!luminance) consumedCharges.set(cast, state.spearIlluminated);

  let firstBonus: SkillEffect | undefined;
  let selected: readonly SkillEffect[];

  if (cast.skill.id === ID.SOLAR_STORM) {
    const projectiles: SkillEffect[] = [];
    for (const [name, index] of [
      ['Fourth projectile', 4],
      ['Fifth projectile', 5]
    ] as const) {
      const effect = requireEffect(skill, 'strike', name, requireSkillAction(skill, 'illumination'));

      if (!effect) continue;

      projectiles.push({
        ...effect,
        name: `Solar Storm — ${index}th Strike`,
        persistsAfterInterrupt: true
      });
    }

    firstBonus = projectiles.length
      ? (effects.find((effect) => effect.type === 'strike') ?? projectiles[0])
      : undefined;
    selected = [...effects, ...projectiles];
  } else {
    selected = effects.map((effect) => {
      if (effect.type !== 'strike' || !(strikeEffectCoefficient(effect) > 0)) return effect;

      firstBonus ??= effect;
      const ticks = strikeEffectTicks(effect);
      const bonus = strikeEffectCoefficient(effect) * (multiplier - 1);
      // Gleaming Disc puts its entire bonus on the existing shock wave, preserving one hit opportunity.
      return {
        ...effect,
        coefficient: undefined,
        hits: undefined,
        atMs: undefined,
        applications: undefined,
        intervalMs: undefined,
        ticks: ticks.map((tick, index) => ({
          ...tick,
          coefficient:
            cast.skill.id === ID.GLEAMING_DISC && ticks.length === 2
              ? tick.coefficient + (index === 1 ? bonus : 0)
              : tick.coefficient * multiplier
        }))
      };
    });
  }

  if (!firstBonus) return selected;

  const at = effectFirstAt(cast.start, cast.fullEnd, scaleCastBoundTiming(cast, cast.skill, firstBonus));
  return [
    ...selected,
    {
      type: 'custom',
      eventType: 'proc',
      atMs: (at - cast.start) * 1000,
      timingAnchor: 'castStart',
      timingScale: 'fixed',
      persistsAfterInterrupt: firstBonus.persistsAfterInterrupt,
      actorType: ACTOR.EFFECT,
      source: 'Skill',
      sourceId: 'guardian.illuminated',
      event: {
        procType: 'skill',
        name: 'Illuminated',
        sourceSkill: cast.skill.name,
        icon: new URL('@images/wiki/illuminated.png', import.meta.url).href,
        detail: `${cast.skill.name} illuminated (x${multiplier})`
      }
    }
  ];
}

/** Committed casts grant or consume the current window; an expiry wake can clear only its own deadline. */
function completeSpearIllumination(runtime: GuardianRuntime, cast: RuntimeCast<GuardianSkill>, symbol: boolean): void {
  const state = runtime.profession.core;

  // Settle only the captured grant, leaving any replacement entitled even when its deadline matches.
  if (consumedCharges.get(cast) === state.spearIlluminated) consumeCharge(state.spearIlluminated, cast.start);

  const skill = requireSkillFromContext(runtime, ID.SYMBOL_OF_LUMINANCE);
  const effect = requireEffect(
    skill,
    'buff',
    symbol ? 'guardian-spear-luminance' : 'illuminated',
    requireSkillAction(skill, 'illumination')
  );

  if (!effect) return;

  const duration = effectNumber(skill, effect, 'duration');

  if (!(duration > 0)) return;

  const firstStrike = Math.min(
    ...(cast.skill.effects ?? [])
      .filter((packet) => packet.type === 'strike' && strikeEffectCoefficient(packet) > 0)
      .map((packet) => effectFirstAt(cast.start, cast.fullEnd, scaleCastBoundTiming(cast, cast.skill, packet)))
  );
  const origin = symbol || !Number.isFinite(firstStrike) ? runtime.time : firstStrike;
  const expiresAt = gw2EffectExpiresAt(origin, duration);

  if (symbol) {
    state.spearLuminanceUntil = expiresAt > runtime.time ? expiresAt : 0;
    runtime.effects.emit({
      kind: 'announcement',
      log: true,
      attribution: {
        source: 'Skill',
        sourceId: 'guardian.symbol-of-luminance',
        actorType: ACTOR.EFFECT,
        activationId: cast.id,
        skillId: cast.skill.id,
        skillName: cast.skill.name
      },
      announcement: {
        at: runtime.time,
        name: 'Symbol of Luminance',
        sourceSkill: cast.skill.name,
        icon: 'https://render.guildwars2.com/file/0E1E2D69CBC3C0E36217506C6CCB710138035373/3379129.png',
        detail: 'All spear skills illuminated while active',
        type: 'skill'
      }
    });
  } else {
    // Each committed skill replaces the single charge instead of accumulating charges on refresh.
    state.spearIlluminated = grantCharges(expiresAt > runtime.time ? 1 : 0, expiresAt);
  }

  if (expiresAt > runtime.time)
    runtime.schedule(GUARDIAN_SPEAR_EXPIRY, expiresAt, { symbol, expiresAt }, undefined, -220);
}

export const GUARDIAN_WEAPONS_SPEAR_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.HELIO_RUSH]: {
    illuminatedDamageMultiplier: 1.5,
    // Capture illumination at acceptance and settle only that captured charge on commitment.
    effectVariants: [
      illuminatedSpearVariant(),
      // Only an illuminated charge grants Resolution.
      { when: () => true, transform: (_runtime, _cast, effects) => effects.filter((effect) => effect.type !== 'boon') }
    ],
    sideEffects: [{ on: 'castCommit', do: { type: 'guardian.spear-illumination' } }],
    castTimeMs: 440,
    // Consecutive charges lock for two seconds while each spent count recharges over eight seconds.
    cooldown: 2,
    ammo: 2,
    ammoRecharge: 8,
    ammoCastLockout: 2,
    // Helio occupies the action lane for at most 440 ms, but collision or a
    // queued cancel can release it on any action tick from 240 ms onward.
    interruptCommitMs: 240,
    // Grant Resolution with the charge's collision strike.
    effects: impactEffects({ atMs: 240, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        coefficient: 1.5
      },
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, affectsSelf: false, maximumRecipients: 5 },
        boon: BOON.RESOLUTION,
        duration: 4
      }
    ])
  },
  [ID.GLEAMING_DISC]: {
    illuminatedDamageMultiplier: 1.25,
    // Capture illumination at acceptance and settle only that captured charge on commitment.
    effectVariants: [illuminatedSpearVariant()],
    sideEffects: [{ on: 'castCommit', do: { type: 'guardian.spear-illumination' } }],
    castTimeMs: 560,
    // The disc commits at 520 ms, allowing a queued cancel to release the remaining animation.
    interruptCommitMs: 520,
    cooldown: 12,
    effects: [
      {
        type: 'strike',
        // The first impact follows the windup; the shock wave lands 680 ms later.
        ticks: [480, 1160].map((atMs) => ({ atMs, coefficient: 3 / 2 })),
        name: 'Gleaming Disc',
        // The launched disc and delayed shock wave survive cancellation of the remaining animation.
        persistsAfterInterrupt: true,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.DAYBREAKING_SLASH]: {
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 560,
    // Damage commits at 400 ms, allowing a queued cancel to release the action lane early.
    interruptCommitMs: 400,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 400, coefficient: 0.7 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.SOLAR_STORM]: {
    illuminatedDamageMultiplier: 1.25,
    // Capture illumination at acceptance and settle only that captured charge on commitment.
    effectVariants: [illuminatedSpearVariant()],
    sideEffects: [
      {
        on: 'castCommit',
        do: {
          type: 'guardian.spear-illumination',
          id: 'illumination',
          effects: [
            {
              type: 'strike',
              name: 'Fourth projectile',
              coefficient: 0.6,
              hits: 1,
              atMs: 1720,
              timingAnchor: 'castStart',
              timingScale: 'fixed',
              actorType: ACTOR.PLAYER
            },
            {
              type: 'strike',
              name: 'Fifth projectile',
              coefficient: 0.3,
              hits: 1,
              atMs: 1920,
              timingAnchor: 'castStart',
              timingScale: 'fixed',
              actorType: ACTOR.PLAYER
            }
          ]
        }
      }
    ],
    castTimeMs: 560,

    // The volley commits before impact; cancelling the remaining animation preserves its delayed strikes.
    interruptCommitMs: 480,
    cooldown: 15,
    effects: [
      {
        type: 'strike',
        // Shards begin 1120 ms after activation, after the cast and projectile delay.
        ticks: [{ atMs: 1120, coefficient: 1.5 }],
        name: 'Solar Storm — 1st Strike',
        persistsAfterInterrupt: true,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        ticks: [{ atMs: 1320, coefficient: 1.2 }],
        name: 'Solar Storm — 2nd Strike',
        persistsAfterInterrupt: true,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        ticks: [{ atMs: 1520, coefficient: 0.9 }],
        name: 'Solar Storm — 3rd Strike',
        persistsAfterInterrupt: true,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.SYMBOL_OF_LUMINANCE]: {
    // Author symbol identity independently of the skill's display text.
    tags: ['symbol'],
    // The symbol grants an independent window from semantic completion.
    sideEffects: [
      {
        on: 'castCommit',
        do: {
          type: 'guardian.spear-luminance',
          id: 'illumination',
          effects: [
            {
              type: 'buff',
              name: 'illuminated',
              kind: 'illuminated',
              stacks: 1,
              duration: 5
            },
            {
              type: 'buff',
              name: 'guardian-spear-luminance',
              kind: 'guardian-spear-luminance',
              stacks: 1,
              duration: 5,
              actorType: ACTOR.PLAYER
            }
          ]
        }
      }
    ],
    castTimeMs: 440,

    cooldown: 20,
    // The Light field begins on the initial impact and lasts four seconds.
    comboFields: [
      { ownerId: 'guardian', fieldType: COMBO_FIELD.LIGHT, duration: 4, startMs: 360, startAnchor: 'castStart' }
    ],
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        metadata: { guardianSymbol: true },
        ticks: [{ atMs: 360, coefficient: 1.5 }],
        name: 'Symbol of Luminance — Initial'
      },
      {
        type: 'strike',
        metadata: { guardianSymbol: true },
        coefficient: 2.5 / 5,
        atMs: 360,
        applications: 5,
        intervalMs: 1000,
        name: 'Symbol of Luminance'
      },
      {
        // The knockback belongs to the initial impact, not the recurring symbol pulses.
        type: 'control',
        controlKind: CONTROL.KNOCKBACK,
        atMs: 360
      }
    ])
  }
});

const guardianSpearActions: RuntimeProfession<GuardianRuntimeState, GuardianSkill>['sideEffectHandlers'] = {
  'guardian.spear-illumination'(runtime, context) {
    if (context.kind === 'cast') completeSpearIllumination(runtime, context.cast, false);
  },
  'guardian.spear-luminance'(runtime, context) {
    if (context.kind === 'cast') completeSpearIllumination(runtime, context.cast, true);
  }
};

/** Registers spear actions with the Core hook assembly. */
export const guardianSpearLifecycle = {
  // Seed the native charge before an isolated spear activation so its normal effect selection owns the bonus.
  prepareDamageState(runtime, selectedSkill, inputs) {
    if (selectedSkill?.weapon !== WEAPON.SPEAR || !inputs.illuminated) return;

    const skill = requireSkillFromContext(runtime, ID.SYMBOL_OF_LUMINANCE);
    const effect = requireEffect(skill, 'buff', 'illuminated', requireSkillAction(skill, 'illumination'));

    if (!effect) return;

    // The isolated cast starts now, so the authored finite lifetime is sufficient to select its bonus.
    const duration = effectNumber(skill, effect, 'duration');
    runtime.profession.core.spearIlluminated = grantCharges(
      duration > 0 ? 1 : 0,
      gw2EffectExpiresAt(runtime.time, duration)
    );
  },
  sideEffectHandlers: guardianSpearActions
} satisfies RuntimeHooks<GuardianRuntimeState, GuardianSkill>;
