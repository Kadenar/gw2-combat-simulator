import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import { DRUID_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/ranger/specializations/druid/profiles.js';
import {
  LUNAR_IMPACT_HIT_MS,
  SEED_OF_LIFE_DETONATION_MS
} from '#gw2/professions/ranger/specializations/druid/skills/index.js';
import type { RangerRuntime, RangerSkill } from '#gw2/professions/ranger/types.js';

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
        // Eclipse belongs to the skill impact: the seed detonation or Lunar Impact's landed daze.
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        atMs:
          cast.skill.id === ID.SEED_OF_LIFE
            ? SEED_OF_LIFE_DETONATION_MS
            : cast.skill.id === ID.LUNAR_IMPACT
              ? LUNAR_IMPACT_HIT_MS
              : atMs
      });
  }

  return result;
}

/** Eclipse scales only native Astral Force gain from accepted player impacts. */
export function eclipseAstralForceMultiplier(runtime: RangerRuntime): number {
  return hasTrait(runtime, TRAIT.ECLIPSE)
    ? balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.resources), 'coefficientMultiplier')
    : 1;
}
