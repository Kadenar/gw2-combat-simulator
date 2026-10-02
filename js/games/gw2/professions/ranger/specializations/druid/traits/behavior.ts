import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import type { SkillEffect } from '#gw2/platform/engine/skills/types.js';
import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import { rangerEvent } from '#gw2/professions/ranger/core/events.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import { DRUID_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/ranger/specializations/druid/profiles.js';
import type { RangerSkill, RangerRuntime } from '#gw2/professions/ranger/types.js';

/** Trait packets retain their cast-relative pulse times and are filtered by the shared interruption owner. */
export function avatarEffects(
  runtime: RangerRuntime,
  cast: RuntimeCast<RangerSkill>,
  effects: readonly SkillEffect[]
): readonly SkillEffect[] {
  if (!cast.skill.celestialAvatarSkill) return effects;
  const pulses = cast.skill.id === ID.NATURAL_CONVERGENCE ? [520, 1160, 1640, 2040] : [0];
  const result = [...effects];
  if (hasTrait(runtime, TRAIT.GRACE_OF_THE_LAND)) {
    const profile = requireBalanceProfileFromContext(runtime, TRAIT.GRACE_OF_THE_LAND);
    const effect = requireEffect(profile, 'boon', 'alacrity');
    if (effect)
      for (const atMs of pulses)
        result.push({
          ...effect,
          source: 'Trait',
          sourceId: TRAIT.GRACE_OF_THE_LAND,
          skillName: 'Grace of the Land',
          actorType: 'effect',
          timingAnchor: 'castStart',
          interruptCommitMs: 0,
          atMs
        });
  }

  if (!hasTrait(runtime, TRAIT.ECLIPSE)) return result;
  const names = new Map<number, string>([
    [ID.COSMIC_RAY, 'Cosmic Ray'],
    [ID.SEED_OF_LIFE, 'Seed of Life'],
    [ID.LUNAR_IMPACT, 'Lunar Impact'],
    [ID.REJUVENATING_TIDES, 'Rejuvenating Tides']
  ]);
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.ECLIPSE);
  for (const [i, atMs] of pulses.entries()) {
    const name =
      cast.skill.id === ID.NATURAL_CONVERGENCE
        ? i === pulses.length - 1
          ? 'Natural Convergence final pulse'
          : 'Natural Convergence'
        : names.get(Number(cast.skill.id));
    if (!name) continue;
    const effect = requireEffect(profile, 'condition', name);
    if (effect)
      result.push({
        ...effect,
        source: 'Trait',
        sourceId: TRAIT.ECLIPSE,
        skillName: 'Eclipse',
        actorType: 'effect',
        ownerActorType: 'player',
        interruptCommitMs: 0,
        timingAnchor: cast.skill.id === ID.LUNAR_IMPACT ? 'castEnd' : 'castStart',
        atMs
      });
  }

  return result;
}

/** Fires at the Avatar transition before chain reset and swap reactions. */
export function applyNaturalBalance(runtime: RangerRuntime): void {
  if (hasTrait(runtime, TRAIT.NATURAL_BALANCE)) {
    const profile = requireBalanceProfileFromContext(runtime, TRAIT.NATURAL_BALANCE);
    const effect = requireEffect(profile, 'buff', 'natural-balance');
    if (effect)
      runtime.emitProcedural(
        rangerEvent(
          {
            at: runtime.time,
            source: 'Trait',
            sourceId: TRAIT.NATURAL_BALANCE,
            skillId: TRAIT.NATURAL_BALANCE,
            skillName: 'Natural Balance',
            kind: String(effect.kind),
            duration: effectNumber(profile, effect, 'duration'),
            stacks: effectNumber(profile, effect, 'stacks')
          },
          'buff'
        )
      );
  }
}

/** Eclipse scales only native Astral Force gain from accepted player impacts. */
export function eclipseAstralForceMultiplier(runtime: RangerRuntime): number {
  return hasTrait(runtime, TRAIT.ECLIPSE)
    ? balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.resources), 'coefficientMultiplier')
    : 1;
}
