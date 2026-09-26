import { requireBalanceProfileFromContext } from '#gw2/platform/engine/skills/balance-profiles.js';
import type { Gw2Runtime, RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import type { SkillEffect } from '#gw2/platform/engine/skills/types.js';

/** Select one authored variant at acceptance; its packets retain normal timing, cancellation, and attribution. */
export function selectSkillEffects(runtime: Gw2Runtime, cast: RuntimeCast): readonly SkillEffect[] {
  const variant = cast.skill.effectVariants?.find((candidate) => candidate.when(runtime, cast));
  if (!variant) return cast.skill.effects ?? [];
  const effects = requireBalanceProfileFromContext(runtime, variant.profileId).effects ?? [];
  return variant.transform?.(runtime, cast, effects) ?? effects;
}
