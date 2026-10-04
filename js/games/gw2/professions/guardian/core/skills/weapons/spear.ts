import type { MechanicContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import { strikeEffectCoefficient, strikeEffectTicks } from '#gw2/platform/effects/authoring.js';
import { effectFirstAt, scaleCastBoundTiming } from '#gw2/platform/effects/materializer.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { gw2EffectExpiresAt } from '#gw2/platform/effects/timing.js';
import { GUARDIAN_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/guardian/core/profiles.js';
import type { GuardianRuntimeState, GuardianSkill } from '#gw2/professions/guardian/types.js';

import type { RuntimeProfession } from '#gw2/platform/profession-definition/runtime-contract.js';
import { GUARDIAN_SPEAR_EXPIRY } from '#gw2/professions/guardian/core/mechanics/spear.js';
/** Canonical Core guardian skill fragments grouped by their GW2 owner. */
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';

type Runtime = MechanicContext<GuardianRuntimeState, GuardianSkill>;
const consumedCharges = new WeakMap<RuntimeCast<GuardianSkill>, number>();

/** Select illumination at acceptance so delayed packets cannot borrow a later charge or edit executed history. */
function illuminatedSpearEffects(
  runtime: Runtime,
  cast: RuntimeCast<GuardianSkill>,
  profileId: number | string,
  effects: readonly SkillEffect[]
): readonly SkillEffect[] {
  const state = runtime.profession.core;
  const luminance = state.spearLuminanceUntil > cast.start;
  if (!luminance && state.spearIlluminatedUntil <= cast.start) return effects;
  const profile = requireBalanceProfileFromContext(runtime, profileId);
  const multiplier = balanceProfileNumber(profile, 'damageMultiplier');
  if (!(multiplier > 1)) return effects;
  if (!luminance) consumedCharges.set(cast, state.spearIlluminatedUntil);
  let firstBonus: SkillEffect | undefined;
  let selected: readonly SkillEffect[];
  if (cast.skill.id === ID.SOLAR_STORM) {
    const projectiles: SkillEffect[] = [];
    for (const [name, index] of [
      ['Fourth projectile', 4],
      ['Fifth projectile', 5]
    ] as const) {
      const effect = requireEffect(profile, 'strike', name);
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
      actorType: 'effect',
      source: 'Skill',
      sourceId: 'guardian.illuminated',
      event: {
        procType: 'skill',
        name: 'Illuminated',
        sourceSkill: cast.skill.name,
        icon: 'https://wiki.guildwars2.com/images/7/7d/Illuminated.png',
        detail: `${cast.skill.name} illuminated (x${multiplier})`
      }
    }
  ];
}

/** Committed casts grant or consume the current window; an expiry wake can clear only its own deadline. */
function completeSpearIllumination(runtime: Runtime, cast: RuntimeCast<GuardianSkill>, symbol: boolean): void {
  const state = runtime.profession.core;
  if (consumedCharges.get(cast) === state.spearIlluminatedUntil) {
    state.spearIlluminatedArmed = false;
    state.spearIlluminatedUntil = 0;
  }

  const profile = requireBalanceProfileFromContext(runtime, PROFILE.spearLuminance);
  const effect = requireEffect(profile, 'buff', symbol ? 'guardian-spear-luminance' : 'illuminated');
  if (!effect) return;
  const duration = effectNumber(profile, effect, 'duration');
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
        actorType: 'effect',
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
    state.spearIlluminatedArmed = expiresAt > runtime.time;
    state.spearIlluminatedUntil = state.spearIlluminatedArmed ? expiresAt : 0;
  }

  if (expiresAt > runtime.time)
    runtime.schedule(GUARDIAN_SPEAR_EXPIRY, expiresAt, { symbol, expiresAt }, undefined, -220);
}

export const GUARDIAN_WEAPONS_SPEAR_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.HELIO_RUSH]: {
    // Capture illumination at acceptance and settle only that captured charge on commitment.
    effectVariants: [
      {
        when: (runtime, cast) =>
          runtime.profession.core.spearLuminanceUntil > cast.start ||
          runtime.profession.core.spearIlluminatedUntil > cast.start,
        profileId: PROFILE.spearHelioRush,
        transform: (runtime, cast) =>
          illuminatedSpearEffects(runtime, cast, PROFILE.spearHelioRush, cast.skill.effects ?? [])
      }
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
        boon: 'Resolution',
        duration: 4
      }
    ])
  },
  [ID.GLEAMING_DISC]: {
    // Capture illumination at acceptance and settle only that captured charge on commitment.
    effectVariants: [
      {
        when: (runtime, cast) =>
          runtime.profession.core.spearLuminanceUntil > cast.start ||
          runtime.profession.core.spearIlluminatedUntil > cast.start,
        profileId: PROFILE.spearGleamingDisc,
        transform: (runtime, cast) =>
          illuminatedSpearEffects(runtime, cast, PROFILE.spearGleamingDisc, cast.skill.effects ?? [])
      }
    ],
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
    // Capture illumination at acceptance and settle only that captured charge on commitment.
    effectVariants: [
      {
        when: (runtime, cast) =>
          runtime.profession.core.spearLuminanceUntil > cast.start ||
          runtime.profession.core.spearIlluminatedUntil > cast.start,
        profileId: PROFILE.spearSolarStorm,
        transform: (runtime, cast) =>
          illuminatedSpearEffects(runtime, cast, PROFILE.spearSolarStorm, cast.skill.effects ?? [])
      }
    ],
    sideEffects: [{ on: 'castCommit', do: { type: 'guardian.spear-illumination' } }],
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
    // The symbol grants an independent window from semantic completion.
    sideEffects: [{ on: 'castCommit', do: { type: 'guardian.spear-luminance' } }],
    castTimeMs: 440,

    cooldown: 20,
    // The Light field begins on the initial impact and lasts four seconds.
    comboFields: [{ ownerId: 'guardian', fieldType: 'Light', duration: 4, startMs: 360, startAnchor: 'castStart' }],
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        ticks: [{ atMs: 360, coefficient: 1.5 }],
        name: 'Symbol of Luminance — Initial'
      },
      {
        type: 'strike',
        ticks: Array.from({ length: 5 }, (_, index) => ({ atMs: 360 + index * 1000, coefficient: 2.5 / 5 })),
        name: 'Symbol of Luminance'
      },
      {
        // The knockback belongs to the initial impact, not the recurring symbol pulses.
        type: 'control',
        controlKind: 'knockback',
        atMs: 360
      }
    ])
  }
});

export const guardianSpearActions: RuntimeProfession<GuardianRuntimeState, GuardianSkill>['sideEffectHandlers'] = {
  'guardian.spear-illumination'(runtime, context) {
    if (context.kind === 'cast') completeSpearIllumination(runtime, context.cast, false);
  },
  'guardian.spear-luminance'(runtime, context) {
    if (context.kind === 'cast') completeSpearIllumination(runtime, context.cast, true);
  }
};
