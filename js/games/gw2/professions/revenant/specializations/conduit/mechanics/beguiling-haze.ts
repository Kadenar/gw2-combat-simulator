/** Own Haze's accepted variant, temporary charges, and saved main recharge through completion and reset. */
import { gw2CooldownReadyAt } from '#gw2/platform/combat/action-tick.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import { denySkillCast } from '#gw2/platform/execution/availability.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { requireSkill, skillNumber } from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import { completeRevenantCast } from '#gw2/professions/revenant/core/mechanics/completion.js';
import { beguilingHazeCastDuration } from '#gw2/professions/revenant/data/beguiling-haze-timing.js';
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import { conduitState, type ConduitState } from '#gw2/professions/revenant/specializations/conduit/state.js';
import type { RevenantEnergyCostInput, RevenantRuntimeState, RevenantSkill } from '#gw2/professions/revenant/types.js';

// Accepted main casts retain their identity after effect selection changes the live charge count.
const mainCasts = new WeakSet<RuntimeCast<RevenantSkill>>();

function isFollowUp(
  state: Readonly<Partial<Pick<ConduitState, 'beguilingHazeCharges'>>>,
  skill: RevenantSkill
): boolean {
  return skill.id === ID.BEGUILING_HAZE && (state.beguilingHazeCharges ?? 0) > 0;
}

/** Runtime and palette costs use the same variant decision without consuming a charge. */
export function beguilingHazeEnergyCost(
  { state, catalog }: Pick<RevenantEnergyCostInput, 'state' | 'catalog'>,
  skill: RevenantSkill
): number | undefined {
  return isFollowUp(state, skill)
    ? Math.max(0, skillNumber(requireSkill(catalog, ID.BEGUILING_HAZE_FOLLOW_UP), 'energyCost'))
    : undefined;
}

/** Capture the payload before spending the final charge, including an intentionally removed strike. */
function selectEffects(
  runtime: RevenantRuntime,
  cast: RuntimeCast<RevenantSkill>,
  effects: readonly SkillEffect[]
): readonly SkillEffect[] {
  if (cast.cancelledBeforeCommit) return [];

  const state = conduitState.from(runtime.profession);

  if (isFollowUp(state, cast.skill)) {
    const selected = requireSkill(runtime.helpers, ID.BEGUILING_HAZE_FOLLOW_UP).effects ?? [];
    state.beguilingHazeCharges -= 1;
    return selected;
  }

  mainCasts.add(cast);
  return effects;
}

/** Keep selection at the skill's declared effect-selection position, after acceptance costs and before emission. */
export const beguilingHazeVariants: NonNullable<Skill['effectVariants']> = [
  { when: () => true, transform: selectEffects }
];

/** Exhausting temporary follow-ups restores the main recharge, or readies the main skill if none remains. */
function completeHaze(runtime: RevenantRuntime, cast: RuntimeCast<RevenantSkill>): void {
  const skill = cast.skill;
  const state = conduitState.from(runtime.profession);

  if (mainCasts.delete(cast)) {
    state.beguilingHazeCharges = Math.max(
      0,
      skillNumber(requireSkill(runtime.helpers, ID.BEGUILING_HAZE_FOLLOW_UP), 'maximumStacks')
    );
    state.beguilingHazeRecharge = runtime.cooldownController.readAmmo(skill.id)?.recharges[0] ?? null;
    state.beguilingHazeReadyAt =
      runtime.cooldownController.readyAt(skill.id) ??
      runtime.cooldownController.readAmmo(skill.id)?.nextRechargeAt ??
      runtime.time;
  }

  if (!runtime.cooldownController.readAmmo(skill.id)) return;

  if (state.beguilingHazeCharges > 0) {
    runtime.cooldownController.replaceAmmoCharges(skill, state.beguilingHazeCharges, state.beguilingHazeCharges, []);
  } else if (!state.beguilingHazeRecharge) {
    runtime.cooldownController.replaceAmmoCharges(skill, 1, 1, []);
    state.beguilingHazeReadyAt = runtime.time;
  } else {
    runtime.cooldownController.replaceAmmoCharges(skill, 1, 0, [state.beguilingHazeRecharge]);
    state.beguilingHazeReadyAt = runtime.cooldownController.readAmmo(skill.id)!.nextRechargeAt!;
    runtime.cooldownController.refreshAmmo(skill, runtime.time);
  }
}

/** Register all execution transitions while declarations retain tuning and their ordered completion actions. */
export const beguilingHazeLifecycle: RuntimeHooks<RevenantRuntimeState, RevenantSkill> = {
  availability(runtime, skill) {
    if (skill.id !== ID.BEGUILING_HAZE) return { ready: true };

    const state = conduitState.from(runtime.profession);
    const recharge = state.beguilingHazeRecharge;
    const readyAt = recharge
      ? gw2CooldownReadyAt(runtime.cooldownController.project(skill, recharge))
      : state.beguilingHazeReadyAt;

    return !isFollowUp(state, skill) && runtime.time < readyAt
      ? denySkillCast(skill, 'revenant.beguiling-haze-cooldown', 'Beguiling Haze is recharging.', readyAt)
      : { ready: true };
  },
  resolveCastSkill(runtime, skill) {
    if (!isFollowUp(conduitState.from(runtime.profession), skill)) return skill;

    return {
      ...skill,
      interruptCommitMs: skillNumber(requireSkill(runtime.helpers, ID.BEGUILING_HAZE_FOLLOW_UP), 'interruptCommitMs')
    };
  },
  castDurationMs(runtime, skill, durationMs) {
    if (skill.id !== ID.BEGUILING_HAZE) return durationMs;

    return (
      beguilingHazeCastDuration(
        durationMs / 1000,
        isFollowUp(conduitState.from(runtime.profession), skill),
        requireSkill(runtime.helpers, ID.BEGUILING_HAZE_FOLLOW_UP)
      ) * 1000
    );
  },
  sideEffectHandlers: {
    'revenant.complete-haze'(runtime, context) {
      if (context.kind !== 'cast') return;

      // Shared Wisdom is already published; Core rewards must observe the state before the ammo transition.
      completeRevenantCast(runtime, context.cast);
      completeHaze(runtime, context.cast);
    }
  },
  onCooldownReset(runtime) {
    const state = conduitState.from(runtime.profession);
    state.beguilingHazeReadyAt = runtime.time;
    state.beguilingHazeRecharge = null;

    // Only pending follow-ups need a pool after reset; ordinary ammo initializes on the next cast.
    const charges = state.beguilingHazeCharges;

    if (charges <= 0) return;

    const skill = requireSkill(runtime.helpers, ID.BEGUILING_HAZE);
    runtime.cooldownController.ensureAmmo(skill);
    runtime.cooldownController.replaceAmmoCharges(skill, charges, charges, []);
  }
};
