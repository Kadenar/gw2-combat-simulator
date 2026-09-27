import { strikeEffectCoefficient, strikeEffectTicks } from '#gw2/platform/engine/effects/authoring.js';
import { effectFirstAt, scaleCastBoundTiming } from '#gw2/platform/engine/effects/materializer.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { gw2EffectExpiresAt } from '#gw2/platform/skills/timing.js';
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';
import { GUARDIAN_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/guardian/core/profiles.js';
import type { SkillEffect, SkillId } from '#gw2/platform/engine/skills/types.js';
import type { Gw2Runtime, RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import type { GuardianRuntimeState } from '#gw2/professions/guardian/types.js';

type Runtime = Gw2Runtime<GuardianRuntimeState>;
const profiles: Readonly<Record<SkillId, SkillId>> = {
  [ID.HELIO_RUSH]: PROFILE.spearHelioRush,
  [ID.GLEAMING_DISC]: PROFILE.spearGleamingDisc,
  [ID.SOLAR_STORM]: PROFILE.spearSolarStorm
};
const consumedCharges = new WeakMap<RuntimeCast, number>();
export const GUARDIAN_SPEAR_EXPIRY = 'guardian.spear-expiry';

/** Select illumination at acceptance so delayed packets cannot borrow a later charge or edit executed history. */
export function illuminatedSpearEffects(
  runtime: Runtime,
  cast: RuntimeCast,
  effects: readonly SkillEffect[]
): readonly SkillEffect[] {
  const profileId = profiles[cast.skill.id];
  if (profileId === undefined) return effects;
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
export function completeSpearIllumination(runtime: Runtime, cast: RuntimeCast): void {
  if (cast.skill.weapon !== 'Spear') return;
  const state = runtime.profession.core;
  if (consumedCharges.get(cast) === state.spearIlluminatedUntil) {
    state.spearIlluminatedArmed = false;
    state.spearIlluminatedUntil = 0;
  }

  const symbol = cast.skill.id === ID.SYMBOL_OF_LUMINANCE;
  if (!symbol && profiles[cast.skill.id] === undefined) return;
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
    runtime.emit({
      type: 'proc',
      procType: 'skill',
      at: runtime.time,
      source: 'Skill',
      sourceId: 'guardian.symbol-of-luminance',
      actorType: 'effect',
      activationId: cast.id,
      skillId: cast.skill.id,
      skillName: cast.skill.name,
      name: 'Symbol of Luminance',
      sourceSkill: cast.skill.name,
      icon: 'https://render.guildwars2.com/file/0E1E2D69CBC3C0E36217506C6CCB710138035373/3379129.png',
      detail: 'All spear skills illuminated while active'
    });
  } else {
    state.spearIlluminatedArmed = expiresAt > runtime.time;
    state.spearIlluminatedUntil = state.spearIlluminatedArmed ? expiresAt : 0;
  }

  if (expiresAt > runtime.time)
    runtime.schedule(GUARDIAN_SPEAR_EXPIRY, expiresAt, { symbol, expiresAt }, undefined, -220);
}

/** Exclusive window expiry runs before same-time commands and cannot erase a refreshed occurrence. */
export function expireSpearIllumination(runtime: Runtime, data: unknown): void {
  const { symbol, expiresAt } = data as { symbol: boolean; expiresAt: number };
  const state = runtime.profession.core;
  if (symbol) {
    if (state.spearLuminanceUntil === expiresAt) state.spearLuminanceUntil = 0;
  } else if (state.spearIlluminatedUntil === expiresAt) {
    state.spearIlluminatedArmed = false;
    state.spearIlluminatedUntil = 0;
  }
}
