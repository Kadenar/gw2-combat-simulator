import { committedActionsFromStrikePackets, quicknessRuntimeDurationMs } from '../../effect-packets.js';
import type { EvtcProfessionReconstructionContext, EvtcRecordedRotationAction } from '../types.js';
import { normalized, skillForAction } from './shared.js';

const MAX_AUTOATTACK_IMPACT_MS = 2000;
const AUTOATTACK_COMPLETION_TOLERANCE_MS = 75;

function isAutoattack(context: EvtcProfessionReconstructionContext, action: EvtcRecordedRotationAction): boolean {
  return normalized(skillForAction(context, action)?.slot) === 'weapon_1';
}

export function removeUncommittedEngineerAutoattacks(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  const autoattacks = actions.filter((action) => isAutoattack(context, action));
  const committed = committedActionsFromStrikePackets(context, autoattacks, {
    maxFallbackImpactMs: MAX_AUTOATTACK_IMPACT_MS
  });
  const retained = actions.filter((action) => !isAutoattack(context, action) || committed.has(action));

  return retained.map((action) => {
    if (!isAutoattack(context, action) || !committed.has(action)) return action;
    const skill = skillForAction(context, action);
    const runtimeDuration = quicknessRuntimeDurationMs(skill);
    const observedDuration = Math.max(0, action.end - action.start);
    const nextSerialAction = actions
      .filter((candidate) => {
        if (candidate.start <= action.start) return false;
        const candidateSkill = skillForAction(context, candidate);
        return candidateSkill?.independentCast !== true && candidateSkill?.canCastConcurrently !== true;
      })
      .sort((left, right) => left.start - right.start || left.eventIndex - right.eventIndex)[0];
    const nextSerialOffset =
      nextSerialAction == null ? Number.POSITIVE_INFINITY : nextSerialAction.start - action.start;
    // arcdps can emit a near-zero autoattack stop after a dodge even though its hit and the next serial-action boundary prove that the cast occupied its normal lane.
    const animationStopArtifact =
      observedDuration < AUTOATTACK_COMPLETION_TOLERANCE_MS &&
      runtimeDuration > 0 &&
      nextSerialAction != null &&
      nextSerialOffset + AUTOATTACK_COMPLETION_TOLERANCE_MS >= runtimeDuration;
    return animationStopArtifact ? { ...action, forceCompleteReplay: true } : action;
  });
}
