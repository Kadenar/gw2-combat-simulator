import { canonicalTime } from '#kernel/core/clock.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import { buildThiefCondition, type ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import { completeThiefSteal } from '#gw2/professions/thief/core/mechanics/steal.js';
import { stealAccepted } from '#gw2/professions/thief/core/mechanics/boundaries.js';
import { initialMalice, stolenSkillGrant } from '#gw2/professions/thief/specializations/deadeye/traits/behavior.js';
import { maliceGained, markCompleted } from '#gw2/professions/thief/specializations/deadeye/mechanics/boundaries.js';
import { DEADEYE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/thief/specializations/deadeye/profiles.js';
import { deadeyeState, deadeyeCastFacts } from '#gw2/professions/thief/specializations/deadeye/state.js';
import type { ThiefRuntimeState, ThiefSkill } from '#gw2/professions/thief/types.js';

export const DEADEYE_MARK_EXPIRY = 'thief.deadeye-mark-expire';

/**
 * Marking a target refreshes the mark; re-marking the same live target adds to its malice instead of resetting it.
 * The mark also grants Deadeye's stolen skills and schedules its own expiry.
 */
function completeDeadeyesMark(runtime: ThiefRuntime, cast: RuntimeCast<ThiefSkill>): void {
  const state = deadeyeState.from(runtime);
  runtime.fireTrigger(stealAccepted, { cast });
  const remarking = state.markedTargetId === 'primary-target' && state.markExpiresAt > runtime.time;
  state.markedTargetId = 'primary-target';
  state.markExpiresAt = canonicalTime(
    runtime.time +
      balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.resources), 'durationMultiplier')
  );
  state.markGeneration += 1;
  if (remarking) runtime.resourceController.grant('malice', initialMalice(runtime));
  else runtime.resourceController.replace('malice', initialMalice(runtime));
  if (!remarking) state.maleficentSevenTriggered = false;
  runtime.fireTrigger(maliceGained, { cast });
  const grant = stolenSkillGrant(runtime);
  completeThiefSteal(runtime, grant.skillIds, grant.forcedSkillId);
  runtime.fireTrigger(markCompleted, { cast });

  runtime.schedule(DEADEYE_MARK_EXPIRY, state.markExpiresAt, { generation: state.markGeneration });
}

/** Mark expiry resets malice; a stale expiry from an earlier mark is ignored. */
export function expireDeadeyesMark(runtime: ThiefRuntime, data: unknown): void {
  const state = deadeyeState.from(runtime);
  if ((data as { generation: number }).generation !== state.markGeneration || runtime.time < state.markExpiresAt)
    return;
  state.markedTargetId = null;
  state.markExpiresAt = 0;
  runtime.resourceController.replace('malice', 0);
  state.maleficentSevenTriggered = false;
}

/** Torment from a malicious finisher scales with the malice it was cast with. */
function maliceTorment(
  runtime: ThiefRuntime,
  cast: RuntimeCast<ThiefSkill>,
  profileId: SkillId,
  malice: number,
  trait: boolean
) {
  const profile = requireBalanceProfileFromContext(runtime, profileId);
  const torment = requireEffect(profile, 'condition', 'Torment');
  if (!torment) return;
  const baseDuration = effectNumber(profile, torment, 'duration');
  const maliceDuration = malice * balanceProfileNumber(profile, 'durationMultiplier');
  runtime.effects.emit({
    kind: 'packet',
    event: buildThiefCondition(cast.skill, {
      at: runtime.time,
      ...(trait ? { source: 'Trait', name: 'Malicious Ashen Assault — Torment' } : {}),
      activationId: cast.id,
      condition: String(torment.condition),
      // Pistol multiplies its duration unit by twice the consumed malice; spear adds its half-second base.
      duration:
        profileId === PROFILE.maliciousSneakAttack ? baseDuration * maliceDuration : baseDuration + maliceDuration,
      stacks: effectNumber(profile, torment, 'stacks')
    })
  });
}

/** Skill declarations select these actions; runtime hooks only register the skill-owned implementations. */
export const deadeyeSkillSideEffectHandlers: NonNullable<
  RuntimeHooks<ThiefRuntimeState, ThiefSkill>['sideEffectHandlers']
> = {
  'thief.clear-revealed'(runtime) {
    runtime.profession.core.revealedUntil = Math.min(runtime.profession.core.revealedUntil, runtime.time);
  },
  'thief.deadeyes-mark'(runtime, context) {
    if (context.kind === 'cast') completeDeadeyesMark(runtime, context.cast);
  },
  'thief.mercy'(runtime) {
    // Consume live commitment-time malice before refunding the selected profile's amount.
    const state = deadeyeState.from(runtime);
    const malice = runtime.resourceController.value('malice');
    runtime.resourceController.replace('malice', 0);
    state.maleficentSevenTriggered = false;
    const mercy = requireBalanceProfileFromContext(runtime, PROFILE.mercy);
    const initiativeGain =
      balanceProfileNumber(mercy, 'resourceGain') + malice * balanceProfileNumber(mercy, 'attributePerStack');
    if (initiativeGain > 0) runtime.resourceController.grant('initiative', initiativeGain);
  },
  'thief.sneak-torment'(runtime, context) {
    if (context.kind === 'cast')
      maliceTorment(
        runtime,
        context.cast,
        PROFILE.maliciousSneakAttack,
        deadeyeCastFacts.get(context.cast)?.markedMalice ?? 0,
        false
      );
  },
  'thief.ashen-torment'(runtime, context) {
    if (context.kind === 'cast')
      maliceTorment(
        runtime,
        context.cast,
        PROFILE.maliciousAshenAssault,
        deadeyeCastFacts.get(context.cast)?.markedMalice ?? 0,
        true
      );
  }
};
