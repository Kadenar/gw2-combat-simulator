import { requireBalanceProfileFromContext } from '#gw2/platform/engine/skills/balance-profiles.js';
import type { MechanicContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import type { SkillEffect } from '#gw2/platform/engine/skills/types.js';

/** Select one authored variant at acceptance; its packets retain normal timing, cancellation, and attribution. */
export function selectSkillEffects(runtime: MechanicContext, cast: RuntimeCast): readonly SkillEffect[] {
  const variant = cast.skill.effectVariants?.find((candidate) => candidate.when(runtime.queries, cast));
  if (!variant) return cast.skill.effects ?? [];
  // An intrinsic acceptance transform uses the selected skill payload without copying it into a second profile.
  const effects =
    (variant.profileId == null ? cast.skill : requireBalanceProfileFromContext(runtime, variant.profileId)).effects ??
    [];
  return variant.transform?.(runtime, cast, effects) ?? effects;
}
