/** Select committed meteor impacts before applying hitbox sampling and per-cast damage falloff. */
import { strikeEffectTicks } from '#gw2/platform/effects/authoring.js';
import type { SkillEffect, StrikeTick } from '#gw2/platform/effects/types.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { cancelledBeforeEffectCommit } from '#gw2/platform/execution/cast-effects.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { skillNumber } from '#gw2/platform/skills/balance-profiles.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import type {
  ElementalistRuntime,
  ElementalistRuntimeState,
  ElementalistSkill
} from '#gw2/professions/elementalist/types.js';
import { clamp } from '#kernel/core/numeric.js';

/** Missed or uncommitted impacts do not consume falloff, and each activation owns its hit sequence. */
export function selectMeteorShowerImpacts(
  runtime: ElementalistRuntime,
  cast: RuntimeCast<ElementalistSkill>,
  effects: readonly SkillEffect[]
): readonly SkillEffect[] {
  const chance =
    runtime.combat.targetHitboxSize() === 'small'
      ? clamp(skillNumber(cast.skill, 'meteorSmallTargetHitChance'), 0, 1)
      : 1;
  const reduction = skillNumber(cast.skill, 'meteorDamageReductionPerHit');
  const minimum = skillNumber(cast.skill, 'meteorMinimumDamageFactor');
  const selected = new Map<number, StrikeTick[]>();
  const impacts = effects
    .flatMap((effect, effectIndex) => {
      if (
        effect.type !== 'strike' ||
        cancelledBeforeEffectCommit(cast.skill, effect, cast.start, cast.fullEnd, cast.effectiveEnd)
      )
        return [];

      return strikeEffectTicks(effect).map((tick) => ({ effectIndex, tick }));
    })
    .sort((a, b) => a.tick.atMs - b.tick.atMs || a.effectIndex - b.effectIndex);
  let progress = 0;
  let landed = 0;
  for (const { effectIndex, tick } of impacts) {
    // Deterministic runs spread the expected contacts across the entire shower instead of truncating its tail.
    progress += chance;
    const hits =
      runtime.random.mode === 'stochastic'
        ? runtime.random.next('elementalist.meteor-shower.hitbox') < chance
        : progress >= 1;

    if (progress >= 1) progress -= 1;

    if (!hits) continue;

    const ticks = selected.get(effectIndex) ?? [];
    ticks.push({ ...tick, coefficient: tick.coefficient * Math.max(minimum, 1 - landed * reduction) });
    selected.set(effectIndex, ticks);
    landed += 1;
  }

  return effects.flatMap<SkillEffect>((effect, index) => {
    if (effect.type !== 'strike') return [effect];

    const ticks = selected.get(index);
    return ticks ? [{ ...effect, ticks }] : [];
  });
}

/** Cancelling before any meteor commits replaces normal recharge with the fixed cancellation cooldown. */
export const elementalistStaffLifecycle = {
  onCastCancel(runtime, cast) {
    if (cast.skill.id !== ID.METEOR_SHOWER) return;

    runtime.cooldownController.setReadyAt(
      cast.skill.id,
      runtime.time + skillNumber(cast.skill, 'meteorCancelCooldown')
    );
  }
} satisfies RuntimeHooks<ElementalistRuntimeState, ElementalistSkill>;
